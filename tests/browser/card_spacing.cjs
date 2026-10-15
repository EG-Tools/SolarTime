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
    await send('Page.navigate',{url},session);await ready();
    const results=[];
    for(const [width,height] of [[1280,800],[390,844]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600},session);
      results.push(await evaluate(`(()=>{
        const $=id=>document.getElementById(id),rect=e=>e.getBoundingClientRect();
        $('settings-panel').hidden=false;$('body-panel').hidden=false;
        const gap=(slider,label)=>rect(label).top+rect(label).height/2-rect(slider).bottom;
        const ref=gap($('clock-size'),document.querySelector('label[for="clock-font"]'));
        const rowGap=(a,b)=>rect(b).top+rect(b).height/2-rect(a).top-rect(a).height/2;
        const refRows=rowGap(document.querySelector('label[for="show-clock"]'),document.querySelector('label[for="show-seconds"]'));
        const rows=[];
        for(const [body,slider,label] of [['sun','satellite-orbit-slider','show-activity'],['earth','earth-cloud-amount','earth-night-lights']]){
          document.querySelector('#planet-nav [data-body="'+body+'"]').click();rows.push({body,gap:gap($(slider),document.querySelector('label[for="'+label+'"]'))});
        }
        $('body-panel').classList.add('sky-feature');$('sky-feature-display-control').hidden=false;$('sky-solar-display-control').hidden=false;
        const sky=rowGap($('sky-feature-display-label'),document.querySelector('label[for="show-sky-solar"]'));
        $('body-panel').classList.remove('sky-feature');
        return {ref,refRows,rows,sky};
      })()`));
    }
    for(const result of results){for(const row of result.rows)assert.equal(row.gap,result.ref,row.body+' slider to label');assert.equal(result.sky,result.refRows,'constellation switch spacing');}
    return results;
  }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
