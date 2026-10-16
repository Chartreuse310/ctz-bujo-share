import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent } from "../lib/load.js";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "ctz-"));
  mkdirSync(join(root, "content/entries"), { recursive: true });
  mkdirSync(join(root, "content/daily"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, text, "utf8");
  }
  return root;
}

const TAX = `default_collection_name: 日常
collections:
  - name: 绘画
    slug: drawing
tags:
  - name: 跑步
    slug: running
`;

test("读出条目与日总结，字段归一化", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: 标题\ndate: 2026-10-14\ntags: [跑步]\n---\n正文\n",
    "content/daily/2026-10-14.md": "---\ntitle: 小结\n---\n日总结\n",
  });
  const { taxonomy, entries, dailies } = loadContent(root);
  assert.equal(taxonomy.default_collection_name, "日常");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "标题");
  assert.equal(entries[0].date, "2026-10-14");
  assert.equal(entries[0].body.trim(), "正文");
  assert.equal(dailies.length, 1);
  assert.equal(dailies[0].date, "2026-10-14");
  rmSync(root, { recursive: true, force: true });
});

test("条目之间 slug 冲突时报错", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: A\ndate: 2026-10-14\nslug: same\n---\n",
    "content/entries/2026-10-15-b.md": "---\ntype: event\ntitle: B\ndate: 2026-10-15\nslug: same\n---\n",
  });
  assert.throws(() => loadContent(root), /same/);
  rmSync(root, { recursive: true, force: true });
});

test("空 content/entries 正常返回空数组（设计文档 §7）", () => {
  const root = fixture({ "content/taxonomy.yml": TAX });
  const { entries, dailies } = loadContent(root);
  assert.deepEqual(entries, []);
  assert.deepEqual(dailies, []);
  rmSync(root, { recursive: true, force: true });
});

test("非法条目中断并指出文件", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-bad.md": "---\ntype: 写错了\ntitle: X\ndate: 2026-10-14\n---\n",
  });
  assert.throws(
    () => loadContent(root),
    (e) => e.name === "ContentError" && /2026-10-14-bad\.md/.test(e.message)
  );
  rmSync(root, { recursive: true, force: true });
});

test("taxonomy.yml 缺失时报错而不是静默通过", () => {
  const root = fixture({
    "content/entries/2026-10-14-a.md": "---\ntype: thought\ntitle: A\ndate: 2026-10-14\n---\n",
  });
  assert.throws(() => loadContent(root), /taxonomy/);
  rmSync(root, { recursive: true, force: true });
});

test("条目按日期升序返回，同日保持文件顺序", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-b.md": "---\ntype: event\ntitle: B\ndate: 2026-10-14\n---\n",
    "content/entries/2026-10-14-a.md": "---\ntype: event\ntitle: A\ndate: 2026-10-14\n---\n",
    "content/entries/2026-10-01-c.md": "---\ntype: event\ntitle: C\ndate: 2026-10-01\n---\n",
  });
  const { entries } = loadContent(root);
  assert.deepEqual(entries.map((e) => e.title), ["C", "A", "B"]);
  rmSync(root, { recursive: true, force: true });
});

// —— 同日条目手动排序（设计文档 §4.4，2026-10-16 拍板）——

test("同日内有 order 的条目升序排最前，无 order 的按文件名序跟后（§4.4）", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: event\ntitle: 无order甲\ndate: 2026-10-14\n---\n",
    "content/entries/2026-10-14-b.md": "---\ntype: event\ntitle: order2\ndate: 2026-10-14\norder: 2\n---\n",
    "content/entries/2026-10-14-c.md": "---\ntype: event\ntitle: order1\ndate: 2026-10-14\norder: 1\n---\n",
    "content/entries/2026-10-14-d.md": "---\ntype: event\ntitle: 无order乙\ndate: 2026-10-14\n---\n",
  });
  const { entriesByDate } = loadContent(root);
  const sameDay = entriesByDate["2026-10-14"].map((e) => e.title);
  // 同日内：order1、order2 在前（升序）；无 order 的 a、d 按文件名序跟后
  assert.deepEqual(sameDay, ["order1", "order2", "无order甲", "无order乙"]);
  rmSync(root, { recursive: true, force: true });
});

test("order 只影响同日，不改跨日排序（§4.4）", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-15-a.md": "---\ntype: event\ntitle: 后天order1\ndate: 2026-10-15\norder: 1\n---\n",
    "content/entries/2026-10-14-b.md": "---\ntype: event\ntitle: 前天无order\ndate: 2026-10-14\n---\n",
  });
  const { entries } = loadContent(root);
  assert.deepEqual(entries.map((e) => e.title), ["前天无order", "后天order1"]);
  rmSync(root, { recursive: true, force: true });
});

test("order 相同按文件名序兜底（§4.4）", () => {
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-b.md": "---\ntype: event\ntitle: 同order乙\ndate: 2026-10-14\norder: 1\n---\n",
    "content/entries/2026-10-14-a.md": "---\ntype: event\ntitle: 同order甲\ndate: 2026-10-14\norder: 1\n---\n",
  });
  const { entries } = loadContent(root);
  assert.deepEqual(entries.map((e) => e.title), ["同order甲", "同order乙"]);
  rmSync(root, { recursive: true, force: true });
});

test("order 非整数中断构建并指出字段（§4.4 + §7）", () => {
  for (const bad of ["\"2\"", "2.5", "true", "零"]) {
    const root = fixture({
      "content/taxonomy.yml": TAX,
      "content/entries/2026-10-14-a.md": `---\ntype: event\ntitle: X\ndate: 2026-10-14\norder: ${bad}\n---\n`,
    });
    assert.throws(
      () => loadContent(root),
      (e) => e.name === "ContentError" && /order/.test(e.message),
      `order: ${bad} 应报错`
    );
    rmSync(root, { recursive: true, force: true });
  }
});

test("order 是已知字段，不触发未知字段警告（§4.4）", () => {
  const warnings = [];
  const root = fixture({
    "content/taxonomy.yml": TAX,
    "content/entries/2026-10-14-a.md": "---\ntype: event\ntitle: X\ndate: 2026-10-14\norder: 1\n---\n",
  });
  loadContent(root, { warn: (m) => warnings.push(m) });
  assert.deepEqual(warnings, []);
  rmSync(root, { recursive: true, force: true });
});
