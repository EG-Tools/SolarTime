// A/B the two programs on the SAME context, geometry and resident 4K textures.
// Not part of the app. The owning runner always closes its temporary browser.
async function benchmarkCloudShader(){
  const base='https://solar-time.keg0320.workers.dev/media/',manifest=window.SolarCloudBenchmarkManifest;
  const ids=['earth','clouds','clouds-alt','earth-night'];
  window.SolarAssets={materials:Object.fromEntries(ids.map(id=>[id,{...manifest.materials[id],base}]))};
  const canvas=document.createElement('canvas'),renderer=new SolarSurface.DirectRenderer(canvas),size=1024;
  renderer.resize(size,size,1);
  const gl=renderer.gl,current=renderer.planetProgram;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(error);}return shader;};
  let previous=null;
  const job={id:'earth',diam:size,textureWidth:4096,cloudTextureWidth:4096,nightTextureWidth:2048,nightLights:true,
    cloudAmount:.5,cloudSeed:.217,cloudReveal:1,weatherDay:20000,cloudSpinDays:.9972696759259259,phase:.47,priority:2,
    frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[.55,-.1,.829156]};
  let radius=size*.49,altMix=1;
  const draw=program=>{renderer.planetProgram=program;renderer.begin();renderer.planet(job,{id:'earth'},{x:size/2,y:size/2},radius,0,false);};
  const pixel=new Uint8Array(4),complete=()=>gl.readPixels(size/2,size/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  try{
    const vs=compile(gl.VERTEX_SHADER,window.SolarCloudBenchmarkVertex),fs=compile(gl.FRAGMENT_SHADER,window.SolarCloudBenchmarkBefore);
    const program=gl.createProgram();previous={program,a:0,u:{},viewportWidth:NaN,viewportHeight:NaN};
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    previous.a=gl.getAttribLocation(program,'a');
    previous.u=Object.fromEntries(Object.keys(current.u).map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.useProgram(program);
    for(const [i,name] of ['colorMap','bumpMap','cloudsMap','nightMap','cloudWeatherMap','cloudAltMap'].entries())gl.uniform1i(previous.u[name],i);
    renderer.resetBindings();
    const deadline=performance.now()+25000;
    while(true){
      renderer.prepare([job]);draw(current);
      if(ids.every(id=>(renderer.textures.get(id)?.width||0)>=(['earth-night','clouds-alt'].includes(id)?2048:4096)))break;
      if(performance.now()>deadline)throw Error('4K shader benchmark textures timed out');
      await new Promise(resolve=>setTimeout(resolve,40));
    }
    renderer.cloudAlternativeMix=()=>altMix;
    const ext=gl.getExtension('EXT_disjoint_timer_query');
    const beforePixels=new Uint8Array(size*size*4),afterPixels=new Uint8Array(size*size*4);
    const scenarios=[
      {name:'day-100',amount:.5,light:[0,0,1]},
      {name:'day-200',amount:1,light:[0,0,1]},
      {name:'twilight-100',amount:.5,light:[1,0,0]},
      {name:'night-100',amount:.5,light:[0,0,-1]},
      {name:'lights-off',amount:.5,light:[0,0,-1],night:false},
      {name:'forming',amount:.5,light:[.55,-.1,.829156],reveal:.4},
      {name:'primary-only',amount:.5,light:[.55,-.1,.829156],alt:0},
      {name:'clouds-off',amount:0,light:[.55,-.1,.829156]},
      {name:'small-earth',amount:.5,light:[.55,-.1,.829156],radius:48}
    ];
    const median=values=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const measure=async program=>{
      draw(program);complete();
      let query=null;
      try{
        if(ext){gl.getParameter(ext.GPU_DISJOINT_EXT);query=ext.createQueryEXT();ext.beginQueryEXT(ext.TIME_ELAPSED_EXT,query);}
        const start=performance.now(),count=30;
        for(let i=0;i<count;i++)draw(program);
        if(ext)ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
        complete();const wall=(performance.now()-start)/count;
        if(!ext)return {wall,gpu:null};
        const limit=performance.now()+2000;
        while(!ext.getQueryObjectEXT(query,ext.QUERY_RESULT_AVAILABLE_EXT)){
          if(performance.now()>limit)throw Error('GPU timer query timed out');
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(gl.getParameter(ext.GPU_DISJOINT_EXT))return {wall,gpu:null};
        return {wall,gpu:ext.getQueryObjectEXT(query,ext.QUERY_RESULT_EXT)/1e6/count};
      }finally{if(query)ext.deleteQueryEXT(query);}
    };
    let maxChannelDifference=0;const results=[];
    for(const scenario of scenarios){
      job.cloudAmount=scenario.amount;job.light=scenario.light;job.nightLights=scenario.night!==false;
      job.cloudReveal=scenario.reveal??1;radius=scenario.radius??size*.49;altMix=scenario.alt??1;
      draw(previous);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,beforePixels);
      draw(current);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,afterPixels);
      let maximum=0,different=0;
      for(let i=0;i<beforePixels.length;i++){const delta=Math.abs(beforePixels[i]-afterPixels[i]);maximum=Math.max(maximum,delta);if(delta)different++;}
      maxChannelDifference=Math.max(maxChannelDifference,maximum);
      const samples={before:[],after:[]};
      for(let round=0;round<10;round++){
        for(const name of round%2?['after','before']:['before','after']){
          const sample=await measure(name==='before'?previous:current);
          if(round>=2)samples[name].push(sample);
        }
      }
      const summary=values=>({wallMs:median(values.map(row=>row.wall)),gpuMs:values.every(row=>row.gpu!==null)?median(values.map(row=>row.gpu)):null});
      results.push({scene:scenario.name,maxChannelDifference:maximum,differentChannels:different,before:summary(samples.before),after:summary(samples.after)});
    }
    return {size,textureWidths:Object.fromEntries(ids.map(id=>[id,renderer.textures.get(id).width])),timer:ext?'EXT_disjoint_timer_query':'CPU submission + GPU readback',maxChannelDifference,results,glError:gl.getError()};
  }finally{renderer.planetProgram=current;if(previous)gl.deleteProgram(previous.program);renderer.dispose();canvas.remove();}
}
