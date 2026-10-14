// GET /api/myask … 子ども用。まだ こたえていない「先生からの しつもん」を かえす

import { json, getSid } from "../_lib/auth.js";
import { findKid } from "../_lib/kids.js";
import { listOpenAsksFor } from "../_lib/rules.js";

export async function onRequestGet({ request, env }) {
  const kid = await findKid(env, await getSid(request, env));
  if (!kid) return json({ ok: true, asks: [] });
  return json({ ok: true, asks: await listOpenAsksFor(env, kid.sid) });
}
