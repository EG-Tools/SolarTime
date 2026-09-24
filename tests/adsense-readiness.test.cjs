'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const publisher='ca-pub-5773171100052324';

test('AdSense ownership uses the official publisher id',()=>{
 const html=read('index.html');
 assert.equal((html.match(/name="google-adsense-account"/g)||[]).length,1);
 assert.ok(html.includes(`content="${publisher}"`));
 assert.ok(read('src/adsense.js').includes(`adsbygoogle.js?client=\${publisher}`));
 assert.ok(!html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'));
});

test('ads.txt authorizes only the configured Google publisher',()=>{
 assert.equal(read('ads.txt').trim(),'google.com, pub-5773171100052324, DIRECT, f08c47fec0942fa0');
});

test('policy and original-content pages are public, linked and crawlable',()=>{
 const html=read('index.html'),robots=read('robots.txt'),sitemap=read('sitemap.xml');
 for(const file of ['about.html','privacy.html','terms.html']){
  const page=read(file);
  assert.ok(html.includes(`href="${file}"`),file);
  assert.ok(sitemap.includes(`https://solartime.app/${file}`),file);
  assert.ok(page.includes(`content="${publisher}"`),file);
  assert.ok(page.length>1800,file);
 }
 assert.match(robots,/User-agent: Mediapartners-Google\s+Allow: \//);
 assert.match(robots,/User-agent: Google-Display-Ads-Bot\s+Allow: \//);
 assert.ok(robots.includes('https://solartime.app/sitemap.xml'));
});

test('desktop ad stays hidden until a real slot or an explicit local preview is requested',()=>{
 const html=read('index.html'),code=read('src/adsense.js'),css=read('styles.css');
 assert.ok(html.includes('name="solar-time-ad-slot" content=""'));
 assert.ok(html.includes('id="desktop-ad-toggle"'));
 assert.ok(html.includes('id="desktop-ad-panel"'));
 assert.match(code,/\/\^\\d\+\$\/\.test\(slot\)/);
 assert.ok(code.includes('let requested=false,loading=null,open=true'));
 assert.ok(code.includes("toggle?.addEventListener('click',()=>setOpen(!open))"));
 assert.ok(code.includes("setAttribute('aria-expanded',String(open))"));
 assert.ok(code.includes("const previewRequested=localPreview&&new URLSearchParams(location.search).get('ad-preview')==='1'"));
 assert.ok(code.includes('if(preview)preview.hidden=!previewRequested||real'));
 assert.ok(code.includes('(previewRequested||(real&&granted))&&!!media?.matches'));
 assert.ok(code.includes("root.SolarConsent?.value()==='granted'"));
 assert.ok(code.includes("root.addEventListener?.('solar:consentchange',sync)"));
 assert.ok(code.includes("location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'"));
 assert.ok(html.includes('id="desktop-ad-preview"'));
 assert.ok(html.includes('200 × 200'));
 assert.ok(css.includes('.desktop-ad-rail .adsbygoogle{display:block;width:200px;height:200px'));
 assert.ok(css.includes('width:234px;align-items:flex-end;gap:0;transform:translateX(202px)'));
 assert.ok(css.includes('.desktop-ad-preview{display:grid;width:200px;height:200px;place-content:center;gap:8px;border:0'));
 assert.ok(!html.includes('ADVERTISEMENT'));
 assert.ok(code.includes('(min-width:1600px) and (min-height:720px) and (pointer:fine)'));
 assert.ok(css.includes('(pointer:coarse){.desktop-ad-rail{display:none!important}}'));
});

test('Cloudflare site build publishes every AdSense review file',()=>{
 const build=read('tools/cloudflare-site.cjs');
 for(const file of ['ads.txt','robots.txt','sitemap.xml','about.html','privacy.html','terms.html','site-info.css'])assert.ok(build.includes(`'${file}'`),file);
});

test('Google Analytics runs only on the production domain with denied consent defaults',()=>{
 const html=read('index.html'),code=read('src/google-analytics.js'),consent=read('src/consent.js');
 assert.ok(code.includes("measurementId='G-4MP85CMH64'"));
 assert.ok(code.includes("solartime\\.app"));
 assert.ok(!html.includes('<script async src="https://www.googletagmanager.com/gtag/js'));
 assert.ok(html.indexOf('src/consent.js')<html.indexOf('src/google-analytics.js'));
 assert.ok(code.includes('document.querySelector(`script[src="${source}"]`)'));
 assert.ok(code.includes("root.gtag('config',measurementId)"));
 for(const key of ['ad_storage','ad_user_data','ad_personalization','analytics_storage'])assert.ok(consent.includes(`${key}:'denied'`),key);
 for(const file of ['index.html','about.html','privacy.html','terms.html']){
  const page=read(file);assert.ok(page.includes('src/consent.js?v=0.57-r1'),file);assert.ok(page.includes('src/google-analytics.js?v=0.57-r1'),file);
  assert.ok(page.indexOf('src/consent.js')<page.indexOf('src/google-analytics.js'),file+' consent order');
 }
});

test('cookie choice uses the shared card fade lifecycle and controls Google consent',()=>{
 const html=read('index.html'),code=read('src/cookie-consent.js'),css=read('styles.css');
 for(const id of ['cookie-consent','cookie-reject','cookie-accept'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/id="cookie-consent" class="cookie-consent card-surface"/);
 assert.match(html,/id="desktop-ad-(?:toggle|panel)" class="desktop-ad-(?:toggle|panel) card-surface"/);
 for(const key of ['cookieTitle','cookieMessage','cookiePrivacy','cookieReject','cookieAccept'])assert.ok(html.includes(`data-i18n="${key}"`),key);
 assert.ok(html.includes('src/cookie-consent.js?v=0.57-r1'));
 assert.ok(code.includes('if(UI)UI.show(banner)'));
 assert.ok(code.includes('if(UI)UI.hide(banner)'));
 assert.ok(code.includes('consent.choose(value)'));
 assert.ok(code.includes('value:consent.value'));
 assert.ok(html.includes('id="review-cookie-consent"'));
 assert.ok(read('src/app.js').includes("window.SolarCookieConsent?.show()"));
 assert.ok(css.includes('.cookie-consent{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom))'));
 assert.ok(css.includes('width:max-content;max-width:calc(100vw - 48px)'));
});

test('cookie consent copy is complete in every supported locale',()=>{
 const codes=['kor','en','chn','zht','jpn','hi','es','de','fr','pt','it','id','nl'];
 const keys=['cookieTitle','cookieMessage','cookiePrivacy','cookieReject','cookieAccept'];
 for(const code of codes){
  const copy=JSON.parse(read(`src/locales/${code}.json`)).copy;
  for(const key of keys)assert.equal(typeof copy[key]==='string'&&copy[key].trim().length>0,true,`${code}.${key}`);
 }
});

test('browser UI regression starts with an explicit cookie choice so the consent card cannot intercept controls',()=>{
 const code=read('tests/browser/ui-regression.py');
 assert.ok(code.includes("name==='localStorage'?[['solarTimeCookieConsentV1','denied']]:[]"));
});
