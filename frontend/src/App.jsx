import { useEffect, useMemo, useState } from "react";
import {
  generateQuestions,
  uploadDocument,
  gradeReasoningAnswer,
} from "./services/api";
import "./App.css";

function App() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [collectionName, setCollectionName] = useState(
    () => localStorage.getItem("collection") || "",
  );
  const [currentDocumentName, setCurrentDocumentName] = useState(
    () => localStorage.getItem("documentName") || "",
  );
  const [uploading, setUploading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [grading, setGrading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (collectionName) {
      localStorage.setItem("collection", collectionName);
    } else {
      localStorage.removeItem("collection");
    }
  }, [collectionName]);

  useEffect(() => {
    if (currentDocumentName) {
      localStorage.setItem("documentName", currentDocumentName);
    } else {
      localStorage.removeItem("documentName");
    }
  }, [currentDocumentName]);

  const currentAnswer = answers[currentQuestion];
  const q = questions[currentQuestion];

  const totalMaxScore = useMemo(
    () =>
      questions.reduce(
        (total, question) => total + getQuestionMaxScore(question),
        0,
      ),
    [questions],
  );

  const studentScore = useMemo(
    () =>
      Object.values(results).reduce(
        (total, result) => total + Number(result?.score || 0),
        0,
      ),
    [results],
  );

  const answeredCount = questions.filter((_, index) => isAnswered(questions[index], answers[index])).length;
  const progressPercent = questions.length
    ? ((currentQuestion + 1) / questions.length) * 100
    : 0;

  const isCurrentAnswered = isAnswered(q, currentAnswer);
  const displayedDocumentName =
    currentDocumentName || (collectionName ? "Tidigare uppladdat dokument" : "");

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (collectionName) return;

    try {
      setUploading(true);
      setErrorMessage("");
      setCurrentDocumentName(selectedFile.name);
      const response = await uploadDocument(selectedFile);
      setCollectionName(response.collection);
      resetQuiz();
    } catch (error) {
      console.error(error);
      setCurrentDocumentName("");
      setErrorMessage(error.message || "Något gick fel vid uppladdning.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveDocument = () => {
    setCollectionName("");
    setCurrentDocumentName("");
    setErrorMessage("");
    resetQuiz();
  };

  const handleGenerate = async () => {
    if (!collectionName) return;

    try {
      setLoadingQuestions(true);
      setErrorMessage("");
      const aiQuestions = await generateQuestions(collectionName);

      if (!aiQuestions?.length) {
        setErrorMessage("Inga frågor genererades. Testa med ett dokument som har mer text.");
        return;
      }

      setQuestions(aiQuestions);
      setAnswers({});
      setResults({});
      setCurrentQuestion(0);
      setSubmitted(false);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Något gick fel vid generering av frågor.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSubmit = async () => {
    setGrading(true);
    setErrorMessage("");
    const newResults = {};

    try {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const answer = answers[i];

        if (question.type === "mcq") {
          newResults[i] = {
            score: answer === question.answer ? 1 : 0,
            max_score: 1,
            feedback:
              answer === question.answer
                ? question.explanation || "Rätt svar."
                : question.explanation || `Rätt svar är ${question.answer}.`,
          };
        } else if (question.type === "reasoning") {
          const result = await gradeReasoningAnswer(question, answer);
          newResults[i] = {
            ...result,
            max_score: getQuestionMaxScore(question),
          };
        }
      }

      setResults(newResults);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "Något gick fel vid rättningen.");
    } finally {
      setGrading(false);
    }
  };

  const handleAnswer = (option) => {
    setAnswers({
      ...answers,
      [currentQuestion]: option,
    });
  };

  const handleReasoningAnswer = (field, value) => {
    setAnswers({
      ...answers,
      [currentQuestion]: {
        ...answers[currentQuestion],
        [field]: value,
      },
    });
  };

  const resetQuiz = () => {
    setQuestions([]);
    setAnswers({});
    setResults({});
    setSubmitted(false);
    setCurrentQuestion(0);
  };

  const grade = (score, total) => {
    if (!total) return "-";
    const percent = (score / total) * 100;
    if (percent >= 90) return "A";
    if (percent >= 80) return "B";
    if (percent >= 70) return "C";
    if (percent >= 60) return "D";
    if (percent >= 50) return "E";
    return "F";
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Aktiv studieyta</p>
          <h1 className="title">BookQ</h1>
        </div>
        <div className={`connection-pill ${collectionName ? "ready" : ""}`}>
          {uploading
            ? "Laddar in dokument"
            : collectionName
              ? "Dokument redo"
              : "Inget dokument"}
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="setup-panel">
          <div className="panel-heading">
            <p className="eyebrow">Dokument</p>
            <h2>Ladda upp material</h2>
          </div>

          <label
            className={`upload-zone ${
              uploading || collectionName ? "disabled" : ""
            } ${collectionName ? "ready" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={uploading || Boolean(collectionName)}
              hidden
            />
            <span className="upload-icon" aria-hidden="true">
              {collectionName ? "✓" : uploading ? "..." : "+"}
            </span>
            <span className="upload-title">
              {uploading
                ? "Laddar in dokument..."
                : collectionName
                  ? "Dokument valt"
                  : "Välj dokument"}
            </span>
            <span className="upload-meta">
              {collectionName
                ? "Ta bort dokumentet för att välja ett nytt"
                : "PDF, DOCX eller TXT"}
            </span>
          </label>

          {(displayedDocumentName || uploading) && (
            <div className="current-document">
              <div>
                <span>Aktuellt dokument</span>
                <strong>{displayedDocumentName || "Laddar in..."}</strong>
              </div>
              {collectionName && (
                <button
                  type="button"
                  className="remove-document"
                  onClick={handleRemoveDocument}
                  disabled={loadingQuestions || grading}
                >
                  Ta bort
                </button>
              )}
            </div>
          )}

          <div className="status-list">
            <div className="status-row">
              <span>Uppladdning</span>
              <strong>
                {uploading ? "Laddar in" : collectionName ? "Klar" : "Väntar"}
              </strong>
            </div>
            <div className="status-row">
              <span>Frågor</span>
              <strong>{questions.length || 0}</strong>
            </div>
            <div className="status-row">
              <span>Besvarade</span>
              <strong>{answeredCount}</strong>
            </div>
          </div>

          <button
            className="primary-action"
            onClick={handleGenerate}
            disabled={!collectionName || loadingQuestions || uploading}
          >
            {loadingQuestions
              ? "Genererar..."
              : questions.length
                ? "Generera nya frågor"
                : "Generera frågor"}
          </button>
        </aside>

        <section className="study-panel">
          {errorMessage && <p className="status-message error">{errorMessage}</p>}

          {!q && !submitted && (
            <div className="empty-state">
              <p className="eyebrow">Quiz</p>
              <h2>Redo när dokumentet är uppladdat</h2>
              <p>Välj ett dokument och generera frågor för att starta.</p>
            </div>
          )}

          {q && !submitted && (
            <article className="question-card">
              <div className="question-toolbar">
                <div>
                  <p className="eyebrow">Fråga {currentQuestion + 1}</p>
                  <h2>{q.question}</h2>
                </div>
                <span className="question-type">
                  {q.type === "reasoning" ? "Resonemang" : "Flerval"}
                </span>
              </div>

              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-bar"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {q.type === "mcq" && (
                <div className="options">
                  {q.options.map((option, idx) => (
                    <button
                      key={idx}
                      className={`option-btn ${
                        answers[currentQuestion] === option ? "selected" : ""
                      }`}
                      onClick={() => handleAnswer(option)}
                    >
                      <span>{String.fromCharCode(65 + idx)}</span>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "reasoning" && (
                <div className="reasoning-container">
                  <label>
                    <span>Svar</span>
                    <textarea
                      className="reasoning-input"
                      placeholder="Skriv ditt svar"
                      value={answers[currentQuestion]?.text || ""}
                      onChange={(e) => handleReasoningAnswer("text", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Förklaring</span>
                    <textarea
                      className="reasoning-explanation"
                      placeholder="Förklara hur du tänker"
                      value={answers[currentQuestion]?.explanation || ""}
                      onChange={(e) =>
                        handleReasoningAnswer("explanation", e.target.value)
                      }
                    />
                  </label>
                </div>
              )}

              <div className="navigation">
                <button
                  className="secondary-action"
                  onClick={() => setCurrentQuestion((i) => i - 1)}
                  disabled={currentQuestion === 0}
                >
                  Föregående
                </button>

                {currentQuestion < questions.length - 1 ? (
                  <button
                    className="primary-action compact"
                    onClick={() => setCurrentQuestion((i) => i + 1)}
                    disabled={!isCurrentAnswered}
                  >
                    Nästa
                  </button>
                ) : (
                  <button
                    className="primary-action compact"
                    onClick={handleSubmit}
                    disabled={!isCurrentAnswered || grading}
                  >
                    {grading ? "Rättar..." : "Lämna in"}
                  </button>
                )}
              </div>
            </article>
          )}

          {submitted && (
            <section className="results">
              <div className="results-summary">
                <div>
                  <p className="eyebrow">Resultat</p>
                  <h2>{studentScore} av {totalMaxScore} poäng</h2>
                </div>
                <div className="grade-badge">
                  <span>Betyg</span>
                  <strong>{grade(studentScore, totalMaxScore)}</strong>
                </div>
              </div>

              <div className="result-list">
                {questions.map((question, i) => (
                  <article key={i} className="result-question">
                    <div className="result-heading">
                      <span>{i + 1}</span>
                      <strong>{question.question}</strong>
                    </div>

                    {question.type === "mcq" ? (
                      <>
                        <p className={answers[i] === question.answer ? "correct" : "wrong"}>
                          Ditt svar: {answers[i]}
                        </p>
                        {answers[i] !== question.answer && (
                          <p className="correct">Rätt svar: {question.answer}</p>
                        )}
                        <p>{results[i]?.feedback}</p>
                      </>
                    ) : (
                      <>
                        <p>Ditt svar: {answers[i]?.text || "Inget svar"}</p>
                        <p>Förklaring: {answers[i]?.explanation || "Ingen förklaring"}</p>
                        <p>
                          Poäng: {results[i]?.score ?? 0} / {getQuestionMaxScore(question)}
                        </p>
                        <p>Feedback: {results[i]?.feedback}</p>
                        {results[i]?.improvement_tip && (
                          <p>Tips: {results[i].improvement_tip}</p>
                        )}
                        {question.expected_answer && (
                          <p>Exempel på bra svar: {question.expected_answer}</p>
                        )}
                      </>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function isAnswered(question, answer) {
  if (!question) return false;
  if (question.type === "reasoning") {
    return Boolean(answer?.text?.trim() && answer?.explanation?.trim());
  }
  return answer != null;
}

function getQuestionMaxScore(question) {
  return question.type === "reasoning" ? Number(question.max_score || 3) : 1;
}

export default App;
