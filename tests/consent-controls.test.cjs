'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('neutral dismissal stays next to Allow; cookie settings exist only in Display settings',()=>{
 const html=read('index.html'),code=read('src/cookie-consent.js'),app=read('src/app.js');
 assert.match(html,/<button id="cookie-dismiss" type="button"[^>]+data-i18n-aria="cookieDismiss"[^>]*>×<\/button>/);
 assert.match(html,/aria-describedby="cookie-consent-message cookie-choice-note"/);
 assert.match(html,/id="review-cookie-consent"[^>]+data-i18n="cookieSettings"/);
 assert.doesNotMatch(html,/id="help-cookie-settings"/);assert.doesNotMatch(app,/help-cookie-settings/);
 assert.match(app,/review-cookie-consent.*settings\(false\);window\.SolarCookieConsent\?\.show\(\)/);
 assert.match(html,/id="cookie-accept"[^>]*>[^<]*<\/button><button id="cookie-dismiss"/);
 assert.equal((html.match(/id="cookie-dismiss"/g)||[]).length,1);
 assert.match(code,/dismiss\?\.addEventListener\('click',hide\)/);assert.doesNotMatch(code,/sessionStorage|localStorage|setItem/);
 assert.match(read('privacy.html'),/six calendar months/);assert.match(read('privacy.html'),/one-time six-month/);
});
test('all shared languages carry real control copy and the existing release without extra countries',()=>{
 const data=require('../tools/i18n.cjs').compile(root);assert.equal(data.codes.length,15);
 for(const code of data.codes)for(const key of ['cookieSettings','cookieDismiss','cookieChoiceNote'])assert.ok(data.bundles[code].copy[key]?.trim(),code+':'+key);
 const release=data.releases.find(r=>r.version==='0.66');assert.ok(release);for(const code of data.codes)assert.equal(release.localized[code].length,3);
});
