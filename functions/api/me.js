// GET /api/me … この ブラウザが とうろくずみか どうかを かえす

import { json, getSid } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";

export async function onRequestGet({ request, env }) {
  const kid = await findKid(env, await getSid(request, env));
  if (!kid) return json({ ok: true, registered: false, name: null });
  return json({ ok: true, registered: true, name: kid.name });
}
