// まる意見：意見のベクトルを D1 にためておく係
//
// 先生画面は 5秒ごとに /api/board を呼ぶ。そのたびに Workers AI を呼ぶと
// お金と時間がもったいないので、
//   「まだ計算していない意見」「意見が変わった意見」だけ計算する。

import { opinionKey, EMBED_MODEL, embedTexts } from "./ai.js";

/**
 * items と同じ順番でベクトルの一覧を返す。
 * 足りないぶんだけ Workers AI で計算して D1 に保存する。
 */
export async function ensureVectors(env, items) {
  const keys = items.map((it) => opinionKey(it.opinion));

  const { results } = await env.DB.prepare(
    "SELECT email, opinion_key, model, vector FROM opinion_vectors"
  ).all();
  const cached = new Map();
  (results || []).forEach((r) => cached.set(r.email, r));

  const out = new Array(items.length).fill(null);
  const need = [];

  items.forEach((it, i) => {
    const row = cached.get(it.email);
    if (row && row.opinion_key === keys[i] && row.model === EMBED_MODEL) {
      try {
        const v = JSON.parse(row.vector);
        if (Array.isArray(v) && v.length > 0) {
          out[i] = v;
          return;
        }
      } catch (e) {
        /* こわれていたら計算しなおす */
      }
    }
    need.push(i);
  });

  if (need.length > 0) {
    const texts = need.map((i) => items[i].opinion);
    const vecs = await embedTexts(env, texts);

    const stmts = need.map((idx, k) =>
      env.DB.prepare(
        `INSERT INTO opinion_vectors (email, opinion_key, model, vector, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(email) DO UPDATE SET
           opinion_key = ?2, model = ?3, vector = ?4, updated_at = datetime('now')`
      ).bind(items[idx].email, keys[idx], EMBED_MODEL, JSON.stringify(vecs[k]))
    );
    await env.DB.batch(stmts);
    need.forEach((idx, k) => {
      out[idx] = vecs[k];
    });
  }

  // もう送っていない人のベクトルは消す
  const live = new Set(items.map((it) => it.email));
  const dead = (results || []).map((r) => r.email).filter((e) => !live.has(e));
  if (dead.length > 0) {
    await env.DB.batch(
      dead.map((e) => env.DB.prepare("DELETE FROM opinion_vectors WHERE email = ?1").bind(e))
    );
  }

  return out;
}
