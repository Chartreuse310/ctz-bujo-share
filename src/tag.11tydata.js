export default {
  layout: "base.njk",
  pagination: { data: "site.tags", size: 1, alias: "tg" },
  permalink: (data) => data.tg.url,
};
