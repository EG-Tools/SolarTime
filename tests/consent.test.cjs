'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/consent.js'),'utf8');

function load(initial=''){
  const values=new Map(initial?[['solarTimeCookieConsentV1',initial]]:[]),events=[];
  const window={dataLayer:[],localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
    dispatchEvent:event=>events.push(event)};
  const context={window,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
  vm.runInNewContext(source,context);return {window,values,events};
}

test('one consent owner restores, changes and resets the choice on every page',()=>{
  const restored=load('granted');
  assert.equal(restored.window.SolarConsent.value(),'granted');
  assert.equal(restored.window.dataLayer[0][0],'consent');
  assert.equal(restored.window.dataLayer[0][1],'default');
  assert.equal(restored.window.dataLayer[1][1],'update');
  restored.window.SolarConsent.choose('denied');
  assert.equal(restored.values.get('solarTimeCookieConsentV1'),'denied');
  assert.equal(restored.events.at(-1).detail.value,'denied');
  restored.window.SolarConsent.reset();
  assert.equal(restored.window.SolarConsent.value(),'');
  assert.equal(restored.window.dataLayer.at(-1)[2].analytics_storage,'denied');
});
