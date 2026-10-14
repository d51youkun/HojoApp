// /api/ban … アカウントの「ていし（Ban）」と「復旧」
//
// GET    … 止めている人の 一覧（先生だけ）
// POST   … 止める { sid, name?, reason? }（先生だけ）
// DELETE … もどす（復旧） { sid }（先生だけ）

import { json, fail, isAdmin } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { listBans, banKid, unbanKid, findBan } from "../_lib/rules.js";

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }
  return json({ ok: true, bans: await listBans(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const sid = String(body.sid || "").trim();
  if (!sid) return fail(400, "だれを 止めるのか わからなかったよ", "bad_sid");

  // なまえは サーバーが kids 表から とる（うその なまえを 入れさせない）
  const kid = await findKid(env, sid);
  const name = kid ? kid.name : String(body.name || "").slice(0, 16) || "(なまえ不明)";

  const already = await findBan(env, sid);
  await banKid(env, sid, name, body.reason);
  return json({ ok: true, name: name, already: !!already });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const sid = String(body.sid || "").trim();
  if (!sid) return fail(400, "だれを もどすのか わからなかったよ", "bad_sid");

  const name = await unbanKid(env, sid);
  if (name === null) return fail(404, "その人は Banリストに いなかったよ", "not_found");

  return json({ ok: true, name: name });
}
