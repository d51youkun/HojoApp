// GET /api/me … いまログインしている人を返す

import { json, getUser } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ ok: true, signedIn: false, user: null });
  return json({ ok: true, signedIn: true, user });
}
