from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File
from pydantic import BaseModel
from openai import OpenAI
import json

import numpy as np
from PyPDF2 import PdfReader
import docx
from qdrant_client import QdrantClient, models
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
from dotenv import load_dotenv
import os

#---------------- setup ---------------------------------
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY")
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class GenerateRequest(BaseModel):
    collection_name: str

# ------------------endpoints ------------------------------

import re

@app.post("/generate")
async def generate_questions(req: GenerateRequest):
    try:
        chunks = search_qdrant("", req.collection_name, top_k=10)
        if not chunks:
            return {"error": "Inga resultat hittades i dokumentet"}

        # Skapa prompt
        prompt = f"""
Skapa 5 faktabaserade flervalsfrågor baserat på följande text:
{"".join(chunks)}

Returnera alltid resultatet som en JSON-array med objekt med fälten:
- question: själva frågan
- options: en lista med svarsalternativ
- answer: korrekt svar

Exempel på korrekt JSON-format:

[
  {{
    "question": "Vad är Sveriges huvudstad?",
    "options": ["Malmö","Göteborg","Stockholm","Uppsala"],
    "answer": "Stockholm"
  }}
] 
"""

        # Skicka till OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )

        questions_text = response.choices[0].message.content

        # Försök extrahera JSON med regex (säker mot extra text)
        match = re.search(r"\[.*\]", questions_text, re.DOTALL)
        if not match:
            return {"error": "Kunde inte hitta JSON i OpenAI-svaret", "raw": questions_text}

        questions_json = json.loads(match.group())
        return {"questions": questions_json}

    except Exception as e:
        return {"error": "Något gick fel", "details": str(e)}

    



# QDRANT

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        text = read_file(file)
        chunks = chunk_text(text)
        embeddings = create_embeddings(chunks, client)
        collection_name = collection_name_from_file(file.filename)
        does_collection_exist(collection_name)
        upload_to_qdrant(chunks, embeddings, collection_name)

        return {"message": "Document uploaded", "collection": collection_name}
    
    except Exception as e:
        return {"error": str(e)}


def does_collection_exist(collection_name):
    collections = qdrant.get_collections().collections
    existing = [c.name for c in collections]
    if collection_name not in existing:
        qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=1536,
                distance=Distance.COSINE
            )
        )


def collection_name_from_file(filename):
    name = filename.lower().replace(" ", "_").replace(".", "_")
    return f"doc_{name}"
    

def upload_to_qdrant(chunks, embeddings, document_name):
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=embedding.tolist() if isinstance(embedding, np.ndarray) else embedding,
            payload={"text": chunk, "document_name": document_name}
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    qdrant.upsert(
        collection_name=document_name,
        points=points
    )

def search_qdrant(question, collection_name, top_k=5):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=question
    )
    query_embedding = response.data[0].embedding

    results = qdrant.query_points(
        collection_name=collection_name,
        prefetch=[],
        query=query_embedding,
        limit=top_k
    )
    print("Qdrant search results:", results.points)

    texts = []
    for matches in results.points:
        texts.append(matches.payload["text"])

    
    return texts

# FILE
def read_file(file: UploadFile):
    text = ""
    if file.content_type == "application/pdf":
        reader = PdfReader(file.file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    elif file.content_type == "text/plain":
        text = file.file.read().decode("utf-8")
    elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        doc = docx.Document(file.file)
        for para in doc.paragraphs:
            text += para.text + "\n"
    else:
        raise ValueError("Filformatet stöds inte!")
    return text

def chunk_text(text, chunksize=800):
    chunks = []
    for i in range(0, len(text), chunksize):
        chunks.append(text[i:i + chunksize])
    return chunks

def create_embeddings(chunks, client):
    embeddings = []
    for chunk in chunks:
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=chunk
        )
        embeddings.append(response.data[0].embedding)
    return embeddings
    