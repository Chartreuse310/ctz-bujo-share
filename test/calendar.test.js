import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysInMonth, firstWeekday, monthKey, shiftMonth, weekdaysOf,
  buildMonthGrid, buildMonthList, dayOfYear, weekdayName, monthFacts,
} from "../lib/calendar.js";

test("daysInMonth：普通月 / 闰年 2 月 / 平年 2 月", () => {
  assert.equal(daysInMonth("2026-10"), 31);
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2024-02"), 29);
  assert.equal(daysInMonth("2026-04"), 30);
});

test("firstWeekday 以周一为 0（设计文档 §10 默认值）", () => {
  // 2026-10-01 是周四 → 偏移 3
  assert.equal(firstWeekday("2026-10"), 3);
  // 2026-11-01 是周日 → 偏移 6
  assert.equal(firstWeekday("2026-11"), 6);
  // 2026-06-01 是周一 → 偏移 0
  assert.equal(firstWeekday("2026-06"), 0);
});

test("weekdaysOf 周一到周日", () => {
  assert.deepEqual(weekdaysOf(), ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]);
});

test("weekdayName 正确", () => {
  assert.equal(weekdayName("2026-10-14"), "周三");
  assert.equal(weekdayName("2026-10-18"), "周日");
});

test("shiftMonth 跨年", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("monthKey / dayOfYear", () => {
  assert.equal(monthKey("2026-10-14"), "2026-10");
  assert.equal(dayOfYear("2026-01-01"), 1);
  assert.equal(dayOfYear("2026-12-31"), 365);
  assert.equal(dayOfYear("2024-12-31"), 366);
});

test("buildMonthGrid：格数 = 7 的整数倍，含前后空白格", () => {
  const g = buildMonthGrid("2026-10", []);
  assert.equal(g.rows, 5);
  assert.equal(g.cells.length, 35);
  assert.equal(g.cells[0].blank, true);       // 周一/周二空白
  assert.equal(g.cells[3].date, "2026-10-01");
  assert.equal(g.cells[34].blank, true);
});

test("buildMonthGrid：6 行月（2026-08：周六起始 → 偏移 5，5+31=36 格 → 补齐 42）", () => {
  const g = buildMonthGrid("2026-08", []);
  assert.equal(g.rows, 6);
  assert.equal(g.cells.length, 42);
});

test("buildMonthGrid：格子只统计重点条目的数量与标题；红/黑点按 hasHighlight", () => {
  const entries = [
    { date: "2026-10-03", type: "event",   highlight: true,  title: "重点一" },
    { date: "2026-10-03", type: "thought", highlight: true,  title: "重点二" },
    { date: "2026-10-03", type: "event",   highlight: false, title: "非重点" },
    { date: "2026-10-08", type: "thought", highlight: true,  title: "重点三" },
  ];
  const g = buildMonthGrid("2026-10", entries);
  const c3 = g.cells.find((c) => c.date === "2026-10-03");
  assert.equal(c3.highlightCount, 2);
  assert.equal(c3.captions[0], "重点一");
  assert.equal(c3.hasHighlight, true);        // 红点（含重点）
  // 「当日条目数」用全部条目（含非重点），与 demo 口径一致
  assert.equal(c3.entryCount, 3);

  const c8 = g.cells.find((c) => c.date === "2026-10-08");
  assert.equal(c8.highlightCount, 1);
  assert.equal(c8.hasHighlight, true);
});

test("buildMonthGrid：无重点的日子黑点（hasHighlight=false）但保留 entryCount", () => {
  const g = buildMonthGrid("2026-10", [
    { date: "2026-10-05", type: "event", highlight: false, title: "x" },
  ]);
  const c = g.cells.find((x) => x.date === "2026-10-05");
  assert.equal(c.highlightCount, 0);
  assert.equal(c.hasHighlight, false);       // 黑点：当日只有普通条目
  assert.equal(c.entryCount, 1);
});

test("buildMonthGrid：标记 today", () => {
  const g = buildMonthGrid("2026-10", [], "2026-10-14");
  assert.equal(g.cells.find((c) => c.date === "2026-10-14").isToday, true);
  assert.equal(g.cells.find((c) => c.date === "2026-10-13").isToday, false);
});

test("buildMonthGrid：每格 dots 数组 = 当日每条条目一枚圆点（重点红/普通黑，2026-10-16 拍板）", () => {
  const entries = [
    { date: "2026-10-03", type: "event",   highlight: true,  title: "重点一" },
    { date: "2026-10-03", type: "thought", highlight: false, title: "普通一" },
    { date: "2026-10-03", type: "event",   highlight: true,  title: "重点二" },
    { date: "2026-10-08", type: "thought", highlight: false, title: "普通二" },
  ];
  const g = buildMonthGrid("2026-10", entries);
  const c3 = g.cells.find((c) => c.date === "2026-10-03");
  assert.deepEqual(c3.dots, ["red", "black", "red"]);   // 与当日条目同序，重点=红
  const c8 = g.cells.find((c) => c.date === "2026-10-08");
  assert.deepEqual(c8.dots, ["black"]);
  // 无条目日 dots 为空数组（不是 undefined）
  assert.deepEqual(g.cells.find((c) => c.date === "2026-10-01").dots, []);
});

test("buildMonthList：只含日总结，按日期倒序（设计文档 §5.2）", () => {
  const dailies = [
    { date: "2026-10-01", title: "一号" },
    { date: "2026-10-20", title: "二十号" },
  ];
  const list = buildMonthList("2026-10", dailies, []);
  assert.deepEqual(list.map((r) => r.date), ["2026-10-20", "2026-10-01"]);
  assert.equal(list[0].title, "二十号");
});

test("buildMonthList：不含其它月，且不带 highlight 标记字段之外的条目数", () => {
  const dailies = [{ date: "2026-09-30", title: "上月" }, { date: "2026-10-02", title: "本月" }];
  const list = buildMonthList("2026-10", dailies, []);
  assert.deepEqual(list.map((r) => r.date), ["2026-10-02"]);
});

test("buildMonthList：附上当日重点数（demo 的 ★N）", () => {
  const list = buildMonthList("2026-10",
    [{ date: "2026-10-02", title: "t" }],
    [{ date: "2026-10-02", highlight: true }, { date: "2026-10-02", highlight: false }]);
  assert.equal(list[0].highlightCount, 1);
});

test("月视图 facts：条目/重点/日总结/有记录天数", () => {
  const f = monthFacts("2026-10",
    [{ date: "2026-10-01", type: "event", highlight: true },
     { date: "2026-10-01", type: "thought", highlight: false },
     { date: "2026-10-05", type: "event", highlight: false }],
    [{ date: "2026-10-01" }, { date: "2026-10-05" }]);
  assert.equal(f.entries, 3);
  assert.equal(f.highlights, 1);
  assert.equal(f.dailies, 2);
  assert.equal(f.daysWithRecords, "2 / 31");
});
