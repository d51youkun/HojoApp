// DELETE /api/account … アカウントを まるごと 消す（先生だけ）
//
// 「止める（Ban）」とは べつの はたらき。
//   Ban       … 入れなくする。あとで 復旧できる。
//   アカウント削除 … なまえ・意見・しつもん・Banの行 を ぜんぶ 消す。もどせない。
//
// 消された 子どもは、つぎから 「なまえ」を 入れなおす ことになる。
// （Cookie は のこるが、kids の行が ないので とうろくずみ では なくなる）

import { json, fail, isAdmin } from "../_lib/auth.js";
import { deleteAccount } from "../_lib/kids.js";

export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) {
    return fail(401, "合言葉を 入れてね", "need_pass");
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return fail(400, "リクエストの かたちが 正しくありません", "bad_request");
  }

  const sid = String(body.sid || "").trim();
  if (!sid) return fail(400, "だれを 消すのか わからなかったよ", "bad_sid");

  const r = await deleteAccount(env, sid);
  if (!r) return fail(404, "その人は もう いなかったよ", "not_found");

  return json({ ok: true, name: r.name, posts: r.posts, asks: r.asks });
}
