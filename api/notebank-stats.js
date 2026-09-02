// ============================================================
// AIBINU FLEXIPREP NOTEBANK STATISTICS API
// ============================================================

const AIRTABLE_API = "https://api.airtable.com/v0";

const NOTES_TABLE = "tblsEjHgHA7vhPgm0";
const JOBS_TABLE = "tbldFSYwYcTMtMm9A";

async function listAll(baseId, table, token) {
  const out = [];
  let offset = "";

  do {
    const query = offset
      ? `?pageSize=100&offset=${encodeURIComponent(offset)}`
      : "?pageSize=100";

    const response = await fetch(
      `${AIRTABLE_API}/${baseId}/${table}${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Airtable returned invalid JSON (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        `Airtable request failed (${response.status}).`
      );
    }

    out.push(...(data.records || []));

    offset = data.offset || "";

  } while (offset);

  return out;
}

export default async function handler(req, res) {

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

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

    const [notes, jobs] =
      await Promise.all([
        listAll(
          baseId,
          NOTES_TABLE,
          token
        ),

        listAll(
          baseId,
          JOBS_TABLE,
          token
        )
      ]);

    const statuses =
      notes.map(
        record =>
          String(
            record.fields?.Status || ""
          ).trim()
      );

    const draftNotes =
      statuses.filter(status =>
        [
          "AI Draft",
          "Draft",
          "Changes Requested"
        ].includes(status)
      ).length;

    const pendingReview =
      statuses.filter(
        status =>
          status === "Under Review"
      ).length;

    const published =
      statuses.filter(
        status =>
          status === "Published"
      ).length;

    return res.status(200).json({

      success: true,

      draftNotes,

      pendingReview,

      published,

      aiJobs: jobs.length

    });

  } catch (error) {

    console.error(
      "NOTEBANK STATS ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to load NoteBank statistics."

    });

  }

}
