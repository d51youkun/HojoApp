// GET /api/photo?id=N … 写真の 中の データを かえす（先生 or 管理者）
//
// <img src="/api/photo?id=3"> の ように つかう。

import { fail, isStaff } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!(await isStaff(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail(400, "どの写真か わからなかったよ", "bad_id");

  const row = await env.DB.prepare("SELECT data FROM photos WHERE id = ?1").bind(id).first();
  if (!row || !row.data) return fail(404, "その写真は もう なかったよ", "not_found");

  const m = String(row.data).match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!m) return fail(500, "写真の かたちが こわれています", "bad_data");

  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      "content-type": m[1],
      "cache-control": "private, max-age=300",
    },
  });
}
