const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js')};for(const file of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync(require.resolve('../src/'+file+'.js'),'utf8'),{window,performance:{now:()=>0}});
const options={frame:{u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}},radius:100,width:800,height:600,screen:{x:400,y:300},deferPreparation:true};

test('cached drift preserves seeded motion, including reverse-time sampling',()=>{
 for(const fixture of require('./fixtures/ring-drift-reference.json')){
  const tour=new window.SolarRingTour({...options,seed:fixture.seed});
  fixture.ages.forEach((age,i)=>tour.driftWave(age).forEach((value,k)=>assert.ok(Math.abs(value-fixture.waves[i][k])<1e-12)));
  for(let i=0;i<1000;i++)tour.driftWave(i*4);
  assert.ok(tour.driftBags.size<=2);assert.equal(tour.driftProfiles.length,5);
  fixture.ages.forEach((age,i)=>tour.driftWave(age).forEach((value,k)=>assert.ok(Math.abs(value-fixture.waves[i][k])<1e-12)));
 }
});
