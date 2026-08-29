import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/* =========================================================
   AIBINU FLEXIPREP CBT ENGINE
   Enhanced Student Portal

   Attempt lifecycle:
   START -> create CBT_Attempts -> exam -> SUBMIT existing attempt

   Enhancements:
   - Online/offline connection indicator
   - Improved student portal UI
   - Improved examination cards
   - Better instructions screen
   - Mobile-friendly presentation
   ========================================================= */

function App() {
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [examError, setExamError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("Student");

  const [stage, setStage] = useState("login");
  const [selectedExam, setSelectedExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);

  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionError, setQuestionError] = useState("");
  const [error, setError] = useState("");

  const [online, setOnline] = useState(
    typeof navigator === "undefined"
      ? true
      : navigator.onLine
  );

  /* =========================================================
     INTERNET CONNECTION MONITOR
     ========================================================= */

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);

  /* =========================================================
     LOAD EXAMINATIONS
     ========================================================= */

  useEffect(() => {
    async function loadExams() {
      try {
        setLoadingExams(true);
        setExamError("");

        const response = await fetch(
          "/api/cbt-exams"
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load examinations"
          );
        }

        const data =
          await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            "Invalid examination data"
          );
        }

        setExams(data);

      } catch (err) {

        console.error(
          "CBT Exams API Error:",
          err
        );

        setExamError(
          err.message ||
          "Unable to load examinations."
        );

      } finally {
        setLoadingExams(false);
      }
    }

    loadExams();

  }, []);

  /* =========================================================
     STUDENT LOGIN
     ========================================================= */

  function login() {

    setError("");

    const id =
      studentId
        .trim()
        .toUpperCase();

    if (!id) {

      setError(
        "Please enter your Student ID."
      );

      return;
    }

    setStudentId(id);

    setStudentName("Student");

    setStage("exams");
  }

  /* =========================================================
     SELECT EXAM
     ========================================================= */

  function startExam(exam) {

    setSelectedExam(exam);

    setExamQuestions([]);

    setQuestionError("");

    setStage("instructions");
  }

  /* =========================================================
     START EXAMINATION
     ========================================================= */

  async function beginExam() {

    if (!selectedExam) {
      return;
    }

    try {

      setLoadingQuestions(true);

      setQuestionError("");

      /*
        Use ONE start time for the attempt
        and examination.
      */

      const actualStartTime =
        new Date().toISOString();

      /* =====================================================
         STEP 1
         CREATE CBT ATTEMPT
         ===================================================== */

      const attemptResponse =
        await fetch(
          "/api/cbt-start",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              studentId,
              examId:
                selectedExam.id,
              startTime:
                actualStartTime
            })
          }
        );

      const attemptData =
        await attemptResponse.json();

      if (!attemptResponse.ok) {

        throw new Error(
          attemptData?.error ||
          "Unable to create CBT attempt."
        );
      }

      if (
        !attemptData?.success ||
        !attemptData?.attemptId
      ) {

        throw new Error(
          "The CBT attempt was not created."
        );
      }

      /*
        Store the attempt information
        temporarily in the browser.

        Submission will use this SAME attempt.
      */

      sessionStorage.setItem(

        `cbtAttempt:${studentId}:${selectedExam.id}`,

        JSON.stringify({

          attemptId:
            attemptData.attemptId,

          attemptRecordId:
            attemptData.attemptRecordId ||
            "",

          startTime:
            actualStartTime

        })

      );

      /* =====================================================
         STEP 2
         LOAD QUESTIONS
         ===================================================== */

      const url =
        `/api/cbt-questions?examId=${encodeURIComponent(
          selectedExam.id
        )}`;

      const response =
        await fetch(url);

      if (!response.ok) {

        let message =
          "Failed to load examination questions.";

        try {

          const data =
            await response.json();

          if (data?.error) {
            message =
              data.error;
          }

        } catch {}

        throw new Error(message);
      }

      const data =
        await response.json();

      if (!Array.isArray(data)) {

        throw new Error(
          "Invalid question data received from server."
        );
      }

      const expectedCount =
        Number(
          selectedExam.questionCount
        ) || 0;

      if (
        expectedCount > 0 &&
        data.length < expectedCount
      ) {

        throw new Error(

          `This examination requires ${expectedCount} questions, but only ${data.length} questions are linked to it in Airtable.`

        );
      }

      const questions =
        expectedCount > 0
          ? data.slice(
              0,
              expectedCount
            )
          : data;

      if (
        questions.length === 0
      ) {

        throw new Error(
          "No questions are linked to this examination."
        );
      }

      setExamQuestions(
        questions
      );

      /*
        IMPORTANT:
        Student only enters the examination
        after the attempt has been created.
      */

      setStage("exam");

    } catch (err) {

      console.error(
        "CBT Start Error:",
        err
      );

      setQuestionError(

        err.message ||
        "Unable to start examination."

      );

    } finally {

      setLoadingQuestions(false);
    }
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  function logout() {

    setStudentId("");

    setStudentName(
      "Student"
    );

    setSelectedExam(null);

    setExamQuestions([]);

    setQuestionError("");

    setStage("login");
  }

  /* =========================================================
     APPLICATION UI
     ========================================================= */

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

        {/* CONNECTION STATUS */}

        <div
          style={{
            ...styles.connectionBadge,

            ...(online
              ? styles.connectionOnline
              : styles.connectionOffline)
          }}
        >

          <span
            style={
              styles.connectionDot
            }
          />

          {online
            ? "Online"
            : "Offline"}

        </div>

        {/* STUDENT */}

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
          online={online}
          studentId={studentId}
          setStudentId={
            setStudentId
          }
          login={login}
          error={error}
        />

      )}

      {/* EXAMS */}

      {stage === "exams" && (

        <ExamList
          online={online}
          exams={exams}
          studentId={studentId}
          startExam={startExam}
          logout={logout}
          loading={
            loadingExams
          }
          error={examError}
        />

      )}

      {/* INSTRUCTIONS */}

      {stage === "instructions" &&
        selectedExam && (

          <Instructions
            online={online}
            exam={selectedExam}
            beginExam={
              beginExam
            }
            back={() =>
              setStage(
                "exams"
              )
            }
            loading={
              loadingQuestions
            }
            error={
              questionError
            }
          />

      )}

      {/* EXAMINATION */}

      {stage === "exam" &&
        selectedExam &&
        examQuestions.length >
          0 && (

          <ExamScreen
            exam={
              selectedExam
            }
            questions={
              examQuestions
            }
            studentId={
              studentId
            }
            studentName={
              studentName
            }
            onExit={logout}
          />

      )}

    </div>
  );
}


/* ============================================================
   LOGIN
   ============================================================ */

function Login({
  online,
  studentId,
  setStudentId,
  login,
  error
}) {

  return (

    <main style={styles.center}>

      <section
        style={
          styles.loginCard
        }
      >

        <div
          style={
            styles.iconCircle
          }
        >
          🎓
        </div>

        <h2>
          CBT Examination Portal
        </h2>

        <p
          style={
            styles.muted
          }
        >
          Enter your AIBINU
          Flexiprep Student ID
          to continue.
        </p>

        <div
          style={
            online
              ? styles.networkNotice
              : styles.networkNoticeOffline
          }
        >

          {online
            ? "🟢 Secure connection available"
            : "🔴 Internet connection unavailable"}

        </div>

        <input

          style={
            styles.input
          }

          value={
            studentId
          }

          onChange={e =>
            setStudentId(
              e.target.value
            )
          }

          onKeyDown={e => {

            if (
              e.key ===
              "Enter"
            ) {
              login();
            }

          }}

          placeholder="e.g. AF-2026-0001"

        />

        {error && (

          <div
            style={
              styles.error
            }
          >
            {error}
          </div>

        )}

        <button

          style={
            styles.primaryButton
          }

          onClick={
            login
          }

        >
          Continue
        </button>

        <p
          style={
            styles.small
          }
        >
          AIBINU FLEXIPREP
          EDUCONSULT
        </p>

      </section>

    </main>
  );
}


/* ============================================================
   EXAM LIST
   ============================================================ */

function ExamList({
  online,
  exams,
  studentId,
  startExam,
  logout,
  loading,
  error
}) {

  return (

    <main
      style={
        styles.container
      }
    >

      <div
        style={
          styles.topRow
        }
      >

        <div>

          <h2>
            Available Examinations
          </h2>

          <p
            style={
              styles.muted
            }
          >

            Student ID:{" "}

            <strong>
              {studentId}
            </strong>

          </p>

        </div>

        <button

          style={
            styles.secondaryButton
          }

          onClick={
            logout
          }

        >
          Exit
        </button>

      </div>


      {!online && (

        <div
          style={
            styles.networkWarning
          }
        >

          🔴 Internet connection lost.
          Reconnect before starting
          an examination.

        </div>

      )}


      {loading && (

        <div
          style={
            styles.messageCard
          }
        >

          <div
            style={
              styles.loadingIcon
            }
          >
            ⏳
          </div>

          <h3>
            Loading examinations...
          </h3>

          <p
            style={
              styles.muted
            }
          >
            Please wait.
          </p>

        </div>

      )}


      {!loading &&
        error && (

          <div
            style={
              styles.errorCard
            }
          >

            <strong>
              Unable to load
              examinations
            </strong>

            <p>
              {error}
            </p>

          </div>

      )}


      {!loading &&
        !error &&
        exams.length === 0 && (

          <div
            style={
              styles.messageCard
            }
          >

            <div
              style={
                styles.loadingIcon
              }
            >
              📚
            </div>

            <h3>
              No examinations
              available
            </h3>

            <p
              style={
                styles.muted
              }
            >
              Please contact your
              administrator.
            </p>

          </div>

      )}


      {!loading &&
        !error &&
        exams.length > 0 && (

          <div
            style={
              styles.examGrid
            }
          >

            {exams.map(
              exam => (

                <div
                  key={
                    exam.id
                  }
                  style={
                    styles.examCard
                  }
                >

                  <div
                    style={
                      styles.examBadge
                    }
                  >
                    {exam.subject}
                  </div>

                  <h3>
                    {exam.title}
                  </h3>

                  <p
                    style={
                      styles.muted
                    }
                  >
                    {exam.programme}
                  </p>

                  <div
                    style={
                      styles.examInfo
                    }
                  >

                    <span>
                      📝{" "}
                      {
                        exam.questionCount
                      }{" "}
                      Questions
                    </span>

                    <span>
                      ⏱️{" "}
                      {
                        exam.duration
                      }{" "}
                      Minutes
                    </span>

                    <span>
                      🎯 Pass Mark{" "}
                      {
                        exam.passMark
                      }%
                    </span>

                  </div>

                  <button

                    style={
                      styles.primaryButton
                    }

                    onClick={() =>
                      startExam(
                        exam
                      )
                    }

                    disabled={
                      !online
                    }

                  >

                    {online
                      ? "View Examination"
                      : "Offline"}

                  </button>

                </div>

              )
            )}

          </div>

      )}

    </main>
  );
}


/* ============================================================
   INSTRUCTIONS
   ============================================================ */

function Instructions({
  online,
  exam,
  beginExam,
  back,
  loading,
  error
}) {

  return (

    <main
      style={
        styles.center
      }
    >

      <section
        style={
          styles.instructionCard
        }
      >

        <div
          style={
            styles.examBadge
          }
        >
          {exam.subject}
        </div>

        <h2>
          {exam.title}
        </h2>

        <p
          style={
            styles.muted
          }
        >
          Please read the
          instructions carefully
          before starting.
        </p>

        <hr />

        <div
          style={
            styles.instructionList
          }
        >

          <p>
            📝{" "}
            <strong>
              Questions:
            </strong>{" "}
            {
              exam.questionCount
            }
          </p>

          <p>
            ⏱️{" "}
            <strong>
              Duration:
            </strong>{" "}
            {
              exam.duration
            }{" "}
            minutes
          </p>

          <p>
            🎯{" "}
            <strong>
              Pass Mark:
            </strong>{" "}
            {
              exam.passMark
            }%
          </p>

          {exam.instructions && (

            <div
              style={
                styles.customInstructions
              }
            >

              <strong>
                Instructions:
              </strong>

              <p>
                {
                  exam.instructions
                }
              </p>

            </div>

          )}

          <p>
            ⚠️ The examination timer
            begins when you click
            Start Examination.
          </p>

          <p>
            ⚠️ You may submit before
            the timer ends.
          </p>

          <p>
            ⚠️ When the timer reaches
            zero, the examination
            will be submitted
            automatically.
          </p>

          <p>
            💡 Read every question
            carefully.
          </p>

        </div>

        {!online && (

          <div
            style={
              styles.networkWarning
            }
          >

            🔴 Internet connection
            is required to create
            and verify your
            examination attempt.

          </div>

        )}

        {error && (

          <div
            style={
              styles.error
            }
          >
            {error}
          </div>

        )}

        <div
          style={
            styles.buttonRow
          }
        >

          <button

            style={
              styles.secondaryButton
            }

            onClick={
              back
            }

            disabled={
              loading
            }

          >
            Back
          </button>

          <button

            style={
              styles.primaryButton
            }

            onClick={
              beginExam
            }

            disabled={
              loading ||
              !online
            }

          >

            {loading
              ? "Creating Attempt..."
              : online
                ? "Start Examination"
                : "Waiting for Connection"}

          </button>

        </div>

      </section>

    </main>
  );
}


/* ============================================================
   EXAM SCREEN
   ============================================================ */

function ExamScreen({
  exam,
  questions,
  studentId,
  studentName,
  onExit
}) {

  const totalSeconds =
    Math.max(
      1,
      Number(
        exam.duration
      ) || 1
    ) * 60;

  const [question, setQuestion] =
    useState(1);

  const [answers, setAnswers] =
    useState({});

  const [timeLeft, setTimeLeft] =
    useState(
      totalSeconds
    );

  const [submitted, setSubmitted] =
    useState(false);

  const [result, setResult] =
    useState(null);

  const [submitting, setSubmitting] =
    useState(false);

  const attemptStorageKey =
    `cbtAttempt:${studentId}:${exam.id}`;

  const attemptInfo =
    (() => {

      try {

        const raw =
          sessionStorage.getItem(
            attemptStorageKey
          );

        return raw
          ? JSON.parse(raw)
          : null;

      } catch {

        return null;
      }

    })();

  const attemptId =
    attemptInfo?.attemptId ||
    "";

  const startTime =
    attemptInfo?.startTime ||
    new Date().toISOString();


  /* =========================================================
     TIMER
     ========================================================= */

  useEffect(() => {

    if (
      submitted ||
      submitting
    ) {
      return;
    }

    const timer =
      setInterval(() => {

        setTimeLeft(
          previous => {

            if (
              previous <= 1
            ) {

              clearInterval(
                timer
              );

              return 0;
            }

            return previous - 1;
          }
        );

      }, 1000);

    return () =>
      clearInterval(
        timer
      );

  }, [
    submitted,
    submitting
  ]);


  /* =========================================================
     AUTO SUBMIT
     ========================================================= */

  useEffect(() => {

    if (
      timeLeft === 0 &&
      !submitted &&
      !submitting
    ) {

      submitExam(true);
    }

  }, [
    timeLeft,
    submitted,
    submitting
  ]);


  /* =========================================================
     FORMAT TIMER
     ========================================================= */

  function formatTime(
    seconds
  ) {

    const minutes =
      Math.floor(
        seconds / 60
      );

    const secs =
      seconds % 60;

    return (

      `${String(
        minutes
      ).padStart(2, "0")}:` +

      `${String(
        secs
      ).padStart(2, "0")}`

    );
  }


  /* =========================================================
     SELECT ANSWER
     ========================================================= */

  function selectAnswer(
    option
  ) {

    if (
      submitted ||
      submitting
    ) {
      return;
    }

    setAnswers(
      previous => ({

        ...previous,

        [question]:
          option

      })
    );
  }


  const answeredCount =
    Object.keys(
      answers
    ).length;

  const unansweredCount =
    questions.length -
    answeredCount;


  /* =========================================================
     SUBMIT EXAM
     ========================================================= */

  async function submitExam(
    autoSubmit = false
  ) {

    if (
      submitted ||
      submitting
    ) {
      return;
    }

    if (!attemptId) {

      window.alert(

        "This examination does not have a valid CBT attempt. Please start the examination again."

      );

      return;
    }


    if (!autoSubmit) {

      const message =
        unansweredCount > 0

          ? `You have ${unansweredCount} unanswered question(s).\n\nDo you want to submit the examination now?`

          : "You have answered all questions.\n\nDo you want to submit the examination now?";

      if (
        !window.confirm(
          message
        )
      ) {
        return;
      }
    }


    setSubmitting(
      true
    );


    try {

      const submissionAnswers =
        questions.map(
          (
            item,
            index
          ) => {

            const studentAnswer =
              answers[
                index + 1
              ] || "";

            const selectedIndex =
              Array.isArray(
                item.options
              )
                ? item.options.indexOf(
                    studentAnswer
                  )
                : -1;

            let answerLetter =
              "";

            if (
              selectedIndex >=
              0
            ) {

              answerLetter =
                String.fromCharCode(
                  65 +
                  selectedIndex
                );
            }

            return {

              questionId:
                item.id,

              answer:
                answerLetter,

              timeSpentSeconds:
                0,

              answeredAt:
                new Date().toISOString(),

              explanationViewed:
                false

            };
          }
        );


      const response =
        await fetch(
          "/api/cbt-submit",
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify({

                studentId,

                examId:
                  exam.id,

                attemptId,

                startTime,

                submitTime:
                  new Date().toISOString(),

                answers:
                  submissionAnswers

              })

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(

          data?.error ||
          "The examination could not be submitted."

        );
      }


      setResult({

        correct:
          Number(
            data.correct || 0
          ),

        total:
          Number(
            data.totalQuestions ||
            questions.length
          ),

        percentage:
          Number(
            data.percentage ||
            0
          ),

        passed:
          Boolean(
            data.passed
          )

      });


      setSubmitted(
        true
      );


      sessionStorage.removeItem(
        attemptStorageKey
      );


    } catch (err) {

      console.error(
        "CBT Submission Error:",
        err
      );

      window.alert(

        err.message ||
        "Unable to submit examination. Please try again."

      );

    } finally {

      setSubmitting(
        false
      );
    }
  }


  /* =========================================================
     RESULT
     ========================================================= */

  if (
    submitted &&
    result
  ) {

    return (

      <main
        style={
          styles.center
        }
      >

        <section
          style={
            styles.resultCard
          }
        >

          <div
            style={
              styles.resultIcon
            }
          >

            {
              result.passed
                ? "🎉"
                : "📚"
            }

          </div>

          <h1>
            Examination Submitted
          </h1>

          <p
            style={
              styles.muted
            }
          >
            {exam.title}
          </p>

          <div
            style={
              styles.scoreBox
            }
          >

            <div
              style={
                styles.bigScore
              }
            >
              {
                result.percentage
              }%
            </div>

            <div>

              Score:{" "}

              <strong>
                {
                  result.correct
                }
              </strong>

              {" "}

              /{" "}

              {
                result.total
              }

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

            {
              result.passed
                ? "PASS"
                : "NOT YET PASSED"
            }

          </div>


          <p
            style={
              styles.muted
            }
          >

            Student ID:{" "}

            <strong>
              {studentId}
            </strong>

          </p>


          <button

            style={
              styles.primaryButton
            }

            onClick={
              onExit
            }

          >
            Exit Examination
          </button>

        </section>

      </main>
    );
  }


  /* =========================================================
     QUESTION SCREEN
     ========================================================= */

  const current =
    questions[
      question - 1
    ];


  if (!current) {

    return (

      <main
        style={
          styles.center
        }
      >

        <section
          style={
            styles.errorCard
          }
        >

          <h2>
            Question Error
          </h2>

          <p>
            The current question
            could not be loaded.
          </p>

          <button
            style={
              styles.primaryButton
            }
            onClick={
              onExit
            }
          >
            Exit
          </button>

        </section>

      </main>
    );
  }


  return (

    <main
      style={
        styles.container
      }
    >

      {/* EXAM HEADER */}

      <div
        style={
          styles.examHeader
        }
      >

        <div>

          <strong>
            {exam.title}
          </strong>

          <small>
            Student:{" "}
            {studentId}
          </small>

        </div>


        <div
          style={{

            ...styles.timer,

            ...(timeLeft <=
            300
              ? styles.timerDanger
              : {})

          }}
        >

          ⏱️{" "}
          {
            formatTime(
              timeLeft
            )
          }

        </div>

      </div>


      {/* PROGRESS */}

      <div
        style={
          styles.progressPanel
        }
      >

        <div>

          <strong>
            Question{" "}
            {question}{" "}
            of{" "}
            {questions.length}
          </strong>

        </div>

        <div
          style={
            styles.progressText
          }
        >

          Answered:{" "}

          <strong>
            {answeredCount}
          </strong>

          {" | "}

          Unanswered:{" "}

          <strong>
            {unansweredCount}
          </strong>

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

          Question{" "}
          {question}{" "}
          of{" "}
          {questions.length}

        </div>


        {current.topic && (

          <div
            style={
              styles.topic
            }
          >
            Topic:{" "}
            {current.topic}
          </div>

        )}


        <h2
          style={
            styles.questionText
          }
        >
          {
            current.question
          }
        </h2>


        <div>

          {current.options.map(

            (
              option,
              index
            ) => (

              <button

                key={
                  `${index}-${option}`
                }

                onClick={() =>
                  selectAnswer(
                    option
                  )
                }

                style={{

                  ...styles.option,

                  ...(answers[
                    question
                  ] === option

                    ? styles.selectedOption

                    : {})

                }}

              >

                <span
                  style={
                    styles.optionLetter
                  }
                >

                  {
                    String.fromCharCode(
                      65 +
                      index
                    )
                  }

                </span>

                <span>
                  {option}
                </span>

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
              question === 1 ||
              submitting
            }

            onClick={() =>
              setQuestion(
                previous =>
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

              style={
                styles.primaryButton
              }

              onClick={() =>
                setQuestion(
                  previous =>
                    Math.min(
                      questions.length,
                      previous + 1
                    )
                )
              }

              disabled={
                submitting
              }

            >
              Next Question →
            </button>

          ) : (

            <button

              style={
                styles.primaryButton
              }

              onClick={() =>
                submitExam(
                  false
                )
              }

              disabled={
                submitting
              }

            >

              {
                submitting
                  ? "Submitting..."
                  : "✓ Submit Examination"
              }

            </button>

          )}

        </div>


        {/* SUBMIT */}

        {question <
          questions.length && (

          <div
            style={
              styles.submitArea
            }
          >

            <p
              style={
                styles.submitHelp
              }
            >
              You can submit your
              examination at any
              time.
            </p>

            <button

              style={
                styles.submitButton
              }

              onClick={() =>
                submitExam(
                  false
                )
              }

              disabled={
                submitting
              }

            >

              ✓ Submit Examination

            </button>

          </div>

        )}

      </section>

    </main>
  );
}


/* ============================================================
   STYLES
   ============================================================ */

const styles = {

  page: {

    minHeight:
      "100vh",

    background:
      "#f5f7f6",

    fontFamily:
      "Arial, Helvetica, sans-serif",

    color:
      "#173b2a"

  },


  header: {

    background:
      "#0f6b3a",

    color:
      "white",

    padding:
      "18px 25px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px",

    boxShadow:
      "0 2px 8px rgba(0,0,0,0.12)"

  },


  logo: {

    width:
      "48px",

    height:
      "48px",

    borderRadius:
      "12px",

    background:
      "#d9b441",

    color:
      "#0f6b3a",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    fontWeight:
      "bold",

    fontSize:
      "18px"

  },


  brand: {

    margin:
      0,

    fontSize:
      "18px"

  },


  subtitle: {

    fontSize:
      "11px",

    opacity:
      0.85,

    letterSpacing:
      "1px"

  },


  studentBox: {

    marginLeft:
      "12px",

    display:
      "flex",

    flexDirection:
      "column",

    textAlign:
      "right",

    fontSize:
      "13px"

  },


  connectionBadge: {

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "6px",

    padding:
      "6px 9px",

    borderRadius:
      "20px",

    fontSize:
      "11px",

    fontWeight:
      "bold",

    marginLeft:
      "auto"

  },


  connectionOnline: {

    background:
      "#e4f2e9",

    color:
      "#0f6b3a"

  },


  connectionOffline: {

    background:
      "#ffe1e1",

    color:
      "#a40000"

  },


  connectionDot: {

    width:
      "7px",

    height:
      "7px",

    borderRadius:
      "50%",

    background:
      "currentColor"

  },


  center: {

    minHeight:
      "calc(100vh - 85px)",

    display:
      "flex",

    justifyContent:
      "center",

    alignItems:
      "center",

    padding:
      "20px"

  },


  container: {

    maxWidth:
      "1100px",

    margin:
      "auto",

    padding:
      "30px 20px"

  },


  loginCard: {

    background:
      "white",

    width:
      "100%",

    maxWidth:
      "430px",

    padding:
      "35px",

    borderRadius:
      "18px",

    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)",

    textAlign:
      "center"

  },


  instructionCard: {

    background:
      "white",

    width:
      "100%",

    maxWidth:
      "600px",

    padding:
      "35px",

    borderRadius:
      "18px",

    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)"

  },


  resultCard: {

    background:
      "white",

    width:
      "100%",

    maxWidth:
      "500px",

    padding:
      "40px",

    borderRadius:
      "18px",

    boxShadow:
      "0 8px 30px rgba(0,0,0,0.08)",

    textAlign:
      "center"

  },


  iconCircle: {

    fontSize:
      "45px",

    marginBottom:
      "10px"

  },


  resultIcon: {

    fontSize:
      "55px",

    marginBottom:
      "10px"

  },


  loadingIcon: {

    fontSize:
      "45px"

  },


  input: {

    width:
      "100%",

    boxSizing:
      "border-box",

    padding:
      "15px",

    border:
      "1px solid #ccd8d1",

    borderRadius:
      "10px",

    fontSize:
      "16px",

    marginTop:
      "15px"

  },


  primaryButton: {

    background:
      "#0f6b3a",

    color:
      "white",

    border:
      "none",

    borderRadius:
      "9px",

    padding:
      "13px 20px",

    fontWeight:
      "bold",

    cursor:
      "pointer",

    marginTop:
      "15px"

  },


  secondaryButton: {

    background:
      "white",

    color:
      "#0f6b3a",

    border:
      "1px solid #0f6b3a",

    borderRadius:
      "9px",

    padding:
      "12px 18px",

    fontWeight:
      "bold",

    cursor:
      "pointer"

  },


  submitButton: {

    background:
      "#b88908",

    color:
      "white",

    border:
      "none",

    borderRadius:
      "9px",

    padding:
      "13px 22px",

    fontWeight:
      "bold",

    cursor:
      "pointer"

  },


  error: {

    background:
      "#ffe9e9",

    color:
      "#a40000",

    padding:
      "10px",

    borderRadius:
      "8px",

    marginTop:
      "12px",

    fontSize:
      "14px"

  },


  errorCard: {

    background:
      "#ffe9e9",

    color:
      "#8b0000",

    padding:
      "25px",

    borderRadius:
      "12px",

    marginTop:
      "20px"

  },


  networkNotice: {

    background:
      "#e4f2e9",

    color:
      "#0f6b3a",

    padding:
      "9px 11px",

    borderRadius:
      "8px",

    fontSize:
      "12px",

    marginTop:
      "12px"

  },


  networkNoticeOffline: {

    background:
      "#ffe9e9",

    color:
      "#a40000",

    padding:
      "9px 11px",

    borderRadius:
      "8px",

    fontSize:
      "12px",

    marginTop:
      "12px"

  },


  networkWarning: {

    background:
      "#fff2d2",

    color:
      "#795600",

    padding:
      "12px 15px",

    borderRadius:
      "9px",

    marginBottom:
      "18px",

    fontSize:
      "13px",

    fontWeight:
      "600"

  },


  muted: {

    color:
      "#66756d"

  },


  small: {

    fontSize:
      "11px",

    color:
      "#89958f",

    marginTop:
      "25px"

  },


  topRow: {

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "15px",

    marginBottom:
      "25px"

  },


  examGrid: {

    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",

    gap:
      "20px"

  },


  examCard: {

    background:
      "white",

    borderRadius:
      "16px",

    padding:
      "25px",

    boxShadow:
      "0 7px 24px rgba(0,0,0,0.07)",

    border:
      "1px solid #e6ece8"

  },


  examBadge: {

    display:
      "inline-block",

    background:
      "#e4f2e9",

    color:
      "#0f6b3a",

    padding:
      "6px 10px",

    borderRadius:
      "20px",

    fontSize:
      "12px",

    fontWeight:
      "bold"

  },


  examInfo: {

    display:
      "flex",

    flexDirection:
      "column",

    gap:
      "8px",

    color:
      "#58675f",

    fontSize:
      "14px",

    marginTop:
      "18px"

  },


  messageCard: {

    background:
      "white",

    padding:
      "40px",

    borderRadius:
      "15px",

    textAlign:
      "center",

    boxShadow:
      "0 5px 20px rgba(0,0,0,0.06)"

  },


  instructionList: {

    lineHeight:
      "1.7"

  },


  customInstructions: {

    background:
      "#f5f7f6",

    padding:
      "15px",

    borderRadius:
      "10px",

    marginTop:
      "15px"

  },


  buttonRow: {

    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "12px",

    marginTop:
      "25px"

  },


  examHeader: {

    background:
      "white",

    padding:
      "18px",

    borderRadius:
      "12px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    marginBottom:
      "12px"

  },


  timer: {

    background:
      "#fff2d2",

    color:
      "#795600",

    padding:
      "10px 15px",

    borderRadius:
      "8px",

    fontWeight:
      "bold",

    minWidth:
      "75px",

    textAlign:
      "center"

  },


  timerDanger: {

    background:
      "#ffe1e1",

    color:
      "#a40000"

  },


  progressPanel: {

    background:
      "white",

    padding:
      "14px 18px",

    borderRadius:
      "10px",

    display:
      "flex",

    justifyContent:
      "space-between",

    flexWrap:
      "wrap",

    gap:
      "10px",

    marginBottom:
      "15px",

    fontSize:
      "14px"

  },


  progressText: {

    color:
      "#66756d"

  },


  questionCard: {

    background:
      "white",

    borderRadius:
      "15px",

    padding:
      "30px",

    boxShadow:
      "0 5px 20px rgba(0,0,0,0.06)"

  },


  questionNumber: {

    color:
      "#0f6b3a",

    fontWeight:
      "bold",

    marginBottom:
      "10px"

  },


  topic: {

    display:
      "inline-block",

    background:
      "#f0f4f1",

    color:
      "#66756d",

    padding:
      "5px 9px",

    borderRadius:
      "15px",

    fontSize:
      "12px",

    marginBottom:
      "15px"

  },


  questionText: {

    lineHeight:
      "1.45"

  },


  option: {

    width:
      "100%",

    textAlign:
      "left",

    padding:
      "15px",

    marginTop:
      "10px",

    background:
      "white",

    border:
      "1px solid #d7e0db",

    borderRadius:
      "10px",

    cursor:
      "pointer",

    fontSize:
      "15px",

    display:
      "flex",

    alignItems:
      "center",

    gap:
      "12px"

  },


  optionLetter: {

    width:
      "30px",

    height:
      "30px",

    borderRadius:
      "50%",

    background:
      "#e4f2e9",

    color:
      "#0f6b3a",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    fontWeight:
      "bold",

    flexShrink:
      0

  },


  selectedOption: {

    background:
      "#e4f2e9",

    border:
      "2px solid #0f6b3a"

  },


  navigationRow: {

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "12px",

    marginTop:
      "25px"

  },


  submitArea: {

    borderTop:
      "1px solid #e1e7e3",

    marginTop:
      "25px",

    paddingTop:
      "20px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "15px",

    flexWrap:
      "wrap"

  },


  submitHelp: {

    color:
      "#66756d",

    fontSize:
      "13px",

    margin:
      0

  },


  scoreBox: {

    background:
      "#f5f7f6",

    padding:
      "25px",

    borderRadius:
      "12px",

    marginTop:
      "25px",

    marginBottom:
      "20px"

  },


  bigScore: {

    fontSize:
      "48px",

    fontWeight:
      "bold",

    color:
      "#0f6b3a",

    marginBottom:
      "8px"

  },


  status: {

    display:
      "inline-block",

    padding:
      "10px 25px",

    borderRadius:
      "20px",

    fontWeight:
      "bold",

    marginBottom:
      "20px"

  }

};


/* ============================================================
   REACT MOUNT
   ============================================================ */

createRoot(
  document.getElementById(
    "cbt-root"
  )
).render(
  <App />
);
