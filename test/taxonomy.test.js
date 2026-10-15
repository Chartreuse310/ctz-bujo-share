import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTaxonomy, resolveCollection, resolveTag, suggestName } from "../lib/taxonomy.js";

const ok = {
  default_collection_name: "日常",
  collections: [{ name: "绘画", slug: "drawing" }],
  tags: [{ name: "跑步", slug: "running" }],
};

test("合法登记表通过", () => {
  const t = validateTaxonomy(ok, "content/taxonomy.yml");
  assert.equal(t.collections[0].name, "绘画");
});

test("缺 default_collection_name 时默认「日常」", () => {
  const t = validateTaxonomy({ collections: [], tags: [] }, "f");
  assert.equal(t.default_collection_name, "日常");
});

test("slug 格式不合格报错", () => {
  for (const bad of ["Drawing", "draw ing", "draw_ing", "-drawing", "drawing-", "绘画"]) {
    assert.throws(
      () => validateTaxonomy({ ...ok, collections: [{ name: "绘画", slug: bad }] }, "f"),
      (e) => e.name === "ContentError" && /slug/.test(e.message),
      `应拒绝 slug=${bad}`
    );
  }
});

test("集子之间 slug 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, collections: [{ name: "A", slug: "x" }, { name: "B", slug: "x" }] }, "f"),
    /重复|唯一/
  );
});

test("tag 之间 slug 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, tags: [{ name: "A", slug: "x" }, { name: "B", slug: "x" }] }, "f"),
    /重复|唯一/
  );
});

test("集子与 tag 可以同名同 slug（URL 前缀不同）", () => {
  const t = validateTaxonomy({
    collections: [{ name: "跑步", slug: "running" }],
    tags: [{ name: "跑步", slug: "running" }],
  }, "f");
  assert.equal(t.collections[0].slug, t.tags[0].slug);
});

test("同一类里 name 重复报错", () => {
  assert.throws(
    () => validateTaxonomy({ ...ok, collections: [{ name: "A", slug: "a" }, { name: "A", slug: "b" }] }, "f"),
    /name/
  );
});

test("name 为空报错", () => {
  assert.throws(() => validateTaxonomy({ ...ok, tags: [{ name: "", slug: "a" }] }, "f"), /name/);
});

test("登记但未使用是允许的（校验器不做使用率检查）", () => {
  const t = validateTaxonomy({ ...ok, tags: [{ name: "没人用", slug: "nobody" }] }, "f");
  assert.equal(t.tags.length, 1);
});

test("集子 display name 与主集子同名 → 登记表校验报错（避免 /collection/all/ 被遮蔽）", () => {
  // 主集子不占 slug、URL 固定 /collection/all/。若允许再登记一个同名集子，
  // 条目写 `collection: 日常` 就产生歧义，且那个集子的页永远拿不到流量（被静默遮蔽）。
  // 这里选择在**登记表**层面直接拒绝，而不是在 resolveCollection 里默默让主集子优先。
  assert.throws(
    () => validateTaxonomy({
      default_collection_name: "日常",
      collections: [{ name: "日常", slug: "daily-log" }],
      tags: [],
    }, "f"),
    (e) => e.name === "ContentError" && /日常/.test(e.message) && /主集子|default_collection_name/.test(e.message)
  );
});

test("resolveCollection：主集子固定 /collection/all/，已登记集子走自己的 slug", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(resolveCollection(t, "日常").url, "/collection/all/");
  assert.equal(resolveCollection(t, "日常").isDefault, true);
  assert.equal(resolveCollection(t, "绘画").url, "/collection/drawing/");
  assert.equal(resolveCollection(t, "绘画").isDefault, false);
});

test("resolveTag 输出 /tag/<slug>/", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(resolveTag(t, "跑步").url, "/tag/running/");
});

// ---------- D5：近似匹配（设计文档 §7「大小写或空格不精确匹配→报错并提示最接近的已登记名称」） ----------

test("suggestName：仅差空白/全半角/大小写 → close（§7：构建期报错并提示正名，归一是录入层职责）", () => {
  const t = validateTaxonomy({
    default_collection_name: "日常",
    collections: [{ name: "绘画", slug: "drawing" }],
    tags: [
      { name: "跑步", slug: "running" },
      { name: "PhD V2.0 P1.1", slug: "phd-v2-0-p1-1" },
    ],
  }, "f");
  assert.equal(suggestName(t, "tag", "跑步 ").status, "close");          // 尾随空白
  assert.equal(suggestName(t, "tag", "phd v2.0 p1.1").status, "close"); // 大小写
  assert.equal(suggestName(t, "tag", "ＰＨＤ Ｖ2.0 P1.1").status, "close"); // 全角字母
  assert.equal(suggestName(t, "collection", "绘画").status, "exact");
  assert.equal(suggestName(t, "tag", "PhDV2.0P1.1").status, "close");   // 仅差空白
  assert.equal(suggestName(t, "tag", "PhD V3.0 P1.1").status, "none");  // 语义不同不容混
  assert.equal(suggestName(t, "tag", "跑步").match, "跑步");             // exact 带回正名
});

test("suggestName：完全等价但登记表里没有 → none", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(suggestName(t, "tag", "游泳").status, "none");
  assert.equal(suggestName(t, "collection", "游泳").status, "none");
});

test("suggestName：主集子名走 exact（不填 collection 归主集子是合法默认）", () => {
  const t = validateTaxonomy(ok, "f");
  assert.equal(suggestName(t, "collection", "日常").status, "exact");
});
