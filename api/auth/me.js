// api/auth/me.js

const crypto = require('crypto');
const Airtable = require('airtable');

const COOKIE_NAME = process.env.COOKIE_NAME || 'aibinu_sess';
const AUTH_SECRET = process.env.AUTH_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Auth_Users';

if (!AUTH_SECRET || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing required env vars: AUTH_SECRET, AIRTABLE_API_KEY, AIRTABLE_BASE_ID');
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

function verifySession(token) {
  try {
    const [dataB64, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64');
    if (!timingSafeEqual(sig, expected)) return null;
    const payload = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function timingSafeEqual(a, b) {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifySession(token);
  if (!payload) return res.status(401).json({ error: 'Invalid session' });

  // Lookup user
  try {
    const records = await base(AIRTABLE_TABLE).select({ filterByFormula: `{auth_id} = '${payload.auth_id}'`, maxRecords: 1 }).firstPage();
    const rec = records && records[0];
    if (!rec) return res.status(401).json({ error: 'Not authenticated' });
    const fields = rec.fields || {};
    const sanitized = {
      auth_id: payload.auth_id,
      email: fields.email,
      username: fields.username,
      role: fields.role,
      status: fields.status,
    };
    return res.status(200).json({ user: sanitized });
  } catch (err) {
    console.error('Airtable error', err);
    return res.status(500).json({ error: 'internal error' });
  }
};

function parseCookies(cookieHeader) {
  const out = {};
  cookieHeader.split(';').forEach((c) => {
    const idx = c.indexOf('=');
    if (idx === -1) return;
    const k = c.slice(0, idx).trim();
    const v = c.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}
