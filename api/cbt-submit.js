/*
  AIBINU FLEXIPREP CBT SUBMISSION API

  POST /api/cbt-submit

  The attempt is created by /api/cbt-start.
  This endpoint updates that existing attempt and
  creates the student's CBT responses.
*/

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { AIRTABLE_PAT, AIRTABLE_BASE_ID } = process.env;

    if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        error: "Airtable environment variables are missing"
      });
    }

    const body = req.body || {};

    const studentId = String(body.studentId || "")
      .trim()
      .toUpperCase();

    const examId = String(body.examId || "").trim();
    const attemptId = String(body.attemptId || "").trim();

    const startTime =
      body.startTime || new Date().toISOString();

    const submitTime =
      body.submitTime || new Date().toISOString();

    let answers = body.answers;

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
      return res.status(400).json({ error: "studentId is required" });
    }

    if (!examId) {
      return res.status(400).json({ error: "examId is required" });
    }

    if (!attemptId) {
      return res.status(400).json({
        error:
          "attemptId is required. Start the examination again so the CBT attempt can be created."
      });
    }

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: "answers must be an array or answer object"
      });
    }

    const headers = {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      "Content-Type": "application/json"
    };

    async function listAll(tableName) {
      const records = [];
      let offset = null;

      do {
        let url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        if (offset) {
          url += `?offset=${encodeURIComponent(offset)}`;
        }

        const response = await fetch(url, { headers });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Airtable request failed for ${tableName}: ${JSON.stringify(data)}`
          );
        }

        records.push(...(data.records || []));
        offset = data.offset || null;
      } while (offset);

      return records;
    }

    async function createRecords(tableName, records) {
      const created = [];

      for (let i = 0; i < records.length; i += 10) {
        const batch = records.slice(i, i + 10);

        const url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ records: batch })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            `Airtable create failed for ${tableName}: ${JSON.stringify(data)}`
          );
        }

        created.push(...(data.records || []));
      }

      return created;
    }

    // 1. Find student.
    const students = await listAll("Students");

    const studentRecord = students.find(record => {
      const f = record.fields || {};

      return String(
        f["Student ID"] ??
        f["Student_ID"] ??
        ""
      ).trim().toUpperCase() === studentId;
    });

    if (!studentRecord) {
      return res.status(404).json({
        error: "Student not found",
        studentId
      });
    }

    // 2. Find exam.
    const exams = await listAll("CBT_Exams");

    const examRecord = exams.find(record => {
      const f = record.fields || {};

      return (
        String(f["Exam ID"] || "").trim() === examId ||
        String(record.id) === examId
      );
    });

    if (!examRecord) {
      return res.status(404).json({
        error: "Examination not found",
        examId
      });
    }

    const examFields = examRecord.fields || {};

    // 3. Find the EXISTING attempt created at exam start.
    const attempts = await listAll("CBT_Attempts");

    const attemptRecord = attempts.find(record => {
      const f = record.fields || {};

      return String(f["Attempt ID"] || "").trim() === attemptId;
    });

    if (!attemptRecord) {
      return res.status(404).json({
        error:
          "CBT attempt not found. The examination must be started again.",
        attemptId
      });
    }

    // Security check: attempt must belong to this student and exam.
    const attemptFields = attemptRecord.fields || {};

    const linkedStudentIds = Array.isArray(attemptFields["Student"])
      ? attemptFields["Student"].map(x =>
          typeof x === "string" ? x : x?.id
        )
      : [];

    const linkedExamIds = Array.isArray(attemptFields["CBT Exam"])
      ? attemptFields["CBT Exam"].map(x =>
          typeof x === "string" ? x : x?.id
        )
      : [];

    if (
      !linkedStudentIds.includes(studentRecord.id) ||
      !linkedExamIds.includes(examRecord.id)
    ) {
      return res.status(403).json({
        error: "This CBT attempt does not belong to this student/examination."
      });
    }

    // 4. Get questions linked to this exam.
    const linkedQuestionIds =
      (examFields["CBT_Questions"] || [])
        .map(item =>
          typeof item === "string" ? item : item?.id
        )
        .filter(Boolean);

    if (linkedQuestionIds.length === 0) {
      return res.status(400).json({
        error:
          "No questions are linked to this examination in Airtable"
      });
    }

    const questionRecords =
      await listAll("CBT_Questions");

    const linkedQuestions =
      questionRecords.filter(record =>
        linkedQuestionIds.includes(record.id)
      );

    const questionMap = new Map();

    for (const record of linkedQuestions) {
      const f = record.fields || {};

      let correct = f["Correct Answer"] || "";

      if (correct && typeof correct === "object") {
        correct = correct.name || "";
      }

      const questionId = String(
        f["Question ID"] || record.id
      );

      questionMap.set(questionId, {
        recordId: record.id,
        questionId,
        correctAnswer: String(correct)
          .trim()
          .toUpperCase(),
        explanation: f["Explanation"] || ""
      });
    }

    // 5. Evaluate answers server-side.
    const evaluated = [];
    const seen = new Set();
    let correctCount = 0;

    for (const item of answers) {
      const questionId =
        String(item?.questionId || "").trim();

      if (!questionId || seen.has(questionId)) {
        continue;
      }

      const question =
        questionMap.get(questionId);

      if (!question) {
        continue;
      }

      seen.add(questionId);

      const studentAnswer =
        String(item?.answer || "")
          .trim()
          .toUpperCase();

      const isCorrect =
        studentAnswer !== "" &&
        studentAnswer === question.correctAnswer;

      if (isCorrect) {
        correctCount++;
      }

      evaluated.push({
        question,
        studentAnswer,
        isCorrect,
        timeSpentSeconds: Math.max(
          0,
          Number(item?.timeSpentSeconds || 0)
        ),
        answeredAt:
          item?.answeredAt || submitTime,
        explanationViewed:
          Boolean(item?.explanationViewed)
      });
    }

    const totalQuestions =
      Number(examFields["Question Count"] || 0) ||
      linkedQuestions.length;

    const percentage =
      totalQuestions > 0
        ? Math.round(
            (correctCount / totalQuestions) * 10000
          ) / 100
        : 0;

    const passMark =
      Number(examFields["Pass Mark"] || 0);

    // 6. Update the existing attempt.
    // PATCH changes only the fields supplied, so computed
    // Airtable fields remain intact.
    const attemptUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CBT_Attempts/${attemptRecord.id}`;

    const updateResponse = await fetch(attemptUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        fields: {
          "Start Time": startTime,
          "Submit Time": submitTime
        }
      })
    });

    const updateData = await updateResponse.json();

    if (!updateResponse.ok) {
      throw new Error(
        `Airtable attempt update failed: ${JSON.stringify(updateData)}`
      );
    }

    // 7. Create CBT responses linked to the existing attempt.
    const responsePayload = evaluated.map(item => ({
      fields: {
        "CBT Attempt": [attemptRecord.id],
        "CBT Question": [item.question.recordId],
        "Student Answer": item.studentAnswer,
        "Answered At": item.answeredAt,
        "Is Correct": item.isCorrect,
        "Time Spent Seconds": item.timeSpentSeconds,
        "Student": [studentRecord.id],
        "Exam": [examRecord.id],
        "Explanation Viewed": item.explanationViewed
      }
    }));

    const createdResponses =
      responsePayload.length
        ? await createRecords(
            "CBT_Responses",
            responsePayload
          )
        : [];

    return res.status(200).json({
      success: true,
      attemptId,
      attemptRecordId: attemptRecord.id,
      studentId,
      examId: examFields["Exam ID"] || examId,
      totalQuestions,
      answeredQuestions: evaluated.length,
      correct: correctCount,
      wrong: Math.max(
        0,
        evaluated.length - correctCount
      ),
      score: correctCount,
      percentage,
      passMark,
      passed: percentage >= passMark,
      responseCount: createdResponses.length,
      message: "Examination submitted successfully"
    });

  } catch (error) {
    console.error("CBT Submission API Error:", error);

    return res.status(500).json({
      error: "Failed to submit examination",
      details: error.message
    });
  }
}
