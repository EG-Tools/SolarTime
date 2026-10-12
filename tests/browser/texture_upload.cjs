'use strict';
const assert=require('node:assert/strict');
module.exports=async({evaluate})=>{
 const result=await evaluate(`(async()=>{
  const r=SolarTime.renderer.gpu,g=r.gl,source=document.createElement('canvas');source.width=4096;source.height=2048;
  const c=source.getContext('2d');for(let y=0;y<source.height;y++){c.fillStyle='rgba('+y%256+','+(y*3)%256+','+(y*7)%256+','+(.2+.8*(y%128)/127)+')';c.fillRect(0,y,source.width,1);}
  const staged=g.createTexture(),baseline=g.createTexture(),fb=g.createFramebuffer();
  try{
   await r.uploadTexturePixels(staged,source,4096,2048,null,()=>true);
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,baseline);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,source);
   const saved=g.getParameter(g.FRAMEBUFFER_BINDING),rows=[0,1,126,127,128,129,255,256,1023,1024,2046,2047];let difference=0;
   try{const sample=texture=>{g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,texture,0);return rows.map(y=>{const pixel=new Uint8Array(4);g.readPixels(2048,y,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);return Array.from(pixel);});};const a=sample(baseline),b=sample(staged);a.forEach((p,i)=>p.forEach((v,j)=>difference=Math.max(difference,Math.abs(v-b[i][j]))));}
   finally{g.bindFramebuffer(g.FRAMEBUFFER,saved);}
   return {difference,samples:rows.length,error:g.getError()};
  }finally{g.deleteFramebuffer(fb);g.deleteTexture(staged);g.deleteTexture(baseline);r.resetBindings();}
 })()`);
 assert.equal(result.error,0);assert.equal(result.difference,0);return result;
};
