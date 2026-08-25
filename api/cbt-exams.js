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

    const tableName = "CBT_Exams";

    const url =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_PAT}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: "Airtable request failed",
        details: errorText
      });
    }

    const data = await response.json();

    const exams = data.records.map(record => {
      const f = record.fields || {};

      return {
        id: f["Exam ID"] || record.id,
        title: f["Exam Title"] || "",
        subject: f["Subject"] || "",
        programme: f["Programme"] || "",
        questionCount: Number(f["Question Count"] || 0),
        duration: Number(f["Duration Minutes"] || 0),
        passMark: Number(f["Pass Mark"] || 0),
        status: f["Status"] || "",
        instructions: f["Instructions"] || "",
        examDate: f["Exam Date"] || ""
      };
    });

    return res.status(200).json(exams);

  } catch (error) {
    console.error("CBT Exams API Error:", error);

    return res.status(500).json({
      error: "Failed to load exams",
      details: error.message
    });
  }
}
