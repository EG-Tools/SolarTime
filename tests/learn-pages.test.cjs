'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const articles=['learn-orbits.html','learn-scale.html','learn-eclipses.html','learn-sky.html','learn-cinematics.html'];

test('learning hub publishes original, connected articles',()=>{
 const hub=read('learn.html'),sitemap=read('sitemap.xml'),index=read('index.html');
 assert.match(hub,/<html lang="en">/);assert.match(hub,/Understand the model behind the view/);
 assert.match(index,/href="learn\.html">LEARN<\/a><a href="about\.html">ABOUT/);
 for(const file of articles){
  const page=read(file);
  assert.ok(hub.includes(`href="${file}"`),file+' hub link');
  assert.ok(sitemap.includes(`https://solartime.app/${file}`),file+' sitemap');
  assert.ok(page.length>5000,file+' substantial copy');
  assert.match(page,/name="author" content="Life User"/);
  assert.match(page,/type="application\/ld\+json"/);
  assert.match(page,/datePublished/);assert.match(page,/dateModified/);
  assert.match(page,/class="learning-diagram"/);assert.match(page,/Try it in Solar Time/);
  assert.match(page,/Sources|Project context/);
 }
});

test('learning pages use valid local links and unique anchors',()=>{
 for(const file of ['learn.html',...articles]){
  const html=read(file),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(ids.length,new Set(ids).size,file+' unique ids');
  for(const [,href] of html.matchAll(/\bhref="([^"]+)"/g)){
   if(/^(https?:|mailto:)/.test(href))continue;
   const destination=href.split('#')[0].split('?')[0]||file;
   assert.ok(fs.existsSync(path.join(root,destination)),file+' -> '+href);
  }
 }
});

test('learning pages are included in deterministic release output',()=>{
 const files=new Set(require('../tools/release-files.cjs').releaseFiles(root));
 for(const file of ['learn.html',...articles])assert.ok(files.has(file),file);
});
