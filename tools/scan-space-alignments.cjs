/* Reproduce Sun-centered five-or-more-planet line candidates. Read-only. */
'use strict';
const A=require('../src/astro.js');

const threshold=Number(process.argv[2]||2);
if(!Number.isFinite(threshold)||threshold<=0||threshold>=30)throw new RangeError('Threshold must be between 0 and 30 degrees.');
const planets=A.BODIES.filter(body=>body.id!=='pluto');
const unit=point=>{const n=Math.hypot(point.x,point.y,point.z)||1;return {x:point.x/n,y:point.y/n,z:point.z/n};};
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const axisBetween=(a,b)=>{const sign=dot(a,b)<0?-1:1,x=a.x+sign*b.x,y=a.y+sign*b.y,z=a.z+sign*b.z,n=Math.hypot(x,y,z);return n>1e-12?{x:x/n,y:y/n,z:z/n}:a;};
const distance=(axis,vector)=>Math.acos(Math.max(-1,Math.min(1,Math.abs(dot(axis,vector)))))/A.DEG;
function physical(body,ms){const elements=A.elementsAt(body,ms),E=A.eccentricAnomaly(elements.M,elements.e);return A.pointOnOrbit(elements,E);}
function bestAt(ms){
  const vectors=planets.map(body=>({id:body.id,vector:unit(physical(body,ms))})),axes=vectors.map(item=>item.vector);
  for(let i=0;i<vectors.length;i++)for(let j=i+1;j<vectors.length;j++)axes.push(axisBetween(vectors[i].vector,vectors[j].vector));
  let best=null;
  for(let axis of axes){
    for(let refine=0;refine<2;refine++){
      const included=vectors.filter(item=>distance(axis,item.vector)<=threshold);
      if(included.length<2)break;
      const anchor=included[0].vector,sum={x:0,y:0,z:0};
      for(const item of included){const sign=dot(anchor,item.vector)<0?-1:1;sum.x+=sign*item.vector.x;sum.y+=sign*item.vector.y;sum.z+=sign*item.vector.z;}
      const n=Math.hypot(sum.x,sum.y,sum.z)||1;axis={x:sum.x/n,y:sum.y/n,z:sum.z/n};
    }
    const ranked=vectors.map(item=>({id:item.id,error:distance(axis,item.vector)})).filter(item=>item.error<=threshold).sort((a,b)=>a.error-b.error);
    if(ranked.length<5)continue;
    const max=Math.max(...ranked.map(item=>item.error)),rms=Math.sqrt(ranked.reduce((sum,item)=>sum+item.error*item.error,0)/ranked.length);
    const candidate={ms,count:ranked.length,max,rms,planets:ranked.map(item=>item.id)};
    if(!best||candidate.count>best.count||(candidate.count===best.count&&(candidate.max<best.max-1e-9||Math.abs(candidate.max-best.max)<1e-9&&candidate.rms<best.rms)))best=candidate;
  }
  return best;
}

let cluster=null;const events=[];
function finish(){if(cluster){events.push(cluster.best);cluster=null;}}
for(let ms=A.MIN_TIME;ms<=A.MAX_TIME;ms+=A.DAY){
  const candidate=bestAt(ms);
  if(!candidate){finish();continue;}
  if(!cluster||ms-cluster.last>A.DAY*1.5){finish();cluster={last:ms,best:candidate};}
  else{cluster.last=ms;if(candidate.count>cluster.best.count||(candidate.count===cluster.best.count&&(candidate.max<cluster.best.max||candidate.max===cluster.best.max&&candidate.rms<cluster.best.rms)))cluster.best=candidate;}
}
finish();
console.log(JSON.stringify({definition:`five or more major planets within ${threshold} degrees of one heliocentric 3D diameter`,threshold,count:events.length,events:events.map(event=>({date:new Date(event.ms).toISOString().slice(0,10),count:event.count,max:Number(event.max.toFixed(3)),rms:Number(event.rms.toFixed(3)),planets:event.planets}))},null,2));
