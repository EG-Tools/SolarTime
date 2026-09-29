'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {attachUsage}=require('./helpers/usage-harness.cjs');
const {fixture,flush,deferred}=require('./helpers/timer-harness.cjs');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
function harness(options){const window={};return {window,...attachUsage(window,options)};}
const names=['solar_music_play','solar_music_stop','solar_region_view','solar_alarm_cancel','solar_alarm_snooze','solar_shutdown_set','solar_shutdown_cancel','solar_help_open','solar_zen_on','solar_zen_off','solar_alignment_view'];
test('usage collector sends no automatic page views or conversions and initializes once',()=>{
 const h=harness();h.run();assert.equal(h.events.length,0);assert.equal(h.listeners.length,1);assert.ok(Object.isFrozen(h.window.SolarUsageAnalytics));
 for(const name of ['page_view','conversion','generate_lead','__proto__','constructor','not_a_feature'])assert.equal(h.window.SolarUsageAnalytics.track(name),false);
 assert.equal(h.events.length,0);
});
test('consented fixed feature names route only to existing GA4, with no arbitrary data',()=>{
 const h=harness(),track=h.window.SolarUsageAnalytics.track;
 for(const name of names)assert.equal(track(name,{filename:'private.mp3',deadline:1790000000000,send_to:'AW-18454135815/ignored',user_data:'secret'}),true);
 assert.equal(track('solar_body_select',{body_id:'earth',latitude:37.5}),true);
 assert.equal(track('solar_body_track',{body_id:'moon'}),true);
 assert.equal(track('solar_alarm_set',{sound_type:'custom',sound_name:'personal.mp3'}),true);
 assert.equal(track('solar_language_change',{selection_mode:'manual',region:'NO'}),true);
 assert.equal(track('solar_eclipse_view',{body_id:'moon'}),true);
 for(const [command,name,data] of h.events){assert.equal(command,'event');assert.equal(data.send_to,'G-4MP85CMH64');assert.ok(name.startsWith('solar_'));assert.ok(Object.keys(data).every(k=>['send_to','body_id','sound_type','selection_mode'].includes(k)));}
 assert.doesNotMatch(JSON.stringify(h.events),/private|personal|secret|latitude|deadline|AW-/);
});
test('bad or absent enum values are rejected, including hostile getters',()=>{
 const h=harness(),track=h.window.SolarUsageAnalytics.track;
 for(const [name,params] of [['solar_body_track',{body_id:'untrusted text'}],['solar_alarm_set',{sound_type:'private.wav'}],['solar_language_change',{selection_mode:'unknown'}],['solar_eclipse_view',{body_id:'earth'}],['solar_body_select',{}],['solar_body_select',Object.defineProperty({},'body_id',{get(){throw Error('blocked');}})]])assert.equal(track(name,params),false);
 assert.equal(h.events.length,0);
});
test('denied and pre-consent actions are dropped, not replayed after grant',()=>{
 const h=harness({granted:false}),api=h.window.SolarUsageAnalytics;
 const before=api.begin('solar_music_play');assert.equal(api.track('solar_help_open'),false);h.change(true);assert.equal(before(),false);assert.equal(h.events.length,0);assert.equal(api.track('solar_help_open'),true);h.change(false);assert.equal(api.track('solar_help_open'),false);assert.equal(h.events.length,1);
});
test('async completion requires the same consent epoch and is emitted at most once',()=>{
 const h=harness(),api=h.window.SolarUsageAnalytics;
 const revoked=api.begin('solar_shutdown_set');h.change(false);h.change(true);assert.equal(revoked(),false);
 const finish=api.begin('solar_shutdown_set');h.change(true);assert.equal(finish(),true);assert.equal(finish(),false);assert.equal(h.events.length,1);
 const params={body_id:'moon'},body=api.begin('solar_body_track',params);params.body_id='not trusted';body();assert.equal(h.events.at(-1)[2].body_id,'moon');
});
test('non-production, blocked storage/Google and exceptions cannot break features',()=>{
 const h=harness({production:false});assert.equal(h.window.SolarUsageAnalytics.track('solar_help_open'),false);assert.equal(h.events.length,0);
 const vm=require('node:vm'),blocked={SolarGoogleAnalytics:{production:true,measurementId:'G-4MP85CMH64'},SolarConsent:{value(){throw Error('blocked storage');}}};vm.runInNewContext(read('src/usage-analytics.js'),{window:blocked});assert.equal(blocked.SolarUsageAnalytics.track('solar_help_open'),false);
 const p=harness();p.window.gtag=()=>{throw Error('blocked');};assert.equal(p.window.SolarUsageAnalytics.track('solar_help_open'),false);p.window.gtag=undefined;assert.equal(p.window.SolarUsageAnalytics.track('solar_help_open'),false);
});
test('alarm records successful set/cancel, not invalid input, restoration or ringing',async()=>{
 const f=fixture(),h=attachUsage(f.window);
 await f.arm('alarm',0);assert.equal(h.events.length,0);await f.arm('alarm',1);assert.equal(h.events.length,1);assert.equal(h.events[0][1],'solar_alarm_set');assert.equal(h.events[0][2].sound_type,'default');
 f.timer.check();f.timer.refreshLanguage();assert.equal(h.events.length,1);await f.cancel();assert.equal(h.events.at(-1)[1],'solar_alarm_cancel');await f.cancel();assert.equal(h.events.length,2);
 await f.arm('alarm',1);await f.advance(60000);assert.equal(h.events.length,3);await f.get('alarm-snooze').fire('click');await flush();assert.equal(h.events.at(-1)[1],'solar_alarm_snooze');assert.equal(h.events.filter(e=>e[1]==='solar_alarm_set').length,2);f.dispose();
});
const installedState={helperEnabled:true,helperConfirmed:true,helperRevision:'A'.repeat(64),helperProgress:100};
test('shutdown is counted only after verified success; failed/uncertain/cancelled requests are excluded',async()=>{
 const f=fixture({installed:true,saved:installedState}),h=attachUsage(f.window),pending=deferred();f.bridge.schedule=()=>pending.promise;
 const requested=f.arm('shutdown',1);await flush();assert.equal(h.events.length,0);pending.resolve({ok:true,deadline:f.now()+60000});await requested;assert.equal(h.events.at(-1)[1],'solar_shutdown_set');
 f.bridge.cancel=async()=>({ok:false,uncertain:true});await f.cancel('shutdown');assert.equal(h.events.length,1);f.bridge.cancel=async()=>({ok:true});await f.cancel('shutdown');assert.equal(h.events.at(-1)[1],'solar_shutdown_cancel');
 for(const result of [{ok:false,uncertain:true},{ok:false,reason:'not-launched'},{ok:false,code:5}]){f.bridge.schedule=async()=>result;await f.arm('shutdown',1);assert.equal(h.events.length,2);}
 f.dispose();
});

test('automatic shutdown deadline cleanup is not a user cancellation event',async()=>{
 const f=fixture({installed:true,saved:installedState}),h=attachUsage(f.window);await f.arm('shutdown',1);assert.equal(h.events.length,1);await f.advance(60000);assert.equal(h.events.length,1);assert.equal(f.timer.getState().shutdown.enabled,false);f.dispose();
});
test('superseded/disposed native completions do not generate phantom use or replay consent',async()=>{
 for(const mode of ['cancel','dispose','revoke']){
  const f=fixture({installed:true,saved:installedState}),h=attachUsage(f.window),pending=deferred();f.bridge.schedule=()=>pending.promise;
  const requested=f.arm('shutdown',1);await flush();
  if(mode==='cancel')await f.cancel('shutdown');else if(mode==='dispose')f.dispose();else{h.change(false);h.change(true);}
  pending.resolve({ok:true,deadline:f.now()+60000});await requested;assert.equal(h.events.filter(e=>e[1]==='solar_shutdown_set').length,0,mode);f.dispose();
 }
});
test('tracker is shipped once after consent and Google owner; baseline pageview/Ads setup is unchanged',()=>{
 const html=read('index.html'),{urlFor}=require('../tools/code-revisions.cjs');assert.equal((html.match(/src="src\/usage-analytics\.js\?/g)||[]).length,1);assert.ok(html.includes(urlFor(root,'src/usage-analytics.js')));assert.ok(html.indexOf('src/google-analytics.js')<html.indexOf('src/usage-analytics.js'));assert.ok(html.indexOf('src/usage-analytics.js')<html.indexOf('src/app.js'));
 const crypto=require('node:crypto');for(const [file,hash] of Object.entries(JSON.parse(read('tests/fixtures/usage-v064-hashes.json'))).filter(([file])=>file!=='src/consent.js'))assert.equal(crypto.createHash('sha256').update(read(file).replace(/\r\n/g,'\n').replace(/\/\* Consent controls share the existing card surface; reserve space for X\. \*\/[\s\S]*?(?=@media\(max-width:760px\)\{\.cookie-consent)/,'').replace(/\/\* Help shortcut guide and CSS mouse controls\. \*\/[\s\S]*?\/\* End help shortcut guide\. \*\/\n/,'').replace(/\/\* Release archive link\. \*\/[\s\S]*?\/\* End release archive link\. \*\/\n/,'' )).digest('hex'),hash,file);
 assert.doesNotMatch(read('src/usage-analytics.js'),/H5o0COOSjYkdEIeIz99E|setInterval\(|setTimeout\(|requestAnimationFrame\(/);
});
