export default {
  layout: "base.njk",
  // 分页源是 site.js 校验过的条目数组；slug 已由 lib/ 从文件名派生（含日期前缀）
  // ⚠️ permalink 故意**不**用 entry.url——那个字段已带子路径前缀（页面内引用用），
  //    permalink 带前缀会让产物落进 _site/ctz-bujo-share/ 嵌套目录（实测）。
  //    GitHub Pages 项目站请求 /repo/path/ 时 Pages 自动去掉仓库名查发布根，产物平铺即可。
  pagination: { data: "site.entries", size: 1, alias: "entry" },
  permalink: (data) => `/entry/${data.entry.slug}/`,
};
