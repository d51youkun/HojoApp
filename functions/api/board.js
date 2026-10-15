// GET /api/board … 先生画面用。みんなの意見をまとめて丸ごとに返す。
//
// まとめ方：
//  1) env.AI（Cloudflare Workers AI）があれば、意味の近さでまとめる（ai.js）
//  2) 使えない／失敗したときは、文字の並びの近さでまとめる（cluster.js）
// どちらでまとめたかは method（"ai" / "bigram"）で返す。
//
// 丸の大きさ＝「同じ意見の 人の かず」。同じ人が にている意見を 2つ 出しても 人は 1人。
// 見られるのは先生だけ（合言葉の Cookie を持っている人）。

import { json, fail, isAdmin, isTeacher } from "../_lib/auth.js";
import { clusterize, medoidLabel } from "../_lib/cluster.js";
import { ensureVectors } from "../_lib/vectorstore.js";
import { clusterByVectors, medoidByVectors, DEFAULT_THRESHOLD } from "../_lib/ai.js";
import { cachedGroups, saveGroups, groupByLLM } from "../_lib/aigroups.js";

export async function onRequestGet({ request, env }) {
  const admin = await isAdmin(request, env);
  if (!admin && !(await isTeacher(request, env))) {
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

  // 番号（submissions.id）から 意見を ひく ための 表
  const byId = new Map(items.map((it) => [String(it.id), it]));
  const fromLLM = (list) =>
    list
      .map((g) => ({
        label: String(g.label || ""),
        members: (g.ids || []).map((id) => byId.get(String(id))).filter(Boolean),
      }))
      .filter((g) => g.members.length > 0);

  /** 2だんめ：意味の ベクトルで まとめる */
  const byVectors = async () => {
    threshold = Number(env.SIMILARITY_THRESHOLD || DEFAULT_THRESHOLD);
    if (!(threshold > 0 && threshold <= 1)) threshold = DEFAULT_THRESHOLD;
    // 0.80 は 実測で わかれすぎ（何も まとまらない）だったので あつかわない
    if (Math.abs(threshold - 0.8) < 1e-9) threshold = DEFAULT_THRESHOLD;

    const vectors = await ensureVectors(env, items);
    groups = clusterByVectors(items, vectors, threshold).map((g) => ({
      label: medoidByVectors(g, vectors),
      members: g.map((x) => x.item),
    }));
    method = "ai";
  };

  if (items.length > 0) {
    if (env.AI) {
      // 1だんめ：AI（LLM）が 意味ごとに まとめて、見出しも つくる
      try {
        const c = await cachedGroups(env, items);
        if (c.groups) {
          groups = fromLLM(c.groups);
          method = "ai-llm";
        } else {
          const g = await groupByLLM(env, items);
          if (g && g.length) {
            groups = fromLLM(g);
            method = "ai-llm";
            await saveGroups(env, c.key, g);
          }
        }
      } catch (err) {
        note = "llm:" + String((err && err.message) || err);
      }

      // 2だんめ：ベクトル。3だんめ：文字。
      if (method === "none") {
        try {
          await byVectors();
        } catch (err) {
          note = (note ? note + " / " : "") + String((err && err.message) || err);
          groups = byBigram();
          method = "bigram";
        }
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
        // sid も わたす（先生が その人を 名指しで 「しつもん」「Ban」できるように）
        members: Array.from(names.entries()).map((e) => ({ sid: e[0], name: e[1] })),
        reasons: g.members.map((m) => ({
          id: m.id,
          sid: m.sid,
          name: m.name,
          reason: m.reason,
          opinion: m.opinion,
        })),
      };
    })
    .sort((a, b) => b.posts - a.posts || b.count - a.count || String(a.label).localeCompare(String(b.label), "ja"));

  // 先生には sid（アカウントの かぎ）を わたさない。sid は /api/restore で
  // 「その人に なりすまされる」かぎ なので、先生の 合言葉が もれた ときの ために かくす。
  // かわりに「意見の 番号（id）」を わたす。先生は その番号で 「しつもん」「けす」が できる。
  if (!admin) {
    clusters.forEach((c) => {
      (c.members || []).forEach((m) => {
        const mine = (c.reasons || []).filter((r) => String(r.sid) === String(m.sid));
        const latest = mine.reduce((a, b) => Math.max(a, Number(b.id) || 0), 0);
        delete m.sid;
        m.id = latest || null;
      });
      (c.reasons || []).forEach((r) => { delete r.sid; });
    });
  }

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
