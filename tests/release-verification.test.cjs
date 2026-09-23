'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {releaseFiles}=require('../tools/release-files.cjs');
const root=path.resolve(__dirname,'..');

test('public verification derives page, generated, policy and lazy dependencies',()=>{
 const files=releaseFiles(root);
 for(const file of ['index.html','about.html','privacy.html','terms.html','styles.css','site-info.css','manifest.webmanifest','ads.txt','robots.txt','sitemap.xml','kakao-pay-qr.svg','src/consent.js','src/google-analytics.js','src/adsense.js','src/assets.js','src/sky-asset.js','src/app.js','src/sky.js','src/release-notes.js','src/locales/kor.json'])assert.ok(files.includes(file),file);
 assert.equal(new Set(files).size,files.length);
});

test('public text verification ignores only platform line-ending differences',()=>{
 const source=fs.readFileSync(path.join(root,'tools/verify-public-release.cjs'),'utf8');
 assert.match(source,/textFile=.*webmanifest/);
 assert.match(source,/replace\(\/\\r\\n\?\/g,'\\n'\)/);
 assert.match(source,/comparable\(file,remote\.bytes\)\.equals\(comparable\(file,local\)\)/);
 assert.match(source,/mediaBase=worker\?'\/media\/'\:configured\.deployment\.cdnBase/);
});
