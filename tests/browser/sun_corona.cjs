(async()=>{
 const canvas=document.createElement('canvas'),gpu=new SolarSurface.DirectRenderer(canvas),gl=gpu.gl,current=gpu.coronaProgram,r=Object.create(SolarRenderer.prototype),source=r.makeCoronaTexture(384);
 let previous;
 const compile=(type,text)=>{const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 try{
  const vs=compile(gl.VERTEX_SHADER,__sunBaseline.vertex),fs=compile(gl.FRAGMENT_SHADER,__sunBaseline.fragment),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  previous={program,a:gl.getAttribLocation(program,'a'),u:Object.fromEntries(Object.keys(current.u).map(k=>[k,gl.getUniformLocation(program,k)]))};gl.useProgram(program);gl.uniform1i(previous.u.coronaMap,3);gpu.resetBindings();
  const pixel=new Uint8Array(4),complete=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel),rows=[];let difference=0;
  for(const size of [512,2160]){
   const width=Math.round(size*16/9);gpu.resize(width,size,1);
   for(const radius of [size*.04,size*.35,size*.8]){
    const clipped=gpu.drawCoronaQuad.bind(gpu),full=()=>gl.drawArrays(gl.TRIANGLES,0,6);
    const draw=(p,t=23)=>{gpu.coronaProgram=p;gpu.drawCoronaQuad=p===previous?full:clipped;gpu.begin();gpu.corona(source,{x:width/2,y:size/2},radius,t);gpu.end();};
    const before=new Uint8Array(width*size*4),after=new Uint8Array(before.length);
    draw(previous);gl.readPixels(0,0,width,size,gl.RGBA,gl.UNSIGNED_BYTE,before);draw(current);gl.readPixels(0,0,width,size,gl.RGBA,gl.UNSIGNED_BYTE,after);
    for(let i=0;i<before.length;i++)difference=Math.max(difference,Math.abs(before[i]-after[i]));
    const timings={before:[],after:[],empty:[]};
    for(let round=0;round<5;round++)for(const name of round%2?['after','before','empty']:['empty','before','after']){
     const p=name==='before'?previous:current;draw(p);complete();const start=performance.now();
     for(let n=0;n<12;n++){if(name==='empty'){gpu.begin();gpu.end();}else draw(p,23+n/60);}
     complete();timings[name].push((performance.now()-start)/12);await new Promise(resolve=>setTimeout(resolve,0));
    }
    rows.push({width,height:size,radius,...Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,v.sort((a,b)=>a-b)[2]]))});
   }
  }
  return {difference,rows,error:gl.getError()};
 }finally{gpu.coronaProgram=current;if(previous)gl.deleteProgram(previous.program);gpu.dispose();}
})()
