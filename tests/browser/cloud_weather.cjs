/* Standalone Node/Edge runner for the shared offline browser cloud check.
 * No dependencies, user profile, foreground window, server or deployed edits.
 * Usage: node tests/browser/cloud_weather.cjs [--visual] [--benchmark-baseline <surface.js>]
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const browser=process.env.SOLAR_TEST_BROWSER||['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(file=>fs.existsSync(file));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  if(!browser)throw Error('Set SOLAR_TEST_BROWSER to an installed Chromium browser');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'solartime-cloud-qa-'));
  const processHandle=spawn(browser,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let socket,target,send,closed=false,diagnostic='';const pending=new Map();processHandle.on('exit',()=>closed=true);
  processHandle.stderr.on('data',bytes=>diagnostic=(diagnostic+bytes.toString()).slice(-4000));
  try{
    const active=path.join(profile,'DevToolsActivePort'),deadline=Date.now()+25000;
    // Edge's compatibility launcher can exit after relaunching the real
    // browser. The private debugging endpoint, not launcher lifetime, is ready.
    while(!fs.existsSync(active)){if(Date.now()>deadline)throw Error('Temporary browser did not start: '+diagnostic);await delay(100);}
    const [port,endpoint]=fs.readFileSync(active,'utf8').trim().split(/\r?\n/);
    socket=new WebSocket('ws://127.0.0.1:'+port+endpoint);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    let serial=0;
    socket.addEventListener('message',event=>{const response=JSON.parse(event.data),entry=pending.get(response.id);if(entry){pending.delete(response.id);clearTimeout(entry.timer);response.error?entry.reject(Error(response.error.message)):entry.resolve(response.result);}});
    send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},45000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,sessionId}));});
    target=(await send('Target.createTarget',{url:'about:blank'})).targetId;
    const session=(await send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
    const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
    await evaluate('document.body.innerHTML='+JSON.stringify('<canvas id="test" width="128" height="128"></canvas>'));
    for(const file of ['src/surface-style.js','src/surface.js'])await evaluate(fs.readFileSync(path.join(root,file),'utf8'));
    const python=fs.readFileSync(path.join(__dirname,'cloud_weather.py'),'utf8');
    const harness=python.match(/result = page\.evaluate\("""([\s\S]*?)"""\)/)[1];
    const result=await evaluate('('+harness+')()');console.log(JSON.stringify(result));
    assert.equal(result.backend,'gpu');assert.ok(result.difference<=3);assert.ok(result.visible>80);
    assert.ok(result.disabled&&result.cached&&result.disposed);assert.deepEqual(result.errors,[0,0]);
    assert.ok(result.workerFrame.backend==='worker'&&result.workerFrame.ready);
    if(process.argv.includes('--visual')){
      // Sources are consumed by the real renderer for QA, never image-edited.
      await evaluate(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'));
      await evaluate('Object.defineProperty(window,"SolarCloudTestManifest",{value:'+JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8')))+'});void 0');
      const visual=fs.readFileSync(path.join(__dirname,'cloud_weather_visual.js'),'utf8');
      const rendered=await evaluate('('+visual+')()');
      const file=path.join(os.tmpdir(),'solartime-dual-cloud-local.png');fs.writeFileSync(file,Buffer.from(rendered.image.split(',')[1],'base64'));
      delete rendered.image;console.log(JSON.stringify({file,...rendered}));
      assert.equal(rendered.glError,0);assert.equal(rendered.widths.clouds,4096);assert.equal(rendered.widths['clouds-alt'],2048);
    }
    const baselineIndex=process.argv.indexOf('--benchmark-baseline');
    if(process.argv.includes('--venus')){
      await evaluate(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'));
      const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
      const assets=Object.fromEntries(['venus','venus-surface'].map(id=>{
        const file=id==='venus'?path.join(root,'assets/venus.webp'):path.join(root,'.cloudflare/media',manifest.materials[id].tiers[0].path);
        return [id,'data:image/webp;base64,'+fs.readFileSync(file).toString('base64')];
      }));
      const check=fs.readFileSync(path.join(__dirname,'venus_clouds.js'),'utf8');
      const result=await evaluate('('+check+')('+JSON.stringify(assets)+')');
      const file=path.join(os.tmpdir(),'solartime-venus-local.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
      console.log(JSON.stringify({venus:{file,...result}}));assert.ok(result.difference<=3);assert.deepEqual(result.errors,[0,0]);
    }
    if(baselineIndex>=0){
      const baselinePath=process.argv[baselineIndex+1];if(!baselinePath)throw Error('Missing baseline source path');
      const current=fs.readFileSync(path.join(root,'src/surface.js'),'utf8');
      await evaluate(fs.readFileSync(path.resolve(baselinePath),'utf8'));
      await evaluate('window.SolarCloudBenchmarkBefore=SolarSurface.shaderSources.planet');
      await evaluate(current);
      await evaluate('window.SolarCloudBenchmarkVertex='+JSON.stringify(current.match(/const DIRECT_QUAD_VERTEX=`([\s\S]*?)`;/)[1]));
      await evaluate(fs.readFileSync(path.join(root,'src/performance.js'),'utf8'));
      await evaluate('window.SolarCloudBenchmarkManifest='+JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8')))+';void 0');
      const bench=fs.readFileSync(path.join(__dirname,'cloud_shader_benchmark.js'),'utf8');
      const results=await evaluate('('+bench+')()');
      console.log(JSON.stringify({shaderBenchmark:results}));
      assert.equal(results.glError,0);assert.ok(results.maxChannelDifference<=1,'same image within one 8-bit rounding level');
    }
    if(process.argv.includes('--support-qr')){
      const support=await require('./support_qr.cjs')({root,evaluate,send,session});
      console.log(JSON.stringify({support}));
    }
    if(process.argv.includes('--venus-app'))console.log(JSON.stringify({venusApp:await require('./venus_app.cjs')({root,evaluate,send,session})}));
    await send('Target.closeTarget',{targetId:target});target=null;
    await send('Browser.close').catch(()=>{});
  }finally{
    if(socket?.readyState===WebSocket.OPEN&&send){await Promise.race([send('Browser.close').catch(()=>{}),delay(2000)]);}
    for(const entry of pending.values())clearTimeout(entry.timer);pending.clear();
    socket?.close();if(!closed)processHandle.kill();
    // Only our uniquely created temporary browser profile can be removed.
    if(path.dirname(profile)===os.tmpdir()&&path.basename(profile).startsWith('solartime-cloud-qa-')){
      for(let n=0;n<15;n++){try{fs.rmSync(profile,{recursive:true,force:true});break;}catch(_){await delay(200);}}
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
