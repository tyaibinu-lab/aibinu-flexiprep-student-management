/**
 * AIBINU FLEXIPREP — Logout
 * POST /api/auth/logout
 */
import { clearSessionCookie } from "../_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  clearSessionCookie(res);

  return res.status(200).json({
    success: true,
    authenticated: false,
  });
}
