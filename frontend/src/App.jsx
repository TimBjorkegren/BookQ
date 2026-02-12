import { useState } from "react";
import { generateQuestions, uploadDocument } from "./services/api";
import "./App.css";

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [file, setFile] = useState(null);
  const [collectionName, setCollectionName] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

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
    if (!collectionName) return alert("ladda upp ett dokument först");
    try {
      const ai_questions = await generateQuestions(collectionName);
      console.log("AI questions:", ai_questions);
      if (!ai_questions || ai_questions.length === 0) {
        alert("Inga frågor genererades. Kontrollera dokumentet eller backend.");
        return;
      }
      setQuestions(ai_questions);
      setAnswers({});
      setScore(0);
    } catch (err) {
      console.error(err);
      alert("Något fick fel vid generering av frågor");
    }
  };

  const handleAnswer = (questionIndex, option) => {
    if (answers[questionIndex]) return;

    setAnswers({
      ...answers,
      [questionIndex]: option,
    });
    if (option === questions[questionIndex].answer) {
      setScore(score + 1);
    }
  };

  return (
    <div className="container">
      <h1 className="title">BookQ</h1>
      <div className="score">
        Score: {score} / {questions?.length || 0}
      </div>

      <div className="controls">
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleUpload}>ladda upp ett dokument</button>
        <button className="generate-btn" onClick={handleGenerate}>
          Generera frågor
        </button>
      </div>

      <div className="questions">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="question-card">
            <h3>{q.question}</h3>

            <div className="options">
              {q.options.map((option, oIndex) => {
                const isAnswered = answers[qIndex];
                const isCorrect = option === q.answer;
                const isSelected = answers[qIndex] === option;

                return (
                  <button
                    key={oIndex}
                    className={`option-btn ${
                      isAnswered
                        ? isCorrect
                          ? "correct"
                          : isSelected
                            ? "wrong"
                            : ""
                        : ""
                    }`}
                    onClick={() => handleAnswer(qIndex, option)}
                    disabled={isAnswered}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {answers[qIndex] && (
              <p
                className={`feedback ${answers[qIndex] === q.answer ? "correct" : "wrong"}`}
              >
                {answers[qIndex] === q.answer
                  ? " Rätt!"
                  : `Fel. Rätt svar är: ${q.answer}`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
