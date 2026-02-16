import { useEffect, useState } from "react";
import { generateQuestions, uploadDocument } from "./services/api";
import "./App.css";

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null);
  const [collectionName, setCollectionName] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    try {
      const response = await uploadDocument(selectedFile);
      setCollectionName(response.collection);
      setQuestions([]);
      setAnswers([]);
      setSubmitted(false);
      setCurrentQuestion(0);
    } catch (error) {
      console.error(error);
      alert("Något gick fel vid uppladdning");
    }
  };

  useEffect(() => {
    if (collectionName) {
      localStorage.setItem("collection", collectionName);
    }
  }, [collectionName]);

  const handleUpload = async () => {
    if (!file) return alert("Välj ett dokument först");
    try {
      const response = await uploadDocument(file);
      setCollectionName(response.collection);
      alert(`Dokument uppladdat! collection: ${response.collection}`);
    } catch (err) {
      console.error(err);
      alert("Gick fel vid uppladdning");
    }
  };

  const handleGenerate = async () => {
    if (!collectionName) return;

    try {
      setLoadingQuestions(true);
      const ai_questions = await generateQuestions(collectionName);

      if (!ai_questions?.length) {
        alert("Inga frågor genererades.");
        return;
      }

      setQuestions(ai_questions);
      setAnswers({});
      setCurrentQuestion(0);
      setSubmitted(false);
    } catch (err) {
      console.error(err);
      alert("Något fick fel vid generering av frågor");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleAnswer = (option) => {
    setAnswers({
      ...answers,
      [currentQuestion]: option,
    });
  };

  const calcScore = () => {
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.answer) score++;
    });
    return score;
  };

  const grade = (score, total) => {
    const percent = (score / total) * 100;
    if (percent >= 90) return "A";
    if (percent >= 80) return "B";
    if (percent >= 70) return "C";
    if (percent >= 60) return "D";
    if (percent >= 50) return "E";
    return "F";
  };

  const studentScore = calcScore();
  const q = questions[currentQuestion];

  return (
    <div className="container">
      <h1 className="title">BookQ</h1>

      <div className="controls">
        <label className="file-upload">
          <input type="file" onChange={handleFileChange} hidden />
          Välj dokument
        </label>

        {collectionName && <p className="status success">Dokument uppladdat</p>}

        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={!collectionName || loadingQuestions}
        >
          {loadingQuestions
            ? "Genererar..."
            : questions.length
              ? "Genererar nya frågor"
              : "Generera frågor"}
        </button>
      </div>

      {questions.length > 0 && !submitted && (
        <div className="progress">
          <div
            className="progress-bar"
            style={{
              width: `${((currentQuestion + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
      )}

      {q && !submitted && (
        <div className="question-card">
          <h3>
            Fråga {currentQuestion + 1} / {questions.length}
          </h3>

          <p>{q.question}</p>

          <div className="options">
            {q.options.map((option, idx) => (
              <button
                key={idx}
                className={`option-btn ${
                  answers[currentQuestion] === option ? "selected" : ""
                }`}
                onClick={() => handleAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="navigation">
            <button
              onClick={() => setCurrentQuestion((i) => i - 1)}
              disabled={currentQuestion === 0}
            >
              ← Föregående
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion((i) => i + 1)}
                disabled={answers[currentQuestion] == null}
              >
                Nästa →
              </button>
            ) : (
              <button
                className="submit-btn"
                onClick={() => setSubmitted(true)}
                disabled={answers[currentQuestion] == null}
              >
                Lämna in
              </button>
            )}
          </div>
        </div>
      )}
      {submitted && (
        <div className="results">
          <h2>🎉 Resultat</h2>
          <p>
            Poäng: {studentScore} / {questions.length}
          </p>
          <h3>Betyg: {grade(studentScore, questions.length)}</h3>

          {questions.map((q, i) => (
            <div key={i} className="result-question">
              <p>
                <strong>{q.question}</strong>
              </p>
              <p className={answers[i] === q.answer ? "correct" : "wrong"}>
                Ditt svar: {answers[i]}
              </p>
              {answers[i] !== q.answer && (
                <p className="correct">Rätt svar: {q.answer}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
