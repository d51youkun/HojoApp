// GET /api/kids … とうろくずみの人の 一覧（先生だけ）
//
// 盤面（/api/board）は 意見から つくるので、まだ 意見を 出していない 人は 出てこない。
// この API は kids 表 から ぜんいんを かえす。だから 先生は
// 「意見を 出していない子」にも しつもんを 出したり Ban したり できる。

import { json, fail, isTeacher } from "../_lib/auth.js";
import { listKidsWithStats } from "../_lib/kids.js";

export async function onRequestGet({ request, env }) {
  if (!(await isTeacher(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }
  return json({ ok: true, kids: await listKidsWithStats(env) });
}
