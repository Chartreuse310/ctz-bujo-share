import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHome, homeText } from '../lib/home.js';
import { sampleThoughts } from '../src/assets/home.js';

test('首页：事件倒序取五条，思考独立，记录起止包含日总结；不改输入', () => {
  const entries = Array.from({length:7}, (_,i)=>({type:'event',highlight:true,date:`2026-10-${10+i}`,file:`${i}`}));
  entries.push({type:'thought',highlight:true,date:'2026-10-17',file:'thought'});
  const copy=structuredClone(entries);
  const h=buildHome(entries,[{date:'2026-10-01'},{date:'2026-10-18'}]);
  assert.equal(h.recent.length,5);
  assert.equal(h.recent[0].date,'2026-10-16');
  assert.equal(h.thoughts.length,1);
  assert.equal(h.start,'2026-10-01');
  assert.equal(h.latest,'2026-10-18');
  assert.deepEqual(entries,copy);
});
test('空数据与同日文件名兜底，未来日期合法',()=>{
  assert.deepEqual(buildHome([],[]),{thoughts:[],recent:[],start:null,latest:null});
  const h=buildHome([{type:'event',highlight:true,date:'2099-01-01',file:'b'},{type:'event',highlight:true,date:'2099-01-01',file:'a'}],[]);
  assert.equal(h.recent[0].file,'a');
  assert.equal(h.latest,'2099-01-01');
});
test('抽样不重复，不修改原数组；数量不足与空数据可用',()=>{
  const items=[1,2,3,4,5];
  const picked=sampleThoughts(items,3,()=>0);
  assert.equal(new Set(picked).size,3);
  assert.deepEqual(items,[1,2,3,4,5]);
  assert.deepEqual(sampleThoughts([],3),[]);
  assert.deepEqual(sampleThoughts([1],3),[1]);
});
test('换一组：候选多于三条时，新一组至少变化一条',()=>{
  const items=[1,2,3,4];
  const first=sampleThoughts(items,3,()=>0);
  const next=sampleThoughts(items,3,()=>0,first);
  assert.notDeepEqual([...next].sort(),[...first].sort());
});

test('首页摘录保留链接文字、剔除图片和标记',()=>{
 assert.equal(homeText('# 标题\n**思考** [全文](/a/) ![图](/x.png) <b>内容</b>'),'标题 思考 全文 内容');
});

test('首页仅展示显式重点事件与思考；起止及今日默认日期仍取全部内容',()=>{
  const entries=[
    {type:'event',highlight:true,date:'2026-10-16',file:'important-event'},
    {type:'thought',highlight:true,date:'2026-10-15',file:'important-thought'},
    {type:'event',highlight:false,date:'2099-01-01',file:'ordinary-event'},
    {type:'thought',date:'1999-01-01',file:'ordinary-thought'},
  ];
  const before=structuredClone(entries);const h=buildHome(entries,[]);
  assert.deepEqual(h.recent.map(e=>e.file),['important-event']);
  assert.deepEqual(h.thoughts.map(e=>e.file),['important-thought']);
  assert.equal(h.start,'1999-01-01');assert.equal(h.latest,'2099-01-01');
  assert.deepEqual(entries,before);
  const ordinary=buildHome(entries.slice(2),[]);assert.deepEqual(ordinary.recent,[]);assert.deepEqual(ordinary.thoughts,[]);
});
