import { loadContent } from "../../lib/load.js";
import { totals, rankBy, withDelta, trendByDay, trendByMonth, windowRange, inRange } from "../../lib/stats.js";
import { resolveCollection, resolveTag } from "../../lib/taxonomy.js";
import { monthKey } from "../../lib/calendar.js";

/**
 * 全局数据：内容校验 + 统计预计算（设计文档 §3：统计不放在模板里算）。
 * lib/ 抛出的 ContentError 会让 Eleventy 中断构建，不产出 _site（设计文档 §7）。
 *
 * ⚠️ 返回的对象是**模板的唯一接口**。Task 3.x 里模板用到的每个键都必须在这里出现，
 * 否则渲染出来是 `undefined`（Nunjucks 对缺失键不报错，会静默留空）。
 */
export default function () {
  const { taxonomy, entries, dailies, dailyByDate, entriesByDate } = loadContent(process.cwd());

  // ⚠️ 用**本地**日期算「今天」，不要用 toISOString()：后者是 UTC，
  // 在 UTC+8 凌晨（本地 00:00–08:00）会解析成昨天，「今日」页会显示前一天。
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const thisMonth = monthKey(today);
  const thisYear = today.slice(0, 4);

  // 四个可浏览的入口（集子含主集子、tag），登记但未使用的也要生成空态页
  const collections = [
    { name: taxonomy.default_collection_name, slug: "all", url: "/collection/all/", isDefault: true },
    ...taxonomy.collections.map((c) => ({ ...c, url: `/collection/${c.slug}/` })),
  ];
  const tags = taxonomy.tags.map((t) => ({ ...t, url: `/tag/${t.slug}/` }));

  // 日页要覆盖的日期 = 有日总结的 ∪ 有条目的（Task 3.3 的分页源）。
  // 只列日总结会漏掉「有条目但当天没写日总结」的日子。
  const days = [...new Set([...dailies.map((d) => d.date), ...entries.map((e) => e.date)])].sort();

  // 统计页默认窗口 = 本月（设计文档 §10）
  const windows = {};
  for (const kind of ["month", "year", "all"]) {
    const r = windowRange(kind, today);
    const cur = entries.filter((e) => inRange(e.date, r));
    const prev = r.prev ? entries.filter((e) => inRange(e.date, r.prev)) : null;
    const curDailies = dailies.filter((d) => inRange(d.date, r));
    const prevDailies = r.prev ? dailies.filter((d) => inRange(d.date, r.prev)) : null;
    windows[kind] = {
      range: r,
      totals: {
        ...totals(cur, curDailies),
        deltas: prev ? {
          events: withDelta(totals(cur).events, totals(prev).events),
          thoughts: withDelta(totals(cur).thoughts, totals(prev).thoughts),
          highlights: withDelta(totals(cur).highlights, totals(prev).highlights),
        } : null,
      },
      byCollection: rankBy(cur, (e) => [e.collectionName], collections.map((c) => c.name)),
      byTag: rankBy(cur, (e) => e.tags, tags.map((t) => t.name)),
      prevByCollection: prev ? rankBy(prev, (e) => [e.collectionName]) : null,
      prevByTag: prev ? rankBy(prev, (e) => e.tags) : null,
      trend: kind === "month" ? trendByDay(thisMonth, cur)
        : kind === "year" ? trendByMonth(cur, { year: thisYear })
        : trendByMonth(cur),
      dailiesPrev: prevDailies ? prevDailies.length : null,
    };
  }

  // 月视图要生成的月份：内容里出现过的月份 ∪ 本月（用分页逐月生成 /month/<key>/）
  const months = [...new Set([
    ...entries.map((e) => monthKey(e.date)),
    ...dailies.map((d) => monthKey(d.date)),
    thisMonth,
  ])].sort();

  // 统计页三个窗口（Task 3.6 用它做分页源）
  const windowKeys = ["month", "year", "all"];

  return {
    taxonomy, entries, dailies, collections, tags,
    months, days, today, thisMonth, thisYear, windows, windowKeys,
    // 由 load.js 建好、供日页与首页直接取用的索引（Task 3.1 / 3.3 依赖它们）
    dailyByDate, entriesByDate,
  };
}
