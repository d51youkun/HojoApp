// POST /api/register … 「なまえ」を 1回だけ とうろくする
//
// ・はじめての 人は 新しく とうろくする（Cookie を わたす）
// ・もう とうろく ずみの Cookie で きた ときは、とうろくずみの なまえを かえすだけ。
//   だから あとから なまえを 書きかえようとしても 変わらない。

import { json, fail, cleanText, getSid, sidCookie } from "../_lib/auth.js";
import { findKid, createKid } from "../_lib/kids.js";
import { findBanByName } from "../_lib/rules.js";

const MAX_NAME = 16;

export async function onRequestPost({ request, env }) {
  if (!env.SESSION_SECRET) {
    return fail(500, "サーバーの せってい（SESSION_SECRET）が まだです", "server_not_configured");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const name = cleanText(body.name, MAX_NAME).replace(/\s+/g, " ");
  if (!name) return fail(400, "「なまえ」を 入れてね", "empty_name");

  const sid = await getSid(request, env);
  const kid = await findKid(env, sid);
  if (kid) {
    // もう とうろく ずみ。なまえは かえない。
    return json({ ok: true, name: kid.name, changed: false });
  }

  // 止められた なまえで 入りなおそうと していないか
  // （「reset」で 新しい Cookie を とっても、おなじ なまえでは 入れない）
  const bannedName = await findBanByName(env, name);
  if (bannedName) {
    return fail(
      403,
      "この なまえは 先生が ていし中です。先生に そうだんしてね",
      "banned_name"
    );
  }

  const made = await createKid(env, name);
  return json(
    { ok: true, name: made.name, changed: true },
    { headers: { "set-cookie": await sidCookie(env, made.sid) } }
  );
}
