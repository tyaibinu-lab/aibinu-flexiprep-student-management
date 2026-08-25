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

    const { examId } = req.query;

    if (!examId) {
      return res.status(400).json({
        error: "examId is required"
      });
    }

    const tableName = "CBT_Questions";

    /*
      The CBT_Questions table contains a linked
      CBT Exam field.

      We search the lookup field:
      Exam ID (from CBT Exam)

      ARRAYJOIN converts Airtable lookup values
      into text so that they can be compared.
    */

    const safeExamId = String(examId)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const formula = `
      OR(
        ARRAYJOIN({Exam ID (from CBT Exam)})="${safeExamId}",
        ARRAYJOIN({CBT Exam})="${safeExamId}"
      )
    `;

    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}` +
      `?filterByFormula=${encodeURIComponent(formula)}`;

    console.log("CBT Questions Request");
    console.log("Exam ID:", examId);
    console.log("Formula:", formula);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Airtable CBT Questions Error:",
        errorText
      );

      return res.status(response.status).json({
        error: "Airtable request failed",
        details: errorText
      });
    }

    const data = await response.json();

    console.log(
      "Questions returned from Airtable:",
      data.records.length
    );

    /*
      Convert Airtable records into the format
      required by the CBT application.
    */

    const questions = data.records.map(record => {
      const f = record.fields || {};

      return {
        id:
          f["Question ID"] ||
          record.id,

        question:
          f["Question"] ||
          "",

        options: [
          f["Option A"] || "",
          f["Option B"] || "",
          f["Option C"] || "",
          f["Option D"] || ""
        ],

        answer:
          f["Correct Answer"] ||
          "",

        topic:
          f["Topic"] ||
          "",

        bloomLevel:
          f["Bloom Level"] ||
          "",

        difficulty:
          f["Difficulty"] ||
          "",

        explanation:
          f["Explanation"] ||
          "",

        status:
          f["Status"] ||
          ""
      };
    });

    return res.status(200).json(questions);

  } catch (error) {

    console.error(
      "CBT Questions API Error:",
      error
    );

    return res.status(500).json({
      error: "Failed to load questions",
      details: error.message
    });
  }
}
