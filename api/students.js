const AIRTABLE_API = "https://api.airtable.com/v0";

function getConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_STUDENTS_TABLE;

  if (!token || !baseId || !table) {
    throw new Error(
      "Airtable environment variables are not configured."
    );
  }

  return {
    token,
    baseId,
    table
  };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}


/* =========================
   CONVERT AIRTABLE RECORD
   TO APP STUDENT FORMAT
========================= */

function formatStudent(record) {
  const fields = record.fields || {};

  return {
    airtableId: record.id,

    id: fields["Student ID"] || "",

    firstName: fields["First Name"] || "",
    lastName: fields["Last Name"] || "",
    gender: fields["Gender"] || "",

    dob: fields["Date of Birth"] || "",

    phone: fields["Phone"] || "",
    email: fields["Email"] || "",
    address: fields["Address"] || "",

    nationality:
      fields["Nationality"] || "Nigerian",

    religion: fields["Religion"] || "",

    state:
      fields["State of Origin"] || "",

    lga:
      fields["LGA of Origin"] || "",

    parent:
      fields["Parent/Guardian"] || "",

    parentPhone:
      fields["Parent Phone"] || "",

    className:
      fields["Class"] || "",

    programme:
      fields["Programme"] || "",

    status:
      fields["Status"] || "Active",

    registrationDate:
      fields["Registration Date"] || "",

    photo:
      fields["Photo"] || null,

    fullName:
      `${fields["First Name"] || ""} ${
        fields["Last Name"] || ""
      }`.trim()
  };
}


/* =========================
   API HANDLER
========================= */

export default async function handler(req, res) {

  try {

    const {
      token,
      baseId,
      table
    } = getConfig();

    const url =
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`;


    /* =========================
       GET STUDENTS
    ========================= */

    if (req.method === "GET") {

      const response = await fetch(url, {
        method: "GET",
        headers: headers(token)
      });

      const data = await response.json();

      if (!response.ok) {
        return res
          .status(response.status)
          .json(data);
      }

      const records =
        (data.records || []).map(formatStudent);

      return res.status(200).json({
        records
      });
    }


    /* =========================
       CREATE STUDENT
    ========================= */

    if (req.method === "POST") {

      const student = req.body || {};

      const response = await fetch(url, {

        method: "POST",

        headers: headers(token),

        body: JSON.stringify({

          records: [

            {
              fields: {

                "Student ID":
                  student.id || "",

                "First Name":
                  student.firstName || "",

                "Last Name":
                  student.lastName || "",

                "Gender":
                  student.gender || "",

                "Date of Birth":
                  student.dob || "",

                "Phone":
                  student.phone || "",

                "Email":
                  student.email || "",

                "Address":
                  student.address || "",

                "Nationality":
                  student.nationality || "Nigerian",

                "Religion":
                  student.religion || "",

                "State of Origin":
                  student.state || "",

                "LGA of Origin":
                  student.lga || "",

                "Parent/Guardian":
                  student.parent || "",

                "Parent Phone":
                  student.parentPhone || "",

                "Class":
                  student.className || "",

                "Programme":
                  student.programme || "",

                "Status":
                  student.status || "Active",

                "Registration Date":
                  student.registrationDate || ""

              }
            }

          ],

          typecast: true

        })

      });


      const data =
        await response.json();


      if (!response.ok) {

        return res
          .status(response.status)
          .json(data);

      }


      return res
        .status(201)
        .json(data);

    }


    /* =========================
       METHOD NOT ALLOWED
    ========================= */

    return res
      .status(405)
      .json({
        error: "Method not allowed"
      });


  } catch (error) {

    console.error(
      "Students API error:",
      error
    );

    return res
      .status(500)
      .json({
        error: error.message ||
          "Server error."
      });

  }

}
