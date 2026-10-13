// POST /api/logout … なまえ／合言葉を わすれる

import { json, clearCookieHeader, COOKIES } from "../_lib/auth.js";

export async function onRequestPost() {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearCookieHeader(COOKIES.kid));
  headers.append("set-cookie", clearCookieHeader(COOKIES.teacher));
  return new Response(JSON.stringify({ ok: true }), { headers });
}
