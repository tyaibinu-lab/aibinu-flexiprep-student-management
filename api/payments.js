const AIRTABLE_API = "https://api.airtable.com/v0";

function getConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_PAYMENTS_TABLE;

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

function formatPayment(record) {
  const fields = record.fields || {};

  return {
    airtableId: record.id,

    paymentId: fields["Payment ID"] || "",

    student: fields["Student"] || [],

    paymentDate: fields["Payment Date"] || "",

    programme: fields["Programme"] || "",

    feeType: fields["Fee Type"] || "",

    amountDue: fields["Amount Due"] ?? 0,

    amountPaid: fields["Amount Paid"] ?? 0,

    paymentMethod: fields["Payment Method"] || "",

    paymentStatus: fields["Payment Status"] || "",

    receiptNumber: fields["Receipt Number"] || "",

    termSession: fields["Term/Session"] || "",

    notes: fields["Notes"] || "",

    balance: fields["Balance"] ?? 0
  };
}

function paymentFields(payment) {
  const fields = {};

  if (payment.student) {
    fields["Student"] =
      Array.isArray(payment.student)
        ? payment.student
        : [payment.student];
  }

  fields["Payment Date"] =
  payment.paymentDate || new Date().toISOString().split("T")[0];
  
  if (payment.programme) {
    fields["Programme"] = payment.programme;
  }

  if (payment.feeType) {
    fields["Fee Type"] = payment.feeType;
  }

  if (payment.amountDue !== undefined) {
    fields["Amount Due"] =
      Number(payment.amountDue) || 0;
  }

  if (payment.amountPaid !== undefined) {
    fields["Amount Paid"] =
      Number(payment.amountPaid) || 0;
  }

  if (payment.paymentMethod) {
    fields["Payment Method"] =
      payment.paymentMethod;
  }

  if (payment.paymentStatus) {
    fields["Payment Status"] =
      payment.paymentStatus;
  }

  if (payment.termSession) {
    fields["Term/Session"] =
      payment.termSession;
  }

  if (payment.notes !== undefined) {
    fields["Notes"] =
      payment.notes || "";
  }

  return fields;
}

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
       GET PAYMENTS
    ========================= */

    if (req.method === "GET") {

      const response = await fetch(url, {
        method: "GET",
        headers: headers(token)
      });

      const data =
        await response.json();

      if (!response.ok) {
        return res
          .status(response.status)
          .json(data);
      }

      return res
        .status(200)
        .json({
          records:
            (data.records || [])
              .map(formatPayment)
        });
    }


    /* =========================
       CREATE PAYMENT
    ========================= */

    if (req.method === "POST") {

  const payment = req.body || {};

  const response =
    await fetch(url, {

      method: "POST",

      headers:
        headers(token),

      body:
        JSON.stringify({

          records: [
            {
              fields:
                paymentFields(payment)
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
    .json({
      record:
        formatPayment(data.records[0])
    });
}
    /* =========================
       UPDATE PAYMENT
    ========================= */

    if (req.method === "PUT") {

      const payment =
        req.body || {};

      const airtableId =
        payment.airtableId ||
        payment.recordId ||
        "";

      if (!airtableId) {

        return res
          .status(400)
          .json({
            error:
              "Missing Airtable record ID for this payment."
          });

      }

      const updateUrl =
        `${url}/${encodeURIComponent(
          airtableId
        )}`;

      const response =
        await fetch(updateUrl, {

          method: "PATCH",

          headers:
            headers(token),

          body:
            JSON.stringify({

              fields:
                paymentFields(payment),

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
        .status(200)
        .json({
          record:
            formatPayment(data)
        });
    }


    /* =========================
       METHOD NOT ALLOWED
    ========================= */

    return res
      .status(405)
      .json({
        error:
          "Method not allowed"
      });

  } catch (error) {

    console.error(
      "Payments API error:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Server error."
      });

  }
}
