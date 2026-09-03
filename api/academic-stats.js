const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  notes: "tblsEjHgHA7vhPgm0",
  approvals: "tblJHGCDxEpdjm46y",
  aiJobs: "tbldFSYwYcTMtMm9A"
};

function config() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error("Airtable environment variables are not configured.");
  }

  return { token, baseId };
}

async function listAll(baseId, tableId, token) {
  const all = [];
  let offset = null;

  do {
    const url =
      `${AIRTABLE_API}/${baseId}/${tableId}` +
      (offset
        ? `?offset=${encodeURIComponent(offset)}`
        : "");

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const d = await r.json();

    if (!r.ok) {
      throw new Error(
        d.error?.message || "Airtable read failed"
      );
    }

    all.push(...(d.records || []));
    offset = d.offset || null;

  } while (offset);

  return all;
}

function value(v) {
  if (
    v &&
    typeof v === "object" &&
    !Array.isArray(v)
  ) {
    return String(v.name || "").trim();
  }

  return String(v ?? "").trim();
}

export default async function handler(req, res) {

  /* =====================================================
     METHOD CHECK
  ===================================================== */

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {

    const {
      token,
      baseId
    } = config();


    /* =====================================================
       LOAD AIRTABLE DATA
    ===================================================== */

    const [
      notes,
      approvals,
      aiJobs
    ] = await Promise.all([

      listAll(
        baseId,
        TABLES.notes,
        token
      ),

      listAll(
        baseId,
        TABLES.approvals,
        token
      ),

      listAll(
        baseId,
        TABLES.aiJobs,
        token
      )

    ]);


    /* =====================================================
       NOTE DRAFTS
       
       These are notes which are not yet published.
       Changes Requested is also treated as draft because
       the note still requires revision.
    ===================================================== */

    const noteDrafts =
      notes.filter(r => {

        const status =
          value(
            r.fields?.Status
          ).toLowerCase();

        return [
          "ai draft",
          "draft",
          "changes requested"
        ].includes(status);

      }).length;


    /* =====================================================
       PUBLISHED NOTES
       
       NoteBank_Notes.Status is the authoritative source.
    ===================================================== */

    const published =
      notes.filter(r => {

        const status =
          value(
            r.fields?.Status
          ).toLowerCase();

        return status === "published";

      }).length;


    /* =====================================================
       PENDING REVIEW
       
       Only approval records genuinely waiting for a
       reviewer are counted.
    ===================================================== */

    const pendingReview =
      approvals.filter(r => {

        const status =
          value(
            r.fields?.Status
          ).toLowerCase();

        return [
          "pending",
          "submitted",
          "under review",
          "pending review"
        ].includes(status);

      }).length;


    /* =====================================================
       AI JOBS
    ===================================================== */

    const generatedAIJobs =
      aiJobs.filter(r => {

        const status =
          value(
            r.fields?.Status
          ).toLowerCase();

        return status === "generated";

      });


    /* =====================================================
       AI NOTE JOBS
    ===================================================== */

    const aiNoteJobs =
      generatedAIJobs.filter(r => {

        const contentType =
          value(
            r.fields?.["Content Type"]
          ).toLowerCase();

        return contentType === "note";

      }).length;


    /* =====================================================
       AI QUESTION JOBS
    ===================================================== */

    const aiQuestionJobs =
      generatedAIJobs.filter(r => {

        const contentType =
          value(
            r.fields?.["Content Type"]
          ).toLowerCase();

        return contentType === "question";

      }).length;


    /* =====================================================
       DASHBOARD DRAFT CONTENT
       
       Current database:
       
       6 unpublished note records
       +
       2 generated question jobs
       =
       8 draft content items
    ===================================================== */

    const draftContent =
      noteDrafts +
      aiQuestionJobs;


    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({

      success: true,

      /* Main dashboard value */
      draftContent,

      /* Backward compatibility */
      draftNotes: draftContent,

      /* Detailed values */
      noteDrafts,

      draftQuestions:
        aiQuestionJobs,

      pendingReview,

      published,

      /* All AI jobs */
      aiJobs:
        aiJobs.length,

      /* Generated jobs only */
      generatedAIJobs:
        generatedAIJobs.length,

      /* Breakdown */
      aiNoteJobs,

      aiQuestionJobs,

      /* Timestamp */
      generatedAt:
        new Date().toISOString()

    });

  } catch (error) {

    console.error(
      "Academic stats error:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to load academic statistics."

    });

  }
}
