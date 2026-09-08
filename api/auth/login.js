/**
 * AIBINU FLEXIPREP — Authentication Login
 * POST /api/auth/login
 */
import crypto from "crypto";
import { createSessionToken, setSessionCookie } from "../_auth.js";

const API = "https://api.airtable.com/v0";
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const N = 16384, R = 8, P = 1, KEY_LENGTH = 64, SALT_LENGTH = 16;

function config() {
  const { AIRTABLE_PAT, AIRTABLE_BASE_ID } = process.env;
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    throw new Error("Airtable authentication configuration is missing.");
  }
  return {
    token: AIRTABLE_PAT,
    base: AIRTABLE_BASE_ID,
    users: process.env.AIRTABLE_AUTH_USERS_TABLE || "Auth_Users",
    students: process.env.AIRTABLE_STUDENTS_TABLE || "Students",
  };
}

async function airtable(c, table, method = "GET", body, query = "") {
  const url = `${API}/${c.base}/${encodeURIComponent(table)}${query}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  const r = await fetch(url, options);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `Airtable request failed (${r.status}).`);
  return d;
}

function escapeFormula(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isLocked(fields) {
  const value = fields?.["Locked Until"];
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    try {
      const parts = String(stored || "").split("$");
      if (parts.length !== 6 || parts[0] !== "scrypt") return resolve(false);

      const n = Number(parts[1]);
      const r = Number(parts[2]);
      const p = Number(parts[3]);
      const salt = Buffer.from(parts[4], "base64url");
      const expected = Buffer.from(parts[5], "base64url");

      if (!n || !r || !p || !salt.length || !expected.length || expected.length > 128) {
        return resolve(false);
      }

      crypto.scrypt(
        password,
        salt,
        expected.length,
        { N: n, r, p, maxmem: 32 * 1024 * 1024 },
        (error, derived) => {
          if (error || derived.length !== expected.length) return resolve(false);
          resolve(crypto.timingSafeEqual(derived, expected));
        }
      );
    } catch {
      resolve(false);
    }
  });
}

async function updateUser(c, recordId, fields) {
  return airtable(c, `${c.users}/${recordId}`, "PATCH", { fields });
}

async function findUser(c, identifier) {
  const formula = `LOWER({Login Identifier})=LOWER("${escapeFormula(identifier)}")`;
  return (
    await airtable(
      c,
      c.users,
      "GET",
      undefined,
      `?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`
    )
  ).records?.[0] || null;
}

async function resolveStudentId(c, record) {
  const links = record.fields?.["Student"];
  if (!Array.isArray(links) || !links[0]) return null;

  const linkedId = typeof links[0] === "string" ? links[0] : links[0].id;
  if (!linkedId) return null;

  const student = await airtable(c, `${c.students}/${linkedId}`);
  const f = student.fields || {};
  return String(f["Student ID"] ?? f["Student_ID"] ?? "").trim().toUpperCase() || null;
}

function publicUser(record, role, studentId, teacherId) {
  const f = record.fields || {};
  return {
    id: record.id,
    userId: f["User ID"] || null,
    loginIdentifier: f["Login Identifier"] || null,
    role,
    studentId: studentId || null,
    teacherId: teacherId || null,
    status: f["Status"] || "Active",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  try {
    const identifier = String(
      req.body?.loginIdentifier ?? req.body?.username ?? ""
    ).trim();

    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!identifier || !password || identifier.length > 150 || password.length > 1024) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials.",
        code: "INVALID_CREDENTIALS",
      });
    }

    const c = config();
    const record = await findUser(c, identifier);

    const invalid = () =>
      res.status(401).json({
        success: false,
        error: "Invalid credentials.",
        code: "INVALID_CREDENTIALS",
      });

    if (!record) return invalid();

    const f = record.fields || {};

    if (isLocked(f)) return invalid();

    const status = String(f["Status"] ?? "Active").trim().toLowerCase();
    if (!["active", "enabled"].includes(status)) return invalid();

    const valid = await verifyPassword(password, f["Password Hash"]);

    if (!valid) {
      const failures = Number(f["Failed Attempts"] || 0) + 1;
      const fields = { "Failed Attempts": failures };

      if (failures >= MAX_FAILURES) {
        fields["Locked Until"] = new Date(
          Date.now() + LOCK_MINUTES * 60 * 1000
        ).toISOString();
      }

      await updateUser(c, record.id, fields).catch((e) =>
        console.error("Auth lockout update failed:", e.message)
      );

      return invalid();
    }

    const role = String(f["Role"] || "").trim().toLowerCase();
    if (!["student", "teacher", "reviewer", "admin"].includes(role)) {
      return invalid();
    }

    let studentId = null;
    let teacherId = null;

    if (role === "student") {
      studentId = await resolveStudentId(c, record);

      if (!studentId) {
        return res.status(403).json({
          success: false,
          error: "Student account is not linked to a student record.",
          code: "IDENTITY_NOT_LINKED",
        });
      }
    }

    if (Array.isArray(f["Teacher"]) && f["Teacher"][0]) {
      teacherId =
        typeof f["Teacher"][0] === "string"
          ? f["Teacher"][0]
          : f["Teacher"][0].id;
    }

    await updateUser(c, record.id, {
      "Failed Attempts": 0,
      "Locked Until": null,
      "Last Login": new Date().toISOString(),
    });

    const token = createSessionToken({
      userId: record.id,
      role,
      studentId,
      teacherId,
    });

    setSessionCookie(res, token);

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: publicUser(record, role, studentId, teacherId),
    });
  } catch (error) {
    console.error("Authentication login error:", error);
    return res.status(500).json({
      success: false,
      error: "Authentication service is temporarily unavailable.",
    });
  }
}
