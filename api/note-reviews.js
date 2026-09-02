// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// NOTEBANK REVIEW / APPROVAL API
// File: api/note-reviews.js
//
// Supports:
//   GET  /api/note-reviews?list=review
//   GET  /api/note-reviews?noteId=...
//   PUT/PATCH ... action=save
//   POST/PUT/PATCH ... action=submit
//   POST/PUT/PATCH ... action=approve
//   POST/PUT/PATCH ... action=request_changes
//
// Workflow:
//   AI Draft -> Draft -> Under Review -> Published
//
// Human approval is required before publication.
//
// On approval:
//   1. NoteBank_Notes -> Published
//   2. NoteBank_Publications -> Published
//   3. NoteBank_Approvals -> Approved
// ============================================================

const AIRTABLE_API = "https://api.airtable.com/v0";

const NOTES_TABLE = "tblsEjHgHA7vhPgm0";

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


// ============================================================
// CONFIG
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


function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
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

  const response = await fetch(
    `${AIRTABLE_API}/${baseId}/${table}${query}`,
    {
      method,
      headers: headers(token),

      ...(body !== null
        ? {
            body: JSON.stringify(body)
          }
        : {})
    }
  );

  const raw =
    await response.text();

  let data = {};

  try {
    data =
      raw
        ? JSON.parse(raw)
        : {};
  } catch {
    data = {
      raw
    };
  }

  if (!response.ok) {
    console.error(
      "Airtable error:",
      {
        status: response.status,
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


// ============================================================
// LIST ALL RECORDS
// ============================================================

async function listAll(table) {
  const records = [];

  let offset = "";

  do {
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

    records.push(
      ...(data.records || [])
    );

    offset =
      data.offset || "";

  } while (offset);

  return records;
}


// ============================================================
// FIND NOTE
// ============================================================

async function findNote(noteId) {
  const id =
    String(noteId || "")
      .trim();

  if (!id) {
    return null;
  }

  // Airtable record ID
  if (
    /^rec[A-Za-z0-9]{14}$/
      .test(id)
  ) {
    try {
      const record =
        await airtableRequest(
          `${NOTES_TABLE}/${id}`,
          "GET"
        );

      if (record?.id) {
        return record;
      }

    } catch (error) {
      console.warn(
        "Direct note lookup failed:",
        error.message
      );
    }
  }

  // Custom Note ID
  const records =
    await listAll(
      NOTES_TABLE
    );

  return (
    records.find(
      record =>
        String(
          record.fields?.["Note ID"] ||
          ""
        ).trim() === id
    ) || null
  );
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
// APPROVALS
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


async function updateApproval(
  recordId,
  fields
) {
  if (!recordId) {
    return null;
  }

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
) {
  const approvals =
    await listAll(
      APPROVALS_TABLE
    );

  return (
    approvals.find(
      record => {

        const linkedNotes =
          Array.isArray(
            record.fields?.["Note"]
          )
            ? record.fields["Note"]
            : [];

        const status =
          String(
            record.fields?.["Status"] ||
            ""
          ).trim();

        return (
          status === "Pending" &&
          linkedNotes.includes(
            noteRecordId
          )
        );
      }
    ) || null
  );
}


// ============================================================
// TEACHER RESOLUTION
// ============================================================

function isRecordId(value) {
  return /^rec[A-Za-z0-9]{14}$/.test(
    String(value || "").trim()
  );
}


async function resolveTeacherId(
  value
) {
  const supplied =
    String(
      value || ""
    ).trim();

  if (!supplied) {
    return null;
  }

  if (
    isRecordId(supplied)
  ) {
    return supplied;
  }

  const teachers =
    await listAll(
      TEACHERS_TABLE
    );

  const target =
    supplied.toLowerCase();

  const found =
    teachers.find(
      record => {

        const fields =
          record.fields || {};

        const names = [
          fields.Name,
          fields["Teacher Name"],
          fields.Full_Name,
          fields["Full Name"]
        ];

        return names
          .filter(Boolean)
          .some(
            name =>
              String(name)
                .trim()
                .toLowerCase() ===
              target
          );
      }
    );

  return found?.id || null;
}


// ============================================================
// CLASS RESOLUTION
//
// Target Class is a linked record.
//
// If NoteBank_Notes contains a real Airtable class
// record ID, use it directly.
//
// Otherwise try to match the class name against Classes.
// ============================================================

async function resolveClassId(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  // Already an Airtable record ID
  if (
    isRecordId(value)
  ) {
    return value;
  }

  const target =
    String(value)
      .trim()
      .toLowerCase();

  if (!target) {
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

        const candidates = [
          fields.Name,
          fields["Class Name"],
          fields.Class,
          fields["Full Name"],
          fields.Code,
          fields["Class Code"]
        ];

        return candidates
          .filter(Boolean)
          .some(
            candidate =>
              String(candidate)
                .trim()
                .toLowerCase() ===
              target
          );
      }
    );

  return found?.id || null;
}


// ============================================================
// PUBLICATIONS
// ============================================================

async function findPublication(
  noteRecordId,
  version
) {
  const publications =
    await listAll(
      PUBLICATIONS_TABLE
    );

  const wantedVersion =
    String(
      version || ""
    ).trim();

  return (
    publications.find(
      record => {

        const fields =
          record.fields || {};

        const linkedNotes =
          Array.isArray(
            fields["Note"]
          )
            ? fields["Note"]
            : [];

        const recordVersion =
          String(
            fields["Version"] ||
            ""
          ).trim();

        return (
          linkedNotes.includes(
            noteRecordId
          ) &&
          (
            !wantedVersion ||
            !recordVersion ||
            recordVersion ===
              wantedVersion
          )
        );
      }
    ) || null
  );
}


async function createPublication(
  fields
) {
  return airtableRequest(
    PUBLICATIONS_TABLE,
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


async function updatePublication(
  recordId,
  fields
) {
  return airtableRequest(
    `${PUBLICATIONS_TABLE}/${recordId}`,
    "PATCH",
    {
      fields
    }
  );
}


// ============================================================
// HELPER
// ============================================================

function now() {
  return new Date()
    .toISOString();
}


function firstValue(
  fields,
  names
) {
  for (
    const name of names
  ) {

    const value =
      fields?.[name];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}


// ============================================================
// CREATE / UPDATE PUBLICATION
// ============================================================

async function publishNote({
  note,
  reviewerId
}) {
  const fields =
    note.fields || {};

  const version =
    String(
      fields["Version"] ||
      "1"
    ).trim();

  const programme =
    firstValue(
      fields,
      [
        "Programme",
        "Target Programme"
      ]
    );

  const classValue =
    firstValue(
      fields,
      [
        "Class",
        "Target Class"
      ]
    );

  // Resolve Class because Target Class
  // is a linked-record field.
  const classId =
    await resolveClassId(
      classValue
    );

  const publicationFields = {

    "Publication ID":
      `PUB-${Date.now()}-${Math.floor(
        Math.random() * 100000
      )}`,

    "Note":
      [note.id],

    "Version":
      version,

    "Publish Date":
      now(),

    "Status":
      "Published"
  };


  // Target Programme is a Single Select
  if (
    programme !== "" &&
    programme !== null &&
    programme !== undefined
  ) {
    publicationFields[
      "Target Programme"
    ] =
      String(programme);
  }


  // Target Class is a linked record
  if (classId) {
    publicationFields[
      "Target Class"
    ] =
      [classId];
  }


  // Published By is a linked Teacher
  if (reviewerId) {
    publicationFields[
      "Published By"
    ] =
      [reviewerId];
  }


  // Check whether publication already exists
  const existing =
    await findPublication(
      note.id,
      version
    );


  // Update existing publication
  if (existing) {

    const updated =
      await updatePublication(
        existing.id,
        {
          "Note":
            [note.id],

          "Version":
            version,

          ...(programme
            ? {
                "Target Programme":
                  String(programme)
              }
            : {}),

          ...(classId
            ? {
                "Target Class":
                  [classId]
              }
            : {}),

          ...(reviewerId
            ? {
                "Published By":
                  [reviewerId]
              }
            : {}),

          "Publish Date":
            now(),

          "Status":
            "Published"
        }
      );

    return {
      publication:
        updated,

      created:
        false
    };
  }


  // Create new publication
  const created =
    await createPublication(
      publicationFields
    );

  return {
    publication:
      created?.records?.[0] ||
      null,

    created:
      true
  };
}


// ============================================================
// RESPONSE FORMAT
// ============================================================

function noteResponse(
  record
) {
  return {

    airtableId:
      record.id,

    ...(record.fields || {})
  };
}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  // CORS
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


  // OPTIONS
  if (
    req.method === "OPTIONS"
  ) {
    return res
      .status(200)
      .end();
  }


  try {

    getConfig();

    const body =
      req.body || {};

    const noteId =
      req.query?.noteId ||
      body.noteId ||
      body["Note ID"];


    // ========================================================
    // REVIEW QUEUE
    // ========================================================

    if (
      req.method === "GET" &&
      !noteId
    ) {

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

      if (
        mode === "review"
      ) {

        filtered =
          notes.filter(
            record =>
              String(
                record.fields?.[
                  "Status"
                ] ||
                ""
              ).trim() ===
              "Under Review"
          );
      }


      // Newest first
      filtered.sort(
        (a, b) => {

          const dateA =
            new Date(
              a.fields?.[
                "Updated Date"
              ] ||
              a.fields?.[
                "Created Date"
              ] ||
              0
            ).getTime();

          const dateB =
            new Date(
              b.fields?.[
                "Updated Date"
              ] ||
              b.fields?.[
                "Created Date"
              ] ||
              0
            ).getTime();

          return dateB - dateA;
        }
      );


      return res
        .status(200)
        .json({

          success:
            true,

          count:
            filtered.length,

          notes:
            filtered.map(
              noteResponse
            )
        });
    }


    // ========================================================
    // GET SINGLE NOTE
    // ========================================================

    if (
      req.method === "GET"
    ) {

      if (!noteId) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "noteId is required."
          });
      }


      const note =
        await findNote(
          noteId
        );


      if (!note) {

        return res
          .status(404)
          .json({

            success:
              false,

            error:
              "Note not found.",

            noteId
          });
      }


      return res
        .status(200)
        .json({

          success:
            true,

          note:
            noteResponse(
              note
            )
        });
    }


    // ========================================================
    // NOTE IS REQUIRED FOR WRITE OPERATIONS
    // ========================================================

    if (!noteId) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "noteId is required."
        });
    }


    const note =
      await findNote(
        noteId
      );


    if (!note) {

      return res
        .status(404)
        .json({

          success:
            false,

          error:
            "Note not found.",

          noteId
        });
    }


    const currentFields =
      note.fields || {};

    const currentStatus =
      currentFields[
        "Status"
      ] ||
      "AI Draft";


    const action =
      String(
        body.action ||
        "save"
      )
        .trim()
        .toLowerCase();


    // ========================================================
    // SAVE DRAFT
    // ========================================================

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
        const field of
        editableFields
      ) {

        if (
          Object.prototype
            .hasOwnProperty.call(
              body,
              field
            )
        ) {

          fields[field] =
            body[field];
        }
      }


      fields[
        "Updated Date"
      ] =
        now();


      const updated =
        await updateNote(
          note.id,
          fields
        );


      return res
        .status(200)
        .json({

          success:
            true,

          message:
            "Note draft saved successfully.",

          status:
            updated.fields?.[
              "Status"
            ] ||
            currentStatus,

          note:
            noteResponse(
              updated
            )
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


      if (
        !allowedStatuses.includes(
          currentStatus
        )
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

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
          currentFields[
            "Version"
          ] ||
          "1"
        );


      // Change note status
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


      const submittedById =
        await resolveTeacherId(
          submittedBy
        );


      if (
        submittedById
      ) {

        approvalFields[
          "Submitted By"
        ] =
          [submittedById];
      }


      try {

        const approval =
          await createApproval(
            approvalFields
          );


        return res
          .status(200)
          .json({

            success:
              true,

            message:
              "Note submitted for approval.",

            status:
              "Under Review",

            approval:
              approval?.records?.[0] ||
              null,

            note:
              noteResponse(
                updated
              )
          });

      } catch (
        error
      ) {

        // Rollback
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

        } catch (
          rollbackError
        ) {

          console.error(
            "Rollback failed:",
            rollbackError
          );
        }

        throw error;
      }
    }


    // ========================================================
    // APPROVE AND PUBLISH
    // ========================================================

    if (
      (
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      action === "approve"
    ) {

      if (
        ![
          "Under Review",
          "Approved"
        ].includes(
          currentStatus
        )
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              `Cannot approve note from status "${currentStatus}".`
          });
      }


      const reviewer =
        body.reviewer ||
        body.approvedBy ||
        body.teacherId ||
        "";


      const reviewerId =
        await resolveTeacherId(
          reviewer
        );


      const reviewComment =
        body.reviewComment ||
        body["Review Comment"] ||
        body.comment ||
        "";


      // --------------------------------------------------------
      // STEP 1
      // PUBLISH NOTE
      // --------------------------------------------------------

      const publishedNote =
        await updateNote(
          note.id,
          {

            "Status":
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

            ...(reviewComment
              ? {
                  "Review Comment":
                    reviewComment
                }
              : {})
          }
        );


      // --------------------------------------------------------
      // STEP 2
      // CREATE PUBLICATION RECORD
      // --------------------------------------------------------

      let publicationResult;

      try {

        publicationResult =
          await publishNote({

            note:
              publishedNote,

            reviewerId

          });

      } catch (
        publicationError
      ) {

        console.error(
          "Publication creation failed:",
          publicationError
        );


        // Rollback
        try {

          await updateNote(
            note.id,
            {

              "Status":
                "Under Review",

              "Updated Date":
                now()
            }
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "Publication rollback failed:",
            rollbackError
          );
        }


        return res
          .status(500)
          .json({

            success:
              false,

            error:
              "The publication record could not be created. The note has been returned to Under Review.",

            details:
              publicationError.message
          });
      }


      // --------------------------------------------------------
      // STEP 3
      // UPDATE APPROVAL RECORD
      // --------------------------------------------------------

      const pendingApproval =
        await findPendingApproval(
          note.id
        );


      let updatedApproval =
        null;


      if (
        pendingApproval
      ) {

        const approvalFields = {

          "Status":
            "Approved",

          "Review Date":
            now()

        };


        if (
          reviewerId
        ) {

          approvalFields[
            "Reviewer"
          ] =
            [reviewerId];
        }


        if (
          reviewComment
        ) {

          approvalFields[
            "Reviewer Comments"
          ] =
            reviewComment;
        }


        updatedApproval =
          await updateApproval(
            pendingApproval.id,
            approvalFields
          );
      }


      // --------------------------------------------------------
      // FINAL RESPONSE
      // --------------------------------------------------------

      return res
        .status(200)
        .json({

          success:
            true,

          message:
            "Note approved and published.",

          status:
            "Published",

          publication:
            publicationResult?.publication ||
            null,

          approval:
            updatedApproval ||
            pendingApproval ||
            null,

          note:
            noteResponse(
              publishedNote
            )
        });
    }


    // ========================================================
    // REQUEST CHANGES
    // ========================================================

    if (
      (
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
      ) &&
      [
        "request_changes",
        "changes",
        "reject"
      ].includes(
        action
      )
    ) {

      if (
        ![
          "Under Review",
          "Approved"
        ].includes(
          currentStatus
        )
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

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
        await resolveTeacherId(
          reviewer
        );


      const reviewComment =
        body.reviewComment ||
        body["Review Comment"] ||
        body.comment ||
        body.changes ||
        "";


      if (
        !String(
          reviewComment
        ).trim()
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "A review comment is required when requesting changes."
          });
      }


      const updatedNote =
        await updateNote(
          note.id,
          {

            "Status":
              "Changes Requested",

            "Review Comment":
              reviewComment,

            "Updated Date":
              now()
          }
        );


      const pendingApproval =
        await findPendingApproval(
          note.id
        );


      let updatedApproval =
        null;


      if (
        pendingApproval
      ) {

        const approvalFields = {

          "Status":
            "Changes Requested",

          "Review Date":
            now(),

          "Reviewer Comments":
            reviewComment

        };


        if (
          reviewerId
        ) {

          approvalFields[
            "Reviewer"
          ] =
            [reviewerId];
        }


        updatedApproval =
          await updateApproval(
            pendingApproval.id,
            approvalFields
          );
      }


      return res
        .status(200)
        .json({

          success:
            true,

          message:
            "Changes requested for this note.",

          status:
            "Changes Requested",

          approval:
            updatedApproval ||
            pendingApproval ||
            null,

          note:
            noteResponse(
              updatedNote
            )
        });
    }


    // ========================================================
    // UNKNOWN ACTION
    // ========================================================

    return res
      .status(400)
      .json({

        success:
          false,

        error:
          `Unsupported action "${action}".`
      });


  } catch (
    error
  ) {

    console.error(
      "Note review API error:",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        error:
          error?.message ||
          "Internal server error."
      });
  }
}
