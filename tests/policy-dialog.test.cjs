'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cacheUrl=file=>require('../tools/code-revisions.cjs').urlFor(root,file);
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('main information buttons navigate to standalone HTML pages',()=>{
  const html=read('index.html'),code=read('src/policy-dialog.js');
  const nav=/<nav class="site-policy-links"[^>]*>(.*?)<\/nav>/.exec(html)?.[1]||'';
  assert.match(nav,/href="guide\.html">GUIDE<\/a><a href="about\.html">ABOUT<\/a><a href="privacy\.html">PRIVACY<\/a><a href="terms\.html">TERMS<\/a>/);
  assert.doesNotMatch(nav,/target=/);
  assert.ok(code.includes("const intercepted=links.filter(link=>!link.closest('.site-policy-links'))"));
  assert.ok(code.includes("for(const link of intercepted)link.addEventListener('click'"));
  assert.ok(!code.includes("for(const link of links)link.addEventListener('click'"));
});

test('cookie privacy can reuse the dialog while public pages stay independently crawlable',()=>{
  const html=read('index.html'),code=read('src/policy-dialog.js'),css=read('site-info.css');
  assert.ok(html.includes('id="site-policy-dialog"'));
  assert.ok(html.includes('id="site-policy-frame"'));
  assert.equal((html.match(/class="site-policy-tab"/g)||[]).length,4);
  assert.ok(html.includes('src="'+cacheUrl('src/policy-dialog.js')+'"'));
  assert.ok(code.includes('#cookie-consent a[href="privacy.html"]'));
  assert.ok(code.includes("url.searchParams.set('embed','1')"));
  assert.ok(code.includes('UI.show(dialog,()=>dialog.showModal())'));
  assert.ok(css.includes('html.embedded body{min-height:0;background:transparent}'));
  for(const file of ['guide.html','about.html','privacy.html','terms.html']){
    const page=read(file);
    assert.ok(page.includes('src="'+cacheUrl('src/policy-dialog.js')+'"'),file);
    assert.ok(page.includes('rel="canonical" href="https://solartime.app/'+file+'"'),file);
    assert.ok(!page.includes('pagead2.googlesyndication.com'),file);
  }
});
