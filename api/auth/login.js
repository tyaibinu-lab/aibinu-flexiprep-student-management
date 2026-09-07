/**
 * AIBINU FLEXIPREP
 * Authentication Login Endpoint
 *
 * Step 54C-1
 *
 * Responsibilities:
 * - Authenticate against Auth_Users.
 * - Verify password securely with Node scrypt.
 * - Enforce account status and lockout.
 * - Resolve Student/Teacher identity.
 * - Issue signed server-side session.
 * - Never return password hashes or secrets.
 */

import crypto from "crypto";

import {
  createSessionToken,
  setSessionCookie,
} from "../_auth.js";

const AIRTABLE_API =
  "https://api.airtable.com/v0";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function getConfig() {
  const airtablePat =
    process.env.AIRTABLE_PAT;

  const airtableBaseId =
    process.env.AIRTABLE_BASE_ID;

  const authUsersTable =
    process.env.AIRTABLE_AUTH_USERS_TABLE ||
    "Auth_Users";

  const studentsTable =
    process.env.AIRTABLE_STUDENTS_TABLE ||
    "Students";

  const teachersTable =
    process.env.AIRTABLE_TEACHERS_TABLE ||
    "Teachers";

  if (!airtablePat) {
    throw new Error(
      "AIRTABLE_PAT is not configured."
    );
  }

  if (!airtableBaseId) {
    throw new Error(
      "AIRTABLE_BASE_ID is not configured."
    );
  }

  return {
    airtablePat,
    airtableBaseId,
    authUsersTable,
    studentsTable,
    teachersTable,
  };
}

/* =========================================================
   AIRTABLE
   ========================================================= */

async function airtableRequest(
  config,
  table,
  method = "GET",
  body = null,
  query = ""
) {
  const url =
    `${AIRTABLE_API}/` +
    `${config.airtableBaseId}/` +
    `${encodeURIComponent(table)}` +
    query;

  const options = {
    method,
    headers: {
      Authorization:
        `Bearer ${config.airtablePat}`,
      "Content-Type":
        "application/json",
    },
  };

  if (body !== null) {
    options.body =
      JSON.stringify(body);
  }

  const response =
    await fetch(url, options);

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      data?.error?.type ||
      `Airtable request failed (${response.status})`
    );
  }

  return data;
}

/* =========================================================
   AIRTABLE FORMULA ESCAPING
   ========================================================= */

function escapeAirtableString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

/* =========================================================
   FIND AUTH USER
   ========================================================= */

async function findAuthUser(
  config,
  loginIdentifier
) {
  const escaped =
    escapeAirtableString(
      loginIdentifier
    );

  const formula =
    `LOWER({Login Identifier})=LOWER("${escaped}")`;

  const query =
    `?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;

  const data =
    await airtableRequest(
      config,
      config.authUsersTable,
      "GET",
      null,
      query
    );

  return data?.records?.[0] || null;
}

/* =========================================================
   FETCH RECORD BY AIRTABLE RECORD ID
   ========================================================= */

async function getRecord(
  config,
  table,
  recordId
) {
  if (!recordId) {
    return null;
  }

  return airtableRequest(
    config,
    `${table}/${recordId}`,
    "GET"
  );
}

/* =========================================================
   PASSWORD HASHING
   =========================================================
   
   Format:

   scrypt$N$r$p$salt$hash

   Passwords are NEVER stored in plaintext.
   ========================================================= */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;

function hashPassword(password) {
  return new Promise(
    (resolve, reject) => {
      const salt =
        crypto.randomBytes(
          SCRYPT_SALT_LENGTH
        );

      crypto.scrypt(
        password,
        salt,
        SCRYPT_KEY_LENGTH,
        {
          N: SCRYPT_N,
          r: SCRYPT_R,
          p: SCRYPT_P,
          maxmem: 32 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            [
              "scrypt",
              SCRYPT_N,
              SCRYPT_R,
              SCRYPT_P,
              salt.toString("base64url"),
              derivedKey.toString("base64url"),
            ].join("$")
          );
        }
      );
    }
  );
}

function verifyPassword(
  password,
  storedHash
) {
  return new Promise(
    (resolve) => {
      try {
        const parts =
          String(storedHash || "")
            .split("$");

        if (
          parts.length !== 6 ||
          parts[0] !== "scrypt"
        ) {
          resolve(false);
          return;
        }

        const N =
          Number(parts[1]);

        const r =
          Number(parts[2]);

        const p =
          Number(parts[3]);

        const salt =
          Buffer.from(
            parts[4],
            "base64url"
          );

        const expected =
          Buffer.from(
            parts[5],
            "base64url"
          );

        if (
          !N ||
          !r ||
          !p ||
          !salt.length ||
          !expected.length
        ) {
          resolve(false);
          return;
        }

        crypto.scrypt(
          password,
          salt,
          expected.length,
          {
            N,
            r,
            p,
            maxmem: 32 * 1024 * 1024,
          },
          (error, derivedKey) => {
            if (error) {
              resolve(false);
              return;
            }

            if (
              derivedKey.length !==
              expected.length
            ) {
              resolve(false);
              return;
            }

            resolve(
              crypto.timingSafeEqual(
                derivedKey,
                expected
              )
            );
          }
        );
      } catch {
        resolve(false);
      }
    }
  );
}

/* =========================================================
   LOCKOUT
   ========================================================= */

function getLockedUntil(fields) {
  const value =
    fields?.["Locked Until"];

  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

function isLocked(fields) {
  const lockedUntil =
    getLockedUntil(fields);

  return (
    lockedUntil &&
    lockedUntil.getTime() >
      Date.now()
  );
}

/* =========================================================
   UPDATE AUTH RECORD
   ========================================================= */

async function updateAuthUser(
  config,
  recordId,
  fields
) {
  return airtableRequest(
    config,
    `${config.authUsersTable}/${recordId}`,
    "PATCH",
    {
      fields,
    }
  );
}

/* =========================================================
   RESET FAILED ATTEMPTS
   ========================================================= */

async function clearFailedAttempts(
  config,
  record
) {
  await updateAuthUser(
    config,
    record.id,
    {
      "Failed Attempts": 0,
      "Locked Until": null,
      "Last Login":
        new Date().toISOString(),
    }
  );
}

/* =========================================================
   REGISTER FAILED LOGIN
   ========================================================= */

async function registerFailedLogin(
  config,
  record
) {
  const current =
    Number(
      record.fields?.["Failed Attempts"] ||
      0
    );

  const failedAttempts =
    current + 1;

  const fields = {
    "Failed Attempts":
      failedAttempts,
  };

  if (
    failedAttempts >=
    MAX_FAILED_ATTEMPTS
  ) {
    fields["Locked Until"] =
      new Date(
        Date.now() +
        LOCKOUT_MINUTES *
          60 *
          1000
      ).toISOString();
  }

  await updateAuthUser(
    config,
    record.id,
    fields
  );
}

/* =========================================================
   RESOLVE STUDENT ID
   ========================================================= */

async function resolveStudentId(
  config,
  record
) {
  const linked =
    record.fields?.["Student"];

  if (
    !Array.isArray(linked) ||
    !linked.length
  ) {
    return null;
  }

  const studentRecord =
    await getRecord(
      config,
      config.studentsTable,
      linked[0]
    );

  if (!studentRecord) {
    return null;
  }

  const fields =
    studentRecord.fields || {};

  return (
    fields["Student ID"] ||
    fields["Student_ID"] ||
    null
  );
}

/* =========================================================
   RESOLVE TEACHER ID
   ========================================================= */

function resolveTeacherId(record) {
  const linked =
    record.fields?.["Teacher"];

  if (
    !Array.isArray(linked) ||
    !linked.length
  ) {
    return null;
  }

  /*
   * Teacher identity uses the stable
   * Airtable Teacher record ID.
   */
  return linked[0];
}

/* =========================================================
   SAFE USER RESPONSE
   ========================================================= */

function publicUser({
  record,
  role,
  studentId,
  teacherId,
}) {
  const fields =
    record.fields || {};

  return {
    id: record.id,

    userId:
      fields["User ID"] ||
      null,

    loginIdentifier:
      fields["Login Identifier"] ||
      null,

    role,

    studentId:
      studentId || null,

    teacherId:
      teacherId || null,

    status:
      fields["Status"] ||
      "Active",
  };
}

/* =========================================================
   HANDLER
   ========================================================= */

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  try {
    const identifier =
      String(
        req.body?.loginIdentifier ||
        req.body?.username ||
        ""
      ).trim();

    const password =
      typeof req.body?.password ===
      "string"
        ? req.body.password
        : "";

    /*
     * Generic validation response.
     * Do not reveal whether an account exists.
     */
    if (
      !identifier ||
      !password
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    if (
      identifier.length > 150 ||
      password.length > 1024
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    const config =
      getConfig();

    const authUser =
      await findAuthUser(
        config,
        identifier
      );

    /*
     * Do not distinguish:
     * - nonexistent user
     * - suspended user
     * - invalid password
     */
    if (!authUser) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    const fields =
      authUser.fields || {};

    const role =
      String(
        fields["Role"] || ""
      ).trim().toLowerCase();

    const status =
      String(
        fields["Status"] ||
        "Active"
      ).trim().toLowerCase();

    /*
     * Invalid roles fail closed.
     */
    if (
      ![
        "student",
        "teacher",
        "reviewer",
        "admin",
      ].includes(role)
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    /*
     * Suspended accounts cannot log in.
     */
    if (
      status !== "active"
    ) {
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    /*
     * Persistent lockout.
     */
    if (
      isLocked(fields)
    ) {
      return res.status(429).json({
        success: false,
        error:
          "Too many unsuccessful login attempts. Please try again later.",
        code:
          "ACCOUNT_LOCKED",
      });
    }

    const validPassword =
      await verifyPassword(
        password,
        fields["Password Hash"]
      );

    if (!validPassword) {
      await registerFailedLogin(
        config,
        authUser
      );

      /*
       * Always use the same credentials
       * failure message.
       */
      return res.status(401).json({
        success: false,
        error:
          "Invalid credentials.",
        code:
          "INVALID_CREDENTIALS",
      });
    }

    /*
     * Successful authentication.
     */
    await clearFailedAttempts(
      config,
      authUser
    );

    let studentId = null;
    let teacherId = null;

    if (role === "student") {
      studentId =
        await resolveStudentId(
          config,
          authUser
        );

      if (!studentId) {
        return res.status(403).json({
          success: false,
          error:
            "This account is not correctly linked to a student record.",
          code:
            "IDENTITY_LINK_ERROR",
        });
      }
    }

    if (
      role === "teacher" ||
      role === "reviewer"
    ) {
      teacherId =
        resolveTeacherId(
          authUser
        );
    }

    /*
     * Create signed session.
     *
     * sub = Auth_Users Airtable record ID.
     */
    const token =
      createSessionToken({
        userId:
          authUser.id,
        role,
        studentId,
        teacherId,
      });

    setSessionCookie(
      res,
      token
    );

    return res.status(200).json({
      success: true,
      user: publicUser({
        record:
          authUser,
        role,
        studentId,
        teacherId,
      }),
    });
  } catch (error) {
    console.error(
      "Authentication login error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        "Authentication service temporarily unavailable.",
      code:
        "AUTH_SERVICE_ERROR",
    });
  }
}