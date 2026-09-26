'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function metadata(){const app=read('src/app.js'),a=app.indexOf('  const LANG_ORDER='),b=app.indexOf('  const FACTORY_OPTIONS=',a);return vm.runInNewContext(app.slice(a,b)+';({order:LANG_ORDER,meta:LANG_META,regions:REGIONS})');}
function detect(zone,languages){const window={};require('./helpers/i18n-runtime.cjs').localization({window,navigator:{languages,language:languages[0]},Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})})}});return window.SolarModules.Localization.detect();}
const localeHash=code=>require('../tools/code-revisions.cjs').hash(read('src/locales/'+code+'.json'));
const plain=value=>JSON.parse(JSON.stringify(value));
test('Netherlands and Belgium reuse one Dutch payload while keeping separate regional metadata',()=>{
 const {order,meta,regions}=metadata();assert.equal(new Set(order).size,order.length);
 for(const [code,name,locale,zone,city] of [['nl','Nederland','nl-NL','Europe/Amsterdam','Amsterdam'],['be','België','nl-BE','Europe/Brussels','Brussel']]){
  assert.equal(order.filter(c=>c===code).length,1);assert.deepEqual(plain(meta[code]),{code:code.toUpperCase(),name,locale,html:locale,copy:'nl'});
  assert.equal(regions[code].timeZone,zone);assert.equal(regions[code].city,city);
 }
 assert.ok(!fs.existsSync(path.join(__dirname,'../src/locales/be.json')));
 for(const code of order){assert.ok(meta[code]&&regions[code],code);assert.ok(fs.existsSync(path.join(__dirname,'../src/locales/'+meta[code].copy+'.json')),code);}
});
test('Dutch locale covers every interface key, body and phase and preserves interpolation fields',()=>{
 const en=JSON.parse(read('src/locales/en.json')),nl=JSON.parse(read('src/locales/nl.json'));
 for(const section of ['copy','bodies','phases'])assert.deepEqual(Object.keys(nl[section]).sort(),Object.keys(en[section]).sort(),section);
 const fields=s=>[...s.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
 for(const [key,value] of Object.entries(en.copy)){assert.equal(typeof nl.copy[key],'string');assert.deepEqual(fields(nl.copy[key]),fields(value),key);if(value)assert.ok(nl.copy[key].trim(),key);}
 for(const [key,rows] of Object.entries(nl.bodies)){assert.equal(rows.length,2);assert.ok(rows.every(v=>typeof v==='string'&&v.trim()),key);}
 assert.equal(nl.copy.settings,'Weergave-instellingen');assert.equal(nl.bodies.earth[0],'Aarde');
 assert.equal(JSON.parse(read('src/locales/nl.json')).copy.starDensityLabel,'Sterdichtheid');
 assert.match(read('src/app.js'),/\['en','hi','es','de','fr','pt','it','id','nl'\]\.includes\(copyLanguage\(\)\)/);
});
test('Dutch language data is supported, versioned and cached without duplicate country requests',async()=>{
 const requests=[],window={},location={protocol:'https:',href:'https://solar.test/'},data=JSON.parse(read('src/locales/nl.json'));
 vm.runInNewContext(read('src/language-data.js'),{window,location,document:{currentScript:{src:'https://solar.test/src/language-data.js?v=0.47-r3'}},URL,AbortSignal,fetch:async url=>{requests.push(String(url));return {ok:true,json:async()=>data};}});
 const loader=window.SolarModules.LanguageData;assert.ok(loader.supported.includes('nl'));
 const [a,b]=await Promise.all([loader.load('nl'),loader.load('nl')]);assert.equal(a,b);assert.equal(await loader.load('nl'),a);
 assert.deepEqual(requests,['https://solar.test/src/locales/nl.json?v='+localeHash('nl')]);assert.ok(loader.loaded('nl'));
});
test('new countries use the existing menu and retain every existing country in order',()=>{
 const {order}=metadata(),html=read('index.html'),a=html.indexOf('id="language-scroll"'),b=html.indexOf('scroll-cue-down',a),block=html.slice(a,b);
 const buttons=[...block.matchAll(/data-language="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(buttons,Array.from(order));
 assert.match(block,/data-language="nl"><strong>NL<\/strong><span>Nederland<\/span>/);assert.match(block,/data-language="be"><strong>BE<\/strong><span>België<\/span>/);
 assert.deepEqual(Array.from(order).filter(c=>!['nl','be',...require('./fixtures/regions-v061.json').map(r=>r.code)].includes(c)),['ao','ar','au','at','br','ca','cl','chn','co','cr','ec','fr','de','hk','hi','id','ie','it','jpn','kor','mx','mz','nz','pa','pe','pt','sg','es','tw','eu','en','uy','ve']);
});
test('country detection distinguishes Dutch territories and equivalent timezone IDs without changing other regions',()=>{
 for(const [zone,langs,wanted] of [
  ['Europe/Amsterdam',['en-US'],'nl'],['Europe/Brussels',['en-US'],'be'],
  ['Europe/Brussels',['nl-NL'],'nl'],['Europe/Amsterdam',['nl-BE'],'be'],
  ['Europe/Brussels',['fr-BE'],'be'],['Europe/Brussels',['de-BE'],'be'],
  ['Etc/UTC',['nl-NL'],'nl'],['Etc/UTC',['nl-BE'],'be'],['Etc/UTC',['nl-BE-u-hc-h23'],'be'],
  ['Etc/UTC',['nl'],'nl'],['Etc/UTC',['fr-BE'],'be'],['Etc/UTC',['de-BE'],'be'],
  ['Europe/Paris',['fr-FR'],'fr'],['Europe/Berlin',['de-DE'],'de'],
  ['Asia/Seoul',['nl-NL'],'kor'],['Asia/Singapore',['nl-BE'],'sg']])assert.equal(detect(zone,langs),wanted,zone+' '+langs);
});
test('both regional clocks use DST, roll dates correctly and have distinct Earth-view cities',()=>{
 const {meta,regions}=metadata();
 for(const code of ['nl','be']){
  const f=new Intl.DateTimeFormat(meta[code].locale,{timeZone:regions[code].timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const parts=date=>Object.fromEntries(f.formatToParts(new Date(date)).map(p=>[p.type,p.value]));
  assert.equal(parts('2026-01-15T12:00:00Z').hour,'13');assert.equal(parts('2026-07-15T12:00:00Z').hour,'14');
  const midnight=parts('2026-09-19T23:30:00Z');assert.equal(midnight.day,'20');assert.equal(midnight.hour,'01');assert.equal(midnight.minute,'30');
  assert.equal(parts('2026-03-29T00:59:00Z').hour,'01');assert.equal(parts('2026-03-29T01:00:00Z').hour,'03');
 }
 assert.ok(Math.abs(regions.nl.latitude-(52+22/60))<1e-8);assert.equal(regions.nl.longitude,4.9);
 assert.ok(Math.abs(regions.be.latitude-(50+50/60))<1e-8);assert.ok(Math.abs(regions.be.longitude-(4+20/60))<1e-8);
});
test('current Dutch release notes explain the addition without duplicating historical history',()=>{
 const api=require('../src/release-notes.js'),release=api.RELEASES.find(r=>r.version==='0.47');assert.equal(release.version,'0.47');
 const rows=api.itemsFor(release,'nl');assert.equal(rows.length,8);assert.ok(rows.some(s=>s.includes('België en Nederland')));
 assert.notEqual(rows,api.itemsFor(release,'en'));assert.equal(api.itemsFor(api.RELEASES.find(r=>r.version==='0.46'),'nl'),api.itemsFor(api.RELEASES.find(r=>r.version==='0.46'),'en'));
});
