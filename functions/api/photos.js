// /api/photos … アップされた 写真
//
// GET    … 一覧（メタだけ。画像は /api/photo?id=N で とる）（先生 or 管理者）
// POST   … アップする { data, caption?, w?, h? }（子ども）
// DELETE … けす { id }（先生 or 管理者）

import { json, fail, getSid, isStaff } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { isBanned } from "../_lib/rules.js";

const MAX_DATA = 195000; // 文字（base64）。D1で 実測して 安全な わく（200KBの 画像まで）

export async function onRequestGet({ request, env }) {
  if (!(await isStaff(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }
  const { results } = await env.DB.prepare(
    "SELECT id, sid, name, caption, bytes, created_at FROM photos ORDER BY id DESC LIMIT 200"
  ).all();
  return json({ ok: true, photos: results || [] });
}

export async function onRequestPost({ request, env }) {
  // 先生（か 管理者）も アップできる。子どもは 自分の なまえで。
  const staff = await isStaff(request, env);
  let kid = null, ownerName = "先生", ownerSid = "teacher";
  if (!staff) {
    kid = await findKid(env, await getSid(request, env));
    if (!kid) return fail(401, "まず 「なまえ」を とうろくしてね", "not_registered");
    if (await isBanned(env, kid.sid)) {
      return fail(403, "この アカウントは ていし中です。先生に そうだんしてね", "banned");
    }
    ownerName = kid.name; ownerSid = kid.sid;
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const data = String(body.data || "");
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(data)) {
    return fail(400, "写真の かたちが 正しくありません", "bad_image");
  }
  if (data.length > MAX_DATA) {
    return fail(413, "写真が 大きすぎます（ブラウザで 小さくしてから おくってね）", "too_big");
  }

  const caption = String(body.caption || "").slice(0, 60);
  const bytes = Number(body.bytes) || 0;

  let r;
  try {
    r = await env.DB.prepare(
      "INSERT INTO photos (sid, name, caption, data, bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))"
    )
      .bind(ownerSid, ownerName, caption, data, bytes)
      .run();
  } catch (err) {
    return fail(500, "保存できませんでした（写真が 大きすぎる かも）", "save_failed");
  }

  return json({ ok: true, name: ownerName, id: r.meta && r.meta.last_row_id });
}

export async function onRequestDelete({ request, env }) {
  if (!(await isStaff(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, "どの写真か わからなかったよ", "bad_id");

  const row = await env.DB.prepare("SELECT id, name FROM photos WHERE id = ?1").bind(id).first();
  if (!row) return fail(404, "その写真は もう なかったよ", "not_found");

  await env.DB.prepare("DELETE FROM photos WHERE id = ?1").bind(id).run();
  return json({ ok: true, id: id, name: row.name });
}
