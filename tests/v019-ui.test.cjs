/* Historical settings/help/shine regression checks, kept release-agnostic. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('settings keep requested controls removed and lower management block absent',()=>{const h=read('index.html');for(const id of ['elevation','quality','sky-motion','reset-view','photo-status','photo-retry','photo-export'])assert.doesNotMatch(h,new RegExp(`id="${id}"`));});
test('sun shine is a true visibility toggle',()=>{const s=read('src/renderer.js');assert.match(s,/corona\(c,x,y,r,seconds\) \{[\s\S]*?if\(!this\.options\.activity\)return;/);});
test('all visible product credits use bullet format and current package version',()=>{const h=read('index.html'),pkg=JSON.parse(read('package.json')),v=pkg.version.split('.').slice(1).join('.'),needle=`Life User • Solar Time v${v} •`;assert.ok((h.split(needle).length-1)>=3);assert.doesNotMatch(h,/Life User \/ Solar Time/);});
test('help stays compact and has a product footer',()=>{const h=read('index.html'),match=h.match(/<dialog id="help-dialog"[\s\S]*?<div id="loading"/);assert.ok(match);const help=match[0];assert.match(help,/사용 방법과 계산 기준/);assert.match(help,/Life User • Solar Time/);assert.ok(help.length<5000);});
test('lower left note aligns with footer signature column',()=>{assert.match(read('styles-v016.css'),/\.scale-note\{left:38px\}/);});
test('app no longer binds deleted settings controls',()=>{const s=read('src/app.js');for(const id of ['quality','elevation','reset-view','photo-status','photo-retry','photo-export'])assert.doesNotMatch(s,new RegExp(`\\$\\('${id}'\\)`));assert.doesNotMatch(s,/skyMotion:'sky-motion'/);});
test('app version matches package',()=>{const pkg=JSON.parse(read('package.json')),v=pkg.version.split('.').slice(1).join('.');assert.match(read('src/app.js'),new RegExp(`version:'${v.replace('.', '\\.')}'`));});
