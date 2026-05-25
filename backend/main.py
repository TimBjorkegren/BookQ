from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
from PyPDF2 import PdfReader
import docx
import json
import os
import re
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    collection_name: str


class GradeReasoningRequest(BaseModel):
    question: str
    student_answer: str = ""
    explanation: str = ""
    keywords: list[str] = []
    max_score: int


@app.post("/generate")
async def generate(req: GenerateRequest):
    chunks = get_document_chunks(req.collection_name, 12)
    if not chunks:
        raise HTTPException(status_code=404, detail="Kunde inte hitta text fran dokumentet.")

    document_text = "\n\n".join(chunks)
    prompt = f"""
Du ar en pedagogisk studiecoach. Skapa fragor som hjalper studenten att forsta, minnas och resonera om dokumentet.

Skapa exakt 5 fragor:
- 3 flervalsfragor (type=mcq)
- 2 resonemangsfragor (type=reasoning)

Regler:
- Fragorna ska vara pa svenska.
- Anvand bara information fran texten.
- Flervalsfragor ska ha exakt 4 svarsalternativ.
- answer maste vara exakt samma text som ett av alternativen.
- Resonemangsfragor ska krava forklaring, jamforelse eller tillampning.
- Returnera endast giltig JSON.

JSON-format:
[
  {{
    "type": "mcq",
    "question": "...",
    "options": ["...", "...", "...", "..."],
    "answer": "...",
    "explanation": "Kort forklaring av varfor svaret ar ratt."
  }},
  {{
    "type": "reasoning",
    "question": "...",
    "keywords": ["..."],
    "max_score": 3,
    "expected_answer": "Kort exempel pa vad ett bra svar bor innehalla."
  }}
]

TEXT:
{document_text}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
    )

    return {"questions": parse_json_array(response.choices[0].message.content)}


@app.post("/grade_reasoning")
async def grade(req: GradeReasoningRequest):
    prompt = f"""
Bedom elevens svar rattvist och pedagogiskt.

Fraga: {req.question}
Svar: {req.student_answer}
Elevens forklaring: {req.explanation}
Begrepp: {", ".join(req.keywords)}
Maxpoang: {req.max_score}

Ge poang utifran:
- om svaret faktiskt besvarar fragan
- om eleven anvander relevanta begrepp
- om forklaringen visar forstaelse, inte bara gissning

Returnera endast giltig JSON:
{{"score": 0, "max_score": {req.max_score}, "feedback": "...", "improvement_tip": "..."}}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    result = parse_json_object(response.choices[0].message.content)
    score = int(result.get("score", 0))
    result["score"] = max(0, min(score, req.max_score))
    result["max_score"] = req.max_score
    return result


@app.post("/generate_reasoning")
async def grade_reasoning_legacy(req: GradeReasoningRequest):
    return await grade(req)


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    text = read_file(file)
    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Dokumentet verkar inte innehalla lasbar text.")

    try:
        embeddings = embed(chunks)
        collection_name = collection_name_from_file(file.filename)

        if collection_name not in [c.name for c in qdrant.get_collections().collections]:
            qdrant.create_collection(
                collection_name,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
            )

        qdrant.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={"text": chunk},
                )
                for chunk, embedding in zip(chunks, embeddings)
            ],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Kunde inte skapa embeddings eller spara dokumentet: {exc}",
        ) from exc

    return {"collection": collection_name}


def parse_json_array(content):
    match = re.search(r"\[.*\]", content or "", re.S)
    if not match:
        raise HTTPException(status_code=502, detail="AI-svaret inneholl ingen JSON-lista.")
    try:
        return json.loads(match.group())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI-svaret var inte giltig JSON.") from exc


def parse_json_object(content):
    match = re.search(r"\{.*\}", content or "", re.S)
    if not match:
        raise HTTPException(status_code=502, detail="AI-svaret inneholl inget JSON-objekt.")
    try:
        return json.loads(match.group())
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI-svaret var inte giltig JSON.") from exc


def collection_name_from_file(filename):
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", filename.lower()).strip("_")
    suffix = uuid.uuid4().hex[:8]
    return f"doc_{safe_name or 'document'}_{suffix}"


def chunk_text(text, chunk_size=1000, overlap=150):
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if not cleaned:
        return []

    chunks = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        chunks.append(cleaned[start:end])
        if end == len(cleaned):
            break
        start = max(end - overlap, start + 1)
    return chunks


def embed(chunks):
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY saknas i .env")

    return [
        client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk,
        ).data[0].embedding
        for chunk in chunks
    ]


def get_document_chunks(collection_name, limit):
    points, _ = qdrant.scroll(
        collection_name=collection_name,
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    return [p.payload["text"] for p in points if p.payload and p.payload.get("text")]


def read_file(file):
    if file.content_type == "application/pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(file.file).pages)
    if file.content_type and file.content_type.endswith("wordprocessingml.document"):
        return "\n".join(paragraph.text for paragraph in docx.Document(file.file).paragraphs)
    if file.content_type == "text/plain":
        return file.file.read().decode("utf-8")
    raise HTTPException(status_code=400, detail="Filformatet stods inte. Ladda upp PDF, DOCX eller TXT.")
