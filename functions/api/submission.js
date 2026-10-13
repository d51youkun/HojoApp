// GET  /api/submission … 自分の送った内容を返す
// POST /api/submission … 意見と理由を送る（同じ人のぶんは上書き）

import { json, fail, getUser } from "../_lib/auth.js";

const MAX_OPINION = 80;
const MAX_REASON = 300;

function clean(text, max) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return fail(401, "ログインしてね", "not_signed_in");

  const row = await env.DB.prepare(
    "SELECT opinion, reason, created_at FROM submissions WHERE email = ?1"
  )
    .bind(user.email)
    .first();

  return json({ ok: true, submission: row || null });
}

export async function onRequestPost({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return fail(401, "ログインしてね", "not_signed_in");

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "リクエストの形式が正しくありません", "bad_request");
  }

  const opinion = clean(body.opinion, MAX_OPINION);
  const reason = clean(body.reason, MAX_REASON);

  if (!opinion) return fail(400, "意見を入れてね", "empty_opinion");
  if (opinion.length > MAX_OPINION) return fail(400, "意見が長すぎるよ", "opinion_too_long");
  if (!reason) return fail(400, "理由を入れてね", "empty_reason");
  if (reason.length > MAX_REASON) return fail(400, "理由が長すぎるよ", "reason_too_long");

  await env.DB.prepare(
    `INSERT INTO submissions (email, name, picture, opinion, reason, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET
       name = ?2, picture = ?3, opinion = ?4, reason = ?5, created_at = datetime('now')`
  )
    .bind(user.email, user.name, user.picture || "", opinion, reason)
    .run();

  return json({ ok: true, submission: { opinion, reason } });
}
