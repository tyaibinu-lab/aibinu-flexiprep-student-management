/*
  AIBINU FLEXIPREP CBT START ATTEMPT API

  POST /api/cbt-start

  Creates CBT_Attempts when the student clicks
  "Start Examination".
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
    const studentId = String(body.studentId || "").trim().toUpperCase();
    const examId = String(body.examId || "").trim();
    const startTime = body.startTime || new Date().toISOString();

    if (!studentId) {
      return res.status(400).json({ error: "studentId is required" });
    }

    if (!examId) {
      return res.status(400).json({ error: "examId is required" });
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

    // 1. Find student. Support both field names used in the project.
    const students = await listAll("Students");

    const studentRecord = students.find(record => {
      const f = record.fields || {};
      const id = String(
        f["Student ID"] ??
        f["Student_ID"] ??
        ""
      ).trim().toUpperCase();

      return id === studentId;
    });

    if (!studentRecord) {
      return res.status(404).json({
        error: "Student not found",
        studentId
      });
    }

    // 2. Find examination.
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
    const linkedQuestions = examFields["CBT_Questions"] || [];

    if (!Array.isArray(linkedQuestions) || linkedQuestions.length === 0) {
      return res.status(400).json({
        error: "No questions are linked to this examination in Airtable"
      });
    }

    // 3. Create the attempt NOW, at the start of the examination.
    const year = new Date(startTime).getFullYear();

    const attemptId =
      `ATT-${year}-${Date.now().toString().slice(-8)}-${Math.floor(
        Math.random() * 1000
      ).toString().padStart(3, "0")}`;

    const attemptsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CBT_Attempts`;

    const createResponse = await fetch(attemptsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        records: [{
          fields: {
            "Attempt ID": attemptId,
            "Exam": [examRecord.id],
            "CBT Exam": [examRecord.id],
            "Student": [studentRecord.id],
            "Start Time": startTime
          }
        }]
      })
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      throw new Error(
        `Airtable create failed for CBT_Attempts: ${JSON.stringify(createData)}`
      );
    }

    const attemptRecord = createData.records?.[0];

    if (!attemptRecord?.id) {
      throw new Error("CBT attempt was not created");
    }

    return res.status(200).json({
      success: true,
      attemptId,
      attemptRecordId: attemptRecord.id,
      studentId,
      examId: examFields["Exam ID"] || examId,
      startTime,
      message: "CBT attempt created successfully"
    });

  } catch (error) {
    console.error("CBT Start Attempt API Error:", error);

    return res.status(500).json({
      error: "Failed to create CBT attempt",
      details: error.message
    });
  }
}
