/* Content-derived URLs: changing the app version does not invalidate unrelated code. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {runtimeScripts,projectConfig}=require('./asset-pipeline.cjs');
const hash=text=>crypto.createHash('sha256').update(String(text).replace(/\r\n?/g,'\n')).digest('hex').slice(0,12);
function revisions(root){
 const pending=new Map(),read=file=>pending.get(file)??fs.readFileSync(path.join(root,file),'utf8');
 const locales=Object.fromEntries(fs.readdirSync(path.join(root,'src/locales')).filter(f=>f.endsWith('.json')).sort().map(f=>[f.slice(0,-5),hash(read('src/locales/'+f))]));
 let language=read('src/language-data.js');
 const declaration='  const LOCALE_REVISIONS=Object.freeze('+JSON.stringify(locales)+');';
 language=language.includes('const LOCALE_REVISIONS=')?language.replace(/^  const LOCALE_REVISIONS=.*$/m,declaration):language.replace('  const scriptUrl=',declaration+'\n  const scriptUrl=');
 language=language.replace('url.search=scriptUrl.search;',"url.searchParams.set('v',LOCALE_REVISIONS[code]||scriptUrl.searchParams.get('v')||'');").replace("fetch(url,{cache:'no-cache'","fetch(url,{cache:'force-cache'");
 pending.set('src/language-data.js',language);
 pending.set('src/app.js',read('src/app.js').replace(/src\/release-notes\.js\?v=[^'"\s]+/g,'src/release-notes.js?v='+hash(read('src/release-notes.js'))));
 const {deployment}=projectConfig(root),manifest=JSON.parse(read('assets/manifest.json'));
 const generated=runtimeScripts(root,manifest,deployment,{cdnBase:deployment.cdnBase});
 const virtual={'src/assets.js':generated.assets,'src/sky-asset.js':generated.sky};
 const key=file=>hash(virtual[file]??read(file));
 for(const file of ['index.html','about.html','privacy.html','terms.html']){
  pending.set(file,read(file).replace(/\b(src|href)="((?:src\/)?[a-zA-Z0-9_.\/-]+\.(?:js|css))(?:\?[^"#]*)?"/g,(all,attr,target)=>{
   if(!fs.existsSync(path.join(root,target)))throw Error('Missing referenced runtime '+target);
   return attr+'="'+target+'?v='+key(target)+'"';
  }));
 }
 return {pending,key};
}
function sync(root,{write=false}={}){
 const {pending}=revisions(root),changed=[];
 for(const [file,content] of pending)if(fs.readFileSync(path.join(root,file),'utf8')!==content){changed.push(file);if(write)fs.writeFileSync(path.join(root,file),content);}
 if(changed.length&&!write)throw Error('Stale code cache keys: '+changed.join(', ')+'. Run npm run update:cache before committing.');
 return changed;
}
function urlFor(root,file){return file+'?v='+revisions(root).key(file);}
if(require.main===module){const args=process.argv.slice(2);if(args.some(a=>a!=='--write'))throw Error('Unknown cache-key option.');try{const changed=sync(path.resolve(__dirname,'..'),{write:args.includes('--write')});console.log('Content cache keys verified; updated '+changed.length+' files.');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={hash,revisions,sync,urlFor};
