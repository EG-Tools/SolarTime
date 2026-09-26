'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8'),rows=require('./fixtures/regions-v061.json');
function metadata(){const app=read('src/app.js'),a=app.indexOf('  const LANG_ORDER='),b=app.indexOf('  const STAR_DENSITY_COPY=',a);return vm.runInNewContext(app.slice(a,b)+';({order:LANG_ORDER,meta:LANG_META,regions:REGIONS})');}
function detect(zone,languages){const window={};vm.runInNewContext(read('src/localization.js'),{window,navigator:{languages,language:languages[0]},Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})})}});return window.SolarModules.Localization.detect();}
test('13 requested countries reuse existing English/Spanish without new locale payloads',()=>{
 const {order,meta,regions}=metadata(),prior=['ao','ar','au','at','be','br','ca','cl','chn','co','cr','ec','fr','de','hk','hi','id','ie','it','jpn','kor','mx','mz','nl','nz','pa','pe','pt','sg','es','tw','eu','en','uy','ve'];
 assert.equal(order.length,48);assert.equal(new Set(order).size,48);assert.equal(rows.filter(r=>r.copy==='en').length,11);assert.equal(rows.filter(r=>r.copy==='es').length,2);
 assert.deepEqual(Array.from(order).filter(c=>!rows.some(r=>r.code===c)),prior);
 for(const r of rows){assert.deepEqual(JSON.parse(JSON.stringify(meta[r.code])),{code:r.code.toUpperCase(),name:r.name,locale:r.locale,html:r.locale,copy:r.copy});
  assert.deepEqual(JSON.parse(JSON.stringify(regions[r.code])),{label:r.label,timeZone:r.timeZone,latitude:r.latitude,longitude:r.longitude,region:r.name,city:r.city});
  assert.ok(!fs.existsSync(path.join(__dirname,'../src/locales/'+r.code+'.json')));
 }
 assert.equal(fs.readdirSync(path.join(__dirname,'../src/locales')).filter(f=>f.endsWith('.json')).length,13);
 const html=read('index.html'),block=html.slice(html.indexOf('id="language-scroll"'),html.indexOf('scroll-cue-down',html.indexOf('id="language-scroll"')));
 assert.deepEqual([...block.matchAll(/data-language="([^"]+)"/g)].map(m=>m[1]),Array.from(order));
});
for(const r of rows){
 test(r.code+' uses local time in winter/summer and on date rollover',()=>{
  const {regions}=metadata(),f=new Intl.DateTimeFormat('en-CA',{timeZone:regions[r.code].timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(const [date,offset] of [['2026-01-15T23:30:00Z',r.winterOffset],['2026-07-15T01:30:00Z',r.summerOffset]]){
   const expected=new Date(Date.parse(date)+offset*3600000).toISOString(),parts=Object.fromEntries(f.formatToParts(new Date(date)).map(p=>[p.type,p.value]));
   assert.equal(parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute,expected.slice(0,16),r.code+' '+date);
  }
  if(r.winterOffset!==r.summerOffset){
   const hour=date=>f.formatToParts(new Date(date)).find(p=>p.type==='hour').value;
   assert.equal(Number(hour('2026-03-29T01:00:00Z'))-Number(hour('2026-03-29T00:59:00Z')),2);
   assert.equal(hour('2026-10-25T00:59:00Z'),hour('2026-10-25T01:00:00Z'));
  }
 });
 test(r.code+' supports device timezone and explicit locale fallback without overriding known foreign zones',()=>{
  assert.equal(detect(r.timeZone,['en-US']),r.code);assert.equal(detect('Etc/UTC',[r.locale]),r.code);
  assert.equal(detect('Etc/UTC',[r.locale+'-u-hc-h23']),r.code);assert.equal(detect('Etc/UTC',['en-Latn-'+r.code.toUpperCase()]),r.code);
  assert.equal(detect('Asia/Seoul',[r.locale]),'kor');assert.equal(detect('Asia/Tokyo',[r.locale]),'jpn');
 });
}
test('timezone aliases use compatible regional hints, not a universal country guess',()=>{
 for(const [zone,language,wanted] of [['Europe/Berlin','nb-NO','no'],['Europe/Berlin','sv-SE','se'],['Europe/Berlin','da-DK','dk'],['Europe/Berlin','en-US','de'],['Africa/Abidjan','is-IS','is'],['Africa/Abidjan','en-GH','gh'],['Africa/Abidjan','en-US','en'],['Asia/Singapore','ms-MY','my'],['Asia/Singapore','en-SG','sg'],['Asia/Singapore','zh-CN','sg'],['Asia/Kuching','en-US','my'],['Iceland','en-US','is'],['America/Dominica','en-US','en'],['Africa/Luanda','en-NG','ao']])assert.equal(detect(zone,[language]),wanted,zone+' '+language);
 for(const [language,wanted] of [['nb','no'],['nn','no'],['sv','se'],['da','dk'],['fi','fi'],['is','is'],['mt','mt'],['fil','ph'],['tl','ph'],['ms','my'],['af','za']])assert.equal(detect('Etc/UTC',[language]),wanted);
 assert.equal(detect('Europe/Berlin',['de-DE','en-NO']),'de');assert.equal(detect('Asia/Singapore',['en-SG','en-MY']),'sg');
});
test('fixed AUTO is outside the country scroller and preserves the shared popup/keyboard owner',()=>{
 const html=read('index.html'),menu=html.slice(html.indexOf('id="language-menu"'),html.indexOf('id="timer-button"'));
 assert.equal((menu.match(/data-language-auto/g)||[]).length,1);assert.ok(menu.indexOf('data-language-auto')<menu.indexOf('class="language-list"'));assert.ok(menu.indexOf('class="language-list"')<menu.indexOf('id="language-scroll"'));
 assert.match(read('styles.css'),/\.language-list\{position:relative;flex:1;min-height:0\}/);
 assert.match(read('src/app.js'),/querySelectorAll\('\[role="menuitemradio"\]'\)/);
});
