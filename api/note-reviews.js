// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// NOTEBANK REVIEW / APPROVAL API
// File: api/note-reviews.js
//
// Supports:
//   GET  /api/note-reviews?list=review
//   GET  /api/note-reviews?noteId=...
//   PATCH ... action=save
//   POST  ... action=submit
//   POST  ... action=approve
//   POST  ... action=request_changes
//
// AI content is NEVER approved automatically.
// Human review is required before publication.
// ============================================================

const AIRTABLE_API = "https://api.airtable.com/v0";

const NOTES_TABLE = "tblsEjHgHA7vhPgm0";

const APPROVALS_TABLE =
  process.env.AIRTABLE_APPROVALS_TABLE_ID ||
  "tblJHGCDxEpdjm46y";

const TEACHERS_TABLE = "tblVjuSJe4R5kcOZr";


function getConfig() {

  const token =
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_TOKEN;

  const baseId =
    process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {

    throw new Error(
      "Airtable environment variables are missing. Required: AIRTABLE_PAT/AIRTABLE_TOKEN and AIRTABLE_BASE_ID."
    );

  }

  return {
    token,
    baseId
  };

}


function headers(token) {

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

}


async function airtableRequest(
  table,
  method = "GET",
  body = null,
  query = ""
) {

  const {
    token,
    baseId
  } = getConfig();

  const response =
    await fetch(
      `${AIRTABLE_API}/${baseId}/${table}${query}`,
      {
        method,
        headers: headers(token),

        ...(body !== null
          ? {
              body:
                JSON.stringify(body)
            }
          : {})
      }
    );


  const text =
    await response.text();

  let data;

  try {

    data =
      text
        ? JSON.parse(text)
        : {};

  } catch {

    data = {
      raw: text
    };

  }


  if(!response.ok){

    console.error(
      "Airtable error:",
      {
        status:
          response.status,

        table,
        method,
        data
      }
    );

    throw new Error(
      data?.error?.message ||
      data?.error?.type ||
      `Airtable request failed (${response.status})`
    );

  }


  return data;

}


async function listAll(table){

  const out = [];

  let offset = "";


  do{

    const query =
      offset
        ? `?pageSize=100&offset=${encodeURIComponent(offset)}`
        : "?pageSize=100";


    const data =
      await airtableRequest(
        table,
        "GET",
        null,
        query
      );


    out.push(
      ...(data.records || [])
    );


    offset =
      data.offset || "";

  }while(offset);


  return out;

}


async function findNote(noteId){

  const id =
    String(noteId || "")
      .trim();


  if(!id)
    return null;


  if(
    /^rec[A-Za-z0-9]{14}$/
      .test(id)
  ){

    try{

      const record =
        await airtableRequest(
          `${NOTES_TABLE}/${id}`,
          "GET"
        );


      if(record?.id)
        return record;

    }catch(error){

      console.warn(
        "Direct Airtable note lookup failed:",
        error.message
      );

    }

  }


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
    ) || null
  );

}


async function updateNote(
  recordId,
  fields
){

  if(!recordId){

    throw new Error(
      "Airtable note record ID is required."
    );

  }


  return airtableRequest(
    `${NOTES_TABLE}/${recordId}`,
    "PATCH",
    {
      fields
    }
  );

}


async function createApproval(fields){

  return airtableRequest(
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


async function updateApproval(
  recordId,
  fields
){

  if(!recordId)
    return null;


  return airtableRequest(
    `${APPROVALS_TABLE}/${recordId}`,
    "PATCH",
    {
      fields
    }
  );

}


async function findPendingApproval(
  noteRecordId
){

  if(!noteRecordId)
    return null;


  const approvals =
    await listAll(
      APPROVALS_TABLE
    );


  return (
    approvals.find(
      record => {

        const links =
          record.fields?.["Note"];


        const status =
          String(
            record.fields?.["Status"] || ""
          ).trim();


        const linkedIds =
          Array.isArray(links)
            ? links
            : [];


        return (
          status === "Pending" &&
          linkedIds.includes(
            noteRecordId
          )
        );

      }
    ) || null
  );

}


function now(){

  return new Date()
    .toISOString();

}


function normalizeLinkedRecordIds(
  value
){

  if(
    value === undefined ||
    value === null ||
    value === ""
  ){

    return [];

  }


  const values =
    Array.isArray(value)
      ? value
      : [value];


  return values
    .map(
      item =>
        String(
          item || ""
        ).trim()
    )
    .filter(
      item =>
        /^rec[A-Za-z0-9]{14}$/
          .test(item)
    );

}


async function resolveTeacherId(
  value
){

  const direct =
    normalizeLinkedRecordIds(
      value
    );


  if(direct.length)
    return direct[0];


  const name =
    String(
      value || ""
    ).trim();


  if(!name)
    return null;


  try{

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
              candidate =>
                String(candidate)
                  .trim()
                  .toLowerCase() ===
                name.toLowerCase()
            );

        }
      );


    return found?.id || null;

  }catch(error){

    console.warn(
      "Unable to resolve reviewer:",
      error.message
    );

    return null;

  }

}


function noteResponse(record){

  return {
    airtableId:
      record.id,

    ...(record.fields || {})
  };

}


export default async function handler(
  req,
  res
){

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


  if(req.method === "OPTIONS"){

    return res
      .status(200)
      .end();

  }


  try{

    getConfig();


    const body =
      req.body || {};


    const noteId =
      req.query?.noteId ||
      body.noteId ||
      body["Note ID"];


    // ========================================================
    // REVIEW QUEUE
    // GET /api/note-reviews?list=review
    // ========================================================

    if(
      req.method === "GET" &&
      !noteId
    ){

      const mode =
        String(
          req.query?.list ||
          "review"
        ).toLowerCase();


      const notes =
        await listAll(
          NOTES_TABLE
        );


      let filtered =
        notes;


      if(mode === "review"){

        filtered =
          notes.filter(
            record =>
              String(
                record.fields?.["Status"] ||
                ""
              ).trim() ===
              "Under Review"
          );

      }


      filtered.sort(
        (a,b) => {

          const da =
            new Date(
              a.fields?.["Updated Date"] ||
              a.fields?.["Created Date"] ||
              0
            ).getTime();


          const db =
            new Date(
              b.fields?.["Updated Date"] ||
              b.fields?.["Created Date"] ||
              0
            ).getTime();


          return db - da;

        }
      );


      return res.status(200).json({

        success:true,

        count:
          filtered.length,

        notes:
          filtered.map(
            noteResponse
          )

      });

    }


    // ========================================================
    // SINGLE NOTE
    // ========================================================

    if(req.method === "GET"){

      if(!noteId){

        return res.status(400).json({

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

        return res.status(404).json({

          success:false,

          error:
            "Note not found.",

          noteId

        });

      }


      return res.status(200).json({

        success:true,

        note:
          noteResponse(note)

      });

    }


    if(!noteId){

      return res.status(400).json({

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

      return res.status(404).json({

        success:false,

        error:
          "Note not found.",

        noteId

      });

    }


    const currentFields =
      note.fields || {};


    const currentStatus =
      currentFields["Status"] ||
      "AI Draft";


    const action =
      String(
        body.action ||
        "save"
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // SAVE
    // ========================================================

    if(
      (
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      action === "save"
    ){

      const editableFields = [

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


      const fields = {};


      for(
        const field of
        editableFields
      ){

        if(
          Object.prototype
            .hasOwnProperty.call(
              body,
              field
            )
        ){

          fields[field] =
            body[field];

        }

      }


      fields["Updated Date"] =
        now();


      const updated =
        await updateNote(
          note.id,
          fields
        );


      return res.status(200).json({

        success:true,

        message:
          "Note draft saved successfully.",

        status:
          updated.fields?.["Status"] ||
          currentStatus,

        note:
          noteResponse(updated)

      });

    }


    // ========================================================
    // SUBMIT
    // ========================================================

    if(
      (
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      action === "submit"
    ){

      const allowedStatuses = [

        "AI Draft",

        "Draft",

        "Changes Requested"

      ];


      if(
        !allowedStatuses.includes(
          currentStatus
        )
      ){

        return res.status(400).json({

          success:false,

          error:
            `Cannot submit note from status "${currentStatus}".`

        });

      }


      const submittedBy =
        body.submittedBy ||
        body.createdBy ||
        body.teacherId ||
        "";


      const version =
        String(
          currentFields["Version"] ||
          "1"
        );


      const updated =
        await updateNote(
          note.id,
          {
            "Status":
              "Under Review",

            "Updated Date":
              now()
          }
        );


      const approvalFields = {

        "Approval ID":
          `APR-${Date.now()}-${Math.floor(
            Math.random() * 100000
          )}`,

        "Note":
          [note.id],

        "Submission Date":
          now(),

        "Status":
          "Pending",

        "Version":
          version

      };


      const submittedByIds =
        normalizeLinkedRecordIds(
          submittedBy
        );


      if(
        submittedByIds.length
      ){

        approvalFields[
          "Submitted By"
        ] =
          submittedByIds;

      }


      let approval;


      try{

        approval =
          await createApproval(
            approvalFields
          );

      }catch(approvalError){

        console.error(
          "Approval record creation failed:",
          approvalError
        );


        try{

          await updateNote(
            note.id,
            {
              "Status":
                currentStatus,

              "Updated Date":
                now()
            }
          );

        }catch(rollbackError){

          console.error(
            "Rollback failed:",
            rollbackError
          );

        }


        throw new Error(

          "Approval record could not be created. " +
          "The note was returned to its previous status. " +
          approvalError.message

        );

      }


      return res.status(200).json({

        success:true,

        message:
          "Note submitted for approval.",

        status:
          "Under Review",

        approvalId:
          approval
            ?.records?.[0]?.id ||
          null,

        note:
          noteResponse(updated)

      });

    }


    // ========================================================
    // APPROVE AND PUBLISH
    // ========================================================

    if(
      req.method === "POST" &&
      action === "approve"
    ){

      if(
        currentStatus !==
          "Under Review" &&
        currentStatus !==
          "Approved"
      ){

        return res.status(400).json({

          success:false,

          error:
            `Cannot approve note from status "${currentStatus}".`

        });

      }


      const reviewer =
        body.reviewerId ||
        body.reviewer ||
        body.approvedBy ||
        "";


      const comment =
        String(
          body.reviewerComment ||
          body.comment ||
          body.reason ||
          ""
        ).trim();


      const reviewerId =
        await resolveTeacherId(
          reviewer
        );


      const fields = {

        "Status":
          "Published",

        "Updated Date":
          now(),

        "Approved Date":
          now()

      };


      if(reviewerId){

        fields[
          "Approved By"
        ] =
          [reviewerId];

      }


      if(comment){

        fields[
          "Review Comment"
        ] =
          comment;

      }


      const updated =
        await updateNote(
          note.id,
          fields
        );


      let approvalUpdated =
        false;


      try{

        const approval =
          await findPendingApproval(
            note.id
          );


        if(approval){

          const approvalFields = {

            "Status":
              "Approved",

            "Review Date":
              now()

          };


          if(comment){

            approvalFields[
              "Reviewer Comments"
            ] =
              comment;

          }


          if(reviewerId){

            approvalFields[
              "Reviewer"
            ] =
              [reviewerId];

          }


          await updateApproval(
            approval.id,
            approvalFields
          );


          approvalUpdated =
            true;

        }

      }catch(approvalError){

        console.error(
          "Approval history update failed:",
          approvalError
        );

      }


      return res.status(200).json({

        success:true,

        message:
          "Note approved and published.",

        status:
          "Published",

        approvalUpdated,

        note:
          noteResponse(updated)

      });

    }


    // ========================================================
    // REQUEST CHANGES
    // ========================================================

    if(
      req.method === "POST" &&
      (
        action === "request_changes" ||
        action === "changes" ||
        action === "reject"
      )
    ){

      if(
        currentStatus !==
        "Under Review"
      ){

        return res.status(400).json({

          success:false,

          error:
            `Cannot request changes from status "${currentStatus}".`

        });

      }


      const reason =
        String(
          body.reason ||
          body.reviewerComment ||
          body.comment ||
          ""
        ).trim();


      if(!reason){

        return res.status(400).json({

          success:false,

          error:
            "Reviewer comment is required when requesting changes."

        });

      }


      const reviewer =
        body.reviewerId ||
        body.reviewer ||
        "";


      const reviewerId =
        await resolveTeacherId(
          reviewer
        );


      const updated =
        await updateNote(
          note.id,
          {
            "Status":
              "Changes Requested",

            "Review Comment":
              reason,

            "Updated Date":
              now()
          }
        );


      let approvalUpdated =
        false;


      try{

        const approval =
          await findPendingApproval(
            note.id
          );


        if(approval){

          const approvalFields = {

            "Status":
              "Changes Requested",

            "Review Date":
              now(),

            "Reviewer Comments":
              reason

          };


          if(reviewerId){

            approvalFields[
              "Reviewer"
            ] =
              [reviewerId];

          }


          await updateApproval(
            approval.id,
            approvalFields
          );


          approvalUpdated =
            true;

        }

      }catch(approvalError){

        console.error(
          "Approval history update failed:",
          approvalError
        );

      }


      return res.status(200).json({

        success:true,

        message:
          "Note returned for revision.",

        status:
          "Changes Requested",

        approvalUpdated,

        note:
          noteResponse(updated)

      });

    }


    return res.status(400).json({

      success:false,

      error:
        "Invalid action. Use save, submit, approve or request_changes."

    });


  }catch(error){

    console.error(
      "NOTEBANK REVIEW API ERROR:",
      error
    );


    return res.status(500).json({

      success:false,

      error:
        error.message ||
        "NoteBank review operation failed."

    });

  }

}
