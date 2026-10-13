// POST /api/session
// 子どもページ／先生ページが受け取った Google の IDトークンを検証して、
// 本人確認ずみのセッションCookieを発行する。

import {
  json,
  fail,
  verifyGoogleIdToken,
  createSessionToken,
  sessionCookieHeader,
} from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.GOOGLE_CLIENT_ID) {
    return fail(500, "サーバーの設定（GOOGLE_CLIENT_ID）がまだです", "server_not_configured");
  }
  if (!env.SESSION_SECRET) {
    return fail(500, "サーバーの設定（SESSION_SECRET）がまだです", "server_not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "リクエストの形式が正しくありません", "bad_request");
  }

  let payload;
  try {
    payload = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    return fail(
      401,
      "Googleのログインを確認できませんでした。もういちどログインしてね",
      String(err.message || "verify_failed")
    );
  }

  const user = {
    email: String(payload.email).toLowerCase(),
    name: payload.name || String(payload.email).split("@")[0],
    picture: payload.picture || "",
  };

  const token = await createSessionToken(env.SESSION_SECRET, user);

  return json(
    { ok: true, user },
    { headers: { "set-cookie": sessionCookieHeader(token) } }
  );
}
