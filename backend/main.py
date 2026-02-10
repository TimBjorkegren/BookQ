from fastapi import FastAPI
from pydantic import BaseModel
from typing import List
import openai
import os

app = FastAPI()

openai.api_key = os.getenv("OPENAI_API_KEY")

class GenerateRequest(BaseModel):
    topic: str


@app.post("/generate")
async def generate_questions(req: GenerateRequest):
    prompt = f"Skapa 3 faktabaserade flervalsfrågor för ämnet: {req.topic}. Ge korrekt svar markerat."
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    questions = response.choices[0].message.content
    return {"questions": questions}