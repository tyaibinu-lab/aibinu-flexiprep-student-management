const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  academic: "tbljnjBdJrYr1WXGY",
  classes: "tblpwV6RF0IpHGWLg",
  subjects: "tblQJzVQrpVgbx1j9",
  teachers: "tblVjuSJe4R5kcOZr"
};

function config() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error(
      "Airtable environment variables are not configured."
    );
  }

  return { token, baseId };
}

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});


// ============================================================
// GET ALL RECORDS FROM AN AIRTABLE TABLE
// ============================================================

async function listAll(baseId, tableId, token) {
  let all = [];
  let offset = null;

  do {
    const q = offset
      ? `?offset=${encodeURIComponent(offset)}`
      : "";

    const r = await fetch(
      `${AIRTABLE_API}/${baseId}/${tableId}${q}`,
      {
        headers: headers(token)
      }
    );

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


// ============================================================
// INTERNAL RECORD ID
// ============================================================

const id = (source, recordId) =>
  `${source}|${recordId}`;


// ============================================================
// MAP ACADEMIC RECORD
// ============================================================

function mapAcademic(r) {
  const f = r.fields || {};

  const legacy =
    f.Type === "Programme" &&
    f.Class &&
    f.Subject &&
    f.Teacher;

  return {
    airtableId: id("academic", r.id),

    type: legacy
      ? "Assignment"
      : (f.Type || "Programme"),

    name: legacy
      ? [f.Class, f.Subject, f.Teacher].join(" — ")
      : (f.Name || ""),

    code: f.Code || "",

    programme: f.Programme || "",

    className: f.Class || "",

    subject: f.Subject || "",

    teacher: f.Teacher || "",

    status: f.Status || "Active",

    notes: f.Notes || ""
  };
}


// ============================================================
// MAP CLASS
// ============================================================

function mapClass(r) {
  const f = r.fields || {};

  return {
    airtableId: id("classes", r.id),

    type: "Class",

    name: f["Class Name"] || "",

    code: f["Class ID"] || "",

    programme: f.Programme || "",

    className: f["Class Name"] || "",

    subject: "",

    teacher: "",

    status: f.Status || "Active",

    notes: ""
  };
}


// ============================================================
// MAP SUBJECT
// ============================================================

function mapSubject(r) {
  const f = r.fields || {};

  return {
    airtableId: id("subjects", r.id),

    type: "Subject",

    name: f["Subject Name"] || "",

    code: f["Subject Code"] || "",

    programme: "",

    className: "",

    subject: f["Subject Name"] || "",

    teacher: "",

    status: f.Status || "Active",

    notes: ""
  };
}


// ============================================================
// MAP TEACHER
// ============================================================

function mapTeacher(r) {
  const f = r.fields || {};

  return {
    airtableId: id("teachers", r.id),

    type: "Teacher",

    name: f["Full Name"] || "",

    code: f["Teacher ID"] || "",

    programme: "",

    className: "",

    subject: "",

    teacher: f["Full Name"] || "",

    status: f["Employment Status"] || "Active",

    notes: f.Notes || ""
  };
}


// ============================================================
// CREATE AIRTABLE RECORD
// ============================================================

async function create(
  baseId,
  table,
  token,
  fields
) {
  const r = await fetch(
    `${AIRTABLE_API}/${baseId}/${table}`,
    {
      method: "POST",

      headers: headers(token),

      body: JSON.stringify({
        records: [
          {
            fields
          }
        ],

        typecast: true
      })
    }
  );

  const d = await r.json();

  if (!r.ok) {
    throw new Error(
      d.error?.message ||
      "Airtable create failed"
    );
  }

  return d.records[0];
}


// ============================================================
// UPDATE AIRTABLE RECORD
// ============================================================

async function patch(
  baseId,
  table,
  recordId,
  token,
  fields
) {
  const r = await fetch(
    `${AIRTABLE_API}/${baseId}/${table}/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",

      headers: headers(token),

      body: JSON.stringify({
        fields,

        typecast: true
      })
    }
  );

  const d = await r.json();

  if (!r.ok) {
    throw new Error(
      d.error?.message ||
      "Airtable update failed"
    );
  }

  return d;
}


// ============================================================
// GENERATE ID
// ============================================================

function gen(prefix) {
  return `${prefix}-${new Date().getFullYear()}-${String(
    Date.now()
  ).slice(-6)}`;
}


// ============================================================
// MAIN API HANDLER
// ============================================================

export default async function handler(req, res) {

  try {

    const {
      token,
      baseId
    } = config();


    // ========================================================
    // GET
    // ========================================================

    if (req.method === "GET") {

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
      // Convert Academic records
      // ------------------------------------------------------

      const out = academic.map(
        mapAcademic
      );


      // ------------------------------------------------------
      // Build Programme list
      // ------------------------------------------------------

      const programmes = new Set();

      academic.forEach((r) => {

        if (r.fields?.Programme) {

          programmes.add(
            String(r.fields.Programme)
          );

        }

      });


      // ------------------------------------------------------
      // Add virtual programme records
      // ------------------------------------------------------

      programmes.forEach((name) => {

        if (
          !out.some(
            (r) =>
              r.type === "Programme" &&
              r.name.toLowerCase() ===
                name.toLowerCase()
          )
        ) {

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

      });


      // ------------------------------------------------------
      // Add Classes
      // ------------------------------------------------------

      out.push(
        ...classes.map(mapClass)
      );


      // ------------------------------------------------------
      // Add Subjects
      // ------------------------------------------------------

      out.push(
        ...subjects.map(mapSubject)
      );


      // ------------------------------------------------------
      // Add Teachers
      // ------------------------------------------------------

      out.push(
        ...teachers.map(mapTeacher)
      );


      // ------------------------------------------------------
      // Return response
      // ------------------------------------------------------

      return res.status(200).json({
        records: out
      });

    }


    // ========================================================
    // POST
    // ========================================================

    if (req.method === "POST") {

      const b = req.body || {};

      const type = b.type;

      let table =
        TABLES.academic;

      let fields;

      let source =
        "academic";


      // ------------------------------------------------------
      // PROGRAMME
      // ------------------------------------------------------

      if (type === "Programme") {

        fields = {

          Type: "Programme",

          Name: b.name,

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

      }


      // ------------------------------------------------------
      // ASSIGNMENT
      // ------------------------------------------------------

      else if (type === "Assignment") {

        fields = {

          Type: "Assignment",

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

      }


      // ------------------------------------------------------
      // CLASS
      // ------------------------------------------------------

      else if (type === "Class") {

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

      }


      // ------------------------------------------------------
      // SUBJECT
      // ------------------------------------------------------

      else if (type === "Subject") {

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

      }


      // ------------------------------------------------------
      // TEACHER
      // ------------------------------------------------------

      else if (type === "Teacher") {

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

          Notes:
            b.notes ||
            ""

        };

      }


      // ------------------------------------------------------
      // INVALID TYPE
      // ------------------------------------------------------

      else {

        return res.status(400).json({

          error:
            "Invalid academic record type."

        });

      }


      // ------------------------------------------------------
      // CREATE RECORD
      // ------------------------------------------------------

      const r =
        await create(
          baseId,
          table,
          token,
          fields
        );


      return res.status(201).json({

        record: {

          ...b,

          airtableId:
            id(
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
          b.airtableId ||
          ""
        ).split("|");


      const source =
        parts[0];


      const recordId =
        parts
          .slice(1)
          .join("|");


      // ------------------------------------------------------
      // VALIDATE RECORD
      // ------------------------------------------------------

      if (
        !recordId ||
        !TABLES[source]
      ) {

        return res.status(400).json({

          error:
            "Invalid record ID."

        });

      }


      let fields;

      const table =
        TABLES[source];


      // ------------------------------------------------------
      // UPDATE ACADEMIC
      // ------------------------------------------------------

      if (source === "academic") {

        fields = {

          Type:
            b.type === "Assignment"
              ? "Assignment"
              : "Programme",

          Name:
            b.type === "Assignment"

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

      }


      // ------------------------------------------------------
      // UPDATE CLASS
      // ------------------------------------------------------

      else if (
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

      }


      // ------------------------------------------------------
      // UPDATE SUBJECT
      // ------------------------------------------------------

      else if (
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

      }


      // ------------------------------------------------------
      // UPDATE TEACHER
      // ------------------------------------------------------

      else if (
        source === "teachers"
      ) {

        fields = {

          "Teacher ID":
            b.code ||
            "",

          "Full Name":
            b.name,

          Notes:
            b.notes ||
            ""

        };

      }


      // ------------------------------------------------------
      // UPDATE RECORD
      // ------------------------------------------------------

      const r =
        await patch(
          baseId,
          table,
          recordId,
          token,
          fields
        );


      return res.status(200).json({

        record: r

      });

    }


    // ========================================================
    // METHOD NOT ALLOWED
    // ========================================================

    return res.status(405).json({

      error:
        "Method not allowed"

    });


  } catch (e) {

    console.error(
      "Academic API error:",
      e
    );


    return res.status(500).json({

      error:
        e.message ||
        "Server error."

    });

  }

}
