// GET /api/board … 先生画面用。みんなの意見をまとめて丸ごとに返す。
//
// まとめ方：
//  1) env.AI（Cloudflare Workers AI）があれば、意味の近さでまとめる（ai.js）
//  2) 使えない／失敗したときは、文字の並びの近さでまとめる（cluster.js）
// どちらでまとめたかは method（"ai" / "bigram"）で返す。
//
// 丸の大きさ＝「同じ意見の 人の かず」。同じ人が にている意見を 2つ 出しても 人は 1人。
// 見られるのは先生だけ（合言葉の Cookie を持っている人）。

import { json, fail, isTeacher } from "../_lib/auth.js";
import { clusterize, medoidLabel } from "../_lib/cluster.js";
import { ensureVectors } from "../_lib/vectorstore.js";
import { clusterByVectors, medoidByVectors, DEFAULT_THRESHOLD } from "../_lib/ai.js";

export async function onRequestGet({ request, env }) {
  if (!(await isTeacher(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  const { results } = await env.DB.prepare(
    "SELECT id, sid, name, opinion, reason, created_at FROM submissions ORDER BY created_at ASC, id ASC"
  ).all();
  const items = results || [];

  let groups = [];
  let method = "none";
  let threshold = 0;
  let note = "";

  const byBigram = () =>
    clusterize(items).map((g) => ({ label: medoidLabel(g), members: g }));

  if (items.length > 0) {
    if (env.AI) {
      try {
        threshold = Number(env.SIMILARITY_THRESHOLD || DEFAULT_THRESHOLD);
        if (!(threshold > 0 && threshold <= 1)) threshold = DEFAULT_THRESHOLD;

        const vectors = await ensureVectors(env, items);
        groups = clusterByVectors(items, vectors, threshold).map((g) => ({
          label: medoidByVectors(g, vectors),
          members: g.map((x) => x.item),
        }));
        method = "ai";
      } catch (err) {
        note = String((err && err.message) || err);
        groups = byBigram();
        method = "bigram";
      }
    } else {
      note = "ai_binding_missing";
      groups = byBigram();
      method = "bigram";
    }
  }

  const clusters = groups
    .map((g, i) => {
      const names = new Map();
      g.members.forEach((m) => {
        if (!names.has(m.sid)) names.set(m.sid, m.name);
      });
      return {
        id: "c" + i,
        label: g.label,
        count: names.size,                 // 人のかず（同じ人は 1人）
        posts: g.members.length,           // 意見の かず
        members: Array.from(names.values()).map((name) => ({ name: name })),
        reasons: g.members.map((m) => ({
          id: m.id,
          name: m.name,
          reason: m.reason,
          opinion: m.opinion,
        })),
      };
    })
    .sort((a, b) => b.count - a.count || b.posts - a.posts || String(a.label).localeCompare(String(b.label), "ja"));

  const people = new Set(items.map((it) => it.sid)).size;

  return json({
    ok: true,
    total: items.length,
    people: people,
    clusterCount: clusters.length,
    method: method,
    threshold: threshold,
    note: note,
    updatedAt: new Date().toISOString(),
    clusters: clusters,
  });
}
