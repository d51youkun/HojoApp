// POST /api/restore … ブラウザに おぼえておいた sid から、アカウントを もどす
//
// なぜ これが あるか：
//   ブラウザの Cookie は、閉じたり かたづけたり すると 消える ことが ある。
//   でも localStorage に sid を おぼえておけば、名前を 打ち直さずに もどれる。
//
// あんぜん：sid は 128ビットの ランダムな 文字列。kids 表に いるかで たしかめるので、
// 当てずっぽうで だれかに なりすます ことは できない。

import { json, fail, sidCookie, sidExists } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.SESSION_SECRET) {
    return fail(500, "サーバーの せってい（SESSION_SECRET）が まだです", "server_not_configured");
  }

  let body;
  try { body = await request.json(); } catch (e) { return fail(400, "かたちが 正しくありません", "bad_request"); }

  const sid = String(body.sid || "").trim();
  if (!/^[0-9a-f]{16,64}$/.test(sid)) return fail(400, "sid の かたちが 正しくありません", "bad_sid");
  if (!(await sidExists(env, sid))) return fail(404, "その アカウントは もう ありません", "not_found");

  return json({ ok: true }, { headers: { "set-cookie": await sidCookie(env, sid) } });
}
