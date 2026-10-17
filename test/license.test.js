import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('LICENSE 是纯 MIT 文本（不加自定条款，否则 GitHub 判为 NOASSERTION）', () => {
  const license = read('LICENSE');
  assert.match(license, /^MIT License\n/, 'LICENSE 应以 MIT 标题开头');
  assert.match(license, /^Copyright \(c\) 2026 沙楚子 \(Chartreuse310\)$/m);
  assert.match(license, /Permission is hereby granted, free of charge/);
  // 2026-10-17 实证：MIT 末尾追加中文范围说明后，GitHub licensee 返回 NOASSERTION，
  // 仓库页面显示「Other」。边界说明改放 LICENSE-CONTENT.md 与 README。
  assert.ok(
    license.trimEnd().endsWith('SOFTWARE.'),
    'LICENSE 末尾必须是标准保修段；追加条款会让 GitHub 识别不出 MIT'
  );
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
  // LICENSE 只留纯 MIT 文本，所以分界线必须在这里写明
  assert.match(content, /纯 MIT 文本/);
});

test('LICENSE-CONTENT.md 内嵌完整法律文本，不只是一个链接', () => {
  const content = read('LICENSE-CONTENT.md');
  assert.match(content, /Attribution-NonCommercial-NoDerivatives 4\.0 International/);
  assert.match(content, /Section 1 -- Definitions\./);
  assert.match(content, /Creative Commons may be contacted at creativecommons\.org/);
});

test('README 的「许可」一节链到两个许可文件', () => {
  const readme = read('README.md');
  assert.match(readme, /^## 许可$/m);
  assert.match(readme, /\[MIT\]\(LICENSE\)/);
  assert.match(readme, /\[CC BY-NC-ND 4\.0\]\(LICENSE-CONTENT\.md\)/);
});
