const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  questions: "CBT_Questions",
  reviews: "Question_Reviews"
};

function getConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error("Airtable environment variables are missing.");
  }

  return { token, baseId };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function airtableRequest(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      data.message ||
      "Airtable request failed"
    );
  }

  return data;
}


/* ============================================================
   FIND QUESTION
   ============================================================ */

async function findQuestion(baseId, token, questionId) {

  let offset = null;

  do {

    let url =
      `${AIRTABLE_API}/${baseId}/${TABLES.questions}`;

    if (offset) {
      url += `?offset=${encodeURIComponent(offset)}`;
    }

    const data = await airtableRequest(
      url,
      {
        method: "GET",
        headers: headers(token)
      }
    );

    const found = (data.records || []).find(record => {

      const f = record.fields || {};

      return (
        String(record.id) === String(questionId) ||
        String(f["Question ID"] || "") === String(questionId)
      );

    });

    if (found) {
      return found;
    }

    offset = data.offset || null;

  } while (offset);

  return null;
}


/* ============================================================
   FIND REVIEW
   ============================================================ */

async function findReview(baseId, token, questionId) {

  let offset = null;

  do {

    let url =
      `${AIRTABLE_API}/${baseId}/${TABLES.reviews}`;

    if (offset) {
      url += `?offset=${encodeURIComponent(offset)}`;
    }

    const data = await airtableRequest(
      url,
      {
        method: "GET",
        headers: headers(token)
      }
    );

    const found = (data.records || []).find(record => {

      const f = record.fields || {};

      return (
        String(f["Question ID"] || "") ===
        String(questionId)
      );

    });

    if (found) {
      return found;
    }

    offset = data.offset || null;

  } while (offset);

  return null;
}


/* ============================================================
   CREATE REVIEW
   ============================================================ */

async function createReview(
  baseId,
  token,
  fields
) {

  return airtableRequest(
    `${AIRTABLE_API}/${baseId}/${TABLES.reviews}`,
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
}


/* ============================================================
   UPDATE REVIEW
   ============================================================ */

async function updateReview(
  baseId,
  token,
  recordId,
  fields
) {

  return airtableRequest(
    `${AIRTABLE_API}/${baseId}/${TABLES.reviews}/${recordId}`,
    {
      method: "PATCH",

      headers: headers(token),

      body: JSON.stringify({
        fields,

        typecast: true
      })
    }
  );
}


/* ============================================================
   UPDATE QUESTION
   ============================================================ */

async function updateQuestion(
  baseId,
  token,
  recordId,
  fields
) {

  return airtableRequest(
    `${AIRTABLE_API}/${baseId}/${TABLES.questions}/${recordId}`,
    {
      method: "PATCH",

      headers: headers(token),

      body: JSON.stringify({
        fields,

        typecast: true
      })
    }
  );
}


/* ============================================================
   MAIN HANDLER
   ============================================================ */

export default async function handler(req, res) {

  try {

    const {
      token,
      baseId
    } = getConfig();


    /* ========================================================
       GET
       ======================================================== */

    if (req.method === "GET") {

      const {
        questionId
      } = req.query;

      if (!questionId) {

        return res.status(400).json({
          error: "questionId is required"
        });

      }

      const review =
        await findReview(
          baseId,
          token,
          questionId
        );

      if (!review) {

        return res.status(200).json({
          exists: false,
          review: null
        });

      }

      return res.status(200).json({
        exists: true,
        review: {
          id: review.id,
          ...review.fields
        }
      });

    }


    /* ========================================================
       POST
       Submit question for review
       ======================================================== */

    if (req.method === "POST") {

      const body = req.body || {};

      const questionId =
        body.questionId;

      const reviewer =
        body.reviewer || "";

      const submitter =
        body.submitter || "";

      const comments =
        body.comments || "";

      if (!questionId) {

        return res.status(400).json({
          error: "questionId is required"
        });

      }


      /* ------------------------------------------------------
         Check question
         ------------------------------------------------------ */

      const question =
        await findQuestion(
          baseId,
          token,
          questionId
        );

      if (!question) {

        return res.status(404).json({
          error: "Question not found",
          questionId
        });

      }


      const questionFields =
        question.fields || {};


      /* ------------------------------------------------------
         Prevent review of already published question
         ------------------------------------------------------ */

      const publicationStatus =
        String(
          questionFields["Publication Status"] ||
          ""
        ).trim();


      if (
        publicationStatus.toLowerCase() ===
        "published"
      ) {

        return res.status(409).json({
          error:
            "This question is already published."
        });

      }


      /* ------------------------------------------------------
         Check existing review
         ------------------------------------------------------ */

      const existingReview =
        await findReview(
          baseId,
          token,
          questionId
        );


      if (existingReview) {

        const existingFields =
          existingReview.fields || {};

        const existingStatus =
          String(
            existingFields["Review Status"] ||
            ""
          ).toLowerCase();


        if (
          existingStatus === "pending"
        ) {

          return res.status(409).json({
            error:
              "This question already has a pending review.",
            reviewId:
              existingReview.id
          });

        }


        /* ----------------------------------------------------
           Re-submit previously rejected question
           ---------------------------------------------------- */

        const updated =
          await updateReview(
            baseId,
            token,
            existingReview.id,
            {
              "Review Status":
                "Pending",

              Reviewer:
                reviewer,

              Submitter:
                submitter,

              Comments:
                comments,

              "Review Date":
                new Date().toISOString()
            }
          );


        await updateQuestion(
          baseId,
          token,
          question.id,
          {
            "Publication Status":
              "Under Review"
          }
        );


        return res.status(200).json({

          message:
            "Question resubmitted for review.",

          review: updated

        });

      }


      /* ------------------------------------------------------
         Create new review
         ------------------------------------------------------ */

      const review =
        await createReview(
          baseId,
          token,
          {

            "Question ID":
              questionFields["Question ID"] ||
              question.id,

            Question:
              questionFields["Question"] ||
              "",

            Subject:
              questionFields["Subject"] ||
              "",

            Topic:
              questionFields["Topic"] ||
              "",

            Submitter:
              submitter,

            Reviewer:
              reviewer,

            "Review Status":
              "Pending",

            Comments:
              comments,

            "Review Date":
              new Date().toISOString()

          }
        );


      /* ------------------------------------------------------
         Mark question under review
         ------------------------------------------------------ */

      await updateQuestion(
        baseId,
        token,
        question.id,
        {
          "Publication Status":
            "Under Review"
        }
      );


      return res.status(201).json({

        message:
          "Question submitted for review.",

        review:
          review.records?.[0] || null

      });

    }


    /* ========================================================
       PUT
       Approve / Reject review
       ======================================================== */

    if (req.method === "PUT") {

      const body = req.body || {};

      const reviewId =
        body.reviewId;

      const action =
        String(
          body.action || ""
        ).toLowerCase();

      const reviewer =
        body.reviewer || "";

      const comments =
        body.comments || "";


      if (!reviewId) {

        return res.status(400).json({
          error: "reviewId is required"
        });

      }


      if (
        action !== "approve" &&
        action !== "reject"
      ) {

        return res.status(400).json({
          error:
            "action must be approve or reject"
        });

      }


      /* ------------------------------------------------------
         Get review
         ------------------------------------------------------ */

      const reviewResponse =
        await airtableRequest(
          `${AIRTABLE_API}/${baseId}/${TABLES.reviews}/${reviewId}`,
          {
            method: "GET",
            headers: headers(token)
          }
        );


      const review =
        reviewResponse;


      if (!review) {

        return res.status(404).json({
          error: "Review not found"
        });

      }


      const reviewFields =
        review.fields || {};


      const questionId =
        reviewFields["Question ID"];


      if (!questionId) {

        return res.status(400).json({
          error:
            "Review does not contain Question ID"
        });

      }


      /* ------------------------------------------------------
         Find question
         ------------------------------------------------------ */

      const question =
        await findQuestion(
          baseId,
          token,
          questionId
        );


      if (!question) {

        return res.status(404).json({
          error:
            "Associated question not found",
          questionId
        });

      }


      /* ======================================================
         APPROVE
         ====================================================== */

      if (action === "approve") {

        const updatedReview =
          await updateReview(
            baseId,
            token,
            reviewId,
            {

              "Review Status":
                "Approved",

              Reviewer:
                reviewer ||
                reviewFields.Reviewer ||
                "",

              Comments:
                comments ||
                reviewFields.Comments ||
                "",

              "Review Date":
                new Date().toISOString()

            }
          );


        /* ----------------------------------------------------
           VERY IMPORTANT:
           Only approval publishes question
           ---------------------------------------------------- */

        const updatedQuestion =
          await updateQuestion(
            baseId,
            token,
            question.id,
            {

              "Publication Status":
                "Published",

              Status:
                "Active"

            }
          );


        return res.status(200).json({

          message:
            "Question approved and published.",

          review:
            updatedReview,

          question:
            updatedQuestion

        });

      }


      /* ======================================================
         REJECT
         ====================================================== */

      if (action === "reject") {

        const updatedReview =
          await updateReview(
            baseId,
            token,
            reviewId,
            {

              "Review Status":
                "Rejected",

              Reviewer:
                reviewer ||
                reviewFields.Reviewer ||
                "",

              Comments:
                comments ||
                reviewFields.Comments ||
                "",

              "Review Date":
                new Date().toISOString()

            }
          );


        /* ----------------------------------------------------
           Rejected questions must NOT be published
           ---------------------------------------------------- */

        const updatedQuestion =
          await updateQuestion(
            baseId,
            token,
            question.id,
            {

              "Publication Status":
                "Rejected"

            }
          );


        return res.status(200).json({

          message:
            "Question rejected.",

          review:
            updatedReview,

          question:
            updatedQuestion

        });

      }

    }


    /* ========================================================
       METHOD NOT ALLOWED
       ======================================================== */

    return res.status(405).json({

      error:
        "Method not allowed"

    });

  } catch (error) {

    console.error(
      "Question Review API Error:",
      error
    );

    return res.status(500).json({

      error:
        "Question review operation failed",

      details:
        error.message

    });

  }

}
