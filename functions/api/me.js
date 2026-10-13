// GET /api/me … いま おぼえている なまえ を かえす

import { json, getUser } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user || !user.name) return json({ ok: true, signedIn: false, user: null });
  return json({ ok: true, signedIn: true, user: { name: user.name } });
}
