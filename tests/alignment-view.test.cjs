'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const A=require('../src/astro.js');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Sun card keeps alignment navigation before the final body-option section',()=>{
  const html=read('index.html'),feature=html.indexOf('id="feature-view"'),alignment=html.indexOf('id="alignment-control"'),options=html.indexOf('id="body-card-options"'),cardEnd=html.indexOf('</aside>',alignment);
  assert.ok(feature>=0&&feature<alignment&&alignment<options&&options<cardEnd);
  assert.match(html,/id="alignment-previous" class="step-previous"/);
  assert.match(html,/id="alignment-next" class="step-next"/);
  assert.match(html,/class="step-navigation eclipse-navigation"/);
});

test('alignment catalog keeps Earth-sky dates and strict space-axis dates distinct',()=>{
  let previous=-Infinity;
  for(const event of A.PLANETARY_ALIGNMENT_EVENTS){
    assert.ok(event.planets.length>=5,event.date);
    assert.ok(event.ms>previous,event.date);previous=event.ms;
    assert.ok(event.kind==='sky'||event.kind==='space',event.date);
    assert.equal(event.ms,Date.parse(event.epoch),event.date);
    if(event.kind==='space'){assert.ok(event.maxError<=2,event.date);assert.equal(new Date(event.ms).getUTCHours(),0,event.date);}
  }
  const dates=A.PLANETARY_ALIGNMENT_EVENTS.map(event=>event.date);
  for(const excluded of ['2026-11-14','2027-04-18','2034-02-03'])assert.ok(!dates.includes(excluded),excluded);
  assert.ok(A.PLANETARY_ALIGNMENT_EVENTS.some(event=>event.kind==='sky'));
  assert.ok(A.PLANETARY_ALIGNMENT_EVENTS.some(event=>event.kind==='space'));
  assert.ok(!A.PLANETARY_ALIGNMENT_EVENTS.some(event=>event.kind==='same-side'));
  assert.equal(A.planetaryAlignmentEvent(Date.UTC(2027,0,1),1).date,'2027-07-02');
  assert.equal(A.planetaryAlignmentEvent(Date.UTC(2028,0,1),-1).date,'2027-12-25');
});

test('alignment scanner emits the exact UTC epoch consumed by the catalog',()=>{
  const scanner=read('tools/scan-space-alignments.cjs'),astro=read('src/astro.js');
  assert.match(scanner,/epoch:new Date\(event\.ms\)\.toISOString\(\)/);
  assert.match(astro,/ms=Date\.parse\(epoch\)/);
  assert.doesNotMatch(astro,/Date\.UTC\(year,month-1,day,6\)/);
});

test('alignment travel preserves the current camera and is available only from the Sun card',()=>{
  const app=read('src/app.js'),section=app.slice(app.indexOf('function syncAlignmentControl'),app.indexOf('const statNodes'));
  assert.match(section,/bodyId==='sun'/);
  assert.match(section,/A\.planetaryAlignmentEvent\(base,direction\)/);
  assert.match(section,/renderer\.setAlignmentGuide\(event\)/);
  assert.match(section,/clock\.travelTo\(event\.ms,mono,2000\)/);
  assert.doesNotMatch(section,/animateFocus|animateHome|restoreCamera|setCamera/);
});

test('every locale carries full alignment labels and long names wrap without abbreviations',()=>{
  const files=fs.readdirSync(path.join(root,'src','locales')).filter(file=>file.endsWith('.json'));
  for(const file of files){
    const copy=JSON.parse(read(path.join('src','locales',file))).copy;
    for(const key of ['alignmentView','alignmentPrevious','alignmentNext','alignmentUnavailable'])assert.ok(copy[key],`${file}: ${key}`);
  }
  assert.equal(JSON.parse(read('src/locales/en.json')).copy.alignmentView,'Planetary alignment');
  const css=read('styles.css');assert.match(css,/\.alignment-control>span\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.eclipse-control\{[^}]*flex-direction:column[^}]*align-items:center/);
  assert.match(css,/\.eclipse-control>span\{[^}]*width:100%[^}]*text-align:center/);
  assert.match(css,/\.alignment-control output\.space-alignment\{[^}]*color:#e7bd70/);
});

test('viewport alignment guide is anchored to Earth or Sun and drawn for either catalog kind',()=>{
  const renderer=read('src/renderer.js');
  assert.match(renderer,/setAlignmentGuide\(event\)/);
  assert.match(renderer,/guide\.kind==='space'\?'sun':'earth'/);
  assert.match(renderer,/this\.drawAlignmentGuide\(c,ms\)/);
  assert.match(renderer,/strokeStyle='#e9bd67'/);
});
