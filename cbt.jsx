import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/* =========================================================
   EXAM CONFIGURATION
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
   QUESTION BANK
   TEMPORARY LOCAL QUESTIONS
========================================================= */

const physicsQuestions = [

  {
    question:
      "Which of the following is a fundamental quantity in physics?",
    options: [
      "Force",
      "Energy",
      "Mass",
      "Density"
    ],
    answer: "Mass"
  },

  {
    question:
      "What is the SI unit of force?",
    options: [
      "Joule",
      "Newton",
      "Watt",
      "Pascal"
    ],
    answer: "Newton"
  },

  {
    question:
      "Which instrument is used to measure electric current?",
    options: [
      "Voltmeter",
      "Ammeter",
      "Thermometer",
      "Barometer"
    ],
    answer: "Ammeter"
  },

  {
    question:
      "Which of the following is a vector quantity?",
    options: [
      "Mass",
      "Speed",
      "Distance",
      "Velocity"
    ],
    answer: "Velocity"
  },

  {
    question:
      "The SI unit of work is",
    options: [
      "Newton",
      "Joule",
      "Watt",
      "Pascal"
    ],
    answer: "Joule"
  },

  {
    question:
      "Which quantity is defined as distance travelled per unit time?",
    options: [
      "Acceleration",
      "Velocity",
      "Speed",
      "Force"
    ],
    answer: "Speed"
  },

  {
    question:
      "A body moving with constant velocity has",
    options: [
      "Constant acceleration",
      "Zero acceleration",
      "Increasing acceleration",
      "Decreasing acceleration"
    ],
    answer: "Zero acceleration"
  },

  {
    question:
      "The acceleration due to gravity near the Earth's surface is approximately",
    options: [
      "4.9 m/s²",
      "9.8 m/s²",
      "98 m/s²",
      "0.98 m/s²"
    ],
    answer: "9.8 m/s²"
  },

  {
    question:
      "Which of the following instruments measures potential difference?",
    options: [
      "Ammeter",
      "Voltmeter",
      "Galvanometer",
      "Barometer"
    ],
    answer: "Voltmeter"
  },

  {
    question:
      "The resistance of a conductor is measured in",
    options: [
      "Volt",
      "Ampere",
      "Ohm",
      "Coulomb"
    ],
    answer: "Ohm"
  },

  {
    question:
      "Which particle carries a negative electric charge?",
    options: [
      "Proton",
      "Neutron",
      "Electron",
      "Nucleus"
    ],
    answer: "Electron"
  },

  {
    question:
      "Which type of energy is possessed by a body because of its position?",
    options: [
      "Kinetic energy",
      "Potential energy",
      "Electrical energy",
      "Sound energy"
    ],
    answer: "Potential energy"
  },

  {
    question:
      "The unit of power is",
    options: [
      "Joule",
      "Newton",
      "Watt",
      "Volt"
    ],
    answer: "Watt"
  },

  {
    question:
      "Which of the following is an example of a simple machine?",
    options: [
      "Transformer",
      "Lever",
      "Battery",
      "Motor"
    ],
    answer: "Lever"
  },

  {
    question:
      "The force that opposes motion between two surfaces in contact is",
    options: [
      "Tension",
      "Friction",
      "Upthrust",
      "Weight"
    ],
    answer: "Friction"
  },

  {
    question:
      "Which wave does not require a material medium for propagation?",
    options: [
      "Sound wave",
      "Water wave",
      "Light wave",
      "Seismic wave"
    ],
    answer: "Light wave"
  },

  {
    question:
      "The change in direction of light as it passes from one medium to another is called",
    options: [
      "Reflection",
      "Refraction",
      "Diffraction",
      "Interference"
    ],
    answer: "Refraction"
  },

  {
    question:
      "Which colour of visible light has the longest wavelength?",
    options: [
      "Violet",
      "Blue",
      "Green",
      "Red"
    ],
    answer: "Red"
  },

  {
    question:
      "A transformer operates using the principle of",
    options: [
      "Electrolysis",
      "Electromagnetic induction",
      "Thermal expansion",
      "Radioactivity"
    ],
    answer: "Electromagnetic induction"
  },

  {
    question:
      "Which of the following is a renewable source of energy?",
    options: [
      "Coal",
      "Natural gas",
      "Solar energy",
      "Petroleum"
    ],
    answer: "Solar energy"
  }

];


/* =========================================================
   APP
========================================================= */

function App() {

  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");

  const [stage, setStage] = useState("login");

  const [selectedExam, setSelectedExam] = useState(null);

  const [error, setError] = useState("");

  function login() {

    setError("");

    const id =
      studentId.trim().toUpperCase();

    if (!id) {
      setError(
        "Please enter your Student ID."
      );
      return;
    }

    setStudentId(id);

    /*
      TEMPORARY LOGIN

      Later:
      Connect this to Airtable Students table.
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

      {/* HEADER */}

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

            <strong>
              {studentId}
            </strong>

            <span>
              {studentName}
            </span>

          </div>

        )}

      </header>


      {/* LOGIN */}

      {stage === "login" && (

        <Login
          studentId={studentId}
          setStudentId={setStudentId}
          login={login}
          error={error}
        />

      )}


      {/* EXAM LIST */}

      {stage === "exams" && (

        <ExamList
          exams={exams}
          studentId={studentId}
          startExam={startExam}
          logout={logout}
        />

      )}


      {/* INSTRUCTIONS */}

      {stage === "instructions" &&
        selectedExam && (

          <Instructions
            exam={selectedExam}
            beginExam={beginExam}
            back={() =>
              setStage("exams")
            }
          />

        )}


      {/* EXAM */}

      {stage === "exam" &&
        selectedExam && (

          <ExamScreen
            exam={selectedExam}
            studentId={studentId}
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
          Enter your AIBINU Flexiprep
          Student ID to continue.
        </p>


        <input
          style={styles.input}
          value={studentId}
          onChange={(e) =>
            setStudentId(
              e.target.value
            )
          }
          onKeyDown={(e) => {

            if (
              e.key === "Enter"
            ) {
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
            Student ID:{" "}
            <strong>
              {studentId}
            </strong>
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
              onClick={() =>
                startExam(exam)
              }
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
          Please read the instructions
          carefully before starting.
        </p>

        <hr />


        <div style={styles.instructionList}>

          <p>
            📝{" "}
            <strong>
              Questions:
            </strong>{" "}
            {exam.questions}
          </p>

          <p>
            ⏱️{" "}
            <strong>
              Duration:
            </strong>{" "}
            {exam.duration} minutes
          </p>

          <p>
            🎯{" "}
            <strong>
              Pass Mark:
            </strong>{" "}
            {exam.passMark}%
          </p>

          <p>
            ⚠️ The examination timer
            will begin when you click
            Start Examination.
          </p>

          <p>
            ⚠️ You may submit the
            examination before the
            timer expires.
          </p>

          <p>
            ⚠️ If time reaches zero,
            the examination will be
            submitted automatically.
          </p>

          <p>
            💡 You can move backward
            and forward between
            questions.
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
  studentId
}) {

  const questions =
    physicsQuestions.slice(
      0,
      exam.questions
    );


  const [question, setQuestion] =
    useState(1);

  const [answers, setAnswers] =
    useState({});

  const [submitted, setSubmitted] =
    useState(false);

  const [score, setScore] =
    useState(0);

  const [timeLeft, setTimeLeft] =
    useState(exam.duration * 60);


  /* =======================================================
     TIMER
  ======================================================= */

  useEffect(() => {

    if (submitted) return;

    if (timeLeft <= 0) {

      submitExam(true);

      return;
    }


    const timer =
      setInterval(() => {

        setTimeLeft(
          (previous) =>
            previous - 1
        );

      }, 1000);


    return () =>
      clearInterval(timer);

  }, [timeLeft, submitted]);


  /* =======================================================
     FORMAT TIMER
  ======================================================= */

  function formatTime(seconds) {

    const minutes =
      Math.floor(
        seconds / 60
      );

    const secs =
      seconds % 60;

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0")
    );
  }


  /* =======================================================
     SELECT ANSWER
  ======================================================= */

  function selectAnswer(option) {

    if (submitted) return;

    setAnswers({
      ...answers,
      [question]: option
    });
  }


  /* =======================================================
     SUBMIT EXAM
  ======================================================= */

  function submitExam(
    automatic = false
  ) {

    if (submitted) return;


    if (!automatic) {

      const unanswered =
        questions.length -
        Object.keys(answers).length;


      const message =
        unanswered > 0

          ? `You have ${unanswered} unanswered question(s).\n\nDo you want to submit the examination now?`

          : "Are you sure you want to submit the examination now?";


      const confirmed =
        window.confirm(message);


      if (!confirmed) return;

    }


    let totalScore = 0;


    questions.forEach(
      (item, index) => {

        const studentAnswer =
          answers[index + 1];


        if (
          studentAnswer ===
          item.answer
        ) {

          totalScore++;

        }

      }
    );


    setScore(totalScore);

    setSubmitted(true);

  }


  /* =======================================================
     RESULT
  ======================================================= */

  if (submitted) {

    const percentage =
      Math.round(
        (score /
          questions.length) *
          100
      );


    const passed =
      percentage >=
      exam.passMark;


    return (

      <main style={styles.center}>

        <section
          style={
            styles.resultCard
          }
        >

          <div style={styles.examBadge}>
            {exam.subject}
          </div>


          <h2>
            Examination Submitted
          </h2>


          <p style={styles.muted}>
            Student ID:{" "}
            <strong>
              {studentId}
            </strong>
          </p>


          <hr />


          <div
            style={
              styles.resultIcon
            }
          >
            {passed
              ? "🎉"
              : "📚"}
          </div>


          <div
            style={
              styles.scoreCircle
            }
          >

            <strong>
              {percentage}%
            </strong>

          </div>


          <h3>
            {passed
              ? "PASSED"
              : "FAILED"}
          </h3>


          <p>
            Score:{" "}
            <strong>
              {score} /{" "}
              {questions.length}
            </strong>
          </p>


          <p style={styles.muted}>
            Pass Mark:{" "}
            {exam.passMark}%
          </p>


          <p style={styles.muted}>
            {passed
              ? "Excellent work. Keep it up!"
              : "Keep studying and try again."}
          </p>


          <button
            style={styles.primaryButton}
            onClick={() =>
              window.location.reload()
            }
          >
            Exit Examination
          </button>

        </section>

      </main>
    );
  }


  /* =======================================================
     CURRENT QUESTION
  ======================================================= */

  const current =
    questions[question - 1];


  const answered =
    answers[question];


  const unanswered =
    questions.length -
    Object.keys(answers).length;


  return (

    <main style={styles.container}>


      {/* EXAM HEADER */}

      <div style={styles.examHeader}>

        <div>

          <strong>
            {exam.title}
          </strong>

          <small
            style={{
              display: "block",
              marginTop: "5px"
            }}
          >
            Student: {studentId}
          </small>

        </div>


        <div
          style={{
            ...styles.timer,
            ...(timeLeft <= 300
              ? styles.timerWarning
              : {})
          }}
        >
          ⏱️{" "}
          {formatTime(timeLeft)}
        </div>

      </div>


      {/* PROGRESS */}

      <div
        style={
          styles.progressBox
        }
      >

        <div>
          Question{" "}
          <strong>
            {question}
          </strong>{" "}
          of{" "}
          <strong>
            {questions.length}
          </strong>
        </div>


        <div>
          Answered:{" "}
          <strong>
            {Object.keys(
              answers
            ).length}
          </strong>
          {" / "}
          {questions.length}
        </div>

      </div>


      {/* QUESTION */}

      <section
        style={
          styles.questionCard
        }
      >

        <div
          style={
            styles.questionNumber
          }
        >
          Question {question} of{" "}
          {questions.length}
        </div>


        <h2>
          {current.question}
        </h2>


        <div>

          {current.options.map(
            (
              option,
              index
            ) => (

              <button
                key={option}
                onClick={() =>
                  selectAnswer(
                    option
                  )
                }
                style={{
                  ...styles.option,

                  ...(answered ===
                  option
                    ? styles.selectedOption
                    : {})
                }}
              >

                <span
                  style={{
                    fontWeight:
                      "bold",
                    marginRight:
                      "12px"
                  }}
                >
                  {String.fromCharCode(
                    65 + index
                  )}
                </span>

                {option}

              </button>

            )
          )}

        </div>


        {/* NAVIGATION */}

        <div
          style={
            styles.navigationRow
          }
        >

          <button
            style={
              styles.secondaryButton
            }
            disabled={
              question === 1
            }
            onClick={() =>
              setQuestion(
                question - 1
              )
            }
          >
            ← Previous
          </button>


          {question <
            questions.length && (

            <button
              style={
                styles.primaryButton
              }
              onClick={() =>
                setQuestion(
                  question + 1
                )
              }
            >
              Next Question →
            </button>

          )}


          <button
            style={
              styles.submitButton
            }
            onClick={() =>
              submitExam(false)
            }
          >
            ✓ Submit Examination
          </button>

        </div>


        {/* SUBMISSION NOTICE */}

        <div
          style={
            styles.submitNotice
          }
        >

          <strong>
            You can submit at any time.
          </strong>

          <br />

          {unanswered > 0
            ? `${unanswered} question(s) unanswered.`
            : "All questions answered."}

        </div>

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
    padding:
      "15px 25px",
    display: "flex",
    alignItems:
      "center",
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
    alignItems:
      "center",
    justifyContent:
      "center",
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
    flexDirection:
      "column",
    textAlign: "right",
    fontSize: "13px"
  },


  center: {
    minHeight:
      "calc(100vh - 80px)",
    display: "flex",
    justifyContent:
      "center",
    alignItems:
      "center",
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
    maxWidth: "550px",
    padding: "35px",
    borderRadius: "18px",
    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)",
    textAlign: "center"
  },


  iconCircle: {
    fontSize: "45px",
    marginBottom: "10px"
  },


  input: {
    width: "100%",
    boxSizing:
      "border-box",
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
    padding:
      "13px 20px",
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
    padding:
      "12px 18px",
    fontWeight: "bold",
    cursor: "pointer"
  },


  submitButton: {
    background: "#d9b441",
    color: "#173b2a",
    border: "none",
    borderRadius: "9px",
    padding:
      "13px 20px",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "15px"
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
    padding:
      "30px 20px"
  },


  topRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap: "15px",
    marginBottom:
      "25px"
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
    padding:
      "6px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold"
  },


  examInfo: {
    display: "flex",
    flexDirection:
      "column",
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
    justifyContent:
      "space-between",
    gap: "12px",
    marginTop: "25px"
  },


  examHeader: {
    background: "white",
    padding: "18px",
    borderRadius: "12px",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    marginBottom:
      "15px"
  },


  timer: {
    background: "#fff2d2",
    color: "#795600",
    padding:
      "10px 15px",
    borderRadius: "8px",
    fontWeight: "bold",
    minWidth: "70px",
    textAlign: "center"
  },


  timerWarning: {
    background: "#ffe1e1",
    color: "#a40000"
  },


  progressBox: {
    background: "white",
    padding: "12px 18px",
    borderRadius: "10px",
    marginBottom: "15px",
    display: "flex",
    justifyContent:
      "space-between",
    gap: "10px",
    fontSize: "14px"
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
    marginBottom:
      "20px"
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
    fontSize: "15px"
  },


  selectedOption: {
    background: "#e4f2e9",
    border:
      "2px solid #0f6b3a"
  },


  navigationRow: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "25px"
  },


  submitNotice: {
    background: "#f5f7f6",
    padding: "12px",
    borderRadius: "8px",
    marginTop: "20px",
    fontSize: "13px",
    color: "#58675f",
    textAlign: "center"
  },


  resultIcon: {
    fontSize: "50px",
    marginTop: "15px"
  },


  scoreCircle: {
    width: "130px",
    height: "130px",
    borderRadius: "50%",
    background: "#e4f2e9",
    color: "#0f6b3a",
    display: "flex",
    alignItems:
      "center",
    justifyContent:
      "center",
    margin:
      "20px auto",
    fontSize: "32px"
  }

};


/* =========================================================
   START APPLICATION
========================================================= */

createRoot(
  document.getElementById(
    "cbt-root"
  )
).render(
  <App />
);
