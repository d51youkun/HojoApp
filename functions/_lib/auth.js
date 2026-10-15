// まる意見：Cookie（セッション）まわり
// ログインは ありません。子どもは「なまえ」を 1回だけ とうろくします。
// 先生画面は 合言葉（TEACHER_PASS）で ひらきます。
// Pages Functions では「_」で始まるフォルダはURLにならないので、共通部品はここに置く。

const enc = new TextEncoder();
const dec = new TextDecoder();
const KID_COOKIE = "maru_sid";
const TEACHER_COOKIE = "maru_teacher";
const ADMIN_COOKIE = "maru_admin";

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

/* ---------- base64url ---------- */

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

/* ---------- 署名つきトークン（HMAC） ---------- */

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signToken(secret, payload, hours = 24) {
  const body = Object.assign({}, payload, { exp: Date.now() + hours * 3600000 });
  const data = strToB64url(JSON.stringify(body));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return data + "." + bytesToB64url(sig);
}

async function readToken(secret, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(parts[1]), enc.encode(parts[0]));
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToStr(parts[0]));
  } catch (e) {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload;
}

/* ---------- Cookie ---------- */

export function cookieHeader(name, token, maxAgeSeconds) {
  return name + "=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAgeSeconds;
}

export function clearCookieHeader(name) {
  return name + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
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

/* ---------- ざつよう ---------- */

function sameText(a, b) {
  a = String(a || "");
  b = String(b || "");
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function newId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  let s = "";
  for (let i = 0; i < a.length; i++) s += a[i].toString(16).padStart(2, "0");
  return s;
}

export function cleanText(text, max) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

/* ---------- 子どもの あいことば（sid）だけの Cookie ---------- */

/** Cookie から sid を とりだす。なまえは ここには 入れない（あとで D1 から とる）。 */
/** その sid が kids 表に いるか（なりすましを ふせぐ かくにん）。 */
export async function sidExists(env, sid) {
  if (!sid) return false;
  const row = await env.DB.prepare("SELECT 1 AS n FROM kids WHERE sid = ?1").bind(sid).first();
  return !!(row && row.n);
}

/**
 * Cookie から sid を とりだす。
 *  ・署名つきトークン（いまの形）… 署名を たしかめる
 *  ・署名が とけない Cookie … 中身（base64）から sid を とる
 *    （SESSION_SECRET を 入れかえた ときも、アカウントを 失わない ため）
 *  ・むきだしの sid（16〜64けたの hex）… そのまま つかう
 * さいごに「その sid が kids に いるか」で たしかめる。sid は 128ビットの
 * ランダムなので、実在する sid を 当てることは できない（＝なりすまし不可）。
 */
export async function getSid(request, env) {
  const token = parseCookies(request)[KID_COOKIE];
  if (!token) return "";
  let sid = "";
  if (env.SESSION_SECRET) {
    const p = await readToken(env.SESSION_SECRET, token);
    if (p && p.s) sid = String(p.s);
  }
  if (!sid && token.indexOf(".") >= 0) {
    try {
      const p = JSON.parse(b64urlToStr(token.split(".")[0]));
      if (p && p.s) sid = String(p.s);
    } catch (e) {}
  }
  if (!sid && /^[0-9a-f]{16,64}$/.test(token)) sid = token;
  if (!sid) return "";
  if (!(await sidExists(env, sid))) return "";
  return sid;
}

export async function sidCookie(env, sid) {
  const token = await signToken(env.SESSION_SECRET, { s: sid }, 24 * 180);
  return cookieHeader(KID_COOKIE, token, 180 * 86400);
}

/* ---------- 先生の 合言葉 ---------- */

/* v16.3：先生ページは 合言葉なしで ひらく（ようへいさんの 指示）。
   管理者（ADMIN_PASS）は これまでどおり 合言葉が いる。
   ここを false に もどすと、また 合言葉が ひつように なる。 */
export const TEACHER_OPEN = true;

export function checkPass(env, input) {
  if (TEACHER_OPEN) return true; // 先生は 合言葉なし
  const pass = String(env.TEACHER_PASS || "").trim();
  if (!pass) return true; // 合言葉を 決めていない ときは ひらいておく
  return sameText(pass, String(input || "").trim());
}

export async function isTeacher(request, env) {
  if (TEACHER_OPEN) return true; // 先生は 合言葉なし
  const pass = String(env.TEACHER_PASS || "").trim();
  if (!pass) return true;
  if (!env.SESSION_SECRET) return false;
  const token = parseCookies(request)[TEACHER_COOKIE];
  if (!token) return false;
  const p = await readToken(env.SESSION_SECRET, token);
  return !!(p && p.t === 1);
}

export async function teacherCookie(env) {
  const token = await signToken(env.SESSION_SECRET, { t: 1 }, 24);
  return cookieHeader(TEACHER_COOKIE, token, 86400);
}

/* ---------- 管理者の 合言葉（ADMIN_PASS） ---------- */

export function checkAdminPass(env, input) {
  const pass = String(env.ADMIN_PASS || "").trim();
  if (!pass) return false; // 決めていない ときは だれも 入れない（あぶないので ひらかない）
  return sameText(pass, String(input || "").trim());
}

export async function isAdmin(request, env) {
  if (!String(env.ADMIN_PASS || "").trim()) return false;
  if (!env.SESSION_SECRET) return false;
  const token = parseCookies(request)[ADMIN_COOKIE];
  if (!token) return false;
  const p = await readToken(env.SESSION_SECRET, token);
  return !!(p && p.a === 1);
}

export async function adminCookie(env) {
  const token = await signToken(env.SESSION_SECRET, { a: 1 }, 12);
  return cookieHeader(ADMIN_COOKIE, token, 12 * 3600);
}

/** 先生か 管理者の どちらか（写真の ページで つかう）。 */
export async function isStaff(request, env) {
  if (await isAdmin(request, env)) return true;
  return isTeacher(request, env);
}

export const COOKIES = { kid: KID_COOKIE, teacher: TEACHER_COOKIE, admin: ADMIN_COOKIE };
