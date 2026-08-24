import React, { useState } from "react";
import { createRoot } from "react-dom/client";

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

    /*
      Temporary student login.

      Later this will be connected to Airtable
      so the system will verify the Student ID
      and retrieve the student's actual name.
    */

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
        <div>
          <div style={styles.logo}>AF</div>
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
        />
      )}

    </div>
  );
}


/* =========================
   LOGIN
========================= */

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


/* =========================
   EXAM LIST
========================= */

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


/* =========================
   INSTRUCTIONS
========================= */

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
            ⚠️ Do not refresh or close the page
            while the examination is in progress.
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


/* =========================
   TEMPORARY EXAM SCREEN
========================= */

function ExamScreen({
  exam,
  studentId
}) {
  const [question, setQuestion] = useState(1);
  const [answers, setAnswers] = useState({});

  const demoQuestions = [
    {
      question:
        "Which of the following is a fundamental quantity in physics?",
      options: [
        "Force",
        "Energy",
        "Mass",
        "Density"
      ]
    },
    {
      question:
        "What is the SI unit of force?",
      options: [
        "Joule",
        "Newton",
        "Watt",
        "Pascal"
      ]
    },
    {
      question:
        "Which instrument is used to measure electric current?",
      options: [
        "Voltmeter",
        "Ammeter",
        "Thermometer",
        "Barometer"
      ]
    }
  ];

  const current =
    demoQuestions[question - 1] ||
    demoQuestions[0];

  function selectAnswer(option) {
    setAnswers({
      ...answers,
      [question]: option
    });
  }

  return (
    <main style={styles.container}>

      <div style={styles.examHeader}>

        <div>
          <strong>
            {exam.title}
          </strong>

          <small>
            Student: {studentId}
          </small>
        </div>

        <div style={styles.timer}>
          ⏱️ 30:00
        </div>

      </div>


      <section style={styles.questionCard}>

        <div style={styles.questionNumber}>
          Question {question} of {exam.questions}
        </div>

        <h2>
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
                  ...(answers[question] === option
                    ? styles.selectedOption
                    : {})
                }}
              >

                <span>
                  {String.fromCharCode(65 + index)}
                </span>

                {option}

              </button>

            )
          )}

        </div>


        <div style={styles.buttonRow}>

          <button
            style={styles.secondaryButton}
            disabled={question === 1}
            onClick={() =>
              setQuestion(question - 1)
            }
          >
            Previous
          </button>

          <button
            style={styles.primaryButton}
            onClick={() => {

              if (
                question <
                demoQuestions.length
              ) {
                setQuestion(question + 1);
              }

            }}
          >
            {question < demoQuestions.length
              ? "Next Question"
              : "Finish"}
          </button>

        </div>

      </section>

    </main>
  );
}


/* =========================
   STYLES
========================= */

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
    minHeight: "calc(100vh - 85px)",
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

  iconCircle: {
    fontSize: "45px",
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
    marginBottom: "20px"
  },

  timer: {
    background: "#fff2d2",
    color: "#795600",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold"
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

  option: {
    width: "100%",
    textAlign: "left",
    padding: "15px",
    marginTop: "10px",
    background: "white",
    border: "1px solid #d7e0db",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "15px"
  },

  selectedOption: {
    background: "#e4f2e9",
    border:
      "2px solid #0f6b3a"
  }
};


createRoot(
  document.getElementById("cbt-root")
).render(
  <App />
);
