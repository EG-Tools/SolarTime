'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
class Element{
 constructor(){this.listeners={};this.attrs={};this.value='';this.hidden=true;this.open=false;this.checked=false;this.disabled=false;this.textContent='';this.style={setProperty(){}};const classes=new Set();this.classList={toggle:(k,v)=>{if(v===undefined)v=!classes.has(k);v?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)};}
 addEventListener(t,fn){(this.listeners[t]??=[]).push(fn);}removeEventListener(t,fn){this.listeners[t]=(this.listeners[t]||[]).filter(f=>f!==fn);}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}focus(){}contains(e){return this===e;}closest(){return this;}querySelector(){return this;}
 showModal(){this.open=true;}close(){this.open=false;}click(){return this.fire('click');}
 fire(type){return Promise.all((this.listeners[type]||[]).map(fn=>fn({target:this,preventDefault(){},stopPropagation(){}})));}
}
function fixture({saved={},record=null,prepare,hidden=false,installed=false,getRecord,putRecord,fetchFn,decode}={}){
 let clock=1790290000000,id=0,stored=record;const pending=new Map(),elements=new Map(),nodes=[],ramps=[],writes=[],notices=[];
 const counts={reads:0,puts:0,opens:0,decodes:0,contexts:0,intervals:0,probes:0};
 const get=k=>{if(!elements.has(k))elements.set(k,new Element());return elements.get(k);};
 const document=new Element();Object.assign(document,{getElementById:get,documentElement:{lang:'en'},baseURI:'https://solartime.app/',hidden});
 const window=new Element();Object.assign(window,{document,URL,AbortController,SolarModules:{},location:{href:document.baseURI,hostname:'solartime.app',protocol:'https:'},console:{warn(){}}});
 const setTimeout=(fn,delay)=>{pending.set(++id,{fn,at:clock+delay});return id;},clearTimeout=id=>pending.delete(id);
 Object.assign(window,{setTimeout,clearTimeout,setInterval:()=>{counts.intervals++;return ++id;},clearInterval(){},requestAnimationFrame:fn=>{fn();return 0;}});
 const node=kind=>{const n={kind,frequency:{},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime:v=>ramps.push(v)},connect(target){this.target=target;return target;},start(){this.started=true;},stop(){this.stopped=true;},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
 class AudioContext{constructor(){counts.contexts++;this.currentTime=0;this.destination={};}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}close(){return Promise.resolve();}decodeAudioData(bytes){counts.decodes++;return decode?decode(bytes):Promise.resolve({length:48000,numberOfChannels:2,duration:1});}createBufferSource(){return node('buffer');}createGain(){return node('gain');}createOscillator(){return node('oscillator');}}
 window.AudioContext=AudioContext;
 const req=(value,tx)=>{const r={};Promise.resolve(value).then(v=>{r.result=v;r.onsuccess?.();if(tx)queueMicrotask(()=>tx.oncomplete?.());},e=>{r.error=e;r.onerror?.();});return r;};
 const db={transaction:()=>{const tx={};tx.objectStore=()=>({get:()=>{counts.reads++;return req(getRecord?getRecord():stored);},put:value=>{counts.puts++;return req(Promise.resolve(putRecord?putRecord(value):null).then(()=>{stored=value;writes.push(value.name);return undefined;}),tx);},delete:()=>req(null,tx)});return tx;}};
 window.indexedDB={open:()=>{counts.opens++;return req(db);}};
 window.fetch=fetchFn||(async()=>({ok:true,blob:async()=>new Blob(['sound'],{type:'audio/wav'})}));
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const globals={window,document,Date:Clock,Intl,URL,Blob,clearInterval(){},setTimeout,clearTimeout};
 for(const name of ['timer-copy','alarm-sound','timer-controller'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../src',name+'.js'),'utf8'),globals);
 if(prepare)window.SolarModules.AlarmSound={...window.SolarModules.AlarmSound,prepare};
 const bridge={eligible:installed,helperSha256:'A'.repeat(64),schedule:async seconds=>({ok:true,deadline:clock+seconds*1000}),cancel:async()=>({ok:true}),probe:async()=>({ok:true}),installStatus:async()=>{counts.probes++;return false;},dispose(){}};
 const timer=window.SolarModules.TimerController.create({document,UI:{bindScrollCues:()=>({update(){},dispose(){}}),bindPopup(){},bindDialog(){},visible:e=>!e.hidden,show:(e,fn)=>{e.hidden=false;fn?.();},hide:(e,fn)=>{e.hidden=true;fn?.();}},Preferences:{read:()=>saved,write(){}},translate:(k,v)=>k+JSON.stringify(v||{}),shutdownBridge:bridge,notify:v=>notices.push(v)});
 return {window,timer,document,get,pending,counts,nodes,ramps,writes,notices,bridge,now:()=>clock,stored:()=>stored,
  async advance(ms){const end=clock+ms;let guard=0;while(true){const next=[...pending].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;if(++guard>10000)throw Error('Timer spin');clock=next[1].at;pending.delete(next[0]);next[1].fn();await flush();}clock=end;await flush();},
  async arm(name='alarm',minutes=1){get(name+'-hours').value='0';get(name+'-minutes').value=String(minutes);get(name+'-enabled').checked=true;await get(name+'-enabled').fire('change');},
  async cancel(name='alarm'){get(name+'-enabled').checked=false;await get(name+'-enabled').fire('change');},
  choose(name){const file=new Blob([name],{type:'audio/wav'});file.name=name;get('alarm-sound-file').files=[file];return get('alarm-sound-file').fire('change');},
  setNow:ms=>{clock=ms;},dispose:()=>timer.dispose()};
}
module.exports={fixture,Element,flush,deferred};
