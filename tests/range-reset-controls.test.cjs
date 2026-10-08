'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../src/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');

test('every range exposes one adjacent reset dot with disabled and gold states',()=>{
 const ids=[...html.matchAll(/<input id="([^"]+)" class="solar-range" type="range"/g)].map(match=>match[1]);
 assert.deepEqual(ids.sort(),['body-size-slider','clock-size','earth-cloud-amount','orbit-brightness','overview-orbit-gap','satellite-orbit-slider','speed-slider','star-density','venus-cloud-amount'].sort());
 for(const id of ids)assert.match(html,new RegExp(`id="${id}-reset" class="range-reset"`),id);
 assert.match(css,/\.range-reset::before[^}]+background:#e9c88d/);
 assert.match(css,/\.range-reset:disabled::before[^}]+background:#53606f/);
});

test('range reset dots restore each existing control through its normal owner',()=>{
 for(const id of ['overview-orbit-gap','orbit-brightness','star-density','clock-size','body-size-slider','satellite-orbit-slider','earth-cloud-amount','venus-cloud-amount','speed-slider']){
  assert.match(app,new RegExp(`\\$\\('${id}-reset'\\)\\.addEventListener\\('click'`),id);
 }
 assert.match(app,/actual\?'actualOrbitSpacing':'overviewOrbitGap',actual\?0:FACTORY_OPTIONS\.overviewOrbitGap/);
 assert.match(app,/resetBodyScale\(body\.id\)/);
 assert.match(app,/resetSatelliteOrbitScale\(body\.id\)/);
 assert.match(app,/speed-slider-reset'\)\.addEventListener\('click',\(\)=>applySpeed\(1\)/);
});
