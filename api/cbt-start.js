/*
  AIBINU FLEXIPREP CBT START ATTEMPT API

  POST /api/cbt-start

  Creates CBT_Attempts when an authenticated student
  clicks "Start Examination".

  SECURITY:
  - Student identity MUST come from the authenticated session.
  - Browser-supplied studentId is never trusted.
  - Start time is generated server-side.
*/

import { requireRole } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  /*
    STEP 54B:
    Establish the authentication boundary.

    Only an authenticated student may start a CBT.
    The student's identity is obtained from the signed
    server-verified session, NOT from req.body.studentId.
  */
  const user = requireRole(req, res, "student");

  if (!user) {
    return;
  }

  /*
    The authenticated student session must contain
    the student's business identifier.

    This is the bridge between authentication identity
    and the existing Students Airtable record.
  */
  const authenticatedStudentId =
    String(user.studentId || "").trim().toUpperCase();

  if (!authenticatedStudentId) {
    return res.status(403).json({
      success: false,
      error: "Authenticated student account is not linked to a student record.",
      code: "STUDENT_IDENTITY_NOT_LINKED"
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

    /*
      examId identifies the examination the student wants
      to take. It is NOT an identity credential.
    */
    const examId = String(body.examId || "").trim();

    if (!examId) {
      return res.status(400).json({
        error: "examId is required"
      });
    }

    /*
      SECURITY:
      Never trust the browser's startTime.

      The official examination start time is generated
      by the server.
    */
    const startTime = new Date().toISOString();

    const headers = {
      Authorization: `Bearer ${AIRTABLE_PAT}`,
      "Content-Type": "application/json"
    };

    async function listAll(tableName) {
      const records = [];
      let offset = null;

      do {
        let url =
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
            tableName
          )}`;

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

    /*
      1. Find the authenticated student.

      IMPORTANT:
      authenticatedStudentId comes from the signed
      session. We do NOT use body.studentId.
    */
    const students = await listAll("Students");

    const studentRecord = students.find((record) => {
      const f = record.fields || {};

      const id = String(
        f["Student ID"] ??
        f["Student_ID"] ??
        ""
      )
        .trim()
        .toUpperCase();

      return id === authenticatedStudentId;
    });

    if (!studentRecord) {
      return res.status(404).json({
        error: "Authenticated student record not found",
        studentId: authenticatedStudentId
      });
    }

    /*
      Optional status protection.

      Do not allow inactive/non-active student records
      to start examinations.
    */
    const studentFields = studentRecord.fields || {};

    const studentStatus = String(
      studentFields["Status"] ??
      studentFields["Student_Status"] ??
      ""
    )
      .trim()
      .toLowerCase();

    if (
      studentStatus &&
      ![
        "active",
        "eligible",
        "current",
        "enrolled"
      ].includes(studentStatus)
    ) {
      return res.status(403).json({
        success: false,
        error: "Student is not currently eligible to start an examination.",
        code: "STUDENT_NOT_ELIGIBLE",
        studentId: authenticatedStudentId
      });
    }

    /*
      2. Find examination.
    */
    const exams = await listAll("CBT_Exams");

    const examRecord = exams.find((record) => {
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

    if (
      !Array.isArray(linkedQuestions) ||
      linkedQuestions.length === 0
    ) {
      return res.status(400).json({
        error:
          "No questions are linked to this examination in Airtable"
      });
    }

    /*
      3. Create the attempt.

      The Student field is derived exclusively from
      the authenticated session -> Students record.
    */
    const year = new Date(startTime).getFullYear();

    const attemptId =
      `ATT-${year}-${Date.now()
        .toString()
        .slice(-8)}-${Math.floor(
        Math.random() * 1000
      )
        .toString()
        .padStart(3, "0")}`;

    const attemptsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CBT_Attempts`;

    const createResponse = await fetch(attemptsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        records: [
          {
            fields: {
              "Attempt ID": attemptId,
              "Exam": [examRecord.id],
              "CBT Exam": [examRecord.id],
              "Student": [studentRecord.id],
              "Start Time": startTime
            }
          }
        ]
      })
    });

    const createData = await createResponse.json();

    if (!createResponse.ok) {
      throw new Error(
        `Airtable create failed for CBT_Attempts: ${JSON.stringify(
          createData
        )}`
      );
    }

    const attemptRecord = createData.records?.[0];

    if (!attemptRecord?.id) {
      throw new Error("CBT attempt was not created");
    }

    /*
      Return the authenticated identity.

      We deliberately do not echo a browser-supplied
      studentId because it is not authoritative.
    */
    return res.status(200).json({
      success: true,
      attemptId,
      attemptRecordId: attemptRecord.id,
      studentId: authenticatedStudentId,
      examId: examFields["Exam ID"] || examId,
      startTime,
      message: "CBT attempt created successfully"
    });

  } catch (error) {
    console.error(
      "CBT Start Attempt API Error:",
      error
    );

    return res.status(500).json({
      error: "Failed to create CBT attempt",
      details: error.message
    });
  }
}
