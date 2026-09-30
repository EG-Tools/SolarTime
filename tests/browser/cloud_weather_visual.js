// Evaluated only by cloud_weather.cjs --visual in its disposable browser.
async function renderCloudWeatherVisual(){
  const manifest=window.SolarCloudTestManifest,base='https://solar-time.keg0320.workers.dev/media/';
  const ids=['earth','clouds','clouds-alt','earth-night'];
  window.SolarAssets={materials:Object.fromEntries(ids.map(id=>[id,{...manifest.materials[id],base}]))};
  const canvas=document.createElement('canvas');document.body.append(canvas);
  const renderer=new SolarSurface.DirectRenderer(canvas);renderer.resize(600,600,1);
  const job={id:'earth',diam:600,textureWidth:4096,cloudTextureWidth:4096,nightLights:true,nightTextureWidth:2048,
    cloudAmount:1,cloudSeed:.217,cloudReveal:1,weatherDay:20000,phase:.47,priority:2,
    frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[.55,-.1,.829156]};
  const draw=()=>{renderer.begin();renderer.prepare([job]);renderer.planet(job,{id:'earth'},{x:300,y:300},294,0,false);};
  try{
    const deadline=performance.now()+35000;
    while(true){
      draw();
      if(ids.every(id=>(renderer.textures.get(id)?.width||0)>=(['earth-night','clouds-alt'].includes(id)?2048:4096)))break;
      if(performance.now()>deadline)throw Error('Cloud source load timeout: '+JSON.stringify([...renderer.textures].map(([id,t])=>[id,t.width,t.error])));
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    renderer.cloudBlendUntil=1;
    const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1260;
    const ctx=sheet.getContext('2d');ctx.fillStyle='#080d14';ctx.fillRect(0,0,sheet.width,sheet.height);
    ctx.font='18px sans-serif';ctx.fillStyle='#e0e7ef';
    const panels=[{amount:.5,day:20000},{amount:.5,day:20001},{amount:.5,day:20003},{amount:1,day:20000},{amount:1,day:20001},{amount:1,day:20003}];
    for(let i=0;i<panels.length;i++){
      const panel=panels[i];job.cloudAmount=panel.amount;job.weatherDay=panel.day;draw();
      ctx.drawImage(canvas,(i%3)*600,Math.floor(i/3)*630+30);
      ctx.fillText('Cloud '+panel.amount*200+'% | day '+(panel.day-20000),(i%3)*600+18,Math.floor(i/3)*630+24);
    }
    job.weatherDay=20000;job.cloudAmount=1;
    // Compare identical warmed-up geometry/shader with the extra source on/off.
    // Includes CPU submission + GPU completion, not whole-app FPS.
    const samples={primary:[],dual:[]},gl=renderer.gl,probe=new Uint8Array(4);
    const complete=()=>gl.readPixels(300,300,1,1,gl.RGBA,gl.UNSIGNED_BYTE,probe);
    for(let round=0;round<8;round++)for(const dual of round%2?[true,false]:[false,true]){
      renderer.cloudAlternativeMix=()=>dual?1:0;draw();complete();
      const start=performance.now();for(let i=0;i<10;i++)draw();complete();
      if(round>1)samples[dual?'dual':'primary'].push((performance.now()-start)/10);
    }
    const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const widths=Object.fromEntries(ids.map(id=>[id,renderer.textures.get(id).width]));
    return {image:sheet.toDataURL('image/png'),widths,textureMiB:renderer.stats.texturePixels*4/1048576,
      milliseconds:{primary:median(samples.primary),dual:median(samples.dual)},glError:gl.getError(),weatherBuilds:renderer.cloudWeather.builds};
  }finally{renderer.dispose();canvas.remove();}
}
