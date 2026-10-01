'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

module.exports=async({root,evaluate,send,session})=>{
  const probeSource=`(()=>{
    window.__openingCameraQa={started:null,unlocked:null,ended:null,input:null,claim:null,armed:false,ticks:0,error:null};
    const arm=()=>{
      window.__openingCameraQa.armed=true;
      const sample=()=>{
        const qa=window.__openingCameraQa;qa.ticks++;
        try{
          const loading=document.getElementById('loading');
          if(loading&&qa.started===null&&window.SolarTime?.renderer?.cameraTween?.timing==='opening'){
            qa.started=performance.now();
            const r=SolarTime.renderer,before=r.cameraTween&&({...r.cameraTween.to}),opening=SolarTime.getState().opening,canvas=document.getElementById('universe');
            canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-900,bubbles:true,cancelable:true}));
            window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
            const after=r.cameraTween&&({...r.cameraTween.to});
            window.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',bubbles:true,cancelable:true}));
            qa.input={opening,before,after,labelOpacity:r.openingLabelOpacity(performance.now()),orbitOpacity:r.openingOrbitOpacity(performance.now()),arc:r.cameraTween.openingPath?.arc&&{...r.cameraTween.openingPath.arc}};
          }
          if(loading&&loading.hidden&&qa.started!==null&&qa.unlocked===null&&window.SolarTime){
            qa.unlocked=performance.now();qa.unlockedState={...SolarTime.getState(),busy:document.body.getAttribute('aria-busy'),labelOpacity:SolarTime.renderer.openingLabelOpacity(performance.now()),orbitOpacity:SolarTime.renderer.openingOrbitOpacity(performance.now())};
            if(sessionStorage.getItem('__openingQaClaim')==='1'){
              const r=SolarTime.renderer,canvas=document.getElementById('universe'),before=r.cameraTween&&({...r.cameraTween.to});
              canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-900,bubbles:true,cancelable:true}));
              qa.claim={before,after:r.cameraTween&&({...r.cameraTween.to}),state:{...SolarTime.getState()}};
            }
          }
          if(qa.started!==null&&qa.ended===null&&window.SolarTime&&SolarTime.getState().opening===false){qa.ended=performance.now();clearInterval(timer);}
        }catch(error){qa.error=String(error?.stack||error);clearInterval(timer);}
      };
      const timer=setInterval(sample,10);
    };
    if(document.documentElement)arm();else addEventListener('DOMContentLoaded',arm,{once:true});
  })();`;
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/seed.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><title>Solar Time opening QA seed</title>');
      return;
    }
    let file;
    try{file=path.resolve(root,'.'+pathname);}catch(_){res.writeHead(400).end();return;}
    if(file===root)file=path.join(root,'index.html');
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');
    if(file===path.join(root,'index.html')){
      res.end(fs.readFileSync(file,'utf8').replace('<head>','<head><script>'+probeSource+'</script>'));
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/',delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
  async function waitFor(expression,message,timeout=35000){
    const end=Date.now()+timeout;
    while(!await evaluate(expression)){if(Date.now()>end)throw Error(message);await delay(50);}
  }
  async function loadApp(){
    await send('Page.navigate',{url},session);
    await waitFor('location.pathname==="/"&&!!window.SolarTime','Local opening app did not start');
  }
  async function openingSnapshot(){
    return evaluate(`(()=>{const r=SolarTime.renderer,c=r.cameraSnapshot(),l=document.getElementById('loading'),state=SolarTime.getState();return {opening:state.opening,openingLocked:state.openingLocked,camera:c,loadingHidden:l.hidden,loadingDone:l.classList.contains('done'),busy:document.body.getAttribute('aria-busy'),from:r.cameraTween&&{...r.cameraTween.from},to:r.cameraTween&&{...r.cameraTween.to},tweenStart:r.cameraTween?.start??null,tweenDuration:r.cameraTween?.duration??null,annotationStart:r.openingAnnotationStart};})()`);
  }
  async function waitForOpeningEnd(){
    await waitFor('document.getElementById("loading").hidden&&SolarTime.getState().opening===false','Opening animation did not finish',12000);
    return openingSnapshot();
  }
  const target={azimuth:2.2,elevation:.4,zoom:1.1853048513203654,dolly:5,focus:'earth',panX:.2,panY:-.1,mode:'move'};
  try{
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);
    await send('Page.navigate',{url:url+'seed.html'},session);
    await waitFor('location.pathname==="/seed.html"','Opening seed page did not load');
    // Existing camera+ preferences must migrate once without losing the view.
    await evaluate(`localStorage.setItem('eg.solar-time.v0.01',${JSON.stringify(JSON.stringify({camera:{...target,mode:'zoom'},dollyZoom:false,cameraControlVersion:2,rotationMode:0,autoRotateDirection:0}))})`);
    await loadApp();
    await waitFor('SolarTime.renderer.cameraTween?.timing==="opening"','Opening camera tween did not start');
    const first=await openingSnapshot();
    assert.equal(first.opening,true);assert.equal(first.openingLocked,true);assert.equal(first.loadingHidden,false);assert.equal(first.busy,'true');
    close(first.from.zoom,target.zoom);close(first.from.dolly,.001);assert.equal(first.from.focus,null);close(first.from.panX,0);close(first.from.panY,0);assert.equal(first.to.focus,'earth');
    assert.ok(first.tweenDuration>=5000&&first.tweenDuration<=7000);close(first.annotationStart-first.tweenStart,first.tweenDuration-1000);

    // F5 focuses the page and refreshes automatic language preferences while
    // the camera is still travelling. Never persist that temporary viewpoint.
    await evaluate(`window.dispatchEvent(new Event('focus'))`);
    const duringOpening=await evaluate(`JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).camera`);
    for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])close(duringOpening[key],target[key],2e-5);
    assert.equal(duringOpening.focus,target.focus);
    await delay(1050);
    const dust=await evaluate(`(()=>{const r=SolarTime.renderer,f=r.openingParticles;return {count:f?.points.length,alpha:f?.alpha,sprite:!!r.openingParticleSprite,glowMin:Math.min(...f.points.map(p=>p.glow)),glowMax:Math.max(...f.points.map(p=>p.glow)),delays:[...r.openingOrbitDelays.values()]};})()`);
    assert.ok(dust.count>=204&&dust.count<=510);assert.ok(dust.alpha>0);assert.equal(dust.sprite,true);
    assert.ok(dust.glowMin>=.8&&dust.glowMax<=2.6&&dust.glowMax-dust.glowMin>1.5);
    assert.ok(dust.delays.every(n=>n>=0&&n<1000));assert.ok(new Set(dust.delays).size>1);
    const preview=path.join(os.tmpdir(),'solartime-opening-particles.png');
    fs.writeFileSync(preview,Buffer.from((await send('Page.captureScreenshot',{format:'png'},session)).data,'base64'));

    const final=await waitForOpeningEnd(),qa=await evaluate('window.__openingCameraQa');
    const inputCheck=qa.input;
    assert.ok(inputCheck,'opening probe did not sample: '+JSON.stringify({qa,final,loading:await evaluate(`(()=>{const l=document.getElementById('loading');return {className:l.className,hidden:l.hidden}})()`)}));
    assert.equal(inputCheck.opening,true,'input lock must be sampled during the opening');
    assert.deepEqual(inputCheck.after,inputCheck.before,'opening input must not replace the arrival tween');
    assert.equal(inputCheck.before.focus,'earth','saved tracked body must remain the opening destination');
    assert.ok(inputCheck.labelOpacity<=1e-4,'labels must start hidden');assert.ok(inputCheck.orbitOpacity<=1e-4,'orbits must start hidden');
    const elapsed=qa.ended-qa.started;
    const unlockElapsed=qa.unlocked-qa.started;
    assert.ok(unlockElapsed>=first.tweenDuration-1200&&unlockElapsed<=first.tweenDuration-600,`opening unlock ${unlockElapsed}ms`);
    assert.equal(qa.unlockedState.opening,true);assert.equal(qa.unlockedState.openingLocked,false);assert.equal(qa.unlockedState.busy,null);
    assert.ok(qa.unlockedState.labelOpacity<.05);assert.ok(qa.unlockedState.orbitOpacity>.99,'one second lap finishes before names appear');
    assert.ok(elapsed>=first.tweenDuration-200&&elapsed<=first.tweenDuration+700,`opening duration ${elapsed}ms`);
    assert.equal(final.busy,null);assert.equal(final.loadingHidden,true);assert.equal(final.loadingDone,true);assert.equal(final.opening,false);
    for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])close(final.camera[key],target[key],2e-5);
    assert.equal(final.camera.focus,'earth');
    assert.equal(await evaluate(`document.getElementById('camera-mode-toggle').dataset.mode==='normal'&&SolarTime.renderer.options.dollyZoom===true`),true);
    const remainingDust=await evaluate('SolarTime.renderer.openingParticles?.points.length??0');
    assert.ok(remainingDust<=9,'offscreen flight particles must be removed at arrival');
    await waitFor('SolarTime.renderer.openingLabelOpacity(performance.now())>.999','Opening annotations did not finish fading',4000);

    await evaluate("sessionStorage.setItem('__openingQaClaim','1')");
    await send('Page.reload',{},session);await delay(150);
    await waitFor('location.pathname==="/"&&!!window.SolarTime','Reloaded opening app did not start');
    await waitFor('SolarTime.renderer.cameraTween?.timing==="opening"','Reloaded opening camera tween did not start');
    const second=await openingSnapshot();
    assert.equal(second.opening,true);close(second.from.zoom,target.zoom);close(second.from.dolly,.001);
    assert.ok(Math.abs(second.from.azimuth-first.from.azimuth)>1e-6||Math.abs(second.from.elevation-first.from.elevation)>1e-6,'departure orientation should be randomized on reload');
    await waitForOpeningEnd();const secondQa=await evaluate('window.__openingCameraQa');
    assert.ok(secondQa.claim,'control was not claimed during the final second');assert.equal(secondQa.claim.state.opening,false);
    assert.notEqual(secondQa.claim.after.dolly,secondQa.claim.before.dolly,'wheel input should replace the remaining opening tween');
    assert.equal(qa.input.arc,null);assert.equal(secondQa.input.arc,null,'tracked opening should approach directly');
    const tracking=await evaluate(`(()=>{
      const r=SolarTime.renderer,ms=Date.parse('2026-10-01T00:00:00Z'),mono=performance.now(),results=[];
      r.setAutoRotate(0,mono);
      for(const id of ['earth','moon']){
        r.restoreCamera(r.defaultCameraSnapshot());r.draw(ms,0,mono);
        const first=r.currentFrameItem(id),start={...first.screen},radius=first.r;
        const x=r.centerX-r.w*r.camera.panX,y=r.centerY-r.h*r.camera.panY;
        r.animateFocus(id,mono,1100);
        let maxPathError=0,maxReversal=0,previousDistance=Infinity,startRadiusError=0;
        for(let elapsed=0;elapsed<=1100;elapsed+=50){
          r.draw(ms,0,mono+elapsed);
          const body=r.currentFrameItem(id),p=r.cameraTween?.progress??1;
          const error=Math.hypot(body.screen.x-(start.x+(x-start.x)*p),body.screen.y-(start.y+(y-start.y)*p));
          const distance=Math.hypot(body.screen.x-x,body.screen.y-y);
          maxPathError=Math.max(maxPathError,error);maxReversal=Math.max(maxReversal,distance-previousDistance);previousDistance=distance;
          if(elapsed===0)startRadiusError=Math.abs(body.r-radius);
        }
        results.push({id,maxPathError,maxReversal,startRadiusError,arrivalError:previousDistance});
      }
      return results;
    })()`);
    for(const result of tracking){
      assert.ok(result.maxPathError<.01,JSON.stringify(result));assert.ok(result.maxReversal<.01,JSON.stringify(result));
      assert.ok(result.startRadiusError<.01,JSON.stringify(result));assert.ok(result.arrivalError<.01,JSON.stringify(result));
    }
    const trackingReturn=await evaluate(`(()=>{
      const r=SolarTime.renderer,ms=Date.parse('2026-10-01T00:00:00Z'),rows=[];
      r.setAutoRotate(0);
      for(const id of ['earth','moon'])for(const preset of [false,true]){
        let mono=performance.now();r.restoreCamera(r.defaultCameraSnapshot());r.draw(ms,0,mono);
        r.restoreCamera(r.trackingMoveState(id));r.draw(ms,0,mono);
        r.smoothDolly(r.camera.dolly*.85,id,mono);r.draw(ms,0,mono+150);r.setPan(-.05,.02);r.draw(ms,0,mono+160);
        const from=r.cameraSnapshot(),start={...r.currentFrameItem(id).screen};
        const to={...r.defaultCameraSnapshot(),...(preset?{zoom:1.7,dolly:.8,panX:.04}: {})};
        r.restoreCamera(to);r.draw(ms,0,mono+160);const end={...r.currentFrameItem(id).screen};
        r.restoreCamera(from);r.draw(ms,0,mono+160);
        if(preset)r.animateCamera(to,performance.now(),1100);
        else window.dispatchEvent(new KeyboardEvent('keydown',{key:'0',code:'Digit0',bubbles:true,cancelable:true}));
        mono=r.cameraTween.start;let maxError=0,maxReverse=0,previous=Infinity;
        for(let t=0;t<=1100;t+=25){
          r.draw(ms,0,mono+t);const q=r.currentFrameItem(id).screen,p=r.cameraTween?.progress??1;
          const distance=Math.hypot(q.x-end.x,q.y-end.y);
          maxError=Math.max(maxError,Math.hypot(q.x-(start.x+(end.x-start.x)*p),q.y-(start.y+(end.y-start.y)*p)));
          maxReverse=Math.max(maxReverse,distance-previous);previous=distance;
        }
        rows.push({id,preset,maxError,maxReverse,arrivalError:previous});
      }
      return rows;
    })()`);
    for(const row of trackingReturn){assert.ok(row.maxError<.01,JSON.stringify(row));assert.ok(row.maxReverse<.01,JSON.stringify(row));assert.ok(row.arrivalError<.01,JSON.stringify(row));}
    const moonTravel=await evaluate(`(()=>{
      const r=SolarTime.renderer,ms=Date.parse('2026-10-01T00:00:00Z'),mono=performance.now(),base=r.defaultCameraSnapshot(),rows=[];
      for(const focus of [null,'earth'])for(const dolly of [1,2,4]){
        r.restoreCamera({...base,focus,dolly});r.draw(ms,0,mono);
        const earth=r.currentFrameItem('earth'),moon=r.currentFrameItem('moon');
        rows.push({focus,dolly,earthRadius:earth.r,moonRadius:moon.r,moonPerspective:moon.screen.perspective,moonUnprojected:r.bodyRadiusAtZoom(moon.body)});
      }
      return rows;
    })()`);
    for(const row of moonTravel){close(row.moonRadius,row.moonUnprojected*row.moonPerspective);close(row.moonUnprojected,moonTravel[0].moonUnprojected*row.dolly);}
    const followedMoon=moonTravel.filter(row=>row.focus==='earth');
    assert.ok(followedMoon[1].moonRadius>followedMoon[0].moonRadius);assert.ok(followedMoon[2].moonRadius>followedMoon[1].moonRadius);
    const scaleControls=await evaluate(`(()=>{
      const r=SolarTime.renderer,button=document.getElementById('camera-mode-toggle'),input=document.getElementById('actual-scale'),rows=[];
      r.setAutoRotate(0);r.restoreCamera(r.defaultCameraSnapshot());const camera=r.cameraSnapshot();
      const snapshot=()=>({option:r.options.actualScale,checked:input.checked,pressed:button.getAttribute('aria-pressed'),icon:button.dataset.mode,saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).actualScale,cameraUnchanged:Object.entries(camera).every(([key,value])=>r.cameraSnapshot()[key]===value),wheel:r.options.dollyZoom,normalVisible:getComputedStyle(button.querySelector('.mode-icon-normal')).display!=='none',actualVisible:getComputedStyle(button.querySelector('.mode-icon-actual')).display!=='none'});
      button.click();rows.push(snapshot());button.click();rows.push(snapshot());
      input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));rows.push(snapshot());
      input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));rows.push(snapshot());
      return rows;
    })()`);
    for(const [i,row] of scaleControls.entries()){
      const on=i%2===0;assert.deepEqual(row,{option:on,checked:on,pressed:String(on),icon:on?'actual':'normal',saved:on,cameraUnchanged:true,wheel:true,normalVisible:!on,actualVisible:on});
    }
    const spacingControls=await evaluate(`(()=>{
      const r=SolarTime.renderer,gap=document.getElementById('overview-orbit-gap'),toggle=document.getElementById('camera-mode-toggle'),rows=[];
      const snapshot=()=>({mode:r.options.actualScale,min:gap.min,max:gap.max,value:gap.value,output:document.getElementById('overview-orbit-gap-output').textContent,disabled:gap.disabled,normal:r.options.overviewOrbitGap,actual:r.options.actualOrbitSpacing,label:document.querySelector('[data-i18n="orbitSpacing"]').textContent});
      const change=value=>{gap.value=value;gap.dispatchEvent(new Event('input',{bubbles:true}));gap.dispatchEvent(new Event('change',{bubbles:true}));};
      change(173);rows.push(snapshot());toggle.click();rows.push(snapshot());
      change(1);rows.push(snapshot());change(37);rows.push(snapshot());toggle.click();rows.push(snapshot());toggle.click();rows.push(snapshot());
      const saved=JSON.parse(localStorage.getItem('eg.solar-time.v0.01'));
      change(100);toggle.click();change(86);
      return {rows,saved:{actual:saved.actualOrbitSpacing,normal:saved.overviewOrbitGap}};
    })()`);
    for(const [i,row] of spacingControls.rows.entries()){
      const on=![0,4].includes(i),value=on?(i===1?100:i===2?1:37):173;
      assert.equal(row.mode,on);assert.equal(row.min,on?'0':'50');assert.equal(row.max,on?'100':'400');assert.equal(row.value,String(value));assert.equal(row.output,value+'%');assert.equal(row.disabled,false);assert.equal(row.normal,173);
      assert.equal(row.label,'궤도 간격');
    }
    assert.deepEqual(spacingControls.saved,{actual:.37,normal:173});
    assert.equal(await evaluate('document.getElementById("actual-scale-note")===null'),true);
    const actualScale=await evaluate(`(()=>{
      const r=SolarTime.renderer,A=SolarAstro,ms=Date.parse('2026-10-01T00:00:00Z'),mono=performance.now(),base=r.defaultCameraSnapshot(),rows=[];
      const before=JSON.stringify(r.getBodyScales());r.setOption('actualScale',true,false);
      for(const zoom of [base.zoom,4,250])for(const dolly of [1,12]){
        r.restoreCamera({...base,zoom,dolly});r.draw(ms,0,mono);
        const earth=r.currentFrameItem('earth'),moon=r.currentFrameItem('moon'),sun=r.currentFrameItem('sun');
        let maxDistanceError=0,maxRadiusError=0;
        for(const item of r.frameBodies){
          for(const axis of ['x','y','z'])maxDistanceError=Math.max(maxDistanceError,Math.abs(item.world[axis]-item.physical[axis]*A.TRUE_SCALE_UNITS_PER_AU));
          if(!item.screen.behind)maxRadiusError=Math.max(maxRadiusError,Math.abs(item.r/(r.scale*item.screen.perspective)-A.BODY_RADIUS_KM[item.body.id]/A.AU_KM*A.TRUE_SCALE_UNITS_PER_AU));
        }
        const earthR=r.bodyRadiusAtZoom(earth.body),earthMoonRadius=r.satelliteOrbitRadius(moon.body,earth.body);
        rows.push({zoom,dolly,maxDistanceError,maxRadiusError,moonDistanceInEarthDiameters:earthMoonRadius*r.scale/(2*earthR),lens:r.gpuOrbitCamera().lens});
      }
      const sunScales=[],oldSunScale=r.bodySizeScale('sun');
      r.restoreCamera({...base,zoom:1,dolly:1});
      for(const size of [1,2,3]){
        r.setBodyScale('sun',size);r.draw(ms,0,mono);
        const sun=r.currentFrameItem('sun'),earth=r.currentFrameItem('earth');
        sunScales.push({size,sunDiameter:2*sun.r,earthDiameter:2*earth.r,ratio:sun.r/earth.r,units:r.scale});
      }
      r.setBodyScale('sun',oldSunScale);r.restoreCamera(base);r.draw(ms,0,mono);
      document.querySelector('#planet-nav [data-body="sun"]').click();
      const slider=document.getElementById('body-size-slider'),sunUi={min:slider.min,max:slider.max,disabled:slider.disabled,orbitDisabled:document.getElementById('satellite-orbit-slider').disabled};
      document.querySelector('#planet-nav [data-body="earth"]').click();
      const earthLocked=slider.disabled;
      const target=r.trackingMoveState('earth');r.restoreCamera(target);r.draw(ms,0,mono);
      const earthFill=r.currentFrameItem('earth').r*2/r.h,openingDuration=r.openingCameraDuration(target),valid=SolarRenderer.validCamera(target);
      r.setOption('actualScale',false,false);r.restoreCamera(base);r.draw(ms,0,mono);
      return {rows,sunScales,sunUi,earthLocked,earthFill,openingDuration,valid,preferencesUnchanged:before===JSON.stringify(r.getBodyScales()),restoredLens:r.gpuOrbitCamera().lens};
    })()`);
    for(const row of actualScale.rows){assert.ok(row.maxDistanceError<1e-9,JSON.stringify(row));assert.ok(row.maxRadiusError<1e-9,JSON.stringify(row));close(row.moonDistanceInEarthDiameters,30.17,.02);assert.equal(row.lens,1);}
    close(actualScale.earthFill,.5);close(actualScale.openingDuration,7000);assert.ok(actualScale.valid&&actualScale.preferencesUnchanged);assert.equal(actualScale.restoredLens,1);
    assert.deepEqual(actualScale.sunUi,{min:'100',max:'300',disabled:false,orbitDisabled:true});assert.equal(actualScale.earthLocked,true);
    for(const row of actualScale.sunScales){close(row.ratio,109.197784,.001);close(row.sunDiameter,actualScale.sunScales[0].sunDiameter*row.size);close(row.earthDiameter,actualScale.sunScales[0].earthDiameter*row.size);close(row.units,actualScale.sunScales[0].units*row.size);}
    const scaleCameraPreserved=await evaluate(`(()=>{
      const r=SolarTime.renderer,button=document.getElementById('camera-mode-toggle'),ms=Date.parse('2026-10-01T00:00:00Z');
      const normal={...r.defaultCameraSnapshot(),azimuth:2.1,elevation:.51,zoom:1.4,dolly:1.7,panX:.06,panY:.1};
      r.setOption('actualScale',false,false);r.restoreCamera(normal);button.click();
      r.draw(ms,0,r.actualScaleTween.started+2000);
      r.restoreCamera({...normal,zoom:.1,dolly:.002,focus:null});const moved=r.cameraSnapshot();button.click();
      const saved=JSON.parse(localStorage.getItem('eg.solar-time.v0.01')),start=r.actualScaleTween.started;
      for(let step=0;step<=20;step++)r.draw(ms,0,start+step*100);
      return {moved,current:r.cameraSnapshot(),saved:saved.camera,tween:!!r.cameraTween,mix:r.actualScaleMix,glError:r.gpu.gl.getError()};
    })()`);
    assert.deepEqual(scaleCameraPreserved.current,scaleCameraPreserved.moved);assert.deepEqual(scaleCameraPreserved.saved,scaleCameraPreserved.moved);assert.equal(scaleCameraPreserved.tween,false);assert.equal(scaleCameraPreserved.mix,0);assert.equal(scaleCameraPreserved.glError,0);
    const scaleDepth=await evaluate(`(()=>{
      const r=SolarTime.renderer,ms=Date.parse('2026-10-01T00:00:00Z'),saved=r.cameraSnapshot(),spacing=r.options.actualOrbitSpacing,gap=r.options.overviewOrbitGap,rows=[];
      try{
        r.setOption('overviewOrbitGap',145);r.setOption('actualOrbitSpacing',.02);
        r.restoreCamera({...r.defaultCameraSnapshot(),azimuth:5.393597172693909,elevation:.620064911444322,zoom:1.1853048513203654,dolly:.6004955788122657});
        for(const enabled of [true,false,true,false]){
          r.setOption('actualScale',!enabled,false);r.draw(ms,0,performance.now());
          const uploads=r.gpu.stats.orbitUploads,builds=r.stats.orbitBufferBuilds;
          r.setOption('actualScale',enabled);const start=r.actualScaleTween.started;
          const centers=[];
          for(const dt of [0,16,32,64,500,1000,1500,1936,1968,1984,2000]){
            r.draw(ms,0,start+dt);
            const path=r.paths.find(p=>p.body.id==='neptune'),ys=path.points.map(p=>r.project(r.displaySolarPoint(p,path.body)).y);
            centers.push({dt,y:(Math.min(...ys)+Math.max(...ys))/2});
          }
          rows.push({enabled,centers,uploads:r.gpu.stats.orbitUploads-uploads,builds:r.stats.orbitBufferBuilds-builds,glError:r.gpu.gl.getError(),finite:r.frameBodies.every(b=>['x','y','z'].every(k=>Number.isFinite(b.world[k])))});
        }
        return rows;
      }finally{r.setOption('actualScale',false,false);r.setOption('overviewOrbitGap',gap);r.setOption('actualOrbitSpacing',spacing);r.restoreCamera(saved);}
    })()`);
    for(const row of scaleDepth){
      assert.equal(row.glError,0);assert.ok(row.finite);const c=row.centers;
      assert.equal(row.uploads,0,'mode transitions reuse resident orbit buffers');assert.equal(row.builds,0);
      assert.ok(Math.abs(c[1].y-c[0].y)<.1,JSON.stringify(row));
      assert.ok(Math.abs(c.at(-1).y-c.at(-2).y)<.1,JSON.stringify(row));
    }
    const nearClip=await evaluate(`(()=>{
      const canvas=document.createElement('canvas'),gpu=new SolarSurface.DirectRenderer(canvas);
      try{
        gpu.resize(128,128,1);gpu.begin();
        gpu.orbit('near-clip',new Float32Array([40,0,0,40,0,6000]),{x:0,y:0,z:0},{ca:1,sa:0,ce:0,se:1,lens:1,travel:1,anchor:{x:0,y:0,z:0}},1,64,64,[1,1,1],1);
        const gl=gpu.gl,pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let count=0,stray=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(pixels[(y*128+x)*4+3]>0){count++;if(Math.abs(y-63.5)>1.5)stray++;}
        return {count,stray,error:gl.getError()};
      }finally{gpu.dispose();}
    })()`);
    assert.ok(nearClip.count>15);assert.equal(nearClip.stray,0,'near-plane clipping must not pull lines toward a fixed corner');assert.equal(nearClip.error,0);
    // Old camera+ preferences and presets cannot resurrect the removed mode.
    await evaluate(`SolarTime.renderer.restoreCamera(${JSON.stringify(target)})`);
    await evaluate(`sessionStorage.removeItem('__openingQaClaim');localStorage.setItem('eg.solar-time.v0.01',${JSON.stringify(JSON.stringify({camera:{...target,mode:'zoom'},dollyZoom:false,cameraControlVersion:3,languageMode:'auto',rotationMode:0,overviewOrbitGap:173,actualOrbitSpacing:.37}))});localStorage.setItem('solar-time.camera-presets.v1',${JSON.stringify(JSON.stringify({schema:2,slots:[{...target,mode:'zoom'},null,null]}))})`);
    // Refresh at different points before arrival; focus and settings writes
    // must keep the same close-up destination through all four loads.
    const refreshChecks=[];
    for(const pause of [0,450,1250,2350]){
      await send('Page.reload',{},session);await delay(150);
      await waitFor('!!window.SolarTime&&SolarTime.renderer.cameraTween?.timing==="opening"','Repeated opening did not start');
      await delay(pause);
      await evaluate(`window.dispatchEvent(new Event('focus'))`);
      const saved=await evaluate(`JSON.parse(localStorage.getItem('eg.solar-time.v0.01'))`);
      assert.equal(saved.cameraControlVersion,4);assert.equal(saved.dollyZoom,true);assert.equal(saved.camera.mode,'move');
      assert.equal(saved.overviewOrbitGap,173);close(saved.actualOrbitSpacing,.37);
      assert.equal(await evaluate('SolarTime.renderer.options.overviewOrbitGap'),173);close(await evaluate('SolarTime.renderer.options.actualOrbitSpacing'),.37);
      for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])close(saved.camera[key],target[key],2e-5);
      assert.equal(saved.camera.focus,'earth');assert.equal(await evaluate('SolarTime.getPresets()[0].mode'),'move');
      refreshChecks.push({pause,dolly:saved.camera.dolly,focus:saved.camera.focus});
    }
    await waitForOpeningEnd();
    const afterRefresh=await evaluate('SolarTime.renderer.cameraSnapshot()');
    for(const key of ['azimuth','elevation','zoom','dolly','panX','panY'])close(afterRefresh[key],target[key],2e-5);
    // Verify fixed input mapping with real browser pointer events.
    const startInput=await evaluate('SolarTime.renderer.cameraSnapshot()');
    await evaluate(`document.getElementById('universe').dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,cancelable:true}))`);
    await delay(350);const afterWheel=await evaluate('SolarTime.renderer.cameraSnapshot()');
    assert.ok(afterWheel.dolly>startInput.dolly);close(afterWheel.zoom,startInput.zoom);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:350,y:300,button:'right',buttons:2,clickCount:1},session);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:350,y:230,button:'right',buttons:2},session);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:350,y:230,button:'right',buttons:0,clickCount:1},session);
    const afterRight=await evaluate('SolarTime.renderer.cameraSnapshot()');assert.ok(afterRight.zoom>afterWheel.zoom);close(afterRight.dolly,afterWheel.dolly);
    await evaluate(`localStorage.removeItem('eg.solar-time.v0.01')`);
    await send('Page.reload',{},session);await delay(150);
    await waitFor('!!window.SolarTime&&SolarTime.getState().opening===false','Cold default camera did not load',35000);
    assert.equal(await evaluate(`document.getElementById('camera-mode-toggle').dataset.mode==='normal'&&SolarTime.renderer.options.dollyZoom===true`),true);
    assert.equal(await evaluate('SolarTime.renderer.options.actualOrbitSpacing'),1);
    const coldQa=await evaluate('window.__openingCameraQa');assert.ok(coldQa.ended-coldQa.started>=4800&&coldQa.ended-coldQa.started<5500);
    return {durationMs:elapsed,plannedDurationMs:first.tweenDuration,coldDurationMs:coldQa.ended-coldQa.started,unlockMs:unlockElapsed,annotationStartMs:first.annotationStart-first.tweenStart,annotationFullMs:first.annotationStart-first.tweenStart+1500,firstDeparture:{azimuth:first.from.azimuth,elevation:first.from.elevation,zoom:first.from.zoom,dolly:first.from.dolly},secondDeparture:{azimuth:second.from.azimuth,elevation:second.from.elevation},arc:qa.input.arc,destination:final.camera,inputLocked:true,finalSecondInteractive:true,tracking,trackingReturn,moonTravel,actualScale,scaleControls,legacyModeMigrated:true,fixedControls:true,refreshChecks,dust,preview,coldMode:'move'};
  }finally{
    await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
};
