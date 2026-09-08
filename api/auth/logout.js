// api/auth/logout.js

const COOKIE_NAME = process.env.COOKIE_NAME || 'aibinu_sess';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const cookie = `${COOKIE_NAME}=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`;
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
};
