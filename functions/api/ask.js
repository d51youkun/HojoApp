// /api/ask … 先生が 出す「しつもん」
//
// GET  … 出した しつもんと こたえの 一覧（先生だけ）
// POST … しつもんを 出す { sid, kind: "reason"|"detail", submission_id? , text? }（先生だけ）
//
// kind = "reason"  → 「理由を きく」
// kind = "detail"  → 「詳しく お願いする」

import { json, fail, isTeacher } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { createAsk, listAllAsks } from "../_lib/rules.js";

export async function onRequestGet({ request, env }) {
  if (!(await isTeacher(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }
  return json({ ok: true, asks: await listAllAsks(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isTeacher(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const sid = String(body.sid || "").trim();
  if (!sid) return fail(400, "だれに きくのか わからなかったよ", "bad_sid");

  const kind = String(body.kind || "reason");
  if (kind !== "reason" && kind !== "detail") {
    return fail(400, "しつもんの しゅるいが 正しくありません", "bad_kind");
  }

  const kid = await findKid(env, sid);
  if (!kid) return fail(404, "その人は 見つからなかったよ", "not_found");

  const made = await createAsk(env, sid, kid.name, kind, body.text, body.submission_id);
  return json({ ok: true, name: kid.name, kind: made.kind, text: made.text });
}
