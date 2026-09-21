/* Refresh the checked-in NASA/JPL Horizons vectors used by offline tests. */
'use strict';

const fs=require('node:fs');
const path=require('node:path');

const API='https://ssd.jpl.nasa.gov/api/horizons.api';
const root=path.resolve(__dirname,'..');
const output=path.join(root,'tests','fixtures','horizons-reference.json');
const dates=Object.freeze([
  '1800-01-01T12:00:00.000Z',
  '1900-01-01T12:00:00.000Z',
  '2000-01-01T12:00:00.000Z',
  '2026-09-21T00:00:00.000Z',
  '2049-12-31T00:00:00.000Z',
  '2199-12-31T00:00:00.000Z',
  '2492-05-06T06:00:00.000Z'
]);
const targets=Object.freeze([
  ['mercury','199','500@10'],['venus','299','500@10'],['earth','399','500@10'],
  ['mars','499','500@10'],['jupiter','5','500@10'],['saturn','6','500@10'],
  ['uranus','7','500@10'],['neptune','8','500@10'],['pluto','9','500@10'],
  ['moon','301','500@399'],['europa','502','500@599',dates.slice(0,-1)]
]);

const julianDate=iso=>Date.parse(iso)/86400000+2440587.5;
function requestUrl(command,center,queryDates){
  const url=new URL(API),params={
    format:'json',COMMAND:`'${command}'`,OBJ_DATA:"'NO'",MAKE_EPHEM:"'YES'",
    EPHEM_TYPE:"'VECTORS'",CENTER:`'${center}'`,TLIST:`'${queryDates.map(julianDate).join(',')}'`,
    TLIST_TYPE:"'JD'",REF_PLANE:"'ECLIPTIC'",REF_SYSTEM:"'ICRF'",OUT_UNITS:"'AU-D'",
    VEC_TABLE:"'1'",VEC_CORR:"'NONE'",CSV_FORMAT:"'YES'"
  };
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return url;
}
function parseVectors(result,name,queryDates){
  const section=result.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/);
  if(!section)throw new Error(`Horizons response for ${name} has no vector section.`);
  const vectors=section[1].trim().split(/\r?\n/).filter(Boolean).map((line,index)=>{
    const fields=line.split(',').map(value=>value.trim());
    if(fields.length<5)throw new Error(`Malformed Horizons vector for ${name}: ${line}`);
    const [jd,,x,y,z]=fields,vector={iso:queryDates[index],jd:Number(jd),x:Number(x),y:Number(y),z:Number(z)};
    if(![vector.jd,vector.x,vector.y,vector.z].every(Number.isFinite))throw new Error(`Non-finite Horizons vector for ${name}: ${line}`);
    return vector;
  });
  if(vectors.length!==queryDates.length)throw new Error(`Expected ${queryDates.length} ${name} vectors, received ${vectors.length}.`);
  return vectors;
}
async function query([name,command,center,targetDates=dates]){
  const response=await fetch(requestUrl(command,center,targetDates),{headers:{accept:'application/json','user-agent':'SolarTime-Horizons-Reference/1.0'}});
  if(!response.ok)throw new Error(`Horizons ${name} request failed: HTTP ${response.status}`);
  const payload=await response.json();
  if(payload.error)throw new Error(`Horizons ${name}: ${payload.error}`);
  return [name,{command,center,vectors:parseVectors(payload.result,name,targetDates)}];
}

async function main(){
  const entries=[];
  // Keep requests sequential so the reference refresh remains friendly to the public API.
  for(const target of targets)entries.push(await query(target));
  const fixture={
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    source:{name:'NASA/JPL Horizons',url:API,referenceFrame:'Ecliptic of J2000.0',units:'AU',corrections:'geometric / none'},
    dates,
    targets:Object.fromEntries(entries)
  };
  fs.writeFileSync(output,JSON.stringify(fixture,null,2)+'\n');
  const count=entries.reduce((sum,[,target])=>sum+target.vectors.length,0);
  process.stdout.write(`Updated ${path.relative(root,output)} with ${count} official vectors.\n`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
