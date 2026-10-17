import { daysInMonth, monthKey, shiftMonth } from "./calendar.js";

/** 统计聚合（设计文档 §6）。计数单位是条目，日期归属用 date 字段。 */

export function aggregate(list) {
  let events = 0, thoughts = 0, highlights = 0;
  const days = new Set();
  for (const e of list) {
    if (e.type === "event") events += 1;
    else if (e.type === "thought") thoughts += 1;
    if (e.highlight) highlights += 1;
    days.add(e.date);
  }
  return { events, thoughts, highlights, total: list.length, days: days.size };
}

/** 总量卡片。日总结单独计数，不计入事件/思考（设计文档 §6）。 */
export function totals(entries, dailies = []) {
  return { ...aggregate(entries), dailies: dailies.length };
}

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** 时间窗口：本月 / 本年 / 全部，以及「上期」用于环比。 */
export function windowRange(kind, today) {
  const [y, m] = today.split("-").map(Number);
  if (kind === "month") {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const prevKey = shiftMonth(key, -1);
    const [py, pm] = prevKey.split("-").map(Number);
    return {
      from: `${key}-01`,
      to: `${key}-${String(daysInMonth(key)).padStart(2, "0")}`,
      label: `${y} 年 ${m} 月`,
      prev: {
        from: `${prevKey}-01`,
        to: `${prevKey}-${String(daysInMonth(prevKey)).padStart(2, "0")}`,
      },
    };
  }
  if (kind === "year") {
    return {
      from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} 年`,
      prev: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    };
  }
  return { from: "0000-01-01", to: "9999-12-31", label: "全部", prev: null };
}

export const inRange = (date, r) => date >= r.from && date <= r.to;

/**
 * 按某个维度（集子 / tag）排行。
 * @param {(e:object)=>string[]} keyOf 取该条目所属的多个维度名
 * @param {string[]} [knownNames] 登记但零条目的也要出现（值为 0），并决定同分时的顺序
 *
 * 排序：条目数降序；**同分时按登记表顺序（knownNames 的下标）**，未登记的排在其后。
 * 不要按 name 排序——中文会比码位，得到「书影音」在「绘画」前这种与登记表无关的顺序
 * （实测：knownNames=["绘画","书影音"] 且都为零时，按 name 排会变成书影音在前）。
 */
export function rankBy(entries, keyOf, knownNames = []) {
  const acc = new Map();
  const orderOf = (name) => {
    const i = knownNames.indexOf(name);
    return i === -1 ? knownNames.length : i;
  };
  const bump = (name, e) => {
    const row = acc.get(name) || { name, total: 0, events: 0, thoughts: 0 };
    row.total += 1;
    if (e.type === "event") row.events += 1;
    else if (e.type === "thought") row.thoughts += 1;
    acc.set(name, row);
  };
  for (const name of knownNames) acc.set(name, { name, total: 0, events: 0, thoughts: 0 });
  for (const e of entries) for (const name of keyOf(e) || []) bump(name, e);
  return [...acc.values()].sort(
    (a, b) => b.total - a.total || orderOf(a.name) - orderOf(b.name)
  );
}

/** 与上期相比的条数差值；全部窗口没有上期，不显示比较。 */
export function withDelta(current, previous) {
  if (previous === null || previous === undefined) return { label: null, direction: "none" };
  const diff = current - previous;
  if (diff === 0) return { label: "=", direction: "none" };
  return diff > 0
    ? { label: `▲ +${diff} 条`, direction: "up" }
    : { label: `▼ ${diff} 条`, direction: "down" };
}

/** 按日趋势（本月窗口）。缺日补 0。 */
export function trendByDay(key, entries) {
  const n = daysInMonth(key);
  const pts = [];
  for (let d = 1; d <= n; d++) {
    const date = `${key}-${String(d).padStart(2, "0")}`;
    const day = entries.filter((e) => e.date === date);
    pts.push({
      label: date,
      events: day.filter((e) => e.type === "event").length,
      thoughts: day.filter((e) => e.type === "thought").length,
    });
  }
  return pts;
}

/** 按月趋势。传 year 时补满 12 个月，否则只列出现过的月份。 */
export function trendByMonth(entries, { year } = {}) {
  const months = year
    ? Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`)
    : [...new Set(entries.map((e) => monthKey(e.date)))].sort();
  return months.map((k) => {
    const list = entries.filter((e) => monthKey(e.date) === k);
    return {
      label: k,
      events: list.filter((e) => e.type === "event").length,
      thoughts: list.filter((e) => e.type === "thought").length,
    };
  });
}
