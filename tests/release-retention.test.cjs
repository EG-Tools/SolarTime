'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),data=p=>JSON.parse(read(p));
const spec=data('tests/fixtures/release-retention-v064.json'),api=require('../tools/i18n.cjs'),notes=require('../src/release-notes.js');
test('approved one-time pruning removes the oldest half, not a language-specific display filter',()=>{
 assert.equal(spec.retainedVersions.length+spec.removedVersions.length,spec.originalCount);
 assert.equal(spec.removedVersions.length,Math.floor(spec.originalCount/2));
 const rows=data('i18n/releases.json'),old=rows.filter(r=>Number(r.version)<Number(spec.prunedInVersion));
 assert.deepEqual(old.map(r=>r.version),spec.retainedVersions);
 assert.ok(spec.removedVersions.every(v=>!rows.some(r=>r.version===v)));
 assert.deepEqual(data('i18n/releases-archive-ko.json').slice(0,spec.removedVersions.length).map(r=>r.version),spec.removedVersions);
 assert.deepEqual(notes.RELEASES.map(r=>r.version),rows.map(r=>r.version));
});
test('every retained canonical release preserves its date and all exact localized text',()=>{
 const rows=data('i18n/releases.json');
 for(const [version,digest] of Object.entries(spec.retainedSourceHashes))assert.equal(api.fingerprint(rows.find(r=>r.version===version)),digest,version);
});
test('removed multilingual versions remain absent from runtime data but are restored in the Korean archive',()=>{
 const compiled=api.compile(root),allow=data('i18n/legacy-allowlist.json'),fixture=data('tests/fixtures/i18n-v061.json');
 for(const version of spec.removedVersions){
  assert.ok(!compiled.releases.some(r=>r.version===version));
  assert.ok(compiled.archive.some(r=>r.version===version));
  assert.ok(!Object.keys(allow.inherited).some(k=>k.endsWith(':release.'+version)),version);
  assert.ok(!Object.hasOwn(fixture.releases,version));
 }
 assert.deepEqual(api.sync(root).changed,[]);
});
test('all 13 language views use the same remaining history and correct navigation boundaries',()=>{
 for(const language of Object.keys(data('i18n/config.json').languages)){
  const nav=notes.createReleaseNotesNavigator();
  for(let i=0;i<notes.RELEASES.length+5;i++)nav.older();
  assert.equal(nav.current().release.version,spec.retainedVersions.at(-1));
  assert.ok(notes.itemsFor(nav.current().release,language).length>0);
  for(let i=0;i<notes.RELEASES.length+5;i++)nav.newer();
  assert.equal(nav.current().release.version,data('version.json').version);
 }
 const current=notes.RELEASES.find(r=>r.version===spec.prunedInVersion);
 for(const code of Object.keys(data('i18n/config.json').languages))assert.equal(current.localized[code].length,3,code);
});
