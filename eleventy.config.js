import { RenderPlugin } from "@11ty/eleventy";
import * as calendar from "./lib/calendar.js";

export default function (eleventyConfig) {
  // 正文 Markdown 渲染：用 Eleventy 自带插件，避免直接依赖 markdown-it
  eleventyConfig.addPlugin(RenderPlugin);

  // 模板里常用的显示过滤
  eleventyConfig.addFilter("dateStr", (d) =>
    d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? ""));
  eleventyConfig.addFilter("zhDate", (s) => {
    const [y, m, d] = String(s).split("-");
    return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
  });

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
