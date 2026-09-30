'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({root,evaluate,send,session})=>{
 const server=http.createServer((req,res)=>{
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch(_){res.writeHead(400).end();return;}
  if(file===root)file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/',delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(){const end=Date.now()+35000;while(!await evaluate('!!window.SolarTime')){if(Date.now()>end)throw Error('Local app did not start');await delay(100);}}
 try{
  await send('Page.navigate',{url},session);await ready();
  const state=await evaluate(`(()=>{
    document.querySelector('[data-body="venus"]').click();
    const input=document.getElementById('venus-cloud-amount');
    const initial={value:input.value,shown:!document.getElementById('venus-cloud-control').hidden,earthHidden:document.getElementById('earth-cloud-control').hidden};
    input.value='37';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));
    const amount=SolarTime.renderer.options.venusCloudAmount;
    const asset=SolarAssets.materials['venus-surface'];
    return {initial,amount,base:asset.base,tiers:asset.tiers.map(t=>t.width)};
  })()`);
  assert.deepEqual(state.initial,{value:'80',shown:true,earthHidden:true});assert.equal(state.amount,.37);
  assert.match(state.base,/^https:\/\/solar-time\.keg0320\.workers\.dev\/media\/$/);assert.deepEqual(state.tiers,[256,512,1024,2048,4096]);
  await send('Page.reload',{},session);await delay(150);await ready();
  const restored=await evaluate(`(()=>{document.querySelector('[data-body="venus"]').click();return {amount:SolarTime.renderer.options.venusCloudAmount,value:document.getElementById('venus-cloud-amount').value};})()`);
  assert.deepEqual(restored,{amount:.37,value:'37'});
  const reset=await evaluate(`(async()=>{document.getElementById('reset-defaults').click();document.getElementById('reset-defaults-yes').click();const end=performance.now()+5000;while(SolarTime.renderer.options.venusCloudAmount!==.8){if(performance.now()>end)throw Error('Factory reset timeout');await new Promise(resolve=>setTimeout(resolve,30));}document.querySelector('[data-body="venus"]').click();return {amount:SolarTime.renderer.options.venusCloudAmount,value:document.getElementById('venus-cloud-amount').value};})()`);
  assert.deepEqual(reset,{amount:.8,value:'80'});
  const earthControls=await evaluate(`(()=>{
    document.querySelector('[data-body="earth"]').click();
    const clouds=document.getElementById('earth-cloud-control'),lights=document.getElementById('earth-night-lights-control');
    const input=document.getElementById('earth-cloud-amount');
    return {shown:!clouds.hidden&&!lights.hidden,cloudsFirst:!!(clouds.compareDocumentPosition(lights)&Node.DOCUMENT_POSITION_FOLLOWING),max:input.max,value:input.value,amount:SolarTime.renderer.options.earthCloudAmount};
  })()`);
  assert.deepEqual(earthControls,{shown:true,cloudsFirst:true,max:'100',value:'100',amount:1});
  const earthSaved=await evaluate(`(()=>{const input=document.getElementById('earth-cloud-amount');input.value='42';input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));return SolarTime.renderer.options.earthCloudAmount;})()`);
  assert.equal(earthSaved,.42);
  await send('Page.reload',{},session);await delay(150);await ready();
  const earthRestored=await evaluate(`(()=>{document.querySelector('[data-body="earth"]').click();return {amount:SolarTime.renderer.options.earthCloudAmount,value:document.getElementById('earth-cloud-amount').value};})()`);
  assert.deepEqual(earthRestored,{amount:.42,value:'42'});
  const textures=await evaluate(`(async()=>{
    const r=SolarTime.renderer;r.setAutoRotate(0);r.options.venusCloudAmount=1;
    const b=SolarAstro.BODIES.find(b=>b.id==='venus'),job=r.surfaceJob(b,{x:1,y:0,z:1},300,Date.now(),0,true,{},performance.now());
    const canvas=document.createElement('canvas'),d=new SolarSurface.DirectRenderer(canvas);d.resize(600,600,1);
    const widths=new Set(),end=performance.now()+25000;
    try{
      while((d.textures.get('venus-surface')?.width||0)<256||!(d.textures.get('venus')?.texture)){
        d.begin();d.prepare([job]);d.planet(job,b,{x:300,y:300},294,0,false);
        if(performance.now()>end)throw Error('Near opaque Venus baseline timeout');await new Promise(resolve=>setTimeout(resolve,30));
      }
      const preloaded=d.textures.get('venus-surface').width;
      if(preloaded!==256)throw Error('Opaque Venus loaded more than a 256 baseline');
      r.options.venusCloudAmount=0;Object.assign(job,r.surfaceJob(b,{x:1,y:0,z:1},300,Date.now(),0,true,{},performance.now()));
      d.begin();d.prepare([job]);if(!d.planet(job,b,{x:300,y:300},294,0,false))throw Error('Preloaded reveal produced a blank Venus');
      while((d.textures.get('venus-surface')?.width||0)<4096){
        d.begin();d.prepare([job]);d.planet(job,b,{x:300,y:300},294,0,false);
        widths.add(d.textures.get('venus-surface')?.width||0);
        if(performance.now()>end)throw Error('Public Venus 4K LOD timeout');await new Promise(resolve=>setTimeout(resolve,30));
      }
      const native=d.textures.get('venus-surface').width;
      const far=r.surfaceJob(b,{x:1,y:0,z:1},16,Date.now(),0,true,{},performance.now());d.begin();d.prepare([far]);
      return {preloaded,native,widths:[...widths],farAmount:far.cloudAmount,farSurfaceWanted:d.textureIsWanted('venus-surface'),error:d.gl.getError()};
    }finally{d.dispose();}
  })()`);
  assert.equal(textures.preloaded,256);assert.equal(textures.native,4096);assert.equal(textures.farAmount,1);assert.equal(textures.farSurfaceWanted,false);assert.equal(textures.error,0);
  return {state,restored,reset,earthControls,earthRestored,textures};
 }finally{
  await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
};
