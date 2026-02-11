import { useState } from "react";
import { generateQuestions } from "./services/api";
import "./App.css";

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [topic, setTopic] = useState("");
  const [score, setScore] = useState(0);

  const handleGenerate = async () => {
    const ai_questions = await generateQuestions(topic);
    setQuestions(ai_questions);
    setAnswers({});
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
        Score: {score} / {questions.length}
      </div>

      <div className="controls">
        <input
          className="topic-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Skriv ämne"
        />
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
