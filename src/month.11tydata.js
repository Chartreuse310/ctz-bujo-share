export default {
  layout: "base.njk",
  navActive: "month",
  // 分页源是 site.js 预计算出的月份列表（内容出现过的月份 ∪ 本月），
  // 不要用条目数组——那会按月内条目数生成重复页面。
  pagination: { data: "site.months", size: 1, alias: "monthKey" },
  permalink: (data) => `/month/${data.monthKey}/`,
};
