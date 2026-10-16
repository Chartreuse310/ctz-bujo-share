export default {
  layout: "base.njk",
  navActive: "home",
  // 分页源：有日总结的日期 ∪ 有条目的日期（Task 2.3 预计算，缺一会漏页）
  pagination: { data: "site.days", size: 1, alias: "dayDate" },
  permalink: (data) => `/day/${data.dayDate}/`,
};
