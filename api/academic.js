// api/academic.js
// Aibinu Flexiprep Educonsult
// MERGED ACADEMIC MANAGEMENT + NOTEBOOK STATS API

const TABLES = {
  academic: "tbljnjBdJrYr1WXGY",
  classes: "tblpwV6RF0IpHGWLg",
  subjects: "tblQJzVQrpVgbx1j9",
  teachers: "tblVjuSJe4R5kcOZr"
};

const PROGRAMMES = ["WAEC", "NECO", "UTME"];

const STATS_TABLES = {
  notes: "tblsEjHgHA7vhPgm0",
  approvals: "tblJHGCDxEpdjm46y",
  aiJobs: "tbldFSYwYcTMtMm9A"
};

// ---------------------------------------------------------
// CONFIG
// ---------------------------------------------------------

function config() {
  const token = process.env.AIRTABLE_PAT;
  const baseId =
    process.env.AIRTABLE_BASE_ID || "app285TkNT13HPdqi";

  if (!token) {
    throw new Error("AIRTABLE_PAT is not configured");
  }

  return {
    token,
    baseId
  };
}

// ---------------------------------------------------------
// AIRTABLE HELPERS
// ---------------------------------------------------------

async function listAll(baseId, tableId, token) {
  const rows = [];
  let offset = "";

  do {
    const url =
      `https://api.airtable.com/v0/${baseId}/${tableId}` +
      (offset ? `?offset=${encodeURIComponent(offset)}` : "");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Airtable GET failed ${response.status}: ${text}`
      );
    }

    const data = await response.json();

    rows.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  return rows;
}

async function airtableWrite(
  baseId,
  tableId,
  token,
  method,
  recordId,
  fields
) {
  const url =
    `https://api.airtable.com/v0/${baseId}/${tableId}` +
    (recordId ? `/${recordId}` : "");

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields
    })
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Airtable ${method} failed ${response.status}: ${text}`
    );
  }

  return response.json();
}

// ---------------------------------------------------------
// GENERAL FIELD HELPERS
// ---------------------------------------------------------

function firstValue(fields, names, fallback = "") {
  for (const name of names) {
    if (
      fields &&
      fields[name] !== undefined &&
      fields[name] !== null &&
      fields[name] !== ""
    ) {
      return fields[name];
    }
  }

  return fallback;
}

function textValue(value) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return String(value.name || "").trim();
  }

  return String(value ?? "").trim();
}

// ---------------------------------------------------------
// RECORD MAPPERS
// ---------------------------------------------------------

function mapAcademic(record) {
  const f = record.fields || {};

  return {
    id: record.id,

    academicId: firstValue(
      f,
      ["Academic ID", "ID", "Record ID"],
      record.id
    ),

    programme: firstValue(
      f,
      ["Programme", "Program"],
      ""
    ),

    className: firstValue(
      f,
      ["Class Name", "Class", "Level"],
      ""
    ),

    subject: firstValue(
      f,
      ["Subject", "Subject Name"],
      ""
    ),

    teacher: firstValue(
      f,
      ["Teacher", "Teacher Name"],
      ""
    ),

    title: firstValue(
      f,
      ["Title", "Assignment Title", "Name"],
      ""
    ),

    type: firstValue(
      f,
      ["Type", "Content Type"],
      ""
    ),

    description: firstValue(
      f,
      ["Description", "Details"],
      ""
    ),

    status: firstValue(
      f,
      ["Status"],
      ""
    ),

    date: firstValue(
      f,
      ["Date", "Due Date", "Created"],
      ""
    ),

    createdAt: firstValue(
      f,
      ["Created At", "Created"],
      ""
    ),

    updatedAt: firstValue(
      f,
      ["Updated At", "Last Updated"],
      ""
    )
  };
}

function mapClass(record) {
  const f = record.fields || {};

  return {
    id: record.id,

    classId: firstValue(
      f,
      ["Class ID", "ID"],
      record.id
    ),

    // IMPORTANT:
    // Class is shared across WAEC / NECO / UTME.
    className: firstValue(
      f,
      ["Class Name", "Level", "Name", "Class"],
      ""
    ),

    level: firstValue(
      f,
      ["Level", "Class Name", "Class"],
      ""
    ),

    programme: firstValue(
      f,
      ["Programme", "Program"],
      ""
    ),

    capacity: Number(
      firstValue(
        f,
        ["Capacity"],
        0
      )
    ) || 0,

    classTeacher: firstValue(
      f,
      ["Class Teacher", "Teacher", "Teacher Name"],
      ""
    ),

    status: firstValue(
      f,
      ["Status"],
      "Active"
    )
  };
}

function mapSubject(record) {
  const f = record.fields || {};

  return {
    id: record.id,

    subjectId: firstValue(
      f,
      ["Subject ID", "ID"],
      record.id
    ),

    subjectName: firstValue(
      f,
      ["Subject Name", "Name", "Subject"],
      ""
    ),

    code: firstValue(
      f,
      ["Code", "Subject Code"],
      ""
    ),

    category: firstValue(
      f,
      ["Category"],
      ""
    ),

    status: firstValue(
      f,
      ["Status"],
      "Active"
    )
  };
}

function mapTeacher(record) {
  const f = record.fields || {};

  return {
    id: record.id,

    teacherId: firstValue(
      f,
      ["Teacher ID", "ID"],
      record.id
    ),

    name: firstValue(
      f,
      ["Teacher Name", "Name", "Teacher"],
      ""
    ),

    email: firstValue(
      f,
      ["Email"],
      ""
    ),

    phone: firstValue(
      f,
      ["Phone", "Phone Number"],
      ""
    ),

    subject: firstValue(
      f,
      ["Subject", "Specialization"],
      ""
    ),

    status: firstValue(
      f,
      ["Status"],
      "Active"
    )
  };
}

// ---------------------------------------------------------
// ID GENERATOR
// ---------------------------------------------------------

function gen(prefix) {
  const now = new Date();

  const year = now.getFullYear();

  const random = Math.floor(
    Math.random() * 900000
  ) + 100000;

  return `${prefix}-${year}-${random}`;
}

// ---------------------------------------------------------
// PROGRAMME RECORDS
// ---------------------------------------------------------

function uniqueProgrammeRecords(records) {
  const found = new Set();

  for (const record of records) {
    const programme = textValue(
      record.fields?.Programme
    );

    if (programme) {
      found.add(programme.toUpperCase());
    }
  }

  return PROGRAMMES.map(programme => ({
    programme,
    active: found.has(programme)
  }));
}

// ---------------------------------------------------------
// MAIN HANDLER
// ---------------------------------------------------------

export default async function handler(req, res) {
  try {
    const { token, baseId } = config();

    // =====================================================
    // NOTEBOOK DASHBOARD STATISTICS
    //
    // GET /api/academic?stats=1
    // =====================================================

    if (
      req.method === "GET" &&
      String(req.query?.stats || "") === "1"
    ) {
      const [
        notes,
        approvals,
        aiJobs
      ] = await Promise.all([
        listAll(
          baseId,
          STATS_TABLES.notes,
          token
        ),

        listAll(
          baseId,
          STATS_TABLES.approvals,
          token
        ),

        listAll(
          baseId,
          STATS_TABLES.aiJobs,
          token
        )
      ]);

      // ---------------------------------------------------
      // NOTE DRAFTS
      // ---------------------------------------------------

      const noteDrafts = notes.filter(record => {
        const status = textValue(
          record.fields?.Status
        ).toLowerCase();

        return [
          "ai draft",
          "draft",
          "changes requested"
        ].includes(status);
      }).length;

      // ---------------------------------------------------
      // PUBLISHED NOTES
      // ---------------------------------------------------

      const published = notes.filter(record => {
        const status = textValue(
          record.fields?.Status
        ).toLowerCase();

        return status === "published";
      }).length;

      // ---------------------------------------------------
      // PENDING REVIEWS
      // ---------------------------------------------------

      const pendingReview = approvals.filter(record => {
        const status = textValue(
          record.fields?.Status
        ).toLowerCase();

        return [
          "pending",
          "submitted",
          "under review",
          "pending review"
        ].includes(status);
      }).length;

      // ---------------------------------------------------
      // GENERATED AI JOBS
      // ---------------------------------------------------

      const generatedAIJobs = aiJobs.filter(record => {
        const status = textValue(
          record.fields?.Status
        ).toLowerCase();

        return status === "generated";
      });

      // ---------------------------------------------------
      // GENERATED AI NOTES
      // ---------------------------------------------------

      const aiNoteJobs = generatedAIJobs.filter(record => {
        const contentType = textValue(
          record.fields?.["Content Type"]
        ).toLowerCase();

        return contentType === "note";
      }).length;

      // ---------------------------------------------------
      // GENERATED AI QUESTIONS
      // ---------------------------------------------------

      const aiQuestionJobs = generatedAIJobs.filter(record => {
        const contentType = textValue(
          record.fields?.["Content Type"]
        ).toLowerCase();

        return contentType === "question";
      }).length;

      // ---------------------------------------------------
      // DASHBOARD DRAFT CONTENT
      //
      // Draft Content =
      // Note drafts + generated AI question jobs
      // ---------------------------------------------------

      const draftContent =
        noteDrafts + aiQuestionJobs;

      return res.status(200).json({
        success: true,

        // Main dashboard values
        draftContent,
        published,
        pendingReview,
        aiJobs: aiJobs.length,

        // Detailed values
        draftNotes: draftContent,
        noteDrafts,
        draftQuestions: aiQuestionJobs,

        generatedAIJobs:
          generatedAIJobs.length,

        aiNoteJobs,
        aiQuestionJobs,

        generatedAt:
          new Date().toISOString()
      });
    }

    // =====================================================
    // GET — ACADEMIC MANAGEMENT
    // =====================================================

    if (req.method === "GET") {
      const [
        academicRecords,
        classRecords,
        subjectRecords,
        teacherRecords
      ] = await Promise.all([
        listAll(
          baseId,
          TABLES.academic,
          token
        ),

        listAll(
          baseId,
          TABLES.classes,
          token
        ),

        listAll(
          baseId,
          TABLES.subjects,
          token
        ),

        listAll(
          baseId,
          TABLES.teachers,
          token
        )
      ]);

      const assignments =
        academicRecords.map(mapAcademic);

      const classes =
        classRecords.map(mapClass);

      const subjects =
        subjectRecords.map(mapSubject);

      const teachers =
        teacherRecords.map(mapTeacher);

      const programmes =
        uniqueProgrammeRecords(
          academicRecords
        );

      return res.status(200).json({
        success: true,

        assignments,

        programmes,

        classes,

        subjects,

        teachers,

        counts: {
          assignments:
            assignments.length,

          programmes:
            programmes.length,

          classes:
            classes.length,

          subjects:
            subjects.length,

          teachers:
            teachers.length
        }
      });
    }

    // =====================================================
    // POST
    // =====================================================

    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : (req.body || {});

      const type =
        String(
          body.type ||
          body.recordType ||
          ""
        ).trim();

      // ---------------------------------------------------
      // CREATE PROGRAMME
      // ---------------------------------------------------

      if (
        type.toLowerCase() ===
        "programme"
      ) {
        const programme =
          String(
            body.programme ||
            body.name ||
            ""
          ).trim().toUpperCase();

        if (
          !PROGRAMMES.includes(programme)
        ) {
          return res.status(400).json({
            success: false,
            error:
              "Invalid programme. Use WAEC, NECO or UTME."
          });
        }

        const record =
          await airtableWrite(
            baseId,
            TABLES.academic,
            token,
            "POST",
            null,
            {
              Programme: programme
            }
          );

        return res.status(201).json({
          success: true,
          record: mapAcademic(record)
        });
      }

      // ---------------------------------------------------
      // CREATE ASSIGNMENT
      // ---------------------------------------------------

      if (
        type.toLowerCase() ===
        "assignment"
      ) {
        const fields = {
          "Academic ID":
            body.academicId ||
            gen("ACAD"),

          "Programme":
            body.programme || "",

          "Class Name":
            body.className ||
            body.class ||
            "",

          "Subject":
            body.subject || "",

          "Teacher":
            body.teacher || "",

          "Title":
            body.title || "",

          "Type":
            "Assignment",

          "Description":
            body.description || "",

          "Status":
            body.status || "Active",

          "Date":
            body.date || "",

          "Created At":
            new Date().toISOString()
        };

        const record =
          await airtableWrite(
            baseId,
            TABLES.academic,
            token,
            "POST",
            null,
            fields
          );

        return res.status(201).json({
          success: true,
          record: mapAcademic(record)
        });
      }

      // ---------------------------------------------------
      // CREATE CLASS
      // ---------------------------------------------------

      if (
        type.toLowerCase() ===
        "class"
      ) {
        const className =
          body.className ||
          body.level ||
          body.name ||
          "";

        if (!className) {
          return res.status(400).json({
            success: false,
            error:
              "Class Name is required."
          });
        }

        const fields = {
          "Class ID":
            body.classId ||
            gen("CLS"),

          // Keep both fields synchronized.
          "Class Name":
            className,

          "Level":
            body.level ||
            className,

          "Programme":
            body.programme || "",

          "Capacity":
            Number(
              body.capacity || 25
            ),

          "Class Teacher":
            body.classTeacher ||
            body.teacher ||
            "",

          "Status":
            body.status ||
            "Active"
        };

        const record =
          await airtableWrite(
            baseId,
            TABLES.classes,
            token,
            "POST",
            null,
            fields
          );

        return res.status(201).json({
          success: true,
          record: mapClass(record)
        });
      }

      // ---------------------------------------------------
      // CREATE SUBJECT
      // ---------------------------------------------------

      if (
        type.toLowerCase() ===
        "subject"
      ) {
        const subjectName =
          body.subjectName ||
          body.name ||
          body.subject ||
          "";

        if (!subjectName) {
          return res.status(400).json({
            success: false,
            error:
              "Subject Name is required."
          });
        }

        const fields = {
          "Subject ID":
            body.subjectId ||
            gen("SUB"),

          "Subject Name":
            subjectName,

          "Code":
            body.code || "",

          "Category":
            body.category || "",

          "Status":
            body.status ||
            "Active"
        };

        const record =
          await airtableWrite(
            baseId,
            TABLES.subjects,
            token,
            "POST",
            null,
            fields
          );

        return res.status(201).json({
          success: true,
          record: mapSubject(record)
        });
      }

      // ---------------------------------------------------
      // CREATE TEACHER
      // ---------------------------------------------------

      if (
        type.toLowerCase() ===
        "teacher"
      ) {
        const name =
          body.name ||
          body.teacherName ||
          body.teacher ||
          "";

        if (!name) {
          return res.status(400).json({
            success: false,
            error:
              "Teacher Name is required."
          });
        }

        const fields = {
          "Teacher ID":
            body.teacherId ||
            gen("TCH"),

          "Teacher Name":
            name,

          "Email":
            body.email || "",

          "Phone":
            body.phone || "",

          "Subject":
            body.subject || "",

          "Status":
            body.status ||
            "Active"
        };

        const record =
          await airtableWrite(
            baseId,
            TABLES.teachers,
            token,
            "POST",
            null,
            fields
          );

        return res.status(201).json({
          success: true,
          record: mapTeacher(record)
        });
      }

      return res.status(400).json({
        success: false,
        error:
          `Unsupported POST type: ${type}`
      });
    }

    // =====================================================
    // PUT
    // =====================================================

    if (req.method === "PUT") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body)
          : (req.body || {});

      const type =
        String(
          body.type ||
          body.recordType ||
          ""
        ).trim().toLowerCase();

      const recordId =
        body.id ||
        body.recordId;

      if (!recordId) {
        return res.status(400).json({
          success: false,
          error:
            "Record ID is required."
        });
      }

      // ---------------------------------------------------
      // UPDATE ACADEMIC / ASSIGNMENT
      // ---------------------------------------------------

      if (
        type === "academic" ||
        type === "assignment"
      ) {
        const fields = {};

        if (
          body.programme !== undefined
        ) {
          fields["Programme"] =
            body.programme;
        }

        if (
          body.className !== undefined
        ) {
          fields["Class Name"] =
            body.className;
        }

        if (
          body.subject !== undefined
        ) {
          fields["Subject"] =
            body.subject;
        }

        if (
          body.teacher !== undefined
        ) {
          fields["Teacher"] =
            body.teacher;
        }

        if (
          body.title !== undefined
        ) {
          fields["Title"] =
            body.title;
        }

        if (
          body.description !== undefined
        ) {
          fields["Description"] =
            body.description;
        }

        if (
          body.status !== undefined
        ) {
          fields["Status"] =
            body.status;
        }

        if (
          body.date !== undefined
        ) {
          fields["Date"] =
            body.date;
        }

        fields["Updated At"] =
          new Date().toISOString();

        const record =
          await airtableWrite(
            baseId,
            TABLES.academic,
            token,
            "PATCH",
            recordId,
            fields
          );

        return res.status(200).json({
          success: true,
          record:
            mapAcademic(record)
        });
      }

      // ---------------------------------------------------
      // UPDATE CLASS
      // ---------------------------------------------------

      if (type === "class") {
        const fields = {};

        const className =
          body.className ??
          body.level ??
          body.name;

        if (
          className !== undefined
        ) {
          // Keep both Class Name and Level
          // synchronized.
          fields["Class Name"] =
            className;

          fields["Level"] =
            body.level ??
            className;
        }

        if (
          body.programme !== undefined
        ) {
          fields["Programme"] =
            body.programme;
        }

        if (
          body.capacity !== undefined
        ) {
          fields["Capacity"] =
            Number(body.capacity);
        }

        if (
          body.classTeacher !== undefined
        ) {
          fields["Class Teacher"] =
            body.classTeacher;
        }

        if (
          body.status !== undefined
        ) {
          fields["Status"] =
            body.status;
        }

        const record =
          await airtableWrite(
            baseId,
            TABLES.classes,
            token,
            "PATCH",
            recordId,
            fields
          );

        return res.status(200).json({
          success: true,
          record:
            mapClass(record)
        });
      }

      // ---------------------------------------------------
      // UPDATE SUBJECT
      // ---------------------------------------------------

      if (type === "subject") {
        const fields = {};

        if (
          body.subjectName !== undefined
        ) {
          fields["Subject Name"] =
            body.subjectName;
        }

        if (
          body.name !== undefined &&
          body.subjectName === undefined
        ) {
          fields["Subject Name"] =
            body.name;
        }

        if (
          body.code !== undefined
        ) {
          fields["Code"] =
            body.code;
        }

        if (
          body.category !== undefined
        ) {
          fields["Category"] =
            body.category;
        }

        if (
          body.status !== undefined
        ) {
          fields["Status"] =
            body.status;
        }

        const record =
          await airtableWrite(
            baseId,
            TABLES.subjects,
            token,
            "PATCH",
            recordId,
            fields
          );

        return res.status(200).json({
          success: true,
          record:
            mapSubject(record)
        });
      }

      // ---------------------------------------------------
      // UPDATE TEACHER
      // ---------------------------------------------------

      if (type === "teacher") {
        const fields = {};

        if (
          body.name !== undefined
        ) {
          fields["Teacher Name"] =
            body.name;
        }

        if (
          body.teacherName !== undefined
        ) {
          fields["Teacher Name"] =
            body.teacherName;
        }

        if (
          body.email !== undefined
        ) {
          fields["Email"] =
            body.email;
        }

        if (
          body.phone !== undefined
        ) {
          fields["Phone"] =
            body.phone;
        }

        if (
          body.subject !== undefined
        ) {
          fields["Subject"] =
            body.subject;
        }

        if (
          body.status !== undefined
        ) {
          fields["Status"] =
            body.status;
        }

        const record =
          await airtableWrite(
            baseId,
            TABLES.teachers,
            token,
            "PATCH",
            recordId,
            fields
          );

        return res.status(200).json({
          success: true,
          record:
            mapTeacher(record)
        });
      }

      return res.status(400).json({
        success: false,
        error:
          `Unsupported PUT type: ${type}`
      });
    }

    // =====================================================
    // METHOD NOT ALLOWED
    // =====================================================

    res.setHeader(
      "Allow",
      "GET,POST,PUT"
    );

    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });

  } catch (error) {
    console.error(
      "Academic API error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error"
    });
  }
}
