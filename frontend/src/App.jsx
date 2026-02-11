import { useState } from "react";
import { generateQuestions } from "./services/api";

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({})
  const [topic, setTopic] = useState("");
  const [score, setScore] = useState(0)


  const handleGenerate = async () => {
    const ai_questions = await generateQuestions(topic);
    setQuestions(ai_questions);
    setAnswers({});
  };

  const handleAnswer = (questionIndex, option) => {

    if (answers[questionIndex]) return

    setAnswers({
      ...answers,
      [questionIndex]: option
    })
    if (option === questions[questionIndex].answer){
      setScore(score + 1)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>BookQ</h1>
      <h2>Score: {score} / {questions.length}</h2>

      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Skriv ämne"
      />
      <button onClick={handleGenerate}>Generera frågor</button>

      <hr />

      {questions.map((q, qIndex) => (
        <div key={qIndex}>
          <h3>{q.question}</h3>

          {q.options.map((option, oIndex) => (
            <button
              key={oIndex}
              onClick={() => handleAnswer(qIndex, option)}
              style={{ display: "block", marginBottom: 5 }}
            >
              {option}
            </button>
          ))}

          {answers[qIndex] && (
            <p>
              {answers[qIndex] === q.answer
                ? " Rätt!"
                : ` Fel. Rätt svar är: ${q.answer}`
                }
            </p>
          )}

          <hr />
        </div>
      ))}
    </div>
  );
}

export default App;
