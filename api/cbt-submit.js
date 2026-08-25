/*
  AIBINU FLEXIPREP CBT SUBMISSION API

  POST /api/cbt-submit

  Body:
  {
    studentId,
    examId,
    startTime,
    submitTime,
    answers: [
      {
        questionId,
        answer,
        timeSpentSeconds,
        answeredAt,
        explanationViewed
      }
    ]
  }

  The server calculates correctness from Airtable.
*/

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      AIRTABLE_PAT,
      AIRTABLE_BASE_ID
    } = process.env;

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        error: "Airtable environment variables are missing"
      });
    }

    const body = req.body || {};

    const studentId = String(
      body.studentId || ""
    ).trim().toUpperCase();

    const examId = String(
      body.examId || ""
    ).trim();

    const startTime =
      body.startTime ||
      new Date().toISOString();

    const submitTime =
      body.submitTime ||
      new Date().toISOString();

    let answers = body.answers;

    /*
      Also accept an answer object such as:

      {
        "PHY-Q001": "C",
        "PHY-Q002": "A"
      }

      and convert it to the normal array format.
    */

    if (
      answers &&
      !Array.isArray(answers) &&
      typeof answers === "object"
    ) {
      answers = Object.entries(answers).map(
        ([questionId, answer]) => ({
          questionId,
          answer
        })
      );
    }

    if (!studentId) {
      return res.status(400).json({
        error: "studentId is required"
      });
    }

    if (!examId) {
      return res.status(400).json({
        error: "examId is required"
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error:
          "answers must be an array or answer object"
      });
    }

    const headers = {
      Authorization:
        `Bearer ${AIRTABLE_PAT}`,

      "Content-Type":
        "application/json"
    };


    /*
      =====================================================
      FUNCTION: LOAD ALL RECORDS
      =====================================================
    */

    async function listAll(tableName) {

      const records = [];

      let offset = null;

      do {

        let url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        if (offset) {
          url +=
            `?offset=${encodeURIComponent(offset)}`;
        }

        const response =
          await fetch(url, {
            headers
          });

        if (!response.ok) {

          throw new Error(
            `Airtable request failed for ${tableName}: ${await response.text()}`
          );

        }

        const data =
          await response.json();

        records.push(
          ...(data.records || [])
        );

        offset =
          data.offset || null;

      } while (offset);

      return records;
    }


    /*
      =====================================================
      FUNCTION: CREATE AIRTABLE RECORDS
      =====================================================
    */

    async function createRecords(
      tableName,
      records
    ) {

      const created = [];

      for (
        let i = 0;
        i < records.length;
        i += 50
      ) {

        const batch =
          records.slice(i, i + 50);

        const url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        const response =
          await fetch(url, {

            method: "POST",

            headers,

            body: JSON.stringify({
              records: batch
            })

          });

        if (!response.ok) {

          throw new Error(
            `Airtable create failed for ${tableName}: ${await response.text()}`
          );

        }

        const data =
          await response.json();

        created.push(
          ...(data.records || [])
        );
      }

      return created;
    }


    /*
      =====================================================
      1. FIND STUDENT
      =====================================================
    */

    const students =
      await listAll("Students");

    const studentRecord =
      students.find(record => {

        const f =
          record.fields || {};

        return (
          String(
            f["Student ID"] || ""
          )
            .trim()
            .toUpperCase()
          === studentId
        );

      });


    if (!studentRecord) {

      return res.status(404).json({

        error:
          "Student not found",

        studentId

      });

    }


    /*
      =====================================================
      2. FIND EXAM
      =====================================================
    */

    const exams =
      await listAll("CBT_Exams");

    const examRecord =
      exams.find(record => {

        const f =
          record.fields || {};

        return (

          String(
            f["Exam ID"] || ""
          )
          === examId

          ||

          String(record.id)
          === examId

        );

      });


    if (!examRecord) {

      return res.status(404).json({

        error:
          "Examination not found",

        examId

      });

    }


    const examFields =
      examRecord.fields || {};


    /*
      =====================================================
      3. GET QUESTIONS LINKED TO EXAM
      =====================================================
    */

    const linkedQuestionIds =
      (
        examFields["CBT_Questions"] || []
      )

        .map(item => {

          if (
            typeof item === "string"
          ) {
            return item;
          }

          return item?.id;

        })

        .filter(Boolean);


    if (
      linkedQuestionIds.length === 0
    ) {

      return res.status(400).json({

        error:
          "No questions are linked to this examination in Airtable"

      });

    }


    /*
      =====================================================
      4. LOAD QUESTION BANK
      =====================================================
    */

    const questionRecords =
      await listAll(
        "CBT_Questions"
      );


    const linkedQuestions =
      questionRecords.filter(
        record =>
          linkedQuestionIds.includes(
            record.id
          )
      );


    /*
      =====================================================
      5. CREATE QUESTION MAP
      =====================================================
    */

    const questionMap =
      new Map();


    for (
      const record
      of linkedQuestions
    ) {

      const f =
        record.fields || {};

      let correct =
        f["Correct Answer"] || "";


      if (
        correct &&
        typeof correct === "object"
      ) {

        correct =
          correct.name || "";

      }


      const questionId =
        String(
          f["Question ID"] ||
          record.id
        );


      questionMap.set(
        questionId,

        {

          recordId:
            record.id,

          questionId,

          correctAnswer:
            String(correct)
              .trim()
              .toUpperCase(),

          explanation:
            f["Explanation"] || ""

        }

      );

    }


    /*
      =====================================================
      6. CALCULATE ANSWERS
      =====================================================
    */

    const evaluated = [];

    const seen =
      new Set();

    let correctCount = 0;


    for (
      const item
      of answers
    ) {

      const questionId =
        String(
          item?.questionId || ""
        ).trim();


      if (
        !questionId ||
        seen.has(questionId)
      ) {

        continue;

      }


      const question =
        questionMap.get(
          questionId
        );


      /*
        Ignore answers for questions
        that do not belong to this exam.
      */

      if (!question) {

        continue;

      }


      seen.add(
        questionId
      );


      const studentAnswer =
        String(
          item?.answer || ""
        )
          .trim()
          .toUpperCase();


      const isCorrect =
        studentAnswer !== "" &&
        studentAnswer ===
          question.correctAnswer;


      if (isCorrect) {

        correctCount++;

      }


      evaluated.push({

        question,

        studentAnswer,

        isCorrect,

        timeSpentSeconds:
          Math.max(
            0,
            Number(
              item?.timeSpentSeconds || 0
            )
          ),

        answeredAt:
          item?.answeredAt ||
          submitTime,

        explanationViewed:
          Boolean(
            item?.explanationViewed
          )

      });

    }


    /*
      =====================================================
      7. CALCULATE RESULT
      =====================================================
    */

    const totalQuestions =
      Number(
        examFields[
          "Question Count"
        ] || 0
      ) ||
      linkedQuestions.length;


    const percentage =
      totalQuestions
        ? Math.round(
            (
              correctCount /
              totalQuestions
            ) * 10000
          ) / 100
        : 0;


    const passMark =
      Number(
        examFields[
          "Pass Mark"
        ] || 0
      );


    /*
      =====================================================
      8. CREATE CBT ATTEMPT
      =====================================================
    */

    const year =
      new Date(
        submitTime
      ).getFullYear();


    const attemptId =
      `ATT-${year}-${String(
        Date.now()
      ).slice(-8)}`;


    const attempts =
      await createRecords(
        "CBT_Attempts",

        [

          {

            fields: {

              "Attempt ID":
                attemptId,

              "Exam":
                [examRecord.id],

              "Student":
                [studentRecord.id],

              "Start Time":
                startTime,

              "Submit Time":
                submitTime

            }

          }

        ]

      );


    const attemptRecord =
      attempts[0];


    if (
      !attemptRecord?.id
    ) {

      throw new Error(
        "CBT attempt was not created"
      );

    }


    /*
      =====================================================
      9. CREATE CBT RESPONSES
      =====================================================
    */

    const responsePayload =
      evaluated.map(item => ({

        fields: {

          "CBT Attempt":
            [attemptRecord.id],

          "CBT Question":
            [item.question.recordId],

          "Student Answer":
            item.studentAnswer,

          "Answered At":
            item.answeredAt,

          "Is Correct":
            item.isCorrect,

          "Time Spent Seconds":
            item.timeSpentSeconds,

          "Student":
            [studentRecord.id],

          "Exam":
            [examRecord.id],

          "Explanation Viewed":
            item.explanationViewed

        }

      }));


    const createdResponses =
      responsePayload.length

        ? await createRecords(
            "CBT_Responses",
            responsePayload
          )

        : [];


    /*
      =====================================================
      10. RETURN RESULT
      =====================================================
    */

    return res.status(200).json({

      success: true,

      attemptId,

      studentId,

      examId:
        examFields[
          "Exam ID"
        ] || examId,

      totalQuestions,

      answeredQuestions:
        evaluated.length,

      correct:
        correctCount,

      wrong:
        Math.max(
          0,
          evaluated.length -
          correctCount
        ),

      score:
        correctCount,

      percentage,

      passMark,

      passed:
        percentage >= passMark,

      responseCount:
        createdResponses.length,

      message:
        "Examination submitted successfully"

    });


  } catch (error) {

    console.error(
      "CBT Submission API Error:",
      error
    );


    return res.status(500).json({

      error:
        "Failed to submit examination",

      details:
        error.message

    });

  }

}
