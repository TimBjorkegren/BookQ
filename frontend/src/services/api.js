export async function generateQuestions(collectionName) {
  try {
    const res = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection_name: collectionName }),
    });

    if (!res.ok) {
      throw new Error("Backend returned an error: " + res.status);
    }

    const data = await res.json();

    return data.questions || [];
  } catch (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Cant upload document");
  }

  return await res.json();
}
