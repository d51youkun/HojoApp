// POST /api/answer … 子どもが 先生の しつもんに こたえる { id, answer }

import { json, fail, cleanText, getSid } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { isBanned, answerAsk } from "../_lib/rules.js";

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

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "どの しつもんか わからなかったよ", "bad_id");

  const answer = cleanText(body.answer, 200);
  if (!answer) return fail(400, "こたえを 書いてね", "empty_answer");

  const r = await answerAsk(env, kid.sid, id, answer);
  if (!r.ok) {
    if (r.code === "not_found") return fail(404, "その しつもんは もう なかったよ", "not_found");
    if (r.code === "not_yours") return fail(403, "その しつもんは 自分あてでは ないよ", "not_yours");
    return fail(400, "こたえを 書いてね", r.code || "bad_request");
  }

  return json({ ok: true, name: kid.name });
}
