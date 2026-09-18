'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/page-runtime.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({revision='r4',manifest={version:'0.46',revision:'r4'},small=true,coarse=true,standalone=false,legacyStandalone=false,storageFails=false}={}){
 const classes=new Set(),windowEvents={},documentEvents={},queries={},requests=[],redirects=[],storage=new Map(),intervals=[];
 const state={now:1000000,manifest,networkFails:false};
 const element={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)}};
 const document={documentElement:element,hidden:false,readyState:'loading',
  querySelector:selector=>selector.includes('solar-time-version')?{content:'0.46'}:selector.includes('solar-time-revision')?{content:revision}:null,
  addEventListener:(name,callback)=>documentEvents[name]=callback};
 const window={document,navigator:{standalone:legacyStandalone},innerWidth:390,innerHeight:844,
  location:{protocol:'https:',href:'https://solartime.example/?saved=1',host:'solartime.example',replace:url=>redirects.push(url)},
  matchMedia(query){return queries[query]={matches:query.includes('max-width')?small:query.includes('any-pointer')?coarse:standalone,addEventListener(_event,callback){this.changed=callback;}};},
  addEventListener:(name,callback)=>windowEvents[name]=callback,
  setInterval:(callback,ms)=>{intervals.push({callback,ms});return 1;},
  sessionStorage:{getItem(key){if(storageFails)throw Error('Storage blocked');return storage.get(key)||null;},setItem(key,value){if(storageFails)throw Error('Storage blocked');storage.set(key,value);}},
  async fetch(url,options){requests.push({url:String(url),options});if(state.networkFails)throw Error('Offline');return {ok:true,json:async()=>state.manifest};}
 };
 const context={window,URL,Date:class extends Date{static now(){return state.now;}},console};
 vm.runInNewContext(source,context);
 return {window,document,state,queries,classes,windowEvents,documentEvents,requests,redirects,storage,intervals};
}
test('unchanged r3 is not an update, but foregrounding detects r4 within five minutes',async()=>{
 const h=harness({revision:'r3',manifest:{version:'0.46',revision:'r3'}});await flush();
 assert.equal(h.requests.length,1);assert.equal(h.redirects.length,0);
 h.state.manifest={version:'0.46',revision:'r4'};h.state.now+=1000;
 h.document.hidden=true;h.documentEvents.visibilitychange();await flush();assert.equal(h.requests.length,1);
 h.document.hidden=false;h.documentEvents.visibilitychange();await flush();
 assert.equal(h.requests.length,2);assert.equal(h.redirects.length,1);
 const next=new URL(h.redirects[0]);assert.equal(next.searchParams.get('revision'),'r4');assert.equal(next.searchParams.get('saved'),'1');assert.ok(next.searchParams.get('refresh'));
});
test('persisted pageshow checks immediately, while initial pageshow avoids duplicate fetches',async()=>{
 const h=harness();await flush();h.windowEvents.pageshow({persisted:false});await flush();assert.equal(h.requests.length,1);
 h.windowEvents.pageshow({persisted:true});await flush();assert.equal(h.requests.length,2);
});
test('visible pages poll every five minutes; hidden pages do not make requests',async()=>{
 const h=harness();await flush();assert.equal(h.intervals.length,1);assert.equal(h.intervals[0].ms,300000);
 h.state.now+=300000;h.document.hidden=true;await h.intervals[0].callback();assert.equal(h.requests.length,1);
 h.document.hidden=false;await h.intervals[0].callback();assert.equal(h.requests.length,2);
 assert.equal(h.requests[1].options.cache,'no-store');assert.match(h.requests[1].url,/version\.json\?check=/);
});
test('blocked session storage does not prevent an update and concurrent checks coalesce',async()=>{
 const h=harness({storageFails:true,manifest:{version:'0.46',revision:'r5'}});
 await Promise.all([h.window.SolarPageRuntime.checkForUpdate(true),h.window.SolarPageRuntime.checkForUpdate(true)]);await flush();
 assert.equal(h.requests.length,1);assert.equal(h.redirects.length,1);
});
test('offline update checks keep the page usable and can retry on foreground',async()=>{
 const h=harness();await flush();h.state.networkFails=true;await h.window.SolarPageRuntime.checkForUpdate(true);assert.equal(h.redirects.length,0);
 h.state.networkFails=false;h.state.manifest={version:'0.46',revision:'r5'};h.documentEvents.visibilitychange();await flush();assert.equal(h.redirects.length,1);
});
test('revision ordering is numeric and older or malformed manifests cannot cause reloads',async()=>{
 for(const revision of ['r2','r4','r0','r4-malformed','']){
  const h=harness({manifest:{version:'0.46',revision}});await flush();assert.equal(h.redirects.length,0,revision);
 }
 const h=harness({revision:'r9',manifest:{version:'0.46',revision:'r10'}});await flush();assert.equal(h.redirects.length,1);
});
test('a recent attempted revision cannot create a stale-manifest reload loop',async()=>{
 const h=harness();await flush();h.storage.set('solar-time.update-attempt',JSON.stringify({version:'0.46',revision:'r5',at:h.state.now}));
 h.state.manifest={version:'0.46',revision:'r5'};await h.window.SolarPageRuntime.checkForUpdate(true);assert.equal(h.redirects.length,0);
});
test('phone layout supports coarse input and both forms of installed-app detection',async()=>{
 for(const options of [{coarse:true},{coarse:false,standalone:true},{coarse:false,legacyStandalone:true}]){
  const h=harness(options);await flush();assert.ok(h.classes.has('solar-phone-layout'),JSON.stringify(options));
 }
 for(const options of [{small:true,coarse:false},{small:false,coarse:true}]){
  const h=harness(options);await flush();assert.ok(!h.classes.has('solar-phone-layout'),JSON.stringify(options));
 }
 const h=harness();await flush();const q=h.queries['(max-width:680px), (max-height:630px)'];q.matches=false;q.changed();assert.ok(!h.classes.has('solar-phone-layout'));
});
test('page build metadata matches the release manifest independently of unchanged code bundles',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),release=JSON.parse(fs.readFileSync(path.join(__dirname,'../version.json'),'utf8'));
 const value=name=>new RegExp('<meta name="'+name+'" content="([^"]+)"').exec(html)?.[1];
 assert.equal(value('solar-time-version'),release.version);assert.equal(value('solar-time-revision'),release.revision);
 assert.ok(html.includes('src/page-runtime.js?v='+release.version+'-'+release.revision));
 assert.ok(html.includes('src/runtime-optimizations.css?v='+release.version+'-'+release.revision));
 const h=harness();assert.equal(h.window.SolarBuild.revision,'r4');
});
test('software sky shading uses the same phone flag and never reuses a shaded ray table on phones',()=>{
 let phone=false;
 const window={document:{documentElement:{classList:{contains:()=>phone}}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/sky.js'),'utf8'),{window});
 const sky=Object.create(window.SolarSky.prototype);sky.tanFov=.7;sky.rayTables=new Map();
 const shaded=sky.rayTable(8,8,1);assert.ok(shaded[3]<1);
 phone=true;const flat=sky.rayTable(8,8,1);assert.notEqual(flat,shaded);for(let i=3;i<flat.length;i+=4)assert.equal(flat[i],1);
 phone=false;assert.equal(sky.rayTable(8,8,1),shaded);
});
