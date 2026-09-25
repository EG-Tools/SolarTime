'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),{sync,revisions,hash}=require('../tools/code-revisions.cjs'),{options,validateTarget}=require('../tools/deployment.cjs');
function clone(){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'solar-cache-test-'));fs.cpSync(root,tmp,{recursive:true,filter:p=>!['.git','.cloudflare','node_modules','__pycache__'].includes(path.basename(p))});return tmp;}
test('content cache keys are current, deterministic and line-ending independent',()=>{
 assert.deepEqual(sync(root),[]);const a=revisions(root),b=revisions(root);for(const file of ['src/timer-controller.js','src/assets.js','src/sky.js','styles.css'])assert.equal(a.key(file),b.key(file),file);assert.equal(hash('a\r\nb\r\n'),hash('a\nb\n'));
});
test('app version-only changes keep unrelated code cache URLs; changed code invalidates only its consumers',()=>{
 const tmp=clone();try{const before=revisions(tmp),oldTimerKey=before.key('src/timer-controller.js'),htmlBefore=fs.readFileSync(path.join(tmp,'index.html'),'utf8');fs.writeFileSync(path.join(tmp,'version.json'),' {"version":"0.60","revision":"r1"}\n');assert.deepEqual(sync(tmp),[]);
 fs.appendFileSync(path.join(tmp,'src/timer-controller.js'),'\n// Changed implementation.\n');assert.throws(()=>sync(tmp),/Stale code cache keys/);assert.deepEqual(sync(tmp,{write:true}),['index.html']);const after=revisions(tmp);assert.notEqual(after.key('src/timer-controller.js'),oldTimerKey);
 assert.notEqual(fs.readFileSync(path.join(tmp,'index.html'),'utf8'),htmlBefore);assert.equal(after.key('src/sky.js'),revisions(root).key('src/sky.js'));assert.deepEqual(sync(tmp),[]);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('locale updates change their own content key and loader, but preserve every other locale key',()=>{
 const tmp=clone();try{const old=fs.readFileSync(path.join(tmp,'src/language-data.js'),'utf8');fs.appendFileSync(path.join(tmp,'src/locales/kor.json'),'\n');sync(tmp,{write:true});const updated=fs.readFileSync(path.join(tmp,'src/language-data.js'),'utf8');const extract=s=>JSON.parse(/const LOCALE_REVISIONS=Object.freeze\((\{.*\})\);/.exec(s)[1]);const a=extract(old),b=extract(updated);assert.notEqual(a.kor,b.kor);for(const key of Object.keys(a).filter(k=>k!=='kor'))assert.equal(a[key],b[key]);assert.deepEqual(sync(tmp),[]);}finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('both deployment aliases use the one guarded implementation and dry-run never publishes',()=>{
 for(const alias of ['deploy-cloudflare.cjs','deploy-shutdown.cjs']){const source=fs.readFileSync(path.join(root,'tools',alias),'utf8');assert.match(source,/require\('\.\/deployment\.cjs'\)\.main/);const out=cp.spawnSync(process.execPath,['tools/'+alias],{cwd:root,encoding:'utf8'});assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/"writes": false/);}
 assert.throws(()=>options(['--force']),/Unknown/);assert.throws(()=>options(['--phase=delete']),/Unknown/);assert.throws(()=>validateTarget(root,{CLOUDFLARE_ACCOUNT_ID:'other'}),/Wrong/);
 const ci=cp.spawnSync(process.execPath,['tools/deployment.cjs','--ci','--phase=worker','--apply'],{cwd:root,env:{...process.env,GITHUB_ACTIONS:'false'},encoding:'utf8'});assert.equal(ci.status,1);assert.match(ci.stderr,/restricted/);
});
test('shared card style keeps both specificity levels without duplicate declarations',()=>{
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');assert.match(css,/\.card-surface,\.toast\.card-surface\{border-color:var\(--card-border\);background:var\(--card-background\);box-shadow:var\(--card-shadow\);backdrop-filter:var\(--card-filter\);-webkit-backdrop-filter:var\(--card-filter\)\}/);
 assert.equal((css.match(/border-color:var\(--card-border\);background:var\(--card-background\);box-shadow:var\(--card-shadow\);backdrop-filter:var\(--card-filter\);-webkit-backdrop-filter:var\(--card-filter\)/g)||[]).length,1);
});
