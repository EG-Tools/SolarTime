'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {consentHarness:load,KEY}=require('./helpers/consent-harness.cjs');
const fields=['ad_storage','ad_user_data','ad_personalization','analytics_storage'];
test('consent defaults deny all four fields before restoring a saved choice',()=>{
 const h=load({initial:'granted'});assert.equal(h.api.value(),'granted');
 assert.equal(h.window.dataLayer[0][1],'default');for(const key of fields)assert.equal(h.window.dataLayer[0][2][key],'denied');
 assert.equal(h.window.dataLayer[1][1],'update');assert.equal(h.window.dataLayer[1][2].analytics_storage,'granted');
 h.api.choose('denied');assert.equal(h.record().value,'denied');assert.equal(h.events.at(-1).detail.value,'denied');
 h.api.reset();assert.equal(h.api.value(),'');assert.equal(h.values.has(KEY),false);assert.equal(h.window.dataLayer.at(-1)[2].analytics_storage,'denied');
});
test('acceptance and rejection expire after the same six calendar months without sliding renewal',()=>{
 for(const value of ['granted','denied']){
  const h=load();h.api.choose(value);const saved=h.values.get(KEY),r=h.record();assert.equal(r.schema,2);assert.equal(r.expiresAt,Date.UTC(2027,2,28,12));
  const revisit=load({initial:saved,at:h.now()+86400000});assert.equal(revisit.api.value(),value);assert.equal(revisit.values.get(KEY),saved);
  revisit.setNow(r.expiresAt-1);assert.equal(revisit.api.value(),value);revisit.setNow(r.expiresAt);assert.equal(revisit.api.value(),'');
  assert.equal(revisit.window.dataLayer.at(-1)[2].analytics_storage,'denied');assert.equal(revisit.events.at(-1).detail.reason,'expired');assert.equal(revisit.timers.size,0);
 }
});
test('six-month calendar arithmetic clamps month end, leap days and UTC clock time',()=>{
 for(const [start,end] of [[Date.UTC(2026,7,31,23,59,59,7),Date.UTC(2027,1,28,23,59,59,7)],[Date.UTC(2027,7,31),Date.UTC(2028,1,29)],[Date.UTC(2028,1,29),Date.UTC(2028,7,29)]]){
  const h=load({at:start});h.api.choose('denied');assert.equal(h.record().expiresAt,end);
 }
});
test('legacy yes and no migrate once, preserving the decision but never renewing on reads',()=>{
 for(const value of ['granted','denied']){
  const h=load({initial:value});assert.equal(h.api.value(),value);assert.equal(h.record().chosenAt,h.now());
  const raw=h.values.get(KEY);for(let i=0;i<3;i++){h.setNow(h.now()+100);h.api.value();h.emit('pageshow');}
  assert.equal(h.values.get(KEY),raw);assert.equal(load({initial:raw,at:h.now()}).values.get(KEY),raw);
 }
});
test('expired, future, malformed and unsupported consent records cannot grant tracking',()=>{
 const h=load();h.api.choose('granted');const r=h.record();
 for(const raw of ['broken JSON','{}','null','true','"granted"',JSON.stringify({...r,schema:99}),JSON.stringify({...r,value:'unknown'}),JSON.stringify({...r,expiresAt:r.expiresAt+1}),JSON.stringify({...r,chosenAt:h.now()+1000}),JSON.stringify({...r,expiresAt:h.now()})]){
  const bad=load({initial:raw});assert.equal(bad.api.value(),'');assert.ok(bad.window.dataLayer.every(c=>c[2]?.analytics_storage!=='granted'));assert.equal(bad.timers.size,0);
 }
 const back=load({initial:JSON.stringify(r),at:r.chosenAt-1});assert.equal(back.api.value(),'');
});
test('unavailable storage preserves a new explicit choice only in memory and never crashes',()=>{
 const h=load({blocked:true});assert.equal(h.api.value(),'');h.api.choose('granted');assert.equal(h.api.value(),'granted');h.api.choose('denied');assert.equal(h.api.value(),'denied');h.api.reset();assert.equal(h.api.value(),'');assert.equal(load({blocked:true}).api.value(),'');
});
test('an expiry timer is bounded and expiry or return signals revoke before further feature events',()=>{
 const h=load();h.api.choose('granted');assert.equal(h.timers.size,1);assert.ok([...h.timers.values()].every(t=>t.delay<=2147483647&&t.delay>0));
 h.window.SolarGoogleAnalytics={production:true,measurementId:'G-4MP85CMH64'};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/usage-analytics.js'),'utf8'),h.context);
 const report=h.window.SolarUsageAnalytics.begin('solar_music_play'),expiry=h.record().expiresAt;
 h.setNow(expiry);assert.equal(report(),false);assert.equal(h.window.SolarUsageAnalytics.track('solar_help_open'),false);
 assert.equal(h.window.dataLayer.filter(c=>c[0]==='event').length,0);assert.equal(h.events.at(-1).detail.reason,'expired');
 h.api.choose('granted');h.setNow(h.record().expiresAt);h.emit('visibilitychange');assert.equal(h.api.value(),'');
 h.api.choose('granted');h.setNow(h.record().expiresAt);const task=[...h.timers.values()][0];task.fn();assert.equal(h.api.value(),'');
});
test('same-browser storage changes propagate consent revocation without touching app or timer data',()=>{
 const h=load();h.api.choose('granted');const other=load({values:h.values});other.api.choose('denied');h.emit('storage',{key:KEY});assert.equal(h.api.value(),'denied');
 other.api.choose('granted');h.emit('storage',{key:'solar-time.timers.v1'});assert.equal(h.api.value(),'denied');h.emit('storage',{key:KEY});assert.equal(h.api.value(),'granted');
 h.values.clear();h.emit('storage',{key:null});assert.equal(h.api.value(),'');assert.equal(h.window.dataLayer.at(-1)[2].analytics_storage,'denied');
});
test('repeated consent script initialization does not reset choice, commands, timers or listeners',()=>{
 const h=load({initial:'granted'}),calls=h.window.dataLayer.length,events=h.events.length;h.run();assert.equal(h.window.SolarConsent,h.api);assert.equal(h.window.dataLayer.length,calls);assert.equal(h.events.length,events);assert.equal(h.timers.size,1);
});
