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
  const snapshot=()=>evaluate(`(()=>{const r=SolarTime.renderer,input=document.getElementById('show-alignment');return {checked:input.checked,enabled:r.options.alignmentGuideVisible,saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')||'{}').alignmentGuideVisible,date:document.getElementById('alignment-date').textContent,event:r.alignmentGuide?.ms,hidden:document.getElementById('alignment-control').hidden};})()`);
  try{
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);
    await send('Page.navigate',{url},session);await ready();
    await evaluate(`(async()=>{await SolarTime.setLanguage('kor');document.getElementById('cookie-reject').click();SolarTime.renderer.setAutoRotate(0);document.querySelector('#planet-nav [data-body="sun"]').click();document.getElementById('alignment-next').click();})()`);
    const initial=await snapshot();assert.equal(initial.checked,true);assert.equal(initial.hidden,false);assert.ok(initial.event&&initial.date!=='—');
    await evaluate(`document.getElementById('show-alignment').click()`);
    const off=await snapshot();assert.equal(off.enabled,false);assert.equal(off.checked,false);assert.equal(off.saved,false);assert.equal(off.event,initial.event);assert.equal(off.date,initial.date);
    await evaluate(`document.getElementById('alignment-next').click()`);
    const nextOff=await snapshot();assert.ok(nextOff.event>off.event);assert.equal(nextOff.enabled,false);assert.equal(nextOff.checked,false);
    await evaluate(`document.getElementById('show-alignment').click()`);
    const on=await snapshot();assert.equal(on.enabled,true);assert.equal(on.saved,true);assert.equal(on.date,nextOff.date);assert.equal(on.event,nextOff.event);
    await evaluate(`document.getElementById('show-alignment').click();document.querySelector('#planet-nav [data-body="earth"]').click()`);
    assert.equal((await snapshot()).hidden,true);
    await evaluate(`document.querySelector('#planet-nav [data-body="sun"]').click()`);
    assert.equal((await snapshot()).checked,false);
    const layouts=[];
    for(const [width,height] of [[1280,800],[390,844]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600},session);await delay(400);
      const layout=await evaluate(`(()=>{const box=document.getElementById('alignment-control');box.scrollIntoView({block:'center'});const label=box.querySelector('label').getBoundingClientRect(),toggle=box.querySelector('input').getBoundingClientRect(),nav=box.querySelector('.eclipse-navigation').getBoundingClientRect(),rect=box.getBoundingClientRect();return {below:nav.top>=Math.max(label.bottom,toggle.bottom),beside:toggle.left>=label.right,contained:nav.left>=rect.left&&nav.right<=rect.right,switchVisible:toggle.width>0&&toggle.height>0,centered:Math.abs(label.left+label.width/2-rect.left-rect.width/2)<1};})()`);
      assert.deepEqual(layout,{below:true,beside:true,contained:true,switchVisible:true,centered:true});layouts.push({width,height,...layout});
    }
    await delay(250);
    const preview=path.join(os.tmpdir(),'solartime-alignment-toggle.png');fs.writeFileSync(preview,Buffer.from((await send('Page.captureScreenshot',{format:'png'},session)).data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false},session);
    await send('Page.reload',{},session);await delay(150);await ready();
    await evaluate(`SolarTime.renderer.setAutoRotate(0);document.querySelector('#planet-nav [data-body="sun"]').click()`);
    const restored=await snapshot();assert.equal(restored.checked,false);assert.equal(restored.enabled,false);
    await evaluate(`document.getElementById('body-close').click();SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot())`);await delay(300);
    const camera=()=>evaluate(`({camera:SolarTime.renderer.cameraSnapshot(),readout:document.getElementById('zoom-value').textContent,label:document.getElementById('zoom-value').getAttribute('aria-label')})`);
    const before=await camera();
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:500,y:350,deltaX:0,deltaY:-120},session);await delay(400);
    const wheel=await camera();assert.ok(wheel.camera.dolly>before.camera.dolly);close(wheel.camera.zoom,before.camera.zoom);assert.equal(wheel.readout,before.readout);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',x:500,y:350,button:'right',buttons:2,clickCount:1},session);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:500,y:260,button:'right',buttons:2},session);
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:500,y:260,button:'right',buttons:0,clickCount:1},session);await delay(150);
    const right=await camera();assert.ok(right.camera.zoom>wheel.camera.zoom);close(right.camera.dolly,wheel.camera.dolly);assert.notEqual(right.readout,wheel.readout);assert.equal(right.readout,right.camera.zoom.toFixed(1)+'×');
    const shortcuts=await evaluate(`(()=>{
      const r=SolarTime.renderer,button=document.getElementById('camera-mode-toggle'),input=document.createElement('input');document.body.append(input);
      const snapshot=()=>({actual:r.options.actualScale,checked:document.getElementById('actual-scale').checked,pressed:button.getAttribute('aria-pressed'),saved:JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).actualScale,title:button.title,zoom:r.camera.zoom,dolly:r.camera.dolly});
      const press=(key,code,extra={},target=button)=>target.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true,...extra}));
      const rows=[snapshot()];
      try{
        press('+','Equal',{shiftKey:true});rows.push(snapshot());
        for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true}]){press('+','Equal',extra);rows.push(snapshot());}
        press('+','Equal',{},input);rows.push(snapshot());
        press('+','NumpadAdd');rows.push(snapshot());
        press('=','Equal');rows.push(snapshot());
        button.click();rows.push(snapshot());
        return {rows,label:document.querySelector('[data-i18n="actualScaleShortcut"]').textContent,key:button.getAttribute('aria-keyshortcuts')};
      }finally{input.remove();}
    })()`);
    assert.equal(shortcuts.label,'실제 비율');assert.equal(shortcuts.key,'+');
    const expected=[false,true,true,true,true,true,true,true,false,true,false];
    assert.equal(shortcuts.rows.length,expected.length);
    shortcuts.rows.forEach((row,i)=>{
      assert.equal(row.actual,expected[i]);assert.equal(row.checked,expected[i]);assert.equal(row.pressed,String(expected[i]));assert.equal(row.saved,expected[i]);assert.ok(row.title.endsWith(' (+)'));
      close(row.zoom,shortcuts.rows[0].zoom);close(row.dolly,shortcuts.rows[0].dolly);
    });
    await evaluate(`document.getElementById('reset-defaults').click();document.getElementById('reset-defaults-yes').click()`);
    const deadline=Date.now()+5000;while((await snapshot()).enabled!==true){if(Date.now()>deadline)throw Error('Reset did not restore alignment visibility');await delay(50);}
    const reset=await snapshot();assert.equal(reset.checked,true);assert.equal(reset.saved,true);assert.equal(reset.event,undefined);
    return {initial,off,nextOff,on,restored,reset,layouts,preview,controls:{before,wheel,right},shortcuts};
  }finally{
    await send('Page.navigate',{url:'about:blank'},session).catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
};
