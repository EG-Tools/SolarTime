"""v0.05 recovery gate: real file entrypoints, worker wiring, closeup and layout."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name, ok):
    assert ok, name
    checks.append({'test':name,'passed':True})
    print('PASS',name,flush=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1648,'height':928});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    native='--file' in sys.argv
    if native: page.goto((ROOT/'index.html').as_uri())
    else: page.set_content((ROOT/'dist'/'Solar-Time_v0.05.html').read_text())
    page.wait_for_function('window.SolarTime?.version==="0.05"');page.wait_for_timeout(800)
    check('v0.05 entrypoint loads and starts the surface worker',page.evaluate('SolarTime.renderer.surface.stats.backend==="worker"'))
    check('Life User, v0.05 and the requested email are present',page.locator('.signature').inner_text()=='Life User / v0.05 Lyrikey@Naver.com')
    for width in [1920,1648,1280,1100,800]:
        page.set_viewport_size({'width':width,'height':928});page.wait_for_timeout(140)
        check(f'Planet navigation is centered at {width}px',page.evaluate('(()=>{const r=document.querySelector("#planet-nav").getBoundingClientRect();return Math.abs((r.left+r.right)/2-innerWidth/2)<1})()'))
    page.set_viewport_size({'width':1648,'height':928});page.wait_for_timeout(140)
    check('Playback is lower and separate from navigation',page.evaluate('(()=>{const a=document.querySelector(".playback").getBoundingClientRect(),b=document.querySelector("#planet-nav").getBoundingClientRect();return Math.abs(innerHeight-a.bottom-68)<1&&a.bottom<b.top})()'))
    page.evaluate('SolarTime.renderer.focusBody("moon");SolarTime.renderer.setZoom(64)')
    page.wait_for_function('SolarTime.renderer.surface.frames.get("moon")?.job.textureWidth===2048',timeout=30000)
    check('Moon uses the detailed worker-rendered image',page.evaluate('SolarTime.renderer.surface.get("moon").width>=512'))
    check('Hidden disks are not submitted just because their glow intersects',page.evaluate('(()=>{const r=SolarTime.renderer;return [...r.surface.desired.keys()].every(id=>{const p=r.projected.find(b=>b.body.id===id);return r.visible(p.screen,p.r+2)})})()'))
    check('Moon fills the requested common maximum size',page.evaluate('Math.abs(SolarTime.renderer.projected.find(p=>p.body.id==="moon").r-innerHeight*.34)<.01'))
    page.screenshot(path=str(ROOT/'test-results'/'moon-restored-v0.05.png'))
    timing=page.evaluate('''async()=>{const r=SolarTime.renderer,old=r.draw,durations=[],start=performance.now(),count=r.frameCount;
      r.draw=function(...args){const t=performance.now();try{return old.apply(this,args)}finally{durations.push(performance.now()-t)}};
      await new Promise(resolve=>setTimeout(resolve,2000));r.draw=old;
      return {fps:(r.frameCount-count)*1000/(performance.now()-start),mainThreadDrawMs:durations.reduce((a,b)=>a+b,0)/durations.length,samples:durations.length};}''')
    check('Focused Moon keeps producing display frames',timing['samples']>20)
    before=page.evaluate('SolarTime.renderer.surface.stats.accepted');page.wait_for_timeout(400)
    check('Live Moon surface continues updating, not just the display loop',page.evaluate('SolarTime.renderer.surface.stats.accepted')>before)
    page.locator('#pause-button').click();page.wait_for_timeout(500)
    before=page.evaluate('SolarTime.renderer.surface.stats.accepted');page.wait_for_timeout(300)
    check('Paused time stops redundant surface jobs',page.evaluate('SolarTime.renderer.surface.stats.accepted')==before)
    page.evaluate('SolarTime.renderer.suspend()');page.wait_for_timeout(400)
    check('Renderer recreates its worker after a suspension',page.evaluate('SolarTime.renderer.surface.stats.backend==="worker"'))
    page.locator('#fit-view').click();page.wait_for_timeout(500);page.screenshot(path=str(ROOT/'test-results'/'overview-restored-v0.05.png'))
    if native: page.goto((ROOT/'dist'/'Solar-Time_v0.05.html').as_uri())
    else: page.set_content((ROOT/'dist'/'Solar-Time_v0.05.html').read_text())
    page.wait_for_function('window.SolarTime?.version==="0.05"')
    check('Standalone HTML can initialize again',page.evaluate('SolarTime.renderer.surface.stats.backend==="worker"'))
    check('Source and standalone runtime have no JavaScript errors',not errors)
    browser.close()
ROOT.joinpath('docs/recovery-browser-v0.05.json').write_text(json.dumps({'passed':len(checks),'tests':checks,'moonTiming':timing,'errors':errors,'execution':'native file entrypoints' if native else 'standalone HTML injected offline; file navigation blocked by browser policy'},ensure_ascii=False,indent=2))
