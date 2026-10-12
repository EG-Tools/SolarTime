'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),window={};
vm.runInNewContext(read('src/sky.js'),{window,performance});
const localized=require('../i18n/locales/kor.json'),card=id=>({name:localized.bodies[id][0],description:localized.bodies[id][1]});
const Sky=window.SolarSky,feature=Sky.BIG_DIPPER,polaris=Sky.POLARIS;

test('explicit guide OFF cancels a navigation reveal and uses the same fade on first and repeated use',()=>{
 const sky=centeredSky(),id='big-dipper',curves=[];
 for(const first of [true,false]){
  sky.featurePinned=new Set([id]);sky.featurePinnedTransitions=new Map();
  if(first)sky.revealFeature(id,5000,performance.now()-1000);
  sky.setFeaturePinned(id,false);const start=sky.featurePinnedTransitions.get(id).start;
  assert.equal(sky.featureTransientTransitions?.has(id)||false,false);
  const duration=sky.featureDisplayTransitionDuration(false);
  curves.push([0,.25,.5,1].map(t=>sky.featureLineVisual(id,start+duration*t).opacity));
 }
 curves[0].forEach((opacity,i)=>assert.ok(Math.abs(opacity-curves[1][i])<1e-12));assert.equal(curves[0][0],1);assert.equal(curves[0][3],0);
});

test('twenty constellations share one complete catalogue of geometry, Korean cards and connected traces',()=>{
 const groups=Object.values(Sky.FEATURES);assert.equal(groups.length,22);
 assert.deepEqual(groups.slice(2).map(f=>f.id),['ursa-major','ursa-minor','cassiopeia','orion','scorpius','leo','cygnus','taurus','aries','gemini','cancer','virgo','libra','sagittarius','capricornus','aquarius','pisces','pegasus','andromeda','crux']);
 for(const f of groups){
  assert.ok(card(f.id).name&&card(f.id).description&&f.card.english);
  for(const s of f.stars){assert.ok(Number.isFinite(s.ra+s.dec+s.magnitude));assert.ok(s.ra>=0&&s.ra<24&&Math.abs(s.dec)<=90);assert.equal(s.depth,99);}
  const key=e=>Array.from(e).sort((a,b)=>a-b).join(':'),edges=f.edges.map(key),traces=f.traceGroups.flat().map(key);
  assert.equal(new Set(edges).size,edges.length);assert.deepEqual(traces.sort(),edges.sort());
  const reached=new Set([f.traceGroups[0]?.[0]?.[0]??0]);let components=1;for(const group of f.traceGroups){if(!group.some(([a])=>reached.has(a))){reached.add(group[0][0]);components++;}for(const [a,b] of group){assert.ok(reached.has(a));assert.ok(f.stars[a]&&f.stars[b]);}for(const [a,b] of group){reached.add(a);reached.add(b);}}
  assert.ok(components<=(f.id==='crux'?2:1),f.id+' has an unexpected disconnected guide');
  assert.equal(reached.size,f.stars.length);
 }
 for(const s of feature.stars)assert.ok(Sky.FEATURES['ursa-major'].stars.includes(s));
 assert.equal(Sky.FEATURES['ursa-minor'].stars[0],polaris.stars[0]);
 assert.equal(Sky.FEATURES['ursa-minor'].stars[0].style,polaris.style);
 const zodiac=['aries','taurus','gemini','cancer','leo','virgo','libra','scorpius','sagittarius','capricornus','aquarius','pisces'];
 assert.ok(zodiac.every(id=>Sky.FEATURES[id]),'all twelve zodiac constellations are present');
 assert.equal(Sky.FEATURES.pegasus.stars.find(star=>star.name==='Alpheratz'),Sky.FEATURES.andromeda.stars.find(star=>star.name==='Alpheratz'));
});

test('formerly shortened Western figures retain their complete reference topology',()=>{
 const paths={
  'ursa-major':[[67301,65378,62956,59774,54061,53910,58001,59774],[58001,57399,54539,50372],[54539,50801],[53910,48402,46853,44471],[46853,44127],[48402,48319,41704,46733,54061]],
  orion:[[26727,26311,25930],[28691,29426,29038,27913],[29426,28614,27989,26727,27366,24436,25930,25336,26207,27989],[25336,22449,22549,22730,23123],[22449,22509,22845],[29038,28614]],
  scorpius:[[85927,86670,87073,86228,84143,82671,82514,82396,81266,80763,78401],[80763,78265],[80763,78820]],
  cygnus:[[94779,95853,97165,100453,102098],[100453,102488,104732,107310],[100453,98110,95947]],
  taurus:[[25428,21881,20889],[21421,26451],[20205,20455],[20205,18724,15900],[21421,20889],[21421,20894,20205],[20889,20648,20455,17847]],
  gemini:[[31681,34088,35550,35350,32362],[35550,36962,37740],[36962,37826],[36962,36046,34693,36850],[34693,33018],[34693,32246,30883],[32246,30343,29655,28734]],
  cancer:[[43103,42806,40843],[42806,42911,40526],[42911,44066]],
  virgo:[[57380,60030,61941,65474,69427,69701,71957],[65474,66249,68520,72220],[66249,63090,63608],[63090,61941]],
  sagittarius:[[89931,90496],[89642,90185,88635,87072],[88635,89931,90185,93506,92041,89931],[92041,90496,89341],[93506,93864,92855,92041],[92855,93085,93683,94820,95168],[93864,96406,98688,98412,98032,95347],[98032,95294]],
  capricornus:[[100064,100345,104139,105515,106985,107556],[105515,105881,104139],[100345,102485],[104139,102978]],
  aquarius:[[106278,109074,110395,110960,111497,112961,114855,115438],[109074,110003,109139],[110003,111123,112716,113136,114341],[102618,106278]],
  pisces:[[4889,5742],[4889,6193,5742,7097,8198,9487,8833,7884,7007,4906,3786,1645,118268,116771,116928,115738,114971,115830,116771]],
 };
 const edgeSet=lines=>new Set(lines.flatMap(line=>line.slice(1).map((hip,index)=>[line[index],hip].sort((a,b)=>a-b).join(':'))));
 for(const [id,lines] of Object.entries(paths)){
  const f=Sky.FEATURES[id],actual=new Set(f.edges.map(([a,b])=>[f.stars[a].hip,f.stars[b].hip].sort((x,y)=>x-y).join(':')));
  assert.deepEqual([...actual].sort(),[...edgeSet(lines)].sort(),id);
 }
});

test('shared stars and guide segments have one painter even with parent constellations pinned',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper','ursa-major','polaris','ursa-minor']);
 const entries=sky.updateSkyFeatures(),owners=sky.featureRenderOwners(entries,1000);
 assert.equal(owners.stars.size,new Set(entries.filter(e=>e.visible).flatMap(e=>e.feature.stars)).size);
 sky.featureTracked='ursa-major';const tracked=sky.featureRenderOwners(entries,1000);
 for(const s of feature.stars)assert.equal(tracked.stars.get(s).entry.feature.id,'ursa-major');
 assert.equal(tracked.markers.get(polaris.stars[0]),polaris);assert.equal(polaris.marker.kind,'circle');assert.equal(polaris.marker.diameterScale,2);
 const expected=new Set(entries.filter(e=>e.visible&&sky.isFeaturePinned(e.feature.id)).flatMap(e=>e.feature.edges.map(([a,b])=>owners.edgeKey(e.feature,a,b))));assert.equal(owners.lines.size,expected.size);
});

test('every selected or hovered feature becomes brighter blue-white while all other guides keep dimmed gold',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper','ursa-major']);sky.featurePinnedTransitions=new Map();
 assert.equal(Sky.FEATURE_RELATIONS.get('big-dipper').has('ursa-major'),true);assert.equal(Sky.FEATURE_RELATIONS.get('polaris').has('ursa-minor'),true);
 sky.setFeatureSelected('big-dipper');let transition=sky.featureRelationTransitions.get('big-dipper');
 assert.equal(sky.featureRelationFactor('big-dipper',transition.start),0);assert.ok(sky.featureRelationFactor('big-dipper',transition.start+350)>0);assert.equal(sky.featureRelationFactor('big-dipper',transition.start+700),1);assert.equal(sky.featureRelationFactor('polaris',transition.start+700),0);
 const owners=sky.featureRenderOwners(sky.updateSkyFeatures(),transition.start+700),big=sky.skyFeatures.find(entry=>entry.feature.id==='big-dipper'),parent=sky.skyFeatures.find(entry=>entry.feature.id==='ursa-major');
 assert.equal(big.lineVisual.opacity,1);assert.equal(parent.lineVisual.opacity,1);assert.equal(big.lineColor,'rgb(210,232,255)');assert.equal(parent.lineColor,'rgb(233,189,103)');assert.equal(big.lineIntensity,1.1);assert.equal(parent.lineIntensity,.7);assert.ok(owners.lines.size>0);
 sky.setFeatureHover('ursa-major');transition=sky.featureRelationTransitions.get('ursa-major');assert.equal(sky.featureRelationFactor('big-dipper',transition.start+700),0);assert.equal(sky.featureRelationFactor('ursa-major',transition.start+700),1);
 const reversed=sky.featureRenderOwners(sky.updateSkyFeatures(),transition.start+700),active=sky.skyFeatures.find(entry=>entry.feature.id==='ursa-major'),related=sky.skyFeatures.find(entry=>entry.feature.id==='big-dipper');assert.equal(active.lineColor,'rgb(210,232,255)');assert.equal(related.lineColor,'rgb(233,189,103)');assert.ok(reversed.lines.size>0);
 sky.setFeatureHover('polaris');transition=sky.featureRelationTransitions.get('polaris');const polarPair=sky.featureRenderOwners(sky.updateSkyFeatures(),transition.start+700);assert.equal(sky.skyFeatures.find(entry=>entry.feature.id==='polaris').lineColor,'rgb(210,232,255)');assert.equal(sky.skyFeatures.find(entry=>entry.feature.id==='ursa-minor').lineColor,'rgb(233,189,103)');assert.ok(polarPair.lines.size>0);
 sky.setFeatureHover('orion');transition=sky.featureRelationTransitions.get('orion');assert.equal(sky.featureGuideColor('orion',transition.start+700),'rgb(210,232,255)');assert.equal(sky.featureGuideColor('cassiopeia',transition.start+700),'rgb(233,189,103)');assert.equal(sky.featureGuideIntensity('orion',transition.start+700),1.1);assert.equal(sky.featureGuideIntensity('cassiopeia',transition.start+700),.7);
});

test('all new constellations use the same framing at a fixed lens, accepting overflow for large shapes',()=>{
 const sky=centeredSky();for(const [w,h] of [[1920,1080],[390,844]]){sky.w=w;sky.h=h;const lens=sky.tanFov;
  for(const id of Object.keys(Sky.FEATURES)){const frame=sky.featureCameraPose(id);assert.ok(frame&&Number.isFinite(frame.azimuth+frame.elevation),id);assert.equal(sky.tanFov,lens);}
 }
});
test('closing a sky card clears selection and hover while keeping its compact layout throughout the fade',()=>{
 const app=read('src/app.js'),classes=new Set(['sky-feature']),panel={classList:{remove:name=>classes.delete(name)}};
 const cleared=[],context={selectedSkyFeature:'big-dipper',bodyInfoSignature:'sky',renderer:{selected:null,setSkyFeatureSelected:id=>cleared.push(['selected',id]),setSkyFeatureHover:id=>cleared.push(['hover',id]),invalidatePresentation(){}},$:()=>panel,navButtons:new Map(),hideFading:node=>{assert.equal(node,panel);assert.ok(classes.has('sky-feature'));}};
 vm.createContext(context);
 const clear=app.match(/function clearSkyFeature\(\)\{[^\n]+/)[0],close=app.match(/function closeBody\(\) \{[^\n]+/)[0];
 vm.runInContext(clear+'\n'+close+'\ncloseBody();',context);
 assert.equal(context.selectedSkyFeature,null);assert.deepEqual(cleared,[['selected',null],['hover',null]]);assert.ok(classes.has('sky-feature'));
});

test('closing a tracked constellation selection leaves the camera target but releases its blue-white focus',()=>{
 const sky=centeredSky();sky.setFeatureTracked('big-dipper');sky.setFeatureSelected('big-dipper');
 assert.equal(sky.featureRelationFocus(),'big-dipper');
 sky.setFeatureSelected(null);sky.setFeatureHover(null);
 assert.equal(sky.featureTracked,'big-dipper');assert.equal(sky.featureRelationFocus(),null);
});

const normalized=value=>Math.abs(Math.hypot(value.x,value.y,value.z)-1)<1e-12;
function centeredSky(){
  const sky=Object.create(Sky.prototype),center=sky.featureDirection('big-dipper'),forward=[-center.x,-center.y,-center.z],up=[0,0,1];
  let right=[up[1]*forward[2]-up[2]*forward[1],up[2]*forward[0]-up[0]*forward[2],up[0]*forward[1]-up[1]*forward[0]],length=Math.hypot(...right);right=right.map(value=>value/length);
  const down=[forward[1]*right[2]-forward[2]*right[1],forward[2]*right[0]-forward[0]*right[2],forward[0]*right[1]-forward[1]*right[0]];
  Object.assign(sky,{camera:{},axesNow:{right,down,forward},w:1200,h:800,tanFov:Math.tan(30.4*Math.PI/180),featureHover:null,featureSelected:null,featureTracked:null,invalidate(){this.invalidations=(this.invalidations||0)+1;}});
  return sky;
}

test('Big Dipper keeps seven fixed ICRS J2000 stars outside the random star pool',()=>{
  assert.equal(feature.id,'big-dipper');assert.deepEqual(Array.from(feature.stars,star=>star.name),['Dubhe','Merak','Phecda','Megrez','Alioth','Mizar','Alkaid']);
  assert.equal(feature.edges.length,7);assert.deepEqual(JSON.parse(JSON.stringify(feature.traceGroups)),[[[6,5]],[[5,4]],[[4,3]],[[3,2],[3,0]],[[2,1],[0,1]]]);assert.ok(feature.stars.every(star=>normalized(star.direction)));
  assert.ok(Math.abs(feature.stars[0].ra-(11+3/60+43.67152/3600))<1e-12);assert.ok(Math.abs(feature.stars[6].dec-(49+18/60+47.7602/3600))<1e-12);
  assert.equal(feature.style.sizeScale,1.08);assert.equal(feature.stars[0].color,'255,242,220');assert.equal(feature.stars[6].color,'227,239,255');
  const first=JSON.stringify(feature.stars.map(star=>star.direction));vm.runInNewContext(read('src/sky.js'),{window:{},performance});assert.equal(JSON.stringify(feature.stars.map(star=>star.direction)),first);
});

test('Polaris keeps its real fixed direction and Big Dipper style at 1.8 times the size',()=>{
  assert.equal(polaris.id,'polaris');assert.equal(polaris.stars.length,1);assert.equal(polaris.edges.length,0);assert.equal(polaris.traceGroups.length,0);
  const star=polaris.stars[0];assert.equal(star.name,'Polaris');assert.equal(star.color,'225,240,255');assert.ok(normalized(star.direction));assert.ok(Math.abs(star.ra-(2+31/60+49.09/3600))<1e-12);assert.ok(Math.abs(star.dec-(89+15/60+50.8/3600))<1e-12);
  assert.equal(polaris.style.sizeScale,feature.style.sizeScale*1.8);for(const key of Object.keys(feature.style))if(key!=='sizeScale')assert.equal(polaris.style[key],feature.style[key],key);
});

test('Polaris circle uses the guide fade, doubles the visible halo diameter, and stays hidden during opening',()=>{
 const sky=centeredSky(),arcs=[],halos=[],effects=window.SolarVisualEffects;
 let opacity=1;sky.featureHoverVisual=()=>({opacity,glow:.5,trace:1});
 sky.updateSkyFeatures=()=>[{feature:polaris,points:[{x:400,y:400}]}];
 const ctx=new Proxy({getTransform:()=>({a:1}),createRadialGradient:()=>({addColorStop(){}}),arc(x,y,r){arcs.push({r,alpha:this.globalAlpha});}},{get(target,key){return key in target?target[key]:()=>{};}});
 window.SolarVisualEffects={drawTinyStar(){}};
 const glow=(_ctx,_x,_y,r)=>halos.push(r);glow.extent=6;
 const draw=()=>{arcs.length=halos.length=0;sky.drawSkyFeatures(ctx,0,glow);};
 try{
  draw();assert.equal(arcs.length,1);assert.ok(Math.abs(arcs[0].r-halos.at(-1)*glow.extent*2)<1e-10);const fullAlpha=arcs[0].alpha;
  opacity=.4;draw();assert.equal(arcs.length,1);assert.ok(Math.abs(arcs[0].alpha-fullAlpha*.4)<1e-10);
  opacity=0;draw();assert.equal(arcs.length,0);
  sky.featureVisual=()=>({opacity:1,glow:.5,trace:1});sky.featureSparkle=()=>({pulse:0,alpha:1,angle:0});sky.featureSparkle=()=>({pulse:0,alpha:1,angle:0});draw();assert.equal(arcs.length,0,'shortcut reveal alone cannot show a pointer circle');
  sky.featurePinnedVisual=()=>({opacity:1,glow:.5,trace:1});draw();assert.equal(arcs.length,1,'the explicit display switch retains the circle without hover');
  opacity=1;sky.camera.hideFeatureLines=true;draw();assert.equal(arcs.length,0);assert.ok(halos.length>0,'the star remains visible while its guide is suppressed');
 }finally{window.SolarVisualEffects=effects;}
});

test('completed constellation guides batch unblurred alignment-style lines per feature',()=>{
 const sky=centeredSky(),features=[feature,Sky.FEATURES.cassiopeia],effects=window.SolarVisualEffects;let strokes=0,segments=0;
 sky.updateSkyFeatures=()=>features.map(feature=>({feature,points:feature.stars.map((_,i)=>({x:100+i*10,y:100+i*5}))}));
 sky.featureVisual=()=>({opacity:1,glow:.5,trace:1});sky.featureSparkle=()=>({pulse:0,alpha:1,angle:0});
 const ctx=new Proxy({getTransform:()=>({a:1}),createRadialGradient:()=>({addColorStop(){}}),stroke(){strokes++;},lineTo(){segments++;}},{get:(target,key)=>key in target?target[key]:()=>{}});
 window.SolarVisualEffects={drawTinyStar(){}};
 try{sky.drawSkyFeatures(ctx,0,()=>{});assert.equal(segments,features.reduce((n,f)=>n+f.edges.length,0),'keep every guide segment');assert.equal(strokes,features.length,'one simple draw per constellation, not per segment');}finally{window.SolarVisualEffects=effects;}
});

test('every named constellation star stays on the outer 99-percent sky layer',()=>{
  for(const group of [feature,polaris])for(const star of group.stars)assert.equal(star.depth,99);
  const sky=centeredSky();Object.assign(sky,{manualX:.7,manualY:-.4,manualZ:.2});
  window.SolarVisualEffects={starDepthScale:(_seed,seconds)=>seconds?1.5:.5};
  sky.featureSeconds=0;const first=JSON.stringify(sky.updateSkyFeatures().map(entry=>entry.points));
  sky.featureSeconds=30;const second=JSON.stringify(sky.updateSkyFeatures().map(entry=>entry.points));
  assert.equal(second,first,'ordinary background depth motion must not move catalogued constellation stars');
  delete window.SolarVisualEffects;
});

test('the fixed asterism projects as one selectable sky feature',()=>{
  const sky=centeredSky(),entries=sky.updateSkyFeatures(),points=entries.find(entry=>entry.feature.id==='big-dipper').points;
  assert.equal(entries.length,22);assert.ok(points.every(point=>point&&point.x>=0&&point.x<=sky.w&&point.y>=0&&point.y<=sky.h));
  assert.equal(sky.featureHit(points[3].x,points[3].y),'big-dipper');
  const [a,b]=feature.edges[4].map(index=>points[index]);assert.equal(sky.featureHit((a.x+b.x)/2,(a.y+b.y)/2),'big-dipper');assert.equal(sky.featureHit(0,0),null);
  assert.equal(sky.setFeatureHover('big-dipper'),true);assert.equal(sky.setFeatureHover('big-dipper'),false);assert.equal(sky.setFeatureSelected('big-dipper'),true);assert.equal(sky.invalidations,2);
});

test('Polaris has twice the ordinary pointer hit radius',()=>{
  const sky=centeredSky(),point=sky.updateSkyFeatures().find(entry=>entry.feature.id==='polaris').points[0];
  assert.equal(sky.featureHit(point.x+15,point.y),'polaris');
  assert.notEqual(sky.featureHit(point.x+21,point.y),'polaris');
});

test('Polaris retains its hover circle when another guide overlaps its hit area',()=>{
 const sky=centeredSky();sky.updateSkyFeatures=()=>[
  {feature,points:feature.stars.map((_,i)=>({x:90+i*20,y:100}))},
  {feature:polaris,points:[{x:100,y:100}]}
 ];
 assert.equal(sky.featureHit(100,100),'polaris');assert.equal(sky.featureHit(115,100),'polaris');
});

test('a pinned constellation line survives card selection changes',()=>{
  const sky=centeredSky();sky.featurePinned=new Set();sky.featurePinnedTransitions=new Map();assert.equal(sky.setFeaturePinned('big-dipper',true),true);assert.equal(sky.isFeaturePinned('big-dipper'),true);
  sky.setFeatureSelected('big-dipper');sky.setFeatureSelected(null);assert.equal(sky.isFeaturePinned('big-dipper'),true);
  assert.equal(sky.setFeaturePinned('big-dipper',false),true);assert.equal(sky.isFeaturePinned('big-dipper'),false);
});

test('camera tracking and display fades are independent star-brightness states',()=>{
 const sky=centeredSky();assert.equal(sky.setFeatureTracked('big-dipper'),true);assert.equal(sky.featureTracked,'big-dipper');assert.equal(sky.setFeatureTracked('unknown'),true);assert.equal(sky.featureTracked,null);
 const source=read('src/sky.js');assert.match(source,/displayBrightness=1\+\.1\*pinned\.opacity/);assert.match(source,/trackingBrightness=\(this\.featureTracked===entry\.feature\.id\?1\.1:1\)\*displayBrightness/);assert.match(source,/const activeGlow=[^;]+,activeScale=/);assert.match(source,/glow\(ctx,point\.x,point\.y,size\*activeScale/);
 const renderer=read('src/renderer.js');assert.match(renderer,/setSkyFeatureTrack\(track\)/);assert.match(renderer,/this\.setSkyFeatureTrack\(\{id,returnState,returnBank,rotation,mode,\.\.\.trackState\}\)/);assert.match(renderer,/this\.setSkyFeatureTrack\(null\)/);
});

test('the display switch fades with the hover treatment instead of cutting the line',()=>{
  const sky=centeredSky();sky.featurePinned=new Set();sky.featurePinnedTransitions=new Map();sky.setFeaturePinned('big-dipper',true);
  const start=sky.featurePinnedTransitions.get('big-dipper').start;
  assert.equal(sky.featurePinnedVisual('big-dipper',start).opacity,0);assert.equal(sky.featurePinnedVisual('big-dipper',start).trace,0);assert.ok(sky.featurePinnedVisual('big-dipper',start+250).opacity>0);assert.ok(Math.abs(sky.featurePinnedVisual('big-dipper',start+300).trace)<1e-12);assert.ok(Math.abs(sky.featurePinnedVisual('big-dipper',start+600).trace-.2)<1e-12);assert.equal(sky.featurePinnedVisual('big-dipper',start+500).opacity,1);assert.ok(Math.abs(sky.featurePinnedVisual('big-dipper',start+1800).trace-1)<1e-12);
  sky.setFeaturePinned('big-dipper',false);const end=sky.featurePinnedTransitions.get('big-dipper').start;
  assert.ok(sky.featurePinnedVisual('big-dipper',end+300).opacity>0);assert.equal(sky.featurePinnedVisual('big-dipper',end+600).opacity,0);
});

test('opening starts saved guides immediately and arrival does not restart them',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper']);sky.featurePinnedTransitions=new Map();sky.featureTransientTransitions=new Map();sky.camera={};
 sky.setFeatureCamera({openingGuides:true},1000);assert.equal(sky.featureLineVisual('big-dipper',1000).opacity,0);
 assert.ok(sky.featureLineVisual('big-dipper',1100).trace>0);assert.equal(sky.featureLineVisual('big-dipper',2500).trace,1);
 sky.setFeatureCamera({openingGuides:true},2000);sky.setFeatureCamera({},3000);
 assert.equal(sky.featurePinnedTransitions.get('big-dipper').start,1000);assert.equal(sky.isFeaturePinned('big-dipper'),true);
});

test('the shortcut reveal fades in without hover, holds for five seconds and fades away',()=>{
  const sky=centeredSky();sky.featurePinned=new Set();sky.featurePinnedTransitions=new Map();sky.featureTransientTransitions=new Map();assert.equal(sky.revealFeature('big-dipper',undefined,1000),true);
  assert.equal(sky.featureTransientVisual('big-dipper',1000).opacity,0);assert.ok(Math.abs(sky.featureTransientVisual('big-dipper',1300).trace)<1e-12);assert.ok(Math.abs(sky.featureTransientVisual('big-dipper',1600).trace-.2)<1e-12);assert.equal(sky.featureTransientVisual('big-dipper',1500).opacity,1);assert.equal(sky.featureTransientVisual('big-dipper',2800).trace,1);assert.equal(sky.featureTransientVisual('big-dipper',5999).opacity,1);
  assert.ok(sky.featureTransientVisual('big-dipper',7000).opacity>0);assert.equal(sky.featureTransientVisual('big-dipper',8000).opacity,0);
});

test('hover waits half a second, then breathes gently and fades after the pointer leaves',()=>{
  const sky=centeredSky();sky.featureHover='big-dipper';sky.featureHoverTransition={id:'big-dipper',start:1000,leaving:false};
  let visual=sky.featureHoverVisual('big-dipper',1499);assert.equal(visual.opacity,0);assert.equal(visual.glow,0);
  visual=sky.featureHoverVisual('big-dipper',1500);assert.equal(visual.opacity,0);
  visual=sky.featureHoverVisual('big-dipper',2000);assert.equal(visual.opacity,1);
  const later=sky.featureHoverVisual('big-dipper',2750);assert.notEqual(later.glow,visual.glow);
  sky.featureHover=null;sky.featureHoverTransition={id:'big-dipper',start:2750,leaving:true,fromOpacity:1,fromGlow:later.glow};
  assert.equal(sky.featureHoverVisual('big-dipper',2750).opacity,1);assert.equal(sky.featureHoverVisual('big-dipper',3750).opacity,.5);assert.ok(sky.featureHoverVisual('big-dipper',4749).opacity>0);assert.equal(sky.featureHoverVisual('big-dipper',4750).opacity,0);
});

test('moving directly to another constellation preserves the previous two-second fade',()=>{
 const sky=centeredSky();sky.featureHover='big-dipper';sky.featureHoverTransition={id:'big-dipper',start:performance.now()-10000};
 sky.setFeatureHover('polaris');const start=sky.featureHoverExits.get('big-dipper').start;
 assert.equal(sky.featureHoverVisual('big-dipper',start).opacity,1);
 assert.ok(Math.abs(sky.featureHoverVisual('big-dipper',start+1000).opacity-.5)<1e-12);
 assert.equal(sky.featureHoverVisual('big-dipper',start+2000).opacity,0);
 assert.equal(sky.featureHoverExits.has('big-dipper'),false);
});

test('fixed quiet zones contain the stars independent of the camera',()=>{
 const sky=centeredSky(),zones=sky.featureQuietZones();assert.equal(zones.length,22);
 for(const [i,f] of [feature,polaris].entries())for(const star of f.stars){const z=zones[i];assert.ok(Math.hypot(star.direction.x-z.x,star.direction.y-z.y,star.direction.z-z.z)<=z.radius);}
 const first=JSON.stringify(zones);sky.camera={azimuth:2,elevation:1,zoom:12};sky.w=300;sky.h=1200;sky.skyFeatures=[];assert.equal(JSON.stringify(sky.featureQuietZones()),first);assert.equal(sky.featureQuietUniforms().length,zones.length*4);
});

test('the separate galaxy atlas remains fixed to the catalogue and panorama frame',()=>{
 const sky=centeredSky(),galaxy=Sky.ANDROMEDA_GALAXY,andromeda=sky.featureDirection('andromeda');
 assert.ok(andromeda.x*galaxy.direction.x+andromeda.y*galaxy.direction.y+andromeda.z*galaxy.direction.z>.98);
 assert.equal(Sky.GALAXIES.length,3);assert.deepEqual(Array.from(galaxy.cell),[0,0]);
 for(const offset of [0,.7,2.9,5.8]){
  sky.offset=offset;sky.panAxes=null;sky.updateAxes({azimuth:1.1,elevation:.2,bank:0});
  const anchor=sky.toPanorama(galaxy.direction),fixed=sky.project(anchor,sky.panAxes),catalogue=sky.project(galaxy.direction,sky.axesNow);
  assert.ok(Math.abs(fixed.x-catalogue.x)<1e-7);assert.ok(Math.abs(fixed.y-catalogue.y)<1e-7);
 }
 const source=read('src/sky.js');assert.match(source,/this\.offset=SKY_PANORAMA_OFFSET;this\.fixedGalaxy=/);assert.match(source,/drawGalaxies\(ctx\)/);assert.match(source,/uniform vec4 fixedGalaxy/);assert.match(source,/galaxyActive/);assert.match(source,/galaxy:this\.fixedGalaxy/);
});

test('the catalog direction can still be placed at an exact camera anchor',()=>{
  const sky=centeredSky();
  for(const x of [.25,.75]){
    const pose=sky.featureCameraPose('big-dipper',x,.24);assert.ok(pose);
    const axes=sky.axes(pose),point=sky.project(sky.featureDirection('big-dipper'),axes,sky.tanFov);
    assert.ok(Math.abs(point.x-sky.w*x)<1e-7);assert.ok(Math.abs(point.y-sky.h*.24)<1e-7);
  }
});

test('the card tracking pose still centres the Big Dipper independently of shortcut framing',()=>{
  const sky=centeredSky(),pose=sky.featureCameraPose('big-dipper',.5,.5),axes=sky.axes(pose),point=sky.project(sky.featureDirection('big-dipper'),axes,sky.tanFov);
  assert.ok(Math.abs(point.x-sky.w*.5)<1e-7);assert.ok(Math.abs(point.y-sky.h*.5)<1e-7);
  const renderer=read('src/renderer.js');assert.match(renderer,/SKY_FEATURE_TRACK=Object\.freeze\(\{zoom:1\.2\}/);assert.match(renderer,/requestSkyFeature\(id/);assert.match(renderer,/startSkyFeatureTracking\(id/);assert.match(renderer,/stopSkyFeatureTracking\(mono/);assert.match(renderer,/to\.panX=from\.panX;to\.panY=from\.panY/);
});

test('constellation navigation preserves left, right and random rotation intent',()=>{
 const renderer=read('src/renderer.js'),method=renderer.slice(renderer.indexOf('beginSkyFeatureTracking('),renderer.indexOf('startSkyFeatureTracking('));
 assert.doesNotMatch(method,/setAutoRotate\(0,mono\)/);
 assert.match(method,/rotation=currentTrack\?\.rotation\|\|\{direction:this\.rotationIntent/);
 assert.match(renderer,/A camera transition may pause the physical turn, but it never changes the[\s\S]*if\(direction\)this\.pendingAutoRotation=\{direction,generation\}/);
});

test('hover, click card and the hidden star shortcut share the renderer-owned feature',()=>{
  const app=read('src/app.js'),renderer=read('src/renderer.js'),css=read('styles.css');
  assert.match(renderer,/skyFeatureHit\(x,y\)/);assert.match(renderer,/startSkyFeatureShortcutView\(id/);assert.doesNotMatch(renderer,/shortcut-preview/);
  assert.match(app,/renderer\.setSkyFeatureHover\(skyFeature\)/);assert.match(app,/selectSkyFeature\(skyFeature\)/);assert.match(app,/toggleAllSkyFeatureDisplay\(\)/);

  assert.match(app,/selectedSkyFeature\?focusSkyFeature\(selectedSkyFeature\):focusBody\(renderer\.selected\)/);assert.equal(localized.ui.constellationMode,'별자리 모드');assert.match(app,/t\(tracked\?'solarSystemMode':'constellationMode'\)/);assert.doesNotMatch(app,/\$\('stat-label-one'\)\.textContent='표현'/);assert.doesNotMatch(app,/\$\('stat-label-two'\)\.textContent='별자리'/);assert.match(app,/renderer\.setSkyFeatureDisplay\(selectedSkyFeature,\$\('show-sky-feature'\)\.checked\)/);assert.match(app,/renderer\.setSkySolarDisplay\(\$\('show-sky-solar'\)\.checked\)/);
  assert.equal(card(feature.id).name,'북두칠성');assert.equal(card(polaris.id).name,'북극성');assert.equal(card('pegasus').name,'페가수스');assert.equal(card('andromeda').name,'안드로메다');assert.ok(Object.values(Sky.FEATURES).every(item=>!card(item.id).name.endsWith('자리')));assert.match(app,/window\.SolarSky\.FEATURES/);assert.match(css,/\.body-panel\.sky-feature \.body-stats/);
  assert.match(app,/SKY_FEATURE_ORDER/);assert.match(app,/skyFeatureNeighbor/);assert.match(app,/navigateSkyFeature/);assert.match(app,/requestSkyFeatureNavigation\(target\)/);assert.match(app,/renderer\.skyFeatureShortcutMode/);assert.match(app,/renderer\.skyFeatureShortcutId/);assert.equal(polaris.card.category,'STAR');
  const sky=read('src/sky.js');assert.match(sky,/\*style\.sizeScale/);assert.match(sky,/\*style\.lightScale/);assert.match(sky,/drawTinyStar\(ctx,point\.x,point\.y,size,alpha\*sparkle\.alpha\*trackingBrightness,star\.motionSeed,starRatio,`rgb\(\$\{tone\}\)`\)/);assert.doesNotMatch(sky,/fillRect\(Math\.round\(point\.x/);assert.match(sky,/if\(style\.ambientGlow>0\)glow/);assert.match(sky,/haze\*=texture2D\(quietMask,uv\)\.r/);assert.match(sky,/\*style\.activeRadiusScale/);assert.match(sky,/\*style\.activeGlowScale/);
});

test('display preferences survive a round trip and reject unknown entries',()=>{
 const first=centeredSky();first.setFeaturePinned('big-dipper',true);first.setFeaturePinned('polaris',true);
 const restored=centeredSky();restored.restoreFeatureDisplay(JSON.parse(JSON.stringify(first.featureDisplayPreferences())));
 assert.equal(restored.isFeaturePinned('big-dipper'),true);assert.equal(restored.isFeaturePinned('polaris'),true);
 restored.restoreFeatureDisplay(['polaris','unknown']);assert.equal(restored.isFeaturePinned('big-dipper'),false);assert.equal(restored.isFeaturePinned('polaris'),true);
 restored.restoreFeatureDisplay({polaris:true});assert.equal(restored.featureDisplayPreferences().length,0);
});

test('cached sky brightness mask matches analytic zones at the seam and poles',()=>{
 const sky=centeredSky(),mask=sky.featureQuietMask(),zones=sky.featureQuietZones();
 assert.equal(mask.pixels.length,131072);assert.equal(sky.featureQuietMask(),mask);
 const sample=(u,v)=>{
  const x=u*mask.width-.5,y=v*mask.height-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const at=(a,b)=>mask.pixels[Math.max(0,Math.min(mask.height-1,b))*mask.width+((a%mask.width)+mask.width)%mask.width]/255;
  return (at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy;
 };
 for(let i=0;i<2048;i++){
  const u=i<4?(i%2?1:0):(i*.61803398875)%1,v=i<4?(i<2?0:1):(i*.41421356237)%1;
  const longitude=(u-.5)*Math.PI*2,latitude=(.5-v)*Math.PI,ring=Math.cos(latitude),x=ring*Math.cos(longitude),y=ring*Math.sin(longitude),z=Math.sin(latitude);
  let expected=1;
  for(const zone of zones){const d=Math.hypot(x-zone.x,y-zone.y,z-zone.z)/zone.radius,t=Math.max(0,Math.min(1,(d-.35)/.9));expected*=.6+.4*t*t*(3-2*t);}
  assert.ok(Math.abs(sample(u,v)-expected)<.015,`brightness mismatch at ${u}, ${v}`);
 }
 sky.camera={azimuth:2,elevation:1};assert.equal(sky.featureQuietMask(),mask);
});

test('the star shortcut masks only the saved individual display choices',()=>{
 const sky=centeredSky();sky.featurePinned=new Set();sky.featurePinnedTransitions=new Map();sky.featureDisplayMaster=true;
 sky.setFeaturePinned('big-dipper',true);sky.setFeaturePinned('polaris',false);
 const saved=Array.from(sky.featureDisplayPreferences());assert.deepEqual(saved,['big-dipper']);
 assert.equal(sky.setFeatureDisplayMaster(false),true);assert.equal(sky.isFeaturePinned('big-dipper'),true);assert.equal(sky.isFeaturePinnedVisible('big-dipper'),false);assert.equal(sky.isFeaturePinnedVisible('polaris'),false);assert.deepEqual(Array.from(sky.featureDisplayPreferences()),saved);
 assert.equal(sky.setFeatureDisplayMaster(true),true);assert.equal(sky.isFeaturePinnedVisible('big-dipper'),true);assert.equal(sky.isFeaturePinnedVisible('polaris'),false);
 const renderer=read('src/renderer.js'),app=read('src/app.js'),css=read('styles.css');assert.match(renderer,/toggleAllSkyFeatureDisplay\(\)[\s\S]*setFeatureDisplayMaster/);assert.doesNotMatch(renderer,/toggleAllSkyFeatureDisplay\(\)[\s\S]{0,300}for\(const id of ids\)/);assert.match(app,/skyFeatureDisplayMaster:renderer\.skyFeatureDisplayMaster\(\)/);assert.equal(localized.ui.showConstellation,'이음선 표시');assert.match(css,/#sky-solar-display-control\{border-top:0(?:;|\})/);
});
test('named stars use independent periods and phases for both display states',()=>{
 const sky=centeredSky(),start=1000;sky.featurePinned=new Set(['big-dipper','polaris']);
 for(const group of [feature,polaris])for(const star of group.stars){
  const initial=sky.featureIdlePulse(group.id,star.motionSeed,start),later=sky.featureIdlePulse(group.id,star.motionSeed,start+10000);assert.notEqual(initial.size,later.size,'no shared ten-second reset');
  let peak=1,minimumAlpha=1;for(let elapsed=0;elapsed<=16000;elapsed+=25){const pulse=sky.featureIdlePulse(group.id,star.motionSeed,start+elapsed);peak=Math.max(peak,pulse.size);minimumAlpha=Math.min(minimumAlpha,pulse.alpha);}assert.ok(peak>1.299&&peak<=1.3);assert.ok(minimumAlpha<.801&&minimumAlpha>=.8);
 }
 const staggered=feature.stars.map(star=>sky.featureIdlePulse(feature.id,star.motionSeed,start+4000).size);assert.ok(new Set(staggered.map(value=>value.toFixed(6))).size>4);
 sky.featurePinned.delete('polaris');let minimumSize=1,minimumAlpha=1;for(let elapsed=0;elapsed<=16000;elapsed+=25){const pulse=sky.featureIdlePulse('polaris',polaris.stars[0].motionSeed,start+elapsed);minimumSize=Math.min(minimumSize,pulse.size);minimumAlpha=Math.min(minimumAlpha,pulse.alpha);}assert.ok(minimumSize<.701&&minimumSize>=.7);assert.ok(minimumAlpha<.801&&minimumAlpha>=.8);
 const source=read('src/sky.js');assert.match(source,/\*style\.sizeScale\*displayScale/);assert.match(source,/shapeScale=style\.sizeScale\/BIG_DIPPER\.style\.sizeScale\*displayScale/);assert.match(source,/trackingBrightness\*idle\.alpha/);
});
test('idle sparkle is continuous, bounded and staggered between stars',()=>{
 const sky=centeredSky(),seeds=[...feature.stars,...polaris.stars].map(star=>star.motionSeed);
 for(const seed of seeds){let low=1,high=0,previous=sky.featureSparkle(seed,0);
  for(let t=.01;t<20;t+=.01){const v=sky.featureSparkle(seed,t);assert.ok(v.alpha>=.78&&v.alpha<=1);assert.ok(Math.abs(v.alpha-previous.alpha)<.01);assert.ok(Math.abs(v.angle-previous.angle)<.01);low=Math.min(low,v.pulse);high=Math.max(high,v.pulse);previous=v;}
  assert.ok(low===0&&high>.99);
 }
 assert.ok(new Set(seeds.map(seed=>sky.featureSparkle(seed,2).alpha)).size>2);
});




test('fixed sky projections are reused until camera, viewport or observer changes',()=>{
 const sky=centeredSky(),first=sky.updateSkyFeatures();assert.equal(sky.updateSkyFeatures(),first);
 sky.featureTracked='polaris';assert.equal(sky.updateSkyFeatures(),first,'display ownership does not move stars');
 for(const change of [()=>sky.w++,()=>sky.tanFov+=.01,()=>sky.manualX=.5,()=>sky.axesNow.right[0]+=.01]){
  const before=sky.updateSkyFeatures();change();assert.notEqual(sky.updateSkyFeatures(),before);assert.equal(sky.updateSkyFeatures(),sky.skyFeatures);
 }
 sky.camera.hideStars=true;assert.equal(sky.updateSkyFeatures().length,0);sky.camera.hideStars=false;assert.ok(sky.updateSkyFeatures().length);
});

test('rotation projects shared stars once and still expires offscreen guide reveals',()=>{
 const sky=centeredSky(),project=sky.project;let calls=0;sky.project=function(...args){calls++;return project.apply(this,args);};
 const entries=sky.updateSkyFeatures(),unique=new Set(Object.values(Sky.FEATURES).flatMap(f=>f.stars));assert.equal(calls,unique.size);
 sky.featureTransientTransitions=new Map([['orion',{start:0,duration:5000}]]);
 sky.featureRenderOwners(entries.map(entry=>({...entry,visible:false})),8000);
 assert.equal(sky.featureTransientTransitions.size,0,'culling must not freeze a reveal lifetime');
});

test('constellation viewing reuses one five-percent solar composite and one hover target',()=>{
 const renderer=read('src/renderer.js'),app=read('src/app.js'),html=read('index.html');
 assert.match(renderer,/const SKY_SOLAR_SCALE=\.05/);assert.match(renderer,/scale:mix\(1,SKY_SOLAR_SCALE,amount\)/);assert.match(renderer,/skySolarDisplay\(\)\?1:1-amount/);assert.match(renderer,/updateSkySolarTarget\(appearance\)/);assert.match(renderer,/skySolarHit\(x,y\)/);assert.match(renderer,/drawSkySolarGuide\(c,target,mono\)/);
 assert.match(app,/renderer\.skySolarHit\(p\.x,p\.y\)/);assert.match(app,/skySolarDisplay:renderer\.skySolarDisplay\(\)/);assert.match(html,/id="sky-feature-display-control"[\s\S]*id="sky-solar-display-control"[\s\S]*id="show-sky-solar"/);assert.doesNotMatch(html,/id="show-sky-solar"[^>]*checked/);assert.match(app,/saved\.skySolarDisplay===true/);assert.match(app,/applyFactoryDefaults\(\)[\s\S]*renderer\.setSkySolarDisplay\(false\)/);assert.match(renderer,/this\.skySolarVisible=false/);
});

test('constellation guides do not allocate glow images or apply blur',()=>{
 const source=read('src/sky.js'),draw=source.slice(source.indexOf(' drawSkyFeatures('),source.indexOf(' drawStars('));
 assert.match(draw,/strokeStyle=entry\.lineColor/);assert.match(draw,/lineWidth=.65;ctx.shadowBlur=0/);assert.doesNotMatch(source,/guideSprites|guideSprite\(/);
});


test('pinned guides retain the completed path and stay at their configured maximum brightness',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper']);sky.featurePinnedTransitions=new Map([['big-dipper',{start:0}]]);
 sky.featureHover='big-dipper';sky.featureHoverTransition={id:'big-dipper',start:10000};
 for(const t of [10000,10500,10750,11000,15000])assert.equal(sky.featureLineVisual('big-dipper',t).trace,1);
 sky.featureHover=null;sky.featureHoverTransition={id:'big-dipper',start:16000,leaving:true,fromOpacity:1,fromTrace:1};
 const source=read('src/sky.js');assert.doesNotMatch(source,/featureGuideBrightness|guidePulse|markerPulse|FEATURE_GUIDE_PHASE/);
 assert.match(source,/lineOpacity=visual\.opacity\*entry\.lineIntensity/);
});

test('warp preserves displayed guides and their existing trace clock',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper']);sky.featurePinnedTransitions=new Map([['big-dipper',{start:0,leaving:false}]]);
 sky.setFeatureCamera({hideFeatureLines:false,replaySky:{reveal:0}},5000);
 assert.ok(sky.updateSkyFeatures().length);assert.equal(sky.featureLineVisual('big-dipper',5000).opacity,1);assert.equal(sky.featureLineVisual('big-dipper',5000).trace,1);
 sky.setFeatureCamera({hideFeatureLines:false,replaySky:{reveal:1}},6000);assert.equal(sky.featurePinnedTransitions.get('big-dipper').start,0);
 sky.setFeatureCamera({hideFeatureLines:false},7000);assert.equal(sky.featureLineVisual('big-dipper',7000).trace,1);
 const app=read('src/app.js');assert.ok(app.includes("setOpeningPresentation(true,'warp',openingCameraTarget)"));
});

 test('pin changes blend size without resetting the animation phase',()=>{
 const sky=centeredSky(),id='big-dipper',seed=feature.stars[0].motionSeed;
 sky.featurePinned=new Set([id]);sky.featurePinnedTransitions=new Map([[id,{start:1000,fromOpacity:.4,fromTrace:.6}]]);
 const initial=sky.featurePinnedVisual(id,1000),later=sky.featurePinnedVisual(id,1100);
 assert.equal(initial.opacity,.4);assert.equal(initial.trace,.6);assert.ok(later.opacity>.4&&later.opacity<1);
 const hidden=sky.featureIdlePulse(id,seed,5000,0),shown=sky.featureIdlePulse(id,seed,5000,1),middle=sky.featureIdlePulse(id,seed,5000,.4);
 assert.ok(Math.abs(middle.size-(hidden.size*.6+shown.size*.4))<1e-12);assert.equal(hidden.alpha,shown.alpha);
 assert.deepEqual(sky.featureIdlePulse(id,seed,5000,.4),middle);
 });
 test('shared star and line records are reused with current ownership',()=>{
 const sky=centeredSky();sky.featurePinned=new Set(['big-dipper','ursa-major']);
 const entries=sky.updateSkyFeatures(),first=sky.featureRenderOwners(entries,10000),star=feature.stars[0],record=first.stars.get(star),lineRecords=new Map(first.lines);
 sky.featureTracked='ursa-major';const next=sky.featureRenderOwners(entries,10001);
 assert.equal(next.stars,first.stars);assert.equal(next.stars.get(star),record);assert.equal(record.entry.feature.id,'ursa-major');
 for(const [key,value] of next.lines)if(lineRecords.has(key))assert.equal(value,lineRecords.get(key));
 });
