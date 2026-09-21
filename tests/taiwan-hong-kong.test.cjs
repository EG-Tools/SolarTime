'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function metadata(){const app=read('src/app.js'),a=app.indexOf('  const LANG_ORDER='),b=app.indexOf('  const STAR_DENSITY_COPY=',a);return vm.runInNewContext(app.slice(a,b)+';({order:LANG_ORDER,meta:LANG_META,regions:REGIONS})');}
function detect(zone,languages){const window={};vm.runInNewContext(read('src/localization.js'),{window,navigator:{languages,language:languages[0]},Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})})}});return window.SolarModules.Localization.detect();}

test('Taiwan and Hong Kong use one complete Traditional Chinese payload with distinct regional formats',()=>{
 const {order,meta,regions}=metadata();
 assert.equal(order.indexOf('chn'),order.indexOf('cl')+1);assert.equal(order.indexOf('hk'),order.indexOf('de')+1);assert.equal(order.indexOf('tw'),order.indexOf('es')+1);
 assert.deepEqual(plain(meta.tw),{code:'TW',name:'台灣',locale:'zh-TW',html:'zh-Hant-TW',copy:'zht'});
 assert.deepEqual(plain(meta.hk),{code:'HK',name:'香港',locale:'zh-HK',html:'zh-Hant-HK',copy:'zht'});
 assert.equal(regions.tw.timeZone,'Asia/Taipei');assert.equal(regions.tw.label,'TAIWAN');
 assert.equal(regions.hk.timeZone,'Asia/Hong_Kong');assert.equal(regions.hk.label,'HONG KONG');
 assert.ok(Math.abs(regions.tw.latitude-23.6978)<1e-8);assert.ok(Math.abs(regions.hk.longitude-114.1694)<1e-8);
 assert.ok(!fs.existsSync(path.join(__dirname,'../src/locales/tw.json')));assert.ok(!fs.existsSync(path.join(__dirname,'../src/locales/hk.json')));
});

test('Traditional Chinese covers every interface, body and lunar phase key',()=>{
 const en=JSON.parse(read('src/locales/en.json')),chn=JSON.parse(read('src/locales/chn.json')),zht=JSON.parse(read('src/locales/zht.json'));
 const fields=value=>[...value.matchAll(/\{\w+\}/g)].map(match=>match[0]).sort();
 for(const section of ['copy','bodies','phases'])assert.deepEqual(Object.keys(zht[section]).sort(),Object.keys(en[section]).sort(),section);
 for(const key of Object.keys(en.copy)){assert.equal(typeof zht.copy[key],'string');assert.ok(zht.copy[key].trim(),key);assert.deepEqual(fields(zht.copy[key]),fields(chn.copy[key]),key);}
 assert.equal(zht.copy.settings,'顯示設定');assert.equal(zht.copy.save,'儲存');assert.equal(zht.bodies.earth[0],'地球');
 assert.match(read('src/language-data.js'),/'zht'/);assert.match(read('src/app.js'),/zht:Object\.freeze\(\{label:'星星密度'/);
});

test('an older public site missing zht falls back without showing a 404',async()=>{
 const source=read('src/language-data.js'),chn=JSON.parse(read('src/locales/chn.json')),requests=[],window={SolarModules:{}},location={protocol:'file:',href:'file:///D:/_Program/SolarTime/index.html'};
 vm.runInNewContext(source,{window,location,document:{currentScript:{src:'file:///D:/_Program/SolarTime/src/language-data.js?v=0.51-r1'}},URL,AbortSignal,fetch:async url=>{
  requests.push(String(url));return String(url).includes('/zht.json')?{ok:false,status:404}:{ok:true,status:200,json:async()=>structuredClone(chn)};
 }});
 const loader=window.SolarModules.LanguageData,bundle=await loader.load('zht');
 assert.deepEqual(requests,['https://solartime.app/src/locales/zht.json?v=0.51-r1','https://solartime.app/src/locales/chn.json?v=0.51-r1']);
 assert.equal(bundle.copy.settings,chn.copy.settings);assert.equal(bundle.copy.eclipseView,'日食');assert.equal(loader.loaded('zht'),true);
});

test('automatic detection separates Taiwan, Hong Kong and mainland China',()=>{
 assert.equal(detect('Asia/Taipei',['en-US']),'tw');assert.equal(detect('Asia/Hong_Kong',['en-US']),'hk');
 assert.equal(detect('Etc/UTC',['zh-TW']),'tw');assert.equal(detect('Etc/UTC',['zh-Hant-TW']),'tw');
 assert.equal(detect('Etc/UTC',['zh-HK']),'hk');assert.equal(detect('Etc/UTC',['zh-Hant-HK']),'hk');
 assert.equal(detect('Asia/Shanghai',['zh-HK']),'chn');
});

test('Taiwan and Hong Kong clocks keep their local date formats at UTC plus eight',()=>{
 const {meta,regions}=metadata(),instant=new Date('2026-09-20T16:15:00Z');
 for(const code of ['tw','hk']){
  const format=new Intl.DateTimeFormat(meta[code].locale,{timeZone:regions[code].timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const parts=Object.fromEntries(format.formatToParts(instant).map(part=>[part.type,part.value]));
  assert.equal(parts.year,'2026');assert.equal(parts.month,'09');assert.equal(parts.day,'21');assert.equal(parts.hour,'00');assert.equal(parts.minute,'15');
 }
});

test('Traditional Chinese release history keeps every translated item',()=>{
 const notes=require('../src/release-notes.js');
 for(const release of notes.RELEASES){
  const source=notes.itemsFor(release,'chn'),translated=notes.itemsFor(release,'zht');
  assert.equal(translated.length,source.length,release.version);assert.ok(translated.every(item=>typeof item==='string'&&item.trim()),release.version);
 }
 const current=notes.itemsFor(notes.RELEASES[0],'zht').join(' ');
 assert.match(current,/分層天文模型/);assert.match(current,/金色導引線/);assert.doesNotMatch(current,/国家|之后|信息|重复/);
});
