/**
 * AIBINU FLEXIPREP — Current Authentication Session
 * GET /api/auth/me
 */
import { requireAuth } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({
    success: true,
    authenticated: true,
    user: {
      id: user.id,
      role: user.role,
      studentId: user.studentId || null,
      teacherId: user.teacherId || null,
      issuedAt: user.issuedAt,
      expiresAt: user.expiresAt,
      sessionId: user.sessionId || null,
    },
  });
}
