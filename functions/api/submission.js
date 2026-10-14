// POST /api/submission … 意見と 理由を おくる
//
// ・おくるたびに 「あたらしい意見」として 1行 ふえる（上書きしない）。
// ・なまえは サーバーが kids 表から とる。リクエストの なまえは つかわない。
//   だから なまえを いつわっても、とうろくした なまえしか 入らない。

import { json, fail, cleanText, getSid, isTeacher } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { isBanned } from "../_lib/rules.js";

const MAX_OPINION = 60;
const MAX_REASON = 200;

export async function onRequestGet({ request, env }) {
  const kid = await findKid(env, await getSid(request, env));
  if (!kid) return json({ ok: true, registered: false, count: 0, latest: null });

  const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE sid = ?1")
    .bind(kid.sid)
    .first();
  const latest = await env.DB.prepare(
    "SELECT opinion, reason, created_at FROM submissions WHERE sid = ?1 ORDER BY id DESC LIMIT 1"
  )
    .bind(kid.sid)
    .first();

  return json({
    ok: true,
    registered: true,
    name: kid.name,
    count: c && c.n ? c.n : 0,
    latest: latest || null,
  });
}

export async function onRequestPost({ request, env }) {
  const kid = await findKid(env, await getSid(request, env));
  if (!kid) return fail(401, "まず 「なまえ」を とうろくしてね", "not_registered");
  if (await isBanned(env, kid.sid)) {
    return fail(403, "この アカウントは ていし中です。先生に そうだんしてね", "banned");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const opinion = cleanText(body.opinion, MAX_OPINION);
  const reason = cleanText(body.reason, MAX_REASON);

  if (!opinion) return fail(400, "「意見」を 入れてね", "empty_opinion");
  if (!reason) return fail(400, "「理由」を 入れてね", "empty_reason");

  await env.DB.prepare(
    "INSERT INTO submissions (sid, name, opinion, reason, created_at) " +
      "VALUES (?1, ?2, ?3, ?4, datetime('now'))"
  )
    .bind(kid.sid, kid.name, opinion, reason)
    .run();

  return json({ ok: true, name: kid.name, opinion: opinion, reason: reason });
}

// DELETE /api/submission … 先生が 意見を 1つ けす
// けすには 合言葉（先生の Cookie）が いる。子どもからは けせない。
export async function onRequestDelete({ request, env }) {
  if (!(await isTeacher(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(400, "どの意見か わからなかったよ", "bad_id");
  }

  const row = await env.DB.prepare("SELECT id, name, opinion FROM submissions WHERE id = ?1")
    .bind(id)
    .first();
  if (!row) return fail(404, "その意見は もう なかったよ", "not_found");

  await env.DB.prepare("DELETE FROM submissions WHERE id = ?1").bind(id).run();
  await env.DB.prepare("DELETE FROM opinion_vectors WHERE subject_id = ?1")
    .bind(String(id))
    .run();

  return json({ ok: true, deleted: id, name: row.name, opinion: row.opinion });
}
