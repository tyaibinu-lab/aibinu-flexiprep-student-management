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
    throw new Error("Airtable environment variables are not configured.");
  }

  return { token, baseId };
}

const headers = token => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});

const makeId = (source, recordId) =>
  `${source}|${recordId}`;


/* =========================================================
   AIRTABLE READ
========================================================= */

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
      headers: headers(token)
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


/* =========================================================
   HELPER
========================================================= */

function firstValue(fields, names) {
  for (const name of names) {
    const value = fields?.[name];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return "";
}


/* =========================================================
   ACADEMIC TABLE
========================================================= */

function mapAcademic(r) {
  const f = r.fields || {};

  const type = String(
    f.Type || "Programme"
  ).trim();

  return {
    airtableId: makeId("academic", r.id),

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

    programme: f.Programme || "",

    className: f.Class || "",

    subject: f.Subject || "",

    teacher: f.Teacher || "",

    status: f.Status || "Active",

    notes: f.Notes || ""
  };
}


/* =========================================================
   CLASSES TABLE

   IMPORTANT:
   Airtable may contain the class level in either:
   - Class Name
   - Level
   - Name
   - Class

   We therefore check all possible fields.
========================================================= */

function mapClass(r) {
  const f = r.fields || {};

  const name = firstValue(
    f,
    [
      "Class Name",
      "Level",
      "Name",
      "Class"
    ]
  );

  return {
    airtableId: makeId("classes", r.id),

    type: "Class",

    name: name,

    code: firstValue(
      f,
      [
        "Class ID",
        "Code"
      ]
    ),

    /*
      Classes are shared academic levels.
      Programme is retained only as database information.
    */
    programme: firstValue(
      f,
      ["Programme"]
    ),

    className: name,

    subject: "",

    teacher: "",

    status:
      firstValue(
        f,
        ["Status"]
      ) || "Active",

    notes: ""
  };
}


/* =========================================================
   SUBJECTS TABLE
========================================================= */

function mapSubject(r) {
  const f = r.fields || {};

  const name =
    firstValue(
      f,
      [
        "Subject Name",
        "Name",
        "Subject"
      ]
    );

  return {
    airtableId: makeId("subjects", r.id),

    type: "Subject",

    name: name,

    code:
      firstValue(
        f,
        [
          "Subject Code",
          "Code"
        ]
      ),

    programme: "",

    className: "",

    subject: name,

    teacher: "",

    status:
      firstValue(
        f,
        ["Status"]
      ) || "Active",

    notes: ""
  };
}


/* =========================================================
   TEACHERS TABLE
========================================================= */

function mapTeacher(r) {
  const f = r.fields || {};

  const name =
    firstValue(
      f,
      [
        "Full Name",
        "Name",
        "Teacher"
      ]
    );

  return {
    airtableId: makeId("teachers", r.id),

    type: "Teacher",

    name: name,

    code:
      firstValue(
        f,
        [
          "Teacher ID",
          "Code"
        ]
      ),

    programme: "",

    className: "",

    subject: "",

    teacher: name,

    status:
      firstValue(
        f,
        [
          "Employment Status",
          "Status"
        ]
      ) || "Active",

    notes: f.Notes || ""
  };
}


/* =========================================================
   AIRTABLE WRITE
========================================================= */

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

  const d = await r.json();

  if (!r.ok) {
    throw new Error(
      d.error?.message ||
      "Airtable write failed"
    );
  }

  return recordId
    ? d
    : d.records[0];
}


/* =========================================================
   ID GENERATOR
========================================================= */

function gen(prefix) {
  return (
    `${prefix}-${new Date().getFullYear()}-` +
    `${String(Date.now()).slice(-6)}`
  );
}


/* =========================================================
   PROGRAMMES DERIVED FROM ACADEMIC TABLE
========================================================= */

function uniqueProgrammeRecords(academic) {
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

      name: name,

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


/* =========================================================
   FIXED EXAMINATION PROGRAMMES

   These must always be available even if Airtable currently
   has no Academic record using that programme.
========================================================= */

function fixedProgrammes() {
  return [
    "WAEC",
    "NECO",
    "UTME"
  ].map(name => ({
    airtableId:
      `virtual|${encodeURIComponent(name)}`,

    type: "Programme",

    name: name,

    code: name,

    programme: name,

    className: "",

    subject: "",

    teacher: "",

    status: "Active",

    notes: ""
  }));
}


/* =========================================================
   MAIN API HANDLER
========================================================= */

export default async function handler(req, res) {

  try {

    const {
      token,
      baseId
    } = config();


    /* =====================================================
       GET
    ===================================================== */

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


      /* -----------------------------------------------
         Map records
      ------------------------------------------------ */

      const academicRecords =
        academic.map(mapAcademic);

      const classRecords =
        classes
          .map(mapClass)
          .filter(
            r => r.name
          );


      /* -----------------------------------------------
         Build programme list

         Sources:
         1. Fixed programmes
         2. Explicit Programme records
         3. Programme values found in Academic table
      ------------------------------------------------ */

      const programmeNames =
        new Map();

      for (
        const p of [
          ...fixedProgrammes(),

          ...academicRecords.filter(
            r => r.type === "Programme"
          ),

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


      /* -----------------------------------------------
         Combined records returned to frontend
      ------------------------------------------------ */

      const records = [

        /*
          Assignments
        */
        ...academicRecords.filter(
          r =>
            r.type === "Assignment"
        ),

        /*
          Programmes
        */
        ...programmeNames.values(),

        /*
          ALL classes

          IMPORTANT:
          Do NOT filter classes by programme here.

          SS1, SS2, SS3 etc. are shared academic
          levels and can be used for WAEC, NECO and UTME.
        */
        ...classRecords,

        /*
          Subjects
        */
        ...subjects.map(
          mapSubject
        ),

        /*
          Teachers
        */
        ...teachers.map(
          mapTeacher
        )

      ];


      return res.status(200).json({

        records,

        counts: {

          programmes:
            programmeNames.size,

          classes:
            classRecords.length,

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


    /* =====================================================
       POST
    ===================================================== */

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


      /* -----------------------------------------------
         PROGRAMME
      ------------------------------------------------ */

      if (
        type === "Programme"
      ) {

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


      /* -----------------------------------------------
         ASSIGNMENT
      ------------------------------------------------ */

      else if (
        type === "Assignment"
      ) {

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


      /* -----------------------------------------------
         CLASS
      ------------------------------------------------ */

      else if (
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

          /*
            Keep Level synchronized with Class Name.
          */
          Level:
            b.name ||
            "",

          Programme:
            b.programme ||
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


      /* -----------------------------------------------
         SUBJECT
      ------------------------------------------------ */

      else if (
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

      }


      /* -----------------------------------------------
         TEACHER
      ------------------------------------------------ */

      else if (
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

      }


      else {

        return res.status(400).json({

          error:
            "Invalid academic record type."

        });

      }


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


    /* =====================================================
       PUT
    ===================================================== */

    if (req.method === "PUT") {

      const b =
        req.body || {};

      const parts =
        String(
          b.airtableId ||
          ""
        ).split("|");

      const source =
        parts.shift();

      const recordId =
        parts.join("|");


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


      /* -----------------------------------------------
         ACADEMIC / ASSIGNMENT
      ------------------------------------------------ */

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

      }


      /* -----------------------------------------------
         CLASS

         IMPORTANT:
         Update BOTH Class Name and Level.
      ------------------------------------------------ */

      else if (
        source === "classes"
      ) {

        fields = {

          "Class ID":
            b.code ||
            "",

          "Class Name":
            b.name,

          Level:
            b.name ||
            "",

          Programme:
            b.programme ||
            "",

          Status:
            b.status ||
            "Active"

        };

      }


      /* -----------------------------------------------
         SUBJECT
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         TEACHER
      ------------------------------------------------ */

      else if (
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


    /* =====================================================
       METHOD NOT ALLOWED
    ===================================================== */

    return res.status(405).json({

      error:
        "Method not allowed."

    });

  }

  catch (err) {

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
