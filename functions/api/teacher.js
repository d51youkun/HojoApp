// POST /api/teacher … 先生の 合言葉を たしかめて Cookie を わたす

import { json, fail, checkPass, teacherCookie } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.SESSION_SECRET) {
    return fail(500, "サーバーの せってい（SESSION_SECRET）が まだです", "server_not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  if (!checkPass(env, body.pass)) {
    return fail(401, "合言葉が ちがいます", "bad_pass");
  }

  return json(
    { ok: true, label: "先生" },
    { headers: { "set-cookie": await teacherCookie(env) } }
  );
}
