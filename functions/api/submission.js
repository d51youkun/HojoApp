// GET  /api/submission … 自分の 送った ないよう
// POST /api/submission … なまえ・意見・理由を おくる（同じ ブラウザからは 上書き）

import { json, fail, getUser, newId, kidCookie } from "../_lib/auth.js";

const MAX_NAME = 16;
const MAX_OPINION = 60;
const MAX_REASON = 200;

function cleanText(text, max) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

function cleanName(text, max) {
  return cleanText(text, max).replace(/\s+/g, " ");
}

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ ok: true, submission: null });

  const row = await env.DB.prepare(
    "SELECT name, opinion, reason, created_at FROM submissions WHERE sid = ?1"
  )
    .bind(user.id)
    .first();

  return json({ ok: true, submission: row || null });
}

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

  const name = cleanName(body.name, MAX_NAME);
  const opinion = cleanText(body.opinion, MAX_OPINION);
  const reason = cleanText(body.reason, MAX_REASON);

  if (!name) return fail(400, "「なまえ」を 入れてね", "empty_name");
  if (!opinion) return fail(400, "「意見」を 入れてね", "empty_opinion");
  if (!reason) return fail(400, "「理由」を 入れてね", "empty_reason");

  const user = (await getUser(request, env)) || { id: newId(), name: name };

  await env.DB.prepare(
    "INSERT INTO submissions (sid, name, opinion, reason, created_at) " +
      "VALUES (?1, ?2, ?3, ?4, datetime('now')) " +
      "ON CONFLICT(sid) DO UPDATE SET " +
      "name = ?2, opinion = ?3, reason = ?4, created_at = datetime('now')"
  )
    .bind(user.id, name, opinion, reason)
    .run();

  return json(
    { ok: true, name: name, submission: { name: name, opinion: opinion, reason: reason } },
    { headers: { "set-cookie": await kidCookie(env, { id: user.id, name: name }) } }
  );
}
