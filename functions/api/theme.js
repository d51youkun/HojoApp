// /api/theme … 「〇〇の 歴史」の 〇〇
//
// GET  … いまの ことば（子ども画面も 見るので だれでも）
// POST … かえる { theme }（管理者だけ）

import { json, fail, isAdmin } from "../_lib/auth.js";
import { getTheme, setTheme } from "../_lib/settings.js";

export async function onRequestGet({ env }) {
  return json({ ok: true, theme: await getTheme(env) });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return fail(401, "管理者の 合言葉を 入れてね", "need_admin");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const v = await setTheme(env, body.theme);
  if (!v) return fail(400, "ことばを 入れてね", "empty_theme");

  return json({ ok: true, theme: v });
}
