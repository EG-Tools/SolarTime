const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('v0.20 removes date-selection UI and handlers',()=>{
 const html=read('index.html'),app=read('src/app.js');
 for(const token of ['date-button','date-dialog','date-form','date-input','date-close']){assert.equal(html.includes(token),false,token);assert.equal(app.includes(token),false,token);}
});

test('v0.20 keeps compact playback essentials',()=>{
 const html=read('index.html');
 for(const token of ['pause-button','live-button','speed-slider','speed-mode-button'])assert.ok(html.includes(token),token);
});

test('v0.20 removes dead offline photo export path',()=>{
 const m=read('src/materials.js'),app=read('src/app.js');
 for(const token of ['offlineHTML()','download(){','objectURLs','materials.capture()'])assert.equal((m+'\n'+app).includes(token),false,token);
 assert.ok(m.includes('load(){'));
});

test('v0.20 product version is consistent',()=>{
 const html=read('index.html'),pkg=JSON.parse(read('package.json')),app=read('src/app.js');
 const v=pkg.version.split('.').slice(1).join('.');assert.ok(html.includes('Solar Time v'+v));assert.ok(app.includes("version:'"+v+"'"));
});
