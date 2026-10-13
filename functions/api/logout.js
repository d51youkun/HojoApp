// POST /api/logout … ログアウト

import { json, clearCookieHeader } from "../_lib/auth.js";

export async function onRequestPost() {
  return json({ ok: true }, { headers: { "set-cookie": clearCookieHeader() } });
}
