"""v0.04 camera, geometry, surface and controls regressions; Python Playwright/Chromium.
Uses the built standalone document. Render observations are independent of wall speed.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
HTML=(ROOT/'dist/Solar-Time_v0.04.html').read_text()
results=[]
def check(name,ok):
    if not ok: raise AssertionError(name)
    results.append({'test':name,'passed':True});print('PASS',name,flush=True)
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        p=b.new_page(viewport={'width':1648,'height':928},device_scale_factor=1,timezone_id='Asia/Seoul')
        errors=[];requests=[];p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
        p.set_content(HTML);p.wait_for_function('!!window.SolarTime',timeout=30000);p.wait_for_timeout(650)
        check('Release and both contact credits are current',p.evaluate("SolarTime.version==='0.04'") and p.locator('.settings-credit').inner_text()=='Life User / Solar Time v0.04 / Lyrikey@Naver.com' and 'Lyrikey@Naver.com' in p.locator('.signature').inner_text())
        check('No interaction caption remains below the speed card',p.locator('.playback .interaction-hint').count()==0 and p.locator('.playback .help-interaction').count()==0)
        check('Interaction guide directly precedes help shortcuts',p.evaluate("document.querySelector('.help-interaction').nextElementSibling.textContent==='단축키'") and '가운데 버튼' in p.locator('.help-interaction').inner_text())
        box=p.locator('.playback-bar').bounding_box()
        check('Speed card uses freed caption space below (83px bottom gap)',abs(box['y']+box['height']-(928-83))<1)
        check('No unrequested one-hour speed',p.locator('[data-rate="3600"]').count()==0)
        # Deterministic scene for camera / sprite observations; actual-clock audit is separate.
        p.evaluate('SolarTime.clock.setDate(Date.UTC(2026,8,11,4,20),performance.now());SolarTime.renderer.setOption("activity",false)')
        p.locator('#settings-button').click()
        p.locator('#elevation').fill('-55');p.locator('#elevation').dispatch_event('input');p.wait_for_timeout(150)
        check('Settings can look up from below the ecliptic',p.evaluate('Math.abs(SolarTime.renderer.camera.elevation+55*SolarAstro.DEG)<1e-8'))
        p.locator('#settings-close').click();p.locator('#fit-view').click();p.wait_for_timeout(80)
        p.mouse.move(700,655);p.mouse.down();p.mouse.move(700,280,steps=12);p.mouse.up();p.wait_for_timeout(150)
        check('Left drag crosses from positive to negative elevation',p.evaluate('SolarTime.renderer.camera.elevation<0'))
        p.locator('#fit-view').click();p.wait_for_timeout(80)
        initial=p.evaluate('({...SolarTime.renderer.camera})')
        p.mouse.move(700,535);p.mouse.down(button='middle');p.mouse.move(850,880,steps=8);p.mouse.up(button='middle');p.wait_for_timeout(100)
        camera=p.evaluate('({...SolarTime.renderer.camera})')
        check('Middle drag down stops exactly at +20%',abs(camera['panY']-.2)<1e-9)
        check('Middle drag is pure vertical translation, no orbit/zoom or selection',camera['azimuth']==initial['azimuth'] and camera['elevation']==initial['elevation'] and camera['zoom']==initial['zoom'] and p.evaluate('SolarTime.renderer.selected===null'))
        check('Downward pan applies in screen coordinates',p.evaluate('Math.abs(SolarTime.renderer.centerY-innerHeight*.75)<1e-7'))
        p.mouse.move(700,710);p.mouse.down(button='middle');p.mouse.move(810,180,steps=10);p.mouse.up(button='middle');p.wait_for_timeout(100)
        check('Middle drag up stops exactly at -20%',p.evaluate('Math.abs(SolarTime.renderer.camera.panY+.2)<1e-9'))
        p.locator('#universe').focus();p.keyboard.press('0');p.wait_for_timeout(80)
        check('Reset clears the pan and restores the new base position',p.evaluate('SolarTime.renderer.camera.panY===0&&Math.abs(SolarTime.renderer.centerY-innerHeight*.55)<1e-6'))
        p.mouse.move(700,500);p.mouse.down(button='middle');p.mouse.move(980,500,steps=6);p.mouse.up(button='middle')
        check('Horizontal middle drag has no effect',p.evaluate('SolarTime.renderer.camera.panY===0&&SolarTime.renderer.camera.azimuth===25*SolarAstro.DEG'))
        check('Middle button prevents browser auxiliary/default scrolling on viewport',p.evaluate("['mousedown','auxclick'].every(t=>{const e=new MouseEvent(t,{button:1,bubbles:true,cancelable:true});document.querySelector('#universe').dispatchEvent(e);return e.defaultPrevented;})"))
        p.mouse.move(700,500);p.mouse.down(button='middle');p.mouse.move(700,580,steps=4)
        check('Middle drag works while held',p.evaluate('SolarTime.renderer.camera.panY>0'))
        p.mouse.up(button='middle');p.wait_for_timeout(60)
        check('Middle release clears active drag',not p.locator('#universe').evaluate("el=>el.classList.contains('dragging')"))
        p.locator('#fit-view').click()
        # Identical maximum screen-size endpoint for all 11 bodies.
        dims=p.evaluate('''()=>{const r=SolarTime.renderer,A=SolarAstro,ms=SolarTime.getState().simulationMs;return [A.SUN,...A.BODIES,A.MOON].map(b=>{
          r.focusBody(b.id);r.setZoom(64);r.cameraChangeAt=-Infinity;r.draw(ms,0);
          const v=r.projected.find(v=>v.body.id===b.id);return {id:b.id,r:v.r,x:v.screen.x,y:v.screen.y,texture:r.textures[b.id].w,raster:r.sprites.get(b.id).canvas.width};
        });}''')
        check('Every target including Moon and Pluto fills the same 68% viewport diameter',all(abs(v['r']-928*.34)<.01 for v in dims))
        check('Every target remains centered at maximum zoom',all(abs(v['x']-824)<.01 and abs(v['y']-928*.55)<.01 for v in dims))
        check('All closeups use 1024x512 textures and the higher raster level',all(v['texture']==1024 and v['raster']>256 for v in dims))
        check('All high-resolution textures join seamlessly at the longitude border',p.evaluate("Object.values(SolarTime.renderer.textures).every(t=>{for(let y=0;y<t.h;y++)for(let c=0;c<3;c++)if(t.data[(y*t.w)*4+c]!==t.data[(y*t.w+t.w-1)*4+c])return false;return true;})"))
        check('Middle translation works at maximum zoom without changing size',p.evaluate("(()=>{const r=SolarTime.renderer;r.setPanY(-.1);r.draw(SolarTime.getState().simulationMs,0);const p=r.projected.find(p=>p.body.id==='moon');return Math.abs(p.screen.y-innerHeight*.45)<.01&&Math.abs(p.r-innerHeight*.34)<.01;})()"))
        for id in ['moon','pluto','earth','jupiter','sun']:
            p.evaluate("id=>{const r=SolarTime.renderer;r.resetCamera();r.focusBody(id);r.setZoom(64);r.cameraChangeAt=-Infinity;r.draw(SolarTime.getState().simulationMs,0);}",id)
            p.wait_for_timeout(220);p.screenshot(path=str(OUT/(id+'-max-v0.04.png')))
        images=[]
        for elev in [45,-45,0]:
            p.evaluate("e=>{const r=SolarTime.renderer;r.resetCamera();r.focusBody('saturn');r.setZoom(20);r.setOrbitView(.4,e*SolarAstro.DEG);r.cameraChangeAt=-Infinity;r.draw(SolarTime.getState().simulationMs,0);}",elev)
            p.wait_for_timeout(160);images.append(p.locator('#universe').evaluate('c=>c.toDataURL()'));p.screenshot(path=str(OUT/f'saturn-{elev}-v0.04.png'))
        check('Saturn genuinely changes appearance from above/below/edge views',len(set(images))==3)
        # Rendering cache must respond to low angular velocities, without changing period.
        spin=p.evaluate('''()=>{const r=SolarTime.renderer,A=SolarAstro,t=Date.UTC(2026,8,11,4,20);r.resetCamera();r.cameraChangeAt=-Infinity;r.options.activity=false;
          return [A.SUN,...A.BODIES,A.MOON].map(b=>{
            const pos={x:200,y:100,z:0};const a=r.shade(b,pos,280,t,0),before=a.getContext('2d').getImageData(0,0,a.width,a.height).data.slice();
            const cacheA=r.sprites.get(b.id).key,next=r.shade(b,pos,280,t+60000,0),after=next.getContext('2d').getImageData(0,0,next.width,next.height).data;
            let changed=0;for(let i=0;i<before.length;i+=4)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++;
            const repeated=r.shade(b,pos,280,t+60000,0);return {id:b.id,changedPixels:changed,cacheChanged:cacheA!==r.sprites.get(b.id).key,degreesPerMinute:360/(b.spin*1440),pausedReusesCanvas:repeated===next};
          });}''')
        check('ALL 11 bodies change pixels after 60 real-time seconds with effects disabled',all(v['changedPixels']>0 and v['cacheChanged'] for v in spin))
        check('An identical paused time reuses each unchanged sprite',all(v['pausedReusesCanvas'] for v in spin))
        p.locator('#fit-view').click();p.wait_for_timeout(200)
        p.screenshot(path=str(OUT/'overview-v0.04-final.png'))
        # Camera change uses the bounded interactive preview then resolves detail.
        check('During an orbit drag preview rendering stays bounded',p.evaluate("(()=>{const r=SolarTime.renderer;r.focusBody('earth');r.setZoom(64);r.setOrbitView(1,-.7);r.draw(SolarTime.getState().simulationMs,0);return r.sprites.get('earth').canvas.width<=192;})()"))
        p.wait_for_timeout(300)
        check('After orbit dragging settles the detailed raster is restored',p.evaluate("SolarTime.renderer.sprites.get('earth').canvas.width>256"))
        p.locator('#settings-button').click();p.locator('#quality').select_option('low');p.wait_for_timeout(300)
        check('Low-power keeps its own bounded raster level',p.evaluate("SolarTime.renderer.sprites.get('earth').canvas.width<=384"))
        p.locator('#quality').select_option('auto');p.locator('#settings-close').click();p.locator('#fit-view').click()
        p.locator('#hide-ui').click();p.mouse.move(700,500);p.mouse.down(button='middle');p.mouse.move(700,610,steps=5);p.wait_for_timeout(2000)
        check('Middle drag also works in viewing mode and held cursor remains visible',p.evaluate("SolarTime.renderer.camera.panY>0&&getComputedStyle(document.querySelector('#universe')).cursor!=='none'"))
        p.mouse.up(button='middle');p.wait_for_timeout(2000)
        check('Middle release rearms the viewing-mode cursor timer',p.evaluate("getComputedStyle(document.querySelector('#universe')).cursor==='none'"))
        p.keyboard.press('Escape');p.locator('#fit-view').click()
        # Responsive composition and maximum-size endpoint on a mobile canvas.
        p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(350)
        mobile=p.evaluate("(()=>{const r=SolarTime.renderer;r.focusBody('pluto');r.setZoom(64);r.cameraChangeAt=-Infinity;r.draw(SolarTime.getState().simulationMs,0);const b=r.projected.find(b=>b.body.id==='pluto');return {radius:b.r,center:r.centerY};})()")
        check('Mobile Pluto maximum also uses the same screen-relative diameter',abs(mobile['radius']-390*.34)<.01)
        check('Mobile speed bar remains below the scene and above navigation',p.evaluate("(()=>{const a=document.querySelector('.playback-bar').getBoundingClientRect(),b=document.querySelector('#planet-nav').getBoundingClientRect();return a.bottom<b.top&&a.left>=0&&a.right<=innerWidth;})()"))
        p.screenshot(path=str(OUT/'mobile-pluto-v0.04.png'))
        check('No runtime errors or external requests in new interactions',not errors and not requests)
        (OUT/'view-browser-results.json').write_text(json.dumps({'passed':len(results),'tests':results,'maximumSizes':dims,'oneMinuteRotation':spin,'errors':errors,'requests':requests},ensure_ascii=False,indent=2))
        print(f'{len(results)} new browser checks passed',flush=True)
    finally:b.close()
