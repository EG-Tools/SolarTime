const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('v0.42 exposes public version and patch revision independently',()=>{
  const html=read('index.html'),version=JSON.parse(read('version.json')),app=read('src/app.js');
  assert.match(html,/name="solar-time-version" content="0\.42"/);
  assert.match(html,/name="solar-time-revision" content="r1"/);
  assert.deepEqual(version,{version:'0.42',revision:'r1'});
  assert.match(html,/revisionNumber/);
  assert.match(html,/previous\?\.revision===revision/);
  assert.match(html,/searchParams\.set\('revision',revision\)/);
  assert.match(app,/version:'0\.42',revision:'r1'/);
});

test('active region readout tracks Earth and remains keyboard accessible',()=>{
  const app=read('src/app.js');
  assert.match(app,/function trackActiveRegion\(\)\{const region=activeRegion\(\);cancelGesture\(\);settings\(false\);renderer\.animateFeature\('earth',region\.latitude,region\.longitude/);
  assert.match(app,/regionReadout\.setAttribute\('role','button'\)/);
  assert.match(app,/regionReadout\.tabIndex=0/);
  assert.match(app,/regionReadout\.addEventListener\('click',trackActiveRegion\)/);
  assert.match(app,/event\.key!==\'Enter\'&&event\.key!==\' \'/);
});

test('iPhone safe areas are applied to top and bottom UI',()=>{
  const css=read('src/runtime-optimizations.css');
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.masthead\{top:calc\(31px \+ var\(--solar-safe-top\)\)\}/);
  assert.match(css,/\.footer\{bottom:calc\(24px \+ var\(--solar-safe-bottom\)\)\}/);
});

test('adaptive performance avoids treating every touchscreen desktop as mobile',()=>{
  const perf=read('src/performance.js');
  assert.match(perf,/userAgentData\?\.mobile===true/);
  assert.match(perf,/iPadOS/);
  assert.match(perf,/coarsePointer&&shortSide<=820/);
  assert.doesNotMatch(perf,/navigator\.maxTouchPoints>0\|\|matchMedia/);
  assert.match(perf,/96\*MiB:192\*MiB/);
  assert.match(perf,/1000\/30:1000\/60/);
});

test('v0.42 keeps 256px media LOD and lazy release notes',()=>{
  const pipeline=read('tools/asset-pipeline.cjs'),app=read('src/app.js'),html=read('index.html');
  assert.match(pipeline,/\[256,512,1024,2048,4096\]/);
  assert.doesNotMatch(html,/src="src\/release-notes\.js/);
  assert.match(app,/script\.src='src\/release-notes\.js\?v=0\.42'/);
  assert.match(app,/CURRENT_RELEASE=Object\.freeze\(\{version:'0\.42'/);
  assert.match(app,/withCurrentRelease\(window\.SolarReleaseNotes\)/);
});
