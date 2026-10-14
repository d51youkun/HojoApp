// まる意見：先生の「どうする？」（しつもん・Ban）の ほんものの ばしょ
//
// ・asks … 先生が 出した しつもん（理由をきく／詳しくお願いする）と、子どもの こたえ
// ・bans … 止めた（Banした）人。復旧すると この行を けす。
//
// どちらも 出せるのは 先生だけ（合言葉の Cookie が いる）。
// 子どもは 自分の ぶんしか 見られない。

import { cleanText } from "./auth.js";

export const ASK_KINDS = ["reason", "detail"];

// 先生が ことばを 入れなかった ときに つかう 文
export const DEFAULT_TEXT = {
  reason: "なぜ そう 思ったのか、理由を もういちど 教えてね。",
  detail: "もっと 詳しく 教えてね。どんな ことが あった？ どう 思った？",
};

export const LABEL = { reason: "理由を きく", detail: "詳しく お願いする" };

const MAX_ASK = 120;
const MAX_ANSWER = 200;
const MAX_BAN_REASON = 60;

/* ================= Ban ================= */

export async function listBans(env) {
  const { results } = await env.DB.prepare(
    "SELECT sid, name, reason, created_at FROM bans ORDER BY created_at DESC"
  ).all();
  return results || [];
}

/** その sid は 止められているか。止められていれば その行、いなければ null。 */
export async function findBan(env, sid) {
  if (!sid) return null;
  const row = await env.DB.prepare(
    "SELECT sid, name, reason, created_at FROM bans WHERE sid = ?1"
  )
    .bind(sid)
    .first();
  return row || null;
}

export async function isBanned(env, sid) {
  return !!(await findBan(env, sid));
}

/**
 * おなじ なまえで 入りなおそうと していないか。
 * 止めた人が 「reset」で 新しい Cookie を とっても、
 * おなじ なまえでは 入れない ようにする ための 見はり。
 */
export async function findBanByName(env, name) {
  const n = String(name || "").trim();
  if (!n) return null;
  const row = await env.DB.prepare("SELECT sid, name FROM bans WHERE name = ?1 LIMIT 1")
    .bind(n)
    .first();
  return row || null;
}

export async function banKid(env, sid, name, reason) {
  await env.DB.prepare(
    "INSERT INTO bans (sid, name, reason, created_at) VALUES (?1, ?2, ?3, datetime('now')) " +
      "ON CONFLICT(sid) DO UPDATE SET name = ?2, reason = ?3, created_at = datetime('now')"
  )
    .bind(sid, name, cleanText(reason, MAX_BAN_REASON))
    .run();
}

/** 復旧（もどす）。けした かずを かえす。 */
export async function unbanKid(env, sid) {
  const row = await env.DB.prepare("SELECT name FROM bans WHERE sid = ?1").bind(sid).first();
  if (!row) return null;
  await env.DB.prepare("DELETE FROM bans WHERE sid = ?1").bind(sid).run();
  return row.name;
}

/* ================= しつもん ================= */

export async function createAsk(env, sid, name, kind, text, submissionId) {
  const k = ASK_KINDS.indexOf(String(kind)) >= 0 ? String(kind) : "reason";
  const t = cleanText(text, MAX_ASK) || DEFAULT_TEXT[k];
  const sidInt =
    submissionId === undefined || submissionId === null || !Number.isInteger(Number(submissionId))
      ? null
      : Number(submissionId);
  await env.DB.prepare(
    "INSERT INTO asks (sid, name, kind, text, submission_id, created_at, answered, answer) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), 0, '')"
  )
    .bind(sid, name, k, t, sidInt)
    .run();
  return { kind: k, text: t };
}

/** 子ども用：まだ こたえていない しつもんだけ。 */
export async function listOpenAsksFor(env, sid) {
  const { results } = await env.DB.prepare(
    "SELECT a.id, a.kind, a.text, a.created_at, " +
      "       (SELECT s.opinion FROM submissions s WHERE s.id = a.submission_id) AS opinion " +
      "FROM asks a WHERE a.sid = ?1 AND a.answered = 0 ORDER BY a.id ASC"
  )
    .bind(sid)
    .all();
  return results || [];
}

/** 先生用：ぜんぶの しつもんと こたえ。 */
export async function listAllAsks(env, limit = 300) {
  const { results } = await env.DB.prepare(
    "SELECT id, sid, name, kind, text, submission_id, created_at, answered, answer, answered_at " +
      "FROM asks ORDER BY id DESC LIMIT ?1"
  )
    .bind(limit)
    .all();
  return results || [];
}

/** 子どもが こたえる。自分の しつもんしか こたえられない。 */
export async function answerAsk(env, sid, id, answer) {
  const a = cleanText(answer, MAX_ANSWER);
  if (!a) return { ok: false, code: "empty_answer" };

  const row = await env.DB.prepare("SELECT id, sid, answered FROM asks WHERE id = ?1")
    .bind(id)
    .first();
  if (!row) return { ok: false, code: "not_found" };
  if (String(row.sid) !== String(sid)) return { ok: false, code: "not_yours" };

  await env.DB.prepare(
    "UPDATE asks SET answer = ?2, answered = 1, answered_at = datetime('now') WHERE id = ?1"
  )
    .bind(id, a)
    .run();
  return { ok: true };
}
