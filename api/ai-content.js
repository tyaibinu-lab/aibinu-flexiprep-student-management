// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// AI CONTENT API
// api/ai-content.js
//
// Handles:
//   1. AI Note generation
//   2. AI Question generation
//   3. Airtable AI_Content_Jobs logging
//   4. NoteBank_Notes creation
//   5. CBT_Questions creation
//
// IMPORTANT:
// This file is matched to the VERIFIED Airtable schema.
// ============================================================

const express = require("express");
const router = express.Router();

// ------------------------------------------------------------
// ENVIRONMENT VARIABLES
// ------------------------------------------------------------

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Verified Airtable table IDs
const TABLES = {
  AI_JOBS: "tbldFSYwYcTMtMm9A",
  NOTES: "tblsEjHgHA7vhPgm0",
  QUESTIONS: "tblWz5hU4tpVvMJbF",
};

// OpenAI model
const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";

// ------------------------------------------------------------
// BASIC VALIDATION
// ------------------------------------------------------------

function requireConfig() {
  const missing = [];

  if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!AIRTABLE_TOKEN) missing.push("AIRTABLE_TOKEN");
  if (!AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");

  if (missing.length) {
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}`
    );
  }
}

// ------------------------------------------------------------
// AIRTABLE API HELPER
// ------------------------------------------------------------

async function airtableRequest(tableId, method = "GET", body = null) {
  requireConfig();

  const url =
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    console.error("Airtable error:", data);

    throw new Error(
      data?.error?.message ||
      data?.error?.type ||
      `Airtable request failed (${response.status})`
    );
  }

  return data;
}

// ------------------------------------------------------------
// CREATE AIRTABLE RECORD
// ------------------------------------------------------------

async function createAirtableRecord(tableId, fields) {
  return airtableRequest(tableId, "POST", {
    records: [
      {
        fields,
      },
    ],
  });
}

// ------------------------------------------------------------
// OPENAI HELPER
// ------------------------------------------------------------

async function callOpenAI(systemPrompt, userPrompt) {
  requireConfig();

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,

        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: systemPrompt,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: userPrompt,
              },
            ],
          },
        ],

        temperature: 0.7,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("OpenAI error:", data);

    throw new Error(
      data?.error?.message ||
      `OpenAI request failed (${response.status})`
    );
  }

  // Responses API normally exposes output_text.
  if (data.output_text) {
    return data.output_text;
  }

  // Fallback extraction
  let text = "";

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (content.type === "output_text") {
          text += content.text || "";
        }
      }
    }
  }

  if (!text.trim()) {
    throw new Error("OpenAI returned no usable text.");
  }

  return text.trim();
}

// ------------------------------------------------------------
// JSON EXTRACTION
// ------------------------------------------------------------

function extractJSON(text) {
  if (!text) {
    throw new Error("Empty AI response.");
  }

  // Remove markdown fences
  let cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Direct JSON
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // continue
  }

  // Find first JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    const possibleJSON = cleaned.slice(
      firstBrace,
      lastBrace + 1
    );

    try {
      return JSON.parse(possibleJSON);
    } catch (_) {
      // continue
    }
  }

  throw new Error(
    "The AI response was not valid JSON."
  );
}

// ------------------------------------------------------------
// NORMALIZATION HELPERS
// ------------------------------------------------------------

function clean(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeBloom(value) {
  const valid = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ];

  const found = valid.find(
    item =>
      item.toLowerCase() ===
      clean(value).toLowerCase()
  );

  return found || "Understand";
}

function normalizeDifficulty(value) {
  const valid = [
    "Easy",
    "Medium",
    "Hard",
  ];

  const found = valid.find(
    item =>
      item.toLowerCase() ===
      clean(value).toLowerCase()
  );

  return found || "Medium";
}

function normalizeQuestionType(value) {
  const valid = [
    "MCQ",
    "Theory",
    "Calculation",
    "Practical",
    "Objective",
  ];

  const found = valid.find(
    item =>
      item.toLowerCase() ===
      clean(value).toLowerCase()
  );

  return found || "MCQ";
}

function normalizeQuestionStatus(value) {
  const valid = [
    "Draft",
    "Active",
    "Archived",
  ];

  const found = valid.find(
    item =>
      item.toLowerCase() ===
      clean(value).toLowerCase()
  );

  return found || "Draft";
}

function normalizePublicationStatus(value) {
  const valid = [
    "Draft",
    "Under Review",
    "Approved",
    "Published",
    "Archived",
  ];

  const found = valid.find(
    item =>
      item.toLowerCase() ===
      clean(value).toLowerCase()
  );

  return found || "Draft";
}

function normalizeExamTypes(value) {
  if (!value) return ["General"];

  const valid = [
    "WAEC",
    "NECO",
    "UTME",
    "General",
    "IJMB",
    "JUPEB",
  ];

  let values = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map(x => x.trim());

  values = values.filter(x =>
    valid.some(
      v => v.toLowerCase() === x.toLowerCase()
    )
  );

  return values.length ? values : ["General"];
}

// ------------------------------------------------------------
// AI JOB LOGGER
// ------------------------------------------------------------

async function logAIJob({
  requestedBy,
  contentType,
  subjectId,
  topicId,
  classId,
  prompt,
  aiOutput,
  status,
}) {
  try {
    const fields = {
      "AI Job ID":
        `AI-${Date.now()}-${Math.floor(
          Math.random() * 1000
        )}`,

      "Content Type": contentType,

      "Prompt": prompt,

      "AI Output": aiOutput,

      "Model": OPENAI_MODEL,

      "Status": status || "Generated",

      "Created Date": new Date().toISOString(),
    };

    // These are LINKED RECORD fields.
    // Only add them when actual Airtable record IDs
    // have been supplied by the frontend.

    if (requestedBy) {
      fields["Requested By"] = [
        requestedBy,
      ];
    }

    if (subjectId) {
      fields["Subject"] = [
        subjectId,
      ];
    }

    if (topicId) {
      fields["Topic"] = [
        topicId,
      ];
    }

    if (classId) {
      fields["Class"] = [
        classId,
      ];
    }

    return await createAirtableRecord(
      TABLES.AI_JOBS,
      fields
    );
  } catch (error) {
    // Logging must not destroy the main AI operation.
    console.error(
      "AI job logging failed:",
      error.message
    );

    return null;
  }
}

// ============================================================
// NOTE GENERATION
// ============================================================

router.post("/generate-note", async (req, res) => {
  try {
    requireConfig();

    const {
      subject,
      subjectId,
      topic,
      topicId,
      className,
      classId,
      programme,
      examTypes,
      requestedBy,
    } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        error: "Subject is required.",
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: "Topic is required.",
      });
    }

    const prompt = `
Create a high-quality Nigerian secondary-school examination
study note.

Institution:
AIBINU FLEXIPREP EDUCONSULT

Subject:
${subject}

Topic:
${topic}

Class:
${className || "SS1"}

Programme:
${programme || "General"}

Exam focus:
${Array.isArray(examTypes)
  ? examTypes.join(", ")
  : examTypes || "WAEC, NECO, UTME"}

The note must be suitable for serious examination preparation.

Include:

1. Title
2. Learning objectives
3. Introduction
4. Detailed explanation
5. Key terms
6. Examples
7. Worked examples where applicable
8. Summary
9. Examination tips
10. WAEC focus
11. NECO focus
12. UTME focus

Use clear teaching language.
Use correct scientific terminology.
Use equations where necessary.
Use practical examples where appropriate.

Return ONLY valid JSON using exactly this structure:

{
  "title": "",
  "learningObjectives": "",
  "keyTerms": "",
  "content": "",
  "examples": "",
  "workedExamples": "",
  "summary": "",
  "examTips": "",
  "waecFocus": "",
  "necoFocus": "",
  "utmeFocus": ""
}
`;

    const aiOutput = await callOpenAI(
      `
You are an expert Nigerian secondary-school
curriculum writer and examination-preparation specialist.

You produce accurate WAEC, NECO and UTME-aligned
educational content.

Never invent examination requirements.
Never include commentary outside the requested JSON.
`,
      prompt
    );

    const note = extractJSON(aiOutput);

    const noteId =
      `NOTE-${Date.now()}`;

    // --------------------------------------------------------
    // CREATE NOTE
    // --------------------------------------------------------

    const noteFields = {
      "Note ID": noteId,

      "Title":
        clean(note.title) ||
        `${subject}: ${topic}`,

      "Content":
        clean(note.content),

      "Learning Objectives":
        clean(note.learningObjectives),

      "Key Terms":
        clean(note.keyTerms),

      "Examples":
        clean(note.examples),

      "Worked Examples":
        clean(note.workedExamples),

      "Summary":
        clean(note.summary),

      "Exam Tips":
        clean(note.examTips),

      "WAEC Focus":
        clean(note.waecFocus),

      "NECO Focus":
        clean(note.necoFocus),

      "UTME Focus":
        clean(note.utmeFocus),

      "Version": "1.0",

      // VERIFIED NoteBank status
      "Status": "AI Draft",

      "Created Date":
        new Date().toISOString(),

      "Updated Date":
        new Date().toISOString(),
    };

    // Topic is a LINKED RECORD field.
    if (topicId) {
      noteFields["Topic"] = [
        topicId,
      ];
    }

    // Created By is a LINKED RECORD field.
    if (requestedBy) {
      noteFields["Created By"] = [
        requestedBy,
      ];
    }

    const createdNote =
      await createAirtableRecord(
        TABLES.NOTES,
        noteFields
      );

    // --------------------------------------------------------
    // LOG AI JOB
    // --------------------------------------------------------

    await logAIJob({
      requestedBy,
      contentType: "Note",
      subjectId,
      topicId,
      classId,
      prompt,
      aiOutput,
      status: "Generated",
    });

    return res.json({
      success: true,
      message:
        "AI note generated successfully.",
      note: {
        id:
          createdNote?.records?.[0]?.id ||
          null,
        ...note,
        status: "AI Draft",
      },
    });

  } catch (error) {
    console.error(
      "NOTE GENERATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to generate note.",
    });
  }
});

// ============================================================
// QUESTION GENERATION
// ============================================================

router.post("/generate-question", async (req, res) => {
  try {
    requireConfig();

    const {
      subject,
      subjectId,
      topic,
      className,
      classId,
      programme,
      examTypes,
      questionType,
      difficulty,
      bloomLevel,
      source,
      year,
      marks,
      requestedBy,
    } = req.body;

    if (!subject) {
      return res.status(400).json({
        success: false,
        error: "Subject is required.",
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: "Topic is required.",
      });
    }

    const requestedQuestionType =
      normalizeQuestionType(
        questionType || "MCQ"
      );

    const requestedDifficulty =
      normalizeDifficulty(
        difficulty || "Medium"
      );

    const requestedBloom =
      normalizeBloom(
        bloomLevel || "Apply"
      );

    const prompt = `
Generate ONE high-quality Nigerian secondary-school
examination question.

Institution:
AIBINU FLEXIPREP EDUCONSULT

Subject:
${subject}

Topic:
${topic}

Class:
${className || "SS1"}

Programme:
${programme || "General"}

Exam Type:
${Array.isArray(examTypes)
  ? examTypes.join(", ")
  : examTypes || "WAEC, NECO, UTME"}

Question Type:
${requestedQuestionType}

Difficulty:
${requestedDifficulty}

Bloom Level:
${requestedBloom}

The question must be academically sound and appropriate
for the specified class and examination level.

For an MCQ:

- Provide four options.
- Exactly one option must be correct.
- Do not use "All of the above".
- Do not use "None of the above".
- Make distractors plausible.
- Ensure the answer key matches the correct option.
- Provide a clear explanation.

Return ONLY valid JSON.

For MCQ use exactly:

{
  "question": "",
  "optionA": "",
  "optionB": "",
  "optionC": "",
  "optionD": "",
  "correctAnswer": "A",
  "bloomLevel": "${requestedBloom}",
  "difficulty": "${requestedDifficulty}",
  "explanation": "",
  "questionType": "MCQ",
  "marks": 1,
  "source": "",
  "year": 2026
}
`;

    const aiOutput = await callOpenAI(
      `
You are an expert WAEC, NECO and UTME examination
question setter.

You specialize in Nigerian secondary-school Physics,
Chemistry, Biology, Mathematics and related subjects.

Accuracy is more important than creativity.

Return ONLY the requested JSON.
`,
      prompt
    );

    const question = extractJSON(aiOutput);

    // --------------------------------------------------------
    // VALIDATE CORRECT ANSWER
    // --------------------------------------------------------

    const correctAnswer =
      clean(question.correctAnswer)
        .toUpperCase();

    const validAnswers = [
      "A",
      "B",
      "C",
      "D",
    ];

    if (
      !validAnswers.includes(
        correctAnswer
      )
    ) {
      throw new Error(
        `Invalid correct answer returned by AI: ${correctAnswer}`
      );
    }

    // --------------------------------------------------------
    // QUESTION ID
    // --------------------------------------------------------

    const questionId =
      `Q-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;

    // --------------------------------------------------------
    // CREATE CBT QUESTION
    // --------------------------------------------------------

    const questionFields = {
      "Question ID":
        questionId,

      "Topic":
        clean(topic),

      "Question":
        clean(question.question),

      "Option A":
        clean(question.optionA),

      "Option B":
        clean(question.optionB),

      "Option C":
        clean(question.optionC),

      "Option D":
        clean(question.optionD),

      "Correct Answer":
        correctAnswer,

      "Bloom Level":
        normalizeBloom(
          question.bloomLevel ||
          requestedBloom
        ),

      "Difficulty":
        normalizeDifficulty(
          question.difficulty ||
          requestedDifficulty
        ),

      "Explanation":
        clean(question.explanation),

      // VERIFIED CBT_Questions.Status choices:
      // Draft / Active / Archived
      "Status":
        "Draft",

      // VERIFIED Publication Status choices:
      // Draft / Under Review / Approved / Published / Archived
      "Publication Status":
        "Draft",

      "Question Type":
        normalizeQuestionType(
          question.questionType ||
          requestedQuestionType
        ),

      "Programme":
        programme ||
        "General",

      "Marks":
        Number(
          question.marks ||
          marks ||
          1
        ),

      "Source":
        clean(
          question.source ||
          source ||
          "AI Generated"
        ),

      "Year":
        Number(
          question.year ||
          year ||
          2026
        ),
    };

    // --------------------------------------------------------
    // LINK SUBJECT
    // --------------------------------------------------------

    if (subjectId) {
      questionFields["Subject"] = [
        subjectId,
      ];
    }

    // --------------------------------------------------------
    // LINK CLASS
    // --------------------------------------------------------

    if (classId) {
      questionFields["Class"] = [
        classId,
      ];
    }

    // --------------------------------------------------------
    // LINK CREATOR
    // --------------------------------------------------------

    if (requestedBy) {
      questionFields["Created By"] = [
        requestedBy,
      ];
    }

    // --------------------------------------------------------
    // EXAM TYPE
    // --------------------------------------------------------

    questionFields["Exam Type"] =
      normalizeExamTypes(examTypes);

    const createdQuestion =
      await createAirtableRecord(
        TABLES.QUESTIONS,
        questionFields
      );

    // --------------------------------------------------------
    // LOG AI JOB
    // --------------------------------------------------------

    await logAIJob({
      requestedBy,
      contentType: "Question",
      subjectId,
      topicId: null,
      classId,
      prompt,
      aiOutput,
      status: "Generated",
    });

    return res.json({
      success: true,

      message:
        "AI question generated successfully.",

      question: {
        id:
          createdQuestion?.records?.[0]?.id ||
          null,

        questionId,

        ...question,

        correctAnswer,

        status: "Draft",

        publicationStatus: "Draft",
      },
    });

  } catch (error) {
    console.error(
      "QUESTION GENERATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to generate question.",
    });
  }
});

// ============================================================
// HEALTH CHECK
// ============================================================

router.get("/health", (req, res) => {
  res.json({
    success: true,
    service:
      "AIBINU Flexiprep AI Content API",
    model: OPENAI_MODEL,
    airtableConfigured:
      Boolean(AIRTABLE_TOKEN),
    baseConfigured:
      Boolean(AIRTABLE_BASE_ID),
  });
});

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
