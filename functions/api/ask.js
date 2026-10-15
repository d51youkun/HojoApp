// /api/ask … 先生／管理者が 出す「しつもん」
//
// GET  … 出した しつもんと こたえの 一覧（先生・管理者）
//        先生には sid（アカウントの かぎ）を かえさない
// POST … しつもんを 出す（先生・管理者）
//        { sid, kind } でも { submission_id, kind } でも よい
//
// kind = "reason"  → 「理由を きく」
// kind = "detail"  → 「詳しく お願いする」

import { json, fail, isAdmin, isTeacher } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { createAsk, listAllAsks } from "../_lib/rules.js";

/** 先生か 管理者か（どちらでもなければ ""）。 */
async function staff(request, env) {
  if (await isAdmin(request, env)) return "admin";
  if (await isTeacher(request, env)) return "teacher";
  return "";
}

/** 先生に わたして よい かたち（sid を ぬく）。 */
function publicAsk(a) {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    text: a.text,
    submission_id: a.submission_id,
    created_at: a.created_at,
    answered: a.answered,
    answer: a.answer,
    answered_at: a.answered_at,
  };
}

export async function onRequestGet({ request, env }) {
  const who = await staff(request, env);
  if (!who) return fail(401, "合言葉を 入れてね", "need_pass");
  const all = await listAllAsks(env);
  return json({ ok: true, asks: who === "admin" ? all : all.map(publicAsk) });
}

export async function onRequestPost({ request, env }) {
  const who = await staff(request, env);
  if (!who) return fail(401, "合言葉を 入れてね", "need_pass");

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const kind = String(body.kind || "reason");
  if (kind !== "reason" && kind !== "detail") {
    return fail(400, "しつもんの しゅるいが 正しくありません", "bad_kind");
  }

  // だれに きくのか：sid か、意見の 番号（submission_id）で さだめる。
  // 先生には sid を わたしていないので、番号から さがす。
  let sid = String(body.sid || "").trim();
  let subId = null;

  if (body.submission_id !== undefined && body.submission_id !== null && body.submission_id !== "") {
    const n = Number(body.submission_id);
    if (!Number.isInteger(n) || n <= 0) return fail(400, "どの意見か わからなかったよ", "bad_id");
    const row = await env.DB.prepare("SELECT id, sid, name FROM submissions WHERE id = ?1")
      .bind(n)
      .first();
    if (!row) return fail(404, "その意見は もう なかったよ", "not_found");
    subId = n;
    if (!sid) sid = String(row.sid);
  }

  if (!sid) return fail(400, "だれに きくのか わからなかったよ", "bad_sid");

  const kid = await findKid(env, sid);
  if (!kid) return fail(404, "その人は 見つからなかったよ", "not_found");

  const made = await createAsk(env, sid, kid.name, kind, body.text, subId);
  return json({ ok: true, name: kid.name, kind: made.kind, text: made.text });
}
