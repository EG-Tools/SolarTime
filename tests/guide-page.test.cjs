'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('the English guide is substantial, semantic and connected to the app',()=>{
 const page=read('guide.html'),index=read('index.html'),sitemap=read('sitemap.xml');
 assert.match(page,/<html lang="en">/);
 assert.match(page,/rel="canonical" href="https:\/\/solartime\.app\/guide\.html"/);
 assert.ok(page.length>9000,'guide should contain useful original instructions');
 for(const id of ['start','camera','time','bodies','travel','display','shortcuts','troubleshooting']){
  assert.ok(page.includes('id="'+id+'"'),id);
  assert.ok(page.includes('href="#'+id+'"'),id+' table of contents');
 }
 for(const label of ['Space','Real time','True size ratio','Saturn ring travel','Keyboard shortcuts','Troubleshooting'])assert.ok(page.includes(label),label);
 assert.match(index,/<nav class="site-policy-links"[^>]*><a href="guide\.html">GUIDE<\/a><a href="about\.html">ABOUT<\/a>/);
 assert.ok(sitemap.includes('https://solartime.app/guide.html'));
});
