'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('site information links share the in-app translucent dialog',()=>{
  const html=read('index.html'),code=read('src/policy-dialog.js'),css=read('styles.css');
  assert.ok(html.includes('id="site-policy-dialog"'));
  assert.ok(html.includes('id="site-policy-frame"'));
  assert.equal((html.match(/class="site-policy-tab"/g)||[]).length,3);
  assert.ok(html.includes('src="src/policy-dialog.js?v=0.56-r1"'));
  assert.ok(code.includes('.site-policy-links a[href$=".html"],#cookie-consent a[href="privacy.html"]'));
  assert.ok(code.includes('new URL(href,root.document.baseURI)'));
  assert.ok(code.includes("url.searchParams.set('embed','1')"));
  assert.ok(code.includes("tab.setAttribute('aria-selected',String(selected))"));
  assert.ok(code.includes("tab.addEventListener('click',()=>selectDocument(tab.dataset.policyPage))"));
  for(const key of ['ArrowRight','ArrowLeft','Home','End'])assert.ok(code.includes("event.key==='"+key+"'"),key);
  assert.ok(code.includes("frame.contentDocument?.addEventListener('keydown'"));
  assert.ok(code.includes("event.key==='Escape'"));
  assert.ok(code.includes('UI.show(dialog,()=>dialog.showModal())'));
  assert.ok(css.includes('.site-policy-dialog{width:min(820px,calc(100% - 36px))'));
  assert.ok(css.includes('.site-policy-dialog[open]{display:grid;grid-template-rows:auto minmax(0,1fr)}'));
  assert.ok(css.includes('.site-policy-tab[aria-selected=true]'));
  assert.ok(css.includes('.site-policy-frame{display:block;width:100%;height:100%;min-height:0;border:0;background:transparent'));
});

test('standalone policy pages keep canonical URLs and support embedded presentation',()=>{
  const css=read('site-info.css');
  assert.ok(css.includes('html.embedded body{min-height:0;background:transparent}'));
  assert.ok(css.includes('html.embedded .info-card{border-color:rgba(193,215,236,.12);background:linear-gradient'));
  for(const file of ['about.html','privacy.html','terms.html']){
    const page=read(file);
    assert.ok(page.includes('src="src/policy-dialog.js?v=0.56-r1"'),file);
    assert.ok(page.includes(`rel="canonical" href="https://solartime.app/${file}"`),file);
    assert.ok(!page.includes('pagead2.googlesyndication.com'),file+' cannot request ads inside the in-app frame');
  }
});
