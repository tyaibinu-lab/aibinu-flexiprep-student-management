// api/academic.js
// Aibinu Flexiprep Student Management System
// Academic Management API + NoteBank Dashboard Statistics

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "app285TkNT13HPdqi";
const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;

const TABLES = {
  academic: "tbljnjBdJrYr1WXGY",
  classes: "tblpwV6RF0IpHGWLg",
  subjects: "tblQJzVQrpVgbx1j9",
  teachers: "tblVjuSJe4R5kcOZr"
};

const STATS_TABLES = {
  notes: "tblsEjHgHA7vhPgm0",
  approvals: "tblJHGCDxEpdjm46y",
  aiJobs: "tbldFSYwYcTMtMm9A"
};

function airtableUrl(table, recordId = "") {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}${recordId ? "/" + recordId : ""}`;
}

function headers() {
  return {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    "Content-Type": "application/json"
  };
}

async function airtableFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      `Airtable request failed (${response.status})`;

    throw new Error(message);
  }

  return data;
}

async function listAll(baseId, tableId, token) {
  let records = [];
  let offset = null;

  do {
    const params = new URLSearchParams();

    if (offset) {
      params.set("offset", offset);
    }

    const url =
      `https://api.airtable.com/v0/${baseId}/${tableId}` +
      (params.toString() ? `?${params.toString()}` : "");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const text = await response.text();

    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        `Airtable request failed (${response.status})`
      );
    }

    records = records.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);

  return records;
}

function fieldValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return String(
      value.name ||
      value.value ||
      ""
    ).trim();
  }

  return String(value ?? "").trim();
}

/* =========================================================
   RECORD MAPPERS
   ========================================================= */

function mapClass(record) {
  const f = record.fields || {};

  return {
    id: record.id,
    recordId: record.id,
    type: "Class",

    name: fieldValue(
      f["Class Name"] ??
      f["Level"] ??
      f["Name"] ??
      f["Class"]
    ),

    code: fieldValue(
      f["Class ID"] ??
      f["Code"]
    ),

    programme: fieldValue(f["Programme"]),
    level: fieldValue(
      f["Level"] ??
      f["Class Name"]
    ),

    capacity: f["Capacity"] ?? "",
    teacher: fieldValue(f["Class Teacher"]),
    status: fieldValue(f["Status"]) || "Active",

    notes: fieldValue(f["Notes"])
  };
}

function mapSubject(record) {
  const f = record.fields || {};

  return {
    id: record.id,
    recordId: record.id,
    type: "Subject",

    name: fieldValue(
      f["Subject Name"] ??
      f["Name"] ??
      f["Subject"]
    ),

    code: fieldValue(
      f["Subject ID"] ??
      f["Code"]
    ),

    programme: fieldValue(f["Programme"]),
    status: fieldValue(f["Status"]) || "Active",

    notes: fieldValue(f["Notes"])
  };
}

function mapTeacher(record) {
  const f = record.fields || {};

  return {
    id: record.id,
    recordId: record.id,
    type: "Teacher",

    name: fieldValue(
      f["Teacher Name"] ??
      f["Name"] ??
      f["Teacher"]
    ),

    code: fieldValue(
      f["Teacher ID"] ??
      f["Code"]
    ),

    subject: fieldValue(f["Subject"]),
    status: fieldValue(f["Status"]) || "Active",

    notes: fieldValue(f["Notes"])
  };
}

function mapAcademic(record) {
  const f = record.fields || {};

  return {
    id: record.id,
    recordId: record.id,
    type: fieldValue(f["Type"]),

    name: fieldValue(f["Name"]),
    code: fieldValue(f["Code"]),
    programme: fieldValue(f["Programme"]),

    className: fieldValue(
      f["Class Name"] ??
      f["Class"]
    ),

    subject: fieldValue(f["Subject"]),

    teacher: fieldValue(
      f["Teacher"] ??
      f["Teacher Name"]
    ),

    status: fieldValue(f["Status"]) || "Active",

    notes: fieldValue(
      f["Notes"] ??
      f["Description"]
    )
  };
}

/* =========================================================
   NOTEBOOK STATISTICS
   ========================================================= */

async function getNoteBankStats() {
  const [
    notes,
    approvals,
    aiJobs
  ] = await Promise.all([
    listAll(
      AIRTABLE_BASE_ID,
      STATS_TABLES.notes,
      AIRTABLE_TOKEN
    ),

    listAll(
      AIRTABLE_BASE_ID,
      STATS_TABLES.approvals,
      AIRTABLE_TOKEN
    ),

    listAll(
      AIRTABLE_BASE_ID,
      STATS_TABLES.aiJobs,
      AIRTABLE_TOKEN
    )
  ]);

  const noteDrafts = notes.filter(record => {
    const status = fieldValue(
      record.fields?.Status
    ).toLowerCase();

    return [
      "ai draft",
      "draft",
      "changes requested"
    ].includes(status);
  }).length;

  const published = notes.filter(record => {
    const status = fieldValue(
      record.fields?.Status
    ).toLowerCase();

    return status === "published";
  }).length;

  const pendingReview = approvals.filter(record => {
    const status = fieldValue(
      record.fields?.Status
    ).toLowerCase();

    return [
      "pending",
      "submitted",
      "under review",
      "pending review"
    ].includes(status);
  }).length;

  const generatedAIJobs = aiJobs.filter(record => {
    return (
      fieldValue(
        record.fields?.Status
      ).toLowerCase() === "generated"
    );
  });

  const aiNoteJobs = generatedAIJobs.filter(record => {
    return (
      fieldValue(
        record.fields?.["Content Type"]
      ).toLowerCase() === "note"
    );
  }).length;

  const aiQuestionJobs = generatedAIJobs.filter(record => {
    return (
      fieldValue(
        record.fields?.["Content Type"]
      ).toLowerCase() === "question"
    );
  }).length;

  /*
    Draft Content is intentionally:

      NoteBank drafts
      +
      generated AI question jobs
  */

  const draftContent =
    noteDrafts +
    aiQuestionJobs;

  return {
    success: true,

    draftContent,

    // Backward compatibility
    draftNotes: draftContent,

    noteDrafts,

    draftQuestions: aiQuestionJobs,

    pendingReview,

    published,

    aiJobs: aiJobs.length,

    generatedAIJobs:
      generatedAIJobs.length,

    aiNoteJobs,

    aiQuestionJobs,

    generatedAt:
      new Date().toISOString()
  };
}

/* =========================================================
   MAIN API HANDLER
   ========================================================= */

export default async function handler(req, res) {

  try {

    if (!AIRTABLE_TOKEN) {
      return res.status(500).json({
        success: false,
        error: "AIRTABLE_TOKEN is not configured."
      });
    }

    /* =====================================================
       NOTEBOOK DASHBOARD STATISTICS

       URL:
       /api/academic?stats=1

       This replaces the old:
       /api/academic-stats
       ===================================================== */

    if (
      req.method === "GET" &&
      String(req.query?.stats || "") === "1"
    ) {

      const stats =
        await getNoteBankStats();

      return res
        .status(200)
        .json(stats);
    }

    /* =====================================================
       GET ALL ACADEMIC DATA
       ===================================================== */

    if (req.method === "GET") {

      const [
        academicRecords,
        classRecords,
        subjectRecords,
        teacherRecords
      ] = await Promise.all([

        listAll(
          AIRTABLE_BASE_ID,
          TABLES.academic,
          AIRTABLE_TOKEN
        ),

        listAll(
          AIRTABLE_BASE_ID,
          TABLES.classes,
          AIRTABLE_TOKEN
        ),

        listAll(
          AIRTABLE_BASE_ID,
          TABLES.subjects,
          AIRTABLE_TOKEN
        ),

        listAll(
          AIRTABLE_BASE_ID,
          TABLES.teachers,
          AIRTABLE_TOKEN
        )
      ]);

      const records = [

        ...academicRecords.map(
          mapAcademic
        ),

        /*
          Classes are SHARED academic levels.

          Programme does NOT filter them.

          Therefore SS1, SS2 and SS3
          remain available for WAEC,
          NECO and UTME.
        */

        ...classRecords.map(
          mapClass
        ),

        ...subjectRecords.map(
          mapSubject
        ),

        ...teacherRecords.map(
          mapTeacher
        )
      ];

      return res.status(200).json({
        success: true,
        records
      });
    }

    /* =====================================================
       CREATE
       ===================================================== */

    if (req.method === "POST") {

      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {};

      const type =
        String(body.type || "").trim();

      if (!type) {
        return res.status(400).json({
          success: false,
          error: "Record type is required."
        });
      }

      /* ---------------------------------------------------
         CLASS
         --------------------------------------------------- */

      if (type === "Class") {

        const className =
          String(
            body.className ||
            body.name ||
            body.level ||
            ""
          ).trim();

        if (!className) {
          return res.status(400).json({
            success: false,
            error: "Class name is required."
          });
        }

        const fields = {

          "Class Name":
            className,

          "Level":
            String(
              body.level ||
              className
            ).trim(),

          "Class ID":
            String(
              body.code ||
              `CLS-${Date.now()}`
            ).trim(),

          "Capacity":
            body.capacity === "" ||
            body.capacity == null
              ? undefined
              : Number(body.capacity),

          "Class Teacher":
            body.teacher || "",

          "Status":
            body.status || "Active",

          "Programme":
            body.programme || ""
        };

        Object.keys(fields).forEach(key => {
          if (fields[key] === undefined) {
            delete fields[key];
          }
        });

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.classes
            ),
            {
              method: "POST",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(201).json({
          success: true,
          record: mapClass(data)
        });
      }

      /* ---------------------------------------------------
         SUBJECT
         --------------------------------------------------- */

      if (type === "Subject") {

        const name =
          String(
            body.name ||
            body.subject ||
            ""
          ).trim();

        if (!name) {
          return res.status(400).json({
            success: false,
            error: "Subject name is required."
          });
        }

        const fields = {

          "Subject Name":
            name,

          "Subject ID":
            body.code ||
            `SUB-${Date.now()}`,

          "Programme":
            body.programme || "",

          "Status":
            body.status || "Active",

          "Notes":
            body.notes || ""
        };

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.subjects
            ),
            {
              method: "POST",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(201).json({
          success: true,
          record: mapSubject(data)
        });
      }

      /* ---------------------------------------------------
         TEACHER
         --------------------------------------------------- */

      if (type === "Teacher") {

        const name =
          String(
            body.name ||
            body.teacher ||
            ""
          ).trim();

        if (!name) {
          return res.status(400).json({
            success: false,
            error: "Teacher name is required."
          });
        }

        const fields = {

          "Teacher Name":
            name,

          "Teacher ID":
            body.code ||
            `TCH-${Date.now()}`,

          "Subject":
            body.subject || "",

          "Status":
            body.status || "Active",

          "Notes":
            body.notes || ""
        };

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.teachers
            ),
            {
              method: "POST",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(201).json({
          success: true,
          record: mapTeacher(data)
        });
      }

      /* ---------------------------------------------------
         ASSIGNMENT / ACADEMIC RECORD
         --------------------------------------------------- */

      if (type === "Assignment") {

        if (
          !body.className ||
          !body.subject ||
          !body.teacher
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Class, Subject and Teacher are required."
          });
        }
      }

      const fields = {

        "Type":
          type,

        "Name":
          String(
            body.name || ""
          ).trim(),

        "Code":
          String(
            body.code || ""
          ).trim(),

        "Programme":
          String(
            body.programme || ""
          ).trim(),

        "Class Name":
          String(
            body.className || ""
          ).trim(),

        "Subject":
          String(
            body.subject || ""
          ).trim(),

        "Teacher":
          String(
            body.teacher || ""
          ).trim(),

        "Status":
          String(
            body.status ||
            "Active"
          ).trim(),

        "Notes":
          String(
            body.notes || ""
          ).trim()
      };

      const data =
        await airtableFetch(
          airtableUrl(
            TABLES.academic
          ),
          {
            method: "POST",
            body: JSON.stringify({
              fields
            })
          }
        );

      return res.status(201).json({
        success: true,
        record: mapAcademic(data)
      });
    }

    /* =====================================================
       UPDATE
       ===================================================== */

    if (
      req.method === "PUT" ||
      req.method === "PATCH"
    ) {

      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : req.body || {};

      const recordId =
        body.recordId ||
        body.id;

      if (!recordId) {
        return res.status(400).json({
          success: false,
          error: "Record ID is required."
        });
      }

      const type =
        String(
          body.type || ""
        ).trim();

      /* ---------------------------------------------------
         CLASS UPDATE
         --------------------------------------------------- */

      if (type === "Class") {

        const className =
          String(
            body.className ||
            body.name ||
            body.level ||
            ""
          ).trim();

        const fields = {

          "Class Name":
            className,

          "Level":
            String(
              body.level ||
              className
            ).trim(),

          "Class ID":
            String(
              body.code || ""
            ).trim(),

          "Capacity":
            body.capacity === "" ||
            body.capacity == null
              ? undefined
              : Number(body.capacity),

          "Class Teacher":
            body.teacher || "",

          "Status":
            body.status || "Active",

          "Programme":
            body.programme || ""
        };

        Object.keys(fields).forEach(key => {
          if (fields[key] === undefined) {
            delete fields[key];
          }
        });

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.classes,
              recordId
            ),
            {
              method: "PATCH",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(200).json({
          success: true,
          record: mapClass(data)
        });
      }

      /* ---------------------------------------------------
         SUBJECT UPDATE
         --------------------------------------------------- */

      if (type === "Subject") {

        const fields = {

          "Subject Name":
            body.name ||
            body.subject ||
            "",

          "Subject ID":
            body.code || "",

          "Programme":
            body.programme || "",

          "Status":
            body.status || "Active",

          "Notes":
            body.notes || ""
        };

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.subjects,
              recordId
            ),
            {
              method: "PATCH",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(200).json({
          success: true,
          record: mapSubject(data)
        });
      }

      /* ---------------------------------------------------
         TEACHER UPDATE
         --------------------------------------------------- */

      if (type === "Teacher") {

        const fields = {

          "Teacher Name":
            body.name ||
            body.teacher ||
            "",

          "Teacher ID":
            body.code || "",

          "Subject":
            body.subject || "",

          "Status":
            body.status || "Active",

          "Notes":
            body.notes || ""
        };

        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.teachers,
              recordId
            ),
            {
              method: "PATCH",
              body: JSON.stringify({
                fields
              })
            }
          );

        return res.status(200).json({
          success: true,
          record: mapTeacher(data)
        });
      }

      /* ---------------------------------------------------
         ACADEMIC / ASSIGNMENT UPDATE
         --------------------------------------------------- */

      const fields = {

        "Type":
          type,

        "Name":
          String(
            body.name || ""
          ).trim(),

        "Code":
          String(
            body.code || ""
          ).trim(),

        "Programme":
          String(
            body.programme || ""
          ).trim(),

        "Class Name":
          String(
            body.className || ""
          ).trim(),

        "Subject":
          String(
            body.subject || ""
          ).trim(),

        "Teacher":
          String(
            body.teacher || ""
          ).trim(),

        "Status":
          String(
            body.status ||
            "Active"
          ).trim(),

        "Notes":
          String(
            body.notes || ""
          ).trim()
      };

      const data =
        await airtableFetch(
          airtableUrl(
            TABLES.academic,
            recordId
          ),
          {
            method: "PATCH",
            body: JSON.stringify({
              fields
            })
          }
        );

      return res.status(200).json({
        success: true,
        record: mapAcademic(data)
      });
    }

    /* =====================================================
       DELETE
       ===================================================== */

    if (req.method === "DELETE") {

      const recordId =
        req.query?.id ||
        req.body?.id ||
        req.body?.recordId;

      const type =
        String(
          req.query?.type ||
          req.body?.type ||
          ""
        ).trim();

      if (!recordId) {
        return res.status(400).json({
          success: false,
          error: "Record ID is required."
        });
      }

      let table;

      if (type === "Class") {
        table = TABLES.classes;
      } else if (type === "Subject") {
        table = TABLES.subjects;
      } else if (type === "Teacher") {
        table = TABLES.teachers;
      } else {
        table = TABLES.academic;
      }

      await airtableFetch(
        airtableUrl(
          table,
          recordId
        ),
        {
          method: "DELETE"
        }
      );

      return res.status(200).json({
        success: true,
        deleted: recordId
      });
    }

    /* =====================================================
       METHOD NOT ALLOWED
       ===================================================== */

    res.setHeader(
      "Allow",
      "GET,POST,PUT,PATCH,DELETE"
    );

    return res.status(405).json({
      success: false,
      error:
        `Method ${req.method} not allowed.`
    });

  } catch (error) {

    console.error(
      "Academic API Error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Internal server error."
    });
  }
}
