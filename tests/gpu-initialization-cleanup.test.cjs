const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(failAt){
 let allocated=0;const live=new Set(),listeners=new Map();
 const create=()=>{if(++allocated===failAt)return null;const handle={id:allocated};live.add(handle);return handle;};
 const gl=new Proxy({getParameter:()=>4096,getExtension:()=>null,getContextAttributes:()=>({antialias:true}),getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>0,
 createShader:create,createProgram:create,createBuffer:create,createTexture:create,deleteShader:h=>live.delete(h),deleteProgram:h=>live.delete(h),deleteBuffer:h=>live.delete(h),deleteTexture:h=>live.delete(h)}, {get:(o,k)=>k in o?o[k]:()=>{}});
 const canvas={getContext:()=>gl,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const window={SolarSurfaceStyle:require('../src/surface-style.js')};vm.runInNewContext(fs.readFileSync('src/surface.js','utf8'),{window,performance,AbortController});
 return {make:()=>new window.SolarSurface.DirectRenderer(canvas),live,listeners,setFailure:n=>{allocated=0;failAt=n;}};
}
test('every initial shader, program, buffer and fallback texture allocation failure releases resources and listeners',()=>{
 for(let failure=1;failure<=14;failure++){const f=fixture(failure);assert.throws(f.make,/allocation failed/);assert.equal(f.live.size,0,'resources at '+failure);assert.equal(f.listeners.size,0,'listeners at '+failure);}
});
test('restore failure stays blocked and a subsequent successful restoration is usable',()=>{
 const f=fixture(Infinity),r=f.make();const epoch=r.contextEpoch;
 f.listeners.get('webglcontextlost')({preventDefault(){}});f.live.clear();assert.equal(r.contextEpoch,epoch+1);
 f.setFailure(14);assert.doesNotThrow(()=>f.listeners.get('webglcontextrestored')());assert.equal(r.contextLost,true);assert.equal(r.begin(),false);assert.equal(f.live.size,0);
 f.setFailure(Infinity);f.listeners.get('webglcontextrestored')();assert.equal(r.contextLost,false);r.dispose();assert.equal(f.live.size,0);assert.equal(f.listeners.size,0);
});
