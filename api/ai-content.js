// AIBINU FLEXIPREP EDUCONSULT — AI CONTENT API
// Enhanced AI NoteBank backend: equations, diagrams, images, graphs and safe simulations.
// Replace api/ai-content.js with this file.

const AIRTABLE_API="https://api.airtable.com/v0";
const OPENAI_API="https://api.openai.com/v1/responses";
const OPENAI_MODEL=process.env.OPENAI_MODEL||"gpt-5.6-luna";
const TABLES={
  AI_JOBS:"tbldFSYwYcTMtMm9A",
  NOTES:"tblsEjHgHA7vhPgm0",
  QUESTIONS:"tblWz5hU4tpVvMJbF"
};

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");

  if(req.method==="OPTIONS") {
    return res.status(200).end();
  }

  if(req.method==="GET") {
    return res.status(200).json({
      success:true,
      service:"AIBINU Flexiprep AI Content API",
      model:OPENAI_MODEL,
      airtableConfigured:Boolean(process.env.AIRTABLE_PAT),
      baseConfigured:Boolean(process.env.AIRTABLE_BASE_ID),
      openaiConfigured:Boolean(process.env.OPENAI_API_KEY)
    });
  }

  if(req.method!=="POST") {
    return res.status(405).json({
      success:false,
      error:"Method not allowed."
    });
  }

  try{
    const config=getConfig();
    const body=req.body||{};
    const type=clean(
      body.contentType||
      body.type||
      body.mode
    ).toLowerCase();

    if(["note","notes","generate-note"].includes(type)){
      return res.status(200).json({
        success:true,
        ...await generateNote(config,body)
      });
    }

    if(["question","questions","generate-question"].includes(type)){
      return res.status(200).json({
        success:true,
        ...await generateQuestions(config,body)
      });
    }

    return res.status(400).json({
      success:false,
      error:"Invalid contentType. Use Note or Question."
    });

  }catch(error){
    console.error(
      "AI CONTENT API ERROR:",
      error
    );

    return res.status(500).json({
      success:false,
      error:error.message||
        "AI content generation failed."
    });
  }
}


function getConfig(){
  const config={
    openaiKey:process.env.OPENAI_API_KEY,
    airtablePat:process.env.AIRTABLE_PAT,
    airtableBaseId:process.env.AIRTABLE_BASE_ID
  };

  const missing=[];

  if(!config.openaiKey){
    missing.push("OPENAI_API_KEY");
  }

  if(!config.airtablePat){
    missing.push("AIRTABLE_PAT");
  }

  if(!config.airtableBaseId){
    missing.push("AIRTABLE_BASE_ID");
  }

  if(missing.length){
    throw new Error(
      `Missing environment variables: ${missing.join(", ")}`
    );
  }

  return config;
}


function clean(v){
  return v===undefined||v===null
    ? ""
    : String(v).trim();
}


function makeId(prefix){
  return `${prefix}-${Date.now()}-${Math.floor(Math.random()*100000)}`;
}


function normalizeDifficulty(v){
  return [
    "Easy",
    "Medium",
    "Hard"
  ].find(
    x =>
      x.toLowerCase()===
      clean(v).toLowerCase()
  )||"Medium";
}


function normalizeBloom(v){
  return [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create"
  ].find(
    x =>
      x.toLowerCase()===
      clean(v).toLowerCase()
  )||"Understand";
}


function normalizeQuestionType(v){
  return [
    "MCQ",
    "Theory",
    "Calculation",
    "Practical",
    "Objective"
  ].find(
    x =>
      x.toLowerCase()===
      clean(v).toLowerCase()
  )||"MCQ";
}


function normalizeExamTypes(v){
  const valid=[
    "WAEC",
    "NECO",
    "UTME",
    "General",
    "IJMB",
    "JUPEB"
  ];

  const a=
    Array.isArray(v)
      ? v
      : clean(v)
          .split(",")
          .map(x=>x.trim());

  const r=
    a.filter(
      x =>
        valid.some(
          y =>
            y.toLowerCase()===
            String(x).toLowerCase()
        )
    );

  return r.length
    ? r
    : ["General"];
}


function createBalancedList(count,values){
  const r=
    Array.from(
      {length:count},
      (_,i)=>
        values[i%values.length]
    );

  for(
    let i=r.length-1;
    i>0;
    i--
  ){
    const j=
      Math.floor(
        Math.random()*(i+1)
      );

    [
      r[i],
      r[j]
    ]=[
      r[j],
      r[i]
    ];
  }

  return r;
}


function getDifficultyList(count,v){
  return clean(v).toLowerCase()==="mixed"
    ? createBalancedList(
        count,
        [
          "Easy",
          "Medium",
          "Hard"
        ]
      )
    : Array(count).fill(
        normalizeDifficulty(
          v||"Medium"
        )
      );
}


function getBloomList(count,v){
  return clean(v).toLowerCase()==="mixed"
    ? createBalancedList(
        count,
        [
          "Remember",
          "Understand",
          "Apply",
          "Analyze",
          "Evaluate",
          "Create"
        ]
      )
    : Array(count).fill(
        normalizeBloom(
          v||"Apply"
        )
      );
}


async function airtableRequest(
  config,
  tableId,
  method,
  body
){
  const response=
    await fetch(
      `${AIRTABLE_API}/${config.airtableBaseId}/${tableId}`,
      {
        method,
        headers:{
          Authorization:
            `Bearer ${config.airtablePat}`,
          "Content-Type":
            "application/json"
        },
        ...(body===undefined
          ? {}
          : {
              body:
                JSON.stringify(body)
            })
      }
    );

  const text=
    await response.text();

  let data;

  try{
    data=
      JSON.parse(text);
  }catch{
    data={
      raw:text
    };
  }

  if(!response.ok){
    throw new Error(
      data?.error?.message||
      data?.error?.type||
      `Airtable error ${response.status}`
    );
  }

  return data;
}


async function createRecord(
  config,
  tableId,
  fields
){
  return airtableRequest(
    config,
    tableId,
    "POST",
    {
      records:[
        {
          fields
        }
      ],
      typecast:true
    }
  );
}


async function createManyRecords(
  config,
  tableId,
  records
){
  const out=[];

  for(
    let i=0;
    i<records.length;
    i+=10
  ){
    const r=
      await airtableRequest(
        config,
        tableId,
        "POST",
        {
          records:
            records
              .slice(i,i+10)
              .map(
                fields=>({
                  fields
                })
              ),
          typecast:true
        }
      );

    if(Array.isArray(r.records)){
      out.push(...r.records);
    }
  }

  return out;
}


async function callOpenAI(
  config,
  instructions,
  input
){
  const response=
    await fetch(
      OPENAI_API,
      {
        method:"POST",
        headers:{
          Authorization:
            `Bearer ${config.openaiKey}`,
          "Content-Type":
            "application/json"
        },
        body:JSON.stringify({
          model:OPENAI_MODEL,
          store:false,

          instructions:
            `${instructions}

IMPORTANT JSON OUTPUT REQUIREMENT:
Return valid JSON only.
No Markdown fences.
No text outside JSON.`,

          input:
            `IMPORTANT:
The required response format is JSON.

${input}

Return valid JSON only.`,

          text:{
            format:{
              type:"json_object"
            }
          }
        })
      }
    );

  const responseText=
    await response.text();

  let data;

  try{
    data=
      JSON.parse(responseText);
  }catch{
    throw new Error(
      `OpenAI returned an invalid response: ${responseText.slice(0,500)}`
    );
  }

  if(!response.ok){
    throw new Error(
      data?.error?.message||
      `OpenAI error ${response.status}`
    );
  }

  if(data.output_text){
    return data.output_text.trim();
  }

  let output="";

  for(
    const item of
    Array.isArray(data.output)
      ? data.output
      : []
  ){
    for(
      const c of
      Array.isArray(item.content)
        ? item.content
        : []
    ){
      if(c.type==="output_text"){
        output+=c.text||"";
      }
    }
  }

  if(!output.trim()){
    throw new Error(
      "OpenAI returned no usable output."
    );
  }

  return output.trim();
}


function parseAIJSON(text){
  const c=
    clean(text)
      .replace(/^```json/i,"")
      .replace(/^```/i,"")
      .replace(/```$/i,"")
      .trim();

  try{
    return JSON.parse(c);
  }catch{}

  const a=
    c.indexOf("{");

  const b=
    c.lastIndexOf("}");

  if(a>=0&&b>a){
    try{
      return JSON.parse(
        c.slice(a,b+1)
      );
    }catch{}
  }

  throw new Error(
    "AI returned invalid JSON."
  );
}


async function logAIJob(
  config,
  data
){
  try{
    const f={
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

    if(data.requestedBy){
      f["Requested By"]=[
        data.requestedBy
      ];
    }

    if(data.subjectId){
      f.Subject=[
        data.subjectId
      ];
    }

    if(data.topicId){
      f.Topic=[
        data.topicId
      ];
    }

    if(data.classId){
      f.Class=[
        data.classId
      ];
    }

    return await createRecord(
      config,
      TABLES.AI_JOBS,
      f
    );

  }catch(e){
    console.error(
      "AI JOB LOGGING ERROR:",
      e.message
    );

    return null;
  }
}


// ==========================================================
// VISUAL SAFETY REGISTRY
//
// AI can describe visuals, but cannot supply executable
// code or arbitrary URLs.
// ==========================================================

const VISUAL_TYPES=
  new Set([
    "equation",
    "diagram",
    "image",
    "graph",
    "interactive",
    "simulation"
  ]);


/*
 * APPROVED SIMULATIONS
 *
 * IMPORTANT:
 * Every simulation named here must have a corresponding
 * trusted renderer in public/academic-note-visual-v3.js.
 *
 * electrolysis has now been added to match the frontend.
 */

const SIMULATIONS=
  new Set([
    "projectile_motion",
    "ohms_law",
    "hookes_law",
    "uniform_acceleration",
    "simple_pendulum",
    "series_parallel_circuit",
    "electrolysis"
  ]);


function safeVisual(v){
  if(
    !v||
    typeof v!=="object"
  ){
    return null;
  }

  const type=
    clean(v.type).toLowerCase();

  if(!VISUAL_TYPES.has(type)){
    return null;
  }

  const o={
    type
  };

  // --------------------------------------------------------
  // EQUATION
  // --------------------------------------------------------

  if(type==="equation"){
    o.latex=
      clean(v.latex)
        .slice(0,1000);

    o.caption=
      clean(v.caption)
        .slice(0,300);

    o.variables=
      clean(v.variables)
        .slice(0,1000);

    if(!o.latex){
      return null;
    }
  }


  // --------------------------------------------------------
  // DIAGRAM
  // --------------------------------------------------------

  if(type==="diagram"){
    o.diagram=
      clean(v.diagram)
        .slice(0,80);

    o.title=
      clean(v.title)
        .slice(0,200);

    o.labels=
      Array.isArray(v.labels)
        ? v.labels
            .map(clean)
            .slice(0,30)
        : [];

    o.description=
      clean(v.description)
        .slice(0,1000);
  }


  // --------------------------------------------------------
  // IMAGE
  // --------------------------------------------------------

  if(type==="image"){
    o.imageQuery=
      clean(v.imageQuery)
        .slice(0,300);

    o.caption=
      clean(v.caption)
        .slice(0,300);

    o.alt=
      clean(v.alt)
        .slice(0,300);

    if(
      !o.imageQuery &&
      !o.alt
    ){
      return null;
    }
  }


  // --------------------------------------------------------
  // GRAPH
  // --------------------------------------------------------

  if(type==="graph"){
    o.graph=
      clean(v.graph)
        .slice(0,80);

    o.title=
      clean(v.title)
        .slice(0,200);

    o.xLabel=
      clean(v.xLabel)
        .slice(0,100);

    o.yLabel=
      clean(v.yLabel)
        .slice(0,100);

    o.data=
      Array.isArray(v.data)
        ? v.data
            .slice(0,100)
            .map(
              p =>
                Array.isArray(p)
                  ? p.slice(0,2)
                  : null
            )
            .filter(Boolean)
        : [];
  }


  // --------------------------------------------------------
  // INTERACTIVE
  // --------------------------------------------------------

  if(type==="interactive"){
    o.interaction=
      clean(v.interaction)
        .slice(0,80);

    o.title=
      clean(v.title)
        .slice(0,200);

    o.instructions=
      clean(v.instructions)
        .slice(0,500);

    o.parameters=
      Array.isArray(v.parameters)
        ? v.parameters
            .slice(0,12)
            .map(
              p=>({
                name:
                  clean(p?.name)
                    .slice(0,80),

                min:
                  Number(p?.min),

                max:
                  Number(p?.max),

                step:
                  Number(p?.step),

                value:
                  Number(p?.value)
              })
            )
        : [];
  }


  // --------------------------------------------------------
  // SIMULATION
  // --------------------------------------------------------

  if(type==="simulation"){

    o.simulation=
      clean(v.simulation)
        .toLowerCase();

    /*
     * This is the backend gate.
     *
     * electrolysis is now accepted because it exists
     * in the SIMULATIONS registry above.
     */

    if(!SIMULATIONS.has(o.simulation)){
      return null;
    }

    o.title=
      clean(v.title)
        .slice(0,200);

    o.instructions=
      clean(v.instructions)
        .slice(0,500);

    o.variables={};

    if(
      v.variables &&
      typeof v.variables==="object"
    ){
      for(
        const [k,val]
        of Object.entries(v.variables).slice(0,12)
      ){
        const n=
          Number(val);

        if(Number.isFinite(n)){
          o.variables[k]=
            Math.max(
              -100000,
              Math.min(
                100000,
                n
              )
            );
        }
      }
    }
  }

  return o;
}


function normalizeVisuals(a){
  return Array.isArray(a)
    ? a
        .map(safeVisual)
        .filter(Boolean)
        .slice(0,40)
    : [];
}


// ==========================================================
// GENERATE NOTE
// ==========================================================

async function generateNote(
  config,
  body
){
  const subject=
    clean(body.subject);

  const subjectId=
    clean(body.subjectId);

  const topic=
    clean(body.topic);

  const topicId=
    clean(body.topicId);

  const className=
    clean(body.className)||
    "SS1";

  const classId=
    clean(body.classId);

  const programme=
    clean(body.programme)||
    "General";

  const requestedBy=
    clean(body.requestedBy);

  const teacherPrompt=
    clean(
      body.teacherPrompt||
      body.prompt
    );

  const examTypes=
    normalizeExamTypes(
      body.examTypes
    );

  if(!subject){
    throw new Error(
      "Subject is required."
    );
  }

  if(!topic){
    throw new Error(
      "Topic is required."
    );
  }

  if(!teacherPrompt){
    throw new Error(
      "Teacher prompt is required."
    );
  }


  const instructions=
    `You are the official AI academic content assistant for AIBINU FLEXIPREP EDUCONSULT. The TEACHER'S PROMPT is the PRIMARY instruction. Prepare accurate, engaging, age-appropriate Nigerian secondary-school material aligned to WAEC, NECO and UTME where applicable.`;


  const input=
    `RESPONSE FORMAT: JSON
SUBJECT: ${subject}
CLASS: ${className}
PROGRAMME: ${programme}
TOPIC: ${topic}
EXAMINATION FOCUS: ${examTypes.join(", ")}
TEACHER'S PROMPT: ${teacherPrompt}

Create a comprehensive study note with title, learningObjectives, keyTerms, content, examples, workedExamples, formulae, applications, commonMisconceptions, diagrams, summary, examTips, waecFocus, necoFocus and utmeFocus.

VISUAL COMPONENTS:
Add visualComponents where pedagogically useful.

Equations MUST use LaTeX.

Diagrams must be descriptive and label-based.

Graphs may contain numeric [x,y] data.

Images must contain imageQuery/alt metadata only; never invent image URLs.

Simulations/interactives MUST use ONLY these approved simulation names:

projectile_motion
ohms_law
hookes_law
uniform_acceleration
simple_pendulum
series_parallel_circuit
electrolysis

If the teacher explicitly requests an electrolysis simulation, use:

"simulation": "electrolysis"

For electrolysis, appropriate variables may include:
- current
- time
- molarMass
- valency

Never invent another simulation name.

Never output executable JS/HTML/CSS/SVG, iframe code, data URLs or arbitrary URLs.

Return exactly:
{
  "title":"",
  "learningObjectives":"",
  "keyTerms":"",
  "content":"",
  "examples":"",
  "workedExamples":"",
  "formulae":"",
  "applications":"",
  "commonMisconceptions":"",
  "diagrams":"",
  "summary":"",
  "examTips":"",
  "waecFocus":"",
  "necoFocus":"",
  "utmeFocus":"",
  "visualComponents":[]
}`;


  const aiText=
    await callOpenAI(
      config,
      instructions,
      input
    );

  const raw=
    parseAIJSON(aiText);

  const visualComponents=
    normalizeVisuals(
      raw.visualComponents
    );

  const diagramVisuals=
    visualComponents.filter(
      v =>
        v.type==="diagram"||
        v.type==="graph"
    );

  const diagrams=
    clean(raw.diagrams)||
    (
      diagramVisuals.length
        ? JSON.stringify(
            diagramVisuals
          )
        : ""
    );

  const now=
    new Date().toISOString();


  const fields={
    "Note ID":
      makeId("NOTE"),

    "Title":
      clean(raw.title)||
      `${subject}: ${topic}`,

    "Content":
      clean(raw.content),

    "Learning Objectives":
      clean(
        raw.learningObjectives
      ),

    "Key Terms":
      clean(raw.keyTerms),

    "Examples":
      clean(raw.examples),

    "Worked Examples":
      clean(
        raw.workedExamples
      ),

    "Formulae":
      clean(raw.formulae),

    "Applications":
      clean(raw.applications),

    "Common Misconceptions":
      clean(
        raw.commonMisconceptions
      ),

    "Diagrams":
      diagrams,

    "Summary":
      clean(raw.summary),

    "Exam Tips":
      clean(raw.examTips),

    "WAEC Focus":
      clean(raw.waecFocus),

    "NECO Focus":
      clean(raw.necoFocus),

    "UTME Focus":
      clean(raw.utmeFocus),

    "Teacher Prompt":
      teacherPrompt,

    "Version":
      "1.0",

    "Status":
      "AI Draft",

    "Created Date":
      now,

    "Updated Date":
      now
  };


  if(topicId){
    fields.Topic=[
      topicId
    ];
  }

  if(requestedBy){
    fields["Created By"]=[
      requestedBy
    ];
  }


  const created=
    await createRecord(
      config,
      TABLES.NOTES,
      fields
    );


  await logAIJob(
    config,
    {
      requestedBy,
      contentType:"Note",
      subjectId,
      topicId,
      classId,
      prompt:teacherPrompt,
      aiOutput:aiText
    }
  );


  return {
    message:
      "AI note generated successfully.",

    note:{
      id:
        created?.records?.[0]?.id||
        null,

      ...raw,

      diagrams,

      visualComponents,

      status:
        "AI Draft"
    }
  };
}


// ==========================================================
// GENERATE QUESTIONS
// ==========================================================

async function generateQuestions(
  config,
  body
){
  const subject=
    clean(body.subject);

  const subjectId=
    clean(body.subjectId);

  const topic=
    clean(body.topic);

  const className=
    clean(body.className)||
    "SS1";

  const classId=
    clean(body.classId);

  const programme=
    clean(body.programme)||
    "General";

  const requestedBy=
    clean(body.requestedBy);

  const teacherPrompt=
    clean(
      body.teacherPrompt||
      body.prompt
    );

  const examTypes=
    normalizeExamTypes(
      body.examTypes
    );


  const count=
    Math.max(
      1,
      Math.min(
        100,
        Number(
          body.numberOfQuestions||
          body.numberQuestions||
          body.count||
          body.questionCount||
          1
        )
      )
    );


  const difficulty=
    clean(
      body.difficulty||
      "Medium"
    );

  const bloomLevel=
    clean(
      body.bloomLevel||
      "Apply"
    );

  const questionType=
    normalizeQuestionType(
      body.questionType||
      "MCQ"
    );

  const source=
    clean(
      body.source||
      "AI Generated"
    );

  const year=
    Number(
      body.year||
      2026
    );

  const marks=
    Number(
      body.marks||
      1
    );


  if(!subject){
    throw new Error(
      "Subject is required."
    );
  }

  if(!topic){
    throw new Error(
      "Topic is required."
    );
  }

  if(!teacherPrompt){
    throw new Error(
      "Teacher prompt is required."
    );
  }


  const difficultyList=
    getDifficultyList(
      count,
      difficulty
    );

  const bloomList=
    getBloomList(
      count,
      bloomLevel
    );


  const generatedQuestions=[];


  for(
    let start=0;
    start<count;
    start+=10
  ){
    const batchSize=
      Math.min(
        10,
        count-start
      );


    const assignments=
      Array.from(
        {
          length:batchSize
        },
        (_,i)=>
          `Question ${start+i+1}: Difficulty=${difficultyList[start+i]}; Bloom=${bloomList[start+i]}`
      ).join("\n");


    const instructions=
      `You are an expert Nigerian secondary-school examination question setter for AIBINU FLEXIPREP EDUCONSULT. Standards: WAEC, NECO and UTME. The backend difficulty and Bloom assignment is FINAL and must be obeyed. Return only JSON.`;


    const input=
      `RESPONSE FORMAT: JSON
SUBJECT: ${subject}
CLASS: ${className}
PROGRAMME: ${programme}
TOPIC: ${topic}
EXAMINATION FOCUS: ${examTypes.join(", ")}
QUESTION TYPE: ${questionType}
TEACHER'S PROMPT: ${teacherPrompt}

GENERATE EXACTLY ${batchSize} QUESTIONS.

MANDATORY ASSIGNMENTS:
${assignments}

For MCQ use four options A-D, exactly one correct answer, plausible distractors, and no all/none of the above.

Return {
  "questions":[
    {
      "question":"",
      "optionA":"",
      "optionB":"",
      "optionC":"",
      "optionD":"",
      "correctAnswer":"A",
      "bloomLevel":"",
      "difficulty":"",
      "explanation":"",
      "questionType":"MCQ",
      "marks":1,
      "source":"",
      "year":2026
    }
  ]
}`;


    const parsed=
      parseAIJSON(
        await callOpenAI(
          config,
          instructions,
          input
        )
      );


    if(!Array.isArray(parsed.questions)){
      throw new Error(
        "AI did not return a questions array."
      );
    }


    if(
      parsed.questions.length!==
      batchSize
    ){
      throw new Error(
        `AI returned ${parsed.questions.length} questions instead of ${batchSize}.`
      );
    }


    parsed.questions.forEach(
      (q,i)=>{
        const gi=
          start+i;

        q.difficulty=
          difficultyList[gi];

        q.bloomLevel=
          bloomList[gi];

        q.questionType=
          normalizeQuestionType(
            questionType
          );

        q.marks=
          Number(
            q.marks||
            marks||
            1
          );

        q.source=
          clean(
            q.source||
            source
          );

        q.year=
          Number(
            q.year||
            year
          );

        q.correctAnswer=
          clean(
            q.correctAnswer
          ).toUpperCase();


        if(
          ![
            "A",
            "B",
            "C",
            "D"
          ].includes(
            q.correctAnswer
          )
        ){
          throw new Error(
            `Invalid correct answer in Question ${gi+1}.`
          );
        }


        if(!clean(q.question)){
          throw new Error(
            `Question ${gi+1} has no question text.`
          );
        }


        if(
          !clean(q.optionA)||
          !clean(q.optionB)||
          !clean(q.optionC)||
          !clean(q.optionD)
        ){
          throw new Error(
            `Question ${gi+1} has incomplete options.`
          );
        }


        generatedQuestions.push(q);
      }
    );
  }


  const records=
    generatedQuestions.map(
      q=>{
        const f={
          "Question ID":
            makeId("Q"),

          "Topic":
            topic,

          "Question":
            clean(q.question),

          "Option A":
            clean(q.optionA),

          "Option B":
            clean(q.optionB),

          "Option C":
            clean(q.optionC),

          "Option D":
            clean(q.optionD),

          "Correct Answer":
            q.correctAnswer,

          "Bloom Level":
            normalizeBloom(
              q.bloomLevel
            ),

          "Difficulty":
            normalizeDifficulty(
              q.difficulty
            ),

          "Explanation":
            clean(q.explanation),

          "Status":
            "Draft",

          "Publication Status":
            "Draft",

          "Question Type":
            normalizeQuestionType(
              q.questionType
            ),

          "Programme":
            programme,

          "Marks":
            Number(
              q.marks||
              marks||
              1
            ),

          "Source":
            clean(
              q.source||
              source
            ),

          "Year":
            Number(
              q.year||
              year
            ),

          "Exam Type":
            examTypes
        };


        if(subjectId){
          f.Subject=[
            subjectId
          ];
        }

        if(classId){
          f.Class=[
            classId
          ];
        }

        if(requestedBy){
          f["Created By"]=[
            requestedBy
          ];
        }

        return f;
      }
    );


  const created=
    await createManyRecords(
      config,
      TABLES.QUESTIONS,
      records
    );


  await logAIJob(
    config,
    {
      requestedBy,
      contentType:"Question",
      subjectId,
      topicId:null,
      classId,
      prompt:teacherPrompt,
      aiOutput:
        JSON.stringify(
          generatedQuestions
        )
    }
  );


  return {
    message:
      `${generatedQuestions.length} AI questions generated successfully.`,

    count:
      generatedQuestions.length,

    questions:
      generatedQuestions.map(
        (q,i)=>({
          id:
            created[i]?.id||
            null,

          questionId:
            records[i]["Question ID"],

          ...q,

          status:
            "Draft",

          publicationStatus:
            "Draft"
        })
      )
  };
}
