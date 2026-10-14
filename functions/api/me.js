// GET /api/me … この ブラウザが とうろくずみか、止められていないかを かえす

import { json, getSid } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { findBan } from "../_lib/rules.js";

export async function onRequestGet({ request, env }) {
  const kid = await findKid(env, await getSid(request, env));
  if (!kid) return json({ ok: true, registered: false, name: null, banned: false });

  const ban = await findBan(env, kid.sid);
  return json({
    ok: true,
    registered: true,
    sid: kid.sid,
    name: ban && ban.name ? ban.name : kid.name,
    banned: !!ban,
    message: ban ? ban.reason || "" : "",
  });
}
