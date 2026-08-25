import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/* =========================================================
   AIBINU FLEXIPREP CBT ENGINE
   ========================================================= */

const exams = [
  {
    id: "PHY-PRACTICE-01",
    title: "Physics Practice Test 1",
    subject: "Physics",
    programme: "UTME",
    questions: 20,
    duration: 30,
    passMark: 50
  },
  {
    id: "PHY-PRACTICE-02",
    title: "Physics Practice Test 2",
    subject: "Physics",
    programme: "WAEC / NECO",
    questions: 20,
    duration: 30,
    passMark: 50
  }
];

/* =========================================================
   TEMPORARY 20-QUESTION PHYSICS BANK
   ========================================================= */

const physicsQuestions = [
  {
    question: "Which of the following is a fundamental quantity in physics?",
    options: ["Force", "Energy", "Mass", "Density"],
    answer: "Mass"
  },
  {
    question: "What is the SI unit of force?",
    options: ["Joule", "Newton", "Watt", "Pascal"],
    answer: "Newton"
  },
  {
    question: "Which instrument is used to measure electric current?",
    options: ["Voltmeter", "Ammeter", "Thermometer", "Barometer"],
    answer: "Ammeter"
  },
  {
    question: "Which of the following is a vector quantity?",
    options: ["Mass", "Speed", "Distance", "Velocity"],
    answer: "Velocity"
  },
  {
    question: "The SI unit of power is?",
    options: ["Joule", "Newton", "Watt", "Volt"],
    answer: "Watt"
  },
  {
    question: "Which instrument is used to measure temperature?",
    options: ["Barometer", "Thermometer", "Ammeter", "Hydrometer"],
    answer: "Thermometer"
  },
  {
    question: "The acceleration due to gravity near the Earth's surface is approximately?",
    options: ["9.8 m/s²", "98 m/s²", "0.98 m/s²", "980 m/s²"],
    answer: "9.8 m/s²"
  },
  {
    question: "Which of the following is a scalar quantity?",
    options: ["Force", "Velocity", "Acceleration", "Speed"],
    answer: "Speed"
  },
  {
    question: "The unit of electrical resistance is?",
    options: ["Ohm", "Volt", "Ampere", "Coulomb"],
    answer: "Ohm"
  },
  {
    question: "Which law states that every action has an equal and opposite reaction?",
    options: [
      "Newton's First Law",
      "Newton's Second Law",
      "Newton's Third Law",
      "Law of Conservation of Energy"
    ],
    answer: "Newton's Third Law"
  },
  {
    question: "What is the approximate speed of light in vacuum?",
    options: [
      "3 × 10⁶ m/s",
      "3 × 10⁸ m/s",
      "3 × 10¹⁰ m/s",
      "3 × 10⁴ m/s"
    ],
    answer: "3 × 10⁸ m/s"
  },
  {
    question: "Which of the following is a renewable source of energy?",
    options: ["Coal", "Natural gas", "Solar energy", "Petroleum"],
    answer: "Solar energy"
  },
  {
    question: "The quantity of matter contained in a body is called?",
    options: ["Weight", "Mass", "Density", "Volume"],
    answer: "Mass"
  },
  {
    question: "Which instrument is commonly used to measure atmospheric pressure?",
    options: ["Ammeter", "Barometer", "Voltmeter", "Thermometer"],
    answer: "Barometer"
  },
  {
    question: "Work is done when a force causes an object to?",
    options: [
      "Change colour",
      "Move through a distance",
      "Increase in temperature only",
      "Remain stationary"
    ],
    answer: "Move through a distance"
  },
  {
    question: "The SI unit of energy is?",
    options: ["Watt", "Joule", "Newton", "Pascal"],
    answer: "Joule"
  },
  {
    question: "Which type of lens is used to correct short-sightedness?",
    options: [
      "Convex lens",
      "Concave lens",
      "Cylindrical lens",
      "Plane glass"
    ],
    answer: "Concave lens"
  },
  {
    question: "Which of the following is a good conductor of electricity?",
    options: ["Rubber", "Glass", "Copper", "Wood"],
    answer: "Copper"
  },
  {
    question: "What happens to the pressure of a gas when its volume decreases at constant temperature?",
    options: [
      "It decreases",
      "It increases",
      "It remains zero",
      "It becomes constant"
    ],
    answer: "It increases"
  },
  {
    question: "Which of the following is an example of electromagnetic radiation?",
    options: ["Sound", "Water wave", "Light", "Ocean wave"],
    answer: "Light"
  }
];

/* =========================================================
   MAIN APP
   ========================================================= */

function App() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [stage, setStage] = useState("login");
  const [selectedExam, setSelectedExam] = useState(null);
  const [error, setError] = useState("");

  function login() {
    setError("");

    const id = studentId.trim().toUpperCase();

    if (!id) {
      setError("Please enter your Student ID.");
      return;
    }

    setStudentId(id);

    // Temporary name.
    // This will later come from Airtable.
    setStudentName("Student");

    setStage("exams");
  }

  function startExam(exam) {
    setSelectedExam(exam);
    setStage("instructions");
  }

  function beginExam() {
    setStage("exam");
  }

  function logout() {
    setStudentId("");
    setStudentName("");
    setSelectedExam(null);
    setStage("login");
  }

  return (
    <div style={styles.page}>

      <header style={styles.header}>

        <div style={styles.logo}>
          AF
        </div>

        <div>
          <h1 style={styles.brand}>
            AIBINU FLEXIPREP
          </h1>

          <div style={styles.subtitle}>
            EDUCONSULT
          </div>
        </div>

        {studentId && (
          <div style={styles.studentBox}>
            <strong>{studentId}</strong>
            <span>{studentName}</span>
          </div>
        )}

      </header>

      {stage === "login" && (
        <Login
          studentId={studentId}
          setStudentId={setStudentId}
          login={login}
          error={error}
        />
      )}

      {stage === "exams" && (
        <ExamList
          exams={exams}
          studentId={studentId}
          startExam={startExam}
          logout={logout}
        />
      )}

      {stage === "instructions" && selectedExam && (
        <Instructions
          exam={selectedExam}
          beginExam={beginExam}
          back={() => setStage("exams")}
        />
      )}

      {stage === "exam" && selectedExam && (
        <ExamScreen
          exam={selectedExam}
          studentId={studentId}
          studentName={studentName}
          onExit={logout}
        />
      )}

    </div>
  );
}

/* =========================================================
   LOGIN
   ========================================================= */

function Login({
  studentId,
  setStudentId,
  login,
  error
}) {
  return (
    <main style={styles.center}>

      <section style={styles.loginCard}>

        <div style={styles.iconCircle}>
          🎓
        </div>

        <h2>
          CBT Examination Portal
        </h2>

        <p style={styles.muted}>
          Enter your AIBINU Flexiprep Student ID
          to continue.
        </p>

        <input
          style={styles.input}
          value={studentId}
          onChange={(e) =>
            setStudentId(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              login();
            }
          }}
          placeholder="e.g. AF-2026-0001"
        />

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        <button
          style={styles.primaryButton}
          onClick={login}
        >
          Continue
        </button>

        <p style={styles.small}>
          AIBINU FLEXIPREP EDUCONSULT
        </p>

      </section>

    </main>
  );
}

/* =========================================================
   EXAM LIST
   ========================================================= */

function ExamList({
  exams,
  studentId,
  startExam,
  logout
}) {
  return (
    <main style={styles.container}>

      <div style={styles.topRow}>

        <div>
          <h2>
            Available Examinations
          </h2>

          <p style={styles.muted}>
            Student ID: <strong>{studentId}</strong>
          </p>
        </div>

        <button
          style={styles.secondaryButton}
          onClick={logout}
        >
          Exit
        </button>

      </div>

      <div style={styles.examGrid}>

        {exams.map((exam) => (

          <div
            key={exam.id}
            style={styles.examCard}
          >

            <div style={styles.examBadge}>
              {exam.subject}
            </div>

            <h3>
              {exam.title}
            </h3>

            <p style={styles.muted}>
              {exam.programme}
            </p>

            <div style={styles.examInfo}>

              <span>
                📝 {exam.questions} Questions
              </span>

              <span>
                ⏱️ {exam.duration} Minutes
              </span>

              <span>
                🎯 Pass Mark {exam.passMark}%
              </span>

            </div>

            <button
              style={styles.primaryButton}
              onClick={() => startExam(exam)}
            >
              View Examination
            </button>

          </div>

        ))}

      </div>

    </main>
  );
}

/* =========================================================
   INSTRUCTIONS
   ========================================================= */

function Instructions({
  exam,
  beginExam,
  back
}) {
  return (
    <main style={styles.center}>

      <section style={styles.instructionCard}>

        <div style={styles.examBadge}>
          {exam.subject}
        </div>

        <h2>
          {exam.title}
        </h2>

        <p style={styles.muted}>
          Please read the instructions carefully
          before starting.
        </p>

        <hr />

        <div style={styles.instructionList}>

          <p>
            📝 <strong>Questions:</strong>{" "}
            {exam.questions}
          </p>

          <p>
            ⏱️ <strong>Duration:</strong>{" "}
            {exam.duration} minutes
          </p>

          <p>
            🎯 <strong>Pass Mark:</strong>{" "}
            {exam.passMark}%
          </p>

          <p>
            ⚠️ The examination timer will begin
            when you click Start Examination.
          </p>

          <p>
            ⚠️ You may submit the examination
            at any time before the timer ends.
          </p>

          <p>
            ⚠️ If time reaches zero, your
            examination will be submitted automatically.
          </p>

          <p>
            💡 Read every question carefully before
            selecting your answer.
          </p>

        </div>

        <div style={styles.buttonRow}>

          <button
            style={styles.secondaryButton}
            onClick={back}
          >
            Back
          </button>

          <button
            style={styles.primaryButton}
            onClick={beginExam}
          >
            Start Examination
          </button>

        </div>

      </section>

    </main>
  );
}

/* =========================================================
   EXAM SCREEN
   ========================================================= */

function ExamScreen({
  exam,
  studentId,
  studentName,
  onExit
}) {

  const questions =
    physicsQuestions.slice(0, exam.questions);

  const totalSeconds =
    exam.duration * 60;

  const [question, setQuestion] = useState(1);

  const [answers, setAnswers] =
    useState({});

  const [timeLeft, setTimeLeft] =
    useState(totalSeconds);

  const [submitted, setSubmitted] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [submitting, setSubmitting] =
    useState(false);

  /* =====================================================
     TIMER
     ===================================================== */

  
   useEffect(() => {

  if (submitted || submitting) {
    return;
  }

  const timer = setInterval(() => {

    setTimeLeft((previous) => {

      if (previous <= 1) {

        clearInterval(timer);

        return 0;
      }

      return previous - 1;

    });

  }, 1000);

  return () => clearInterval(timer);

}, [submitted, submitting]);   
   
useEffect(() => {

  if (
    timeLeft === 0 &&
    !submitted &&
    !submitting
  ) {

    submitExam(true);

  }

}, [timeLeft, submitted, submitting]);
  /* =====================================================
     FORMAT TIMER
     ===================================================== */

  function formatTime(seconds) {

    const minutes =
      Math.floor(seconds / 60);

    const secs =
      seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  /* =====================================================
     SELECT ANSWER
     ===================================================== */

  function selectAnswer(option) {

    if (submitted) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [question]: option
    }));
  }

  /* =====================================================
     ANSWER COUNT
     ===================================================== */

  const answeredCount =
    Object.keys(answers).length;

  const unansweredCount =
    questions.length - answeredCount;

  /* =====================================================
     CALCULATE SCORE
     ===================================================== */

  function calculateScore() {

    let correct = 0;

    questions.forEach((item, index) => {

      const studentAnswer =
        answers[index + 1];

      if (
        studentAnswer ===
        item.answer
      ) {
        correct++;
      }

    });

    const percentage =
      Math.round(
        (correct / questions.length) * 100
      );

    return {
      correct,
      total: questions.length,
      percentage,
      passed:
        percentage >= exam.passMark
    };
  }

  /* =====================================================
     SUBMIT EXAMINATION
     ===================================================== */

  async function submitExam(autoSubmit = false) {

    if (submitted || submitting) {
      return;
    }

    if (!autoSubmit) {

      if (unansweredCount > 0) {

        const proceed =
          window.confirm(
            `You have ${unansweredCount} unanswered question(s).\n\nDo you want to submit the examination now?`
          );

        if (!proceed) {
          return;
        }

      } else {

        const proceed =
          window.confirm(
            "You have answered all questions.\n\nDo you want to submit the examination now?"
          );

        if (!proceed) {
          return;
        }

      }

    }

    setSubmitting(true);

    const finalResult =
      calculateScore();

    setResult(finalResult);
    setSubmitted(true);

    /* ================================================
       SEND RESULT TO BACKEND
       ================================================ */

    try {

      await fetch("/api/cbt", {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          studentId,
          studentName,

          examId: exam.id,

          examTitle:
            exam.title,

          subject:
            exam.subject,

          programme:
            exam.programme,

          answers,

          score:
            finalResult.correct,

          total:
            finalResult.total,

          percentage:
            finalResult.percentage,

          submittedAutomatically:
            autoSubmit,

          submittedAt:
            new Date().toISOString()

        })

      });

    } catch (error) {

      console.error(
        "CBT submission error:",
        error
      );

    }

    setSubmitting(false);
  }

  /* =====================================================
     RESULT SCREEN
     ===================================================== */

  if (submitted && result) {

    return (
      <main style={styles.center}>

        <section style={styles.resultCard}>

          <div style={styles.resultIcon}>
            {result.passed ? "🎉" : "📚"}
          </div>

          <h1>
            Examination Submitted
          </h1>

          <p style={styles.muted}>
            {exam.title}
          </p>

          <div style={styles.scoreBox}>

            <div style={styles.bigScore}>
              {result.percentage}%
            </div>

            <div>
              Score:{" "}
              <strong>
                {result.correct}
              </strong>{" "}
              / {result.total}
            </div>

          </div>

          <div
            style={{
              ...styles.status,
              background:
                result.passed
                  ? "#e4f2e9"
                  : "#ffe9e9",
              color:
                result.passed
                  ? "#0f6b3a"
                  : "#a40000"
            }}
          >
            {result.passed
              ? "PASS"
              : "NOT YET PASSED"}
          </div>

          <p style={styles.muted}>
            Student ID:{" "}
            <strong>{studentId}</strong>
          </p>

          <button
            style={styles.primaryButton}
            onClick={onExit}
          >
            Exit Examination
          </button>

        </section>

      </main>
    );
  }

  /* =====================================================
     CURRENT QUESTION
     ===================================================== */

  const current =
    questions[question - 1];

  return (
    <main style={styles.container}>

      {/* EXAM HEADER */}

      <div style={styles.examHeader}>

        <div>

          <strong>
            {exam.title}
          </strong>

          <small>
            Student: {studentId}
          </small>

        </div>

        <div
          style={{
            ...styles.timer,
            ...(timeLeft <= 300
              ? styles.timerDanger
              : {})
          }}
        >
          ⏱️ {formatTime(timeLeft)}
        </div>

      </div>

      {/* PROGRESS */}

      <div style={styles.progressPanel}>

        <div>
          <strong>
            Question {question} of{" "}
            {questions.length}
          </strong>
        </div>

        <div style={styles.progressText}>
          Answered:{" "}
          <strong>{answeredCount}</strong>
          {"  |  "}
          Unanswered:{" "}
          <strong>{unansweredCount}</strong>
        </div>

      </div>

      {/* QUESTION */}

      <section style={styles.questionCard}>

        <div style={styles.questionNumber}>
          Question {question} of{" "}
          {questions.length}
        </div>

        <h2 style={styles.questionText}>
          {current.question}
        </h2>

        <div>

          {current.options.map(
            (option, index) => (

              <button
                key={option}
                onClick={() =>
                  selectAnswer(option)
                }
                style={{
                  ...styles.option,
                  ...(answers[question] ===
                  option
                    ? styles.selectedOption
                    : {})
                }}
              >

                <span style={styles.optionLetter}>
                  {String.fromCharCode(
                    65 + index
                  )}
                </span>

                <span>
                  {option}
                </span>

              </button>

            )
          )}

        </div>

        {/* NAVIGATION */}

        <div style={styles.navigationRow}>

          <button
            style={styles.secondaryButton}
            disabled={question === 1}
            onClick={() =>
              setQuestion(
                (previous) =>
                  Math.max(
                    1,
                    previous - 1
                  )
              )
            }
          >
            ← Previous
          </button>

          {question <
          questions.length ? (

            <button
              style={styles.primaryButton}
              onClick={() =>
                setQuestion(
                  (previous) =>
                    Math.min(
                      questions.length,
                      previous + 1
                    )
                )
              }
            >
              Next Question →
            </button>

          ) : (

            <button
              style={styles.primaryButton}
              onClick={() =>
                submitExam(false)
              }
              disabled={submitting}
            >
              {submitting
                ? "Submitting..."
                : "✓ Submit Examination"}
            </button>

          )}

        </div>
     
{/* SUBMIT ANYTIME */}

{question < questions.length && (
  <div style={styles.submitArea}>

    <p style={styles.submitHelp}>
      You can submit your examination
      at any time.
    </p>

    <button
      style={styles.submitButton}
      onClick={() =>
        submitExam(false)
      }
      disabled={submitting}
    >
      ✓ Submit Examination
    </button>

  </div>
)}

</section>

    </main>
  );
}
/* =========================================================
   STYLES
   ========================================================= */

const styles = {

  page: {
    minHeight: "100vh",
    background: "#f5f7f6",
    fontFamily:
      "Arial, Helvetica, sans-serif",
    color: "#173b2a"
  },

  header: {
    background: "#0f6b3a",
    color: "white",
    padding: "18px 25px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.12)"
  },

  logo: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "#d9b441",
    color: "#0f6b3a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "18px"
  },

  brand: {
    margin: 0,
    fontSize: "18px"
  },

  subtitle: {
    fontSize: "11px",
    opacity: 0.85,
    letterSpacing: "1px"
  },

  studentBox: {
    marginLeft: "auto",
    display: "flex",
    flexDirection: "column",
    textAlign: "right",
    fontSize: "13px"
  },

  center: {
    minHeight:
      "calc(100vh - 85px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px"
  },

  loginCard: {
    background: "white",
    width: "100%",
    maxWidth: "430px",
    padding: "35px",
    borderRadius: "18px",
    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)",
    textAlign: "center"
  },

  instructionCard: {
    background: "white",
    width: "100%",
    maxWidth: "600px",
    padding: "35px",
    borderRadius: "18px",
    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)"
  },

  resultCard: {
    background: "white",
    width: "100%",
    maxWidth: "500px",
    padding: "40px",
    borderRadius: "18px",
    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)",
    textAlign: "center"
  },

  iconCircle: {
    fontSize: "45px",
    marginBottom: "10px"
  },

  resultIcon: {
    fontSize: "55px",
    marginBottom: "10px"
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "15px",
    border:
      "1px solid #ccd8d1",
    borderRadius: "10px",
    fontSize: "16px",
    marginTop: "15px"
  },

  primaryButton: {
    background: "#0f6b3a",
    color: "white",
    border: "none",
    borderRadius: "9px",
    padding: "13px 20px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "15px"
  },

  secondaryButton: {
    background: "white",
    color: "#0f6b3a",
    border:
      "1px solid #0f6b3a",
    borderRadius: "9px",
    padding: "12px 18px",
    fontWeight: "bold",
    cursor: "pointer"
  },

  submitButton: {
    background: "#b88908",
    color: "white",
    border: "none",
    borderRadius: "9px",
    padding: "13px 22px",
    fontWeight: "bold",
    cursor: "pointer"
  },

  error: {
    background: "#ffe9e9",
    color: "#a40000",
    padding: "10px",
    borderRadius: "8px",
    marginTop: "12px",
    fontSize: "14px"
  },

  muted: {
    color: "#66756d"
  },

  small: {
    fontSize: "11px",
    color: "#89958f",
    marginTop: "25px"
  },

  container: {
    maxWidth: "1100px",
    margin: "auto",
    padding: "30px 20px"
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "25px"
  },

  examGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px"
  },

  examCard: {
    background: "white",
    borderRadius: "15px",
    padding: "25px",
    boxShadow:
      "0 5px 20px rgba(0,0,0,0.06)"
  },

  examBadge: {
    display: "inline-block",
    background: "#e4f2e9",
    color: "#0f6b3a",
    padding: "6px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold"
  },

  examInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    color: "#58675f",
    fontSize: "14px",
    marginTop: "18px"
  },

  instructionList: {
    lineHeight: "1.7"
  },

  buttonRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "25px"
  },

  examHeader: {
    background: "white",
    padding: "18px",
    borderRadius: "12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px"
  },

  timer: {
    background: "#fff2d2",
    color: "#795600",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    minWidth: "75px",
    textAlign: "center"
  },

  timerDanger: {
    background: "#ffe1e1",
    color: "#a40000"
  },

  progressPanel: {
    background: "white",
    padding: "14px 18px",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "15px",
    fontSize: "14px"
  },

  progressText: {
    color: "#66756d"
  },

  questionCard: {
    background: "white",
    borderRadius: "15px",
    padding: "30px",
    boxShadow:
      "0 5px 20px rgba(0,0,0,0.06)"
  },

  questionNumber: {
    color: "#0f6b3a",
    fontWeight: "bold",
    marginBottom: "20px"
  },

  questionText: {
    lineHeight: "1.45"
  },

  option: {
    width: "100%",
    textAlign: "left",
    padding: "15px",
    marginTop: "10px",
    background: "white",
    border:
      "1px solid #d7e0db",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px",
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },

  optionLetter: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "#e4f2e9",
    color: "#0f6b3a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    flexShrink: 0
  },

  selectedOption: {
    background: "#e4f2e9",
    border:
      "2px solid #0f6b3a"
  },

  navigationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginTop: "25px"
  },

  submitArea: {
    borderTop:
      "1px solid #e1e7e3",
    marginTop: "25px",
    paddingTop: "20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap"
  },

  submitHelp: {
    color: "#66756d",
    fontSize: "13px",
    margin: 0
  },

  scoreBox: {
    background: "#f5f7f6",
    padding: "25px",
    borderRadius: "12px",
    marginTop: "25px",
    marginBottom: "20px"
  },

  bigScore: {
    fontSize: "48px",
    fontWeight: "bold",
    color: "#0f6b3a",
    marginBottom: "8px"
  },

  status: {
    display: "inline-block",
    padding: "10px 25px",
    borderRadius: "20px",
    fontWeight: "bold",
    marginBottom: "20px"
  }
};

/* =========================================================
   START APPLICATION
   ========================================================= */

createRoot(
  document.getElementById("cbt-root")
).render(
  <App />
);
