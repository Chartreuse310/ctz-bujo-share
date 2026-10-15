import { test } from "node:test";
import assert from "node:assert/strict";
import { fail, ContentError } from "../lib/schema.js";

test("fail 抛 ContentError，消息含文件、字段、实际值、期望值", () => {
  const err = (() => {
    try { fail("content/entries/a.md", "type", "thougt", "event 或 thought"); }
    catch (e) { return e; }
  })();
  assert.ok(err instanceof ContentError);
  assert.match(err.message, /content\/entries\/a\.md/);
  assert.match(err.message, /type/);
  assert.match(err.message, /thougt/);
  assert.match(err.message, /event 或 thought/);
});

test("实际值是对象时用 JSON 打印，不抛二次异常", () => {
  const err = (() => {
    try { fail("a.md", "tags", ["x", "y"], "字符串数组"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /\["x","y"\]/);
});

test("实际值是 undefined 时也能打印", () => {
  const err = (() => {
    try { fail("a.md", "title", undefined, "非空字符串"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /undefined/);
});

import { validateEntry } from "../lib/schema.js";

const TAX = {
  default_collection_name: "日常",
  collections: [{ name: "绘画", slug: "drawing" }],
  tags: [{ name: "跑步", slug: "running" }],
};

const base = {
  type: "thought",
  title: "标题",
  date: "2026-10-14",
  body: "正文",
};

test("合法条目通过并补齐默认值", () => {
  const r = validateEntry(base, "content/entries/2026-10-14-a.md", TAX, "2026-10-14-a.md");
  assert.equal(r.highlight, false);
  assert.deepEqual(r.tags, []);
  assert.equal(r.collectionName, "日常");
  assert.equal(r.slug, "2026-10-14-a");
  assert.equal(r.url, "/entry/2026-10-14-a/");
});

test("slug 含日期前缀，来自文件名", () => {
  const r = validateEntry(base, "f", TAX, "2026-10-14-read-a-book.md");
  assert.equal(r.url, "/entry/2026-10-14-read-a-book/");
});

test("front matter 显式 slug 覆盖文件名", () => {
  const r = validateEntry({ ...base, slug: "custom-slug" }, "f", TAX, "2026-10-14-x.md");
  assert.equal(r.url, "/entry/custom-slug/");
});

test("type 拼错即报错且消息含文件路径", () => {
  assert.throws(
    () => validateEntry({ ...base, type: "thougt" }, "content/entries/bad.md", TAX, "bad.md"),
    (e) => e.name === "ContentError" && /content\/entries\/bad\.md/.test(e.message) && /event 或 thought/.test(e.message)
  );
});

test("title 缺失或空报错", () => {
  assert.throws(() => validateEntry({ ...base, title: "" }, "f", TAX, "f.md"), /title/);
  assert.throws(() => validateEntry({ ...base, title: undefined }, "f", TAX, "f.md"), /title/);
});

test("date 不存在（2026-02-30）报错", () => {
  assert.throws(
    () => validateEntry({ ...base, date: "2026-02-30" }, "f", TAX, "f.md"),
    /date/
  );
});

test("date 格式不合法报错", () => {
  for (const d of ["2026-2-3", "2026/10/14", "not-a-date", "2026-13-01"]) {
    assert.throws(() => validateEntry({ ...base, date: d }, "f", TAX, "f.md"), /date/, `应拒绝 ${d}`);
  }
});

test("未来日期允许（设计文档 §7 明确）", () => {
  const r = validateEntry({ ...base, date: "2099-01-01" }, "f", TAX, "f.md");
  assert.equal(r.date, "2099-01-01");
});

test("highlight 非布尔报错", () => {
  assert.throws(() => validateEntry({ ...base, highlight: "yes" }, "f", TAX, "f.md"), /highlight/);
});

test("collection 引用未登记集子报错，并列出可选项", () => {
  assert.throws(
    () => validateEntry({ ...base, collection: "不存在" }, "f", TAX, "f.md"),
    (e) => /不存在/.test(e.message) && /绘画/.test(e.message)
  );
});

test("tags 引用未登记 tag 报错，并列出可选项", () => {
  assert.throws(
    () => validateEntry({ ...base, tags: ["跑步", "未登记"] }, "f", TAX, "f.md"),
    (e) => /未登记/.test(e.message) && /跑步/.test(e.message)
  );
});

test("tags 不是数组报错；元素空字符串报错", () => {
  assert.throws(() => validateEntry({ ...base, tags: "跑步" }, "f", TAX, "f.md"), /tags/);
  assert.throws(() => validateEntry({ ...base, tags: [""] }, "f", TAX, "f.md"), /tags/);
});

test("collection 非字符串报错", () => {
  assert.throws(() => validateEntry({ ...base, collection: 123 }, "f", TAX, "f.md"), /collection/);
});

test("未知字段只警告不中断", () => {
  const warns = [];
  const r = validateEntry({ ...base, titel: "拼错" }, "f", TAX, "f.md", (m) => warns.push(m));
  assert.equal(r.title, "标题");
  assert.equal(warns.length, 1);
  assert.match(warns[0], /titel/);
});

test("正文允许为空", () => {
  const r = validateEntry({ ...base, body: "" }, "f", TAX, "f.md");
  assert.equal(r.body, "");
});
