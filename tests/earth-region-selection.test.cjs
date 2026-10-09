'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const A=require('../src/astro.js'),root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const window={SolarAstro:A};vm.runInNewContext(read('src/renderer.js'),{window,performance});vm.runInNewContext(read('assets/data/country-borders.js'),{window});
const Renderer=window.SolarRenderer,earth=A.BODIES.find(body=>body.id==='earth'),ms=Date.parse('2026-10-09T00:00:00Z');
const korea={id:'kor',code:'KR',label:'KR',region:'Korea',timeZone:'Asia/Seoul',latitude:37.5665,longitude:126.978};

function rendererFacing(site=korea){
  const r=Object.create(Renderer.prototype),normal=A.surfaceDirection(earth,site.latitude,site.longitude,ms);
  Object.assign(r,{w:1000,h:600,camera:{azimuth:Math.atan2(-normal.x,-normal.y),elevation:Math.asin(normal.z),zoom:1,dolly:1,focus:'earth',panX:0,panY:0},flightBank:0,flightLook:null,basis:null,frameSerial:1,frameItems:new Map([['earth',{body:earth,screen:{x:500,y:300,behind:false},r:200,frameSerial:1}]])});
  r.setCountryBorders(window.SolarCountryBorders);
  return r;
}
function screenPoint(r,latitude,longitude){
  const normal=r.viewDirection(A.surfaceDirection(earth,latitude,longitude,ms));
  return {x:500+normal.x*200,y:300+normal.y*200};
}

test('Earth picking requires a settled tracked close-up and an actual country polygon',()=>{
  const r=rendererFacing();
  assert.equal(r.earthRegionHit(500,300,[korea],ms),korea);
  assert.equal(r.earthRegionHit(700,300,[korea],ms),null);
  r.camera.focus=null;assert.equal(r.earthRegionHit(500,300,[korea],ms),null);
  r.camera.focus='earth';r.frameItems.get('earth').r=146;assert.equal(r.earthRegionHit(500,300,[korea],ms),null);
  r.frameItems.get('earth').r=200;r.cameraTween={};assert.equal(r.earthRegionHit(500,300,[korea],ms),null);
});

test('the full Korean outline includes both Koreas and Jeju but omits remote minor islands',()=>{
  const r=rendererFacing(),dokdo=screenPoint(r,37.2411,131.8653),ulleungdo=screenPoint(r,37.4845,130.9057),nearSeoul=screenPoint(r,37.7,127.2),pyongyang=screenPoint(r,39.0392,125.7625),jeju=screenPoint(r,33.4,126.5);
  assert.equal(r.earthRegionHit(nearSeoul.x,nearSeoul.y,[korea],ms),korea);
  assert.equal(r.earthRegionHit(pyongyang.x,pyongyang.y,[korea],ms),korea);
  assert.equal(r.earthRegionHit(jeju.x,jeju.y,[korea],ms),korea);
  assert.equal(r.earthRegionHit(ulleungdo.x,ulleungdo.y,[korea],ms),null);
  assert.equal(r.earthRegionHit(dokdo.x,dokdo.y,[korea],ms),null);
});

test('a small sovereign island remains selectable anywhere inside its outline',()=>{
  const initial={id:'mt',code:'MT',latitude:35.9,longitude:14.5167},probe=rendererFacing(initial),center=probe.countryRegionCenter(initial),malta={...initial,...center},r=rendererFacing(malta);
  assert.equal(r.earthRegionHit(500,300,[malta],ms),malta);
});

test('large countries use their main-land polygon center instead of a distant capital',()=>{
  const r=rendererFacing(),finland=r.countryRegionCenter({code:'FI'}),russia=r.countryRegionCenter({code:'RU'}),china=r.countryRegionCenter({code:'CN'}),taiwan=r.countryRegionCenter({code:'TW'});
  assert.ok(finland.latitude>63&&finland.longitude>24);assert.ok(russia.longitude>80&&russia.longitude<120);assert.ok(china.longitude>100&&china.longitude<108);assert.ok(taiwan.longitude>120&&taiwan.longitude<122);
});

test('date-line countries never wrap across North America and polygon holes remain water',()=>{
  const r=rendererFacing();
  for(const [longitude,latitude] of [[37.6,55.8],[90,60],[130,55],[160,55]])assert.equal(r.countryContains('RU',longitude,latitude),true);
  for(const [longitude,latitude] of [[-106,56],[-84,58],[-140,60],[-120,60],[-150,65],[-100,70]])assert.equal(r.countryContains('RU',longitude,latitude),false);
  assert.equal(r.countryContains('CA',-106,56),true);
  assert.equal(r.countryContains('CA',-84,58),false,'Hudson Bay is not selectable Canadian land');
});

test('archipelago selection follows Indonesian land instead of the water between islands',()=>{
  const r=rendererFacing();
  for(const [longitude,latitude] of [[106.8,-6.2],[110,-7.5],[101,-1],[120,-2]])assert.equal(r.countryContains('ID',longitude,latitude),true);
  for(const [longitude,latitude] of [[115,-8],[118,-5]])assert.equal(r.countryContains('ID',longitude,latitude),false);
});

test('Taiwan retains its administered Kinmen outline without postal-code geometry collisions',()=>{
  const borders=window.SolarCountryBorders,tool=read('tools/build-country-borders.cjs');
  assert.equal(borders.TW.length,2);assert.ok(borders.TW.some(ring=>ring.some(([longitude])=>longitude<119)),'Kinmen remains visible');
  assert.equal(borders.SG.length,1,'Singapore does not inherit the Siachen postal abbreviation');assert.doesNotMatch(tool,/p\.POSTAL/);
});

test('hover outlines project the selected country border on the visible Earth disk',()=>{
  const r=rendererFacing(),earthItem=r.frameItems.get('earth');r.setCountryBorders(window.SolarCountryBorders);const lines=r.earthRegionOutline({...korea,code:'KR'},earthItem,ms);
  assert.ok(lines.length);for(const line of lines)for(const point of line)assert.ok(Math.hypot(point.x-earthItem.screen.x,point.y-earthItem.screen.y)<=earthItem.r+1e-6);
  const koreaCoordinates=window.SolarCountryBorders.KR.flat();assert.ok(Math.min(...koreaCoordinates.map(point=>point[1]))<35);assert.ok(Math.max(...koreaCoordinates.map(point=>point[1]))>42,'the shared Korea outline contains both south and north');
  let invalidations=0;r.invalidatePresentation=()=>invalidations++;
  assert.equal(r.setEarthRegionHover(korea),true);assert.equal(r.setEarthRegionHover(korea),false);assert.equal(r.setEarthRegionHover(null),true);assert.equal(invalidations,2);
});

test('temporary Earth region changes are isolated from the persistent language region',()=>{
  const app=read('src/app.js');
  assert.match(app,/const displayRegion=\(\)=>REGIONS\[temporaryRegionId\]\|\|activeRegion\(\)/);
  assert.match(app,/new Intl\.DisplayNames\(\[locale\],\{type:'region'\}\)/);
  assert.match(app,/if\(copyLanguage\(\)==='kor'&&code==='KR'\)return '한국'/);
  assert.match(app,/const centeredRegion=.*renderer\.countryRegionCenter/);
  assert.match(app,/if\(userInitiated\)clearTemporaryRegion\(\)/);
  assert.match(app,/temporaryRegionId&&trackedBodyId\(\)!=='earth'/);
  assert.match(app,/renderer\.earthRegionHit\(point\.x,point\.y,REGION_CATALOG/);
  assert.match(app,/renderer\.earthRegionInteractionReady\(\)/);
  assert.match(app,/renderer\.setEarthRegionHover\(region\)/);
  assert.match(app,/UI\.loadScript\(COUNTRY_BORDERS_SOURCE,'SolarCountryBorders'\)/);
  assert.match(app,/temporaryRegion:temporaryRegionId/);
  assert.equal(JSON.parse(read('i18n/locales/kor.json')).ui.koreaView,'{region} 보기');
  assert.match(app,/dayLabel:t\('day'\),nightLabel:t\('night'\)/);
  const picking=app.slice(app.indexOf('      function earthRegionAt'),app.indexOf("      window.addEventListener('keydown'"));
  assert.doesNotMatch(picking,/setLanguage\(/);
});

test('wheel travel preserves temporary country inspection until an explicit reset',()=>{
  const app=read('src/app.js');
  const wheel=app.slice(app.indexOf("canvas.addEventListener('wheel'"),app.indexOf("canvas.addEventListener('dblclick'"));
  assert.doesNotMatch(wheel,/clearTemporaryRegion/);
  assert.match(app,/temporaryRegionId=id===activeRegion\(\)\.id\?null:id/);
  assert.match(app,/\$\('timezone-reset'\)\.addEventListener\('click',[\s\S]*clearTemporaryRegion\(\);viewEarthRegion\(region\)/);
  assert.match(read('index.html'),/id="timezone-reset" class="range-reset timezone-reset"[^>]+disabled/);
});

test('clock and country card names follow the selected interface language',()=>{
  const app=read('src/app.js');
  assert.match(app,/new Intl\.DisplayNames\(\[locale\],\{type:'region'\}\)/);
  assert.match(app,/if\(copyLanguage\(\)==='kor'&&code==='KR'\)return '한국'/);
  assert.match(app,/const zoneLabel=\(\)=>timezone==='utc'&&!temporaryRegionId\?'UTC':localizedRegionName\(displayRegion\(\)\)/);
  assert.match(app,/label:localizedRegionName\(region\)/);
});

test('country readout follows the same travel return policy as planet tracking',()=>{
  const app=read('src/app.js'),renderer=read('src/renderer.js');
  assert.match(app,/renderer\.requestFeature\('earth',target\.latitude,target\.longitude/);
  assert.match(app,/function trackActiveRegion\(\)\{if\(openingActive\)return/);
  assert.match(app,/feature\.disabled=previous\.disabled=next\.disabled=false/);
  assert.match(app,/const id=renderer\.selected;if\(!\['earth','jupiter'\]\.includes\(id\)\)return/);
  assert.match(app,/function navigateRegion\(direction\)\{\s*if\(renderer\.selected!=='earth'\)return/);
  assert.match(renderer,/requestFeature\(id,latitude,longitude,ms/);
  assert.match(renderer,/pendingTravelFocus=\{id,duration,feature:/);
  assert.match(renderer,/resumeTravelFocus\(mono,ms\)/);
});

test('country card uses alarm-style triangle controls and a nearest-neighbour loop',()=>{
  const app=read('src/app.js'),html=read('index.html'),css=read('src/runtime-optimizations.css'),{metadata}=require('./helpers/region-metadata.cjs'),data=metadata();
  assert.match(html,/id="region-navigation"[\s\S]*id="region-previous" class="timer-sound-preview[\s\S]*id="feature-view"[\s\S]*id="region-next" class="timer-sound-preview/);
  assert.match(css,/\.region-navigation\{display:grid/);assert.match(css,/\.region-previous>span\{transform:rotate\(180deg\)\}/);
  const start=app.indexOf('      const regionDistance='),end=app.indexOf('      function syncRegionNavigation',start),context={A,REGION_CATALOG:data.catalog,REGIONS:data.regions,temporaryRegionId:'en',language:'kor'};
  vm.createContext(context);vm.runInContext(app.slice(start,end)+';this.route=countryRoute();this.previous=regionNeighbor(-1);this.next=regionNeighbor(1);',context);
  assert.equal(context.route.length,data.catalog.length);assert.equal(new Set(context.route.map(region=>region.id)).size,data.catalog.length);assert.equal(context.route[0].id,'ca');
  assert.equal(context.previous.code,'CA');assert.equal(context.next.code,'MX');
  assert.match(app,/function viewEarthRegion\(region=displayRegion\(\)\)/);assert.match(app,/viewEarthRegion\(target\)/);assert.match(app,/setTemporaryRegion\(target\.id\)/);
});

test('country borders stay lazy, release-packaged and content-versioned',()=>{
  const crypto=require('node:crypto'),app=read('src/app.js'),asset=read('assets/data/country-borders.js'),revision=crypto.createHash('sha256').update(asset).digest('hex').slice(0,12),files=require('../tools/release-files.cjs').releaseFiles(root);
  assert.ok(app.includes(`country-borders.js?v=${revision}`));assert.ok(files.includes('assets/data/country-borders.js'));assert.doesNotMatch(read('index.html'),/<script[^>]+country-borders/);
});
