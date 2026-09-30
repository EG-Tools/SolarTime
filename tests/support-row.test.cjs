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
  assert.equal((block.match(/class="support-link"/g)||[]).length,4);
  for(const label of ['Buy Me a Coffee','WeChat','카카오페이','크티'])assert.ok(block.includes(label),label);
  assert.ok(block.indexOf('>WeChat</a>')<block.indexOf('>카카오페이</a>'));
  assert.doesNotMatch(block,/support-label|supportUsd|supportKrw|달러로 후원|원화로 후원/);
  assert.match(css,/\.support-options\{display:flex;flex-wrap:nowrap;/);
});

test('WeChat uses the shared Kakao-style QR dialog without launching a payment protocol',()=>{
  const html=read('index.html'),app=read('src/app.js'),css=read('styles.css');
  for(const provider of ['kakao-pay','wechat-pay']){
    assert.match(html,new RegExp('<dialog id="'+provider+'-dialog" class="[^"]*support-qr-dialog'));
    assert.ok(html.includes('aria-controls="'+provider+'-dialog"'));
    assert.ok(html.includes('src="'+provider+'-qr.svg" width="240" height="240"'));
  }
  assert.ok(app.includes("for(const provider of ['kakao-pay','wechat-pay'])"));
  assert.match(css,/\.support-qr-dialog\{max-width:320px;/);
  assert.match(html,/id="wechat-pay-link"[^>]*href="wechat-pay-qr\.svg"/);
  assert.doesNotMatch(html,/href="wxp:/);
  assert.ok(read('tools/cloudflare-site.cjs').includes("'wechat-pay-qr.svg'"));
  assert.match(read('wechat-pay-qr.svg'),/<svg[^>]*width="240"[^>]*height="240"/);
  const wechat=html.slice(html.indexOf('<dialog id="wechat-pay-dialog"'),html.indexOf('<dialog id="site-policy-dialog"'));
  assert.doesNotMatch(wechat,/modal-note|<p\b|<hr\b/,'QR-only card has no gray footer or divider');
  assert.match(html,/class="support-link kakao-pay-open"[^>]*data-i18n="openKakaoPay"/,'KakaoPay open button stays intact');
});
