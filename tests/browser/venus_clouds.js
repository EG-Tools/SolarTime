// Real WebGL + CPU parity using NASA/old Venus maps supplied by the runner.
async function checkVenusClouds(assets){
 window.SolarAssets={materials:assets};
 const kernel=SolarSurface.kernel();kernel.setAssets(assets);
 const cpu=new kernel.Engine({gpu:false}),gpu=new kernel.Engine();
 const canvas=document.createElement('canvas');document.body.append(canvas);
 const direct=new SolarSurface.DirectRenderer(canvas);direct.resize(400,400,1);
 const job={id:'venus',diam:128,textureWidth:256,cloudTextureWidth:256,cloudAmount:1,cloudSeed:0,cloudReveal:1,weatherDay:20726,cloudSpinDays:-243.025,phase:.47,priority:2,
  frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[.45,-.1,.8874119674649424]};
 const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=430;
 const paint=sheet.getContext('2d');paint.fillStyle='#080d14';paint.fillRect(0,0,1200,430);paint.font='18px sans-serif';paint.fillStyle='#e0e7ef';
 const draw=()=>{direct.begin();direct.prepare([job]);return direct.planet(job,{id:'venus'},{x:200,y:200},196,0,false);};
 async function settle(names){const end=performance.now()+15000;while(true){draw();if(names.every(id=>(direct.textures.get(id)?.width||0)>=256))break;if(performance.now()>end)throw Error('Venus local texture timeout');await new Promise(r=>setTimeout(r,20));}}
 const demand=[],original=cpu.texture.bind(cpu);cpu.texture=(id,width)=>{demand.push(id);return original(id,width);};
 let difference=0,linearity=0,releasePreview;const samples=[];
 const pixels=()=>{const data=new Uint8Array(400*400*4);direct.gl.readPixels(0,0,400,400,direct.gl.RGBA,direct.gl.UNSIGNED_BYTE,data);return data;};
 try{
  await settle(['venus']);
  if(direct.textures.has('venus-surface')||direct.venusWeather||direct.cloudWeather)throw Error('Opaque Venus loaded surface or generated weather');
  const beforeReveal=pixels(),loads=[],loadTexture=direct.loadTexture.bind(direct);
  const previewGate=new Promise(resolve=>{releasePreview=resolve;});
  direct.loadTexture=async(...args)=>{if(args[0]==='venus-surface'){loads.push(args[2]);await previewGate;}return loadTexture(...args);};
  job.venusSurfacePreviewWidth=256;draw();
  if(loads.length!==1||loads[0]!==256)throw Error('Near opaque Venus did not preload just 256');
  for(const amount of [0,.25,0]){
   job.cloudAmount=amount;if(!draw())throw Error('First reveal produced a blank Venus');
   if(pixels().some((v,i)=>v!==beforeReveal[i]))throw Error('Pending surface did not retain the cloud view');
   if(!SolarPerformance.protectTexture(direct,'venus'))throw Error('Pending reveal may evict its visible clouds');
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  releasePreview();await settle(['venus-surface']);
  if(!direct.visibleTexturesReady()||job.cloudAmount!==0)throw Error('Ready surface lost requested opacity or readiness');
  direct.loadTexture=loadTexture;job.venusSurfacePreviewWidth=0;
  for(const [index,amount] of [0,.5,1].entries()){
   job.cloudAmount=amount;await settle(amount===0?['venus-surface']:amount===1?['venus']:['venus-surface','venus']);
   paint.drawImage(canvas,index*400,30);paint.fillText('Venus clouds '+amount*100+'%',index*400+14,24);
   demand.length=0;await cpu.render(job);await gpu.render(job);
   if(amount===0&&demand.includes('venus'))throw Error('Zero clouds requested cloud map');
   if(amount===1&&demand.includes('venus-surface'))throw Error('Opaque clouds requested NASA surface');
   const cp=cpu.ctx.getImageData(0,0,128,128).data,gp=new Uint8Array(128*128*4);gpu.gl.readPixels(0,0,128,128,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,gp);
   samples.push(gp);
   for(let y=36;y<92;y++)for(let x=36;x<92;x++)for(let k=0;k<3;k++)difference=Math.max(difference,Math.abs(cp[(y*128+x)*4+k]-gp[((127-y)*128+x)*4+k]));
  }
  for(let i=0;i<samples[1].length;i++)if(i%4!==3)linearity=Math.max(linearity,Math.abs(samples[1][i]-(samples[0][i]+samples[2][i])*.5));
  if(linearity>1)throw Error('Venus opacity is not linear: '+linearity);
  job.cloudAmount=.5;draw();const first=pixels();
  job.cloudAmount=0;draw();job.cloudAmount=.5;job.weatherDay+=100;job.cloudSeed=.9;draw();
  if(pixels().some((v,i)=>v!==first[i]))throw Error('Venus appearance changed with time/seed or re-enable at the same surface phase');
  for(const owner of [direct,cpu,gpu])if(owner.cloudWeather||owner.venusWeather)throw Error('Venus allocated weather noise');
  const result={image:sheet.toDataURL(),difference,linearity,noiseBuilds:0,coldRevealRetained:true,previewLoads:loads,errors:[direct.gl.getError(),gpu.gl.getError()]};
  return result;
 }finally{releasePreview?.();direct.dispose();gpu.clear();cpu.clear();canvas.remove();}
}
