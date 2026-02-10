from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai.api_key = os.getenv("OPENAI_API_KEY")

class GenerateRequest(BaseModel):
    topic: str


@app.post("/generate")
async def generate_questions(req: GenerateRequest):
    prompt = f"""
Skapa 3 faktabaserade flervalsfrågor för ämnet: {req.topic}.
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
    try:
        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        questions_text = response.choices[0].message.content
        questions_json = json.loads(questions_text)
        return {"questions": questions_json}

    except json.JSONDecodeError:
        return {"error": "OpenAI svarade inte med giltig JSON", "raw": questions_text}
    except Exception as e:
        return {"error": "Något gick fel", "details": str(e)}
    
    