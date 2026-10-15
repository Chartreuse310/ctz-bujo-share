/** 月历与月列表计算（设计文档 §5.2）。纯函数，不依赖 Eleventy。 */

const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
export const WEEKDAYS_MON_FIRST = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const pad = (n) => String(n).padStart(2, "0");
const parse = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const monthKey = (s) => String(s).slice(0, 7);
export const daysInMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** 周一 = 0（设计文档 §10：周起始日 = 周一）。 */
export const firstWeekday = (key) => {
  const [y, m] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
};
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const weekdayName = (s) => WD[parse(s).getUTCDay()];
export const weekdaysOf = () => [...WEEKDAYS_MON_FIRST];
export const dayOfYear = (s) => {
  const d = parse(s);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.round((d.getTime() - start) / 86400000) + 1;
};

/**
 * 月历网格。每格记录「该日重点」相关信息：数量、标题、以及该日是红点还是黑点。
 *
 * ⚠️ 点颜色语义（2026-10-14 拍板，设计文档 §5.2）：**红点 = 当日含重点条目，
 * 黑点 = 当日只有普通条目**——取代 demo 的「黑=事件、红=思考」，不再区分类型。
 * `entryCount` 用全部条目（供「该日有记录」这类判断），两者口径不同，不要混。
 */
export function buildMonthGrid(key, entries = [], today = null) {
  const byDate = new Map();
  for (const e of entries) {
    if (monthKey(e.date) !== key) continue;
    const cell = byDate.get(e.date) || { entryCount: 0, hasHighlight: false, highlights: [] };
    cell.entryCount += 1;                 // 全部条目
    if (e.highlight) {                    // 红点 = 当日含重点；黑点由模板按 hasHighlight=false 画
      cell.hasHighlight = true;
      cell.highlights.push(e);
    }
    byDate.set(e.date, cell);
  }

  const off = firstWeekday(key);
  const n = daysInMonth(key);
  const total = off + n;
  const rows = Math.ceil(total / 7);
  const cells = [];

  for (let i = 0; i < off; i++) cells.push({ blank: true });
  for (let d = 1; d <= n; d++) {
    const date = `${key}-${pad(d)}`;
    const info = byDate.get(date);
    cells.push({
      blank: false,
      date,
      day: d,
      isToday: date === today,
      entryCount: info ? info.entryCount : 0,
      highlightCount: info ? info.highlights.length : 0,
      hasHighlight: Boolean(info && info.hasHighlight),   // 红点/黑点
      captions: info ? info.highlights.map((e) => e.title) : [],
    });
  }
  while (cells.length % 7 !== 0) cells.push({ blank: true });

  return { key, rows, cells };
}

/** 右栏当月列表：只含日总结，倒序（设计文档 §5.2）。 */
export function buildMonthList(key, dailies = [], entries = []) {
  return dailies
    .filter((d) => monthKey(d.date) === key)
    .map((d) => ({
      ...d,
      weekday: weekdayName(d.date),
      highlightCount: entries.filter((e) => e.date === d.date && e.highlight).length,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 月视图顶部的事实条。 */
export function monthFacts(key, entries = [], dailies = []) {
  const es = entries.filter((e) => monthKey(e.date) === key);
  const ds = dailies.filter((d) => monthKey(d.date) === key);
  const days = new Set(es.map((e) => e.date));
  for (const d of ds) days.add(d.date);
  return {
    entries: es.length,
    highlights: es.filter((e) => e.highlight).length,
    dailies: ds.length,
    daysWithRecords: `${days.size} / ${daysInMonth(key)}`,
  };
}
