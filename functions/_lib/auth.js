// まる意見：認証まわり（GoogleのIDトークン検証 + セッションCookie）
// Pages Functions では「_」で始まるフォルダはURLにならないので、共通部品はここに置く。

const enc = new TextEncoder();
const dec = new TextDecoder();
const COOKIE_NAME = "maru_session";

/* ---------- レスポンス補助 ---------- */

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export function fail(status, message, code = "") {
  return json({ ok: false, error: message, code }, { status });
}

/* ---------- base64url 変換 ---------- */

function b64urlToBytes(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToB64url(s) {
  return bytesToB64url(enc.encode(s));
}

function b64urlToStr(s) {
  return dec.decode(b64urlToBytes(s));
}

/* ---------- Google の IDトークン検証 ---------- */

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let jwksCache = { keys: null, exp: 0 };

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.exp > now) return jwksCache.keys;

  const res = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error("jwks_fetch_failed");

  const body = await res.json();
  const cc = res.headers.get("cache-control") || "";
  const m = /max-age=(\d+)/.exec(cc);
  const ttl = m ? parseInt(m[1], 10) * 1000 : 3600 * 1000;

  jwksCache = { keys: body.keys, exp: now + ttl };
  return body.keys;
}

/**
 * GoogleのIDトークン（JWT）を検証して、中身を返す。
 * 署名検証までやるので、他人のふりはできない。
 */
export async function verifyGoogleIdToken(token, clientId) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("bad_token");
  const [h, p, s] = parts;

  const header = JSON.parse(b64urlToStr(h));
  const payload = JSON.parse(b64urlToStr(p));

  if (header.alg !== "RS256") throw new Error("bad_alg");
  if (!clientId || payload.aud !== clientId) throw new Error("bad_aud");
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    throw new Error("bad_iss");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now() - 60000) throw new Error("expired");
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!emailVerified) throw new Error("email_unverified");
  if (!payload.email) throw new Error("no_email");

  const keys = await getJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown_kid");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(s),
    enc.encode(h + "." + p)
  );
  if (!ok) throw new Error("bad_signature");

  return payload;
}

/* ---------- セッションCookie（HMAC署名つき） ---------- */

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(secret, user, days = 30) {
  const payload = {
    e: user.email,
    n: user.name || user.email.split("@")[0],
    p: user.picture || "",
    exp: Date.now() + days * 86400000,
  };
  const data = strToB64url(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return data + "." + bytesToB64url(sig);
}

async function readSessionToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), enc.encode(data));
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToStr(data));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

export function sessionCookieHeader(token, maxAgeSeconds = 2592000) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

/** ログイン中の人を返す。未ログインなら null。 */
export async function getUser(request, env) {
  if (!env.SESSION_SECRET) return null;
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return null;
  const payload = await readSessionToken(env.SESSION_SECRET, token);
  if (!payload) return null;
  return { email: payload.e, name: payload.n, picture: payload.p || "" };
}

/** 先生画面を見てよい人かどうか */
export function isTeacher(user, env) {
  const list = String(env.TEACHER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true; // 指定なし＝ログインしていればOK
  return list.includes(String(user.email || "").toLowerCase());
}
