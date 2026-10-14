// まる意見：アプリの せってい（見出しの ことば）
//
// いまは 「〇〇の 歴史」の 〇〇 だけ。管理者画面から かえられる。

const KEY = "history_theme";
const DEFAULT_THEME = "館山";

export async function getTheme(env) {
  const row = await env.DB.prepare("SELECT v FROM settings WHERE k = ?1").bind(KEY).first();
  const v = row && row.v ? String(row.v).trim() : "";
  return v || DEFAULT_THEME;
}

export async function setTheme(env, text) {
  const v = String(text || "").trim().slice(0, 20);
  if (!v) return null;
  await env.DB.prepare(
    "INSERT INTO settings (k, v, updated_at) VALUES (?1, ?2, datetime('now')) " +
      "ON CONFLICT(k) DO UPDATE SET v = ?2, updated_at = datetime('now')"
  )
    .bind(KEY, v)
    .run();
  return v;
}

export { DEFAULT_THEME };
