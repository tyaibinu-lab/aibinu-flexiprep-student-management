// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// NOTEBANK REVIEW / APPROVAL API
// api/note-reviews.js
// ============================================================

const AIRTABLE_API =
  "https://api.airtable.com/v0";

const NOTES_TABLE =
  "tblsEjHgHA7vhPgm0";

// IMPORTANT:
// Replace this with the actual Airtable ID of your
// NoteBank_Approvals table if different.
const APPROVALS_TABLE =
  "tblJHGCDxEpdjm46y";


// ============================================================
// CONFIGURATION
// ============================================================

function getConfig() {

  const token =
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_TOKEN;

  const baseId =
    process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error(
      "Airtable environment variables are missing."
    );
  }

  return {
    token,
    baseId
  };
}


// ============================================================
// AIRTABLE REQUEST
// ============================================================

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

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json"
        },

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
      JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }


  if (!response.ok) {

    console.error(
      "Airtable error:",
      data
    );

    throw new Error(
      data?.error?.message ||
      data?.error?.type ||
      `Airtable request failed (${response.status})`
    );
  }


  return data;
}


// ============================================================
// FIND NOTE BY NOTE ID
// ============================================================

async function findNote(noteId) {

  let offset = null;

  do {

    let query =
      "?pageSize=100";

    if (offset) {

      query +=
        `&offset=${encodeURIComponent(offset)}`;

    }


    const data =
      await airtableRequest(
        NOTES_TABLE,
        "GET",
        null,
        query
      );


    const found =
      (data.records || []).find(
        record =>
          String(
            record.fields?.["Note ID"] || ""
          ) === String(noteId)
      );


    if (found) {
      return found;
    }


    offset =
      data.offset || null;


  } while (offset);


  return null;
}


// ============================================================
// UPDATE NOTE
// ============================================================

async function updateNote(
  recordId,
  fields
) {

  return airtableRequest(
    `${NOTES_TABLE}/${recordId}`,
    "PATCH",
    {
      fields
    }
  );
}


// ============================================================
// CREATE APPROVAL RECORD
// ============================================================

async function createApproval(
  fields
) {

  return airtableRequest(
    APPROVALS_TABLE,
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
// CURRENT DATE
// ============================================================

function now() {

  return new Date()
    .toISOString();

}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  try {

    /* ======================================================
       CORS
       ====================================================== */

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


    if (
      req.method ===
      "OPTIONS"
    ) {

      return res
        .status(200)
        .end();

    }


    /* ======================================================
       CHECK CONFIGURATION
       ====================================================== */

    getConfig();


    const body =
      req.body || {};


    const noteId =
      req.query?.noteId ||
      body.noteId ||
      body["Note ID"];


    /* ======================================================
       GET NOTE
       ====================================================== */

    if (
      req.method ===
      "GET"
    ) {

      if (!noteId) {

        return res.status(400).json({

          success: false,

          error:
            "noteId is required."

        });

      }


      const note =
        await findNote(noteId);


      if (!note) {

        return res.status(404).json({

          success: false,

          error:
            "Note not found.",

          noteId

        });

      }


      return res.status(200).json({

        success: true,

        note: {

          airtableId:
            note.id,

          ...(note.fields || {})

        }

      });

    }


    /* ======================================================
       NOTE ID REQUIRED FOR WRITE OPERATIONS
       ====================================================== */

    if (!noteId) {

      return res.status(400).json({

        success: false,

        error:
          "noteId is required."

      });

    }


    /* ======================================================
       FIND NOTE
       ====================================================== */

    const note =
      await findNote(noteId);


    if (!note) {

      return res.status(404).json({

        success: false,

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


    /* ======================================================
       SAVE EDITED DRAFT
       ====================================================== */

    if (
      (
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      action === "save"
    ) {

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


      for (
        const field
        of editableFields
      ) {

        if (
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              field
            )
        ) {

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

        success: true,

        message:
          "Note draft saved successfully.",

        status:
          currentStatus,

        note: {

          airtableId:
            updated.id,

          ...(updated.fields || {})

        }

      });

    }


    /* ======================================================
       SUBMIT FOR APPROVAL
       ====================================================== */

    if (
      (
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      action === "submit"
    ) {

      const allowedStatuses = [

        "AI Draft",

        "Draft",

        "Changes Requested"

      ];


      if (
        !allowedStatuses.includes(
          currentStatus
        )
      ) {

        return res.status(400).json({

          success: false,

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


      /* ----------------------------------------------------
         CHANGE NOTE STATUS
         ---------------------------------------------------- */

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


      /* ----------------------------------------------------
         CREATE APPROVAL RECORD
         ---------------------------------------------------- */

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


      if (submittedBy) {

        approvalFields[
          "Submitted By"
        ] =
          Array.isArray(
            submittedBy
          )
            ? submittedBy
            : [submittedBy];

      }


      let approval;

      try {

        approval =
          await createApproval(
            approvalFields
          );

      } catch (approvalError) {

        /* --------------------------------------------------
           ROLLBACK NOTE STATUS
           -------------------------------------------------- */

        try {

          await updateNote(

            note.id,

            {

              "Status":
                currentStatus,

              "Updated Date":
                now()

            }

          );

        } catch (rollbackError) {

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

        success: true,

        message:
          "Note submitted for approval.",

        status:
          "Under Review",

        approvalId:
          approval
            ?.records?.[0]?.id ||
          null,

        note: {

          airtableId:
            updated.id,

          ...(updated.fields || {})

        }

      });

    }


    /* ======================================================
       ADMIN APPROVE
       ====================================================== */

    if (
      req.method === "POST" &&
      action === "approve"
    ) {

      if (
        currentStatus !==
          "Under Review" &&
        currentStatus !==
          "Approved"
      ) {

        return res.status(400).json({

          success: false,

          error:
            `Cannot approve note from status "${currentStatus}".`

        });

      }


      const approvedBy =
        body.approvedBy ||
        body.reviewer ||
        "";


      const fields = {

        "Status":
          "Published",

        "Updated Date":
          now(),

        "Approved Date":
          now()

      };


      if (approvedBy) {

        fields[
          "Approved By"
        ] =
          Array.isArray(
            approvedBy
          )
            ? approvedBy
            : [approvedBy];

      }


      const updated =
        await updateNote(

          note.id,

          fields

        );


      return res.status(200).json({

        success: true,

        message:
          "Note approved and published.",

        status:
          "Published",

        note: {

          airtableId:
            updated.id,

          ...(updated.fields || {})

        }

      });

    }


    /* ======================================================
       ADMIN REQUEST CHANGES
       ====================================================== */

    if (
      req.method === "POST" &&
      action === "reject"
    ) {

      const reason =
        body.reason ||
        "Revision required.";


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


      return res.status(200).json({

        success: true,

        message:
          "Note returned for revision.",

        status:
          "Changes Requested",

        note: {

          airtableId:
            updated.id,

          ...(updated.fields || {})

        }

      });

    }


    /* ======================================================
       INVALID ACTION
       ====================================================== */

    return res.status(400).json({

      success: false,

      error:
        "Invalid action. Use save, submit, approve or reject."

    });


  } catch (error) {

    console.error(
      "NOTEBANK REVIEW API ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "NoteBank review operation failed."

    });

  }

}
