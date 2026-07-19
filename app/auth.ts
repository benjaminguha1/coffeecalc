import { getDatabase } from '../db';

export const SESSION_COOKIE = 'coffeecalc_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 100_000;
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;
let schemaReady: Promise<void> | null = null;

export type StaffUser = {
  id: string;
  username: string;
  email: string | null;
  role: 'admin' | 'staff';
  active: number;
};

type StaffUserWithPassword = StaffUser & {
  password_hash: string;
  password_salt: string;
};

function normalise(value: string) {
  return value.trim().toLocaleLowerCase();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return new Uint8Array();
  }
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function derivePassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function validateUsername(username: string) {
  return /^[a-zA-Z0-9._-]{3,40}$/.test(username);
}

function validateEmail(email: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureAuthSchema() {
  if (!schemaReady) {
    const db = getDatabase();
    schemaReady = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS coffee_states (
          id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS staff_users (
          id TEXT PRIMARY KEY NOT NULL,
          username TEXT NOT NULL,
          username_normalized TEXT NOT NULL,
          email TEXT,
          email_normalized TEXT,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          role TEXT DEFAULT 'staff' NOT NULL,
          active INTEGER DEFAULT 1 NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`),
        db.prepare(
          'CREATE UNIQUE INDEX IF NOT EXISTS staff_users_username_normalized_unique ON staff_users (username_normalized)',
        ),
        db.prepare(
          'CREATE UNIQUE INDEX IF NOT EXISTS staff_users_email_normalized_unique ON staff_users (email_normalized)',
        ),
        db.prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS staff_users_single_admin_unique ON staff_users (role) WHERE role = 'admin'",
        ),
        db.prepare(`CREATE TABLE IF NOT EXISTS staff_sessions (
          token_hash TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
          key_hash TEXT PRIMARY KEY NOT NULL,
          failures INTEGER DEFAULT 0 NOT NULL,
          blocked_until INTEGER DEFAULT 0 NOT NULL,
          updated_at INTEGER NOT NULL
        )`),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
}

export function validatePassword(password: string) {
  return password.length >= 10 && password.length <= 128;
}

export function sessionCookie(token: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export function clearSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function readSessionToken(request: Request) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [name, ...parts] = item.trim().split('=');
    if (name === SESSION_COOKIE) return parts.join('=');
  }
  return null;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function hasUsers() {
  await ensureAuthSchema();
  const row = await getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM staff_users')
    .first<{ count: number }>();
  return Number(row?.count ?? 0) > 0;
}

export async function createUser(input: {
  username: string;
  email?: string;
  password: string;
  role: 'admin' | 'staff';
}) {
  await ensureAuthSchema();
  const username = input.username.trim();
  const email = input.email?.trim() ?? '';
  if (!validateUsername(username)) {
    throw new Error(
      'Username must be 3–40 characters using letters, numbers, dots, dashes, or underscores.',
    );
  }
  if (!validateEmail(email)) throw new Error('Enter a valid email address.');
  if (!validatePassword(input.password)) {
    throw new Error('Password must be between 10 and 128 characters.');
  }

  const id = crypto.randomUUID();
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await derivePassword(input.password, salt);

  try {
    await getDatabase()
      .prepare(
        `INSERT INTO staff_users
          (id, username, username_normalized, email, email_normalized, password_hash, password_salt, role, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        id,
        username,
        normalise(username),
        email || null,
        email ? normalise(email) : null,
        passwordHash,
        salt,
        input.role,
      )
      .run();
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      throw new Error('That username or email is already in use.');
    }
    throw error;
  }
  return id;
}

export async function createInitialAdmin(input: {
  username: string;
  email?: string;
  password: string;
}) {
  if (await hasUsers()) throw new Error('CoffeeCalc has already been set up.');
  return createUser({ ...input, role: 'admin' });
}

export async function createSession(userId: string) {
  await ensureAuthSchema();
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  await getDatabase()
    .prepare(
      'INSERT INTO staff_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    )
    .bind(tokenHash, userId, expiresAt)
    .run();
  return token;
}

export async function deleteSession(token: string | null) {
  if (!token) return;
  await ensureAuthSchema();
  await getDatabase()
    .prepare('DELETE FROM staff_sessions WHERE token_hash = ?')
    .bind(await sha256(token))
    .run();
}

export async function getUserForToken(token: string | null) {
  if (!token) return null;
  await ensureAuthSchema();
  const now = Math.floor(Date.now() / 1000);
  const user = await getDatabase()
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.active
       FROM staff_sessions s
       JOIN staff_users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
    )
    .bind(await sha256(token), now)
    .first<StaffUser>();
  return user ?? null;
}

export async function getUserForRequest(request: Request) {
  return getUserForToken(readSessionToken(request));
}

async function attemptKey(request: Request, identifier: string) {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  return sha256(`${normalise(identifier)}|${ip}`);
}

async function isBlocked(keyHash: string) {
  await ensureAuthSchema();
  const row = await getDatabase()
    .prepare('SELECT blocked_until FROM login_attempts WHERE key_hash = ?')
    .bind(keyHash)
    .first<{ blocked_until: number }>();
  return Number(row?.blocked_until ?? 0) > Math.floor(Date.now() / 1000);
}

async function recordFailure(keyHash: string) {
  const now = Math.floor(Date.now() / 1000);
  await getDatabase()
    .prepare(
      `INSERT INTO login_attempts (key_hash, failures, blocked_until, updated_at)
       VALUES (?, 1, 0, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         failures = CASE WHEN updated_at < ? THEN 1 ELSE failures + 1 END,
         blocked_until = CASE
           WHEN (CASE WHEN updated_at < ? THEN 1 ELSE failures + 1 END) >= ? THEN ?
           ELSE 0
         END,
         updated_at = ?`,
    )
    .bind(
      keyHash,
      now,
      now - LOCK_SECONDS,
      now - LOCK_SECONDS,
      MAX_FAILURES,
      now + LOCK_SECONDS,
      now,
    )
    .run();
}

export async function authenticate(
  request: Request,
  identifier: string,
  password: string,
) {
  const keyHash = await attemptKey(request, identifier);
  if (await isBlocked(keyHash)) return null;

  const lookup = normalise(identifier);
  const user = await getDatabase()
    .prepare(
      `SELECT id, username, email, role, active, password_hash, password_salt
       FROM staff_users
       WHERE username_normalized = ? OR email_normalized = ?
       LIMIT 1`,
    )
    .bind(lookup, lookup)
    .first<StaffUserWithPassword>();

  const derived = user
    ? await derivePassword(password, user.password_salt)
    : await derivePassword(password, '00000000000000000000000000000000');
  if (!user || !user.active || !safeEqual(derived, user.password_hash)) {
    await recordFailure(keyHash);
    return null;
  }

  await getDatabase()
    .prepare('DELETE FROM login_attempts WHERE key_hash = ?')
    .bind(keyHash)
    .run();
  return user;
}

export async function listUsers() {
  await ensureAuthSchema();
  const result = await getDatabase()
    .prepare(
      `SELECT id, username, email, role, active, created_at
       FROM staff_users ORDER BY role ASC, username_normalized ASC`,
    )
    .all<StaffUser & { created_at: string }>();
  return result.results;
}

export async function setUserActive(userId: string, active: boolean) {
  await ensureAuthSchema();
  await getDatabase()
    .prepare(
      `UPDATE staff_users SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role != 'admin'`,
    )
    .bind(active ? 1 : 0, userId)
    .run();
  if (!active) {
    await getDatabase()
      .prepare('DELETE FROM staff_sessions WHERE user_id = ?')
      .bind(userId)
      .run();
  }
}

export async function resetPassword(userId: string, password: string) {
  await ensureAuthSchema();
  if (!validatePassword(password)) {
    throw new Error('Password must be between 10 and 128 characters.');
  }
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await derivePassword(password, salt);
  await getDatabase()
    .prepare(
      `UPDATE staff_users
       SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(passwordHash, salt, userId)
    .run();
  await getDatabase()
    .prepare('DELETE FROM staff_sessions WHERE user_id = ?')
    .bind(userId)
    .run();
}
