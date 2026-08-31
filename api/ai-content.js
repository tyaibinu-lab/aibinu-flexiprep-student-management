// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// AI CONTENT API
// File: api/ai-content.js
//
// Vercel Serverless Function
//
// Endpoint:
// POST /api/ai-content
//
// Supports:
//   1. AI Note generation
//   2. AI Question generation
//   3. Multiple question generation
//   4. Mixed Difficulty
//   5. Mixed Bloom Level
//   6. Airtable AI job logging
//   7. NoteBank draft creation
//   8. CBT Question draft creation
//
// Environment variables:
//   OPENAI_API_KEY
//   OPENAI_MODEL
//   AIRTABLE_PAT
//   AIRTABLE_BASE_ID
// ============================================================

const AIRTABLE_API =
  "https://api.airtable.com/v0";

const OPENAI_API =
  "https://api.openai.com/v1/responses";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";


// ============================================================
// VERIFIED AIRTABLE TABLE IDs
// ============================================================

const TABLES = {
  AI_JOBS: "tbldFSYwYcTMtMm9A",
  NOTES: "tblsEjHgHA7vhPgm0",
  QUESTIONS: "tblWz5hU4tpVvMJbF"
};


// ============================================================
// VERCEL HANDLER
// ============================================================

export default async function handler(req, res) {

  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );


  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  // ----------------------------------------------------------
  // HEALTH CHECK
  // ----------------------------------------------------------

  if (req.method === "GET") {

    return res.status(200).json({
      success: true,
      service:
        "AIBINU Flexiprep AI Content API",
      model: OPENAI_MODEL,
      airtableConfigured:
        Boolean(process.env.AIRTABLE_PAT),
      baseConfigured:
        Boolean(process.env.AIRTABLE_BASE_ID),
      openaiConfigured:
        Boolean(process.env.OPENAI_API_KEY)
    });

  }


  // ----------------------------------------------------------
  // ONLY POST
  // ----------------------------------------------------------

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });

  }


  try {

    const config = getConfig();

    const body =
      req.body || {};


    const contentType =
      clean(
        body.contentType ||
        body.type ||
        body.mode
      ).toLowerCase();


    // --------------------------------------------------------
    // NOTE
    // --------------------------------------------------------

    if (
      contentType === "note" ||
      contentType === "notes" ||
      contentType === "generate-note"
    ) {

      const result =
        await generateNote(
          config,
          body
        );

      return res.status(200).json({
        success: true,
        ...result
      });

    }


    // --------------------------------------------------------
    // QUESTION
    // --------------------------------------------------------

    if (
      contentType === "question" ||
      contentType === "questions" ||
      contentType === "generate-question"
    ) {

      const result =
        await generateQuestions(
          config,
          body
        );

      return res.status(200).json({
        success: true,
        ...result
      });

    }


    return res.status(400).json({
      success: false,
      error:
        "Invalid contentType. Use Note or Question."
    });


  } catch (error) {

    console.error(
      "AI CONTENT API ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "AI content generation failed."

    });

  }

};


// ============================================================
// ENVIRONMENT
// ============================================================

function getConfig() {

  const config = {

    openaiKey:
      process.env.OPENAI_API_KEY,

    airtablePat:
      process.env.AIRTABLE_PAT,

    airtableBaseId:
      process.env.AIRTABLE_BASE_ID

  };


  const missing = [];


  if (!config.openaiKey) {

    missing.push(
      "OPENAI_API_KEY"
    );

  }


  if (!config.airtablePat) {

    missing.push(
      "AIRTABLE_PAT"
    );

  }


  if (!config.airtableBaseId) {

    missing.push(
      "AIRTABLE_BASE_ID"
    );

  }


  if (missing.length) {

    throw new Error(
      `Missing environment variables: ${missing.join(", ")}`
    );

  }


  return config;

}


// ============================================================
// BASIC HELPERS
// ============================================================

function clean(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }

  return String(value).trim();

}


function makeId(prefix) {

  return (
    `${prefix}-${Date.now()}-` +
    `${Math.floor(Math.random() * 100000)}`
  );

}


// ============================================================
// NORMALIZATION
// ============================================================

function normalizeDifficulty(value) {

  const valid = [
    "Easy",
    "Medium",
    "Hard"
  ];


  const found =
    valid.find(
      item =>
        item.toLowerCase() ===
        clean(value).toLowerCase()
    );


  return found || "Medium";

}


function normalizeBloom(value) {

  const valid = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create"
  ];


  const found =
    valid.find(
      item =>
        item.toLowerCase() ===
        clean(value).toLowerCase()
    );


  return found || "Understand";

}


function normalizeQuestionType(value) {

  const valid = [
    "MCQ",
    "Theory",
    "Calculation",
    "Practical",
    "Objective"
  ];


  const found =
    valid.find(
      item =>
        item.toLowerCase() ===
        clean(value).toLowerCase()
    );


  return found || "MCQ";

}


function normalizeExamTypes(value) {

  const valid = [
    "WAEC",
    "NECO",
    "UTME",
    "General",
    "IJMB",
    "JUPEB"
  ];


  let values;


  if (Array.isArray(value)) {

    values = value;

  } else {

    values =
      clean(value)
        .split(",")
        .map(
          item =>
            item.trim()
        );

  }


  const result =
    values.filter(
      item =>
        valid.some(
          validItem =>
            validItem.toLowerCase() ===
            String(item).toLowerCase()
        )
    );


  return result.length
    ? result
    : ["General"];

}


// ============================================================
// MIXED DISTRIBUTION
// ============================================================

function createBalancedList(
  count,
  values
) {

  const result = [];


  for (
    let i = 0;
    i < count;
    i++
  ) {

    result.push(
      values[
        i % values.length
      ]
    );

  }


  // Shuffle so the questions
  // do not appear in obvious order.

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );


    [
      result[i],
      result[j]
    ] = [
      result[j],
      result[i]
    ];

  }


  return result;

}


function getDifficultyList(
  count,
  difficulty
) {

  const value =
    clean(difficulty);


  if (
    !value ||
    value.toLowerCase() !==
    "mixed"
  ) {

    return Array(
      count
    ).fill(
      normalizeDifficulty(
        value || "Medium"
      )
    );

  }


  return createBalancedList(
    count,
    [
      "Easy",
      "Medium",
      "Hard"
    ]
  );

}


function getBloomList(
  count,
  bloom
) {

  const value =
    clean(bloom);


  if (
    !value ||
    value.toLowerCase() !==
    "mixed"
  ) {

    return Array(
      count
    ).fill(
      normalizeBloom(
        value || "Apply"
      )
    );

  }


  return createBalancedList(
    count,
    [
      "Remember",
      "Understand",
      "Apply",
      "Analyze",
      "Evaluate",
      "Create"
    ]
  );

}


// ============================================================
// AIRTABLE REQUEST
// ============================================================

async function airtableRequest(
  config,
  tableId,
  method,
  body
) {

  const url =
    `${AIRTABLE_API}/` +
    `${config.airtableBaseId}/` +
    `${tableId}`;


  const options = {

    method,

    headers: {

      Authorization:
        `Bearer ${config.airtablePat}`,

      "Content-Type":
        "application/json"

    }

  };


  if (body !== undefined) {

    options.body =
      JSON.stringify(body);

  }


  const response =
    await fetch(
      url,
      options
    );


  const text =
    await response.text();


  let data;


  try {

    data =
      JSON.parse(text);

  } catch {

    data = {
      raw: text
    };

  }


  if (!response.ok) {

    console.error(
      "AIRTABLE ERROR:",
      data
    );


    throw new Error(

      data?.error?.message ||

      data?.error?.type ||

      `Airtable error ${response.status}`

    );

  }


  return data;

}


// ============================================================
// CREATE ONE RECORD
// ============================================================

async function createRecord(
  config,
  tableId,
  fields
) {

  return airtableRequest(

    config,

    tableId,

    "POST",

    {

      records: [

        {
          fields
        }

      ],

      typecast: true

    }

  );

}


// ============================================================
// CREATE MANY RECORDS
// Airtable maximum = 10 records/request
// ============================================================

async function createManyRecords(
  config,
  tableId,
  records
) {

  const created = [];


  for (
    let i = 0;
    i < records.length;
    i += 10
  ) {

    const chunk =
      records.slice(
        i,
        i + 10
      );


    const result =
      await airtableRequest(

        config,

        tableId,

        "POST",

        {

          records:
            chunk.map(
              fields => ({
                fields
              })
            ),

          typecast: true

        }

      );


    if (
      Array.isArray(
        result.records
      )
    ) {

      created.push(
        ...result.records
      );

    }

  }


  return created;

}


// ============================================================
// OPENAI RESPONSES API
// ============================================================

async function callOpenAI(
  config,
  instructions,
  input
) {

  const response =
    await fetch(

      OPENAI_API,

      {

        method: "POST",

        headers: {

          Authorization:
            `Bearer ${config.openaiKey}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            model:
              OPENAI_MODEL,

            store:
              false,

            instructions,

            input,

            text: {

              format: {

                type:
                  "json_object"

              }

            }

          })

      }

    );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "OPENAI ERROR:",
      data
    );


    throw new Error(

      data?.error?.message ||

      `OpenAI error ${response.status}`

    );

  }


  if (
    data.output_text
  ) {

    return data.output_text;

  }


  let output = "";


  if (
    Array.isArray(
      data.output
    )
  ) {

    for (
      const item
      of data.output
    ) {

      if (
        !Array.isArray(
          item.content
        )
      ) {

        continue;

      }


      for (
        const content
        of item.content
      ) {

        if (
          content.type ===
          "output_text"
        ) {

          output +=
            content.text || "";

        }

      }

    }

  }


  if (!output.trim()) {

    throw new Error(
      "OpenAI returned no usable output."
    );

  }


  return output.trim();

}


// ============================================================
// PARSE AI JSON
// ============================================================

function parseAIJSON(text) {

  const cleaned =
    clean(text)
      .replace(
        /^```json/i,
        ""
      )
      .replace(
        /^```/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim();


  try {

    return JSON.parse(
      cleaned
    );

  } catch (_) {

    // Continue.

  }


  const first =
    cleaned.indexOf("{");


  const last =
    cleaned.lastIndexOf("}");


  if (
    first !== -1 &&
    last !== -1 &&
    last > first
  ) {

    try {

      return JSON.parse(
        cleaned.slice(
          first,
          last + 1
        )
      );

    } catch (_) {

      // Continue.

    }

  }


  throw new Error(
    "AI returned invalid JSON."
  );

}


// ============================================================
// LOG AI JOB
// ============================================================

async function logAIJob(
  config,
  data
) {

  try {

    const fields = {

      "AI Job ID":
        makeId("AI"),

      "Content Type":
        data.contentType,

      "Prompt":
        clean(data.prompt),

      "AI Output":
        clean(data.aiOutput),

      "Model":
        OPENAI_MODEL,

      "Status":
        "Generated",

      "Created Date":
        new Date().toISOString()

    };


    if (
      data.requestedBy
    ) {

      fields["Requested By"] =
        [data.requestedBy];

    }


    if (
      data.subjectId
    ) {

      fields["Subject"] =
        [data.subjectId];

    }


    if (
      data.topicId
    ) {

      fields["Topic"] =
        [data.topicId];

    }


    if (
      data.classId
    ) {

      fields["Class"] =
        [data.classId];

    }


    return await createRecord(

      config,

      TABLES.AI_JOBS,

      fields

    );

  } catch (error) {

    console.error(
      "AI JOB LOGGING ERROR:",
      error.message
    );


    // Logging failure must not
    // destroy generated content.

    return null;

  }

}


// ============================================================
// GENERATE NOTE
// ============================================================

async function generateNote(
  config,
  body
) {

  const subject =
    clean(body.subject);

  const subjectId =
    clean(body.subjectId);

  const topic =
    clean(body.topic);

  const topicId =
    clean(body.topicId);

  const className =
    clean(body.className) ||
    "SS1";

  const classId =
    clean(body.classId);

  const programme =
    clean(body.programme) ||
    "General";

  const requestedBy =
    clean(body.requestedBy);

  const teacherPrompt =
    clean(
      body.teacherPrompt ||
      body.prompt
    );

  const examTypes =
    normalizeExamTypes(
      body.examTypes
    );


  if (!subject) {

    throw new Error(
      "Subject is required."
    );

  }


  if (!topic) {

    throw new Error(
      "Topic is required."
    );

  }


  if (!teacherPrompt) {

    throw new Error(
      "Teacher prompt is required."
    );

  }


  const instructions = `

You are the official AI academic
content assistant for
AIBINU FLEXIPREP EDUCONSULT.

You assist qualified teachers
in preparing examination content.

The TEACHER'S PROMPT is the
PRIMARY instruction.

Target students:

Nigerian secondary-school students.

Standards:

WAEC
NECO
UTME

where applicable.

Content must be:

- Accurate
- Clear
- Engaging
- Examination-oriented
- Age appropriate
- Scientifically correct
- Mathematically correct where applicable
- Well structured

Do not claim that the material
has been teacher-approved.

Do not claim that it has been
published.

Return ONLY valid JSON.

`;


  const input = `

INSTITUTION:
AIBINU FLEXIPREP EDUCONSULT

SUBJECT:
${subject}

CLASS:
${className}

PROGRAMME:
${programme}

TOPIC:
${topic}

EXAMINATION FOCUS:
${examTypes.join(", ")}

TEACHER'S PROMPT:
${teacherPrompt}


Create a comprehensive examination
study note.

The note must contain:

1. Strong title
2. Learning objectives
3. Introduction
4. Detailed teaching content
5. Key terms
6. Examples
7. Worked examples where applicable
8. Summary
9. Examination tips
10. WAEC focus
11. NECO focus
12. UTME focus


Return exactly:

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


  const aiText =
    await callOpenAI(
      config,
      instructions,
      input
    );


  const note =
    parseAIJSON(
      aiText
    );


  const now =
    new Date().toISOString();


  const fields = {

    "Note ID":
      makeId("NOTE"),

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

    "Version":
      "1.0",

    "Status":
      "AI Draft",

    "Created Date":
      now,

    "Updated Date":
      now

  };


  // Linked Topic

  if (topicId) {

    fields["Topic"] =
      [topicId];

  }


  // Linked Created By

  if (requestedBy) {

    fields["Created By"] =
      [requestedBy];

  }


  const createdNote =
    await createRecord(

      config,

      TABLES.NOTES,

      fields

    );


  await logAIJob(

    config,

    {

      requestedBy,

      contentType:
        "Note",

      subjectId,

      topicId,

      classId,

      prompt:
        teacherPrompt,

      aiOutput:
        aiText

    }

  );


  return {

    message:
      "AI note generated successfully.",

    note: {

      id:
        createdNote
          ?.records
          ?.at(0)
          ?.id || null,

      ...note,

      status:
        "AI Draft"

    }

  };

}


// ============================================================
// GENERATE QUESTIONS
// ============================================================

async function generateQuestions(
  config,
  body
) {

  const subject =
    clean(body.subject);

  const subjectId =
    clean(body.subjectId);

  const topic =
    clean(body.topic);

  const className =
    clean(body.className) ||
    "SS1";

  const classId =
    clean(body.classId);

  const programme =
    clean(body.programme) ||
    "General";

  const requestedBy =
    clean(body.requestedBy);

  const teacherPrompt =
    clean(
      body.teacherPrompt ||
      body.prompt
    );

  const examTypes =
    normalizeExamTypes(
      body.examTypes
    );


  const count =
    Math.max(
      1,
      Math.min(
        100,
        Number(
          body.numberOfQuestions ||
          body.numberQuestions ||
          body.count ||
          1
        )
      )
    );


  const difficulty =
    clean(
      body.difficulty ||
      "Medium"
    );


  const bloomLevel =
    clean(
      body.bloomLevel ||
      "Apply"
    );


  const questionType =
    normalizeQuestionType(
      body.questionType ||
      "MCQ"
    );


  const source =
    clean(
      body.source ||
      "AI Generated"
    );


  const year =
    Number(
      body.year ||
      2026
    );


  const marks =
    Number(
      body.marks ||
      1
    );


  if (!subject) {

    throw new Error(
      "Subject is required."
    );

  }


  if (!topic) {

    throw new Error(
      "Topic is required."
    );

  }


  if (!teacherPrompt) {

    throw new Error(
      "Teacher prompt is required."
    );

  }


  // ----------------------------------------------------------
  // CREATE ACTUAL ASSIGNMENTS
  // ----------------------------------------------------------

  const difficultyList =
    getDifficultyList(
      count,
      difficulty
    );


  const bloomList =
    getBloomList(
      count,
      bloomLevel
    );


  // ----------------------------------------------------------
  // GENERATE IN BATCHES
  //
  // This prevents extremely large
  // OpenAI responses.
  // ----------------------------------------------------------

  const generatedQuestions = [];

  const allPrompts = [];


  for (
    let start = 0;
    start < count;
    start += 10
  ) {

    const batchEnd =
      Math.min(
        start + 10,
        count
      );


    const batchSize =
      batchEnd - start;


    const batchAssignments =
      [];


    for (
      let i = 0;
      i < batchSize;
      i++
    ) {

      const index =
        start + i;


      batchAssignments.push({

        number:
          index + 1,

        difficulty:
          difficultyList[index],

        bloomLevel:
          bloomList[index]

      });

    }


    const assignmentText =
      batchAssignments
        .map(
          item =>
            `Question ${item.number}: Difficulty=${item.difficulty}; Bloom=${item.bloomLevel}`
        )
        .join("\n");


    const instructions = `

You are an expert Nigerian
secondary-school examination
question setter.

Institution:

AIBINU FLEXIPREP EDUCONSULT

Standards:

WAEC
NECO
UTME

The teacher's prompt is important.

However, the backend assignment
for each question is FINAL.

You MUST obey the exact
difficulty and Bloom Level
specified for every question.

Do NOT substitute your own
difficulty.

Do NOT substitute your own
Bloom Level.

Return ONLY valid JSON.

`;


    const input = `

SUBJECT:
${subject}

CLASS:
${className}

PROGRAMME:
${programme}

TOPIC:
${topic}

EXAMINATION FOCUS:
${examTypes.join(", ")}

QUESTION TYPE:
${questionType}

TEACHER'S PROMPT:
${teacherPrompt}


GENERATE EXACTLY
${batchSize} QUESTIONS.


MANDATORY QUESTION ASSIGNMENTS:

${assignmentText}


For MCQ questions:

- Four options only.
- Option A
- Option B
- Option C
- Option D

Exactly ONE option must be correct.

Do NOT use:

"All of the above"

"None of the above"


Distractors must be plausible.

The correct answer must actually
match the question.

Provide a useful explanation.

Questions should be appropriate
for Nigerian secondary-school
students and the selected
examination focus.


Return this exact JSON structure:

{
  "questions": [
    {
      "question": "",
      "optionA": "",
      "optionB": "",
      "optionC": "",
      "optionD": "",
      "correctAnswer": "A",
      "bloomLevel": "",
      "difficulty": "",
      "explanation": "",
      "questionType": "MCQ",
      "marks": 1,
      "source": "",
      "year": 2026
    }
  ]
}

IMPORTANT:

Return exactly
${batchSize} question objects.

Preserve the order:

Question 1
Question 2
Question 3
...

`;


    const aiText =
      await callOpenAI(
        config,
        instructions,
        input
      );


    const parsed =
      parseAIJSON(
        aiText
      );


    if (
      !Array.isArray(
        parsed.questions
      )
    ) {

      throw new Error(
        "AI did not return a questions array."
      );

    }


    if (
      parsed.questions.length !==
      batchSize
    ) {

      throw new Error(

        `AI returned ${parsed.questions.length} questions instead of ${batchSize}.`

      );

    }


    for (
      let i = 0;
      i < parsed.questions.length;
      i++
    ) {

      const q =
        parsed.questions[i];


      const globalIndex =
        start + i;


      // ------------------------------------------------------
      // BACKEND VALUES ARE AUTHORITATIVE
      // ------------------------------------------------------

      q.difficulty =
        difficultyList[
          globalIndex
        ];


      q.bloomLevel =
        bloomList[
          globalIndex
        ];


      q.questionType =
        normalizeQuestionType(
          questionType
        );


      q.marks =
        Number(
          q.marks ||
          marks ||
          1
        );


      q.source =
        clean(
          q.source ||
          source
        );


      q.year =
        Number(
          q.year ||
          year
        );


      q.correctAnswer =
        clean(
          q.correctAnswer
        ).toUpperCase();


      // ------------------------------------------------------
      // VALIDATE ANSWER
      // ------------------------------------------------------

      if (
        ![
          "A",
          "B",
          "C",
          "D"
        ].includes(
          q.correctAnswer
        )
      ) {

        throw new Error(

          `Invalid correct answer in Question ${globalIndex + 1}.`

        );

      }


      // ------------------------------------------------------
      // VALIDATE QUESTION TEXT
      // ------------------------------------------------------

      if (
        !clean(q.question)
      ) {

        throw new Error(

          `Question ${globalIndex + 1} has no question text.`

        );

      }


      // ------------------------------------------------------
      // VALIDATE OPTIONS
      // ------------------------------------------------------

      if (
        !clean(q.optionA) ||
        !clean(q.optionB) ||
        !clean(q.optionC) ||
        !clean(q.optionD)
      ) {

        throw new Error(

          `Question ${globalIndex + 1} has incomplete options.`

        );

      }


      generatedQuestions.push(
        q
      );

    }


    allPrompts.push(
      input
    );

  }


  // ==========================================================
  // PREPARE AIRTABLE RECORDS
  // ==========================================================

  const airtableRecords =
    generatedQuestions.map(
      (question, index) => {

        const fields = {

          "Question ID":
            makeId("Q"),

          "Topic":
            topic,

          "Question":
            clean(
              question.question
            ),

          "Option A":
            clean(
              question.optionA
            ),

          "Option B":
            clean(
              question.optionB
            ),

          "Option C":
            clean(
              question.optionC
            ),

          "Option D":
            clean(
              question.optionD
            ),

          "Correct Answer":
            question.correctAnswer,

          "Bloom Level":
            normalizeBloom(
              question.bloomLevel
            ),

          "Difficulty":
            normalizeDifficulty(
              question.difficulty
            ),

          "Explanation":
            clean(
              question.explanation
            ),

          "Status":
            "Draft",

          "Publication Status":
            "Draft",

          "Question Type":
            normalizeQuestionType(
              question.questionType
            ),

          "Programme":
            programme,

          "Marks":
            Number(
              question.marks ||
              marks ||
              1
            ),

          "Source":
            clean(
              question.source ||
              source
            ),

          "Year":
            Number(
              question.year ||
              year
            ),

          "Exam Type":
            examTypes

        };


        // ------------------------------------------------------
        // LINK SUBJECT
        // ------------------------------------------------------

        if (subjectId) {

          fields["Subject"] =
            [subjectId];

        }


        // ------------------------------------------------------
        // LINK CLASS
        // ------------------------------------------------------

        if (classId) {

          fields["Class"] =
            [classId];

        }


        // ------------------------------------------------------
        // LINK CREATOR
        // ------------------------------------------------------

        if (requestedBy) {

          fields["Created By"] =
            [requestedBy];

        }


        return fields;

      }
    );


  // ==========================================================
  // SAVE QUESTIONS
  // ==========================================================

  const createdQuestions =
    await createManyRecords(

      config,

      TABLES.QUESTIONS,

      airtableRecords

    );


  // ==========================================================
  // LOG ONE AI JOB
  // ==========================================================

  await logAIJob(

    config,

    {

      requestedBy,

      contentType:
        "Question",

      subjectId,

      topicId:
        null,

      classId,

      prompt:
        teacherPrompt,

      aiOutput:
        JSON.stringify(
          generatedQuestions
        )

    }

  );


  // ==========================================================
  // RETURN
  // ==========================================================

  return {

    message:
      `${generatedQuestions.length} AI questions generated successfully.`,

    count:
      generatedQuestions.length,

    questions:
      generatedQuestions.map(
        (question, index) => ({

          id:
            createdQuestions[
              index
            ]?.id || null,

          questionId:
            airtableRecords[
              index
            ]["Question ID"],

          ...question,

          status:
            "Draft",

          publicationStatus:
            "Draft"

        })
      )

  };

}
