'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('local ring preview embeds the exact atlas and ships its lazy loader',()=>{
 const window={};vm.runInNewContext(read('src/local-effect-atlases.js'),{window});
 const atlas='assets/effects/uranus-debris-atlas-v1.webp';
 assert.deepEqual(Buffer.from(window.SolarModules.LocalEffectAtlases[atlas].split(',')[1],'base64'),fs.readFileSync(path.join(root,atlas)));
 const files=require('../tools/release-files.cjs').releaseFiles(root);
 assert.ok(files.includes('src/local-effect-atlases.js'));assert.ok(files.includes(atlas));
});

test('file preview loads one lazy atlas script; web images keep their URL',async()=>{
 const source=read('src/ring-tour.js'),body=source.slice(source.indexOf('  const scriptUrl='),source.indexOf('  const TAU='));
 const window={},scripts=[],location={href:'file:///D:/SolarTime/index.html'};
 const document={currentScript:{src:'file:///D:/SolarTime/src/ring-tour.js?v=test'},createElement:()=>({}),head:{appendChild(script){scripts.push(script);}}};
 const atlasSource=vm.runInNewContext('(function(){'+body+'return atlasSource;})()',{root:window,document,location,URL});
 const web='https://example.test/atlas.webp';assert.equal(await atlasSource(web),web);assert.equal(scripts.length,0);
 const url=new URL('assets/effects/uranus-debris-atlas-v1.webp',location.href).href;
 const one=atlasSource(url),two=atlasSource(url);assert.equal(scripts.length,1);
 assert.equal(scripts[0].src,'file:///D:/SolarTime/src/local-effect-atlases.js?v=test');
 vm.runInNewContext(read('src/local-effect-atlases.js'),{window});scripts[0].onload();
 assert.equal(await one,await two);assert.ok((await one).startsWith('data:image/webp;base64,'));
});

test('Uranus opening selects its own travel even when another planet is selected',()=>{
 const window={SolarAstro:require('../src/astro.js')};vm.runInNewContext(read('src/renderer.js'),{window,performance:{now:()=>0}});
 const renderer=Object.create(window.SolarRenderer.prototype);renderer.selected='saturn';
 assert.equal(renderer.ringTourTargetBody(true,{bodyId:'uranus'}),'uranus');
 assert.equal(renderer.ringTourTargetBody(true),'saturn');assert.equal(renderer.hasRingTour('earth'),false);
 const menu=[...read('index.html').matchAll(/data-opening="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(menu,['default','saturn','uranus','none']);
 const html=read('index.html');assert.ok(html.indexOf('id="opening-play"')<html.indexOf('data-opening="default"'));
});

test('Uranus density and distant visibility are passed through the shared tour factory',()=>{
 const window={SolarAstro:require('../src/astro.js'),SolarRingTour:class{constructor(options){Object.assign(this,options);}}};
 vm.runInNewContext(read('src/renderer.js'),{window,performance:{now:()=>0},URL,location:{href:'file:///D:/SolarTime/index.html'}});
 const renderer=Object.create(window.SolarRenderer.prototype);Object.assign(renderer,{w:1280,h:800,options:{quality:'high'}});
 const uranus=renderer.createRingTour('uranus',{}),saturn=renderer.createRingTour('saturn',{});
 assert.equal(uranus.debrisDensity,.6);assert.equal(uranus.distantRingGain,2.5);
 assert.equal(uranus.debrisMaxSize,.8);assert.equal(uranus.debrisHeight,.7);assert.equal(saturn.debrisHeight,undefined);
 assert.equal(saturn.debrisDensity,undefined);assert.equal(saturn.distantRingGain,undefined);
 assert.equal(uranus.grainStyle.toString(),saturn.grainStyle.toString());
});

test('ring hover follows the pointer target independently of the selected planet',()=>{
 const window={SolarAstro:require('../src/astro.js')};vm.runInNewContext(read('src/renderer.js'),{window,performance:{now:()=>0}});
 const r=Object.create(window.SolarRenderer.prototype);let invalidations=0;
 r.selected='saturn';r.invalidatePresentation=()=>invalidations++;
 r.bodyFrame=()=>({u:{x:1,y:0,z:0},v:{x:0,y:1,z:0}});
 r.currentFrameItem=id=>({body:{id},r:10,screen:{x:id==='uranus'?400:100,y:200}});
 const starts=[],c={save(){},restore(){},beginPath(){},moveTo(x){starts.push(x);},lineTo(){},stroke(){}};
 r.setRingTourHover({bodyId:'uranus'});r.drawRingTourHover(c);
 assert.deepEqual(starts,[415.8,419.4]);assert.equal(invalidations,1);
 assert.equal(r.setRingTourHover({bodyId:'uranus'}),false);
 r.selected='uranus';starts.length=0;r.setRingTourHover({bodyId:'saturn'});r.drawRingTourHover(c);
 assert.deepEqual(starts,[113.5,122.6]);
 r.setRingTourHover(null);starts.length=0;r.drawRingTourHover(c);assert.equal(starts.length,0);
});


test('opening choices run immediately except none and ignore duplicate selections',()=>{
 const source=read('src/app.js'),start=source.indexOf("for(const option of $('opening-menu').querySelectorAll('[data-opening]'))option.addEventListener('click',()=>{"),end=source.indexOf('      });',start);
 assert.ok(start>=0&&end>start);
 const handler=source.slice(source.indexOf('()=>{',start)+5,end);
 for(const mode of ['default','saturn','uranus','none']){
  let locked=false,runs=0,writes=0;
  const context={openingMode:'default',option:{dataset:{opening:mode}},clock:{paused:false},openingModeKey:'opening',Preferences:{write(){writes++;}},openingMenuLocked:()=>locked,syncOpeningMenu(){},syncTravelControlLock(){},replayOpening(){runs++;locked=true;}};
  vm.runInNewContext("(()=>{"+handler+"})()",context);
  assert.equal(context.openingMode,mode);assert.equal(writes,1);assert.equal(runs,mode==='none'?0:1);
  locked=true;vm.runInNewContext("(()=>{"+handler+"})()",context);assert.equal(writes,1,'locked choices must not even change saved mode');
 }
});

test('opening menu remains locked through automatic ring travel and return',()=>{
 const source=read('src/app.js'),start=source.indexOf('      function cameraViewControlsLocked()'),end=source.indexOf('      function travelSettingsLocked()',start);
 const context={openingActive:false,openingReplayLocked:false,renderer:{ringTour:null}};
 vm.runInNewContext(source.slice(start,end),context);
 assert.equal(context.openingMenuLocked(),false);
 for(const state of ['entering','cruising','returning']){context.renderer.ringTour={state,openingResume:true};assert.equal(context.openingMenuLocked(),true);}
 context.renderer.ringTour=null;assert.equal(context.openingMenuLocked(),false);
 context.renderer.cameraTween={replay:{}};assert.equal(context.openingMenuLocked(),true);
});
