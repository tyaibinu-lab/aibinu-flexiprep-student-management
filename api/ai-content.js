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
// contentType:
//   "Note"     -> Generate and save AI note draft
//   "Question" -> Generate and save AI question drafts
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
    missing.push("OPENAI_API_KEY");
  }

  if (!config.airtablePat) {
    missing.push("AIRTABLE_PAT");
  }

  if (!config.airtableBaseId) {
    missing.push("AIRTABLE_BASE_ID");
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
    `${Math.floor(Math.random() * 10000)}`
  );

}


// ============================================================
// VALID AIRTABLE SELECT VALUES
// ============================================================

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
          item => item.trim()
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
// AIRTABLE
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
// CREATE ONE AIRTABLE RECORD
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
// CREATE MANY AIRTABLE RECORDS
// Airtable supports up to 10 records per request.
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

        method:
          "POST",

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

    // Try to find JSON object.
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

      // Continue to error.
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


    // Linked record fields

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

    // AI job logging failure should
    // not erase successfully generated content.

    console.error(
      "AI JOB LOGGING ERROR:",
      error.message
    );

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

  const topic =
    clean(body.topic);

  const className =
    clean(body.className) ||
    "SS1";

  const programme =
    clean(body.programme) ||
    "General";

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

You are the official AI academic content
assistant for AIBINU FLEXIPREP EDUCONSULT.

Your role is to help qualified teachers
prepare high-quality examination notes.

The TEACHER'S PROMPT is the PRIMARY
instruction.

Create original educational content.

Target:
Nigerian secondary-school students.

Standards:
WAEC, NECO and UTME where applicable.

The content must be:

- Accurate
- Clear
- Engaging
- Examination-oriented
- Age appropriate
- Scientifically or mathematically correct
- Well structured

Do not claim the material has been
teacher-approved or published.

Return ONLY valid JSON.

`;


  const input = `

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


Create the note.

The note should contain:

- A strong title
- Learning objectives
- Introduction
- Detailed teaching content
- Key terms
- Examples
- Worked examples where applicable
- Summary
- Examination tips
- WAEC focus
- NECO focus
- UTME focus

Return exactly this JSON structure:

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


  const fields = {

    "Note ID":
      makeId("NOTE"),

    "Title":
      clean(note.title) ||
      `${subject}: ${topic}`,

    "Content":
      clean(note.content),

    "Learning Objectives":
      clean(
        note.learningObjectives
      ),

    "Key Terms":
      clean(
        note.keyTerms
      ),

    "Examples":
      clean(
        note.examples
      ),

    "Worked Examples":
      clean(
        note.workedExamples
      ),

    "Summary":
      clean(
        note.summary
      ),

    "Exam Tips":
      clean(
        note.examTips
      ),

    "WAEC Focus":
      clean(
        note.waecFocus
      ),

    "NECO Focus":
      clean(
        note.necoFocus
      ),

    "UTME Focus":
      clean(
        note.utmeFocus
      ),

    "Version":
      "1.0",

    // VERIFIED NoteBank status
    "Status":
      "AI Draft",

    "Created Date":
      new Date().toISOString(),

    "Updated Date":
      new Date().toISOString()

  };


  // Linked Topic

  if (
    body.topicId
  ) {

    fields.Topic =
      [body.topicId];

  }


  // Linked teacher

  if (
    body.requestedBy
  ) {

    fields["Created By"] =
      [body.requestedBy];

  }


  const created =
    await createRecord(

      config,

      TABLES.NOTES,

      fields

    );


  await logAIJob(

    config,

    {

      requestedBy:
        body.requestedBy,

      subjectId:
        body.subjectId,

      topicId:
        body.topicId,

      classId:
        body.classId,

      contentType:
        "Note",

      prompt:
        teacherPrompt,

      aiOutput:
        aiText

    }

  );


  return {

    type:
      "Note",

    noteRecordId:
      created?.records?.[0]?.id ||
      null,

    noteId:
      fields["Note ID"],

    status:
      "AI Draft",

    note,

    examTypes

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

  const topic =
    clean(body.topic);

  const className =
    clean(body.className) ||
    "SS1";

  const programme =
    clean(body.programme) ||
    "General";

  const teacherPrompt =
    clean(
      body.teacherPrompt ||
      body.prompt
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


  let count =
    Number(
      body.questionCount ||
      body.count ||
      20
    );


  count =
    Math.min(
      Math.max(
        Math.floor(count),
        1
      ),
      100
    );


  const difficulty =
    normalizeDifficulty(
      body.difficulty ||
      "Medium"
    );


  const bloomLevel =
    normalizeBloom(
      body.bloomLevel ||
      "Apply"
    );


  const questionType =
    normalizeQuestionType(
      body.questionType ||
      "MCQ"
    );


  const examTypes =
    normalizeExamTypes(
      body.examTypes
    );


  const instructions = `

You are the official AI examination
question assistant for AIBINU FLEXIPREP
EDUCONSULT.

The TEACHER'S PROMPT is the PRIMARY
instruction.

Generate original examination-style
questions suitable for Nigerian students.

Use WAEC, NECO and UTME style where
requested.

Questions must be academically accurate.

For MCQs:

- Four options only
- Exactly one correct answer
- Plausible distractors
- No "All of the above"
- No "None of the above"
- Correct answer must match the option
- Include explanation
- Include Bloom level
- Include difficulty

Do not claim questions have been
approved or published.

Return ONLY valid JSON.

`;


  const input = `

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

NUMBER OF QUESTIONS:
${count}

QUESTION TYPE:
${questionType}

DIFFICULTY:
${difficulty}

BLOOM LEVEL:
${bloomLevel}


TEACHER'S PROMPT:
${teacherPrompt}


Generate exactly ${count} questions.

Return:

{
  "questions": [
    {
      "question": "",
      "optionA": "",
      "optionB": "",
      "optionC": "",
      "optionD": "",
      "correctAnswer": "A",
      "explanation": "",
      "bloomLevel": "${bloomLevel}",
      "difficulty": "${difficulty}",
      "questionType": "${questionType}",
      "marks": 1,
      "examType": "WAEC",
      "source": "AI Generated",
      "year": 2026
    }
  ]
}

`;


  const aiText =
    await callOpenAI(

      config,

      instructions,

      input

    );


  const result =
    parseAIJSON(
      aiText
    );


  if (
    !Array.isArray(
      result.questions
    )
  ) {

    throw new Error(
      "AI did not return questions."
    );

  }


  if (
    result.questions.length !==
    count
  ) {

    throw new Error(

      `AI returned ${result.questions.length} questions instead of ${count}.`

    );

  }


  const records = [];


  for (
    let i = 0;
    i < result.questions.length;
    i++
  ) {

    const q =
      result.questions[i];


    const correctAnswer =
      clean(
        q.correctAnswer
      ).toUpperCase();


    if (
      ![
        "A",
        "B",
        "C",
        "D"
      ].includes(
        correctAnswer
      )
    ) {

      throw new Error(

        `Question ${i + 1} has invalid correct answer.`

      );

    }


    const fields = {

      "Question ID":
        makeId("Q"),

      // VERIFIED: Topic is text
      "Topic":
        topic,

      "Question":
        clean(
          q.question
        ),

      "Option A":
        clean(
          q.optionA
        ),

      "Option B":
        clean(
          q.optionB
        ),

      "Option C":
        clean(
          q.optionC
        ),

      "Option D":
        clean(
          q.optionD
        ),

      "Correct Answer":
        correctAnswer,

      "Bloom Level":
        normalizeBloom(
          q.bloomLevel ||
          bloomLevel
        ),

      "Difficulty":
        normalizeDifficulty(
          q.difficulty ||
          difficulty
        ),

      "Explanation":
        clean(
          q.explanation
        ),

      // VERIFIED CBT status
      "Status":
        "Draft",

      // VERIFIED publication status
      "Publication Status":
        "Draft",

      "Exam Type":
        normalizeExamTypes(
          q.examType ||
          examTypes
        ),

      "Question Type":
        normalizeQuestionType(
          q.questionType ||
          questionType
        ),

      "Programme":
        programme,

      "Marks":
        Number(
          q.marks ||
          body.marks ||
          1
        ),

      "Source":
        clean(
          q.source
        ) ||
        "AI Generated",

      "Year":
        Number(
          q.year
        ) ||
        new Date().getFullYear()

    };


    // Linked Subject

    if (
      body.subjectId
    ) {

      fields.Subject =
        [body.subjectId];

    }


    // Linked Class

    if (
      body.classId
    ) {

      fields.Class =
        [body.classId];

    }


    // Linked Teacher

    if (
      body.requestedBy
    ) {

      fields["Created By"] =
        [body.requestedBy];

    }


    records.push(
      fields
    );

  }


  // ----------------------------------------------------------
  // SAVE QUESTIONS
  // ----------------------------------------------------------

  const created =
    await createManyRecords(

      config,

      TABLES.QUESTIONS,

      records

    );


  // ----------------------------------------------------------
  // LOG AI JOB
  // ----------------------------------------------------------

  await logAIJob(

    config,

    {

      requestedBy:
        body.requestedBy,

      subjectId:
        body.subjectId,

      topicId:
        body.topicId,

      classId:
        body.classId,

      contentType:
        "Question",

      prompt:
        teacherPrompt,

      aiOutput:
        aiText

    }

  );


  return {

    type:
      "Question",

    count:
      created.length,

    status:
      "Draft",

    questions:
      result.questions,

    recordIds:
      created.map(
        record =>
          record.id
      )

  };

}


// ============================================================
// VERCEL SERVERLESS HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  // ----------------------------------------------------------
  // Only POST is allowed
  // ----------------------------------------------------------

  if (
    req.method !== "POST"
  ) {

    return res.status(405).json({

      success:
        false,

      error:
        "Method not allowed. Use POST."

    });

  }


  try {

    const body =
      req.body || {};


    const contentType =
      clean(
        body.contentType
      );


    if (
      contentType !== "Note" &&
      contentType !== "Question"
    ) {

      return res.status(400).json({

        success:
          false,

        error:
          'contentType must be "Note" or "Question".'

      });

    }


    const config =
      getConfig();


    let result;


    if (
      contentType === "Note"
    ) {

      result =
        await generateNote(
          config,
          body
        );

    } else {

      result =
        await generateQuestions(
          config,
          body
        );

    }


    return res.status(200).json({

      success:
        true,

      model:
        OPENAI_MODEL,

      ...result

    });

  }


  catch (error) {

    console.error(
      "AIBINU FLEXIPREP AI CONTENT ERROR:",
      error
    );


    return res.status(500).json({

      success:
        false,

      error:
        error?.message ||
        "AI content generation failed."

    });

  }

}
