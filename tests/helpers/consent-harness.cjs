'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../src/consent.js'),'utf8');
const KEY='solarTimeCookieConsentV1';
function consentHarness({initial='',at=Date.UTC(2026,8,28,12),blocked=false,values:shared}={}){
 let now=at,serial=0;const values=shared||new Map(initial?[[KEY,initial]]:[]),events=[],timers=new Map(),listeners=new Map();
 const on=(type,fn)=>{const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);};
 const emit=(type,extra={})=>{const event={type,...extra};for(const fn of listeners.get(type)||[])fn(event);};
 const window={dataLayer:[],localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');values.set(k,v);},removeItem:k=>{if(blocked)throw Error('blocked');values.delete(k);}},
  setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
  addEventListener:on,dispatchEvent:event=>{events.push(event);emit(event.type,event);},document:{hidden:false,addEventListener:on}};
 class Clock extends Date{static now(){return now;}}
 const context=vm.createContext({window,Date:Clock,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 const run=()=>vm.runInContext(source,context);run();
 return {window,values,events,timers,context,run,emit,setNow:value=>{now=value;},now:()=>now,record:()=>JSON.parse(values.get(KEY)||'null'),api:window.SolarConsent};
}
module.exports={consentHarness,KEY};
