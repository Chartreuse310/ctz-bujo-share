/** 机械断言：9 份 demo 的硬约束（不滚动 / 35 格零裁切 / 月历位移 0 / 栅格 844+236） */
const {execFileSync} = await import('node:child_process');
const files = ['b-swiss.html','d-edit.html','e-dotted.html','f-warm.html',
               'g-bottom.html','g1-line.html','g2-text.html','g3-pale.html','g4-quiet.html','g5-slim.html'];
const raw = execFileSync('node', ['scripts/check-ui-constraints.mjs', ...files], {encoding: 'utf8', maxBuffer: 1 << 24});
const data = JSON.parse(raw.slice(raw.indexOf('[')));
let fails = 0;
for (const d of data) {
  for (const c of d.checks) {
    const bad = [];
    if (c.pageScrolls) bad.push('pageScrolls');
    if (c.clippedCells !== 0) bad.push('clipped=' + c.clippedCells);
    if (c.calShift !== 0) bad.push('calShift=' + c.calShift);
    if (c.calWidth !== 844) bad.push('calW=' + c.calWidth);
    if (c.listWidth !== 236) bad.push('listW=' + c.listWidth);
    if (c.totalCells !== 35) bad.push('cells=' + c.totalCells);
    const tag = `${d.file.padEnd(15)} ${c.viewport.padEnd(10)}`;
    if (bad.length) { fails++; console.log(`FAIL ${tag} ${bad.join(' ')}`); }
    else console.log(`PASS ${tag} cells=35 calW=844 listW=236 calShift=0 noScroll`);
  }
}
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURES`);
process.exit(fails ? 1 : 0);
