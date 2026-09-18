// ============================================================
// AIBINU FLEXIPREP EDUCONSULT
// File: api/note-reviews.js
//
// SECURE NOTE BANK REVIEW WORKFLOW
//
// AI/Draft
//      ↓
// Draft
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
// SECURITY MODEL
// ------------------------------------------------------------
// 1. Identity ALWAYS comes from the authenticated session.
// 2. Browser-supplied teacherId / reviewer / submittedBy are
//    NEVER trusted.
// 3. Teachers can save and submit their own notes.
// 4. Reviewers/Admins can approve or request changes.
// 5. Admin can perform both workflows.
// 6. Created By belongs to NoteBank_Notes.
// 7. Submitted By belongs to NoteBank_Approvals.
// 8. Approved By belongs to NoteBank_Notes.
// 9. Published By belongs to NoteBank_Publications.
// 10. Target Programme and Target Class belong ONLY to
//     NoteBank_Publications.
// ============================================================


import { requireRole } from "./_auth.js";


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

function config() {

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


/* ============================================================
   AIRTABLE HEADERS
   ============================================================ */

function authHeaders(token) {

  return {

    Authorization:
      `Bearer ${token}`,

    "Content-Type":
      "application/json"

  };

}


/* ============================================================
   AIRTABLE REQUEST
   ============================================================ */

async function airtable(
  table,
  method = "GET",
  body = null,
  query = ""
) {

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

    throw new Error(

      data?.error?.message ||

      data?.error?.type ||

      `Airtable request failed (${response.status}).`

    );

  }


  return data;

}


/* ============================================================
   LIST ALL AIRTABLE RECORDS
   ============================================================ */

async function listAll(table) {

  const records = [];

  let offset = "";


  do {

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


  } while (offset);


  return records;

}


/* ============================================================
   FIND NOTE
   ============================================================ */

async function findNote(noteId) {

  const id =
    String(
      noteId || ""
    ).trim();


  if (!id) {

    return null;

  }


  /*
   * If the supplied value is already
   * an Airtable record ID, use it directly.
   */

  if (
    /^rec[A-Za-z0-9]{14}$/.test(id)
  ) {

    try {

      return await airtable(
        `${NOTES_TABLE}/${id}`
      );

    } catch (_) {

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
    )

    ||

    null

  );

}


/* ============================================================
   CONVERT VALUES TO AIRTABLE RECORD IDs
   ============================================================ */

function recordIds(value) {

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
   FIND CLASS
   ============================================================ */

async function findClassId(value) {

  /*
   * If frontend supplied a real Airtable
   * record ID, use it directly.
   */

  const direct =
    recordIds(value);


  if (direct.length) {

    return direct[0];

  }


  const wanted =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


  if (!wanted) {

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

function responseNote(record) {

  return {

    airtableId:
      record.id,

    ...(record.fields || {})

  };

}


/* ============================================================
   CURRENT TIME
   ============================================================ */

function now() {

  return new Date()
    .toISOString();

}


/* ============================================================
   UPDATE NOTE
   ============================================================ */

async function updateNote(
  id,
  fields
) {

  return airtable(

    `${NOTES_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast: true
    }

  );

}


/* ============================================================
   CREATE APPROVAL
   ============================================================ */

async function createApproval(
  fields
) {

  return airtable(

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


/* ============================================================
   UPDATE APPROVAL
   ============================================================ */

async function updateApproval(
  id,
  fields
) {

  return airtable(

    `${APPROVALS_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast: true
    }

  );

}


/* ============================================================
   FIND PENDING APPROVAL
   ============================================================ */

async function findPendingApproval(
  noteId
) {

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

    ||

    null

  );

}


/* ============================================================
   FIND EXISTING PUBLICATION
   ============================================================ */

async function findPublication(
  noteId,
  version
) {

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

    ||

    null

  );

}


/* ============================================================
   CREATE PUBLICATION
   ============================================================ */

async function createPublication(
  fields
) {

  return airtable(

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


/* ============================================================
   UPDATE PUBLICATION
   ============================================================ */

async function updatePublication(
  id,
  fields
) {

  return airtable(

    `${PUBLICATIONS_TABLE}/${id}`,

    "PATCH",

    {
      fields,
      typecast: true
    }

  );

}


/* ============================================================
   PUBLISH NOTE
   ============================================================ */

async function publishRecord(
  note,
  publisherId,
  targetProgramme,
  targetClass
) {

  const programme =
    String(
      targetProgramme || ""
    ).trim();


  const classValue =
    String(
      targetClass || ""
    ).trim();


  if (!programme) {

    throw new Error(
      "Target Programme is required before publication."
    );

  }


  if (!classValue) {

    throw new Error(
      "Target Class is required before publication."
    );

  }


  /*
   * Resolve class to the actual
   * Airtable Classes record ID.
   */

  const classId =
    await findClassId(
      classValue
    );


  if (!classId) {

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
   * Check whether this Note + Version
   * already has a publication record.
   */

  const existing =
    await findPublication(
      note.id,
      version
    );


  /*
   * Base publication fields.
   */

  const publicationFields = {

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
   * Published By is a Teacher link.
   *
   * publisherId comes exclusively
   * from the authenticated session.
   */

  if (publisherId) {

    publicationFields[
      "Published By"
    ] = [
      publisherId
    ];

  }


  /*
   * Update existing publication.
   */

  if (existing) {

    const updated =
      await updatePublication(

        existing.id,

        publicationFields

      );


    return {

      publication:
        updated,

      created:
        false,

      publicationId:
        existing.id

    };

  }


  /*
   * Otherwise create a new publication.
   */

  const created =
    await createPublication(
      {
        "Publication ID":
          `PUB-${Date.now()}-${Math.floor(Math.random() * 100000)}`,

        ...publicationFields
      }
    );


  return {

    publication:
      created?.records?.[0] || null,

    created:
      true,

    publicationId:
      created?.records?.[0]?.id || null

  };

}


/* ============================================================
   CHECK NOTE OWNERSHIP
   ============================================================ */

function ownsNote(
  note,
  teacherId
) {

  if (!teacherId) {

    return false;

  }


  const ownerIds =
    recordIds(
      note.fields?.["Created By"]
    );


  return ownerIds.includes(
    teacherId
  );

}


/* ============================================================
   MAIN HANDLER
   ============================================================ */

export default async function handler(
  req,
  res
) {

  /*
   * Do not use:
   *
   * Access-Control-Allow-Origin: *
   *
   * Authentication is cookie/session based.
   */


  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  /*
   * OPTIONS
   *
   * This is retained for browser compatibility.
   */

  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(204)
      .end();

  }


  try {

    /*
     * Validate Airtable configuration.
     */

    config();


    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    /*
     * Every NoteBank Review API operation
     * requires an authenticated user.
     *
     * Identity is extracted from the signed
     * server session by requireRole().
     */

    const user =
      requireRole(
        req,
        res,
        [
          "teacher",
          "reviewer",
          "admin"
        ]
      );


    if (!user) {

      return;

    }


    const body =
      req.body || {};


    const noteId =
      req.query?.noteId ||

      body.noteId ||

      body["Note ID"];


    /* ========================================================
       GET REVIEW QUEUE / CLASSES
       ======================================================== */

    if (
      req.method === "GET" &&
      !noteId
    ) {

      const mode =
        String(
          req.query?.list ||
          "review"
        )
          .trim()
          .toLowerCase();


      /* ======================================================
         LOAD CLASSES
         ====================================================== */

      if (
        mode === "classes"
      ) {

        /*
         * All authenticated roles can load
         * class options for the Review Center.
         */

        const classRecords =
          await listAll(
            CLASSES_TABLE
          );


        const classes =
          classRecords

            .map(record => {

              const f =
                record.fields || {};


              const className =
                String(

                  f["Class Name"] ||

                  f.Name ||

                  f.Class ||

                  ""

                ).trim();


              return {

                id:
                  record.id,

                airtableId:
                  record.id,

                name:
                  className,

                className:
                  className,

                code:
                  String(

                    f["Class ID"] ||

                    f.Code ||

                    ""

                  ).trim(),

                programme:
                  String(
                    f.Programme ||
                    ""
                  ).trim(),

                status:
                  String(
                    f.Status ||
                    "Active"
                  ).trim()

              };

            })

            .filter(
              record =>
                record.name
            );


        return res
          .status(200)
          .json({

            success:
              true,

            count:
              classes.length,

            classes

          });

      }


      /* ======================================================
         LOAD REVIEW QUEUE
         ====================================================== */

      const notes =
        await listAll(
          NOTES_TABLE
        );


      /*
       * Review queue should normally show
       * Under Review notes.
       */

      let filtered;


      if (
        mode === "review"
      ) {

        /*
         * Reviewer/Admin:
         * show notes awaiting review.
         */

        if (
          user.role === "reviewer" ||
          user.role === "admin"
        ) {

          filtered =
            notes.filter(
              record =>

                String(
                  record.fields?.Status ||
                  ""
                ).trim()
                === "Under Review"

            );

        }

        /*
         * Teacher:
         * only show their own notes that
         * are under review.
         */

        else {

          filtered =
            notes.filter(
              record =>

                String(
                  record.fields?.Status ||
                  ""
                ).trim()
                === "Under Review"

                &&

                ownsNote(
                  record,
                  user.teacherId
                )

            );

        }

      }

      else {

        /*
         * Non-review modes:
         *
         * Admin/Reviewer can see all.
         *
         * Teacher can only see their own notes.
         */

        if (
          user.role === "reviewer" ||
          user.role === "admin"
        ) {

          filtered =
            notes;

        }

        else {

          filtered =
            notes.filter(
              record =>
                ownsNote(
                  record,
                  user.teacherId
                )
            );

        }

      }


      /*
       * Newest first.
       */

      filtered.sort(
        (a, b) =>

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

          success:
            true,

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
              "Note not found."

          });

      }


      /*
       * Reviewer/Admin can inspect any note.
       *
       * Teacher can only inspect their
       * own note.
       */

      if (
        user.role === "teacher" &&
        !ownsNote(
          note,
          user.teacherId
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "You are not authorized to view this note."

          });

      }


      return res
        .status(200)
        .json({

          success:
            true,

          note:
            responseNote(
              note
            )

        });

    }


    /* ========================================================
       WRITE OPERATION
       ======================================================== */

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

    if (

      [
        "PUT",
        "PATCH"
      ].includes(
        req.method
      )

      &&

      action === "save"

    ) {

      /*
       * Only Teacher/Admin can save
       * through this endpoint.
       */

      if (
        ![
          "teacher",
          "admin"
        ].includes(
          user.role
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Only teachers or administrators can save note drafts."

          });

      }


      /*
       * Teachers can only modify
       * their own notes.
       *
       * Admin bypasses ownership.
       */

      if (
        user.role === "teacher" &&

        !ownsNote(
          note,
          user.teacherId
        )

      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "You are not authorized to modify this note."

          });

      }


      /*
       * Only these fields can be edited.
       *
       * Programme/Class are deliberately
       * excluded because they belong to
       * NoteBank_Publications.
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

        "Visual Components",

        "Teacher Prompt",

        "Review Comment"

      ];


      const fields = {

        "Updated Date":
          now()

      };


      for (
        const fieldName
        of editable
      ) {

        if (

          Object.prototype
            .hasOwnProperty
            .call(
              body,
              fieldName
            )

        ) {

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

          success:
            true,

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

    if (

      [
        "POST",
        "PUT",
        "PATCH"
      ].includes(
        req.method
      )

      &&

      action === "submit"

    ) {

      /*
       * Only Teacher/Admin can submit.
       */

      if (
        ![
          "teacher",
          "admin"
        ].includes(
          user.role
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Only teachers or administrators can submit notes for approval."

          });

      }


      /*
       * A teacher must have a linked
       * Teachers record.
       *
       * Admin may submit without a teacher
       * identity only if the workflow allows it.
       */

      if (
        user.role === "teacher" &&
        !user.teacherId
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Your account is not linked to a Teacher record."

          });

      }


      /*
       * Teacher ownership check.
       */

      if (
        user.role === "teacher" &&

        !ownsNote(
          note,
          user.teacherId
        )

      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "You are not authorized to submit this note."

          });

      }


      /*
       * Valid submission states.
       */

      if (

        ![
          "AI Draft",
          "Draft",
          "Changes Requested"
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
              `Cannot submit note from status "${currentStatus}".`

          });

      }


      /*
       * Prevent duplicate Pending approvals.
       */

      const existingPending =
        await findPendingApproval(
          note.id
        );


      if (existingPending) {

        return res
          .status(409)
          .json({

            success:
              false,

            error:
              "This note already has a pending approval submission.",

            approval:
              existingPending

          });

      }


      const version =
        String(
          note.fields?.Version ||
          "1"
        ).trim();


      /*
       * IMPORTANT:
       *
       * submittedBy is NOT taken from:
       *
       * body.submittedBy
       * body.createdBy
       * body.teacherId
       *
       * It comes from the authenticated
       * session.
       */

      const submittedBy =
        user.teacherId || null;


      /*
       * Move note into Under Review first.
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


      try {

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


        /*
         * Submitted By is a Teacher
         * linked-record field.
         */

        if (submittedBy) {

          approvalFields[
            "Submitted By"
          ] = [
            submittedBy
          ];

        }


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
              responseNote(
                updated
              )

          });


      } catch (error) {

        /*
         * Roll back note status if
         * approval creation fails.
         */

        try {

          await updateNote(
            note.id,
            {

              Status:
                currentStatus,

              "Updated Date":
                now()

            }
          );

        } catch (_) {}


        throw error;

      }

    }


    /* ========================================================
       APPROVE & PUBLISH
       ======================================================== */

    if (

      [
        "POST",
        "PUT",
        "PATCH"
      ].includes(
        req.method
      )

      &&

      action === "approve"

    ) {

      /*
       * Only Reviewer/Admin can approve.
       */

      if (
        ![
          "reviewer",
          "admin"
        ].includes(
          user.role
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Only reviewers or administrators can approve notes."

          });

      }


      /*
       * Reviewer must have a Teacher record
       * because Reviewer / Approved By /
       * Published By are Teacher links.
       */

      if (
        !user.teacherId
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Your reviewer account is not linked to a Teacher record."

          });

      }


      /*
       * Approval only allowed from
       * Under Review.
       */

      if (
        currentStatus !==
        "Under Review"
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


      /*
       * Reviewer identity comes ONLY
       * from authenticated session.
       */

      const reviewerId =
        user.teacherId;


      const comment =
        String(

          body.reviewerComment ||

          body.reviewComment ||

          body["Review Comment"] ||

          body.comment ||

          ""

        ).trim();


      /*
       * Target publication information.
       *
       * These values are allowed from
       * the Review Center because they
       * belong to the publication record,
       * NOT the note.
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
         VALIDATE TARGET PROGRAMME
         ====================================================== */

      if (
        !String(
          targetProgramme
        ).trim()
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "Target Programme is required."

          });

      }


      /* ======================================================
         VALIDATE TARGET CLASS
         ====================================================== */

      if (
        !String(
          targetClass
        ).trim()
      ) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "Target Class is required."

          });

      }


      const classId =
        await findClassId(
          targetClass
        );


      if (!classId) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              `Target Class "${targetClass}" was not found in the Classes table.`

          });

      }


      /*
       * Locate the pending approval.
       */

      const pending =
        await findPendingApproval(
          note.id
        );


      /*
       * Update NoteBank_Notes.
       *
       * Approved By and Published Date
       * belong to Notes.
       */

      const approvedAt =
        now();


      const noteFields = {

        Status:
          "Published",

        "Published Date":
          approvedAt,

        "Approved Date":
          approvedAt,

        "Updated Date":
          approvedAt,

        "Approved By":
          [reviewerId]

      };


      if (comment) {

        noteFields[
          "Review Comment"
        ] =
          comment;

      }


      const published =
        await updateNote(
          note.id,
          noteFields
        );


      try {

        /* ====================================================
           CREATE / UPDATE PUBLICATION
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

        let approval =
          pending;


        if (pending) {

          const approvalFields = {

            "Status":
              "Approved",

            "Review Date":
              now(),

            "Reviewer":
              [reviewerId]

          };


          if (comment) {

            approvalFields[
              "Reviewer Comments"
            ] =
              comment;

          }


          approval =
            await updateApproval(

              pending.id,

              approvalFields

            );

        }


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
              publication.publication,

            approval,

            note:
              responseNote(
                published
              )

          });


      } catch (error) {

        /*
         * Publication or approval update
         * failed after the note was marked
         * Published.
         *
         * Return the note to Under Review
         * so it is not falsely presented as
         * successfully published.
         */

        try {

          await updateNote(
            note.id,
            {

              Status:
                "Under Review",

              "Updated Date":
                now()

            }
          );

        } catch (_) {}


        /*
         * If a publication record was created,
         * attempt to mark it Unpublished.
         *
         * This is safer than leaving an active
         * publication after a failed workflow.
         */

        try {

          if (
            error?.publicationId
          ) {

            await updatePublication(
              error.publicationId,
              {

                Status:
                  "Unpublished",

                "Unpublish Date":
                  now()

              }
            );

          }

        } catch (_) {}


        return res
          .status(500)
          .json({

            success:
              false,

            error:
              "Publication could not be completed. The note has been returned to Under Review.",

            details:
              error?.message ||
              "Unknown publication error."

          });

      }

    }


    /* ========================================================
       REQUEST CHANGES
       ======================================================== */

    if (

      [
        "POST",
        "PUT",
        "PATCH"
      ].includes(
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

    ) {

      /*
       * Only Reviewer/Admin can request changes.
       */

      if (
        ![
          "reviewer",
          "admin"
        ].includes(
          user.role
        )
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Only reviewers or administrators can request changes."

          });

      }


      /*
       * Reviewer must be linked
       * to Teachers.
       */

      if (
        !user.teacherId
      ) {

        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Your reviewer account is not linked to a Teacher record."

          });

      }


      /*
       * Only Under Review notes can
       * receive a change request.
       */

      if (
        currentStatus !==
        "Under Review"
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


      /*
       * Reviewer identity comes ONLY
       * from the authenticated session.
       */

      const reviewerId =
        user.teacherId;


      const comment =
        String(

          body.reviewerComment ||

          body.reviewComment ||

          body["Review Comment"] ||

          body.comment ||

          body.reason ||

          ""

        ).trim();


      /*
       * A change request must contain
       * an explanation.
       */

      if (!comment) {

        return res
          .status(400)
          .json({

            success:
              false,

            error:
              "A review comment is required when requesting changes."

          });

      }


      /*
       * Update note.
       */

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


      /*
       * Update the corresponding
       * approval record.
       */

      const pending =
        await findPendingApproval(
          note.id
        );


      let approval =
        pending;


      if (pending) {

        const approvalFields = {

          "Status":
            "Changes Requested",

          "Review Date":
            now(),

          "Reviewer":
            [reviewerId],

          "Reviewer Comments":
            comment

        };


        approval =
          await updateApproval(

            pending.id,

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

        success:
          false,

        error:
          `Unsupported action "${action}".`

      });


  } catch (error) {

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
