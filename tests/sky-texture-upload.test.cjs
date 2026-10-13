'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const frames=[],calls=[],closed=[],deleted=[],window={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),{window,requestAnimationFrame:fn=>frames.push(fn),createImageBitmap:async(source,x,y,width,height)=>({width,height,close:()=>closed.push(y)})});
 const gl={isContextLost:()=>false,getParameter:()=>4096,createTexture:()=>({fresh:true}),activeTexture(){},bindTexture(){},texImage2D(){calls.push('allocate')},texSubImage2D(){calls.push('strip')},generateMipmap(){calls.push('mipmap')},texParameteri(){},deleteTexture:t=>deleted.push(t)};
 const sky=Object.create(window.SolarSky.prototype),old={old:true};Object.assign(sky,{gl,texture:old,image:{width:512},initTicket:1,stats:{},invalidate(){}});
 const tick=async()=>{frames.splice(0).forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));};return {sky,old,frames,calls,closed,deleted,tick};
}
test('background keeps old panorama until strips and mipmaps are complete',async()=>{
 const f=fixture(),image={width:2048,height:1024},pending=f.sky.uploadSkyImage(image);
 let turns=0;while(f.frames.length){assert.equal(f.sky.texture,f.old);const before=f.calls.length;await f.tick();assert.equal(f.calls.length-before,1);assert.ok(++turns<20);}
 assert.equal(await pending,true);assert.equal(f.calls.filter(x=>x==='strip').length,8);assert.equal(f.closed.length,8);assert.equal(f.calls.at(-1),'mipmap');assert.equal(f.sky.image,image);assert.deepEqual(f.deleted,[f.old]);
});
test('obsolete background upload releases unpublished texture and bitmap',async()=>{
 const f=fixture(),pending=f.sky.uploadSkyImage({width:2048,height:1024});await f.tick();f.sky.initTicket++;await f.tick();
 assert.equal(await pending,false);assert.equal(f.sky.texture,f.old);assert.equal(f.closed.length,1);assert.equal(f.deleted.length,1);assert.notEqual(f.deleted[0],f.old);
});
