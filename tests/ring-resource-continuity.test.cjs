const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={SolarAstro:require('../src/astro.js')};for(const file of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync(require.resolve('../src/'+file+'.js'),'utf8'),{window,performance:{now:()=>0}});
const options={frame:{u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}},radius:100,width:800,height:600,screen:{x:400,y:300},deferPreparation:true};
test('a retained ring transfers compiled resources and atlas fade age without restarting',()=>{
 for(const elapsed of [.2,5]){const donor=new window.SolarRingTour(options);donor.preparationReady=true;donor.flightField.routeKind='orbit';donor.visualAge=30;donor.resources={ready:true,atlas:{},atlasAge:30-elapsed};const resources=donor.resources;const next=new window.SolarRingTour({...options,prepared:donor});assert.equal(next.resources,resources);assert.equal(donor.disposed,true);assert.ok(Math.abs(-next.resources.atlasAge-elapsed)<1e-8);assert.equal(next.preparationReady,true);}
});


test('pending atlas requests cancel on disposal but survive ownership transfer',async()=>{
 for(const transfer of [false,true]){
  const assignments=[],window={SolarAstro:require('../src/astro.js')};
  class Image{set src(value){assignments.push(value);}}
  for(const file of ['surface-style','ring-tour'])vm.runInNewContext(fs.readFileSync(require.resolve('../src/'+file+'.js'),'utf8'),{window,Image,performance:{now:()=>0}});
  const donor=new window.SolarRingTour({...options,atlasUrl:'https://example.test/debris.webp'});
  let owner=donor;
  if(transfer){donor.preparationReady=true;owner=new window.SolarRingTour({...options,prepared:donor});assert.equal(owner.atlasRequest,donor.atlasRequest);donor.dispose();}
  else donor.dispose();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(assignments.filter(value=>value!=='').length,transfer?1:0);
  if(transfer){assert.equal(owner.atlasRequest.cancelled,false);owner.dispose();assert.equal(assignments.at(-1),'');}
 }
});
