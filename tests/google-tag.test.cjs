'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const GA='G-4MP85CMH64',ADS='AW-18454135815',fields=['ad_storage','ad_user_data','ad_personalization','analytics_storage'];
function harness({host='solartime.app',saved='',existingLoader=false,withConsent=true}={}){
 const scripts=existingLoader?[{src:'https://www.googletagmanager.com/gtag/js?id=AW-18454135815'}]:[];
 const values=new Map(saved?[['solarTimeCookieConsentV1',saved]]:[]);
 const window={dataLayer:[],localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},dispatchEvent(){}};
 const document={querySelector(selector){
  const exact=/^script\[src="([^"]+)"\]$/.exec(selector);
  if(exact)return scripts.find(s=>s.src===exact[1])||null;
  if(selector==='script[src^="https://www.googletagmanager.com/gtag/js?"]')return scripts.find(s=>s.src.startsWith('https://www.googletagmanager.com/gtag/js?'))||null;
  throw Error('Unexpected selector: '+selector);
 },createElement(tag){assert.equal(tag,'script');return {};},head:{appendChild:s=>scripts.push(s)}};
 const context=vm.createContext({window,document,location:{hostname:host},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 if(withConsent)vm.runInContext(read('src/consent.js'),context);
 const run=()=>vm.runInContext(read('src/google-analytics.js'),context);return {window,scripts,values,run,commands:()=>window.dataLayer.map(v=>Array.from(v))};
}
function assertState(value,state){for(const key of fields)assert.equal(value[key],state,key);}
test('one shared Google loader configures Analytics and Ads once, after denied defaults',()=>{
 for(const host of ['solartime.app','www.solartime.app']){
  const h=harness({host});h.run();h.run();const calls=h.commands();
  assert.equal(h.scripts.length,1);assert.equal(h.scripts[0].async,true);assert.equal(h.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id='+GA);
  assert.equal(calls.filter(c=>c[0]==='js').length,1);assert.deepEqual(calls.filter(c=>c[0]==='config').map(c=>c[1]),[GA,ADS]);
  assert.deepEqual(calls[0].slice(0,2),['consent','default']);assertState(calls[0][2],'denied');
  assert.equal(h.window.SolarGoogleAnalytics.adsId,ADS);assert.ok(Object.isFrozen(h.window.SolarGoogleAnalytics));
 }
});
test('saved choices are restored before both configurations and never reset by Ads',()=>{
 for(const saved of ['granted','denied']){
  const h=harness({saved});h.run();const c=h.commands();
  assert.deepEqual(c[1].slice(0,2),['consent','update']);assertState(c[1][2],saved);
  assert.equal(c[2][0],'js');assert.equal(c[3][1],GA);assert.equal(c[4][1],ADS);
  assert.equal(JSON.parse(h.values.get('solarTimeCookieConsentV1')).value,saved);
 }
});
test('grant, reject and reset propagate to all four consent types without reconfiguring tags',()=>{
 const h=harness();h.run();
 for(const allowed of [true,false]){h.window.SolarGoogleAnalytics.updateConsent(allowed);assertState(h.commands().at(-1)[2],allowed?'granted':'denied');}
 h.window.SolarConsent.reset();assertState(h.commands().at(-1)[2],'denied');assert.equal(h.window.SolarConsent.value(),'');
 h.run();assert.equal(h.commands().filter(c=>c[0]==='config').length,2);assert.equal(h.scripts.length,1);
});
test('preview, local files, localhost and lookalike hosts never initialize either Google destination',()=>{
 for(const host of ['','localhost','127.0.0.1','eg-tools.github.io','solar-time.keg0320.workers.dev','solartime.app.example.com','othersolartime.app']){
  const h=harness({host});h.run();assert.equal(h.scripts.length,0,host);assert.equal(h.commands().filter(c=>c[0]==='config'||c[0]==='js').length,0,host);
 }
});
test('an existing Google loader is reused without another script',()=>{
 const h=harness({existingLoader:true});h.run();h.run();assert.equal(h.scripts.length,1);assert.deepEqual(h.commands().filter(c=>c[0]==='config').map(c=>c[1]),[GA,ADS]);
});
test('missing consent owner fails before Google can load',()=>{
 const h=harness({withConsent:false});assert.throws(h.run,/consent.js must load before/);assert.equal(h.scripts.length,0);assert.equal(h.commands().length,0);
});
test('invalid saved choice remains denied and integration creates no conversion or user-data events',()=>{
 const h=harness({saved:'unknown'});h.run();assertState(h.commands()[0][2],'denied');assert.equal(h.window.SolarConsent.value(),'');
 assert.equal(h.commands().filter(c=>c[0]==='consent').length,1);assert.equal(h.commands().filter(c=>c[0]==='event'||c[0]==='set').length,0);
 assert.doesNotMatch(read('src/google-analytics.js'),/send_to|transaction_id|user_data\s*[:=]|allow_ad_personalization_signals/);
});
test('all published pages load the same consent-first owner once, with current cache keys',()=>{
 const {urlFor}=require('../tools/code-revisions.cjs');
 for(const file of ['index.html','about.html','privacy.html','terms.html','changelog.html']){
  const html=read(file);assert.equal((html.match(/src="src\/google-analytics\.js\?/g)||[]).length,1,file);
  assert.ok(html.includes(urlFor(root,'src/google-analytics.js')),file);assert.ok(html.indexOf('src/consent.js')<html.indexOf('src/google-analytics.js'),file);
  assert.doesNotMatch(html,/<script[^>]+src="https:\/\/www\.googletagmanager\.com\/gtag\/js/);
 }
 assert.match(read('privacy.html'),/Google Ads tag/);assert.match(read('privacy.html'),/cookieless signals/);
});
