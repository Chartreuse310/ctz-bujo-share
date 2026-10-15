import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontMatter } from "../lib/frontmatter.js";

test("切出 front matter 与正文", () => {
  const { data, body } = parseFrontMatter("---\ntitle: 标题\n---\n正文内容\n");
  assert.equal(data.title, "标题");
  assert.equal(body.trim(), "正文内容");
});

test("date 保持字符串，不变成 Date（时区安全）", () => {
  const { data } = parseFrontMatter("---\ndate: 2026-10-14\n---\n");
  assert.equal(typeof data.date, "string");
  assert.equal(data.date, "2026-10-14");
});

test("非法日期保持原样，不被静默滚动成下个月", () => {
  const { data } = parseFrontMatter("---\ndate: 2026-02-30\n---\n");
  assert.equal(data.date, "2026-02-30");
});

test("bool / 数组 / 数字类型正确", () => {
  const { data } = parseFrontMatter("---\nhighlight: true\ntags: [跑步, 播客]\nn: 3\n---\n");
  assert.equal(data.highlight, true);
  assert.deepEqual(data.tags, ["跑步", "播客"]);
  assert.equal(data.n, 3);
});

test("没有 front matter 时 data 为空对象、body 是全文", () => {
  const { data, body } = parseFrontMatter("只有正文\n");
  assert.deepEqual(data, {});
  assert.equal(body, "只有正文\n");
});

test("正文里出现 --- 不被误判为 front matter 结束", () => {
  const { data, body } = parseFrontMatter("---\ntitle: t\n---\n前\n\n---\n\n后\n");
  assert.equal(data.title, "t");
  assert.match(body, /前/);
  assert.match(body, /后/);
});

test("空正文允许", () => {
  const { body } = parseFrontMatter("---\ntitle: 只有标题\n---\n");
  assert.equal(body, "");
});

test("YAML 语法错误时抛 ContentError 且带文件路径", () => {
  assert.throws(
    () => parseFrontMatter("---\n: : bad\n---\n", "content/entries/x.md"),
    (e) => e.name === "ContentError" && /content\/entries\/x\.md/.test(e.message)
  );
});
