/**
 * AIBINU FLEXIPREP
 * Authentication Logout
 *
 * Step 54C-3
 */

import {
  clearSessionCookie,
} from "../_auth.js";

export default async function handler(
  req,
  res
) {
  if (
    req.method !== "POST" &&
    req.method !== "GET"
  ) {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    return res.status(405).json({
      success: false,
      error: "Method not allowed.",
    });
  }

  clearSessionCookie(res);

  return res.status(200).json({
    success: true,
    authenticated: false,
    message:
      "You have been logged out.",
  });
}