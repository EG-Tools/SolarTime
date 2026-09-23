'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const {compactRuntimeManifest}=require('../tools/asset-pipeline.cjs');

test('browser asset manifest keeps only fields used at runtime',()=>{
  const manifest=JSON.parse(read('assets/manifest.json')),compact=compactRuntimeManifest(manifest),source=read('src/assets.js');
  assert.ok(JSON.stringify(compact).length<JSON.stringify(manifest).length/2);
  assert.equal(compact.materials.earth.tiers[0].bytes,undefined);
  assert.equal(compact.materials.earth.tiers[0].sha256,undefined);
  assert.equal(compact.materials.earth.source,undefined);
  assert.doesNotMatch(source,/"sha256"|"bytes"|"source"/);
  assert.match(source,/stars:null/);
});

test('runtime-only asset build is available without rebuilding 4K media',()=>{
  const pkg=JSON.parse(read('package.json')),builder=read('tools/build-assets.cjs');
  assert.equal(pkg.scripts['build:runtime-assets'],'node tools/build-assets.cjs --runtime-only');
  assert.match(builder,/runtimeOnly\?existing\(\):await buildMedia/);
});
