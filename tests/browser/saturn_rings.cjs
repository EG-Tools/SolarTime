// Actual CDN -> shared loader -> compiled ring shader; private browser owned by runner.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
module.exports=async function({root,evaluate}){
 await evaluate(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const base=JSON.parse(fs.readFileSync(path.join(root,'assets/deployment.json'),'utf8')).cdnBase;
 const assets=Object.fromEntries(['saturn','saturn-ring'].map(id=>[id,{base,tiers:manifest.materials[id].tiers,seamBaked:manifest.materials[id].seamBaked}]));
 const result=await evaluate('('+async function(assets){
  window.SolarAssets={materials:assets};
  const canvas=document.createElement('canvas');document.body.append(canvas);
  const direct=new SolarSurface.DirectRenderer(canvas);direct.resize(630,430,1);
  const frame={u:[1,0,0],v:[0,.48,Math.sqrt(1-.48*.48)],pole:[0,-Math.sqrt(1-.48*.48),.48]};
  const job={id:'saturn',textureWidth:4096,priority:2,frame,light:[.4,-.3,Math.sqrt(.75)],phase:.2};
  const pixels=()=>{const p=new Uint8Array(630*430*4);direct.gl.readPixels(0,0,630,430,direct.gl.RGBA,direct.gl.UNSIGNED_BYTE,p);return p;};
  const draw=()=>{direct.begin();direct.prepare([job]);direct.planet(job,{id:'saturn'},{x:315,y:230},108,0,false);direct.end();};
  const sheet=document.createElement('canvas');sheet.width=1260;sheet.height=430;
  const ctx=sheet.getContext('2d');ctx.fillStyle='#080d14';ctx.fillRect(0,0,1260,430);ctx.font='18px sans-serif';
  let release;const gate=new Promise(r=>release=r),load=direct.loadTexture.bind(direct);
  direct.loadTexture=async(...args)=>{if(args[0]==='saturn-ring')await gate;return load(...args);};
  async function settle(names){const end=performance.now()+30000;while(true){draw();if(names.every(id=>direct.textures.get(id)?.width===4096))return;if(performance.now()>end)throw Error('Ring CDN load timeout: '+JSON.stringify(direct.stats));await new Promise(r=>setTimeout(r,25));}}
  try{
   await settle(['saturn']);const fallback=pixels();ctx.drawImage(canvas,0,0);
   release();await settle(['saturn','saturn-ring']);const mapped=pixels();ctx.drawImage(canvas,630,0);
   ctx.fillStyle='#c5cdd6';ctx.fillText('Procedural loading fallback',20,30);ctx.fillText('Solar System Scope texture',650,30);
   const record=direct.textures.get('saturn-ring'),texture=record.texture;
   let changed=0;for(let i=0;i<mapped.length;i+=4)if(mapped[i]!==fallback[i]||mapped[i+3]!==fallback[i+3])changed++;
   function ringPixels(id){direct.begin();for(const front of [false,true])direct.rings({id},frame,{x:315,y:230},108,front);return pixels();}
   const uranus=ringPixels('uranus');direct.textures.delete('saturn-ring');const uranusFallback=ringPixels('uranus');direct.textures.set('saturn-ring',record);
   const unchanged=uranus.every((v,i)=>v===uranusFallback[i]);
   direct.begin();for(const front of [false,true])direct.rings({id:'saturn'},{u:[1,0,0],v:[0,1,0]},{x:315,y:215},120,front);
   const rings=pixels(),sample=f=>rings[((430-215-1)*630+Math.round(315+(1.28+.98*f)*120))*4+3];
   const alpha={dense:sample(.60),gap:sample(.70),outer:sample(.85),center:rings[((430-215-1)*630+315)*4+3]};
   const output={image:sheet.toDataURL(),changed,unchanged,width:record.width,height:record.height,bytes:record.width*record.height*4,alpha,error:direct.gl.getError(),source:record.residentSource.url};
   direct.dispose();output.disposed=!direct.gl.isTexture(texture);return output;
  }finally{release?.();direct.dispose();canvas.remove();}
 }+')('+JSON.stringify(assets)+')');
 const file=path.join(os.tmpdir(),'solartime-saturn-rings.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
 assert.equal(result.width,4096);assert.equal(result.height,1);assert.equal(result.bytes,16384);
 assert.equal(result.error,0);assert.equal(result.unchanged,true);assert.equal(result.disposed,true);assert.ok(result.changed>1000);
 assert.equal(result.alpha.center,0);assert.ok(result.alpha.gap<result.alpha.dense*.65);assert.ok(result.alpha.outer>result.alpha.gap);
 assert.ok(result.source.startsWith(base));return {...result,file};
};
