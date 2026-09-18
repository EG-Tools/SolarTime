'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/page-runtime.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness({revision='r4',manifest={version:'0.46',revision:'r4'},small=true,coarse=true,standalone=false,legacyStandalone=false,storageFails=false,visual={width:390,height:844,offsetTop:0,offsetLeft:0,scale:1}}={}){
 const classes=new Set(),windowEvents={},documentEvents={},queries={},requests=[],redirects=[],storage=new Map(),intervals=[];
 const state={now:1000000,manifest,networkFails:false},css=new Map(),frames=new Map(),visualEvents={},notices=[];let frameId=0;
 const element={style:{setProperty:(key,value)=>css.set(key,value),removeProperty:key=>css.delete(key)},classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)}};
 const document={documentElement:element,hidden:false,readyState:'loading',
  querySelector:selector=>selector.includes('solar-time-version')?{content:'0.46'}:selector.includes('solar-time-revision')?{content:revision}:null,
  addEventListener:(name,callback)=>documentEvents[name]=callback};
 const window={document,navigator:{standalone:legacyStandalone},innerWidth:390,innerHeight:844,
  location:{protocol:'https:',href:'https://solartime.example/?saved=1',host:'solartime.example',replace:url=>redirects.push(url)},
  matchMedia(query){return queries[query]={matches:query.includes('max-width')?small:query.includes('any-pointer')?coarse:standalone,addEventListener(_event,callback){this.changed=callback;}};},
  addEventListener:(name,callback)=>windowEvents[name]=callback,
  visualViewport:visual?{...visual,addEventListener:(name,callback)=>visualEvents[name]=callback}:null,
  Event:class{constructor(type){this.type=type;}},
  dispatchEvent(event){notices.push(event.type);windowEvents[event.type]?.(event);},
  requestAnimationFrame(callback){const id=++frameId;frames.set(id,callback);return id;},
  cancelAnimationFrame:id=>frames.delete(id),
  setInterval:(callback,ms)=>{intervals.push({callback,ms});return 1;},
  sessionStorage:{getItem(key){if(storageFails)throw Error('Storage blocked');return storage.get(key)||null;},setItem(key,value){if(storageFails)throw Error('Storage blocked');storage.set(key,value);}},
  async fetch(url,options){requests.push({url:String(url),options});if(state.networkFails)throw Error('Offline');return {ok:true,json:async()=>state.manifest};}
 };
 const context={window,URL,Date:class extends Date{static now(){return state.now;}},console};
 vm.runInNewContext(source,context);
 function tick(){const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(state.now);}
 return {window,document,state,queries,classes,windowEvents,documentEvents,requests,redirects,storage,intervals,css,frames,visualEvents,notices,tick};
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


test('standalone measures the visible viewport before body parsing, without guessing safe-area offsets',()=>{
 const h=harness({standalone:true,visual:{width:390,height:844,offsetTop:24,offsetLeft:0,scale:1}});
 assert.ok(h.classes.has('solar-standalone'));
 assert.equal(h.css.get('--solar-viewport-top'),'24px');assert.equal(h.css.get('--solar-viewport-height'),'844px');
 assert.equal(h.window.SolarPageRuntime.getViewport().source,'visualViewport');
 assert.equal(h.document.readyState,'loading');
});
test('ordinary browser tabs keep their original layout even when visual and layout viewport sizes differ',()=>{
 const h=harness({visual:{width:390,height:720,offsetTop:48,offsetLeft:0,scale:1}});
 assert.equal(h.css.size,0);assert.equal(h.window.SolarPageRuntime.getViewport(),null);
 h.visualEvents.resize();h.visualEvents.scroll();assert.equal(h.frames.size,0);
 assert.ok(!h.classes.has('solar-standalone'));
});
test('visual-only resize notifies the existing renderer resize path after updating CSS',()=>{
 const h=harness({standalone:true});h.tick();h.notices.length=0;
 h.window.visualViewport.height=780;h.visualEvents.resize();
 assert.equal(h.css.get('--solar-viewport-height'),'844px');h.tick();
 assert.equal(h.css.get('--solar-viewport-height'),'780px');assert.equal(h.notices.length,0);
 h.tick();assert.deepEqual(h.notices,['resize']);assert.equal(h.frames.size,0);
});
test('visual viewport scroll uses the measured origin and coalesces an event burst',()=>{
 const h=harness({legacyStandalone:true});h.tick();h.notices.length=0;
 Object.assign(h.window.visualViewport,{offsetTop:20.125,offsetLeft:3.125});
 for(let i=0;i<20;i++){h.visualEvents.scroll();h.visualEvents.resize();}
 assert.equal(h.frames.size,1);h.tick();h.tick();
 assert.equal(h.css.get('--solar-viewport-top'),'20.13px');assert.equal(h.css.get('--solar-viewport-left'),'3.13px');
 assert.deepEqual(h.notices,['resize']);assert.equal(h.frames.size,0);
});
test('unchanged viewport does not trigger an endless resize/paint loop',()=>{
 const h=harness({standalone:true});h.tick();h.notices.length=0;
 for(let i=0;i<5;i++){h.windowEvents.resize();h.visualEvents.resize();h.tick();}
 assert.equal(h.notices.length,0);assert.equal(h.frames.size,0);
});
test('pinch zoom never overwrites the unzoomed app rectangle',()=>{
 const h=harness({standalone:true});h.tick();h.notices.length=0;
 Object.assign(h.window.visualViewport,{width:195,height:422,scale:2,offsetTop:80});h.visualEvents.resize();h.tick();
 assert.equal(h.css.get('--solar-viewport-width'),'390px');assert.equal(h.css.get('--solar-viewport-top'),'0px');
 assert.equal(h.notices.length,0);
 Object.assign(h.window.visualViewport,{width:390,height:824,scale:1,offsetTop:20});h.visualEvents.resize();h.tick();h.tick();
 assert.equal(h.css.get('--solar-viewport-height'),'824px');assert.equal(h.css.get('--solar-viewport-top'),'20px');
});
test('no VisualViewport API falls back to the window size and refreshes on rotation',()=>{
 const h=harness({standalone:true,visual:null});h.tick();
 assert.equal(h.window.SolarPageRuntime.getViewport().source,'innerSize');
 h.window.innerWidth=844;h.window.innerHeight=390;h.windowEvents.orientationchange();h.tick();h.tick();
 assert.equal(h.css.get('--solar-viewport-width'),'844px');assert.equal(h.css.get('--solar-viewport-height'),'390px');
});
test('invalid visual geometry falls back safely and cannot write NaN or zero sizes',()=>{
 const h=harness({standalone:true,visual:{width:NaN,height:0,offsetTop:Infinity,scale:1}});h.tick();
 assert.equal(h.css.get('--solar-viewport-height'),'844px');assert.equal(h.css.get('--solar-viewport-top'),'0px');
 h.window.innerHeight=0;h.window.innerWidth=NaN;h.windowEvents.resize();
 assert.equal(h.css.get('--solar-viewport-height'),'844px');assert.equal(h.css.get('--solar-viewport-width'),'390px');
});
test('standalone exit clears viewport overrides rather than affecting subsequent browser mode',()=>{
 const h=harness({standalone:true});h.tick();
 h.queries['(display-mode:standalone)'].matches=false;h.queries['(display-mode:standalone)'].changed();h.tick();
 assert.ok(!h.classes.has('solar-standalone'));assert.equal(h.css.size,0);assert.equal(h.window.SolarPageRuntime.getViewport(),null);
});
test('foregrounding and persisted restoration resample standalone geometry',async()=>{
 const h=harness({standalone:true});await flush();h.tick();
 h.window.visualViewport.height=800;h.documentEvents.visibilitychange();h.tick();
 assert.equal(h.css.get('--solar-viewport-height'),'800px');
 h.window.visualViewport.height=844;h.windowEvents.pageshow({persisted:true});h.tick();
 assert.equal(h.css.get('--solar-viewport-height'),'844px');
});
test('standalone stage owns loading and scene coordinates without transforming native dialogs',()=>{
 const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),css=fs.readFileSync(path.join(root,'src/runtime-optimizations.css'),'utf8');
 assert.ok(html.indexOf('id="solar-viewport"')<html.indexOf('id="starfield"'));
 assert.ok(html.indexOf('id="loading"')<html.indexOf('</div>\n  <script id="solar-assets"'));
 assert.match(css,/#solar-viewport\{display:contents\}/);
 const stage=/html\.solar-standalone #solar-viewport\{([^}]+)\}/.exec(css)?.[1];assert.ok(stage);
 assert.match(stage,/position:fixed/);assert.match(stage,/height:var\(--solar-viewport-height,100%\)/);
 assert.doesNotMatch(stage,/transform|contain\s*:/);
 assert.match(css,/html\.solar-standalone \.loading[^}]*position:absolute/);
});


// Match the non-overlay Home Screen setting used by ReStartHuman. The shell,
// safe-area values and camera stay unchanged in this isolated status-bar fix.
test('Home Screen metadata selects one default status bar before startup scripts',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)];
 const settings=tags.filter(match=>/name=["']apple-mobile-web-app-status-bar-style["']/i.test(match[0]));
 assert.equal(settings.length,1,'A single declaration avoids conflicting install metadata');
 assert.match(settings[0][0],/content=["']default["']/);
 assert.ok(settings[0].index<html.indexOf('<script'),'The setting must be present before startup');
 assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'));
 assert.ok(html.includes('viewport-fit=cover'),'Do not change viewport-fit or safe-area policy here');
 const release=JSON.parse(fs.readFileSync(path.join(__dirname,'../version.json'),'utf8'));
 const css=fs.readFileSync(path.join(__dirname,'../src/runtime-optimizations.css'),'utf8');
 assert.ok(css.includes('--solar-layout-revision:'+release.revision+'}'));
});

test('an existing r5 Home Screen page detects the newer status-bar page build',async()=>{
 const release=JSON.parse(fs.readFileSync(path.join(__dirname,'../version.json'),'utf8'));
 const h=harness({revision:'r5',manifest:release,standalone:true});await flush();
 assert.equal(h.redirects.length,1);
 const next=new URL(h.redirects[0]);
 assert.equal(next.searchParams.get('revision'),release.revision);
 assert.equal(next.searchParams.get('saved'),'1');
});

test('layout diagnostics expose the declared status-bar setting without inferring native state',()=>{
 const h=harness({revision:'r6',standalone:true});
 const query=h.document.querySelector;
 h.document.querySelector=selector=>selector==='meta[name="apple-mobile-web-app-status-bar-style"]'?{content:'default'}:query(selector);
 h.window.getComputedStyle=()=>({getPropertyValue:()=>''});
 const info=h.window.SolarPageRuntime.layoutInfo();
 assert.equal(info.statusBarMeta,'default');
 assert.equal(info.mode,'standalone');
 assert.equal(info.build,'0.46 r6');
});
