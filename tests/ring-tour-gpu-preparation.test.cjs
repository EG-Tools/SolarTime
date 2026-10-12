'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};for(const name of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync('src/'+name+'.js','utf8'),{window,performance});
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
