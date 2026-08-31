const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  topics: "tblEmw5tvBdM7TkMz",
  notes: "tblsEjHgHA7vhPgm0",
  questions: "tblWz5hU4tpVvMJbF",
  aiJobs: "tbldFSYwYcTMtMm9A",
  subjects: "tblQJzVQrpVgbx1j9",
  classes: "tblpwV6RF0IpHGWLg"
};

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";

function env() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const airtableToken = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  if (!airtableToken || !baseId) {
    throw new Error(
      "Airtable environment variables are not configured."
    );
  }

  return {
    openaiKey,
    airtableToken,
    baseId
  };
}

function airtableHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

function openaiHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

function makeId(prefix) {
  const stamp =
    Date.now().toString(36).toUpperCase();

  return `${prefix}-${new Date().getFullYear()}-${stamp}`;
}

function safeString(value, max = 20000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function escapeFormula(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

async function airtableList(
  baseId,
  tableId,
  token,
  params = {}
) {
  const search = new URLSearchParams();

  if (params.filterByFormula) {
    search.set(
      "filterByFormula",
      params.filterByFormula
    );
  }

  if (params.maxRecords) {
    search.set(
      "maxRecords",
      String(params.maxRecords)
    );
  }

  const url =
    `${AIRTABLE_API}/${baseId}/${tableId}` +
    (search.toString()
      ? `?${search.toString()}`
      : "");

  const response = await fetch(url, {
    headers: airtableHeaders(token)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      "Airtable read failed."
    );
  }

  return data.records || [];
}

async function airtableCreate(
  baseId,
  tableId,
  token,
  fields
) {
  const response = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}`,
    {
      method: "POST",
      headers: airtableHeaders(token),
      body: JSON.stringify({
        records: [{ fields }],
        typecast: true
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      "Airtable create failed."
    );
  }

  return data.records?.[0];
}

async function airtableCreateMany(
  baseId,
  tableId,
  token,
  fieldsList
) {
  const created = [];

  for (
    let i = 0;
    i < fieldsList.length;
    i += 10
  ) {
    const chunk =
      fieldsList.slice(i, i + 10);

    const response = await fetch(
      `${AIRTABLE_API}/${baseId}/${tableId}`,
      {
        method: "POST",
        headers: airtableHeaders(token),
        body: JSON.stringify({
          records: chunk.map(fields => ({
            fields
          })),
          typecast: true
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Airtable bulk create failed."
      );
    }

    created.push(
      ...(data.records || [])
    );
  }

  return created;
}

async function airtableUpdate(
  baseId,
  tableId,
  recordId,
  token,
  fields
) {
  const response = await fetch(
    `${AIRTABLE_API}/${baseId}/${tableId}/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: airtableHeaders(token),
      body: JSON.stringify({
        fields,
        typecast: true
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      "Airtable update failed."
    );
  }

  return data;
}

async function findOne(
  baseId,
  tableId,
  token,
  fieldName,
  value
) {
  const formula =
    `{${fieldName}}="${escapeFormula(value)}"`;

  const records =
    await airtableList(
      baseId,
      tableId,
      token,
      {
        filterByFormula: formula,
        maxRecords: 1
      }
    );

  return records[0] || null;
}

async function openaiGenerate(
  openaiKey,
  instructions,
  input,
  schemaName,
  schema
) {
  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers:
        openaiHeaders(openaiKey),

      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,

        instructions,

        input,

        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema
          }
        }
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      "OpenAI generation failed."
    );
  }

  const text =
    data.output_text;

  if (!text) {
    throw new Error(
      "OpenAI returned no usable output."
    );
  }

  try {
    return JSON.parse(text);
  }

  catch {
    throw new Error(
      "OpenAI returned invalid structured output."
    );
  }
}


/* =========================
   NOTE SCHEMA
========================= */

const NOTE_SCHEMA = {

  type: "object",

  additionalProperties: false,

  properties: {

    title: {
      type: "string"
    },

    content: {
      type: "string"
    },

    learningObjectives: {
      type: "string"
    },

    keyTerms: {
      type: "string"
    },

    examples: {
      type: "string"
    },

    workedExamples: {
      type: "string"
    },

    summary: {
      type: "string"
    },

    examTips: {
      type: "string"
    },

    waecFocus: {
      type: "string"
    },

    necoFocus: {
      type: "string"
    },

    utmeFocus: {
      type: "string"
    }

  },

  required: [

    "title",
    "content",
    "learningObjectives",
    "keyTerms",
    "examples",
    "workedExamples",
    "summary",
    "examTips",
    "waecFocus",
    "necoFocus",
    "utmeFocus"

  ]

};


/* =========================
   QUESTION SCHEMA
========================= */

const QUESTION_SCHEMA = {

  type: "object",

  additionalProperties: false,

  properties: {

    questions: {

      type: "array",

      items: {

        type: "object",

        additionalProperties: false,

        properties: {

          question: {
            type: "string"
          },

          optionA: {
            type: "string"
          },

          optionB: {
            type: "string"
          },

          optionC: {
            type: "string"
          },

          optionD: {
            type: "string"
          },

          correctAnswer: {

            type: "string",

            enum: [
              "A",
              "B",
              "C",
              "D"
            ]

          },

          explanation: {
            type: "string"
          },

          bloomLevel: {
            type: "string"
          },

          difficulty: {
            type: "string"
          },

          marks: {
            type: "number"
          },

          examType: {
            type: "string"
          },

          questionType: {
            type: "string"
          }

        },

        required: [

          "question",
          "optionA",
          "optionB",
          "optionC",
          "optionD",
          "correctAnswer",
          "explanation",
          "bloomLevel",
          "difficulty",
          "marks",
          "examType",
          "questionType"

        ]

      }

    }

  },

  required: [
    "questions"
  ]

};


/* =========================
   AI INSTRUCTIONS
========================= */

function noteInstructions() {

  return `

You are the Aibinu Flexiprep Educonsult
academic NoteBank assistant.

Create a high-quality examination-
preparation note from the teacher's
instruction and supplied academic context.

The teacher controls the requested
teaching style, depth, examples,
difficulty and emphasis.

Respect the selected class and
examination focus.

The note must be educationally accurate,
student-friendly and useful for WAEC,
NECO and/or UTME preparation where
selected.

Do not claim that the note has been
approved, published or reviewed.

Return ONLY the requested structured object.

`;

}


function questionInstructions() {

  return `

You are the Aibinu Flexiprep Educonsult
examination-question assistant.

Generate original multiple-choice
questions from the teacher's instruction
and supplied academic context.

Questions must be appropriate for the
selected class and topic.

Use plausible distractors.

Do not make the correct option obvious
from length or wording.

For calculation questions, ensure the
numerical answer is internally correct.

Include a concise but useful explanation
for every answer.

The questions are DRAFT content only.

Never state that they have been approved
or published.

Return ONLY the requested structured
object.

`;

}


/* =========================
   CREATE AI JOB
========================= */

async function createAIJob(
  baseId,
  token,
  payload,
  output,
  status
) {

  const fields = {

    "AI Job ID":
      makeId("AI"),

    "Content Type":
      payload.contentType,

    Prompt:
      JSON.stringify(payload),

    "AI Output":
      JSON.stringify(output),

    Model:
      OPENAI_MODEL,

    Status:
      status,

    "Created Date":
      new Date().toISOString()

  };


  if (
    payload.subjectRecordId
  ) {

    fields.Subject =
      [payload.subjectRecordId];

  }


  if (
    payload.topicRecordId
  ) {

    fields.Topic =
      [payload.topicRecordId];

  }


  if (
    payload.classRecordId
  ) {

    fields.Class =
      [payload.classRecordId];

  }


  if (
    payload.requestedByRecordId
  ) {

    fields["Requested By"] =
      [payload.requestedByRecordId];

  }


  return airtableCreate(
    baseId,
    TABLES.aiJobs,
    token,
    fields
  );

}


/* =========================
   NOTE GENERATION
========================= */

async function handleNote(
  body,
  context,
  envs
) {

  const {
    openaiKey,
    airtableToken,
    baseId
  } = envs;


  const output =
    await openaiGenerate(

      openaiKey,

      noteInstructions(),

      `

ACADEMIC CONTEXT

Subject:
${body.subject}

Class:
${body.className}

Programme:
${body.programme || "General"}

Topic:
${body.topic}

Exam Focus:
${(body.examTypes || []).join(", ")}


TEACHER'S PROMPT

${body.teacherPrompt}

`,

      "aibinu_flexiprep_note",

      NOTE_SCHEMA

    );


  const noteJob =
    await createAIJob(

      baseId,

      airtableToken,

      {
        ...body,
        ...context
      },

      output,

      "Generated"

    );


  const noteFields = {

    "Note ID":
      makeId("NOTE"),

    Title:
      output.title,

    Content:
      output.content,

    "Learning Objectives":
      output.learningObjectives,

    "Key Terms":
      output.keyTerms,

    Examples:
      output.examples,

    "Worked Examples":
      output.workedExamples,

    Summary:
      output.summary,

    "Exam Tips":
      output.examTips,

    "WAEC Focus":
      output.waecFocus,

    "NECO Focus":
      output.necoFocus,

    "UTME Focus":
      output.utmeFocus,

    Version:
      "1.0",

    Status:
      "AI Draft",

    "Created Date":
      new Date().toISOString(),

    "Updated Date":
      new Date().toISOString()

  };


  if (
    context.topicRecordId
  ) {

    noteFields.Topic =
      [context.topicRecordId];

  }


  if (
    context.requestedByRecordId
  ) {

    noteFields["Created By"] =
      [context.requestedByRecordId];

  }


  const note =
    await airtableCreate(

      baseId,

      TABLES.notes,

      airtableToken,

      noteFields

    );


  return {

    contentType:
      "Note",

    job:
      noteJob,

    note,

    output

  };

}


/* =========================
   QUESTION GENERATION
========================= */

async function handleQuestions(
  body,
  context,
  envs
) {

  const {
    openaiKey,
    airtableToken,
    baseId
  } = envs;


  const count =
    Math.min(

      Math.max(

        Number(
          body.questionCount
        ) || 20,

        1

      ),

      100

    );


  const output =
    await openaiGenerate(

      openaiKey,

      questionInstructions(),

      `

ACADEMIC CONTEXT

Subject:
${body.subject}

Class:
${body.className}

Programme:
${body.programme || "General"}

Topic:
${body.topic}

Exam Focus:
${(body.examTypes || []).join(", ")}

Number:
${count}

Difficulty:
${body.difficulty || "Mixed"}

Bloom Level:
${body.bloomLevel || "Mixed"}

Question Type:
${body.questionType || "MCQ"}


TEACHER'S PROMPT

${body.teacherPrompt}


Generate exactly ${count} questions.

`,

      "aibinu_flexiprep_questions",

      {

        ...QUESTION_SCHEMA,

        properties: {

          questions: {

            ...QUESTION_SCHEMA
              .properties
              .questions,

            minItems:
              count,

            maxItems:
              count

          }

        }

      }

    );


  const job =
    await createAIJob(

      baseId,

      airtableToken,

      {
        ...body,
        ...context
      },

      output,

      "Generated"

    );


  const questionFields =
    output.questions.map(

      (q, index) => ({

        "Question ID":
          makeId("Q") +
          `-${index + 1}`,

        Question:
          q.question,

        "Option A":
          q.optionA,

        "Option B":
          q.optionB,

        "Option C":
          q.optionC,

        "Option D":
          q.optionD,

        "Correct Answer":
          q.correctAnswer,

        Explanation:
          q.explanation,

        "Bloom Level":
          q.bloomLevel,

        Difficulty:
          q.difficulty,

        Marks:
          q.marks,

        "Exam Type":
          [q.examType],

        "Question Type":
          q.questionType ||
          "MCQ",

        "Publication Status":
          "Draft",

        Source:
          "Aibinu Flexiprep AI Assistant",

        Year:
          new Date().getFullYear()

      })

    );


  questionFields.forEach(
    fields => {

      if (
        context.subjectRecordId
      ) {

        fields.Subject =
          [context.subjectRecordId];

      }


      if (
        context.classRecordId
      ) {

        fields.Class =
          [context.classRecordId];

      }


      if (
        context.requestedByRecordId
      ) {

        fields["Created By"] =
          [context.requestedByRecordId];

      }

    }
  );


  const questions =
    await airtableCreateMany(

      baseId,

      TABLES.questions,

      airtableToken,

      questionFields

    );


  return {

    contentType:
      "Question",

    job,

    questions,

    output

  };

}


/* =========================
   RESOLVE ACADEMIC CONTEXT
========================= */

async function resolveContext(
  body,
  envs
) {

  const {
    airtableToken,
    baseId
  } = envs;


  const context = {};


  if (body.subject) {

    const record =
      await findOne(

        baseId,

        TABLES.subjects,

        airtableToken,

        "Subject Name",

        body.subject

      );


    if (!record) {

      throw new Error(

        `Subject "${body.subject}" was not found in Airtable.`

      );

    }


    context.subjectRecordId =
      record.id;

  }


  if (body.className) {

    const record =
      await findOne(

        baseId,

        TABLES.classes,

        airtableToken,

        "Class Name",

        body.className

      );


    if (!record) {

      throw new Error(

        `Class "${body.className}" was not found in Airtable.`

      );

    }


    context.classRecordId =
      record.id;

  }


  if (body.topic) {

    const record =
      await findOne(

        baseId,

        TABLES.topics,

        airtableToken,

        "Topic Name",

        body.topic

      );


    if (!record) {

      throw new Error(

        `Topic "${body.topic}" was not found in NoteBank_Topics.`

      );

    }


    context.topicRecordId =
      record.id;

  }


  if (
    body.requestedByRecordId
  ) {

    context.requestedByRecordId =
      body.requestedByRecordId;

  }


  return context;

}


/* =========================
   API HANDLER
========================= */

export default async function handler(
  req,
  res
) {

  if (
    req.method !== "POST"
  ) {

    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({

      error:
        "Method not allowed."

    });

  }


  try {

    const body =
      req.body || {};


    const contentType =
      body.contentType;


    if (
      contentType !== "Note" &&
      contentType !== "Question"
    ) {

      return res.status(400).json({

        error:
          "contentType must be Note or Question."

      });

    }


    if (

      !safeString(
        body.subject
      ) ||

      !safeString(
        body.className
      ) ||

      !safeString(
        body.topic
      ) ||

      !safeString(
        body.teacherPrompt
      )

    ) {

      return res.status(400).json({

        error:
          "Subject, Class, Topic and teacherPrompt are required."

      });

    }


    const envs =
      env();


    const context =
      await resolveContext(

        body,

        envs

      );


    const result =

      contentType === "Note"

        ? await handleNote(
            body,
            context,
            envs
          )

        : await handleQuestions(
            body,
            context,
            envs
          );


    return res.status(200).json({

      ok: true,

      ...result

    });

  }


  catch (error) {

    console.error(
      "AI_CONTENT_ERROR:",
      error
    );


    return res.status(500).json({

      ok: false,

      error:
        error?.message ||
        "AI content generation failed."

    });

  }

}
