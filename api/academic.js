const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  academic: "tbljnjBdJrYr1WXGY",
  classes: "tblpwV6RF0IpHGWLg",
  subjects: "tblQJzVQrpVgbx1j9",
  teachers: "tblVjuSJe4R5kcOZr"
};

// ============================================================
// NOTEBANK TABLES
// These are READ-ONLY here and are used only for statistics.
// ============================================================

const NOTEBANK_TABLES = {
  notes: "tblsEjHgHA7vhPgm0",
  jobs: "tbldFSYwYcTMtMm9A"
};

function config() {
  const token =
    process.env.AIRTABLE_PAT ||
    process.env.AIRTABLE_TOKEN;

  const baseId =
    process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error(
      "Airtable environment variables are not configured."
    );
  }

  return {
    token,
    baseId
  };
}

const headers = token => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});

const makeId = (source, recordId) =>
  `${source}|${recordId}`;


// ============================================================
// GET ALL AIRTABLE RECORDS
// ============================================================

async function listAll(baseId, tableId, token) {
  const all = [];
  let offset = null;

  do {
    const url =
      `${AIRTABLE_API}/${baseId}/${tableId}` +
      (
        offset
          ? `?offset=${encodeURIComponent(offset)}`
          : ""
      );

    const r = await fetch(url, {
      headers: headers(token)
    });

    const text = await r.text();

    let d;

    try {
      d = JSON.parse(text);
    } catch {
      throw new Error(
        `Airtable returned invalid JSON (${r.status}).`
      );
    }

    if (!r.ok) {
      throw new Error(
        d?.error?.message ||
        "Airtable read failed"
      );
    }

    all.push(...(d.records || []));

    offset = d.offset || null;

  } while (offset);

  return all;
}


// ============================================================
// MAP ACADEMIC RECORD
// ============================================================

function mapAcademic(r) {
  const f = r.fields || {};

  const type =
    String(
      f.Type || "Programme"
    ).trim();

  return {
    airtableId: makeId(
      "academic",
      r.id
    ),

    type:
      type === "Assignment"
        ? "Assignment"
        : "Programme",

    name:
      f.Name ||
      (
        f.Class &&
        f.Subject &&
        f.Teacher
          ? `${f.Class} — ${f.Subject} — ${f.Teacher}`
          : ""
      ),

    code: f.Code || "",

    programme:
      f.Programme || "",

    className:
      f.Class || "",

    subject:
      f.Subject || "",

    teacher:
      f.Teacher || "",

    status:
      f.Status || "Active",

    notes:
      f.Notes || ""
  };
}


// ============================================================
// MAP CLASS
// ============================================================

function mapClass(r) {
  const f = r.fields || {};

  return {
    airtableId: makeId(
      "classes",
      r.id
    ),

    type: "Class",

    name:
      f["Class Name"] || "",

    code:
      f["Class ID"] || "",

    programme:
      f.Programme || "",

    className:
      f["Class Name"] || "",

    subject: "",

    teacher: "",

    status:
      f.Status || "Active",

    notes: ""
  };
}


// ============================================================
// MAP SUBJECT
// ============================================================

function mapSubject(r) {
  const f = r.fields || {};

  return {
    airtableId: makeId(
      "subjects",
      r.id
    ),

    type: "Subject",

    name:
      f["Subject Name"] || "",

    code:
      f["Subject Code"] || "",

    programme: "",

    className: "",

    subject:
      f["Subject Name"] || "",

    teacher: "",

    status:
      f.Status || "Active",

    notes: ""
  };
}


// ============================================================
// MAP TEACHER
// ============================================================

function mapTeacher(r) {
  const f = r.fields || {};

  return {
    airtableId: makeId(
      "teachers",
      r.id
    ),

    type: "Teacher",

    name:
      f["Full Name"] || "",

    code:
      f["Teacher ID"] || "",

    programme: "",

    className: "",

    subject: "",

    teacher:
      f["Full Name"] || "",

    status:
      f["Employment Status"] ||
      "Active",

    notes:
      f.Notes || ""
  };
}


// ============================================================
// AIRTABLE WRITE
// ============================================================

async function airtableWrite(
  baseId,
  tableId,
  token,
  method,
  recordId,
  fields
) {
  const url =
    `${AIRTABLE_API}/${baseId}/${tableId}` +
    (
      recordId
        ? `/${encodeURIComponent(recordId)}`
        : ""
    );

  const r = await fetch(url, {
    method,

    headers: headers(token),

    body: JSON.stringify(
      recordId
        ? {
            fields,
            typecast: true
          }
        : {
            records: [
              {
                fields
              }
            ],
            typecast: true
          }
    )
  });

  const text = await r.text();

  let d;

  try {
    d = JSON.parse(text);
  } catch {
    throw new Error(
      `Airtable returned invalid JSON (${r.status}).`
    );
  }

  if (!r.ok) {
    throw new Error(
      d?.error?.message ||
      "Airtable write failed"
    );
  }

  return recordId
    ? d
    : d.records[0];
}


// ============================================================
// GENERATE ID
// ============================================================

function gen(prefix) {
  return (
    `${prefix}-${new Date().getFullYear()}-` +
    `${String(Date.now()).slice(-6)}`
  );
}


// ============================================================
// GENERATE UNIQUE PROGRAMMES
// FROM THE ACADEMIC TABLE
// ============================================================

function uniqueProgrammeRecords(
  academic
) {
  const seen = new Set();

  const out = [];

  for (const r of academic) {

    const f = r.fields || {};

    const name =
      String(
        f.Programme || ""
      ).trim();

    if (!name) continue;

    const key =
      name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);

    out.push({

      airtableId:
        `virtual|${encodeURIComponent(name)}`,

      type: "Programme",

      name,

      code: name,

      programme: name,

      className: "",

      subject: "",

      teacher: "",

      status: "Active",

      notes: ""
    });
  }

  return out;
}


// ============================================================
// MAIN API HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  try {

    const {
      token,
      baseId
    } = config();


    // ========================================================
    // GET
    // ========================================================

    if (req.method === "GET") {


      // ======================================================
      // NOTEBANK STATISTICS
      //
      // URL:
      // /api/academic?stats=1
      //
      // This replaces:
      // /api/notebank-stats
      //
      // It allows us to keep the total number of Vercel
      // serverless functions within the Hobby-plan limit.
      // ======================================================

      if (
        req.query &&
        req.query.stats === "1"
      ) {

        const [
          notes,
          jobs
        ] = await Promise.all([

          listAll(
            baseId,
            NOTEBANK_TABLES.notes,
            token
          ),

          listAll(
            baseId,
            NOTEBANK_TABLES.jobs,
            token
          )

        ]);


        // ----------------------------------------------------
        // Extract NoteBank statuses
        // ----------------------------------------------------

        const statuses =
          notes.map(
            record =>
              String(
                record.fields?.Status ||
                ""
              ).trim()
          );


        // ----------------------------------------------------
        // Draft Notes
        //
        // AI Draft
        // Draft
        // Changes Requested
        // ----------------------------------------------------

        const draftNotes =
          statuses.filter(
            status =>
              [
                "AI Draft",
                "Draft",
                "Changes Requested"
              ].includes(status)
          ).length;


        // ----------------------------------------------------
        // Notes awaiting review
        // ----------------------------------------------------

        const pendingReview =
          statuses.filter(
            status =>
              status === "Under Review"
          ).length;


        // ----------------------------------------------------
        // Published Notes
        // ----------------------------------------------------

        const published =
          statuses.filter(
            status =>
              status === "Published"
          ).length;


        // ----------------------------------------------------
        // AI Content Jobs
        // ----------------------------------------------------

        const aiJobs =
          jobs.length;


        // ----------------------------------------------------
        // Return NoteBank statistics
        // ----------------------------------------------------

        return res.status(200).json({

          success: true,

          draftNotes,

          pendingReview,

          published,

          aiJobs

        });
      }


      // ======================================================
      // EXISTING ACADEMIC DATA
      // ======================================================

      const [
        academic,
        classes,
        subjects,
        teachers
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


      // ------------------------------------------------------
      // Map Academic records
      // ------------------------------------------------------

      const academicRecords =
        academic.map(
          mapAcademic
        );


      // ------------------------------------------------------
      // Explicit programmes
      // ------------------------------------------------------

      const explicitProgrammes =
        academicRecords.filter(
          r =>
            r.type === "Programme"
        );


      // ------------------------------------------------------
      // Programme names
      // ------------------------------------------------------

      const programmeNames =
        new Map();


      for (
        const p of [
          ...explicitProgrammes,

          ...uniqueProgrammeRecords(
            academic
          )
        ]
      ) {

        const key =
          String(
            p.name ||
            p.programme ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          key &&
          !programmeNames.has(key)
        ) {

          programmeNames.set(
            key,
            {
              ...p,
              type: "Programme"
            }
          );

        }
      }


      // ------------------------------------------------------
      // Combine all academic records
      // ------------------------------------------------------

      const records = [

        // Assignments
        ...academicRecords.filter(
          r =>
            r.type === "Assignment"
        ),

        // Programmes
        ...programmeNames.values(),

        // Classes
        ...classes.map(
          mapClass
        ),

        // Subjects
        ...subjects.map(
          mapSubject
        ),

        // Teachers
        ...teachers.map(
          mapTeacher
        )

      ];


      // ------------------------------------------------------
      // Return existing Academic Management data
      // ------------------------------------------------------

      return res.status(200).json({

        records,

        counts: {

          programmes:
            [
              ...programmeNames.values()
            ].length,

          classes:
            classes.length,

          subjects:
            subjects.length,

          teachers:
            teachers.length,

          assignments:
            academicRecords.filter(
              r =>
                r.type === "Assignment"
            ).length

        }

      });

    }


    // ========================================================
    // POST
    // ========================================================

    if (req.method === "POST") {

      const b =
        req.body || {};

      const type =
        b.type;


      let table =
        TABLES.academic;

      let source =
        "academic";

      let fields;


      // ======================================================
      // PROGRAMME
      // ======================================================

      if (
        type === "Programme"
      ) {

        fields = {

          Type:
            "Programme",

          Name:
            b.name,

          Code:
            b.code ||
            b.name,

          Programme:
            b.name,

          Status:
            b.status ||
            "Active",

          Notes:
            b.notes ||
            ""

        };


      // ======================================================
      // ASSIGNMENT
      // ======================================================

      } else if (
        type === "Assignment"
      ) {

        fields = {

          Type:
            "Assignment",

          Name:
            b.name ||
            [
              b.className,
              b.subject,
              b.teacher
            ]
              .filter(Boolean)
              .join(" — "),

          Programme:
            b.programme ||
            "",

          Class:
            b.className ||
            "",

          Subject:
            b.subject ||
            "",

          Teacher:
            b.teacher ||
            "",

          Status:
            b.status ||
            "Active",

          Notes:
            b.notes ||
            ""

        };


      // ======================================================
      // CLASS
      // ======================================================

      } else if (
        type === "Class"
      ) {

        table =
          TABLES.classes;

        source =
          "classes";


        fields = {

          "Class ID":
            b.code ||
            gen("CLS"),

          "Class Name":
            b.name,

          Programme:
            b.programme ||
            "",

          Level:
            b.name ||
            "",

          Capacity:
            Number(
              b.capacity ||
              25
            ),

          Status:
            b.status ||
            "Active"

        };


      // ======================================================
      // SUBJECT
      // ======================================================

      } else if (
        type === "Subject"
      ) {

        table =
          TABLES.subjects;

        source =
          "subjects";


        fields = {

          "Subject Code":
            b.code ||
            gen("SUB"),

          "Subject Name":
            b.name,

          Status:
            b.status ||
            "Active"

        };


      // ======================================================
      // TEACHER
      // ======================================================

      } else if (
        type === "Teacher"
      ) {

        table =
          TABLES.teachers;

        source =
          "teachers";


        fields = {

          "Teacher ID":
            b.code ||
            gen("TCH"),

          "Full Name":
            b.name,

          "Employment Status":
            b.status ||
            "Active",

          Notes:
            b.notes ||
            ""

        };


      // ======================================================
      // INVALID TYPE
      // ======================================================

      } else {

        return res.status(400).json({

          error:
            "Invalid academic record type."

        });

      }


      // ======================================================
      // WRITE TO AIRTABLE
      // ======================================================

      const r =
        await airtableWrite(
          baseId,
          table,
          token,
          "POST",
          null,
          fields
        );


      return res.status(201).json({

        record: {

          ...b,

          airtableId:
            makeId(
              source,
              r.id
            )

        }

      });

    }


    // ========================================================
    // PUT
    // ========================================================

    if (req.method === "PUT") {

      const b =
        req.body || {};


      const parts =
        String(
          b.airtableId || ""
        ).split("|");


      const source =
        parts.shift();


      const recordId =
        parts.join("|");


      // ------------------------------------------------------
      // Validate record
      // ------------------------------------------------------

      if (
        !recordId ||
        !TABLES[source] ||
        source === "virtual"
      ) {

        return res.status(400).json({

          error:
            "Invalid record ID."

        });

      }


      let fields;


      // ======================================================
      // UPDATE ACADEMIC / ASSIGNMENT
      // ======================================================

      if (
        source === "academic"
      ) {

        const assignment =
          b.type === "Assignment";


        fields = {

          Type:
            assignment
              ? "Assignment"
              : "Programme",

          Name:
            assignment
              ? (
                  b.name ||
                  [
                    b.className,
                    b.subject,
                    b.teacher
                  ]
                    .filter(Boolean)
                    .join(" — ")
                )
              : b.name,

          Code:
            b.code ||
            "",

          Programme:
            b.programme ||
            "",

          Class:
            b.className ||
            "",

          Subject:
            b.subject ||
            "",

          Teacher:
            b.teacher ||
            "",

          Status:
            b.status ||
            "Active",

          Notes:
            b.notes ||
            ""

        };


      // ======================================================
      // UPDATE CLASS
      // ======================================================

      } else if (
        source === "classes"
      ) {

        fields = {

          "Class ID":
            b.code ||
            "",

          "Class Name":
            b.name,

          Programme:
            b.programme ||
            "",

          Status:
            b.status ||
            "Active"

        };


      // ======================================================
      // UPDATE SUBJECT
      // ======================================================

      } else if (
        source === "subjects"
      ) {

        fields = {

          "Subject Code":
            b.code ||
            "",

          "Subject Name":
            b.name,

          Status:
            b.status ||
            "Active"

        };


      // ======================================================
      // UPDATE TEACHER
      // ======================================================

      } else if (
        source === "teachers"
      ) {

        fields = {

          "Teacher ID":
            b.code ||
            "",

          "Full Name":
            b.name,

          "Employment Status":
            b.status ||
            "Active",

          Notes:
            b.notes ||
            ""

        };

      }


      // ======================================================
      // WRITE UPDATE TO AIRTABLE
      // ======================================================

      const r =
        await airtableWrite(
          baseId,
          TABLES[source],
          token,
          "PATCH",
          recordId,
          fields
        );


      return res.status(200).json({

        record: {

          ...b,

          airtableId:
            makeId(
              source,
              r.id
            )

        }

      });

    }


    // ========================================================
    // METHOD NOT ALLOWED
    // ========================================================

    return res.status(405).json({

      error:
        "Method not allowed."

    });


  } catch (err) {

    console.error(
      "Academic API error:",
      err
    );


    return res.status(500).json({

      error:
        err.message ||
        "Academic API failed."

    });

  }

}
