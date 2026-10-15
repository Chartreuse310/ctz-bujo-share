import { test } from "node:test";
import assert from "node:assert/strict";
import { fail, ContentError } from "../lib/schema.js";

test("fail 抛 ContentError，消息含文件、字段、实际值、期望值", () => {
  const err = (() => {
    try { fail("content/entries/a.md", "type", "thougt", "event 或 thought"); }
    catch (e) { return e; }
  })();
  assert.ok(err instanceof ContentError);
  assert.match(err.message, /content\/entries\/a\.md/);
  assert.match(err.message, /type/);
  assert.match(err.message, /thougt/);
  assert.match(err.message, /event 或 thought/);
});

test("实际值是对象时用 JSON 打印，不抛二次异常", () => {
  const err = (() => {
    try { fail("a.md", "tags", ["x", "y"], "字符串数组"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /\["x","y"\]/);
});

test("实际值是 undefined 时也能打印", () => {
  const err = (() => {
    try { fail("a.md", "title", undefined, "非空字符串"); }
    catch (e) { return e; }
  })();
  assert.match(err.message, /undefined/);
});
