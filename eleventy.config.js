import { homeText } from "./lib/home.js";
import { RenderPlugin } from "@11ty/eleventy";
import { withDelta } from "./lib/stats.js";
import * as calendar from "./lib/calendar.js";

export default function (eleventyConfig) {
  // 子路径部署前缀（2026-10-16 线上实证缺陷修复）：GitHub Pages 项目站部署在
  // /ctz-bujo-share/ 下，资源与内部链接若写根绝对路径 /assets/... 会 404（页面裸文字）。
  // 全站内部 URL 统一 {{ base }} 开头；默认 = 生产值，CTZ_BASE_URL="" 可切回根路径（本地根部署）。
  const base = (process.env.CTZ_BASE_URL ?? "/ctz-bujo-share").replace(/\/$/, "");
  eleventyConfig.addNunjucksGlobal("base", base);

  eleventyConfig.addNunjucksGlobal("withDelta", withDelta);
  eleventyConfig.addFilter("homeText", homeText);

  // 正文 Markdown 渲染：用 Eleventy 自带插件，避免直接依赖 markdown-it
  eleventyConfig.addPlugin(RenderPlugin);

  // 模板里常用的显示过滤
  eleventyConfig.addFilter("dateStr", (d) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? ""));
  eleventyConfig.addFilter("zhDate", (s) => {
    const [y, m, d] = String(s).split("-");
    return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
  });
  // 月视图上一月 / 下一月导航（包装 lib/calendar 的 shiftMonth）
  eleventyConfig.addFilter("prevMonth", (k) => calendar.shiftMonth(k, -1));
  eleventyConfig.addFilter("nextMonth", (k) => calendar.shiftMonth(k, 1));
  // Nunjucks 没有内建 split / trim（实测），补上：摘要取正文第一个非空段落用
  eleventyConfig.addFilter("split", (s, sep) => String(s ?? "").split(sep));
  eleventyConfig.addFilter("trim", (s) => String(s ?? "").trim());
  // 正文摘要：第一个非空段落
  eleventyConfig.addFilter("firstPara", (s) => {
    const paras = String(s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    return paras[0] || "";
  });
  // 字符串截取（Nunjucks 内建 slice 是数组分组切片，不是字符串截取——实测）
  eleventyConfig.addFilter("substr", (s, start, len) => String(s ?? "").substr(start, len));

  // lib/calendar 的纯函数直接暴露给 Nunjucks 模板（小月历、月视图、日页都要用）。
  // lib/ 不 import Eleventy，这里是唯一的接线点。
  for (const [name, fn] of Object.entries(calendar)) {
    if (typeof fn === "function") eleventyConfig.addNunjucksGlobal(name, fn);
  }

  eleventyConfig.setInputDirectory("src");
  eleventyConfig.setOutputDirectory("_site");

  // 静态资源原样复制到 _site/assets/（模板引用的 /assets/style.css、/assets/nav.js）
  // 显式 passthrough 比把 css/js 塞进 templateFormats 更稳（后者靠隐式复制，语义含糊）
  eleventyConfig.addPassthroughCopy("src/assets");

  return {
    dir: { includes: "_includes", data: "_data" },
    // 只列真正的模板格式；assets 走 passthrough，不在这里
    templateFormats: ["njk", "11ty.js"],
  };
}
