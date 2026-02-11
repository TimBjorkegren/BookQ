
export async function generateQuestions(topic) {
  try {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });

    if (!res.ok) {
      throw new Error("Backend returned an error: " + res.status);
    }

    const data = await res.json();

    return data.questions;
  } catch (error) {
    console.error("Error fetching questions:", error);
    return []; 
  }
}
