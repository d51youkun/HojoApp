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

/**
 * アカウントを まるごと 消す（もどせない）。
 *   kids の行 / その人の 意見 / 意見の ベクトル / しつもん / Banの 行 を ぜんぶ 消す。
 * 消した ないよう（なまえ・意見の かず・しつもんの かず）を かえす。
 */
export async function deleteAccount(env, sid) {
  if (!sid) return null;

  const kid = await env.DB.prepare("SELECT sid, name FROM kids WHERE sid = ?1").bind(sid).first();
  if (!kid) return null;

  const posts = await env.DB.prepare("SELECT COUNT(*) AS n FROM submissions WHERE sid = ?1").bind(sid).first();
  const asks = await env.DB.prepare("SELECT COUNT(*) AS n FROM asks WHERE sid = ?1").bind(sid).first();

  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM opinion_vectors WHERE subject_id IN (SELECT id FROM submissions WHERE sid = ?1)"
    ).bind(sid),
    env.DB.prepare("DELETE FROM submissions WHERE sid = ?1").bind(sid),
    env.DB.prepare("DELETE FROM asks WHERE sid = ?1").bind(sid),
    env.DB.prepare("DELETE FROM photos WHERE sid = ?1").bind(sid),
    env.DB.prepare("DELETE FROM bans WHERE sid = ?1").bind(sid),
    env.DB.prepare("DELETE FROM kids WHERE sid = ?1").bind(sid),
  ]);

  return {
    name: kid.name,
    posts: (posts && posts.n) || 0,
    asks: (asks && asks.n) || 0,
  };
}

/**
 * とうろくずみの 人ぜんいん（意見を まだ 出していない人も ふくむ）。
 * 意見の かずと、いま Ban中か どうかも つける。
 * → 先生が「意見を 出していない子」も 名指しで しつもん／Ban できる。
 */
export async function listKidsWithStats(env) {
  const { results } = await env.DB.prepare(
    "SELECT k.sid, k.name, k.created_at, " +
      "  (SELECT COUNT(*) FROM submissions s WHERE s.sid = k.sid) AS posts, " +
      "  (SELECT COUNT(*) FROM bans b WHERE b.sid = k.sid) AS banned " +
      "FROM kids k ORDER BY k.created_at DESC"
  ).all();
  return (results || []).map(function (r) {
    return {
      sid: r.sid,
      name: r.name,
      created_at: r.created_at,
      posts: r.posts || 0,
      banned: !!r.banned,
    };
  });
}
