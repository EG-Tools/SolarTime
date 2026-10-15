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
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
    await send('Page.navigate',{url},session);await ready();
    await evaluate("document.getElementById('cookie-reject').click()");
    const rows=[];
    for(const lang of ['kor','de','ru','fr','hi']){
      await evaluate(`SolarTime.setLanguage('${lang}')`);
      const row=await evaluate(`(()=>{const $=id=>document.getElementById(id);$('settings-button').click();const a=$('reset-defaults').getBoundingClientRect(),b=$('review-cookie-consent').getBoundingClientRect();$('language-toggle').click();const names=[...$('language-menu').querySelectorAll('button span')];const fits=names.every(n=>n.scrollWidth<=n.clientWidth+1);$('language-menu').querySelector('[data-language="en"]').click();const stays=$('language-toggle').getAttribute('aria-expanded')==='true';$('language-toggle').click();const closes=$('language-toggle').getAttribute('aria-expanded')==='false';$('opening-toggle').click();$('opening-menu').querySelector('[data-opening="saturn"]').click();const openingStays=$('opening-toggle').getAttribute('aria-expanded')==='true';$('opening-control').dispatchEvent(new PointerEvent('pointerleave',{pointerType:'mouse'}));const leaves=$('opening-toggle').getAttribute('aria-expanded')==='false';return {row:Math.abs(a.top-b.top)<1,equal:Math.abs(a.width-b.width)<1,fits,stays,closes,openingStays,leaves};})()`);
      assert.deepEqual(row,{row:true,equal:true,fits:true,stays:true,closes:true,openingStays:true,leaves:true});rows.push({lang,...row});
    }
    await evaluate("document.getElementById('opening-toggle').click();document.getElementById('opening-menu').querySelector('[data-opening=default]').click();document.getElementById('opening-play').click()");
    assert.equal(await evaluate('SolarTime.getState().opening'),true);
    return {rows,playStartsOpening:true};
  }finally{await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
};
