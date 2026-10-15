'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');

module.exports=async({root,evaluate,send,session})=>{
  const server=http.createServer((req,res)=>{
    let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch(_){res.writeHead(400).end();return;}
    if(file===root)file=path.join(root,'index.html');
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),url='http://127.0.0.1:'+server.address().port+'/';
  const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
  async function ready(){const end=Date.now()+35000;while(!await evaluate('!!window.SolarTime&&SolarTime.getState().opening===false')){if(Date.now()>end)throw Error('Local alignment app did not become ready');await delay(100);}}
  const snapshot=()=>evaluate(`(()=>{const r=SolarTime.renderer;return {resetDisabled:document.getElementById('alignment-reset').disabled,enabled:r.options.alignmentGuideVisible,date:document.getElementById('alignment-date').textContent,event:r.alignmentGuide?.ms,hidden:document.getElementById('alignment-control').hidden};})()`);
  try{
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);await send('Page.navigate',{url},session);await ready();
    await evaluate(`(()=>{document.getElementById('cookie-reject').click();const r=SolarTime.renderer,draw=r.drawFlightParticles;window.__particleCosts=[];r.drawFlightParticles=function(c,field,project){let projection=0,count=0;const start=performance.now();const result=draw.call(this,c,field,(...args)=>{const t=performance.now(),q=project(...args);projection+=performance.now()-t;count++;return q;});window.__particleCosts.push({total:performance.now()-start,projection,count});return result;};document.getElementById('opening-play').click();})()`);
    await delay(16000);
    return await evaluate(`(()=>{const rows=window.__particleCosts.filter(x=>x.count>0),stat=key=>{const a=rows.map(x=>key==='canvas'?Math.max(0,x.total-x.projection):x[key]).sort((a,b)=>a-b);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};return {frames:rows.length,projectionMs:stat('projection'),drawAndLoopMs:stat('canvas'),totalMs:stat('total'),projectedCount:stat('count')};})()`);
  }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
