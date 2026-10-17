'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

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
  async function ready(){const end=Date.now()+35000;while(!await evaluate('!!window.SolarTime&&SolarTime.getState().opening===false')){if(Date.now()>end)throw Error('Local particle app did not become ready');await delay(100);}}
  try{
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);await send('Page.navigate',{url},session);await ready();
    await evaluate(fs.readFileSync(path.join(root,'tests/browser/particle-cost-probe.js'),'utf8'));
    await evaluate("document.querySelector('[data-opening=default]').click()");
    await delay(16000);
    const result=await evaluate('__particleCostProbe.finish()');assert.ok(result.frames>0);return result;
  }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
