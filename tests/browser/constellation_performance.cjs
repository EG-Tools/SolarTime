'use strict';
module.exports=async({evaluate,until,send,session})=>{
 if(process.argv.includes('--profile-4k'))await send('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},session);
 if(process.argv.includes('--rotation-compare')){
  const fs=require('node:fs'),file=process.argv[process.argv.indexOf('--rotation-compare')+1];
  await evaluate(fs.readFileSync(file,'utf8').replace('root.SolarSky=Sky;','root.SolarSkyBaseline=Sky;'));
  const result=await evaluate(`(()=>{
   const r=SolarTime.renderer,live=r.sky,savedNow=performance.now,report=[],images=[];
   Object.defineProperty(performance,'now',{configurable:true,value:()=>50000});
   try{for(const Type of [SolarSkyBaseline,SolarSky]){
    const sky=Object.assign(Object.create(Type.prototype),live,{featureProjectionKey:null,skyFeatures:[],featurePinned:new Set(Object.keys(Type.FEATURES)),featurePinnedTransitions:new Map(),featureTransientTransitions:new Map(),featureHover:null,featureHoverTransition:null,featureTracked:null,featurePulseStarts:new Map(),starRemap:null,featureAxesSource:null});
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;const c=canvas.getContext('2d',{willReadFrequently:true});sky.w=1280;sky.h=800;
    const costs=[],pixels=[];
    for(let i=0;i<180;i++){
     sky.updateAxes({azimuth:(i%60)*Math.PI/30,elevation:.3});sky.updateStarAxes(null);sky.updateFeatureAxes();sky.featureProjectionKey=null;
     c.clearRect(0,0,1280,800);const start=savedNow.call(performance);sky.drawSkyFeatures(c,20,r.boundStarGlow);const cost=savedNow.call(performance)-start;if(i>=60)costs.push(cost);
     if(i>=177)pixels.push(c.getImageData(0,0,1280,800).data);
    }
    costs.sort((a,b)=>a-b);report.push({median:costs[60],p95:costs[114],mean:costs.reduce((a,b)=>a+b,0)/costs.length});images.push(pixels);
   }}finally{Object.defineProperty(performance,'now',{configurable:true,value:savedNow});}
   let difference=0;for(let frame=0;frame<3;frame++)for(let i=0;i<images[0][frame].length;i++)difference=Math.max(difference,Math.abs(images[0][frame][i]-images[1][frame][i]));
   return {baseline:report[0],optimized:report[1],maxPixelDifference:difference};
  })()`);
  require('node:assert/strict').equal(result.maxPixelDifference,0,'rotation optimization preserves the rendered stars and guides');
  return result;
 }
 if(process.argv.includes('--rotation-profile')){
  return await evaluate(`(async()=>{
   const r=SolarTime.renderer,sky=r.sky,draw=r.draw,features=sky.drawSkyFeatures,rows=[],results=[];
   for(const enabled of [true,false,true]){
    for(const id of Object.keys(SolarSky.FEATURES))r.setSkyFeatureDisplay(id,true);
    rows.length=0;let featureCost=0;
    sky.drawSkyFeatures=function(...args){const at=performance.now();if(enabled)features.apply(this,args);featureCost=performance.now()-at;};
    r.draw=function(...args){this.rotateViewBy(.004,0,performance.now());const at=performance.now();const result=draw.apply(this,args);rows.push({at,cost:performance.now()-at,featureCost});return result;};
    try{await new Promise(resolve=>{const deadline=performance.now()+15000;const poll=()=>rows.length>=160||performance.now()>deadline?resolve():requestAnimationFrame(poll);poll();});}
    finally{r.draw=draw;sky.drawSkyFeatures=features;}
    if(rows.length<160)throw Error('Rotation profile timed out before collecting enough frames');
    const sample=rows.slice(30),metric=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};};
    results.push({enabled,frame:metric(sample.slice(1).map((v,i)=>v.at-sample[i].at)),cpu:metric(sample.map(v=>v.cost)),features:metric(sample.map(v=>v.featureCost))});
   }
   return results;
  })()`);
 }
 await evaluate('SolarTime.renderer.startSkyFeatureShortcutView("polaris",performance.now(),100)');
 await until('!SolarTime.renderer.cameraTween');
 const results=[];
 for(const enabled of [false,true]){
  await evaluate(`(()=>{const r=SolarTime.renderer;for(const id of Object.keys(SolarSky.FEATURES))r.setSkyFeatureDisplay(id,${enabled});const sky=r.sky,draw=sky.drawSkyFeatures,stroke=r.ctx.stroke;window.__featureCosts=[];let strokes=0;r.ctx.stroke=function(...args){strokes++;return stroke.apply(this,args);};sky.drawSkyFeatures=function(...args){strokes=0;const at=performance.now(),value=draw.apply(this,args);window.__featureCosts.push({cost:performance.now()-at,strokes,at});return value;};window.__restoreFeatureCost=()=>{sky.drawSkyFeatures=draw;r.ctx.stroke=stroke;};})()`);
  try{await until('window.__featureCosts.length>=150');const rows=await evaluate('window.__featureCosts.slice(30)');const costs=rows.map(r=>r.cost).sort((a,b)=>a-b),gaps=rows.slice(1).map((r,i)=>r.at-rows[i].at).sort((a,b)=>a-b);results.push({enabled,frames:rows.length,median:costs[Math.floor(costs.length/2)],p95:costs[Math.floor(costs.length*.95)],max:costs.at(-1),frameMedian:gaps[Math.floor(gaps.length/2)],frameP95:gaps[Math.floor(gaps.length*.95)],strokes:Math.max(...rows.map(r=>r.strokes))});}
  finally{await evaluate('window.__restoreFeatureCost()');}
 }
 return results;
};
