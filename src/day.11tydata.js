export default {
  layout: "base.njk",
  navActive: "home",
  // 分页源：已展示月份的全部日期（含无记录日，确保月历链接可达）
  pagination: { data: "site.days", size: 1, alias: "dayDate" },
  permalink: (data) => `/day/${data.dayDate}/`,
};
