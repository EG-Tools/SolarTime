const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js')};for(const file of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync(require.resolve('../src/'+file+'.js'),'utf8'),{window,performance:{now:()=>0}});
const options={frame:{u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}},radius:100,width:800,height:600,screen:{x:400,y:300},deferPreparation:true};

test('travel lens is limited to 60 degrees including wheel zoom',()=>{
 const tour=new window.SolarRingTour(options);assert.equal(tour.fov,60);tour.zoom(.01);assert.equal(tour.fov,60);tour.zoom(100);assert.equal(tour.fov,35);
});
test('wide inherited lens blends continuously into travel limit',()=>{
 const source=new window.SolarRingTour(options);const startPose={...source.startPose,fov:95,perspective:1};const tour=new window.SolarRingTour({...options,startPose});assert.equal(tour.fov,60);assert.equal(tour.rawEntryPose(0).fov,95);let previous=95;for(let i=1;i<=100;i++){const fov=tour.rawEntryPose(i/10).fov;assert.ok(fov<=previous+1e-9&&fov>=60);previous=fov;}assert.equal(previous,60);
});
