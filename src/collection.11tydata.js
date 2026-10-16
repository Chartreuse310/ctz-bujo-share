export default {
  layout: "base.njk",
  navActive: "index",
  // 分页源含主集子（site.collections 第一项，slug=all → /collection/all/）
  // ⚠️ permalink 不用 col.url（已带前缀，见 entry.11tydata.js 说明），由 slug 现算
  pagination: { data: "site.collections", size: 1, alias: "col" },
  permalink: (data) => `/collection/${data.col.slug}/`,
};
