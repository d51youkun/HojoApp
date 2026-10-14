// まる意見：とうろくした「なまえ」の ほんものの ばしょ
//
// なまえは ここ（kids 表）に 1回だけ 入る。あとから かえない。
// 意見と 理由は submissions 表に 何行でも ふえる（上書きしない）。

import { newId } from "./auth.js";

/** sid から とうろくずみの なまえを とる。いなければ null。 */
export async function findKid(env, sid) {
  if (!sid) return null;
  const row = await env.DB.prepare("SELECT sid, name FROM kids WHERE sid = ?1").bind(sid).first();
  return row || null;
}

/** あたらしく とうろくする。 */
export async function createKid(env, name) {
  const sid = newId();
  await env.DB.prepare("INSERT INTO kids (sid, name, created_at) VALUES (?1, ?2, datetime('now'))")
    .bind(sid, name)
    .run();
  return { sid: sid, name: name };
}

/** とうろくした 人の かず。 */
export async function countKids(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM kids").first();
  return row && row.n ? row.n : 0;
}
