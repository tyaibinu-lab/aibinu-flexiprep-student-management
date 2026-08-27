/*
  AIBINU FLEXIPREP - VERIFY STUDENT API

  GET /api/verify-student?studentId=AF-2026-0001

  Verifies a Student ID directly against Airtable.
  Uses the actual Student table field names from the
  Aibinu Flexiprep student-management project.
*/

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

    const studentId = String(req.query.studentId || "")
      .trim()
      .toUpperCase();

    if (!studentId) {
      return res.status(400).json({
        error: "Student ID is required"
      });
    }

    const headers = {
      Authorization: `Bearer ${AIRTABLE_PAT}`
    };

    /*
      Search the Students table directly by Student_ID.
    */

    const escapedStudentId = studentId
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const filterFormula =
      `UPPER({Student_ID})="${escapedStudentId}"`;

    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Students` +
      `?filterByFormula=${encodeURIComponent(filterFormula)}` +
      `&maxRecords=1`;

    const response = await fetch(url, {
      method: "GET",
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Airtable student lookup failed:",
        data
      );

      return res.status(response.status).json({
        error: "Unable to verify Student ID",
        details: data
      });
    }

    const record = (data.records || [])[0];

    /*
      Student ID does not exist.
    */

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Student ID not found",
        studentId
      });
    }

    const f = record.fields || {};

    /*
      Check student status.
    */

    const status = String(
      f["Student_Status"] || ""
    ).trim();

    if (
      status &&
      status.toLowerCase() !== "active"
    ) {
      return res.status(403).json({
        success: false,
        error:
          `This Student ID is not active (status: ${status}). ` +
          `Please contact the administrator.`,
        studentId
      });
    }

    /*
      Build student's full name.
    */

    const surname = String(
      f["Surname"] || ""
    ).trim();

    const firstName = String(
      f["First_Name"] || ""
    ).trim();

    const otherName = String(
      f["Other_Name"] || ""
    ).trim();

    const studentName = [
      firstName,
      otherName,
      surname
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    /*
      Student successfully verified.
    */

    return res.status(200).json({
      success: true,

      studentId:
        f["Student_ID"] || studentId,

      studentName:
        studentName || "Student",

      programme:
        f["Programme"] || "",

      currentClass:
        f["Current_Class"] || "",

      status:
        status || "Active",

      airtableRecordId:
        record.id
    });

  } catch (error) {

    console.error(
      "Verify Student API Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Failed to verify student",
      details: error.message
    });
  }
}
