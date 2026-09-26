'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const HASH=/const HELPER_SHA256='([^']+)'/.exec(read('src/windows-shutdown.js'))[1];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function bridgeFixture({active=true,receipt,installed,windows=true}={}){
 const launched=[];
 const document={body:{append:el=>{if(el.src)launched.push(el.src);}},createElement:()=>({setAttribute(){},remove(){},click(){}})};
 const window={document,SolarModules:{},navigator:{userAgent:windows?'Windows NT 10.0':'Linux',platform:windows?'Win32':'Linux',userActivation:{isActive:active}},crypto:crypto.webcrypto,AbortController,
  setTimeout:(fn,ms)=>setTimeout(fn,Math.max(1,ms/1000)),clearTimeout,
  fetch:async input=>{const url=new URL(input);const request=launched.length?new URL(launched.at(-1)):null;const result=receipt?.(request);return {ok:true,json:async()=>url.pathname.endsWith('install-status')?installed:{result:result??null}};}};
 vm.runInNewContext(read('src/windows-shutdown.js'),{window,URL,Uint8Array,Date});
 return {bridge:window.SolarModules.WindowsShutdown.create(document),launched};
}
function goodReceipt(request,extra={}){return {protocol:2,action:request.hostname,ok:true,code:0,revision:HASH,at:Number(request.searchParams.get('at')),deadline:request.hostname==='schedule'?Date.now()+Number(request.searchParams.get('seconds'))*1000:0,...extra};}

test('URI dispatch is synchronous but only an exact native receipt confirms scheduling',async()=>{
 const f=bridgeFixture({receipt:u=>goodReceipt(u)}),pending=f.bridge.schedule(1);
 assert.equal(f.launched.length,1);assert.equal(new URL(f.launched[0]).searchParams.get('seconds'),'60');
 const result=await pending;assert.equal(result.ok,true);assert.equal(result.protocol,2);assert.ok(result.deadline>Date.now());f.bridge.dispose();
});
test('browser launch block is not mistaken for an uncertain native result',async()=>{
 const f=bridgeFixture({active:false});assert.equal((await f.bridge.schedule(60)).reason,'not-launched');assert.equal(f.launched.length,0);
 const unsupported=bridgeFixture({windows:false});assert.equal((await unsupported.bridge.cancel()).reason,'unsupported');
});
test('missing, stale and mismatched receipts never produce success',async()=>{
 for(const receipt of [undefined,u=>goodReceipt(u,{at:1}),u=>goodReceipt(u,{action:'cancel'})]){
  const f=bridgeFixture({receipt});const result=await f.bridge.schedule(60);assert.equal(result.ok,false);assert.equal(result.uncertain,true);f.bridge.dispose();
 }
 const old=bridgeFixture({receipt:u=>goodReceipt(u,{revision:'A'.repeat(64)})});assert.equal((await old.bridge.schedule(60)).reason,'revision');old.bridge.dispose();
});
test('native failures, cancel, probe, uninstall and duration cap are passed accurately',async()=>{
 const failed=bridgeFixture({receipt:u=>goodReceipt(u,{ok:false,code:5,deadline:0})});assert.equal((await failed.bridge.schedule(60)).code,5);failed.bridge.dispose();
 const f=bridgeFixture({receipt:u=>goodReceipt(u)});assert.equal((await f.bridge.schedule(999999)).ok,true);assert.equal(new URL(f.launched[0]).searchParams.get('seconds'),'359940');
 for(const action of ['cancel','probe','uninstall'])assert.equal((await f.bridge[action]()).action,action);
 f.bridge.dispose();
});
test('installation boolean alone is insufficient; protocol and installed hash must match',async()=>{
 for(const installed of [{installed:true},{installed:true,protocol:2,revision:'A'.repeat(64)},{installed:false,protocol:2,revision:HASH}]){
  const f=bridgeFixture({installed});assert.equal(await f.bridge.installStatus('a'.repeat(32)),false);f.bridge.dispose();
 }
 const f=bridgeFixture({installed:{installed:true,protocol:2,revision:HASH}});assert.equal(await f.bridge.installStatus('a'.repeat(32)),true);f.bridge.dispose();
});

class Element {
 constructor(){this.listeners={};this.value='';this.hidden=true;this.open=false;this.checked=false;this.disabled=false;this.style={setProperty(){}};this.classList={toggle(){}};}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 removeEventListener(){} getAttribute(){return null;} setAttribute(){} focus(){} contains(el){return el===this;} closest(){return this;} querySelector(){return this;}
 showModal(){this.open=true;} close(){this.open=false;} click(){return this.fire('click');}
 fire(type){return Promise.all((this.listeners[type]||[]).map(fn=>fn({target:this,preventDefault(){},stopPropagation(){}})));}
}
function controllerFixture({schedule,cancel,probe,uninstall,saved}={}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 const document={getElementById:get,documentElement:{lang:'en'},baseURI:'https://solartime.app/',addEventListener(){},removeEventListener(){}};
 const notices=[];let persisted;
 const window={document,SolarModules:{},location:{protocol:'https:',hostname:'solartime.app'},setInterval:()=>1,clearInterval(){},requestAnimationFrame:fn=>fn()};
 for(const name of ['alarm-sound','timer-controller'])vm.runInNewContext(read('src/'+name+'.js'),{window,URL,Date,Intl,clearInterval(){},setTimeout});
 const mod=window.SolarModules.TimerController,copy=JSON.parse(read('src/locales/en.json')).copy;
 const defaults={helperConfirmed:true,helperEnabled:true,helperProgress:100,helperRevision:HASH,shutdown:{enabled:false,hours:0,minutes:1,deadline:0}};
 const bridge={eligible:true,helperSha256:HASH,schedule:schedule||(()=>Promise.resolve({ok:false,uncertain:true})),cancel:cancel||(()=>Promise.resolve({ok:false,uncertain:true})),probe:probe||(()=>Promise.resolve({ok:false})),uninstall:uninstall||(()=>Promise.resolve({ok:false})),installStatus:()=>Promise.resolve(false),dispose(){}};
 const controller=mod.create({document,shutdownBridge:bridge,Preferences:{read:()=>saved??defaults,write:(_,state)=>{persisted=JSON.parse(JSON.stringify(state));}},translate:(key,values={})=>Object.entries(values).reduce((v,[k,n])=>v.replace('{'+k+'}',String(n)),copy[key]||key),notify:m=>notices.push(m),UI:{bindScrollCues:()=>({update(){},dispose(){}}),bindPopup(){},bindDialog(){},visible:el=>!el.hidden,show:(el,fn)=>{el.hidden=false;fn?.();},hide:(el,fn)=>{el.hidden=true;fn?.();}}});
 return {get,controller,notices,state:()=>controller.getState(),persisted:()=>persisted,async schedule(){get('shutdown-enabled').checked=true;return get('shutdown-enabled').fire('change');},async cancel(){get('shutdown-enabled').checked=false;return get('shutdown-enabled').fire('change');}};
}
test('controller cannot announce success until the Windows acknowledgement arrives',async()=>{
 const d=deferred(),f=controllerFixture({schedule:()=>d.promise}),pending=f.schedule();
 assert.equal(f.state().shutdown.status,'pending');assert.equal(f.state().shutdown.deadline,0);assert.equal(f.notices.some(n=>n.includes('Shutdown set for')),false);
 const deadline=Date.now()+60000;d.resolve({ok:true,deadline});await pending;
 assert.equal(f.state().shutdown.status,'confirmed');assert.equal(f.state().shutdown.deadline,deadline);assert.equal(f.notices.some(n=>n.includes('Shutdown set for')),true);f.controller.dispose();
});
test('no receipt retains explicit uncertainty and the ability to cancel, including after reload',async()=>{
 const f=controllerFixture();await f.schedule();assert.equal(f.state().shutdown.status,'unknown');assert.equal(f.get('shutdown-enabled').disabled,false);assert.equal(f.notices.some(n=>n.includes('Shutdown set for')),false);
 const again=controllerFixture({saved:f.persisted()});assert.equal(again.state().shutdown.status,'unknown');assert.equal(again.state().shutdown.enabled,true);
 f.controller.dispose();again.controller.dispose();
});
test('known rejection does not enable a new shutdown or show success',async()=>{
 for(const result of [{ok:false,uncertain:false,code:5},{ok:false,uncertain:false,reason:'not-launched'}]){
  const f=controllerFixture({schedule:()=>Promise.resolve(result)});await f.schedule();assert.equal(f.state().shutdown.enabled,false);assert.equal(f.notices.some(n=>n.includes('Shutdown set for')),false);f.controller.dispose();
 }
});
test('cancel failure does not pretend that Windows cancellation succeeded',async()=>{
 const f=controllerFixture({schedule:()=>Promise.resolve({ok:true,deadline:Date.now()+60000}),cancel:()=>Promise.resolve({ok:false,uncertain:true})});
 await f.schedule();await f.cancel();assert.equal(f.state().shutdown.enabled,true);assert.equal(f.state().shutdown.status,'unknown');assert.equal(f.notices.some(n=>n==='Scheduled shutdown cancelled.'),false);f.controller.dispose();
});
test('a late schedule response cannot reverse a newer confirmed cancellation',async()=>{
 const d=deferred(),f=controllerFixture({schedule:()=>d.promise,cancel:()=>Promise.resolve({ok:true})});const pending=f.schedule();await f.cancel();d.resolve({ok:true,deadline:Date.now()+60000});await pending;
 assert.equal(f.state().shutdown.enabled,false);assert.equal(f.state().shutdown.status,'idle');f.controller.dispose();
});
test('install confirmation button requires a live probe, not a user assertion',async()=>{
 const d=deferred(),f=controllerFixture({probe:()=>d.promise,saved:{helperProgress:50,helperConfirmed:false}});const pending=f.get('shutdown-helper-install-yes').fire('click');assert.equal(f.state().helperConfirmed,false);d.resolve({ok:false});await pending;assert.equal(f.state().helperConfirmed,false);f.controller.dispose();
 const yes=controllerFixture({probe:()=>Promise.resolve({ok:true}),saved:{helperProgress:50,helperConfirmed:false}});await yes.get('shutdown-helper-install-yes').fire('click');assert.equal(yes.state().helperConfirmed,true);yes.controller.dispose();
});
test('pending download survives reload and uninstall failure preserves installation state',async()=>{
 const saved={helperProgress:50,helperConfirmed:false,helperInstallToken:'b'.repeat(32),helperInstallDeadline:Date.now()+60000};const f=controllerFixture({saved});assert.equal(f.state().helperInstallToken,saved.helperInstallToken);f.controller.dispose();
 const installed=controllerFixture();await installed.get('shutdown-helper-remove-yes').fire('click');assert.equal(installed.state().helperConfirmed,true);installed.controller.dispose();
});
