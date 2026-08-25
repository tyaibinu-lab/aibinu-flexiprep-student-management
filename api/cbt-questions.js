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

    const headers = {
      Authorization: `Bearer ${AIRTABLE_PAT}`
    };

    /* =====================================================
       1. FIND THE EXAM
       ===================================================== */

    const examsUrl =
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CBT_Exams`;

    const examsResponse = await fetch(examsUrl, {
      headers
    });

    if (!examsResponse.ok) {
      const errorText = await examsResponse.text();

      return res.status(examsResponse.status).json({
        error: "Unable to load CBT Exams",
        details: errorText
      });
    }

    const examsData = await examsResponse.json();

    let selectedExam = null;

    for (const record of examsData.records || []) {
      const fields = record.fields || {};

      const airtableExamId =
        fields["Exam ID"] || "";

      if (
        String(examId) === String(record.id) ||
        String(examId) === String(airtableExamId)
      ) {
        selectedExam = record;
        break;
      }
    }

    if (!selectedExam) {
      return res.status(404).json({
        error: "Exam not found",
        examId
      });
    }

    const examFields =
      selectedExam.fields || {};

    const linkedQuestions =
      examFields["CBT_Questions"] || [];

    console.log("================================");
    console.log("EXAM FOUND");
    console.log("Exam record:", selectedExam.id);
    console.log(
      "Exam ID:",
      examFields["Exam ID"]
    );
    console.log(
      "Linked question count:",
      Array.isArray(linkedQuestions)
        ? linkedQuestions.length
        : 0
    );
    console.log("================================");


    /* =====================================================
       2. CHECK LINKED QUESTIONS
       ===================================================== */

    if (
      !Array.isArray(linkedQuestions) ||
      linkedQuestions.length === 0
    ) {
      return res.status(200).json([]);
    }


    /* =====================================================
       3. LOAD CBT QUESTIONS
       ===================================================== */

    let allQuestions = [];

    let offset = null;

    do {

      let questionsUrl =
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/CBT_Questions`;

      if (offset) {
        questionsUrl +=
          `?offset=${encodeURIComponent(offset)}`;
      }

      const questionsResponse =
        await fetch(questionsUrl, {
          headers
        });

      if (!questionsResponse.ok) {
        const errorText =
          await questionsResponse.text();

        return res.status(
          questionsResponse.status
        ).json({
          error: "Unable to load CBT Questions",
          details: errorText
        });
      }

      const questionsData =
        await questionsResponse.json();

      allQuestions.push(
        ...(questionsData.records || [])
      );

      offset =
        questionsData.offset || null;

    } while (offset);


    /* =====================================================
       4. GET QUESTION RECORD IDs FROM EXAM
       ===================================================== */

    const linkedQuestionIds =
      linkedQuestions.map(item => {

        if (typeof item === "string") {
          return item;
        }

        if (item && item.id) {
          return item.id;
        }

        return null;

      }).filter(Boolean);


    console.log(
      "Linked question IDs:",
      linkedQuestionIds
    );


    /* =====================================================
       5. MATCH QUESTIONS
       ===================================================== */

    const matchedRecords =
      allQuestions.filter(record => {

        return linkedQuestionIds.includes(
          record.id
        );

      });


    console.log(
      "Questions actually found:",
      matchedRecords.length
    );


    /* =====================================================
       6. CONVERT TO CBT FORMAT
       ===================================================== */

    const questions =
      matchedRecords.map(record => {

        const f =
          record.fields || {};

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


    /* =====================================================
       7. RETURN ARRAY TO REACT APP
       ===================================================== */

    return res.status(200).json(
      questions
    );

  } catch (error) {

    console.error(
      "CBT Questions API Error:",
      error
    );

    return res.status(500).json({
      error: "Failed to load CBT questions",
      details: error.message
    });
  }
}
