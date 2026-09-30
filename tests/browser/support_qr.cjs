/* Focused, offline check using the real markup, CSS and app binding block.
 * The caller owns the temporary browser; no live payment links are followed. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
module.exports=async function verifySupportQr({root,evaluate,send,session}){
  const read=file=>fs.readFileSync(path.join(root,file),'utf8');
  const html=read('index.html'),app=read('src/app.js');
  let markup=html.slice(html.indexOf('<dialog id="help-dialog"'),html.indexOf('<dialog id="site-policy-dialog"'));
  for(const provider of ['kakao-pay','wechat-pay'])markup=markup.replace('src="'+provider+'-qr.svg"','src="data:image/svg+xml;base64,'+Buffer.from(read(provider+'-qr.svg')).toString('base64')+'"');
  await evaluate('document.head.innerHTML="";document.body.innerHTML='+JSON.stringify(markup)+';const style=document.createElement("style");style.textContent='+JSON.stringify(read('styles.css')+'\n'+read('src/runtime-optimizations.css'))+';document.head.append(style);');
  await evaluate(read('src/ui-runtime.js'));
  const bindings=app.slice(app.indexOf("for(const provider of ['kakao-pay','wechat-pay'])"),app.indexOf('const updateHelpScrollCues=bindScrollCues(helpDialog,helpScroll)'));
  assert.ok(bindings.length>100&&bindings.length<2000);
  await evaluate('(()=>{const $=id=>document.getElementById(id),UI=SolarModules.UI,showFading=UI.show,hideFading=UI.hide,bindScrollCues=UI.bindScrollCues;'+bindings+'const help=$("help-dialog");UI.bindDialog(help,()=>UI.hide(help,()=>help.close()),{backdrop:false});UI.show(help,()=>help.show());})();');
  const results=[];
  try{
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},session);
    for(const [width,height] of [[1280,800],[390,844],[320,568]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
      const row=await evaluate(`(async()=>{const scroll=document.getElementById('help-scroll');scroll.scrollTop=scroll.scrollHeight;await new Promise(requestAnimationFrame);const links=[...document.querySelectorAll('.support-options .support-link')],bounds=scroll.getBoundingClientRect();return {items:links.map(el=>({text:el.textContent,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})),left:bounds.left,right:bounds.right};})()`);
      for(const item of row.items)assert.ok(item.left>=row.left-1&&item.right<=row.right+1,`support row overflow at ${width}: ${JSON.stringify(row)}`);
      assert.deepEqual(row.items.map(x=>x.text),['Buy Me a Coffee','WeChat','카카오페이','크티']);
      const cards=[];
      for(const provider of ['kakao-pay','wechat-pay']){
        const card=await evaluate(`(async()=>{const provider=${JSON.stringify(provider)},dialog=document.getElementById(provider+'-dialog');document.getElementById(provider+'-link').click();await dialog.querySelector('img').decode();await new Promise(requestAnimationFrame);const box=dialog.getBoundingClientRect(),img=dialog.querySelector('img').getBoundingClientRect(),style=getComputedStyle(dialog);return {open:dialog.open,left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,imgWidth:img.width,imgInside:img.left>=box.left&&img.right<=box.right&&img.top>=box.top&&img.bottom<=box.bottom,background:style.backgroundColor,border:style.borderRadius,blur:style.backdropFilter};})()`);
        assert.ok(card.open&&card.imgInside&&card.left>=0&&card.right<=width&&card.top>=0&&card.bottom<=height);
        cards.push(card);
        if(width===1280&&provider==='wechat-pay'){
          await evaluate('new Promise(resolve=>setTimeout(resolve,1100))');
          const shot=await send('Page.captureScreenshot',{format:'png'},session);
          fs.writeFileSync(path.join(os.tmpdir(),'solartime-wechat-qr-local.png'),Buffer.from(shot.data,'base64'));
        }
        await evaluate(`document.getElementById('${provider}-dialog').querySelector('.close-button').click()`);
        assert.equal(await evaluate(`document.getElementById('${provider}-dialog').open`),false);
        assert.equal(await evaluate('document.activeElement.id'),provider+'-link');
        assert.equal(await evaluate("document.getElementById('help-dialog').open"),true,'QR close must retain help');
      }
      for(const key of ['width','imgWidth','background','border','blur'])assert.equal(cards[0][key],cards[1][key],key+' must match Kakao');
      results.push({width,cards});
    }
    // Exercise native Escape and backdrop click, leaving the parent help open.
    await evaluate("document.getElementById('wechat-pay-link').click()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
    assert.equal(await evaluate("document.getElementById('wechat-pay-dialog').open"),false);
    await evaluate("document.getElementById('wechat-pay-link').click()");
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:1,y:1,button:'left',clickCount:1},session);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1,y:1,button:'left',clickCount:1},session);
    assert.equal(await evaluate("document.getElementById('wechat-pay-dialog').open"),false);
    assert.equal(await evaluate("document.getElementById('help-dialog').open"),true);
    // Without reduced motion, the shared fade must finish before focus returns.
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]},session);
    await evaluate("document.getElementById('wechat-pay-link').click();document.getElementById('wechat-pay-dialog').querySelector('.close-button').click()");
    assert.equal(await evaluate("document.getElementById('wechat-pay-dialog').classList.contains('ui-fade-closing')"),true);
    await evaluate('new Promise(resolve=>setTimeout(resolve,1100))');
    assert.equal(await evaluate("document.getElementById('wechat-pay-dialog').open"),false);
    assert.equal(await evaluate('document.activeElement.id'),'wechat-pay-link');
    return {viewports:results,dismissal:'close, Escape, backdrop, fade, focus return passed'};
  }finally{await evaluate('SolarModules.UI.dispose()');await send('Emulation.clearDeviceMetricsOverride',{},session);}
};
