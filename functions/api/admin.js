// /api/admin … 管理者の 合言葉（ADMIN_PASS）を たしかめる
//
// POST { pass } … あっていれば 管理者の Cookie を わたす
// GET          … いま 管理者として 入っているか を かえす

import { json, fail, checkAdminPass, adminCookie, isAdmin } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  return json({ ok: true, admin: await isAdmin(request, env) });
}

export async function onRequestPost({ request, env }) {
  if (!env.SESSION_SECRET) {
    return fail(500, "サーバーの せってい（SESSION_SECRET）が まだです", "server_not_configured");
  }
  if (!String(env.ADMIN_PASS || "").trim()) {
    return fail(500, "管理者の 合言葉（ADMIN_PASS）が まだです", "admin_not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  if (!checkAdminPass(env, body.pass)) {
    return fail(401, "合言葉が ちがいます", "bad_pass");
  }

  return json({ ok: true, label: "管理者" }, { headers: { "set-cookie": await adminCookie(env) } });
}
