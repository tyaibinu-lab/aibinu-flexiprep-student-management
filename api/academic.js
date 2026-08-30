const AIRTABLE_API = "https://api.airtable.com/v0";

function config() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_ACADEMIC_TABLE || "Academic";
  if (!token || !baseId) throw new Error("Airtable environment variables are not configured.");
  return { token, baseId, table };
}

const headers = token => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
});

function format(record) {
  const f = record.fields || {};
  return {
    airtableId: record.id,
    type: f.Type || "",
    name: f.Name || "",
    code: f.Code || "",
    programme: f.Programme || "",
    className: f.Class || "",
    subject: f.Subject || "",
    teacher: f.Teacher || "",
    status: f.Status || "Active",
    notes: f.Notes || ""
  };
}

function fields(x) {
  return {
    Type: x.type || "",
    Name: x.name || "",
    Code: x.code || "",
    Programme: x.programme || "",
    Class: x.className || "",
    Subject: x.subject || "",
    Teacher: x.teacher || "",
    Status: x.status || "Active",
    Notes: x.notes || ""
  };
}

export default async function handler(req, res) {
  try {
    const { token, baseId, table } = config();
    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}`;

    if (req.method === "GET") {
      const r = await fetch(url, { headers: headers(token) });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json({ records: (data.records || []).map(format) });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const r = await fetch(url, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ records: [{ fields: fields(body) }], typecast: true })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(201).json({ record: format(data) });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      if (!body.airtableId) return res.status(400).json({ error: "Missing Airtable record ID." });
      const r = await fetch(`${url}/${encodeURIComponent(body.airtableId)}`, {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify({ fields: fields(body), typecast: true })
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json({ record: format(data) });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: "Missing record ID." });
      const r = await fetch(`${url}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(token)
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json({ deleted: true, id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Academic API error:", error);
    return res.status(500).json({ error: error.message || "Server error." });
  }
}
