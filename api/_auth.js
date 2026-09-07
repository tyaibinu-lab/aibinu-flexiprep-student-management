/**
 * AIBINU FLEXIPREP
 * Authentication Boundary
 *
 * Step 54A
 *
 * Purpose:
 * - Validate authenticated sessions server-side.
 * - Never trust browser-supplied identity.
 * - Provide reusable authentication/RBAC helpers.
 *
 * IMPORTANT:
 * This module does NOT create authentication credentials by itself.
 * A trusted login endpoint must eventually issue the signed session token.
 */

import crypto from "crypto";

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "__Host-aibinu_session";

const AUTH_SECRET = process.env.AUTH_SECRET;

const SESSION_ISSUER =
  process.env.AUTH_ISSUER || "aibinu-flexiprep";

const SESSION_AUDIENCE =
  process.env.AUTH_AUDIENCE || "aibinu-flexiprep-web";

const SESSION_TTL_SECONDS = Number(
  process.env.SESSION_TTL_SECONDS || 8 * 60 * 60
);

const ALLOWED_ROLES = new Set([
  "student",
  "teacher",
  "reviewer",
  "admin",
]);

/**
 * Fail closed if authentication is configured incorrectly.
 */
function getAuthSecret() {
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured and contain at least 32 characters."
    );
  }

  return AUTH_SECRET;
}

/**
 * Convert Buffer/string to base64url.
 */
function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value)
    ? value
    : Buffer.from(value);

  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Decode base64url to UTF-8 text.
 */
function base64UrlDecode(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding =
    normalized.length % 4 === 0
      ? ""
      : "=".repeat(4 - (normalized.length % 4));

  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

/**
 * Create HMAC-SHA256 signature.
 */
function sign(input) {
  return base64UrlEncode(
    crypto
      .createHmac("sha256", getAuthSecret())
      .update(input)
      .digest()
  );
}

/**
 * Constant-time signature comparison.
 */
function safeEqual(a, b) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Create a signed session token.
 *
 * This function should only be called by a trusted authentication
 * endpoint after credentials have already been verified.
 */
export function createSessionToken({
  userId,
  role,
  studentId = null,
  teacherId = null,
  expiresIn = SESSION_TTL_SECONDS,
}) {
  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw new Error("Invalid authentication role.");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "HS256",
    typ: "AIBINU-SESSION",
  };

  const payload = {
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,

    sub: String(userId),
    role,

    ...(studentId ? { studentId: String(studentId) } : {}),
    ...(teacherId ? { teacherId: String(teacherId) } : {}),

    iat: now,
    exp: now + Number(expiresIn),

    jti: crypto.randomUUID(),
  };

  const encodedHeader = base64UrlEncode(
    JSON.stringify(header)
  );

  const encodedPayload = base64UrlEncode(
    JSON.stringify(payload)
  );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const signature = sign(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

/**
 * Extract session token from Authorization header
 * or secure session cookie.
 *
 * Authorization header takes precedence.
 */
function extractSessionToken(req) {
  const authorization =
    req?.headers?.authorization ||
    req?.headers?.Authorization;

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (match) {
      return match[1].trim();
    }
  }

  const cookieHeader =
    req?.headers?.cookie ||
    req?.headers?.Cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = {};

  cookieHeader.split(";").forEach((part) => {
    const separator = part.indexOf("=");

    if (separator === -1) {
      return;
    }

    const name = part
      .slice(0, separator)
      .trim();

    const value = part
  .slice(separator + 1)
  .trim();

try {
  cookies[name] = decodeURIComponent(value);
} catch {
  cookies[name] = "";
}

  return cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Verify a signed session token.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [
    encodedHeader,
    encodedPayload,
    providedSignature,
  ] = parts;

  try {
    const header = JSON.parse(
      base64UrlDecode(encodedHeader)
    );

    const payload = JSON.parse(
      base64UrlDecode(encodedPayload)
    );

    if (
      header.alg !== "HS256" ||
      header.typ !== "AIBINU-SESSION"
    ) {
      return null;
    }

    const unsignedToken =
      `${encodedHeader}.${encodedPayload}`;

    const expectedSignature =
      sign(unsignedToken);

    if (
      !safeEqual(
        providedSignature,
        expectedSignature
      )
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (
      typeof payload.exp !== "number" ||
      payload.exp <= now
    ) {
      return null;
    }

    if (
      typeof payload.iat !== "number" ||
      payload.iat > now + 60
    ) {
      return null;
    }

    if (payload.iss !== SESSION_ISSUER) {
      return null;
    }

    if (payload.aud !== SESSION_AUDIENCE) {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    if (!ALLOWED_ROLES.has(payload.role)) {
      return null;
    }

    return {
      id: String(payload.sub),
      role: payload.role,

      studentId: payload.studentId
        ? String(payload.studentId)
        : null,

      teacherId: payload.teacherId
        ? String(payload.teacherId)
        : null,

      issuedAt: payload.iat,
      expiresAt: payload.exp,
      sessionId: payload.jti || null,
    };
  } catch {
    return null;
  }
}

/**
 * Return authenticated user or null.
 */
export function authenticate(req) {
  const token = extractSessionToken(req);

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Alias used by API handlers.
 */
export function getCurrentUser(req) {
  return authenticate(req);
}

/**
 * Require an authenticated user.
 *
 * Returns the authenticated user on success.
 * Sends HTTP 401 and returns null on failure.
 */
export function requireAuth(req, res) {
  const user = authenticate(req);

  if (!user) {
    res.status(401).json({
      success: false,
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });

    return null;
  }

  return user;
}

/**
 * Require one of the specified roles.
 *
 * Example:
 *
 * const user = requireRole(req, res, ["admin", "reviewer"]);
 *
 */
export function requireRole(req, res, roles) {
  const user = requireAuth(req, res);

  if (!user) {
    return null;
  }

  const allowedRoles = Array.isArray(roles)
    ? roles
    : [roles];

  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({
      success: false,
      error: "You do not have permission to perform this action.",
      code: "FORBIDDEN",
    });

    return null;
  }

  return user;
}

/**
 * Set secure authentication cookie.
 */
export function setSessionCookie(res, token, maxAge = SESSION_TTL_SECONDS) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Number(maxAge))}`,
  ].join("; ");

  res.setHeader("Set-Cookie", cookie);
}

/**
 * Clear authentication cookie.
 */
export function clearSessionCookie(res) {
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");

  res.setHeader("Set-Cookie", cookie);
}

/**
 * Expose authentication configuration for internal diagnostics.
 *
 * Does NOT expose AUTH_SECRET.
 */
export function getAuthConfig() {
  return {
    sessionCookieName: SESSION_COOKIE_NAME,
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
    roles: Array.from(ALLOWED_ROLES),
  };
}
