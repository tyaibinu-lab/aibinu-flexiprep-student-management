// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// NOTEBANK REVIEW / APPROVAL API
// File: api/note-reviews.js
//
// Purpose:
//   - Read a NoteBank note
//   - Save teacher-edited drafts
//   - Submit drafts for human approval
//   - Approve/publish notes
//   - Return notes for revision
//
// IMPORTANT:
//   AI-generated content remains a draft until a human reviewer
//   approves/publishes it.
//
// This version preserves the existing workflow and fixes the
// "Note not found" problem by accepting BOTH:
//   1. Airtable Record ID (recXXXXXXXXXXXXXX)
//   2. Note ID stored in the "Note ID" field (NOTE-...)
//
// Environment variables:
//   AIRTABLE_PAT (preferred)
//   AIRTABLE_TOKEN (fallback)
//   AIRTABLE_BASE_ID
//   AIRTABLE_APPROVALS_TABLE_ID (optional)
// ============================================================

const AIRTABLE_API = "https://api.airtable.com/v0";

// Verified NoteBank_Notes table.
const NOTES_TABLE = "tblsEjHgHA7vhPgm0";

// Verified NoteBank_Approvals table.
const APPROVALS_TABLE =
  process.env.AIRTABLE_APPROVALS_TABLE_ID ||
  "tblJHGCDxEpdjm46y";

// ============================================================
// CONFIGURATION
// ============================================================

function getConfig() {
  const token =
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_TOKEN;

  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error(
      "Airtable environment variables are missing. Required: AIRTABLE_PAT/AIRTABLE_TOKEN and AIRTABLE_BASE_ID."
    );
  }

  return { token, baseId };
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
  const { token, baseId } = getConfig();

  const url = `${AIRTABLE_API}/${baseId}/${table}${query}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
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
    console.error("Airtable error:", {
      status: response.status,
      table,
      method,
      data
    });

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
//
// FIX:
// The AI generator returns the Airtable record ID. The old API
// searched only the custom "Note ID" field, causing "Note not
// found" during Save Draft and Submit for Approval.
//
// This function accepts either identifier.
// ============================================================

async function findNote(noteId) {
  const id = String(noteId || "").trim();

  if (!id) return null;

  // ----------------------------------------------------------
  // 1. Direct Airtable Record ID lookup
  // ----------------------------------------------------------

  if (/^rec[A-Za-z0-9]{14}$/.test(id)) {
    try {
      const record = await airtableRequest(
        `${NOTES_TABLE}/${id}`,
        "GET"
      );

      if (record?.id) {
        return record;
      }
    } catch (error) {
      // Fall through to custom Note ID lookup so older frontend
      // versions continue to work.
      console.warn(
        "Direct Airtable record lookup failed:",
        error.message
      );
    }
  }

  // ----------------------------------------------------------
  // 2. Search by custom Note ID field
  // ----------------------------------------------------------

  let offset = null;

  do {
    let query = "?pageSize=100";

    if (offset) {
      query += `&offset=${encodeURIComponent(offset)}`;
    }

    const data = await airtableRequest(
      NOTES_TABLE,
      "GET",
      null,
      query
    );

    const records = Array.isArray(data.records)
      ? data.records
      : [];

    const found = records.find(
      record =>
        String(record.fields?.["Note ID"] || "").trim() === id
    );

    if (found) return found;

    offset = data.offset || null;
  } while (offset);

  return null;
}

// ============================================================
// UPDATE NOTE
// ============================================================

async function updateNote(recordId, fields) {
  if (!recordId) {
    throw new Error("Airtable note record ID is required.");
  }

  return airtableRequest(
    `${NOTES_TABLE}/${recordId}`,
    "PATCH",
    { fields }
  );
}

// ============================================================
// CREATE APPROVAL RECORD
// ============================================================

async function createApproval(fields) {
  return airtableRequest(
    APPROVALS_TABLE,
    "POST",
    {
      records: [{ fields }],
      typecast: true
    }
  );
}

// ============================================================
// CURRENT DATE/TIME
// ============================================================

function now() {
  return new Date().toISOString();
}

// ============================================================
// NORMALIZE LINK FIELD
//
// Airtable linked-record fields require Airtable record IDs.
// Invalid/non-record values are ignored rather than causing an
// unnecessary write failure.
// ============================================================

function normalizeLinkedRecordIds(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .map(item => String(item || "").trim())
    .filter(item => /^rec[A-Za-z0-9]{14}$/.test(item));
}

// ============================================================
// MAIN HANDLER
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
    "GET,POST,PUT,PATCH,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // --------------------------------------------------------
    // Check configuration
    // --------------------------------------------------------

    getConfig();

    const body = req.body || {};

    const noteId =
      req.query?.noteId ||
      body.noteId ||
      body["Note ID"];

    // ========================================================
    // GET NOTE
    // ========================================================

    if (req.method === "GET") {
      if (!noteId) {
        return res.status(400).json({
          success: false,
          error: "noteId is required."
        });
      }

      const note = await findNote(noteId);

      if (!note) {
        return res.status(404).json({
          success: false,
          error: "Note not found.",
          noteId
        });
      }

      return res.status(200).json({
        success: true,
        note: {
          airtableId: note.id,
          ...(note.fields || {})
        }
      });
    }

    // ========================================================
    // WRITE OPERATIONS REQUIRE NOTE ID
    // ========================================================

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: "noteId is required."
      });
    }

    // ========================================================
    // FIND NOTE
    // ========================================================

    const note = await findNote(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: "Note not found.",
        noteId
      });
    }

    const currentFields = note.fields || {};

    const currentStatus =
      currentFields["Status"] ||
      "AI Draft";

    const action = String(
      body.action || "save"
    )
      .trim()
      .toLowerCase();

    // ========================================================
    // SAVE EDITED DRAFT
    // ========================================================

    if (
      (req.method === "PUT" || req.method === "PATCH") &&
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

      for (const field of editableFields) {
        if (
          Object.prototype.hasOwnProperty.call(
            body,
            field
          )
        ) {
          fields[field] = body[field];
        }
      }

      fields["Updated Date"] = now();

      const updated = await updateNote(
        note.id,
        fields
      );

      return res.status(200).json({
        success: true,
        message: "Note draft saved successfully.",
        status:
          updated.fields?.["Status"] ||
          currentStatus,
        note: {
          airtableId: updated.id,
          ...(updated.fields || {})
        }
      });
    }

    // ========================================================
    // SUBMIT FOR APPROVAL
    // ========================================================

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

      if (!allowedStatuses.includes(currentStatus)) {
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

      const version = String(
        currentFields["Version"] || "1"
      );

      // ------------------------------------------------------
      // Change note status FIRST
      // ------------------------------------------------------

      const updated = await updateNote(
        note.id,
        {
          "Status": "Under Review",
          "Updated Date": now()
        }
      );

      // ------------------------------------------------------
      // Create approval record
      // ------------------------------------------------------

      const approvalFields = {
        "Approval ID":
          `APR-${Date.now()}-${Math.floor(
            Math.random() * 100000
          )}`,

        "Note": [note.id],

        "Submission Date": now(),

        "Status": "Pending",

        "Version": version
      };

      // Submitted By is a linked-record field. Only write it
      // when valid Airtable Teacher record IDs were supplied.
      const submittedByIds =
        normalizeLinkedRecordIds(submittedBy);

      if (submittedByIds.length) {
        approvalFields["Submitted By"] =
          submittedByIds;
      }

      let approval;

      try {
        approval = await createApproval(
          approvalFields
        );
      } catch (approvalError) {
        console.error(
          "Approval record creation failed:",
          approvalError
        );

        // ----------------------------------------------------
        // ROLLBACK NOTE STATUS
        // ----------------------------------------------------

        try {
          await updateNote(
            note.id,
            {
              "Status": currentStatus,
              "Updated Date": now()
            }
          );
        } catch (rollbackError) {
          console.error(
            "Note status rollback failed:",
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
        message: "Note submitted for approval.",
        status: "Under Review",
        approvalId:
          approval?.records?.[0]?.id ||
          null,
        note: {
          airtableId: updated.id,
          ...(updated.fields || {})
        }
      });
    }

    // ========================================================
    // ADMIN APPROVE / PUBLISH
    // ========================================================

    if (
      req.method === "POST" &&
      action === "approve"
    ) {
      if (
        currentStatus !== "Under Review" &&
        currentStatus !== "Approved"
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
        "Status": "Published",
        "Updated Date": now(),
        "Approved Date": now()
      };

      const approvedByIds =
        normalizeLinkedRecordIds(approvedBy);

      if (approvedByIds.length) {
        fields["Approved By"] = approvedByIds;
      }

      const updated = await updateNote(
        note.id,
        fields
      );

      return res.status(200).json({
        success: true,
        message: "Note approved and published.",
        status: "Published",
        note: {
          airtableId: updated.id,
          ...(updated.fields || {})
        }
      });
    }

    // ========================================================
    // ADMIN REQUEST CHANGES
    // ========================================================

    if (
      req.method === "POST" &&
      action === "reject"
    ) {
      const reason =
        body.reason ||
        "Revision required.";

      const updated = await updateNote(
        note.id,
        {
          "Status": "Changes Requested",
          "Review Comment": reason,
          "Updated Date": now()
        }
      );

      return res.status(200).json({
        success: true,
        message: "Note returned for revision.",
        status: "Changes Requested",
        note: {
          airtableId: updated.id,
          ...(updated.fields || {})
        }
      });
    }

    // ========================================================
    // INVALID ACTION
    // ========================================================

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
