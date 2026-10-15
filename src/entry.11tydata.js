export default {
  layout: "base.njk",
  // 分页源是 site.js 校验过的条目数组；slug 已由 lib/ 从文件名派生（含日期前缀）
  pagination: { data: "site.entries", size: 1, alias: "entry" },
  permalink: (data) => data.entry.url,
};
