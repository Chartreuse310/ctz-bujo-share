import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, totals, rankBy, trendByDay, trendByMonth, windowRange, withDelta } from "../lib/stats.js";

const E = (date, type, extra = {}) => ({ date, type, highlight: false, tags: [], collectionName: "日常", ...extra });

const ENTRIES = [
  E("2026-10-01", "event",   { highlight: true,  collectionName: "绘画", tags: ["跑步"] }),
  E("2026-10-02", "thought", { collectionName: "绘画", tags: ["跑步", "播客"] }),
  E("2026-10-03", "event",   { collectionName: "博士学位论文", tags: [] }),
  E("2026-09-10", "event",   { collectionName: "绘画", tags: [] }),
];
const DAILIES = [{ date: "2026-10-01" }, { date: "2026-10-02" }];

test("aggregate：事件/思考/重点/有记录天数", () => {
  const a = aggregate(ENTRIES);
  // 夹具里有 3 个 event（10-01 / 10-03 / 09-10）、1 个 thought（10-02）；
  // days 是**去重后的日期数**，不是条目数——10-01 与 10-02 各一条，10-03、09-10 各一条，共 4 天。
  assert.equal(a.events, 3);
  assert.equal(a.thoughts, 1);
  assert.equal(a.highlights, 1);
  assert.equal(a.total, 4);
  assert.equal(a.days, 4);
});

test("aggregate：重点条目仍计入事件/思考总数（设计文档 §6 口径）", () => {
  const a = aggregate([E("2026-10-01", "event", { highlight: true })]);
  assert.equal(a.events, 1);
  assert.equal(a.highlights, 1);
});

test("aggregate：空数组不崩", () => {
  const a = aggregate([]);
  assert.deepEqual(
    { e: a.events, t: a.thoughts, h: a.highlights, d: a.days },
    { e: 0, t: 0, h: 0, d: 0 }
  );
});

test("totals：日总结单独计数，不计入事件/思考（设计文档 §6）", () => {
  const t = totals(ENTRIES, DAILIES);
  // 与 aggregate 同一夹具：3 event / 1 thought（见上一条测试的说明）
  assert.equal(t.events, 3);
  assert.equal(t.thoughts, 1);
  assert.equal(t.dailies, 2);
  assert.equal(t.highlights, 1);
  assert.equal(t.total, 4);
});

test("windowRange：month / year / all 与上期区间", () => {
  assert.deepEqual(windowRange("month", "2026-10-14"), {
    from: "2026-10-01", to: "2026-10-31", label: "2026 年 10 月",
    prev: { from: "2026-09-01", to: "2026-09-30" },
  });
  const y = windowRange("year", "2026-10-14");
  assert.equal(y.from, "2026-01-01");
  assert.equal(y.to, "2026-12-31");
  assert.deepEqual(y.prev, { from: "2025-01-01", to: "2025-12-31" });
  const all = windowRange("all", "2026-10-14");
  assert.equal(all.prev, null);
});

test("windowRange：1 月的上期是去年 12 月（跨年边界）", () => {
  const r = windowRange("month", "2026-01-15");
  assert.deepEqual(r.prev, { from: "2025-12-01", to: "2025-12-31" });
});

test("month 窗口的 to 用该月真实天数（闰年 2 月）", () => {
  assert.equal(windowRange("month", "2024-02-10").to, "2024-02-29");
  assert.equal(windowRange("month", "2026-02-10").to, "2026-02-28");
});

test("rankBy：按集子聚合，事件/思考分开，降序", () => {
  const rows = rankBy(ENTRIES, (e) => [e.collectionName]);
  assert.equal(rows[0].name, "绘画");
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].events, 2);
  assert.equal(rows[0].thoughts, 1);
  assert.equal(rows[1].name, "博士学位论文");
  assert.equal(rows[1].total, 1);
});

test("rankBy：按 tag 聚合，一条可计入多个 tag", () => {
  const rows = rankBy(ENTRIES, (e) => e.tags);
  const music = rows.find((r) => r.name === "播客");
  assert.equal(music.total, 1);
  const run = rows.find((r) => r.name === "跑步");
  assert.equal(run.total, 2);
});

test("rankBy：登记但零条目的也保留（值为 0）", () => {
  const rows = rankBy([], (e) => [e.collectionName], ["绘画", "书影音"]);
  assert.deepEqual(rows.map((r) => [r.name, r.total]), [["绘画", 0], ["书影音", 0]]);
});

test("withDelta：上期为 0 显示「新增」，不是 +∞%", () => {
  assert.equal(withDelta(5, 0).label, "新增");
  assert.equal(withDelta(5, 0).direction, "up");
});

test("withDelta：持平 / 上升百分比 / 下降百分比", () => {
  assert.equal(withDelta(5, 5).label, "=");
  assert.equal(withDelta(6, 4).label, "↑ 50%");
  assert.equal(withDelta(2, 4).label, "↓ 50%");
});

test("withDelta：无上期时返回 null 标签", () => {
  assert.equal(withDelta(5, null).label, null);
});

test("trendByDay：按日两条序列，缺日补 0", () => {
  const pts = trendByDay("2026-10", ENTRIES);
  assert.equal(pts.length, 31);
  assert.deepEqual(pts[0], { label: "2026-10-01", events: 1, thoughts: 0 });
  assert.deepEqual(pts[2], { label: "2026-10-03", events: 1, thoughts: 0 });
  assert.deepEqual(pts[1], { label: "2026-10-02", events: 0, thoughts: 1 });
});

test("trendByMonth：按月两条序列", () => {
  const pts = trendByMonth(ENTRIES);
  const oct = pts.find((p) => p.label === "2026-10");
  const sep = pts.find((p) => p.label === "2026-09");
  assert.equal(oct.events, 2);
  assert.equal(oct.thoughts, 1);
  assert.equal(sep.events, 1);
});

test("trendByMonth：本年模式补满 12 个月", () => {
  const pts = trendByMonth(ENTRIES, { year: "2026" });
  assert.equal(pts.length, 12);
  assert.equal(pts[0].label, "2026-01");
  assert.equal(pts[11].label, "2026-12");
  assert.equal(pts[0].events, 0);
});
