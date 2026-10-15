'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate})=>{
 const result=await evaluate(`(()=>{
  const canvas=document.createElement('canvas'),r=new SolarSurface.DirectRenderer(canvas);r.resize(128,128,1);
  const g=r.gl,originalNow=performance.now.bind(performance);let now=10000;
  Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  const map=(rgb,sampled)=>{const texture=g.createTexture();g.bindTexture(g.TEXTURE_2D,texture);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([...rgb,255]));g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);return {texture,width:1,height:1,sampled};};
  const deck=map([220,185,135],true),surface=map([110,65,30],false);
  r.textures.set('venus',deck);r.texture=name=>r.textures.get(name)||null;r.resetTextureBindings();
  const job={id:'venus',textureWidth:256,cloudTextureWidth:256,cloudAmount:.8,frame:{u:[1,0,0],v:[0,1,0],pole:[0,0,1]},phase:0,light:[0,0,1]};
  const draw=()=>{r.begin();r.planet(job,{id:'venus'},{x:64,y:64},60,0,false);const pixel=new Uint8Array(4);g.readPixels(64,64,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);return [...pixel];};
  try{
   const before=draw();r.textures.set('venus-surface',surface);
   const first=draw();now+=350;const middle=draw();now+=350;const after=draw();
   now+=3000;const repeat=draw();return {before,first,middle,after,repeat,error:g.getError(),fallbackReleased:surface.revealFallback===null};
  }finally{Object.defineProperty(performance,'now',{configurable:true,value:originalNow});r.dispose();}
 })()`);
 assert.equal(result.error,0);assert.ok(result.fallbackReleased);
 for(let i=0;i<3;i++){
  assert.ok(Math.abs(result.first[i]-result.before[i])<=1,'surface arrival must preserve the visible cloud deck');
  assert.ok(result.middle[i]<=result.first[i]&&result.middle[i]>=result.after[i],'shared map fade must be monotonic');
  assert.equal(result.after[i],result.repeat[i],'a later frame must not restart the fade');
 }
 assert.ok(result.first[0]>result.middle[0]&&result.middle[0]>result.after[0]);
 return result;
};
