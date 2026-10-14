// まる意見：意見のベクトルを D1 にためておく係
//
// 先生画面は 5秒ごとに /api/board を呼ぶ。そのたびに Workers AI を呼ぶと
// お金と時間がもったいないので、
//   「まだ計算していない意見」「意見が変わった意見」だけ計算する。
//
// 意見は 1行ずつ ふえるので、目印は submissions.id（意見ごとの 番号）。

import { opinionKey, EMBED_MODEL, embedTexts } from "./ai.js";

/**
 * items と同じ順番でベクトルの一覧を返す。
 * 足りないぶんだけ Workers AI で計算して D1 に保存する。
 */
export async function ensureVectors(env, items) {
  const keys = items.map((it) => opinionKey(it.opinion));

  const { results } = await env.DB.prepare(
    "SELECT subject_id, opinion_key, model, vector FROM opinion_vectors"
  ).all();
  const cached = new Map();
  (results || []).forEach((r) => cached.set(String(r.subject_id), r));

  const out = new Array(items.length).fill(null);
  const need = [];

  items.forEach((it, i) => {
    const row = cached.get(String(it.id));
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
        "INSERT INTO opinion_vectors (subject_id, opinion_key, model, vector, updated_at) " +
          "VALUES (?1, ?2, ?3, ?4, datetime('now')) " +
          "ON CONFLICT(subject_id) DO UPDATE SET " +
          "opinion_key = ?2, model = ?3, vector = ?4, updated_at = datetime('now')"
      ).bind(String(items[idx].id), keys[idx], EMBED_MODEL, JSON.stringify(vecs[k]))
    );
    await env.DB.batch(stmts);
    need.forEach((idx, k) => {
      out[idx] = vecs[k];
    });
  }

  // もう のこっていない 意見の ベクトルは 消す
  const live = new Set(items.map((it) => String(it.id)));
  const dead = (results || []).map((r) => String(r.subject_id)).filter((s) => !live.has(s));
  if (dead.length > 0) {
    await env.DB.batch(
      dead.map((s) => env.DB.prepare("DELETE FROM opinion_vectors WHERE subject_id = ?1").bind(s))
    );
  }

  return out;
}
