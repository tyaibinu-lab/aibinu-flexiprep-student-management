// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// NOTEBANK REVIEW / APPROVAL API
// api/note-reviews.js
//
// Workflow:
//
// AI Draft
//    ↓
// Edit Draft
//    ↓
// Save Draft
//    ↓
// Submit for Approval
//    ↓
// Pending Review
//    ↓
// Admin Approves
//    ↓
// Published
//
// This file does NOT generate AI content.
// It manages the NoteBank review workflow.
// ============================================================

const AIRTABLE_API =
  "https://api.airtable.com/v0";

const NOTES_TABLE =
  "tblsEjHgHA7vhPgm0";


// ============================================================
// HELPER — CONFIGURATION
// ============================================================

function getConfig() {

  const {
    AIRTABLE_PAT,
    AIRTABLE_TOKEN,
    AIRTABLE_BASE_ID
  } = process.env;


  const token =
    AIRTABLE_PAT ||
    AIRTABLE_TOKEN;


  if (!token || !AIRTABLE_BASE_ID) {

    throw new Error(
      "Airtable environment variables are missing."
    );

  }


  return {
    token,
    baseId: AIRTABLE_BASE_ID
  };

}


// ============================================================
// HELPER — AIRTABLE REQUEST
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


  const url =
    `${AIRTABLE_API}/${baseId}/${table}${query}`;


  const options = {

    method,

    headers: {

      Authorization:
        `Bearer ${token}`,

      "Content-Type":
        "application/json"

    }

  };


  if (body !== null) {

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
// FIND NOTE
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


    const records =
      data.records || [];


    const found =
      records.find(record => {

        const f =
          record.fields || {};


        return (
          String(f["Note ID"] || "") ===
          String(noteId)
        );

      });


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
// STATUS NORMALIZATION
// ============================================================

function normalizeStatus(value) {

  const valid = [

    "AI Draft",
    "Draft",
    "Pending Review",
    "Under Review",
    "Approved",
    "Published",
    "Rejected",
    "Archived"

  ];


  const valueText =
    String(value || "")
      .trim()
      .toLowerCase();


  const found =
    valid.find(
      item =>
        item.toLowerCase() ===
        valueText
    );


  return found || null;

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
       CONFIG CHECK
       ====================================================== */

    getConfig();


    /* ======================================================
       REQUEST METHOD
       ====================================================== */

    const method =
      req.method;


    /* ======================================================
       GET NOTE
       ====================================================== */

    if (
      method === "GET"
    ) {

      const noteId =
        req.query?.noteId;


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
       READ REQUEST BODY
       ====================================================== */

    const body =
      req.body || {};


    const noteId =
      body.noteId ||
      body["Note ID"];


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


    /* ======================================================
       SAVE DRAFT
       ====================================================== */

    if (
      method === "PUT" ||
      method === "PATCH"
    ) {

      const action =
        String(
          body.action ||
          "save"
        )
        .toLowerCase();


      /* ====================================================
         SUBMIT FOR APPROVAL
         ==================================================== */

      if (
        action ===
        "submit"
      ) {

        if (
          currentStatus !==
            "AI Draft" &&
          currentStatus !==
            "Draft"
        ) {

          return res.status(400).json({

            success: false,

            error:
              `This note cannot be submitted from status "${currentStatus}".`

          });

        }


        const updated =
          await updateNote(

            note.id,

            {

              "Status":
                "Pending Review",

              "Updated Date":
                new Date()
                  .toISOString()

            }

          );


        return res.status(200).json({

          success: true,

          message:
            "Note submitted for approval.",

          status:
            "Pending Review",

          note: {

            airtableId:
              updated.id,

            ...(updated.fields || {})

          }

        });

      }


      /* ====================================================
         SAVE EDITED DRAFT
         ==================================================== */

      if (
        action ===
        "save"
      ) {

        const allowedFields = [

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

          "Updated Date"

        ];


        const fields = {};


        for (
          const field
          of allowedFields
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
          new Date()
            .toISOString();


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


      return res.status(400).json({

        success: false,

        error:
          "Invalid action. Use 'save' or 'submit'."

      });

    }


    /* ======================================================
       POST ACTIONS
       ====================================================== */

    if (
      method === "POST"
    ) {

      const action =
        String(
          body.action ||
          ""
        )
        .toLowerCase();


      /* ====================================================
         SUBMIT
         ==================================================== */

      if (
        action ===
        "submit"
      ) {

        if (
          currentStatus !==
            "AI Draft" &&
          currentStatus !==
            "Draft"
        ) {

          return res.status(400).json({

            success: false,

            error:
              `Cannot submit note from status "${currentStatus}".`

          });

        }


        const updated =
          await updateNote(

            note.id,

            {

              "Status":
                "Pending Review",

              "Updated Date":
                new Date()
                  .toISOString()

            }

          );


        return res.status(200).json({

          success: true,

          message:
            "Note submitted for approval.",

          status:
            "Pending Review",

          note: {

            airtableId:
              updated.id,

            ...(updated.fields || {})

          }

        });

      }


      /* ====================================================
         APPROVE
         ==================================================== */

      if (
        action ===
        "approve"
      ) {

        if (
          currentStatus !==
            "Pending Review" &&
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
          "";


        const fields = {

          "Status":
            "Published",

          "Updated Date":
            new Date()
              .toISOString(),

          "Approved Date":
            new Date()
              .toISOString()

        };


        if (approvedBy) {

          fields[
            "Approved By"
          ] = approvedBy;

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


      /* ====================================================
         REJECT
         ==================================================== */

      if (
        action ===
        "reject"
      ) {

        const reason =
          body.reason ||
          "Revision required.";


        const updated =
          await updateNote(

            note.id,

            {

              "Status":
                "Draft",

              "Updated Date":
                new Date()
                  .toISOString(),

              "Review Comment":
                reason

            }

          );


        return res.status(200).json({

          success: true,

          message:
            "Note returned for revision.",

          status:
            "Draft",

          note: {

            airtableId:
              updated.id,

            ...(updated.fields || {})

          }

        });

      }


      return res.status(400).json({

        success: false,

        error:
          "Invalid action."

      });

    }


    /* ======================================================
       METHOD NOT ALLOWED
       ====================================================== */

    return res.status(405).json({

      success: false,

      error:
        "Method not allowed."

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
