'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../src/ui-runtime.js'),'utf8');
class Element extends EventTarget{
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.id=tag;this.hidden=true;this.open=false;this.dataset={};this.classes=new Set();this.removed=false;this.scrollTop=0;this.scrollHeight=300;this.clientHeight=100;this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
 getBoundingClientRect(){return {left:20,top:20,right:220,bottom:220};}
 remove(){this.removed=true;}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
 closest(){return this.selectable?this:null;}
}
function harness(reduced=true){
 const timers=new Map(),frames=new Map(),nodes=[],observers=[];let serial=0;
 const doc=new Element();doc.documentElement=new Element('html');doc.createElement=tag=>new Element(tag);doc.head={append:e=>nodes.push(e)};
 const root={document:doc,matchMedia:()=>({matches:reduced}),setTimeout:f=>{const id=++serial;timers.set(id,f);return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>{const id=++serial;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{constructor(f){this.callback=f;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}};
 vm.runInNewContext(code,{window:root});
 return {root,doc,ui:root.SolarModules.UI,timers,frames,nodes,observers,runTimers(){const a=[...timers.values()];timers.clear();a.forEach(f=>f());}};
}
function pointer(el,type,x,y){const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y});el.dispatchEvent(e);return e;}

function escapeHarness(keyboard){
 const h=harness(),events=new EventTarget();
 h.root.addEventListener=events.addEventListener.bind(events);h.root.removeEventListener=events.removeEventListener.bind(events);
 const capture=h.ui.bindFullscreenEscape(h.doc,keyboard);
 return {...h,capture,events,fullscreen(value){h.doc.fullscreenElement=value?h.doc.documentElement:null;h.doc.dispatchEvent(new Event('fullscreenchange'));}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('fullscreen captures only Escape, then releases it on exit and UI disposal',async()=>{
 const calls=[];let releases=0;
 const h=escapeHarness({lock:async keys=>calls.push([...keys]),unlock(){releases++;}});
 assert.equal(h.capture.state,'native');assert.equal(calls.length,0);
 h.fullscreen(true);h.fullscreen(true);assert.equal(h.capture.state,'pending');await settle();
 assert.deepEqual(calls,[['Escape']]);assert.equal(h.capture.state,'locked');
 h.fullscreen(false);assert.equal(h.capture.state,'native');assert.equal(releases,1);
 h.fullscreen(true);await settle();h.ui.dispose();assert.equal(releases,2);assert.equal(h.capture.state,'native');
 h.fullscreen(true);await settle();assert.equal(calls.length,2,'disposed owner cannot recapture');
});
test('stale keyboard permission completions cannot re-lock an exited or newer fullscreen session',async()=>{
 const pending=[];let releases=0;
 const h=escapeHarness({lock:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),unlock(){releases++;}});
 h.fullscreen(true);h.fullscreen(false);pending[0].resolve();await settle();assert.equal(h.capture.state,'native');
 h.fullscreen(true);h.fullscreen(false);h.fullscreen(true);
 pending[1].reject(Error('old request'));await settle();assert.equal(h.capture.state,'pending');
 pending[2].resolve();await settle();assert.equal(h.capture.state,'locked');
 h.fullscreen(false);h.fullscreen(true);h.capture.dispose();pending[3].resolve();await settle();
 assert.equal(h.capture.state,'native');assert.equal(releases,4);
});
test('unsupported or denied keyboard capture safely retains native fullscreen exit without retry loops',async()=>{
 const unsupported=escapeHarness();unsupported.fullscreen(true);assert.equal(unsupported.capture.state,'unavailable');
 let attempts=0;
 const denied=escapeHarness({lock:async()=>{attempts++;throw Error('permission denied');},unlock(){throw Error('not owned');}});
 denied.fullscreen(true);await settle();assert.equal(denied.capture.state,'unavailable');
 denied.fullscreen(true);await settle();assert.equal(attempts,1);
 denied.fullscreen(false);assert.equal(denied.capture.state,'native');denied.fullscreen(true);await settle();assert.equal(attempts,2);
});
test('page suspension releases Escape and bfcache restoration obtains a fresh capture',async()=>{
 let attempts=0,releases=0;
 const h=escapeHarness({lock:async()=>{attempts++;},unlock(){releases++;}});
 h.fullscreen(true);await settle();h.events.dispatchEvent(new Event('pagehide'));assert.equal(releases,1);assert.equal(h.capture.state,'native');
 h.events.dispatchEvent(new Event('pageshow'));await settle();assert.equal(attempts,2);assert.equal(h.capture.state,'locked');
 h.capture.dispose();h.events.dispatchEvent(new Event('pageshow'));assert.equal(attempts,2);
});
test('Escape cancels flight first, then exits fullscreen without restarting or cutting the return',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),body=source.match(/function handleEscape\(\) \{[\s\S]*?\n      \}/)[0];
 const doc={fullscreenElement:{}},tour={state:'cruising',stops:0,stop(){if(this.state!=='cruising')return false;this.stops++;this.state='returning';return true;}};
 const renderer={ringTour:tour};let exits=0;
 const escape=vm.runInNewContext('('+body+')',{openingReplayLocked:false,openingActive:false,renderer,document:doc,exitFullscreen(){exits++;doc.fullscreenElement=null;}});
 escape();assert.equal(tour.state,'returning');assert.equal(exits,0);assert.ok(doc.fullscreenElement);
 escape();assert.equal(exits,1);assert.equal(renderer.ringTour,tour);assert.equal(tour.stops,1);
 escape();assert.equal(exits,1);assert.equal(tour.stops,1);
 renderer.ringTour=null;doc.fullscreenElement={};escape();assert.equal(exits,2,'no flight: first Escape exits fullscreen');
});
test('Escape during an opening or departure cancels pending resume and restores its destination',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),body=source.match(/function handleEscape\(\) \{[\s\S]*?\n      \}/)[0];
 for(const departing of [false,true]){
  const calls=[],context={openingReplayLocked:false,openingActive:true,openingDeparture:departing,resumeTravel:true,
   openingCameraTarget:{zoom:.1,dolly:.002,panX:.2},renderer:{animateCamera(target){assert.equal(target,context.openingCameraTarget);calls.push('return');}},finishOpening(){calls.push('unlock');context.openingActive=false;}};
  vm.runInNewContext('('+body+')',context)();
  assert.equal(context.openingActive,false);assert.equal(context.openingDeparture,false);assert.equal(context.resumeTravel,false);
  assert.deepEqual(calls,['unlock','return']);
 }
});

test('opening selection keeps the normal rotation blend unless Saturn was selected',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),body=source.match(/function beginOpening\(mono=performance\.now\(\)\)\{[\s\S]*?\n      \}/)[0];
 for(const mode of ['default','saturn']){
  const blend={seconds:0,yaw:0,pitch:0},calls=[];
  const renderer={prepareOpeningTour(){calls.push('prepare');},animateOpeningCamera(){this.cameraTween={duration:5000,rotationBlend:blend};return true;},keepOpeningParticlesUntilBoarding(){calls.push('particles');}};
  const context={openingRunMode:mode,resumeTravel:mode==='saturn',openingCameraTarget:{zoom:1,dolly:1},renderer,lockOpeningControls(){},loading:{classList:{add(){}}}};
  assert.equal(vm.runInNewContext('('+body+')',context)(100),true);
  assert.equal(context.openingStartedAt,100);
  if(mode==='default'){
   assert.equal(renderer.cameraTween.rotationBlend,blend);assert.equal(renderer.cameraTween.flyThrough,undefined);assert.deepEqual(calls,[]);
  }else{
   assert.equal(renderer.cameraTween.rotationBlend,null);assert.equal(renderer.cameraTween.flyThrough,true);assert.deepEqual(calls,['prepare','particles']);
  }
 }
});

test('Escape cannot interrupt a locked T warp',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8'),body=source.match(/function handleEscape\(\) \{[\s\S]*?\n      \}/)[0];
 assert.doesNotThrow(()=>vm.runInNewContext('('+body+')',{openingReplayLocked:true})());
});

test('top dialog alone closes; a fading card consumes repeated Escape',()=>{const h=harness(false),help=new Element('dialog'),info=new Element('dialog');for(const d of [help,info]){h.ui.bindDialog(d,()=>h.ui.hide(d,()=>d.close()));h.ui.show(d,()=>d.showModal());}assert.equal(h.ui.topDialog(),info);h.ui.dismissTopDialog();assert.ok(info.open&&help.open);h.ui.dismissTopDialog();h.runTimers();assert.equal(info.open,false);assert.ok(help.open);h.ui.dismissTopDialog();h.runTimers();assert.equal(help.open,false);assert.equal(h.ui.dismissTopDialog(),false);});
test('dialog padding stays open; genuine backdrop clicks close',()=>{const h=harness(),d=new Element('dialog');h.ui.bindDialog(d,()=>h.ui.hide(d,()=>d.close()));h.ui.show(d,()=>d.showModal());pointer(d,'pointerdown',25,25);pointer(d,'click',25,25);assert.ok(d.open);pointer(d,'pointerdown',0,0);pointer(d,'click',0,0);assert.equal(d.open,false);});
test('dragging out of a card is not an outside click',()=>{const h=harness(),d=new Element('dialog');h.ui.bindDialog(d,()=>d.close());h.ui.show(d,()=>d.showModal());pointer(d,'pointerdown',100,100);pointer(d,'click',0,0);assert.ok(d.open);});
test('native cancel follows the registered lifecycle',()=>{const h=harness(),a=new Element('dialog'),b=new Element('dialog');for(const d of [a,b]){h.ui.bindDialog(d,()=>h.ui.hide(d,()=>d.close()));h.ui.show(d,()=>d.showModal());}const e=new Event('cancel',{cancelable:true});b.dispatchEvent(e);assert.ok(e.defaultPrevented);assert.ok(a.open);assert.equal(b.open,false);});
test('one dismissal closes dialogs and panels without restoring hidden focus',()=>{
 const h=harness(false),dialog=new Element('dialog'),panel=new Element(),calls=[];
 h.ui.bindDialog(dialog,options=>{calls.push(options.restoreFocus);h.ui.hide(dialog,()=>dialog.close());});
 h.ui.bindPopup(panel,options=>{calls.push(options.restoreFocus);h.ui.hide(panel);});
 h.ui.show(dialog,()=>dialog.showModal());h.ui.show(panel);h.ui.dismissAll();h.ui.dismissAll();
 assert.deepEqual(calls,[false,false]);assert.equal(h.ui.visible(dialog),false);assert.equal(h.ui.visible(panel),false);
 h.runTimers();assert.equal(dialog.open,false);assert.equal(panel.hidden,true);assert.equal(h.ui.topDialog(),null);
 h.ui.show(dialog,()=>dialog.showModal());assert.ok(h.ui.visible(dialog));
});
test('failed lazy load removes its node and retries with a new request',async()=>{const h=harness(),first=h.ui.loadScript('notes.js?v=1','Notes'),rejected=assert.rejects(first,/Could not load/);assert.equal(h.ui.loadScript('notes.js?v=1','Notes'),first);h.nodes[0].dispatchEvent(new Event('error'));await rejected;assert.ok(h.nodes[0].removed);const second=h.ui.loadScript('notes.js?v=1','Notes');assert.equal(h.nodes.length,2);h.root.Notes={ready:true};h.nodes[1].dispatchEvent(new Event('load'));assert.equal(await second,h.root.Notes);assert.equal(h.timers.size,0);});
test('missing script exports reject instead of waiting indefinitely',async()=>{const h=harness(),task=h.ui.loadScript('notes','Notes'),rejected=assert.rejects(task,/did not initialize/);h.nodes[0].dispatchEvent(new Event('load'));await rejected;assert.ok(h.nodes[0].removed);});
test('hung scripts time out; final disposal cancels pending work',async()=>{const h=harness(),task=h.ui.loadScript('notes','Notes'),rejected=assert.rejects(task,/Timed out/);h.runTimers();await rejected;const again=h.ui.loadScript('notes','Notes'),cancelled=assert.rejects(again,/disposed/);h.ui.dispose();await cancelled;assert.equal(h.timers.size,0);});
test('scroll observers and pending animation frames have one teardown owner',()=>{const h=harness(false),card=new Element(),body=new Element();const binding=h.ui.bindScrollCues(card,body);binding.update();assert.ok(card.classes.has('can-scroll-down'));body.scrollTop=200;body.dispatchEvent(new Event('scroll'));assert.ok(card.classes.has('can-scroll-up'));assert.ok(!card.classes.has('can-scroll-down'));h.observers[0].callback();h.ui.show(card);h.ui.dispose();assert.ok(h.observers[0].disconnected);assert.equal(h.frames.size,0);});
test('diagnostics and inputs are selectable while scene selection stays blocked',()=>{const h=harness();h.ui.installDocumentGuards(h.doc);let e=new Event('selectstart',{cancelable:true});h.doc.dispatchEvent(e);assert.ok(e.defaultPrevented);h.doc.selectable=true;e=new Event('selectstart',{cancelable:true});h.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,false);h.ui.dispose();h.doc.selectable=false;e=new Event('selectstart',{cancelable:true});h.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,false);});
