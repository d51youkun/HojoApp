// まる意見：AI（文章を 読む モデル）で 意見を まとめる係
//
// これまでは 「意味の ベクトル」の にている度で まとめていたが、
// 実測すると しきい値 0.80 では ほとんど 何も まとまらなかった
// （同じ いみの 意見でも 0.80 に とどかない）。そこで：
//   1) AI（LLM）に 意見の 一覧を わたして、意味ごとの まとまりと
//      「みじかい 見出し」を つくってもらう（いまの 本線）
//   2) 失敗したら ベクトルの まとめ（しきい値は ai.js の 実測値）
//   3) それも だめなら 文字の にている度（cluster.js）
//
// 結果は D1（ai_groups）に ためる。キーは「意見の 中身の ならび」の ハッシュなので、
// 新しい 意見が ふえた ときだけ AI を よぶ。5秒ごとの こうしんでも お金が かからない。

import { opinionKey } from "./ai.js";

export const GROUP_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_LABEL = 60;      // 見出しの ながさの 上限（AIには 10〜16文字を たのむ）
const PROMPT_VERSION = "v2";   // たのみかたを かえたら 上げる（ためた けっかを つかわない）
const MAX_LLM_ITEMS = 60;   // おおすぎる ときは AIを よばない（お金と 時間の ため）

/** 意見の ならび から キー（ハッシュ）を つくる */
async function signature(items) {
  const s = PROMPT_VERSION + "|" + items.map((it) => it.id + ":" + opinionKey(it.opinion)).join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureTable(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS ai_groups (" +
      "sig TEXT PRIMARY KEY, payload TEXT NOT NULL, " +
      "updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
  ).run();
}

/** ためておいた まとめを とる（なければ null） */
export async function cachedGroups(env, items) {
  const key = await signature(items);
  try {
    const row = await env.DB.prepare("SELECT payload FROM ai_groups WHERE sig = ?1")
      .bind(key)
      .first();
    if (row && row.payload) {
      const g = JSON.parse(row.payload);
      if (Array.isArray(g) && g.length) return { key: key, groups: g, cached: true };
    }
  } catch (e) {
    try {
      await ensureTable(env);
    } catch (e2) {}
  }
  return { key: key, groups: null, cached: false };
}

export async function saveGroups(env, key, groups) {
  try {
    await env.DB.prepare(
      "INSERT INTO ai_groups (sig, payload, updated_at) VALUES (?1, ?2, datetime('now')) " +
        "ON CONFLICT(sig) DO UPDATE SET payload = ?2, updated_at = datetime('now')"
    )
      .bind(key, JSON.stringify(groups))
      .run();
    // ふるい まとめは けす（200件 いじょう たまったら）
    await env.DB.prepare(
      "DELETE FROM ai_groups WHERE sig NOT IN " +
        "(SELECT sig FROM ai_groups ORDER BY updated_at DESC LIMIT 200)"
    ).run();
  } catch (e) {}
}

/** AIの 返事から JSON だけ とりだす（```をつけて くることが ある） */
function extractJson(text) {
  let t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return t;
}

function cleanLabel(text, fallback) {
  const t = String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'「『]|["'」』]$/g, "")
    .trim()
    .slice(0, MAX_LABEL);
  return t || fallback;
}

/**
 * 意見を AI で まとめる。
 * 返り値：[{ label, ids:[1,2] }]（番号は submissions.id）。まとめられなければ null。
 */
export async function groupByLLM(env, items) {
  if (!env || !env.AI || !items || items.length === 0) return null;

  // (1) まったく おなじ 意見は、AIに たのむ まえに まとめる。
  //     おなじ 文なのに まとまらない、という まちがいを ふせぐ（これは 計算で できる）。
  const uniq = [];              // AIに わたす 意見（おなじ 文は 1つだけ）
  const bucket = new Map();     // おなじ 文 → submissions.id の 一覧
  items.forEach((it) => {
    const k = opinionKey(it.opinion);
    if (!bucket.has(k)) {
      bucket.set(k, []);
      uniq.push(it);
    }
    bucket.get(k).push(it.id);
  });

  const ask = uniq.slice(0, MAX_LLM_ITEMS);
  if (ask.length === 0) return null;

  const messages = [
    {
      role: "system",
      content:
        "あなたは 小学校の 先生を たすける AI です。子どもが 書いた 意見を、いっている ことが 同じ ものどうしで まとめ、まとまりの 見出しを つけます。かならず JSON だけを かえします。",
    },
    {
      role: "user",
      content:
        "つぎは 小学6年生が 書いた 意見です。いっている ことが 同じ ものどうしで まとめてください。\n\n" +
        ask.map((it, i) => i + 1 + ". " + String(it.opinion || "")).join("\n") +
        "\n\nこたえは つぎの かたちの JSON だけ:\n" +
        '{"groups":[{"label":"見出し","nos":[1,3]}]}\n' +
        "やくそく:\n" +
        "・すべての 番号を 1回ずつ 入れてください。1つの まとまりも かならず 入れてください（もれなく）。\n" +
        "・見出しは 10〜16文字で、その まとまりが なにを いっているか わかる ことばに してください。\n" +
        "  よい れい:「たてあなじゅうきょの くらし」「かいづかの あと」「むらから くにへ」\n" +
        "  わるい れい: 1ことばだけの 見出し（「北条」「貝」「試験」など、なにを いっているか わからない もの）\n" +
        "・いっている ことが ちがう ものは ぜったいに くっつけないでください。\n" +
        "・1つだけの まとまりは、その 意見を そのまま 見出しに してください。\n" +
        "・かんがえた りゆうは 書かず、JSON だけを かえしてください。",
    },
  ];

  const res = await env.AI.run(GROUP_MODEL, { messages: messages, max_tokens: 1500, temperature: 0.2 });

  // モデルによって かえりかたが ちがう（{response:"..."} / {choices:[...]} / もう JSON な オブジェクト）
  let raw =
    typeof res === "string"
      ? res
      : (res && (res.response ||
          (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) ||
          res.result));
  if (!raw) throw new Error("no_response");
  if (typeof raw !== "string") raw = JSON.stringify(raw);

  const parsed = JSON.parse(extractJson(raw));
  const rawGroups = parsed && parsed.groups;
  if (!Array.isArray(rawGroups) || rawGroups.length === 0) throw new Error("bad_shape");

  // (2) かくにん：すべての 番号が ちょうど 1回ずつ 出ているか
  const seen = new Set();
  const out = [];
  rawGroups.forEach((g) => {
    const nos = (g && g.nos) || (g && g.numbers) || [];
    if (!Array.isArray(nos)) return;
    const ids = [];
    let firstIdx = -1;
    nos.forEach((n) => {
      const idx = Number(n) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= ask.length) return;
      if (firstIdx < 0) firstIdx = idx;
      if (seen.has(idx)) return;
      seen.add(idx);
      (bucket.get(opinionKey(ask[idx].opinion)) || []).forEach((id) => ids.push(id));
    });
    if (ids.length) {
      const fallback = firstIdx >= 0 ? String(ask[firstIdx].opinion || "") : "";
      out.push({ label: cleanLabel(g && g.label, fallback), ids: ids });
    }
  });

  // (3) AIが わすれた 番号は、1この まとまりに して うめる（ぜんぶ すてない）
  ask.forEach((it, i) => {
    if (seen.has(i)) return;
    out.push({ label: cleanLabel(it.opinion, "その他"), ids: (bucket.get(opinionKey(it.opinion)) || []).slice() });
  });
  // (4) おおすぎて AIに わたさなかった 意見も 1この まとまりで 足す
  uniq.slice(MAX_LLM_ITEMS).forEach((it) => {
    out.push({ label: cleanLabel(it.opinion, "その他"), ids: (bucket.get(opinionKey(it.opinion)) || []).slice() });
  });

  out.sort((a, b) => b.ids.length - a.ids.length);
  return out;
}
