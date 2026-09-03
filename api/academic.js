// api/academic.js
// Aibinu Flexiprep Student Management System
// Academic Management API + NoteBank Dashboard Statistics
//
// IMPORTANT:
// - Programme records (WAEC / NECO / UTME) are controlled virtual records.
// - Classes, Subjects and Teachers are stored in their dedicated Airtable tables.
// - Assignments are stored in the Academic table.
// - Airtable linked-record fields are always written using record IDs.

const AIRTABLE_BASE_ID =
  process.env.AIRTABLE_BASE_ID || "app285TkNT13HPdqi";

const AIRTABLE_TOKEN =
  process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;

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

const PROGRAMMES = ["WAEC", "NECO", "UTME"];


/* =========================================================
   AIRTABLE HELPERS
   ========================================================= */

function airtableUrl(table, recordId = "") {
  return (
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}` +
    (recordId ? "/" + recordId : "")
  );
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
    data = {
      error: text
    };
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
      (params.toString()
        ? `?${params.toString()}`
        : "");

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
      data = {
        error: text
      };
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


/* =========================================================
   VALUE HELPERS
   ========================================================= */

function fieldValue(value) {

  if (Array.isArray(value)) {

    return value
      .map(item => {

        if (
          item &&
          typeof item === "object"
        ) {
          return (
            item.name ||
            item.value ||
            item.id ||
            ""
          );
        }

        return item ?? "";
      })
      .map(String)
      .map(v => v.trim())
      .filter(Boolean)
      .join(", ");
  }


  if (
    value &&
    typeof value === "object"
  ) {

    return String(
      value.name ||
      value.value ||
      value.id ||
      ""
    ).trim();
  }


  return String(value ?? "").trim();
}


function cleanString(value) {
  return String(value ?? "").trim();
}


function normaliseProgramme(value) {

  const programme =
    cleanString(value).toUpperCase();

  return PROGRAMMES.includes(programme)
    ? programme
    : "";
}


function isAirtableRecordId(value) {

  return /^rec[a-zA-Z0-9]+$/.test(
    cleanString(value)
  );
}


function sameText(a, b) {

  return (
    cleanString(a).toLowerCase() ===
    cleanString(b).toLowerCase()
  );
}


/* =========================================================
   RECORD LOOKUP
   ========================================================= */

function findRecordById(records, value) {

  const id = cleanString(value);

  return (
    records.find(
      record => record.id === id
    ) || null
  );
}


function findByFields(
  records,
  value,
  candidates
) {

  const needle =
    cleanString(value);

  if (!needle) {
    return null;
  }


  const direct =
    findRecordById(
      records,
      needle
    );

  if (direct) {
    return direct;
  }


  for (const record of records) {

    const fields =
      record.fields || {};

    for (const field of candidates) {

      if (
        sameText(
          fields[field],
          needle
        )
      ) {
        return record;
      }
    }
  }


  return null;
}


async function resolveRecordId(
  tableId,
  value,
  fields,
  label
) {

  const input =
    cleanString(value);

  if (!input) {
    throw new Error(
      `${label} is required.`
    );
  }


  if (
    isAirtableRecordId(input)
  ) {
    return input;
  }


  const records =
    await listAll(
      AIRTABLE_BASE_ID,
      tableId,
      AIRTABLE_TOKEN
    );


  const match =
    findByFields(
      records,
      input,
      fields
    );


  if (!match) {

    throw new Error(
      `${label} "${input}" was not found.`
    );
  }


  return match.id;
}


/* =========================================================
   RECORD MAPPERS
   ========================================================= */

function mapClass(record) {

  const f =
    record.fields || {};

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

    programme:
      fieldValue(
        f["Programme"]
      ),

    level:
      fieldValue(
        f["Level"] ??
        f["Class Name"]
      ),

    capacity:
      f["Capacity"] ?? "",

    teacher:
      fieldValue(
        f["Class Teacher"]
      ),

    status:
      fieldValue(
        f["Status"]
      ) || "Active"
  };
}


function mapSubject(record) {

  const f =
    record.fields || {};

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
      f["Subject Code"] ??
      f["Subject ID"] ??
      f["Code"]
    ),

    programme:
      fieldValue(
        f["Programme"]
      ),

    status:
      fieldValue(
        f["Status"]
      ) || "Active",

    notes:
      fieldValue(
        f["Notes"]
      )
  };
}


function mapTeacher(record) {

  const f =
    record.fields || {};

  return {

    id: record.id,

    recordId: record.id,

    type: "Teacher",

    name: fieldValue(
      f["Full Name"] ??
      f["Teacher Name"] ??
      f["Name"] ??
      f["Teacher"]
    ),

    code: fieldValue(
      f["Teacher ID"] ??
      f["Code"]
    ),

    subject:
      fieldValue(
        f["Subjects"] ??
        f["Subject"]
      ),

    status:
      fieldValue(
        f["Employment Status"] ??
        f["Status"]
      ) || "Active",

    notes:
      fieldValue(
        f["Notes"]
      )
  };
}


function mapAcademic(record) {

  const f =
    record.fields || {};

  return {

    id: record.id,

    recordId: record.id,

    type:
      fieldValue(
        f["Type"]
      ),

    name:
      fieldValue(
        f["Name"]
      ),

    code:
      fieldValue(
        f["Code"]
      ),

    programme:
      fieldValue(
        f["Programme"]
      ),

    className:
      fieldValue(
        f["Class"] ??
        f["Class Name"]
      ),

    subject:
      fieldValue(
        f["Subject"]
      ),

    teacher:
      fieldValue(
        f["Teacher"] ??
        f["Teacher Name"]
      ),

    status:
      fieldValue(
        f["Status"]
      ) || "Active",

    notes:
      fieldValue(
        f["Notes"] ??
        f["Description"]
      )
  };
}


/* =========================================================
   PROGRAMMES
   ========================================================= */

function programmeRecords() {

  return PROGRAMMES.map(
    programme => ({

      id:
        `programme-${programme.toLowerCase()}`,

      recordId:
        `programme-${programme.toLowerCase()}`,

      type: "Programme",

      name: programme,

      code: programme,

      programme: programme,

      status: "Active"
    })
  );
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


  const noteDrafts =
    notes.filter(record => {

      const status =
        fieldValue(
          record.fields?.Status
        ).toLowerCase();

      return [
        "ai draft",
        "draft",
        "changes requested"
      ].includes(status);

    }).length;


  const published =
    notes.filter(record => {

      return (
        fieldValue(
          record.fields?.Status
        ).toLowerCase() ===
        "published"
      );

    }).length;


  const pendingReview =
    approvals.filter(record => {

      const status =
        fieldValue(
          record.fields?.Status
        ).toLowerCase();

      return [
        "pending",
        "submitted",
        "under review",
        "pending review"
      ].includes(status);

    }).length;


  const generatedAIJobs =
    aiJobs.filter(record => {

      return (
        fieldValue(
          record.fields?.Status
        ).toLowerCase() ===
        "generated"
      );

    });


  const aiNoteJobs =
    generatedAIJobs.filter(record => {

      return (
        fieldValue(
          record.fields?.["Content Type"]
        ).toLowerCase() ===
        "note"
      );

    }).length;


  const aiQuestionJobs =
    generatedAIJobs.filter(record => {

      return (
        fieldValue(
          record.fields?.["Content Type"]
        ).toLowerCase() ===
        "question"
      );

    }).length;


  const draftContent =
    noteDrafts +
    aiQuestionJobs;


  return {

    success: true,

    draftContent,

    // Backward compatibility
    draftNotes:
      draftContent,

    noteDrafts,

    draftQuestions:
      aiQuestionJobs,

    pendingReview,

    published,

    aiJobs:
      aiJobs.length,

    generatedAIJobs:
      generatedAIJobs.length,

    aiNoteJobs,

    aiQuestionJobs,

    generatedAt:
      new Date().toISOString()
  };
}


/* =========================================================
   REQUEST BODY
   ========================================================= */

function getBody(req) {

  if (!req.body) {
    return {};
  }


  if (
    typeof req.body === "string"
  ) {

    try {

      return JSON.parse(
        req.body
      );

    } catch {

      throw new Error(
        "Invalid JSON request body."
      );
    }
  }


  return req.body;
}


function stripUndefined(obj) {

  for (
    const key of Object.keys(obj)
  ) {

    if (
      obj[key] === undefined
    ) {
      delete obj[key];
    }
  }

  return obj;
}


function responseRecord(
  data,
  mapper
) {

  return {

    success: true,

    record:
      mapper(data)
  };
}


/* =========================================================
   MAIN HANDLER
   ========================================================= */

export default async function handler(
  req,
  res
) {

  try {

    if (!AIRTABLE_TOKEN) {

      return res.status(500).json({

        success: false,

        error:
          "AIRTABLE_TOKEN is not configured."
      });
    }


    /* =====================================================
       NOTEBOOK STATISTICS
       ===================================================== */

    if (
      req.method === "GET" &&
      String(
        req.query?.stats || ""
      ) === "1"
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

    if (
      req.method === "GET"
    ) {

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

        ...programmeRecords(),

        ...academicRecords.map(
          mapAcademic
        ),

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
       REQUEST BODY FOR WRITE OPERATIONS
       ===================================================== */

    const body =
      getBody(req);

    const type =
      cleanString(
        body.type
      );


    /* =====================================================
       CREATE
       ===================================================== */

    if (
      req.method === "POST"
    ) {


      if (!type) {

        return res.status(400).json({

          success: false,

          error:
            "Record type is required."
        });
      }


      /* ===================================================
         PROGRAMME
         =================================================== */

      if (
        type === "Programme"
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Programmes are system-defined: WAEC, NECO and UTME. They are not stored as individual Airtable records."
        });
      }


      /* ===================================================
         CLASS
         =================================================== */

      if (
        type === "Class"
      ) {

        const className =
          cleanString(
            body.className ||
            body.name ||
            body.level
          );


        if (!className) {

          return res.status(400).json({

            success: false,

            error:
              "Class name is required."
          });
        }


        const fields =
          stripUndefined({

            "Class Name":
              className,

            "Level":
              cleanString(
                body.level
              ) ||
              className,

            "Class ID":
              cleanString(
                body.code
              ) ||
              `CLS-${Date.now()}`,

            "Status":
              cleanString(
                body.status
              ) ||
              "Active"
          });


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.classes
            ),
            {

              method: "POST",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(201).json(
          responseRecord(
            data,
            mapClass
          )
        );
      }


      /* ===================================================
         SUBJECT
         =================================================== */

      if (
        type === "Subject"
      ) {

        const name =
          cleanString(
            body.name ||
            body.subject
          );


        if (!name) {

          return res.status(400).json({

            success: false,

            error:
              "Subject name is required."
          });
        }


        const fields =
          stripUndefined({

            "Subject Name":
              name,

            "Subject Code":
              cleanString(
                body.code
              ) ||
              `SUB-${Date.now()}`,

            "Status":
              cleanString(
                body.status
              ) ||
              "Active"
          });


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.subjects
            ),
            {

              method: "POST",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(201).json(
          responseRecord(
            data,
            mapSubject
          )
        );
      }


      /* ===================================================
         TEACHER
         =================================================== */

      if (
        type === "Teacher"
      ) {

        const name =
          cleanString(
            body.name ||
            body.teacher
          );


        if (!name) {

          return res.status(400).json({

            success: false,

            error:
              "Teacher name is required."
          });
        }


        const fields =
          stripUndefined({

            "Full Name":
              name,

            "Teacher ID":
              cleanString(
                body.code
              ) ||
              `TCH-${Date.now()}`,

            "Employment Status":
              cleanString(
                body.status
              ) ||
              "Active",

            "Notes":
              cleanString(
                body.notes
              )
          });


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.teachers
            ),
            {

              method: "POST",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(201).json(
          responseRecord(
            data,
            mapTeacher
          )
        );
      }


      /* ===================================================
         ASSIGNMENT
         =================================================== */

      if (
        type === "Assignment"
      ) {

        const classValue =
          cleanString(
            body.className ||
            body.class
          );

        const subjectValue =
          cleanString(
            body.subject
          );

        const teacherValue =
          cleanString(
            body.teacher
          );

        const programme =
          normaliseProgramme(
            body.programme
          );


        if (!classValue) {

          return res.status(400).json({

            success: false,

            error:
              "Class is required for an assignment."
          });
        }


        if (!subjectValue) {

          return res.status(400).json({

            success: false,

            error:
              "Subject is required for an assignment."
          });
        }


        if (!teacherValue) {

          return res.status(400).json({

            success: false,

            error:
              "Teacher is required for an assignment."
          });
        }


        if (!programme) {

          return res.status(400).json({

            success: false,

            error:
              "A valid programme (WAEC, NECO or UTME) is required."
          });
        }


        const [
          classId,
          subjectId,
          teacherId
        ] = await Promise.all([

          resolveRecordId(
            TABLES.classes,
            classValue,
            [
              "Class Name",
              "Class ID",
              "Level"
            ],
            "Class"
          ),

          resolveRecordId(
            TABLES.subjects,
            subjectValue,
            [
              "Subject Name",
              "Subject Code",
              "Subject ID"
            ],
            "Subject"
          ),

          resolveRecordId(
            TABLES.teachers,
            teacherValue,
            [
              "Full Name",
              "Teacher ID",
              "Teacher Name"
            ],
            "Teacher"
          )
        ]);


        const fields =
          stripUndefined({

            "Type":
              "Assignment",

            "Name":
              cleanString(
                body.name
              ) ||
              `${classValue} - ${subjectValue}`,

            "Code":
              cleanString(
                body.code
              ) ||
              `ASN-${Date.now()}`,

            "Programme":
              programme,

            "Class":
              [classId],

            "Subject":
              [subjectId],

            "Teacher":
              [teacherId],

            "Status":
              cleanString(
                body.status
              ) ||
              "Active",

            "Notes":
              cleanString(
                body.notes
              )
          });


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.academic
            ),
            {

              method: "POST",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(201).json(
          responseRecord(
            data,
            mapAcademic
          )
        );
      }


      return res.status(400).json({

        success: false,

        error:
          `Unsupported record type: ${type}`
      });
    }


    /* =====================================================
       UPDATE
       ===================================================== */

    if (
      req.method === "PUT" ||
      req.method === "PATCH"
    ) {

      const recordId =
        cleanString(
          body.airtableId ||
          body.recordId ||
          body.id
        );


      if (
        !recordId ||
        !isAirtableRecordId(
          recordId
        )
      ) {

        return res.status(400).json({

          success: false,

          error:
            "A valid Airtable record ID is required for update."
        });
      }


      if (!type) {

        return res.status(400).json({

          success: false,

          error:
            "Record type is required for update."
        });
      }


      /* ===================================================
         PROGRAMME
         =================================================== */

      if (
        type === "Programme"
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Programmes are system-defined (WAEC, NECO and UTME) and cannot be edited."
        });
      }


      /* ===================================================
         CLASS
         =================================================== */

      if (
        type === "Class"
      ) {

        const fields =
          stripUndefined({

            "Class Name":
              cleanString(
                body.name ||
                body.className ||
                body.level
              ) ||
              undefined,

            "Class ID":
              cleanString(
                body.code
              ) ||
              undefined,

            "Status":
              cleanString(
                body.status
              ) ||
              undefined
          });


        if (
          !Object.keys(fields).length
        ) {

          return res.status(400).json({

            success: false,

            error:
              "No class fields were supplied for update."
          });
        }


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.classes,
              recordId
            ),
            {

              method: "PATCH",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(200).json(
          responseRecord(
            data,
            mapClass
          )
        );
      }


      /* ===================================================
         SUBJECT
         =================================================== */

      if (
        type === "Subject"
      ) {

        const fields =
          stripUndefined({

            "Subject Name":
              cleanString(
                body.name ||
                body.subject
              ) ||
              undefined,

            "Subject Code":
              cleanString(
                body.code
              ) ||
              undefined,

            "Status":
              cleanString(
                body.status
              ) ||
              undefined
          });


        if (
          !Object.keys(fields).length
        ) {

          return res.status(400).json({

            success: false,

            error:
              "No subject fields were supplied for update."
          });
        }


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.subjects,
              recordId
            ),
            {

              method: "PATCH",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(200).json(
          responseRecord(
            data,
            mapSubject
          )
        );
      }


      /* ===================================================
         TEACHER
         =================================================== */

      if (
        type === "Teacher"
      ) {

        const fields =
          stripUndefined({

            "Full Name":
              cleanString(
                body.name ||
                body.teacher
              ) ||
              undefined,

            "Teacher ID":
              cleanString(
                body.code
              ) ||
              undefined,

            "Employment Status":
              cleanString(
                body.status
              ) ||
              undefined,

            "Notes":
              body.notes == null
                ? undefined
                : cleanString(
                    body.notes
                  )
          });


        if (
          !Object.keys(fields).length
        ) {

          return res.status(400).json({

            success: false,

            error:
              "No teacher fields were supplied for update."
          });
        }


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.teachers,
              recordId
            ),
            {

              method: "PATCH",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(200).json(
          responseRecord(
            data,
            mapTeacher
          )
        );
      }


      /* ===================================================
         ASSIGNMENT
         =================================================== */

      if (
        type === "Assignment"
      ) {

        const fields = {

          "Type":
            "Assignment"
        };


        if (
          body.name != null
        ) {

          fields["Name"] =
            cleanString(
              body.name
            );
        }


        if (
          body.code != null
        ) {

          fields["Code"] =
            cleanString(
              body.code
            );
        }


        if (
          body.status != null
        ) {

          fields["Status"] =
            cleanString(
              body.status
            ) || "Active";
        }


        if (
          body.notes != null
        ) {

          fields["Notes"] =
            cleanString(
              body.notes
            );
        }


        /* -----------------------------------------------
           PROGRAMME
           ----------------------------------------------- */

        if (
          body.programme != null
        ) {

          const programme =
            normaliseProgramme(
              body.programme
            );


          if (!programme) {

            return res.status(400).json({

              success: false,

              error:
                "Programme must be WAEC, NECO or UTME."
            });
          }


          fields["Programme"] =
            programme;
        }


        /* -----------------------------------------------
           CLASS LINK
           ----------------------------------------------- */

        if (
          body.className != null ||
          body.class != null
        ) {

          const classValue =
            cleanString(
              body.className ||
              body.class
            );


          const classId =
            await resolveRecordId(
              TABLES.classes,
              classValue,
              [
                "Class Name",
                "Class ID",
                "Level"
              ],
              "Class"
            );


          fields["Class"] =
            [classId];
        }


        /* -----------------------------------------------
           SUBJECT LINK
           ----------------------------------------------- */

        if (
          body.subject != null
        ) {

          const subjectId =
            await resolveRecordId(
              TABLES.subjects,
              body.subject,
              [
                "Subject Name",
                "Subject Code",
                "Subject ID"
              ],
              "Subject"
            );


          fields["Subject"] =
            [subjectId];
        }


        /* -----------------------------------------------
           TEACHER LINK
           ----------------------------------------------- */

        if (
          body.teacher != null
        ) {

          const teacherId =
            await resolveRecordId(
              TABLES.teachers,
              body.teacher,
              [
                "Full Name",
                "Teacher ID",
                "Teacher Name"
              ],
              "Teacher"
            );


          fields["Teacher"] =
            [teacherId];
        }


        const data =
          await airtableFetch(
            airtableUrl(
              TABLES.academic,
              recordId
            ),
            {

              method: "PATCH",

              body:
                JSON.stringify({
                  fields
                })
            }
          );


        return res.status(200).json(
          responseRecord(
            data,
            mapAcademic
          )
        );
      }


      return res.status(400).json({

        success: false,

        error:
          `Unsupported record type: ${type}`
      });
    }


    /* =====================================================
       DELETE
       ===================================================== */

    if (
      req.method === "DELETE"
    ) {

      const recordId =
        cleanString(
          body.airtableId ||
          body.recordId ||
          body.id
        );

      const deleteType =
        cleanString(
          body.type
        );


      if (
        !recordId ||
        !isAirtableRecordId(
          recordId
        )
      ) {

        return res.status(400).json({

          success: false,

          error:
            "A valid Airtable record ID is required for deletion."
        });
      }


      if (
        deleteType === "Programme"
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Programmes are system-defined and cannot be deleted."
        });
      }


      let table = null;


      if (
        deleteType === "Class"
      ) {

        table =
          TABLES.classes;

      } else if (
        deleteType === "Subject"
      ) {

        table =
          TABLES.subjects;

      } else if (
        deleteType === "Teacher"
      ) {

        table =
          TABLES.teachers;

      } else if (
        deleteType === "Assignment"
      ) {

        table =
          TABLES.academic;

      } else {

        return res.status(400).json({

          success: false,

          error:
            `Unsupported record type: ${
              deleteType || "unknown"
            }`
        });
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

        deleted: true,

        recordId,

        type: deleteType
      });
    }


    /* =====================================================
       METHOD NOT ALLOWED
       ===================================================== */

    return res.status(405).json({

      success: false,

      error:
        `Method ${req.method} not allowed.`
    });


  } catch (error) {

    console.error(
      "Academic API error:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error?.message ||
        "Academic Management request failed."
    });
  }
}
