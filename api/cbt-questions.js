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

      const airtableRecordId = record.id;

      const airtableExamId =
        fields["Exam ID"] || "";

      if (
        String(examId) === String(airtableRecordId) ||
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

    const selectedExamRecordId =
      selectedExam.id;

    const selectedExamId =
      selectedExam.fields?.["Exam ID"] || "";

    console.log(
      "CBT Exam Record:",
      selectedExamRecordId
    );

    console.log(
      "CBT Exam ID:",
      selectedExamId
    );


    /* =====================================================
       2. LOAD ALL CBT QUESTIONS
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


    console.log(
      "Total CBT Questions:",
      allQuestions.length
    );


    /* =====================================================
       3. FIND QUESTIONS LINKED TO THIS EXAM
       ===================================================== */

    const matchedRecords =
      allQuestions.filter(record => {

        const fields =
          record.fields || {};

        /*
          Primary linked field:
          CBT Exam
        */

        const linkedExam =
          fields["CBT Exam"];

        if (Array.isArray(linkedExam)) {

          return linkedExam.some(
            linkedId =>
              String(linkedId) ===
              String(selectedExamRecordId)
          );

        }

        /*
          Fallback if Airtable gives
          the linked field as text.
        */

        if (linkedExam) {

          return (
            String(linkedExam) ===
              String(selectedExamRecordId) ||
            String(linkedExam) ===
              String(selectedExamId)
          );

        }

        return false;

      });


    console.log(
      "Questions linked to exam:",
      matchedRecords.length
    );


    /* =====================================================
       4. CONVERT AIRTABLE QUESTIONS
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

            f["Option A"] ||
              "",

            f["Option B"] ||
              "",

            f["Option C"] ||
              "",

            f["Option D"] ||
              ""

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
       5. CHECK QUESTION COUNT
       ===================================================== */

    console.log(
      "Final questions sent to CBT:",
      questions.length
    );


    /* =====================================================
       IMPORTANT
       
       The React application expects an ARRAY,
       NOT an object containing the array.
       ===================================================== */

    return res.status(200).json(questions);


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
