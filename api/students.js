const AIRTABLE_API = "https://api.airtable.com/v0";

function getConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_STUDENTS_TABLE;

  if (!token || !baseId || !table) {
    throw new Error("Airtable environment variables are not configured.");
  }

  return { token, baseId, table };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export default async function handler(req, res) {
  try {
    const { token, baseId, table } = getConfig();

    const url =
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`;

    if (req.method === "GET") {
      const response = await fetch(url, {
        headers: headers(token)
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const response = await fetch(url, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({
  records: [
    {
      fields: {
        "Student ID": req.body.id,
        "First Name": req.body.firstName,
        "Last Name": req.body.lastName,
        "Gender": req.body.gender,
        "Date of Birth": req.body.dob,
        "Phone": req.body.phone,
        "Email": req.body.email,
        "Address": req.body.address,
        "Nationality": req.body.nationality,
        "Religion": req.body.religion,
        "State of Origin": req.body.state,
        "LGA of Origin": req.body.lga,
        "Parent/Guardian": req.body.parent,
        "Parent Phone": req.body.parentPhone,
        "Class": req.body.className,
        "Programme": req.body.programme,
        "Status": req.body.status,
        "Registration Date": req.body.registrationDate
      }
    }
  ],
  typecast: true
})
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      return res.status(201).json(data);
    }

    return res.status(405).json({
      error: "Method not allowed"
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
