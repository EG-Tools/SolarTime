(() => {
  const A=SolarAstro,canvas=document.createElement('canvas'),gpu=new SolarSurface.DirectRenderer(canvas),r=Object.create(SolarRenderer.prototype);
  const ms=Date.parse('2026-10-01T00:00:00Z'),paths=A.BODIES.map(body=>({body,points:A.orbitAt(body,ms,360)})),origin={x:0,y:0,z:0};
  Object.assign(r,{w:1280,h:800,camera:{...r.defaultCameraSnapshot(),azimuth:.63,elevation:.62},bodyScales:{sun:1},satelliteOrbitScales:{},options:{overviewOrbitGap:145,actualOrbitSpacing:.02},overviewFitScale:.29,lensStretch:1.6,orbitModelCache:new WeakMap(),stats:{orbitBufferBuilds:0}});
  r.actualFitScale=r.actualScaleFit();
  const set=p=>{r.actualScaleMix=p;r.fitScale=r.overviewFitScale+(r.actualFitScale-r.overviewFitScale)*p;};
  const draw=()=>{
    const camera=r.gpuOrbitCamera();gpu.begin();
    for(const path of paths)gpu.orbit('solar:'+path.body.id,r.orbitModel(path),origin,camera,.01,128,128,[.5,.6,.7],.7,1,1,4);
  };
  const read=()=>{const pixels=new Uint8Array(256*256*4);gpu.gl.readPixels(0,0,256,256,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,pixels);return pixels;};
  try{
    gpu.resize(256,256,1);set(0);draw();
    const coldUploads=gpu.stats.orbitUploads,built=r.stats.orbitBufferBuilds;
    // A warmed 61-frame transition, reversed immediately, changes only uniforms.
    for(const direction of [1,-1])for(let i=0;i<=60;i++){set(direction===1?i/60:1-i/60);draw();}
    const transitionUploads=gpu.stats.orbitUploads-coldUploads,transitionBuilds=r.stats.orbitBufferBuilds-built;
    let cases=0,maxRelativeDifference=0,minVisiblePixels=Infinity;
    const referenceCamera={ca:1,sa:0,ce:0,se:1,lens:1,travel:0,anchor:origin};
    for(const spacing of [.01,1])for(const dolly of [.002,.6,1,2])for(const tracked of [false,true])for(const p of [0,.0002,.15,.5,.85,.9998,1]){
      r.options.actualOrbitSpacing=spacing;r.camera.dolly=dolly;set(p);
      r.projectionAnchor=tracked?r.displaySolarPoint(paths[2].points[17]):null;
      const views=paths.map(path=>path.points.map(point=>r.projectView(r.displaySolarPoint(point))));
      const extent=Math.max(...views.flatMap(points=>points.flatMap(point=>[Math.abs(point.x),Math.abs(point.y)]))),scale=115/extent;
      const camera=r.gpuOrbitCamera();gpu.begin();
      for(const path of paths)gpu.orbit('solar:'+path.body.id,r.orbitModel(path),origin,camera,scale,128,128,[.5,.6,.7],.7,1,1,4);
      const actual=read();gpu.begin();
      // Independent oracle: project CPU coordinates to pixels, then draw with
      // an identity camera. Also checks the solar -> three-component reset.
      for(const [j,path] of paths.entries()){
        const points=new Float32Array(path.points.length*3);
        for(const [i,point] of views[j].entries()){points[i*3]=point.x*scale;points[i*3+1]=-point.y*scale;}
        gpu.orbit('reference:'+path.body.id,points,origin,referenceCamera,1,128,128,[.5,.6,.7],.7);
      }
      const expected=read();let difference=0,total=0,visible=0;
      for(let i=3;i<expected.length;i+=4){difference+=Math.abs(expected[i]-actual[i]);total+=expected[i];if(expected[i]>2)visible++;}
      maxRelativeDifference=Math.max(maxRelativeDifference,difference/Math.max(1,total));minVisiblePixels=Math.min(minVisiblePixels,visible);cases++;
    }
    return {coldUploads,transitionUploads,transitionBuilds,cases,maxRelativeDifference,minVisiblePixels,error:gpu.gl.getError()};
  }finally{gpu.dispose();}
})()
