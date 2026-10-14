// POST /api/report … ブラウザで おきた エラーを あつめる
//
// だれでも おくれる（エラーの ときは Cookie が ない ことも あるため）。
// 入るのは ことばだけ。なまえや 意見の 中身は おくらない。

import { json, cleanText } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false }); }

  const page = cleanText(b.page, 20);
  const step = cleanText(b.step, 60);
  const message = cleanText(b.message, 300);
  const extra = cleanText(b.extra, 300);
  const ua = cleanText(request.headers.get("user-agent"), 200);

  try {
    await env.DB.prepare(
      "INSERT INTO reports (page, step, message, extra, ua, created_at) VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))"
    )
      .bind(page, step, message, extra, ua)
      .run();
  } catch (e) {}

  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const { isAdmin } = await import("../_lib/auth.js");
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "管理者だけ" }, { status: 401 });
  const { results } = await env.DB.prepare(
    "SELECT id, page, step, message, extra, ua, created_at FROM reports ORDER BY id DESC LIMIT 50"
  ).all();
  return json({ ok: true, reports: results || [] });
}
