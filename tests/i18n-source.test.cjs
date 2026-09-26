'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),api=require('../tools/i18n.cjs'),gold=require('./fixtures/i18n-v061.json');
const read=(file,dir=root)=>fs.readFileSync(path.join(dir,file),'utf8');
const data=(file,dir=root)=>JSON.parse(read(file,dir));
const write=(file,value,dir)=>fs.writeFileSync(path.join(dir,file),JSON.stringify(value,null,2)+'\n');
function sandbox(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solar-i18n-'));fs.cpSync(path.join(root,'i18n'),path.join(dir,'i18n'),{recursive:true});fs.mkdirSync(path.join(dir,'src'));fs.cpSync(path.join(root,'src/locales'),path.join(dir,'src/locales'),{recursive:true});for(const f of ['language-data.js','release-notes.js'])fs.copyFileSync(path.join(root,'src',f),path.join(dir,'src',f));return dir;}
function runtime({protocol='https:',fetch:fetchFn}={}){
 const requests=[],location={protocol,href:protocol==='file:'?'file:///D:/SolarTime/index.html':'https://solar.test/'},window={};
 const context={window,location,document:{currentScript:{src:new URL('src/language-data.js',location.href).href}},URL,AbortSignal,fetch:async url=>{requests.push(String(url));if(fetchFn)return fetchFn(url);const code=/\/([a-z]+)\.json/.exec(String(url))[1];return {ok:true,json:async()=>data('src/locales/'+code+'.json')};}};
 vm.runInNewContext(read('src/language-data.js'),context);return {loader:window.SolarModules.LanguageData,requests};
}
test('all generated translations are deterministic and current',()=>{
 const a=api.sync(root);assert.deepEqual(a.changed,[]);assert.equal(a.report.languages,13);assert.deepEqual(api.sync(root).changed,[]);
 const version=data('version.json');assert.equal(api.compile(root).releases[0].version,version.version);
 for(const file of ['tools/build-pages.cjs','tools/cloudflare-site.cjs'])assert.match(read(file),/require\('\.\/i18n\.cjs'\)\.sync\(root\)/);
});
test('all 13 web and file-language bundles preserve the previous effective interface, timer, body and phase text',async()=>{
 const compiled=api.compile(root);
 for(const protocol of ['https:','file:']){
  const {loader}=runtime({protocol});
  for(const code of compiled.codes){const bundle=await loader.load(code);assert.equal(api.fingerprint(bundle),gold[protocol==='file:'?'file':'web'][code],protocol+' '+code);assert.equal(api.fingerprint(loader.automaticLabels[code]),api.fingerprint(gold.automaticLabels[code]));assert.ok(Object.isFrozen(bundle)&&Object.isFrozen(bundle.copy));}
 }
});
test('all previously visible historical release translations are unchanged',()=>{
 const notes=require('../src/release-notes.js');for(const [version,languages] of Object.entries(gold.releases))for(const [code,digest] of Object.entries(languages)){const release=notes.RELEASES.find(r=>r.version===version);assert.ok(release,version);assert.equal(api.fingerprint(notes.itemsFor(release,code)),digest,version+' '+code);}
});
test('English fallback is independent of previously visited languages, and does not mutate network data',async()=>{
 const input={copy:{timer:'Un minuteur',settings:'',alarmRinging:null},bodies:{earth:['Terre']},phases:{}};
 const snapshot=JSON.stringify(input),{loader}=runtime({fetch:async()=>({ok:true,json:async()=>input})});
 const fr=await loader.load('fr');assert.equal(fr.copy.timer,'Un minuteur');assert.equal(fr.copy.settings,loader.fallback.copy.settings);assert.equal(fr.copy.alarmRinging,loader.fallback.copy.alarmRinging);assert.equal(fr.bodies.earth[1],loader.fallback.bodies.earth[1]);assert.equal(JSON.stringify(input),snapshot);
 assert.equal(fr.copy.helperChecksumLabel,'SHA-256');assert.equal(Object.getPrototypeOf(fr.copy).constructor.name,'Object');
 assert.match(read('src/app.js'),/LanguageData\.fallback\.copy\[key\]/);assert.doesNotMatch(read('src/app.js'),/COPY\.kor\?\.|Object\.assign\(bundle\.copy|STAR_DENSITY_COPY/);
});
test('parallel requests and repeated region reuse load only the chosen shared language once',async()=>{
 const {loader,requests}=runtime();const [a,b]=await Promise.all([loader.load('en'),loader.load('en')]);assert.equal(a,b);assert.equal(await loader.load('en'),a);assert.equal(requests.length,1);assert.equal(loader.loaded('fr'),false);
 assert.equal(fs.existsSync(path.join(root,'src/timer-copy.js')),false);assert.doesNotMatch(read('index.html'),/src\/timer-copy\.js/);
});
test('loader rejects invalid bundle shapes, clears pending work and retries rather than caching failure',async()=>{
 let attempt=0;const {loader}=runtime({fetch:async()=>({ok:true,json:async()=>++attempt===1?{copy:[]} : data('src/locales/fr.json')})});
 await assert.rejects(loader.load('fr'),/invalid/);assert.equal(loader.loaded('fr'),false);assert.equal((await loader.load('fr')).copy.settings,data('src/locales/fr.json').copy.settings);assert.equal(attempt,2);
});
test('a new missing target key or missing substitution blocks generation',()=>{
 const dir=sandbox();try{
  const original=data('i18n/locales/fr.json',dir),fr=JSON.parse(JSON.stringify(original));delete fr.ui.settings;write('i18n/locales/fr.json',fr,dir);assert.throws(()=>api.sync(dir,{write:true}),/fr:ui.settings: missing/);
  write('i18n/locales/fr.json',original,dir);const en=data('i18n/locales/en.json',dir);en.ui.newFeatureLabel='New feature';write('i18n/locales/en.json',en,dir);assert.throws(()=>api.compile(dir),/ui.newFeatureLabel: missing/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 const dir2=sandbox();try{const fr=data('i18n/locales/fr.json',dir2);fr.timer.timerTarget='Plus de temps';write('i18n/locales/fr.json',fr,dir2);assert.throws(()=>api.compile(dir2),/placeholders differ/);}finally{fs.rmSync(dir2,{recursive:true,force:true});}
});
test('duplicate JSON keys, unknown keys and cross-namespace collisions are rejected',()=>{
 assert.throws(()=>api.parse('{"a":"one","a":"two"}','test'),/duplicate key/);
 assert.throws(()=>api.parse('{"a":[{"x":1,"x":2}]}','test'),/duplicate key/);
 assert.deepEqual(api.parse('{"a":[{"x":"escaped \\\" {}"},true,false,null,12]}','test'),{a:[{x:'escaped " {}'},true,false,null,12]});
 const dir=sandbox();try{const fr=data('i18n/locales/fr.json',dir);fr.ui.timer='Collision';write('i18n/locales/fr.json',fr,dir);assert.throws(()=>api.compile(dir),/duplicate UI\/timer/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('directly editing generated output fails checks until rebuilt from the source',()=>{
 const dir=sandbox();try{fs.appendFileSync(path.join(dir,'src/locales/fr.json'),' ');assert.throws(()=>api.sync(dir),/Generated translation files differ/);assert.deepEqual(api.sync(dir,{write:true}).changed,['src/locales/fr.json']);assert.deepEqual(api.sync(dir).changed,[]);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('known inherited translations remain reported, not counted as complete, and source changes invalidate allowances',()=>{
 const compiled=api.compile(root);assert.equal(compiled.report.fullyTranslated,false);assert.equal(compiled.report.fallbacks.filter(x=>x.key.startsWith('timer.')).length,133);assert.equal(compiled.report.fallbacks.filter(x=>x.key.startsWith('release.')).length,116);assert.equal(compiled.report.placeholderVariantCount,4);
 assert.throws(()=>api.sync(root,{strict:true}),/not completed translations/);
 const dir=sandbox();try{const en=data('i18n/locales/en.json',dir);en.timer.shutdownUnknown+=' Updated meaning.';write('i18n/locales/en.json',en,dir);assert.throws(()=>api.compile(dir),/missing translation|changed fallback/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('source-only changes are reported before translation completeness, without reviewing generated duplication',()=>{
 const dir=sandbox();try{
  for(const args of [['init','-q'],['config','user.email','test@invalid.example'],['config','user.name','Test'],['add','i18n'],['commit','-qm','source baseline']]){const result=cp.spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  const en=data('i18n/locales/en.json',dir);en.ui.newFeatureLabel='New feature';write('i18n/locales/en.json',en,dir);
  const change=api.diff(dir,'HEAD');assert.equal(change.messages.length,1);assert.equal(change.messages[0].key,'ui.newFeatureLabel');assert.equal(change.messages[0].reviewLanguages.length,12);assert.throws(()=>api.diff(dir,'--bad'),/Invalid base/);assert.throws(()=>api.diff(dir,'not-a-ref'),/Unknown base/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('public HTML and literal UI references have canonical message keys',()=>{
 const copy=api.compile(root).bundles.en.copy,keys=new Set([...read('index.html').matchAll(/data-i18n(?:-aria|-title|-content)?="(\w+)"/g)].map(m=>m[1]));
 for(const file of ['src/app.js','src/timer-controller.js','src/music-player.js'])for(const match of read(file).matchAll(/\b(?:t|translate)\(['"](\w+)['"]/g))keys.add(match[1]);
 for(const key of keys)assert.ok(Object.hasOwn(copy,key),key);
});
