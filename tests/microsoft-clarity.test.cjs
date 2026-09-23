'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/microsoft-clarity.js'),'utf8');

function load({hostname='solartime.app',state=''}={}){
  const listeners=new Map(),scripts=[];
  const document={
    querySelector:()=>null,
    createElement:()=>({dataset:{},addEventListener(type,handler){this[`on${type}`]=handler;}}),
    head:{appendChild:script=>scripts.push(script)}
  };
  const window={
    SolarConsent:{value:()=>state},
    addEventListener:(type,handler)=>listeners.set(type,handler)
  };
  window.window=window;
  vm.runInNewContext(source,{window,document,location:{hostname},Error});
  return {window,listeners,scripts};
}

test('Clarity waits for consent, loads once and sends Consent V2 updates',()=>{
  const env=load();
  assert.equal(env.scripts.length,0);
  env.listeners.get('solar:consentchange')({detail:{value:'granted'}});
  assert.equal(env.scripts.length,1);
  assert.equal(env.scripts[0].src,'https://www.clarity.ms/tag/ymnblw22up');
  assert.equal(env.scripts[0].async,true);
  assert.equal(env.window.clarity.q.length,1);
  assert.equal(env.window.clarity.q[0][0],'consentv2');
  assert.equal(env.window.clarity.q[0][1].analytics_Storage,'granted');
  env.listeners.get('solar:consentchange')({detail:{value:'granted'}});
  assert.equal(env.scripts.length,1);
  env.listeners.get('solar:consentchange')({detail:{value:'denied'}});
  assert.equal(env.window.clarity.q.at(-1)[1].analytics_Storage,'denied');
});

test('Clarity restores granted consent on production but never loads off production',()=>{
  const restored=load({state:'granted'});
  assert.equal(restored.scripts.length,1);
  const local=load({hostname:'localhost',state:'granted'});
  assert.equal(local.scripts.length,0);
});

test('every public page loads Clarity after the shared consent owner',()=>{
  for(const file of ['index.html','about.html','privacy.html','terms.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    const consent=html.indexOf('src/consent.js');
    const clarity=html.indexOf('src/microsoft-clarity.js');
    assert.ok(consent>=0,`${file} is missing consent.js`);
    assert.ok(clarity>consent,`${file} must load Clarity after consent.js`);
  }
});
