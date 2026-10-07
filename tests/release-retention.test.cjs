'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),data=p=>JSON.parse(read(p));
const baseline=data('tests/fixtures/release-history-v069.json'),api=require('../tools/i18n.cjs'),notes=require('../src/release-notes.js');

test('rolling retention keeps exactly ten validated releases with a unique Korean archive',()=>{
 const compiled=api.compile(root),rows=compiled.releases,archive=compiled.archive;
 assert.equal(rows.length,10);assert.equal(compiled.codes.length,15);
 assert.deepEqual(notes.RELEASES.map(r=>r.version),rows.map(r=>r.version));
 const all=[...rows,...archive],versions=all.map(r=>r.version);
 assert.equal(new Set(versions).size,versions.length);
 for(let n=1;n<versions.length;n++)assert.ok(Number(versions[n])<Number(versions[n-1]));
 for(const row of rows)for(const code of compiled.codes){if(row.languagePolicy==='korean-only')assert.deepEqual(Object.keys(row.localized),['kor']);else assert.equal(row.localized[code].length,row.localized.kor.length,row.version+' '+code);}
 for(const row of archive)assert.deepEqual(Object.keys(row).sort(),['date','items','version']);
});

test('every pre-migration Korean record preserves its date and exact text',()=>{
 const compiled=api.compile(root),all=[...compiled.releases.map(r=>({version:r.version,date:r.date,items:r.localized.kor})),...compiled.archive];
 assert.ok(all.length>=baseline.totalCount);
 for(const [version,digest] of Object.entries(baseline.korean))assert.equal(api.fingerprint(all.find(r=>r.version===version)),digest,version);
 assert.equal(all.at(-1).version,'0.01');
});

test('older translations and fallback permissions are absent while Korean pages remain generated',()=>{
 const compiled=api.compile(root),allow=data('i18n/legacy-allowlist.json'),fixture=data('tests/fixtures/i18n-v061.json');
 for(const row of compiled.archive){
  assert.ok(!compiled.releases.some(r=>r.version===row.version));
  assert.ok(!Object.keys(allow.inherited).some(k=>k.endsWith(':release.'+row.version)),row.version);
  assert.ok(!Object.hasOwn(fixture.releases,row.version));
  assert.ok(read('CHANGELOG.md').includes('## v'+row.version+' · '));
  assert.ok(read('changelog.html').includes('id="v'+row.version+'"'));
 }
 assert.deepEqual(api.sync(root).changed,[]);
});

test('all 13 language views navigate the same ten recent versions',()=>{
 for(const language of Object.keys(data('i18n/config.json').languages)){
  const nav=notes.createReleaseNotesNavigator();
  for(let i=0;i<15;i++)nav.older();
  assert.equal(nav.current().release.version,notes.RELEASES.at(-1).version);assert.equal(nav.current().hasOlder,false);
  assert.ok(notes.itemsFor(nav.current().release,language).length>0);
  for(let i=0;i<15;i++)nav.newer();
  assert.equal(nav.current().release.version,data('version.json').version);assert.equal(nav.current().hasNewer,false);
 }
});
