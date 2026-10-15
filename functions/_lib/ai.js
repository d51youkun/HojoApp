// まる意見：Cloudflare Workers AI で「同じ意見」をまとめる部分
//
// やり方：
//  1) それぞれの意見を「意味の数値（ベクトル）」に変換する（@cf/baai/bge-m3）
//  2) ベクトルどうしの近さ（コサイン類似度）が しきい値 より大きいものを同じまとまりにする
//
// 計算したベクトルは D1 にためておく（vectorstore.js）。
// だから先生画面を何回リロードしても、AIを呼ぶのは「新しい意見が来たとき」だけ。

export const EMBED_MODEL = "@cf/baai/bge-m3";
// 0.80 は 実測で 「わかれすぎ」だった（同じ いみの 短い 意見でも 0.80に とどかず、
// まるが 1つも まとまらなかった）。10この 意見で はかって 0.70 に した。
// 0.70では ちがう いみの 意見が くっつかなかった（いちばん 高い ちがうペアが 0.690）。
export const DEFAULT_THRESHOLD = 0.7;

/** 意見が「変わったかどうか」を見るための キー */
export function opinionKey(text) {
  return String(text || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** AIの返事からベクトルの一覧をとりだす（モデルによって返り方が少しちがうので両方に対応） */
export function extractVectors(res, count) {
  const data = res && (res.data || res.embeddings);
  if (!data || !Array.isArray(data)) throw new Error("no_embeddings");

  // 1本ぶんが平らに並んでいる場合（[v0, v1, ...]）
  if (typeof data[0] === "number") {
    if (count === 1) return [data];
    const dim =
      res && Array.isArray(res.shape) && res.shape.length === 2
        ? res.shape[1]
        : Math.round(data.length / count);
    const out = [];
    for (let i = 0; i < count; i++) out.push(data.slice(i * dim, (i + 1) * dim));
    return out;
  }
  // はじめから [[...], [...]] の場合
  return data;
}

/** まとめてベクトルにする（内部で小さく分けて呼ぶ） */
export async function embedTexts(env, texts) {
  if (!env || !env.AI) throw new Error("ai_binding_missing");
  const out = [];
  const CHUNK = 40;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const part = texts.slice(i, i + CHUNK);
    const res = await env.AI.run(EMBED_MODEL, { text: part });
    const vecs = extractVectors(res, part.length);
    if (vecs.length !== part.length) throw new Error("embed_count_mismatch");
    for (let k = 0; k < vecs.length; k++) out.push(vecs[k]);
  }
  return out;
}

/** コサイン類似度（-1〜1。1に近いほど意味が近い） */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * ベクトルをもとにまとまりを作る。
 * items と vectors は同じ順番でそろえておくこと。
 * 返り値：[[{item, index}, ...], ...]
 */
export function clusterByVectors(items, vectors, threshold) {
  const n = items.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosine(vectors[i], vectors[j]) >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push({ item: item, index: i });
  });
  return [...groups.values()];
}

/** まとまりの代表（いちばん「まんなか」の意見）をえらぶ */
export function medoidByVectors(group, vectors) {
  if (group.length <= 1) return group[0].item.opinion;
  let best = group[0];
  let bestScore = -Infinity;
  for (let a = 0; a < group.length; a++) {
    let sum = 0;
    for (let b = 0; b < group.length; b++) {
      if (a === b) continue;
      sum += cosine(vectors[group[a].index], vectors[group[b].index]);
    }
    sum /= group.length - 1;
    if (sum > bestScore) {
      bestScore = sum;
      best = group[a];
    }
  }
  return best.item.opinion;
}
