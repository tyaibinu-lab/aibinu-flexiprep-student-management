// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// File: api/note-reviews.js
//
// NoteBank workflow:
//
// AI/Draft
//      ↓
// Under Review
//      ↓
// Published
//
// OR
//
// Under Review
//      ↓
// Changes Requested
//
// IMPORTANT:
// Target Programme and Target Class belong ONLY to
// NoteBank_Publications.
//
// They are NOT fields in NoteBank_Notes.
// ============================================================


const AIRTABLE_API =
  "https://api.airtable.com/v0";


/* ============================================================
   AIRTABLE TABLE IDs
   ============================================================ */

const NOTES_TABLE =
  "tblsEjHgHA7vhPgm0";

const APPROVALS_TABLE =
  process.env.AIRTABLE_APPROVALS_TABLE_ID ||
  "tblJHGCDxEpdjm46y";

const PUBLICATIONS_TABLE =
  process.env.AIRTABLE_PUBLICATIONS_TABLE_ID ||
  "tblKSLfWIrVNGkH5D";

const TEACHERS_TABLE =
  "tblVjuSJe4R5kcOZr";

const CLASSES_TABLE =
  "tblpwV6RF0IpHGWLg";


/* ============================================================
   AIRTABLE CONFIGURATION
   ============================================================ */

function config(){

  const token =
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_TOKEN;

  const baseId =
    process.env.AIRTABLE_BASE_ID;


  if(!token || !baseId){

    throw new Error(
      "Airtable environment variables are missing."
    );

  }


  return {
    token,
    baseId
  };

}


/* ============================================================
   HEADERS
   ============================================================ */

function authHeaders(token){

  return {

    Authorization:
      `Bearer ${token}`,

    "Content-Type":
      "application/json"

  };

}


/* ============================================================
   GENERIC AIRTABLE REQUEST
   ============================================================ */

async function airtable(
  table,
  method = "GET",
  body = null,
  query = ""
){

  const {
    token,
    baseId
  } = config();


  const response =
    await fetch(
      `${AIRTABLE_API}/${baseId}/${table}${query}`,
      {

        method,

        headers:
          authHeaders(token),

        ...(body !== null
          ? {
              body:
                JSON.stringify(body)
            }
          : {})

      }
    );


  const raw =
    await response.text();


  let data = {};


  try{

    data =
      raw
        ? JSON.parse(raw)
        : {};

  }catch{

    data = {
      raw
    };

  }


  if(!response.ok){

    throw new Error(

      data?.error?.message ||

      data?.error?.type ||

      `Airtable request failed (${response.status}).`

    );

  }


  return data;

}


/* ============================================================
   LIST ALL RECORDS
   ============================================================ */

async function listAll(table){

  const records = [];

  let offset = "";


  do{

    const query =
      offset
        ? `?pageSize=100&offset=${encodeURIComponent(offset)}`
        : "?pageSize=100";


    const data =
      await airtable(
        table,
        "GET",
        null,
        query
      );


    records.push(
      ...(data.records || [])
    );


    offset =
      data.offset || "";


  }while(offset);


  return records;

}


/* ============================================================
   FIND NOTE
   ============================================================ */

async function findNote(noteId){

  const id =
    String(
      noteId || ""
    ).trim();


  if(!id){

    return null;

  }


  /*
   * If the supplied value is already an Airtable
   * record ID, use it directly.
   */

  if(
    /^rec[A-Za-z0-9]{14}$/.test(id)
  ){

    try{

      return await airtable(
        `${NOTES_TABLE}/${id}`
      );

    }catch(_){

      // Fall through to Note ID search.
    }

  }


  /*
   * Otherwise search the custom Note ID field.
   */

  const records =
    await listAll(
      NOTES_TABLE
    );


  return (
    records.find(
      record =>
        String(
          record.fields?.["Note ID"] || ""
        ).trim() === id
    ) ||
    null
  );

}


/* ============================================================
   CONVERT VALUES TO AIRTABLE RECORD IDs
   ============================================================ */

function recordIds(value){

  const values =
    Array.isArray(value)
      ? value
      : [value];


  return values

    .map(
      value =>
        String(
          value || ""
        ).trim()
    )

    .map(value => {

      const match =
        value.match(
          /(?:^|\|)(rec[A-Za-z0-9]{14})$/
        );


      return match
        ? match[1]
        : value;

    })

    .filter(
      value =>
        /^rec[A-Za-z0-9]{14}$/.test(value)
    );

}


/* ============================================================
   FIND TEACHER
   ============================================================ */

async function findTeacherId(value){

  /*
   * First check if the value is already
   * an Airtable record ID.
   */

  const direct =
    recordIds(value);


  if(direct.length){

    return direct[0];

  }


  const name =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  if(!name){

    return null;

  }


  const teachers =
    await listAll(
      TEACHERS_TABLE
    );


  const found =
    teachers.find(
      record => {

        const fields =
          record.fields || {};


        return [

          fields.Name,

          fields["Teacher Name"],

          fields.Full_Name,

          fields["Full Name"]

        ]

          .filter(Boolean)

          .some(
            teacherName =>
              String(
                teacherName
              )
                .trim()
                .toLowerCase()
                === name
          );

      }
    );


  return found?.id || null;

}


/* ============================================================
   FIND CLASS
   ============================================================ */

async function findClassId(value){

  /*
   * If frontend supplied a real Airtable
   * record ID, use it directly.
   */

  const direct =
    recordIds(value);


  if(direct.length){

    return direct[0];

  }


  const wanted =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  if(!wanted){

    return null;

  }


  const classes =
    await listAll(
      CLASSES_TABLE
    );


  const found =
    classes.find(
      record => {

        const fields =
          record.fields || {};


        return [

          fields["Class Name"],

          fields.Name,

          fields.Class,

          fields["Class ID"],

          fields.Code

        ]

          .filter(Boolean)

          .some(
            className =>
              String(
                className
              )
                .trim()
                .toLowerCase()
                === wanted
          );

      }
    );


  return found?.id || null;

}


/* ============================================================
   RESPONSE FORMAT
   ============================================================ */

function responseNote(record){

  return {

    airtableId:
      record.id,

    ...(record.fields || {})

  };

}


/* ============================================================
   CURRENT TIME
   ============================================================ */

function now(){

  return new Date()
    .toISOString();

}


/* ============================================================
   UPDATE NOTE
   ============================================================ */

async function updateNote(
  id,
  fields
){

  return airtable(

    `${NOTES_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast:true
    }

  );

}


/* ============================================================
   CREATE APPROVAL
   ============================================================ */

async function createApproval(
  fields
){

  return airtable(

    APPROVALS_TABLE,

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


/* ============================================================
   UPDATE APPROVAL
   ============================================================ */

async function updateApproval(
  id,
  fields
){

  return airtable(

    `${APPROVALS_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast:true
    }

  );

}


/* ============================================================
   FIND PENDING APPROVAL
   ============================================================ */

async function findPendingApproval(
  noteId
){

  const records =
    await listAll(
      APPROVALS_TABLE
    );


  return (

    records.find(
      record => {

        const fields =
          record.fields || {};


        const noteLinks =
          Array.isArray(
            fields.Note
          )
            ? fields.Note
            : [];


        return (

          String(
            fields.Status || ""
          ).trim()
          === "Pending"

          &&

          noteLinks.includes(
            noteId
          )

        );

      }
    )

    || null

  );

}


/* ============================================================
   FIND EXISTING PUBLICATION
   ============================================================ */

async function findPublication(
  noteId,
  version
){

  const wanted =
    String(
      version || ""
    ).trim();


  const records =
    await listAll(
      PUBLICATIONS_TABLE
    );


  return (

    records.find(
      record => {

        const fields =
          record.fields || {};


        const noteLinks =
          Array.isArray(
            fields.Note
          )
            ? fields.Note
            : [];


        return (

          noteLinks.includes(
            noteId
          )

          &&

          (
            !wanted

            ||

            String(
              fields.Version || ""
            ).trim()
            === wanted
          )

        );

      }
    )

    || null

  );

}


/* ============================================================
   CREATE PUBLICATION
   ============================================================ */

async function createPublication(
  fields
){

  return airtable(

    PUBLICATIONS_TABLE,

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


/* ============================================================
   UPDATE PUBLICATION
   ============================================================ */

async function updatePublication(
  id,
  fields
){

  return airtable(

    `${PUBLICATIONS_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast:true
    }

  );

}


/* ============================================================
   PUBLISH NOTE
   ============================================================ */

async function publishRecord(
  note,
  reviewerId,
  targetProgramme,
  targetClass
){

  const programme =
    String(
      targetProgramme || ""
    ).trim();


  const classValue =
    String(
      targetClass || ""
    ).trim();


  if(!programme){

    throw new Error(
      "Target Programme is required before publication."
    );

  }


  if(!classValue){

    throw new Error(
      "Target Class is required before publication."
    );

  }


  /*
   * Resolve the selected class to the
   * actual Airtable Classes record ID.
   */

  const classId =
    await findClassId(
      classValue
    );


  if(!classId){

    throw new Error(
      `Target Class "${classValue}" was not found in the Classes table.`
    );

  }


  const version =
    String(
      note.fields?.Version ||
      "1"
    ).trim();


  /*
   * Publication record.
   *
   * Programme/Class are stored HERE,
   * not in NoteBank_Notes.
   */

  const fields = {

    "Publication ID":
      `PUB-${Date.now()}-${Math.floor(Math.random() * 100000)}`,

    "Note":
      [note.id],

    "Version":
      version,

    "Target Programme":
      programme,

    "Target Class":
      [classId],

    "Publish Date":
      now(),

    "Status":
      "Published"

  };


  /*
   * Published By is linked to Teachers.
   */

  if(reviewerId){

    fields["Published By"] =
      [reviewerId];

  }


  /*
   * Avoid duplicate publication records
   * for the same Note + Version.
   */

  const existing =
    await findPublication(
      note.id,
      version
    );


  if(existing){

    const updatedFields = {

      "Note":
        [note.id],

      "Version":
        version,

      "Target Programme":
        programme,

      "Target Class":
        [classId],

      "Publish Date":
        now(),

      "Status":
        "Published"

    };


    if(reviewerId){

      updatedFields["Published By"] =
        [reviewerId];

    }


    const updated =
      await updatePublication(
        existing.id,
        updatedFields
      );


    return {

      publication:
        updated,

      created:false

    };

  }


  const created =
    await createPublication(
      fields
    );


  return {

    publication:
      created?.records?.[0] || null,

    created:true

  };

}


/* ============================================================
   MAIN HANDLER
   ============================================================ */

export default async function handler(
  req,
  res
){

  /*
   * CORS
   */

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  /*
   * OPTIONS
   */

  if(
    req.method === "OPTIONS"
  ){

    return res
      .status(200)
      .end();

  }


  try{

    config();


    const body =
      req.body || {};


    const noteId =
      req.query?.noteId ||

      body.noteId ||

      body["Note ID"];


    /* ========================================================
       GET REVIEW QUEUE
       ======================================================== */

    if(
      req.method === "GET" &&
      !noteId
    ){

      const notes =
        await listAll(
          NOTES_TABLE
        );


      const mode =
        String(
          req.query?.list ||
          "review"
        )
          .toLowerCase();


      const filtered =

        mode === "review"

          ?

          notes.filter(
            record =>
              String(
                record.fields?.Status ||
                ""
              ).trim()
              === "Under Review"
          )

          :

          notes;


      /*
       * Newest first.
       */

      filtered.sort(
        (a,b) =>

          new Date(
            b.fields?.["Updated Date"] ||
            b.fields?.["Created Date"] ||
            0
          )

          -

          new Date(
            a.fields?.["Updated Date"] ||
            a.fields?.["Created Date"] ||
            0
          )

      );


      return res
        .status(200)
        .json({

          success:true,

          count:
            filtered.length,

          notes:
            filtered.map(
              responseNote
            )

        });

    }


    /* ========================================================
       GET SINGLE NOTE
       ======================================================== */

    if(
      req.method === "GET"
    ){

      if(!noteId){

        return res
          .status(400)
          .json({

            success:false,

            error:
              "noteId is required."

          });

      }


      const note =
        await findNote(
          noteId
        );


      if(!note){

        return res
          .status(404)
          .json({

            success:false,

            error:
              "Note not found."

          });

      }


      return res
        .status(200)
        .json({

          success:true,

          note:
            responseNote(
              note
            )

        });

    }


    /* ========================================================
       NOTE ID REQUIRED FOR WRITE OPERATIONS
       ======================================================== */

    if(!noteId){

      return res
        .status(400)
        .json({

          success:false,

          error:
            "noteId is required."

        });

    }


    const note =
      await findNote(
        noteId
      );


    if(!note){

      return res
        .status(404)
        .json({

          success:false,

          error:
            "Note not found."

        });

    }


    const currentStatus =
      String(
        note.fields?.Status ||
        "AI Draft"
      ).trim();


    const action =
      String(
        body.action ||
        "save"
      )
        .trim()
        .toLowerCase();


    /* ========================================================
       SAVE DRAFT
       ======================================================== */

    if(

      ["PUT","PATCH"].includes(
        req.method
      )

      &&

      action === "save"

    ){

      /*
       * Only these fields can be edited
       * by the Review API.
       *
       * Programme/Class are deliberately
       * NOT here.
       */

      const editable = [

        "Title",

        "Learning Objectives",

        "Key Terms",

        "Content",

        "Examples",

        "Worked Examples",

        "Summary",

        "Exam Tips",

        "WAEC Focus",

        "NECO Focus",

        "UTME Focus",

        "Formulae",

        "Applications",

        "Common Misconceptions",

        "Diagrams",

        "Teacher Prompt",

        "Review Comment"

      ];


      const fields = {

        "Updated Date":
          now()

      };


      for(
        const fieldName
        of editable
      ){

        if(
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              fieldName
            )
        ){

          fields[fieldName] =
            body[fieldName];

        }

      }


      const updated =
        await updateNote(
          note.id,
          fields
        );


      return res
        .status(200)
        .json({

          success:true,

          message:
            "Note draft saved successfully.",

          status:
            updated.fields?.Status ||
            currentStatus,

          note:
            responseNote(
              updated
            )

        });

    }


    /* ========================================================
       SUBMIT FOR APPROVAL
       ======================================================== */

    if(

      ["POST","PUT","PATCH"].includes(
        req.method
      )

      &&

      action === "submit"

    ){

      if(
        ![
          "AI Draft",
          "Draft",
          "Changes Requested"
        ].includes(
          currentStatus
        )
      ){

        return res
          .status(400)
          .json({

            success:false,

            error:
              `Cannot submit note from status "${currentStatus}".`

          });

      }


      const version =
        String(
          note.fields?.Version ||
          "1"
        ).trim();


      const submittedBy =
        body.submittedBy ||

        body.createdBy ||

        body.teacherId ||

        "";


      /*
       * First move the note to Under Review.
       */

      const updated =
        await updateNote(
          note.id,
          {

            Status:
              "Under Review",

            "Updated Date":
              now()

          }
        );


      try{

        const approvalFields = {

          "Approval ID":
            `APR-${Date.now()}-${Math.floor(Math.random() * 100000)}`,

          "Note":
            [note.id],

          "Submission Date":
            now(),

          "Status":
            "Pending",

          "Version":
            version

        };


        const submittedIds =
          recordIds(
            submittedBy
          );


        if(
          submittedIds.length
        ){

          approvalFields[
            "Submitted By"
          ] =
            submittedIds;

        }


        const approval =
          await createApproval(
            approvalFields
          );


        return res
          .status(200)
          .json({

            success:true,

            message:
              "Note submitted for approval.",

            status:
              "Under Review",

            approval:
              approval?.records?.[0] ||
              null,

            note:
              responseNote(
                updated
              )

          });


      }catch(error){

        /*
         * If Approval creation fails,
         * return the note to its previous state.
         */

        try{

          await updateNote(
            note.id,
            {

              Status:
                currentStatus,

              "Updated Date":
                now()

            }
          );

        }catch(_){}


        throw error;

      }

    }


    /* ========================================================
       APPROVE & PUBLISH
       ======================================================== */

    if(

      ["POST","PUT","PATCH"].includes(
        req.method
      )

      &&

      action === "approve"

    ){

      if(
        currentStatus !==
        "Under Review"
      ){

        return res
          .status(400)
          .json({

            success:false,

            error:
              `Cannot approve note from status "${currentStatus}".`

          });

      }


      const reviewer =
        body.reviewer ||

        body.approvedBy ||

        body.teacherId ||

        "";


      /*
       * Resolve reviewer against Teachers.
       */

      const reviewerId =
        await findTeacherId(
          reviewer
        );


      const comment =
        String(

          body.reviewerComment ||

          body.reviewComment ||

          body["Review Comment"] ||

          body.comment ||

          ""

        ).trim();


      /*
       * These two values come from the
       * Review Center.
       */

      const targetProgramme =
        body.targetProgramme ||

        body["Target Programme"] ||

        "";


      const targetClass =
        body.targetClass ||

        body["Target Class"] ||

        "";


      /* ======================================================
         VALIDATE TARGET BEFORE PUBLISHING
         ====================================================== */

      if(
        !String(
          targetProgramme
        ).trim()
      ){

        return res
          .status(400)
          .json({

            success:false,

            error:
              "Target Programme is required."

          });

      }


      if(
        !String(
          targetClass
        ).trim()
      ){

        return res
          .status(400)
          .json({

            success:false,

            error:
              "Target Class is required."

          });

      }


      const classId =
        await findClassId(
          targetClass
        );


      if(!classId){

        return res
          .status(400)
          .json({

            success:false,

            error:
              `Target Class "${targetClass}" was not found in the Classes table.`

          });

      }


      /* ======================================================
         UPDATE NOTE TO PUBLISHED
         ====================================================== */

      const published =
        await updateNote(
          note.id,
          {

            Status:
              "Published",

            "Published Date":
              now(),

            "Approved Date":
              now(),

            "Updated Date":
              now(),

            ...(reviewerId
              ? {
                  "Approved By":
                    [reviewerId]
                }
              : {}),

            ...(comment
              ? {
                  "Review Comment":
                    comment
                }
              : {})

          }
        );


      try{

        /* ====================================================
           CREATE/UPDATE PUBLICATION
           ==================================================== */

        const publication =
          await publishRecord(

            published,

            reviewerId,

            targetProgramme,

            classId

          );


        /* ====================================================
           UPDATE APPROVAL
           ==================================================== */

        const pending =
          await findPendingApproval(
            note.id
          );


        let approval =
          pending;


        if(pending){

          const fields = {

            "Status":
              "Approved",

            "Review Date":
              now()

          };


          /*
           * IMPORTANT:
           * Reviewer is a linked Teacher field.
           */

          if(reviewerId){

            fields[
              "Reviewer"
            ] =
              [reviewerId];

          }


          if(comment){

            fields[
              "Reviewer Comments"
            ] =
              comment;

          }


          approval =
            await updateApproval(
              pending.id,
              fields
            );

        }


        return res
          .status(200)
          .json({

            success:true,

            message:
              "Note approved and published.",

            status:
              "Published",

            publication:
              publication.publication,

            approval,

            note:
              responseNote(
                published
              )

          });


      }catch(error){

        /*
         * If publication creation fails,
         * don't leave the system falsely showing
         * a successfully published note.
         */

        try{

          await updateNote(
            note.id,
            {

              Status:
                "Under Review",

              "Updated Date":
                now()

            }
          );

        }catch(_){}


        return res
          .status(500)
          .json({

            success:false,

            error:
              "Publication record could not be created. The note has been returned to Under Review.",

            details:
              error.message

          });

      }

    }


    /* ========================================================
       REQUEST CHANGES
       ======================================================== */

    if(

      ["POST","PUT","PATCH"].includes(
        req.method
      )

      &&

      [
        "request_changes",
        "changes",
        "reject"
      ].includes(
        action
      )

    ){

      if(
        currentStatus !==
        "Under Review"
      ){

        return res
          .status(400)
          .json({

            success:false,

            error:
              `Cannot request changes from status "${currentStatus}".`

          });

      }


      const reviewer =
        body.reviewer ||

        body.approvedBy ||

        body.teacherId ||

        "";


      const reviewerId =
        await findTeacherId(
          reviewer
        );


      const comment =
        String(

          body.reviewerComment ||

          body.reviewComment ||

          body["Review Comment"] ||

          body.comment ||

          body.reason ||

          ""

        ).trim();


      if(!comment){

        return res
          .status(400)
          .json({

            success:false,

            error:
              "A review comment is required when requesting changes."

          });

      }


      const updated =
        await updateNote(
          note.id,
          {

            Status:
              "Changes Requested",

            "Review Comment":
              comment,

            "Updated Date":
              now()

          }
        );


      const pending =
        await findPendingApproval(
          note.id
        );


      let approval =
        pending;


      if(pending){

        const fields = {

          "Status":
            "Changes Requested",

          "Review Date":
            now(),

          "Reviewer Comments":
            comment

        };


        if(reviewerId){

          fields[
            "Reviewer"
          ] =
            [reviewerId];

        }


        approval =
          await updateApproval(
            pending.id,
            fields
          );

      }


      return res
        .status(200)
        .json({

          success:true,

          message:
            "Changes requested for this note.",

          status:
            "Changes Requested",

          approval,

          note:
            responseNote(
              updated
            )

        });

    }


    /* ========================================================
       UNSUPPORTED ACTION
       ======================================================== */

    return res
      .status(400)
      .json({

        success:false,

        error:
          `Unsupported action "${action}".`

      });


  }catch(error){

    console.error(
      "Note review API error:",
      error
    );


    return res
      .status(500)
      .json({

        success:false,

        error:
          error?.message ||
          "Internal server error."

      });

  }

}
