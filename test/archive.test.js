import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archiveDate } from '../lib/archive.js';

test('暂停模式按全部条目及日总结的最后日期固定，保留未来日期', () => {
  assert.equal(archiveDate([{date:'2026-10-30'}], [{date:'2027-01-02'}], '2030-08-01', true), '2027-01-02');
  assert.equal(archiveDate([], [], '2030-08-01', true), '2030-08-01');
  assert.equal(archiveDate([{date:'2026-10-30'}], [], '2030-08-01', false), '2030-08-01');
});
test('暂停分享保留推送与手动部署，取消定时部署', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml','utf8');
  assert.doesNotMatch(workflow, /^  schedule:|cron:/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches: \[main\]/);
});

test('站点数据将同一日期用于默认月份、年度与统计，复用模式可关闭暂停', async () => {
  const {default: siteData} = await import('../src/_data/site.js');
  const original = process.env.CTZ_ARCHIVED;
  try {
    delete process.env.CTZ_ARCHIVED;
    const site = siteData();
    const latest = [...site.entries,...site.dailies].map(e=>e.date).sort().at(-1);
    assert.equal(site.today, latest);
    assert.equal(site.thisMonth, latest.slice(0,7));
    assert.equal(site.thisYear, latest.slice(0,4));
    assert.equal(site.archived, true);
    process.env.CTZ_ARCHIVED = 'false';
    const active = siteData();
    const now = new Date();
    assert.equal(active.thisMonth, `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
    assert.equal(active.archived, false);
  } finally {
    if (original === undefined) delete process.env.CTZ_ARCHIVED;
    else process.env.CTZ_ARCHIVED = original;
  }
});
