import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('代码与文档按 MIT 授权，且声明不含日记正文', () => {
  const license = read('LICENSE');
  assert.match(license, /^MIT License\n/, 'LICENSE 应以 MIT 标题开头（便于 GitHub 识别）');
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /Copyright \(c\) 2026 沙楚子 \(Chartreuse310\)/);
  // 边界必须写在许可文件里，否则只读 LICENSE 的人会以为整仓都是 MIT
  assert.match(license, /content\/entries\//);
  assert.match(license, /content\/daily\//);
  assert.match(license, /不在本许可范围内/);
  assert.match(license, /LICENSE-CONTENT\.md/);
});

test('package.json 的 license 字段与 LICENSE 一致', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.private, true, 'private 应保留，避免误发布到 npm');
});

test('日记正文按 CC BY-NC-ND 4.0 授权，范围写死到 entries 与 daily', () => {
  const content = read('LICENSE-CONTENT.md');
  assert.match(content, /CC BY-NC-ND 4\.0/);
  assert.match(content, /content\/entries\/\*\*\/\*\.md/);
  assert.match(content, /content\/daily\/\*\*\/\*\.md/);
  // 复用必须能改分类登记表，否则框架不可用：它要留在 MIT 一侧
  assert.match(content, /content\/taxonomy\.yml/);
  assert.match(content, /不在.{0,4}本许可范围内/);
});

test('LICENSE-CONTENT.md 内嵌完整法律文本，不只是一个链接', () => {
  const content = read('LICENSE-CONTENT.md');
  assert.match(content, /Attribution-NonCommercial-NoDerivatives 4\.0 International/);
  assert.match(content, /Section 1 -- Definitions\./);
  assert.match(content, /Creative Commons may be contacted at creativecommons\.org/);
});
