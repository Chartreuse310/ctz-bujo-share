export default {
  layout: "base.njk",
  navActive: "index",
  // ⚠️ permalink 不用 tg.url（已带前缀，见 entry.11tydata.js 说明），由 slug 现算
  pagination: { data: "site.tags", size: 1, alias: "tg" },
  permalink: (data) => `/tag/${data.tg.slug}/`,
};
