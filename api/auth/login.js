// api/auth/login.js

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const Airtable = require('airtable');

const COOKIE_NAME = process.env.COOKIE_NAME || 'aibinu_sess';
const AUTH_SECRET = process.env.AUTH_SECRET;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE_NAME || 'Auth_Users';
const SESSION_TTL_SECONDS = +(process.env.SESSION_TTL_SECONDS || 7 * 24 * 3600);
const MAX_FAILED = +(process.env.MAX_FAILED_LOGIN || 5);
const LOCKOUT_SECONDS = +(process.env.LOCKOUT_SECONDS || 15 * 60);

if (!AUTH_SECRET || !AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing required env vars: AUTH_SECRET, AIRTABLE_API_KEY, AIRTABLE_BASE_ID');
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const hmac = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64');
  return `${data}.${hmac}`;
}

function parseIso(s) {
  try {
    return new Date(s);
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return res.status(400).json({ error: 'identifier and password required' });

  // Lookup user by email or username
  const filter = `OR({email} = '${identifier}', {username} = '${identifier}')`;
  let records;
  try {
    records = await base(AIRTABLE_TABLE).select({ filterByFormula: filter, maxRecords: 1 }).firstPage();
  } catch (err) {
    console.error('Airtable lookup error', err);
    return res.status(500).json({ error: 'internal error' });
  }

  const record = records && records[0];
  if (!record) {
    // Generic failure — avoid user enumeration
    await fakeDelay();
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const fields = record.fields || {};
  const failedCount = +(fields.failed_login_count || 0);
  const lockedUntil = fields.locked_until ? new Date(fields.locked_until) : null;
  const now = new Date();

  if (lockedUntil && lockedUntil > now) {
    return res.status(403).json({ error: 'Account locked. Try later.' });
  }

  const passwordHash = fields.password_hash;
  const role = fields.role || 'student';
  const status = (fields.status || 'active').toLowerCase();

  if (status !== 'active') {
    return res.status(403).json({ error: 'Account not active' });
  }

  let match = false;
  try {
    match = await bcrypt.compare(password, passwordHash || '');
  } catch (err) {
    console.error('bcrypt compare error', err);
    return res.status(500).json({ error: 'internal error' });
  }

  if (!match) {
    // increment failed count and possibly lock
    const updates = { failed_login_count: failedCount + 1 };
    if (failedCount + 1 >= MAX_FAILED) {
      const lockUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString();
      updates.locked_until = lockUntil;
    }
    try {
      await base(AIRTABLE_TABLE).update(record.id, updates);
    } catch (err) {
      console.error('Airtable update failed', err);
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Successful login — reset failed count and set last_login
  try {
    await base(AIRTABLE_TABLE).update(record.id, { failed_login_count: 0, locked_until: null, last_login_at: new Date().toISOString() });
  } catch (err) {
    console.error('Airtable update failed', err);
  }

  // Create session token
  const sessionPayload = {
    auth_id: fields.auth_id || record.id,
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const token = signSession(sessionPayload);

  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toUTCString();
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Expires=${expires}; SameSite=Strict; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`;

  res.setHeader('Set-Cookie', cookie);

  const sanitized = {
    auth_id: sessionPayload.auth_id,
    email: fields.email,
    username: fields.username,
    role,
    status,
  };

  return res.status(200).json({ user: sanitized });
};

async function fakeDelay() {
  return new Promise((r) => setTimeout(r, 300));
}
