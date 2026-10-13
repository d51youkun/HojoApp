// まる意見：「同じ意見」をまとめて丸にする部分
//
// いまは AI を使わずに、文字の並びの似ぐあいでまとめている（日本語は2文字ずつ）。
// あとで API（埋め込みベクトルなど）に差しかえるときは、
// このファイルの clusterize() を差しかえればOK。呼び出し側は functions/api/board.js。

const NORMALIZE_STRIP =
  /[\s\u3000、。，．,.!！?？「」『』（）()【】\[\]｛｝{}…‥・:：;；/\\'"’”\-—–~〜＊*#＃]/g;

/** 文字のゆれを消す */
export function normalize(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(NORMALIZE_STRIP, "");
}

/** 2文字ずつの組をつくる */
function bigrams(s) {
  const set = new Set();
  if (!s) return set;
  if (s.length <= 2) {
    set.add(s);
    return set;
  }
  for (let i = 0; i <= s.length - 2; i++) set.add(s.slice(i, i + 2));
  return set;
}

/**
 * 似ぐあい（0〜1）。似ていないとみなしたら 0 を返す。
 * ルール：共通の2文字組が3つ以上 → まとめる
 *         共通2つ以上 かつ 似ぐあい0.5以上 → まとめる
 *         短い文どうし（4文字以下）で似ぐあい0.6以上 → まとめる
 */
export function similarity(a, b) {
  const A = normalize(a);
  const B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;

  const ga = bigrams(A);
  const gb = bigrams(B);
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  if (shared === 0) return 0;

  const dice = (2 * shared) / (ga.size + gb.size);
  const ok =
    shared >= 3 ||
    (shared >= 2 && dice >= 0.5) ||
    (A.length <= 4 && B.length <= 4 && dice >= 0.6);

  return ok ? dice : 0;
}

/** まとまりの代表になる意見（いちばん「まんなか」にあるもの）を選ぶ */
export function medoidLabel(group) {
  if (group.length <= 1) return group[0] ? group[0].opinion : "";
  let best = group[0];
  let bestScore = -1;
  for (const a of group) {
    let sum = 0;
    for (const b of group) if (a !== b) sum += similarity(a.opinion, b.opinion);
    sum /= group.length - 1;
    if (sum > bestScore || (sum === bestScore && a.created_at < best.created_at)) {
      bestScore = sum;
      best = a;
    }
  }
  return best.opinion;
}

/**
 * 意見の配列をまとまりに分ける。
 * items: [{ opinion, reason, name, email, picture, created_at }, ...]
 */
export function clusterize(items) {
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
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (similarity(items[i].opinion, items[j].opinion) > 0) union(i, j);
    }
  }

  const groups = new Map();
  items.forEach((item, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  });

  return [...groups.values()];
}
