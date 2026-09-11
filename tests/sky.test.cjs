'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../src/sky.js'),'utf8'),sandbox);
const Sky=sandbox.window.SolarSky;
function texture(){
 const width=8,height=4,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([x*30,y*70,25+x*8+y*9,255],(y*width+x)*4);
 return {width,height,data};
}
function sample(tex,u,v){const out=new Float64Array(3);Sky.samplePanorama(tex,u,v,out);return [...out];}
const near=(a,b,tol=1e-8)=>assert.ok(a.every((v,i)=>Math.abs(v-b[i])<tol),`${a} != ${b}`);
test('Browser title is exactly Solar Time, independent of the release label',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 assert.match(html,/<title>Solar Time<\/title>/);
 assert.doesNotMatch(html,/<title>[^<]*태양계/);
});
test('Longitude sampler agrees at every periodic copy, including negative coordinates',()=>{
 const tex=texture();
 for(const u of [-1.51,-.5,-1e-8,0,.2,.9999999,1,7.2])for(const v of [0,.13,.5,.9,1])near(sample(tex,u,v),sample(tex,u+3,v),1e-9);
});
test('The meridian interpolates opposite texels; it never snaps to the first column',()=>{
 const tex=texture();near(sample(tex,0,.5),[105,105,66.5]);
 near(sample(tex,1-1e-8,.5),sample(tex,1+1e-8,.5),.0001);
});
test('Pixel-centre convention preserves exact texels without a half-pixel shift',()=>{
 const tex=texture();for(let y=0;y<tex.height;y++)for(let x=0;x<tex.width;x++)near(sample(tex,(x+.5)/tex.width,(y+.5)/tex.height),[x*30,y*70,25+x*8+y*9]);
});
test('Latitude clamps at poles rather than wrapping the north pole to the south pole',()=>{
 const tex=texture();near(sample(tex,.3,-1),sample(tex,.3,0));near(sample(tex,.3,2),sample(tex,.3,1));
 assert.notDeepEqual(sample(tex,.3,0),sample(tex,.3,1));
});
test('Single-colour pole rows have one result for every longitude',()=>{
 const tex=texture();for(let x=0;x<tex.width;x++){tex.data.set([1,2,4,255],x*4);tex.data.set([4,3,2,255],((tex.height-1)*tex.width+x)*4);}
 for(let i=0;i<=360;i++){near(sample(tex,i/360,0),[1,2,4]);near(sample(tex,i/360,1),[4,3,2]);}
});
test('GPU retains repeat-S / clamp-T / linear filtering and guards the polar atan',()=>{
 const source=fs.readFileSync(require.resolve('../src/sky.js'),'utf8');
 for(const fragment of ['g.TEXTURE_WRAP_S,g.REPEAT','g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE','g.TEXTURE_MIN_FILTER,g.LINEAR','g.TEXTURE_MAG_FILTER,g.LINEAR','length(q.xy)>0.0000001'])assert.ok(source.includes(fragment));
});
