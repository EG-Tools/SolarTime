(async()=>{
  const {CloudWeather}=SolarSurface.kernel(),weather=new CloudWeather(),reference=new CloudWeather(),r=Object.create(SolarRenderer.prototype);
  const canvas=document.createElement('canvas'),setupStart=performance.now(),gpu=new SolarSurface.DirectRenderer(canvas),setupMs=performance.now()-setupStart;
  Object.assign(r,{dpr:1,options:{quality:'auto'},presentationUntil:0});
  const wait=()=>new Promise(resolve=>setTimeout(resolve,0)),deadline=performance.now()+15000;
  try{
    let start=performance.now();reference.update(.217,20000);const weatherSyncMs=performance.now()-start;
    weather.prepare(.217);let weatherYields=0;
    while(weather.pending){if(performance.now()>deadline)throw Error('Weather build stalled');weatherYields++;await wait();}
    const weatherIdentical=weather.map.data.every((value,i)=>value===reference.map.data[i]);
    start=performance.now();const preview=r.coronaSource(20),previewMs=performance.now()-start;let coronaYields=0;
    while(r.coronaTask){if(performance.now()>deadline)throw Error('Corona build stalled');coronaYields++;await wait();}
    start=performance.now();const coronaReference=r.makeCoronaTexture(384),coronaSyncMs=performance.now()-start;
    const actual=r.coronaTexture.getContext('2d').getImageData(0,0,384,384).data,expected=coronaReference.getContext('2d').getImageData(0,0,384,384).data;
    const coronaIdentical=actual.every((value,i)=>value===expected[i]);
    weather.prepare(.8);weather.cancelBuild();r.coronaSource(200);r.cancelCoronaBuild();await wait();
    const cancelled=weather.seed===.217&&!weather.pending&&!r.coronaTask&&r.coronaTexture.width===384;
    gpu.resize(512,512,1);gpu.begin();start=performance.now();gpu.corona(r.coronaTexture,{x:256,y:256},40,0);const coronaUploadAndDrawMs=performance.now()-start;
    gpu.cloudWeather=weather;weather.update(.217,20000,gpu.gl);gpu.resetTextureBindings();
    gpu.orbit('test',new Float32Array([0,0,0,100,0,0]),null,{ca:1,sa:0,ce:0,se:1,lens:1,travel:0},1,256,256,[1,1,1],1);
    const memory=gpu.memoryUsage(),depthBuffer=gpu.gl.getContextAttributes().depth,error=gpu.gl.getError();
    const paintCanvas=()=>{const c=document.createElement('canvas');c.width=512;c.height=512;return c;},oldCanvas=paintCanvas(),newCanvas=paintCanvas();
    const points=Array.from({length:120},(_,i)=>({color:i%4,sizeScale:1+(i%7)/10,q:{visible:true,x:40+(i*53)%430,y:40+(i*71)%430,alpha:.1+(i%9)/15,size:1+(i%5)/3,tail:(i%8)*2,angle:i*.17}}));
    const oldCtx=oldCanvas.getContext('2d'),newCtx=newCanvas.getContext('2d');
    for(const c of [oldCtx,newCtx]){c.translate(4,5);c.scale(.97,.94);}
    oldCtx.save();oldCtx.globalCompositeOperation='source-over';oldCtx.lineCap='round';for(const p of points)r.drawSoftFlightParticle(oldCtx,p,p.q);oldCtx.restore();
    r.drawSaturnFlightParticles(newCtx,{alpha:1,ambient:true,points},p=>p.q);
    const oldPixels=oldCtx.getImageData(0,0,512,512).data,newPixels=newCtx.getImageData(0,0,512,512).data;
    let particlePixelDifference=0;for(let i=0;i<oldPixels.length;i++)particlePixelDifference=Math.max(particlePixelDifference,Math.abs(oldPixels[i]-newPixels[i]));
    const result={particlePixelDifference,setupMs,coronaUploadAndDrawMs,weatherSyncMs,weatherMaxSliceMs:weather.maxBuildSliceMs,weatherYields,weatherIdentical,weatherBytes:weather.map.data.byteLength,
      previewSize:preview.width,previewMs,coronaSyncMs,coronaMaxSliceMs:r.coronaMaxSliceMs,coronaYields,coronaIdentical,cancelled,memory,depthBuffer,error};
    gpu.dispose();result.memoryAfterDispose=gpu.memoryUsage().totalEstimate;return result;
  }finally{weather.dispose();reference.dispose();r.cancelCoronaBuild();gpu.dispose();}
})()
