export async function generateQuestions(collectionName) {
  const res = await fetch("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection_name: collectionName }),
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    throw new Error(data.detail || data.error || "Backend returned an error");
  }

  return data.questions || [];
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    throw new Error(data.detail || data.error || "Kunde inte ladda upp dokumentet");
  }

  return data;
}

export async function gradeReasoningAnswer(question, answer = {}) {
  const res = await fetch("/grade_reasoning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: question.question,
      student_answer: answer.text || "",
      explanation: answer.explanation || "",
      keywords: question.keywords,
      max_score: question.max_score,
    }),
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    throw new Error(data.detail || data.error || "Kunde inte rätta resonemangssvaret");
  }

  return data;
}

async function parseResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await res.json();
  }

  const text = await res.text();
  return {
    detail: text || `Servern svarade med status ${res.status}`,
  };
}
