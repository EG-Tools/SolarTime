'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('support providers share one row without duplicate currency labels',()=>{
  const html=read('index.html'),css=read('styles.css');
  const start=html.indexOf('<span class="support-options">'),end=html.indexOf('</span><span class="social-links">',start);
  const block=html.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.equal((block.match(/class="support-link"/g)||[]).length,3);
  for(const label of ['Buy Me a Coffee','카카오페이','크티'])assert.ok(block.includes(label),label);
  assert.doesNotMatch(block,/support-label|supportUsd|supportKrw|달러로 후원|원화로 후원/);
  assert.match(css,/\.support-options\{display:flex;flex-wrap:nowrap;/);
});
