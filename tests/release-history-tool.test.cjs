'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{plan}=require('../tools/release-history.cjs');
const codes=['kor','en'],records=Array.from({length:13},(_,i)=>({version:'0.'+(80-i),date:'2026.09.30',localized:{kor:['기록 '+i],en:['Note '+i]}}));
test('rolling history retains ten languages and archives all older Korean text losslessly',()=>{
 const original=JSON.stringify(records),p=plan(records,[],codes);
 assert.equal(p.recent.length,10);assert.equal(p.archived.length,3);assert.deepEqual(p.missingTranslations,[]);
 assert.deepEqual(p.archived.map(r=>r.items),records.slice(10).map(r=>r.localized.kor));
 assert.equal(JSON.stringify(records),original);assert.deepEqual(plan(p.recent,p.archived,codes).archived,p.archived);
});
test('duplicates, bad order, and missing Korean text fail before pruning',()=>{
 assert.throws(()=>plan([records[0],records[0]],[],codes),/Duplicate/);
 assert.throws(()=>plan([...records].reverse(),[],codes),/unsorted/);
 const rows=structuredClone(records);rows[12].localized.kor=[];assert.throws(()=>plan(rows,[],codes),/Korean/);
});
test('missing retained translations are reported, never silently filled with English',()=>{
 const rows=structuredClone(records);delete rows[1].localized.en;
 assert.deepEqual(plan(rows,[],codes).missingTranslations,['0.79:en']);
});

test('write mode regenerates an isolated fixture, retains Korean history and is idempotent',()=>{
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),api=require('../tools/release-history.cjs');
 const real=path.resolve(__dirname,'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'solar-release-test-'));
 try{
  for(const dir of ['i18n','src'])fs.cpSync(path.join(real,dir),path.join(tmp,dir),{recursive:true});
  for(const file of fs.readdirSync(real).filter(f=>/\.(html|css|md)$/.test(f)))fs.copyFileSync(path.join(real,file),path.join(tmp,file));
  fs.mkdirSync(path.join(tmp,'assets'));
  for(const file of ['manifest.json','revision.json','deployment.json','material-info.json'])fs.copyFileSync(path.join(real,'assets',file),path.join(tmp,'assets',file));
  const historyFile=path.join(tmp,'i18n/releases.json'),allowFile=path.join(tmp,'i18n/legacy-allowlist.json');
  const history=JSON.parse(fs.readFileSync(historyFile)),before=JSON.parse(fs.readFileSync(path.join(tmp,'i18n/releases-archive-ko.json')));
  const languages=Object.keys(JSON.parse(fs.readFileSync(path.join(tmp,'i18n/config.json'))).languages),allow=JSON.parse(fs.readFileSync(allowFile));
  history.unshift({...history[0],version:(Number(history[0].version)+.01).toFixed(2)});
  // Synthetic fixture only: mock missing translations without mutating or
  // misrepresenting the real app's existing translation gaps.
  for(const row of history.slice(0,10))for(const code of languages)if(!row.localized[code]){row.localized[code]=row.localized.en.map(s=>'fixture '+s);delete allow.inherited[code+':release.'+row.version];}
  fs.writeFileSync(historyFile,JSON.stringify(history));fs.writeFileSync(allowFile,JSON.stringify(allow));
  const report=api.run(tmp,{write:true});assert.ok(report.backup);
  const recent=JSON.parse(fs.readFileSync(historyFile)),archive=JSON.parse(fs.readFileSync(path.join(tmp,'i18n/releases-archive-ko.json')));
  assert.equal(recent.length,10);assert.equal(recent.length+archive.length,history.length+before.length);
  assert.deepEqual([...recent.map(r=>r.localized.kor),...archive.map(r=>r.items)],[...history.map(r=>r.localized.kor),...before.map(r=>r.items)]);
  assert.deepEqual(api.run(tmp,{write:true}).changed,[]);
 }finally{
  // Only this test's fresh, explicitly bounded temporary directory.
  if(path.dirname(tmp)===os.tmpdir()&&path.basename(tmp).startsWith('solar-release-test-'))fs.rmSync(tmp,{recursive:true,force:true});
 }
});
