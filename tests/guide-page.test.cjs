'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('the English guide is substantial, semantic and connected to the app',()=>{
 const page=read('guide.html'),index=read('index.html'),sitemap=read('sitemap.xml');
 assert.match(page,/<html lang="en">/);
 assert.match(page,/rel="canonical" href="https:\/\/solartime\.app\/guide\.html"/);
 assert.ok(page.length>9000,'guide should contain useful original instructions');
 for(const id of ['start','camera','time','bodies','constellations','travel','display','shortcuts','troubleshooting']){
  assert.ok(page.includes('id="'+id+'"'),id);
  assert.ok(page.includes('href="#'+id+'"'),id+' table of contents');
 }
 for(const label of ['Space','Real time','True size ratio','Saturn ring travel','Keyboard shortcuts','Troubleshooting'])assert.ok(page.includes(label),label);
 assert.match(index,/<nav class="site-policy-links"[^>]*><span class="site-policy-row"><a href="guide\.html">GUIDE<\/a><a href="credits\.html">CREDITS<\/a><a href="changelog\.html">UPDATES<\/a><\/span>/);
 assert.ok(sitemap.includes('https://solartime.app/guide.html'));
 assert.ok(index.includes('<a href="learn.html">LEARN</a>'));
});

test('constellation illustrations match the live catalogue and contain every star and edge',()=>{
 const {catalogue,diagram,sync}=require('../tools/build-constellation-guide.cjs');
 assert.equal(sync(root),false);
 for(const feature of catalogue(root)){
  const svg=diagram(feature);
  assert.doesNotMatch(svg,/NaN|Infinity/);
  assert.equal((svg.match(/<line /g)||[]).length,feature.edges.length,feature.id);
  assert.equal((svg.match(/<circle /g)||[]).length,feature.stars.length+(feature.marker?1:0),feature.id);
  for(const match of svg.matchAll(/c[xy]="([\d.]+)"/g))assert.ok(Number(match[1])>=0&&Number(match[1])<=360,feature.id);
 }
});

test('constellation reading pages expose valid local links and accessible static content',()=>{
 const page=read('constellations.html'),{releaseFiles}=require('../tools/release-files.cjs');
 assert.match(page,/<html lang="en">/);
 assert.match(page,/rel="canonical" href="https:\/\/solartime\.app\/constellations\.html"/);
 assert.ok(releaseFiles(root).includes('constellations.html'));
 assert.ok(read('sitemap.xml').includes('https://solartime.app/constellations.html'));
 for(const file of ['guide.html','constellations.html']){
  const html=read(file),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,file+' unique anchors');
  for(const [,href] of html.matchAll(/\bhref="([^"]+)"/g)){
   if(/^(https?:|mailto:)/.test(href))continue;
   const [target,anchor]=href.split('#'),destination=target?target.split('?')[0]:file;
   assert.ok(fs.existsSync(path.join(root,destination)),file+' '+href);
   if(anchor)assert.ok(read(destination).includes('id="'+anchor+'"'),href);
  }
 }
 assert.doesNotMatch(page,/<script[^>]+src="src\/(?:sky|renderer|app)\.js/);
});
