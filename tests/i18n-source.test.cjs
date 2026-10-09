'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),api=require('../tools/i18n.cjs'),gold=require('./fixtures/i18n-v061.json');
const read=(file,dir=root)=>fs.readFileSync(path.join(dir,file),'utf8');
const data=(file,dir=root)=>JSON.parse(read(file,dir));
const write=(file,value,dir)=>fs.writeFileSync(path.join(dir,file),JSON.stringify(value,null,2)+'\n');
function sandbox(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solar-i18n-'));fs.cpSync(path.join(root,'i18n'),path.join(dir,'i18n'),{recursive:true});fs.mkdirSync(path.join(dir,'src'));fs.cpSync(path.join(root,'src/locales'),path.join(dir,'src/locales'),{recursive:true});for(const f of ['language-data.js','language-file-copy.js','release-notes.js','consent.js','google-analytics.js','microsoft-clarity.js','policy-dialog.js'])fs.copyFileSync(path.join(root,'src',f),path.join(dir,'src',f));for(const f of ['CHANGELOG.md','changelog.html','site-info.css'])fs.copyFileSync(path.join(root,f),path.join(dir,f));return dir;}
function runtime({protocol='https:',fetch:fetchFn}={}){
 const requests=[],scripts=[],location={protocol,href:protocol==='file:'?'file:///D:/SolarTime/index.html':'https://solar.test/'},window={};let context;
 const document={currentScript:{src:new URL('src/language-data.js',location.href).href},createElement:()=>({}),head:{appendChild:script=>{scripts.push(script.src);vm.runInContext(read('src/language-file-copy.js'),context);script.onload?.();}}};
 context=vm.createContext({window,location,document,URL,AbortSignal,fetch:async url=>{requests.push(String(url));if(fetchFn)return fetchFn(url);const code=/\/([a-z]+)\.json/.exec(String(url))[1];return {ok:true,json:async()=>data('src/locales/'+code+'.json')};}});
 vm.runInContext(read('src/language-data.js'),context);const installFileCopy=()=>{vm.runInContext(read('src/language-file-copy.js'),context);return window.SolarModules.LanguageFileCopy;};return {loader:window.SolarModules.LanguageData,requests,scripts,installFileCopy};
}
test('all generated translations are deterministic and current',()=>{
 const a=api.sync(root);assert.deepEqual(a.changed,[]);assert.equal(a.report.languages,15);assert.deepEqual(api.sync(root).changed,[]);
 const version=data('version.json');assert.equal(api.compile(root).releases[0].version,version.version);
 const compiled=api.compile(root),archive=compiled.archive;assert.ok(Number(archive[0].version)<Number(compiled.releases.at(-1).version));assert.equal(archive.at(-1).version,'0.01');
 assert.match(read('changelog.html'),/Complete Update History/);assert.match(read('changelog.html'),/id="v0\.01"/);
 for(const file of ['tools/build-pages.cjs','tools/cloudflare-site.cjs'])assert.match(read(file),/require\('\.\/i18n\.cjs'\)\.sync\(root\)/);
});
test('all 15 web and file-language bundles preserve approved interface, timer, body and phase text',async()=>{
 // UI fingerprints include the approved orbit label, + shortcut and current mouse accessibility guidance.
 // Historical release and automatic-language baselines remain unchanged.
 const compiled=api.compile(root);
 for(const protocol of ['https:','file:']){
  const environment=runtime({protocol}),{loader}=environment;
  for(const code of compiled.codes){const bundle=await loader.load(code);const previous={...bundle,copy:{...bundle.copy}};for(const key of ['music','openingTravel','openingDefault','openingNone','openingReload','cookieSettings','cookieDismiss','cookieChoiceNote','defaultCamera','savedCameras','planetSwitch','trackBody','zoomInOut','cameraRotate','cameraTravel','screenPan','releaseNotesAll','atmosphericClouds','ringTravel','ringTravelStarted','ringTravelUnavailable'])delete previous.copy[key];assert.equal(api.fingerprint(previous),gold[protocol==='file:'?'file':'web'][code],protocol+' '+code);assert.equal(api.fingerprint(loader.automaticLabels[code]),api.fingerprint(gold.automaticLabels[code]));assert.ok(Object.isFrozen(bundle)&&Object.isFrozen(bundle.copy));}
  assert.equal(environment.scripts.length,protocol==='file:'?1:0,protocol+' compatibility payload');
 }
});

test('web startup excludes the direct-file compatibility payload',()=>{
 const html=read('index.html'),loader=read('src/language-data.js'),fileCopy=read('src/language-file-copy.js');
 assert.doesNotMatch(html,/language-file-copy\.js/);assert.doesNotMatch(loader,/const legacyFileCopy=/);assert.match(loader,/location\.protocol==='file:'[\s\S]*loadFileCopy\(\)/);assert.ok(Buffer.byteLength(loader)<Buffer.byteLength(fileCopy));
});
test('all retained historical release translations are unchanged',()=>{
 const notes=require('../src/release-notes.js');for(const [version,languages] of Object.entries(gold.releases))for(const [code,digest] of Object.entries(languages)){const release=notes.RELEASES.find(r=>r.version===version);assert.ok(release,version);assert.equal(api.fingerprint(notes.itemsFor(release,code)),digest,version+' '+code);}
});

test('ring travel labels are localized for all languages including older file-launch bundles',()=>{
 const {loader,installFileCopy}=runtime({protocol:'file:'}),fileCopy=installFileCopy(),compiled=api.compile(root);
 for(const code of compiled.codes){
  const bundle=loader.resolveBundle({copy:{},bodies:{},phases:{}},code,{local:true,fileCopy});
  for(const key of ['ringTravel','ringTravelStarted','ringTravelUnavailable']){
   assert.equal(bundle.copy[key],compiled.bundles[code].copy[key],code+' '+key);
   assert.ok(data('i18n/locales/'+code+'.json').ui[key].trim(),code+' '+key);
  }
 }
 assert.equal(compiled.bundles.kor.copy.ringTravel,'여행');assert.equal(compiled.bundles.en.copy.ringTravel,'Travel');
});

test('footer shows mean orbit first and size-distance scale second in every language',()=>{
 const compiled=api.compile(root);
 for(const code of compiled.codes){
  const lines=compiled.bundles[code].copy.scaleNoteLineOne.split('\n');
  assert.equal(lines.length,2,code);assert.ok(lines.every(line=>line.trim()),code);
 }
 assert.equal(compiled.bundles.kor.copy.scaleNoteLineOne,'평균 궤도 근사\n크기 거리 측정 조정');
 assert.equal(compiled.bundles.en.copy.scaleNoteLineOne,'Mean orbit approximation\nAdjusted size and distance scale');
 assert.ok(read('styles.css').includes('.signature [data-i18n="scaleNoteLineOne"]{white-space:pre}'));
});
test('English fallback is independent of previously visited languages, and does not mutate network data',async()=>{
 const input={copy:{timer:'Un minuteur',settings:'',alarmRinging:null},bodies:{earth:['Terre']},phases:{}};
 const snapshot=JSON.stringify(input),{loader}=runtime({fetch:async()=>({ok:true,json:async()=>input})});
 const fr=await loader.load('fr');assert.equal(fr.copy.timer,'Un minuteur');assert.equal(fr.copy.settings,loader.fallback.copy.settings);assert.equal(fr.copy.alarmRinging,loader.fallback.copy.alarmRinging);assert.equal(fr.bodies.earth[1],loader.fallback.bodies.earth[1]);assert.equal(JSON.stringify(input),snapshot);
 assert.equal(fr.copy.helperChecksumLabel,'SHA-256');assert.equal(Object.getPrototypeOf(fr.copy).constructor.name,'Object');
 assert.match(read('src/app.js'),/LanguageData\.fallback\.copy\[key\]/);assert.doesNotMatch(read('src/app.js'),/COPY\.kor\?\.|Object\.assign\(bundle\.copy|STAR_DENSITY_COPY/);
});
test('direct file launches overlay the current localized help introduction on an older public bundle',()=>{
 const {loader,installFileCopy}=runtime({protocol:'file:'}),old={copy:{helpIntroPurpose:'Old public fallback'},bodies:{},phases:{}};
 const bundle=loader.resolveBundle(old,'kor',{local:true,fileCopy:installFileCopy()}),current=data('src/locales/kor.json').copy;
 for(const key of ['helpIntroTitle','helpIntroPurpose','helpIntroExperience','helpIntroDesktop','helpFeatures','helpFeatureSolar','helpFeatureTime','helpFeatureMusic','helpFeatureTimer'])assert.equal(bundle.copy[key],current[key],key);
 for(const key of ['defaultCamera','savedCameras','planetSwitch','trackBody','zoomInOut','cameraRotate','cameraTravel','screenPan'])assert.equal(bundle.copy[key],current[key],key);
 assert.deepEqual(['defaultCamera','savedCameras','planetSwitch','trackBody','zoomInOut','cameraRotate','cameraTravel','screenPan'].map(key=>bundle.copy[key]),['기본 시점','저장된 시점','행성 전환','천체 추적','줌인·아웃','회전','전진·후진','이동']);
 assert.equal(current.helpIntroTitle,'우주 속 한순간');
 assert.equal(current.helpIntroPurpose,'Solar Time은 현재 시각과 행성의 움직임을 담은 웹 기반 태양계 시계입니다.\n일과 공부중 잠시 쉬고 싶을때 감상하는 화면보호기 용도로 만들어졌습니다.');
 assert.equal(current.helpIntroExperience,'잔잔한 배경음악과 함께 태양계를 감상하고,\n카메라를 이용해서 나만의 우주 풍경을 만들어 보세요.');
 assert.equal(current.helpIntroDesktop,'이 프로그램은 데스크톱 PC 환경에 최적화되어 있습니다.');
 for(const code of api.compile(root).codes){const copy=data('src/locales/'+code+'.json').copy;assert.doesNotMatch(copy.helpIntroTitle,/^Solar Time - /,code);for(const key of ['helpIntroPurpose','helpIntroExperience','helpFeatureTime','helpFeatureMusic','helpFeatureTimer'])assert.ok(copy[key].includes('\n'),`${code} ${key}`);}
 assert.match(read('styles.css'),/\[data-i18n="helpIntroPurpose"\],[^}]+\.help-feature-list li\{white-space:pre-line\}/);
});
test('all language accessibility instructions override the obsolete remote wheel-mode toggle',()=>{
 const {loader,installFileCopy}=runtime({protocol:'file:'}),fileCopy=installFileCopy();
 for(const code of api.compile(root).codes){
  const bundle=loader.resolveBundle({copy:{universeAria:'Obsolete Zoom/Move control'},bodies:{},phases:{}},code,{local:true,fileCopy});
  assert.equal(bundle.copy.universeAria,data('src/locales/'+code+'.json').copy.universeAria,code);
 }
 assert.match(data('src/locales/kor.json').copy.universeAria,/휠로 전진·후진.*우클릭 드래그로 광각·망원/);
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
 const compiled=api.compile(root);assert.equal(compiled.report.fullyTranslated,false);assert.equal(compiled.report.fallbacks.filter(x=>x.key.startsWith('timer.')).length,133);assert.equal(compiled.report.fallbacks.filter(x=>x.key.startsWith('release.')).length,0);assert.equal(compiled.report.placeholderVariantCount,4);
 assert.throws(()=>api.sync(root,{strict:true}),/not completed translations/);
 const dir=sandbox();try{const en=data('i18n/locales/en.json',dir);en.timer.shutdownUnknown+=' Updated meaning.';write('i18n/locales/en.json',en,dir);assert.throws(()=>api.compile(dir),/missing translation|changed fallback/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('source-only changes are reported before translation completeness, without reviewing generated duplication',()=>{
 const dir=sandbox();try{
  for(const args of [['init','-q'],['config','user.email','test@invalid.example'],['config','user.name','Test'],['add','i18n'],['commit','-qm','source baseline']]){const result=cp.spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  const en=data('i18n/locales/en.json',dir);en.ui.newFeatureLabel='New feature';write('i18n/locales/en.json',en,dir);
  const change=api.diff(dir,'HEAD');assert.equal(change.messages.length,1);assert.equal(change.messages[0].key,'ui.newFeatureLabel');assert.equal(change.messages[0].reviewLanguages.length,14);assert.throws(()=>api.diff(dir,'--bad'),/Invalid base/);assert.throws(()=>api.diff(dir,'not-a-ref'),/Unknown base/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('public HTML and literal UI references have canonical message keys',()=>{
 const copy=api.compile(root).bundles.en.copy,keys=new Set([...read('index.html').matchAll(/data-i18n(?:-aria|-title|-content)?="(\w+)"/g)].map(m=>m[1]));
 for(const file of ['src/app.js','src/timer-controller.js','src/music-player.js'])for(const match of read(file).matchAll(/\b(?:t|translate)\(['"](\w+)['"]/g))keys.add(match[1]);
 for(const key of keys)assert.ok(Object.hasOwn(copy,key),key);
});

test('music shortcut keeps current Korean and English labels with old file-launch bundles',async()=>{
 for(const protocol of ['file:','https:']){
  const {loader}=runtime({protocol,fetch:async()=>({ok:true,json:async()=>protocol==='file:'?{copy:{music:'Background Music'},bodies:{},phases:{}}:data('src/locales/kor.json')})});
  assert.equal((await loader.load('kor')).copy.music,'배경 음악');
 }
 const {loader,installFileCopy}=runtime({protocol:'file:'});
 assert.equal(loader.resolveBundle({copy:{},bodies:{},phases:{}},'en',{local:true,fileCopy:installFileCopy()}).copy.music,'Background Music');
});

test('file launches retain current shutdown translations with older server bundles',async()=>{
 const compiled=api.compile(root);
 for(const code of compiled.codes){
  const {loader}=runtime({protocol:'file:',fetch:async()=>({ok:true,json:async()=>({copy:{helperDownloadTitle:'Old title'},bodies:{},phases:{}})})});
  const bundle=await loader.load(code);
  for(const key of ['shutdownAvailable','shutdownUnavailable','shutdownHelperNote','shutdownDataWarning','helperDownloadTitle','helperDownloadDescription','helperDownloadPrivacy','helperDownloadQuestion'])assert.equal(bundle.copy[key],compiled.bundles[code].copy[key],code+': '+key);
 }
});

test('latest release uses reviewed translations; explicit Korean-only fixtures remain validated',()=>{
 const compiled=api.compile(root),release=compiled.releases[0],runtime=require('../src/release-notes.js');
 assert.equal(release.languagePolicy,undefined);assert.deepEqual(Object.keys(release.localized).sort(),[...compiled.codes].sort());
 for(const code of compiled.codes)assert.deepEqual(runtime.itemsFor(runtime.RELEASES[0],code),release.localized[code]);
 const dir=sandbox();try{
  const entries=data('i18n/releases.json',dir);entries[0].languagePolicy='korean-only';entries[0].localized={kor:entries[0].localized.kor};entries[0].localized.en=['Not an approved translation'];write('i18n/releases.json',entries,dir);
  assert.throws(()=>api.compile(dir),/Invalid Korean-only release/);
  delete entries[0].localized.en;delete entries[0].languagePolicy;write('i18n/releases.json',entries,dir);
  assert.throws(()=>api.compile(dir),/Missing release base text/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('early locale request is shared with hydration and uses the loading-label language',async()=>{
 const {loader,requests}=runtime(),app=read('src/app.js');
 const values=require('./helpers/region-metadata.cjs').metadata(),regions={LANG_ORDER:values.order,LANG_META:values.meta};
 const source=app.slice(app.indexOf('  function showLoadingLanguage(){'),app.indexOf('  const COPY=Object.create(null)'));
 const label={style:{visibility:'hidden'}},context={...regions,Preferences:{read:()=>({language:'fr',languageMode:'manual'})},STORAGE_KEY:'test',detectedCopyLanguage:()=> 'kor',LanguageData:loader,COPY_META:loader.metadata,document:{documentElement:{},querySelector:()=>label}};
 vm.runInNewContext(source,context);
 assert.equal(requests.length,1);assert.match(requests[0],/\/fr\.json\?v=/);
 assert.equal(label.textContent,loader.loadingText.fr);
 await loader.load('fr');assert.equal(requests.length,1,'hydration shares the early download');
});

test('loading bootstrap uses canonical saved-region or AUTO copy before fetching a bundle',()=>{
 const {loader,requests}=runtime(),app=read('src/app.js');
 const values=require('./helpers/region-metadata.cjs').metadata(),regions={LANG_ORDER:values.order,LANG_META:values.meta};
 const bootstrap=app.match(/function showLoadingLanguage\(\)\{[\s\S]*?\n  \}/)[0];
 for(const [region,meta]of Object.entries(regions.LANG_META)){
  const label={style:{visibility:'hidden'}},document={documentElement:{},querySelector:()=>label};
  vm.runInNewContext('('+bootstrap+')()',{...regions,Preferences:{read:()=>({language:region,languageMode:'manual'})},STORAGE_KEY:'test',detectedCopyLanguage:()=>{throw Error('Manual choice must win');},LanguageData:loader,COPY_META:loader.metadata,document});
  assert.equal(label.textContent,data('src/locales/'+meta.copy+'.json').copy.loading,region);
  assert.equal(label.style.visibility,'');assert.equal(document.documentElement.lang,loader.metadata[meta.copy].html);
 }
 for(const saved of [null,{language:'kor',languageMode:'auto'},{language:'invalid',languageMode:'manual'}]){
  const label={style:{visibility:'hidden'}},document={documentElement:{},querySelector:()=>label};
  vm.runInNewContext('('+bootstrap+')()',{...regions,Preferences:{read:()=>saved},STORAGE_KEY:'test',detectedCopyLanguage:()=> 'fr',LanguageData:loader,COPY_META:loader.metadata,document});
  assert.equal(label.textContent,loader.loadingText.fr);
 }
 assert.deepEqual(requests,[],'boot message never waits on a translation request');
 assert.match(read('index.html'),/data-i18n="loading" style="visibility:hidden"/);
});
