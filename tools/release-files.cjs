'use strict';
const fs=require('node:fs'),path=require('node:path');

const pages=['index.html','about.html','privacy.html','terms.html'];
function localReference(value){
 const clean=String(value||'').split('#')[0].split('?')[0].replace(/^\.\//,'').replace(/^\//,'');
 if(!clean||/^(?:data:|https?:|mailto:|tel:|javascript:)/i.test(value)||clean.includes('..'))return '';
 return clean.replaceAll('\\','/');
}
function releaseFiles(root){
 const files=new Set(['version.json','ads.txt','robots.txt','sitemap.xml',...pages,'src/release-notes.js']);
 for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),'utf8');
  for(const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
   const file=localReference(match[1]);if(file&&(fs.existsSync(path.join(root,file))||file==='src/assets.js'||file==='src/sky-asset.js'))files.add(file);
  }
 }
 for(const name of fs.readdirSync(path.join(root,'src/locales')).filter(name=>name.endsWith('.json')))files.add('src/locales/'+name);
 return [...files].sort();
}
module.exports={releaseFiles};
