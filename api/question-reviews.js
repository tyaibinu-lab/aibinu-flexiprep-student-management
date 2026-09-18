```javascript
import { requireRole } from "./_auth.js";

const AIRTABLE_API = "https://api.airtable.com/v0";

const TABLES = {
  questions: "CBT_Questions",
  reviews: "Question_Reviews"
};

/* ============================================================
   CONFIGURATION
   ============================================================ */

function getConfig() {
  const token = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    throw new Error("Airtable environment variables are missing.");
  }

  return {
    token,
    baseId
  };
}

/* ============================================================
   AIRTABLE HELPERS
   ============================================================ */

function airtableHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function airtableRequest(url, options) {
  const response = await fetch(url, options);

  const data = await response.json().catch(() => ({}));

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
   NORMALISE RECORD IDS
   ============================================================ */

function recordIds(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (value) {
    return [String(value)];
  }

  return [];
}

/* ============================================================
   QUESTION LOOKUP
   ============================================================ */

async function findQuestion(
  baseId,
  token,
  questionId
) {
  let offset = null;

  do {
    let url =
      `${AIRTABLE_API}/${baseId}/${TABLES.questions}`;

    if (offset) {
      url +=
        `?offset=${encodeURIComponent(offset)}`;
    }

    const data = await airtableRequest(
      url,
      {
        method: "GET",
        headers: airtableHeaders(token)
      }
    );

    const found =
      (data.records || []).find((record) => {
        const fields = record.fields || {};

        return (
          String(record.id) === String(questionId) ||
          String(fields["Question ID"] || "") ===
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
   REVIEW LOOKUP BY REVIEW RECORD ID
   ============================================================ */

async function findReviewById(
  baseId,
  token,
  reviewId
) {
  return airtableRequest(
    `${AIRTABLE_API}/${baseId}/${TABLES.reviews}/${reviewId}`,
    {
      method: "GET",
      headers: airtableHeaders(token)
    }
  );
}

/* ============================================================
   REVIEW LOOKUP BY QUESTION
   ============================================================ */

async function findReviewForQuestion(
  baseId,
  token,
  questionId
) {
  let offset = null;

  do {
    let url =
      `${AIRTABLE_API}/${baseId}/${TABLES.reviews}`;

    if (offset) {
      url +=
        `?offset=${encodeURIComponent(offset)}`;
    }

    const data = await airtableRequest(
      url,
      {
        method: "GET",
        headers: airtableHeaders(token)
      }
    );

    const found =
      (data.records || []).find((record) => {
        const fields = record.fields || {};

        const linkedQuestions =
          recordIds(fields["Question"]);

        return linkedQuestions.includes(
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

      headers:
        airtableHeaders(token),

      body:
        JSON.stringify({
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

      headers:
        airtableHeaders(token),

      body:
        JSON.stringify({
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

      headers:
        airtableHeaders(token),

      body:
        JSON.stringify({
          fields,
          typecast: true
        })
    }
  );
}

/* ============================================================
   QUESTION OWNERSHIP
   ============================================================ */

function teacherOwnsQuestion(
  question,
  teacherId
) {
  if (!teacherId) {
    return false;
  }

  const createdBy =
    recordIds(
      question.fields?.["Created By"]
    );

  return createdBy.includes(
    String(teacherId)
  );
}

/* ============================================================
   REVIEW STATUS
   ============================================================ */

function getReviewStatus(review) {
  return String(
    review?.fields?.["Status"] || ""
  )
    .trim()
    .toLowerCase();
}

/* ============================================================
   RESPONSE FORMAT
   ============================================================ */

function formatReview(review) {
  if (!review) {
    return null;
  }

  return {
    id: review.id,
    ...review.fields
  };
}

/* ============================================================
   MAIN HANDLER
   ============================================================ */

export default async function handler(
  req,
  res
) {
  try {

    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    const user =
      requireRole(
        req,
        res,
        [
          "teacher",
          "reviewer",
          "admin"
        ]
      );

    if (!user) {
      return;
    }

    const {
      token,
      baseId
    } = getConfig();

    /* ========================================================
       GET
       Retrieve review for a question
       ======================================================== */

    if (req.method === "GET") {

      const questionId =
        req.query?.questionId;

      if (!questionId) {
        return res.status(400).json({
          error:
            "questionId is required"
        });
      }

      const question =
        await findQuestion(
          baseId,
          token,
          questionId
        );

      if (!question) {
        return res.status(404).json({
          error:
            "Question not found",

          questionId
        });
      }

      /*
       * Teachers may only inspect reviews
       * for their own questions.
       *
       * Reviewers/admins may inspect any question.
       */

      if (
        user.role === "teacher" &&
        !teacherOwnsQuestion(
          question,
          user.teacherId
        )
      ) {
        return res.status(403).json({
          error:
            "You are not allowed to view this question review."
        });
      }

      const review =
        await findReviewForQuestion(
          baseId,
          token,
          question.id
        );

      return res.status(200).json({

        exists:
          Boolean(review),

        review:
          formatReview(review)

      });
    }

    /* ========================================================
       POST
       Submit question for review
       ======================================================== */

    if (req.method === "POST") {

      /*
       * Only teachers and administrators
       * can submit questions.
       */

      if (
        user.role !== "teacher" &&
        user.role !== "admin"
      ) {
        return res.status(403).json({
          error:
            "Only teachers or administrators can submit questions for review."
        });
      }

      /*
       * A teacher must have a linked
       * Teachers Airtable record.
       */

      if (
        user.role === "teacher" &&
        !user.teacherId
      ) {
        return res.status(403).json({
          error:
            "Authenticated teacher is not linked to a Teacher record."
        });
      }

      const body =
        req.body || {};

      const questionId =
        body.questionId;

      if (!questionId) {
        return res.status(400).json({
          error:
            "questionId is required"
        });
      }

      /* --------------------------------------------------------
         Find question
         -------------------------------------------------------- */

      const question =
        await findQuestion(
          baseId,
          token,
          questionId
        );

      if (!question) {
        return res.status(404).json({
          error:
            "Question not found",

          questionId
        });
      }

      /* --------------------------------------------------------
         Ownership protection
         -------------------------------------------------------- */

      if (
        user.role === "teacher" &&
        !teacherOwnsQuestion(
          question,
          user.teacherId
        )
      ) {
        return res.status(403).json({
          error:
            "You can only submit questions that you created."
        });
      }

      const questionFields =
        question.fields || {};

      /* --------------------------------------------------------
         Prevent submission of published question
         -------------------------------------------------------- */

      const publicationStatus =
        String(
          questionFields[
            "Publication Status"
          ] || ""
        )
          .trim()
          .toLowerCase();

      if (
        publicationStatus ===
        "published"
      ) {
        return res.status(409).json({
          error:
            "This question is already published."
        });
      }

      /* --------------------------------------------------------
         Find existing review
         -------------------------------------------------------- */

      const existingReview =
        await findReviewForQuestion(
          baseId,
          token,
          question.id
        );

      /* ========================================================
         EXISTING REVIEW
         ======================================================== */

      if (existingReview) {

        const existingStatus =
          getReviewStatus(
            existingReview
          );

        /*
         * Do not create duplicate pending reviews.
         */

        if (
          existingStatus ===
          "pending"
        ) {
          return res.status(409).json({

            error:
              "This question already has a pending review.",

            reviewId:
              existingReview.id

          });
        }

        /*
         * A previously rejected or
         * changes-requested question
         * may be resubmitted.
         */

        const version =
          body.version ||
          existingReview.fields?.[
            "Version"
          ] ||
          "1";

        const updatedReview =
          await updateReview(
            baseId,
            token,
            existingReview.id,
            {
              "Question":
                [question.id],

              /*
               * IMPORTANT:
               * Identity comes from the
               * authenticated session.
               */

              "Submitted By":
                user.teacherId
                  ? [user.teacherId]
                  : undefined,

              "Reviewer":
                [],

              "Status":
                "Pending",

              "Comments":
                String(
                  body.comments || ""
                ),

              "Version":
                String(version),

              "Submitted Date":
                new Date().toISOString(),

              "Reviewed Date":
                null
            }
          );

        /*
         * Put the question back
         * into the review workflow.
         */

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

          review:
            updatedReview

        });
      }

      /* ========================================================
         CREATE NEW REVIEW
         ======================================================== */

      const reviewFields = {

        "Review ID":
          `QR-${Date.now()}`,

        /*
         * Actual Airtable relationship.
         */

        "Question":
          [question.id],

        /*
         * Server-derived identity.
         *
         * The browser cannot choose
         * Submitted By.
         */

        "Submitted By":
          user.teacherId
            ? [user.teacherId]
            : undefined,

        /*
         * Reviewer is intentionally
         * empty at submission.
         */

        "Reviewer":
          [],

        "Status":
          "Pending",

        "Comments":
          String(
            body.comments || ""
          ),

        "Version":
          String(
            body.version || "1"
          ),

        "Submitted Date":
          new Date().toISOString()

      };

      const review =
        await createReview(
          baseId,
          token,
          reviewFields
        );

      /*
       * Only after the review record
       * is created do we mark the
       * question Under Review.
       */

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
          review.records?.[0] ||
          null

      });
    }

    /* ========================================================
       PUT
       Approve / Reject / Request Changes
       ======================================================== */

    if (req.method === "PUT") {

      /*
       * Only reviewers and administrators
       * can perform review decisions.
       */

      if (
        user.role !== "reviewer" &&
        user.role !== "admin"
      ) {
        return res.status(403).json({
          error:
            "Only reviewers or administrators can review questions."
        });
      }

      /*
       * Reviewer identity must resolve
       * to an actual Teachers record.
       */

      if (!user.teacherId) {
        return res.status(403).json({
          error:
            "Authenticated reviewer is not linked to a Teacher record."
        });
      }

      const body =
        req.body || {};

      const reviewId =
        body.reviewId;

      const action =
        String(
          body.action || ""
        )
          .trim()
          .toLowerCase();

      const comments =
        String(
          body.comments || ""
        ).trim();

      if (!reviewId) {
        return res.status(400).json({
          error:
            "reviewId is required"
        });
      }

      /*
       * Supported review actions.
       */

      if (
        action !== "approve" &&
        action !== "reject" &&
        action !== "changes_requested"
      ) {
        return res.status(400).json({
          error:
            "action must be approve, reject, or changes_requested"
        });
      }

      /* --------------------------------------------------------
         Retrieve review
         -------------------------------------------------------- */

      const review =
        await findReviewById(
          baseId,
          token,
          reviewId
        );

      if (!review) {
        return res.status(404).json({
          error:
            "Review not found"
        });
      }

      const reviewFields =
        review.fields || {};

      const currentStatus =
        getReviewStatus(review);

      /*
       * Only Pending reviews may
       * receive a decision.
       */

      if (
        currentStatus !==
        "pending"
      ) {
        return res.status(409).json({
          error:
            `This review is already ${reviewFields["Status"] || "closed"}.`
        });
      }

      /* --------------------------------------------------------
         Resolve linked question
         -------------------------------------------------------- */

      const linkedQuestions =
        recordIds(
          reviewFields["Question"]
        );

      if (
        linkedQuestions.length === 0
      ) {
        return res.status(400).json({
          error:
            "Review is not linked to a question."
        });
      }

      const question =
        await findQuestion(
          baseId,
          token,
          linkedQuestions[0]
        );

      if (!question) {
        return res.status(404).json({
          error:
            "Associated question not found."
        });
      }

      const questionPublicationStatus =
        String(
          question.fields?.[
            "Publication Status"
          ] || ""
        )
          .trim()
          .toLowerCase();

      /*
       * Protect against a question being
       * published elsewhere while this
       * review is still pending.
       */

      if (
        questionPublicationStatus ===
        "published"
      ) {
        return res.status(409).json({
          error:
            "This question is already published."
        });
      }

      /* --------------------------------------------------------
         Determine decision
         -------------------------------------------------------- */

      let nextReviewStatus;
      let nextPublicationStatus;
      let message;

      if (
        action === "approve"
      ) {

        nextReviewStatus =
          "Approved";

        nextPublicationStatus =
          "Published";

        message =
          "Question approved and published.";

      } else if (
        action ===
        "changes_requested"
      ) {

        /*
         * Comments are mandatory
         * when requesting changes.
         */

        if (!comments) {
          return res.status(400).json({
            error:
              "Comments are required when requesting changes."
          });
        }

        nextReviewStatus =
          "Changes Requested";

        nextPublicationStatus =
          "Changes Requested";

        message =
          "Changes requested for this question.";

      } else {

        nextReviewStatus =
          "Rejected";

        nextPublicationStatus =
          "Rejected";

        message =
          "Question rejected.";
      }

      const now =
        new Date().toISOString();

      /* ========================================================
         UPDATE REVIEW
         ======================================================== */

      const updatedReview =
        await updateReview(
          baseId,
          token,
          reviewId,
          {
            "Status":
              nextReviewStatus,

            /*
             * IMPORTANT:
             * Reviewer comes exclusively
             * from the authenticated session.
             */

            "Reviewer":
              [user.teacherId],

            "Comments":
              comments ||
              reviewFields[
                "Comments"
              ] ||
              "",

            "Reviewed Date":
              now
          }
        );

      /* ========================================================
         UPDATE QUESTION
         ======================================================== */

      const questionUpdates = {

        "Publication Status":
          nextPublicationStatus

      };

      /*
       * Approval activates the
       * question and records the
       * authenticated reviewer.
       */

      if (
        action === "approve"
      ) {

        questionUpdates[
          "Status"
        ] = "Active";

        /*
         * CBT_Questions has Approved By
         * linked to Teachers.
         */

        questionUpdates[
          "Approved By"
        ] = [user.teacherId];
      }

      const updatedQuestion =
        await updateQuestion(
          baseId,
          token,
          question.id,
          questionUpdates
        );

      return res.status(200).json({

        message,

        review:
          updatedReview,

        question:
          updatedQuestion

      });
    }

    /* ========================================================
       METHOD NOT ALLOWED
       ======================================================== */

    res.setHeader(
      "Allow",
      "GET, POST, PUT"
    );

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
```
