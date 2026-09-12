/* v0.22: the website works as supplied. This optional build makes one offline HTML. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function atomicWrite(file,text){const tmp=file+'.tmp';try{fs.writeFileSync(tmp,text,'utf8');fs.renameSync(tmp,file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
try{
 const pkg=JSON.parse(read('package.json')),version=pkg.version.split('.').slice(1).join('.');
 if(version!=='0.22')throw Error('This builder requires package version 0.0.22.');
 const names=['assets','sky-asset','materials','astro','surface','sky','renderer','app'];
 const tags=new Map();let html=read('index.html');
 for(const name of names){
  const matches=[...html.matchAll(new RegExp('<script\\b[^>]*\\bsrc="src/'+name+'\\.js(?:\\?[^"<>]*)?"[^>]*><\\/script>','g'))];
  if(matches.length!==1)throw Error('Expected one script entry for '+name);
  tags.set(name,matches[0][0]);if(name!=='assets')read('src/'+name+'.js');
 }
 const styles=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="styles\.css(?:\?[^"<>]*)?"[^>]*>/g)];
 const overlay=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="styles-v016\.css(?:\?[^"<>]*)?"[^>]*>/g)];
 if(styles.length!==1||overlay.length!==1)throw Error('Expected styles.css and styles-v016.css entries');
 const css=read('styles.css')+'\n'+read('styles-v016.css');
 require('./pack_assets.cjs');
 html=html.replace(styles[0][0],()=>'<style>\n'+css+'\n</style>').replace(overlay[0][0],'');
 for(const name of names){
  // The packed SolarAssets already contains the new sky. Do not embed it twice.
  if(name==='sky-asset'){html=html.replace(tags.get(name),'');continue;}
  const code=read('src/'+name+'.js').replace(/<\/script/gi,'<\\/script');
  const id=name==='assets'?' id="solar-assets"':'';
  html=html.replace(tags.get(name),()=>'<script'+id+'>\n'+code+'\n</script>');
 }
 if(/<script\b[^>]*\bsrc\s*=/i.test(html))throw Error('Unbundled script remains');
 const out=path.join(root,'dist');fs.mkdirSync(out,{recursive:true});
 const file=path.join(out,'Solar-Time_v'+version+'.html');atomicWrite(file,html);
 console.log('Built '+file+' ('+Buffer.byteLength(html)+' bytes)');
}catch(error){console.error('Build failed: '+error.message);process.exitCode=1;}
