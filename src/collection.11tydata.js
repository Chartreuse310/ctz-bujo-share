export default {
  layout: "base.njk",
  // 分页源含主集子（site.collections 第一项，slug=all → /collection/all/）
  pagination: { data: "site.collections", size: 1, alias: "col" },
  permalink: (data) => data.col.url,
};
