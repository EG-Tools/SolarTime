'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};for(const name of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync('src/'+name+'.js','utf8'),{window,performance,AbortController});
function fixture(parallel=true){
 const stats={linked:0,deletedPrograms:0,deletedShaders:0},state={ready:false};let id=0;
 const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,ACTIVE_ATTRIBUTES:4,
 isContextLost:()=>false,getExtension:name=>name==='KHR_parallel_shader_compile'?(parallel?{COMPLETION_STATUS_KHR:5}:null):{},
 createShader:()=>++id,shaderSource(){},compileShader(){},createProgram:()=>++id,attachShader(){},linkProgram(){},
 getProgramParameter(p,key){if(key===5)return state.ready;if(key===3){assert.ok(state.ready||!parallel,'link status must not block an unfinished async compile');stats.linked++;return true;}return 0;},
 getUniformLocation:()=>0,deleteShader(){stats.deletedShaders++;},deleteProgram(){stats.deletedPrograms++;},
 createBuffer:()=>++id,bindBuffer(){},bufferData(){},deleteBuffer(){},deleteTexture(){}};
 const tour=Object.assign(Object.create(window.SolarRingTour.prototype),{preparationReady:true,flightField:{points:[]},instanceLayers:[],instanceOrder:[]});
 return {tour,gpu:{gl},stats,state};
}
test('ring shader polling yields until completion without checking link status',()=>{
 const {tour,gpu,stats,state}=fixture();assert.equal(tour.prepare(gpu),false);assert.equal(stats.linked,0);
 assert.equal(tour.prepare(gpu),false);assert.equal(stats.linked,0);
 state.ready=true;assert.equal(tour.prepare(gpu),true);assert.equal(tour.resources.ready,true);assert.equal(stats.linked,3);
 tour.dispose();assert.equal(stats.deletedPrograms,3);assert.equal(stats.deletedShaders,6);
});
test('cancelling pending compilation releases its shaders and program',()=>{
 const {tour,gpu,stats}=fixture();tour.prepare(gpu);tour.dispose();tour.dispose();
 assert.equal(stats.deletedPrograms,1);assert.equal(stats.deletedShaders,2);assert.equal(tour.scenePreparation,null);
});
test('unsupported parallel compilation keeps the synchronous fallback usable',()=>{
 const {tour,gpu,stats}=fixture(false);assert.equal(tour.prepare(gpu),true);assert.equal(tour.resources.ready,true);assert.equal(stats.linked,3);tour.dispose();
});

test('atlas shares staged uploader and only publishes after finalization',async()=>{
 const {tour,gpu}=fixture(),r=tour.resources={gl:gpu.gl};let finish,finalize;const texture={};
 Object.assign(gpu.gl,{createTexture:()=>texture,activeTexture(){},bindTexture(){},texParameteri(){},generateMipmap(){}});
 tour.atlasImage={complete:true,naturalWidth:1024,naturalHeight:512};
 gpu.uploadTexturePixels=()=>new Promise(resolve=>finish=resolve);gpu.waitForTextureUpload=()=>new Promise(resolve=>finalize=resolve);gpu.resetTextureBindings=()=>{};
 tour.prepareAtlas(gpu);const pending=r.atlasPending;tour.prepareAtlas(gpu);assert.equal(r.atlasPending,pending);assert.equal(r.atlas,undefined);
 finish(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(r.atlas,undefined);finalize();await pending;
 assert.equal(r.atlas,texture);assert.equal(r.atlasPending,null);
});
test('disposing during atlas upload cancels work and never publishes it',async()=>{
 const {tour,gpu}=fixture(),r=tour.resources={gl:gpu.gl};let deleted=0;
 Object.assign(gpu.gl,{createTexture:()=>({}),deleteTexture:()=>deleted++});tour.atlasImage={complete:true,naturalWidth:1024,naturalHeight:512};
 gpu.uploadTexturePixels=(_t,_i,_w,_h,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));gpu.waitForTextureUpload=()=>{};
 tour.prepareAtlas(gpu);const pending=r.atlasPending;tour.dispose();await pending;assert.equal(deleted,1);assert.equal(r.atlas,undefined);assert.equal(r.atlasBytes,0);
});


test('only a real context epoch change rebuilds GPU resources while preserving CPU scene',()=>{
 const {tour,gpu,state}=fixture();state.ready=true;gpu.contextEpoch=0;tour.points=new Float32Array([1,2,3]);const points=tour.points;
 assert.equal(tour.prepare(gpu),true);const resources=tour.resources;
 gpu.generation=123;assert.equal(tour.prepare(gpu),true);assert.equal(tour.resources,resources);
 gpu.contextLost=true;assert.equal(tour.prepare(gpu),false);gpu.contextLost=false;gpu.contextEpoch++;
 state.ready=false;assert.equal(tour.prepare(gpu),false);assert.notEqual(tour.resources,resources);assert.equal(tour.points,points);assert.equal(tour.disposed,undefined);
 state.ready=true;assert.equal(tour.prepare(gpu),true);assert.equal(tour.resources.contextEpoch,1);tour.dispose();
});
