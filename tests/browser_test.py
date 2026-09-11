"""Offline UI regression checks. Requires Python Playwright and a Chromium executable.
The test injects the standalone HTML directly, so it needs neither a server nor network access.
Usage: CHROMIUM_PATH=/usr/bin/chromium python tests/browser_test.py
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from time import perf_counter
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist'/'Solar-Time_v0.05.html').read_text(encoding='utf-8')
OUT=ROOT/'test-results'
OUT.mkdir(exist_ok=True)
results=[]

def check(name,condition):
    if not condition:
        raise AssertionError(name)
    results.append({'test':name,'passed':True})
    print('PASS',name)

with sync_playwright() as pw:
    executable=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
    browser=pw.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1648,'height':928},device_scale_factor=1,timezone_id='Asia/Seoul')
    errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(HTML,wait_until='load')
    page.wait_for_function('!!window.SolarTime',timeout=30000)
    page.wait_for_timeout(650)
    # Exercise the single shared kernel, instead of the removed main-thread shader.
    page.evaluate("""()=>{const engine=new (SolarSurface.kernel().Engine)();
      window.testShade=(b,p,r,ms,t)=>{const job=SolarTime.renderer.surfaceJob(b,p,r,ms,t,performance.now());
        job.diam=64;job.textureWidth=256;const image=engine.render(job),canvas=document.createElement('canvas');
        canvas.width=canvas.height=64;canvas.getContext('2d').drawImage(image,0,0);return canvas;};}
    """)
    state=page.evaluate('SolarTime.getState()')
    check('Starts in actual, playing local time',state['live'] and not state['paused'] and state['rate']==1)
    check('Actual clock synchronized with wall time',abs(state['simulationMs']-state['wallMs'])<5)
    check('Sun, 8 planets, Pluto and Moon render',page.evaluate('SolarTime.renderer.projected.length')==11)
    check('No external network requests',not any(u.startswith(('http:', 'https:')) for u in requests))
    check('Loading overlay dismissed',page.locator('#loading').is_hidden())
    check('All default orbit paths fit inside the viewport',page.evaluate('SolarTime.renderer.paths.every(path=>path.points.every(p=>{const q=SolarTime.renderer.project(p);return q.x>=0&&q.x<=innerWidth&&q.y>=0&&q.y<=innerHeight;}))'))
    check('Default orbit bounds are five percent higher than v0.03',page.evaluate("""(()=>{
      const r=SolarTime.renderer,ys=r.paths.flatMap(path=>path.points.map(p=>r.project(p).y));
      return Math.abs((Math.min(...ys)+Math.max(...ys))/2-innerHeight*.55)<.1;
    })()"""))
    check('One-hour playback is not added',page.locator('[data-rate="3600"]').count()==0 and page.locator('[data-rate]').count()==3)
    check('Earth screen radius is exactly 1.5 times its old radius',page.evaluate('(()=>{const r=SolarTime.renderer,e=r.projected.find(p=>p.body.id==="earth");return Math.abs(e.r-11.5*1.5*r.bodyScale)<1e-8;})()'))
    check('There is no artificial surface-speed option',page.locator('#show-spin').count()==0 and page.evaluate('!("spin" in SolarTime.renderer.options)'))
    check('Rotation uses the same timestamp for every body',page.evaluate("""(()=>{
      const A=SolarAstro,r=SolarTime.renderer,t=A.J2000,p={x:200,y:10,z:0};
      return [...A.BODIES,A.MOON,A.SUN].every(b=>{
        const first=testShade(b,p,30,t,0,true).toDataURL();
        const quarter=testShade(b,p,30,t+Math.abs(b.spin)*A.DAY/4,0,true).toDataURL();
        const full=testShade(b,p,30,t+Math.abs(b.spin)*A.DAY,0,true).toDataURL();
        return first!==quarter&&first===full;
      });
    })()"""))
    check('Planet textures are independent of decorative animation seconds',page.evaluate("""(()=>{
      const A=SolarAstro,r=SolarTime.renderer,t=SolarTime.getState().simulationMs,p={x:200,y:10,z:0};
      return [...A.BODIES,A.MOON].every(b=>testShade(b,p,30,t,0,true).toDataURL()===testShade(b,p,30,t,999,true).toDataURL());
    })()"""))
    check('Lunar orbit is 30 reference pixels, independent of the enlarged Earth',page.evaluate("""(()=>{
      const r=SolarTime.renderer,A=SolarAstro,t=A.J2000;r.draw(t,3);
      const e=r.projected.find(p=>p.body.id==='earth'),m=r.projected.find(p=>p.body.id==='moon');
      return Math.abs(Math.hypot(m.world.x-e.world.x,m.world.y-e.world.y,m.world.z-e.world.z)*r.scale/r.bodyScale-30)<1e-8;
    })()"""))
    check('Corona is cached, deterministic, and responds to the effects switch',page.evaluate("""(()=>{
      const r=SolarTime.renderer,c=document.createElement('canvas');c.width=c.height=320;const ctx=c.getContext('2d');
      const draw=t=>{ctx.clearRect(0,0,320,320);r.corona(ctx,160,160,40,t);return c.toDataURL();};
      r.options.activity=true;const first=draw(2),asset=r.coronaTexture,again=draw(2),moving=draw(14);
      r.options.activity=false;const off1=draw(2),off2=draw(14);r.options.activity=true;
      return first===again&&first!==moving&&off1===off2&&asset===r.coronaTexture&&asset.width===384;
    })()"""))
    check('Canvas labels share the interpolated hit position for ALL bodies including Moon',page.evaluate("""(()=>{
      const r=SolarTime.renderer,A=SolarAstro,c=r.ctx,items=[A.SUN,...A.BODIES,A.MOON].map((b,i)=>({body:b,screen:{x:60+i*130,y:320,z:0},r:16}));
      r.clearLabels();r.hitTargets=[];r.labels(c,items,0);
      const ok=items.every(p=>{const q=r.hitTargets.find(q=>q.label&&q.id===p.body.id),s=r.labelStates.get(p.body.id);
        return q&&s&&Math.abs(q.x+q.w/2-p.screen.x-s.dx)<1e-8&&Math.abs(q.y-p.screen.y-s.dy)<1e-8&&r.hit(q.x+q.w/2,q.y+4)===p.body.id;
      });r.clearLabels();return ok;
    })()"""))
    check('Earth/Moon avoidance uses intermediate positions, not a one-frame teleport',page.evaluate("""(()=>{
      const r=SolarTime.renderer,A=SolarAstro,c=r.ctx,earth={body:A.BODIES[2],screen:{x:500,y:350,z:0},r:20},moon={body:A.MOON,screen:{x:650,y:391,z:1},r:8};
      r.clearLabels();r.hitTargets=[];r.labels(c,[earth,moon],0);const original=r.labelStates.get('earth').dy;moon.screen.x=500;
      let largest=0,prev=original,intermediate=false;
      for(let t=16;t<1200;t+=16){r.hitTargets=[];r.labels(c,[earth,moon],t);const state=r.labelStates.get('earth');
        largest=Math.max(largest,Math.abs(state.dy-prev));intermediate ||=state.slot!==0&&Math.abs(state.dy-original)>0.1&&Math.abs(state.dy-original)<25;prev=state.dy;}
      const ok=intermediate&&largest<10;r.clearLabels();return ok;
    })()"""))
    page.locator('[data-body="jupiter"]').click()
    page.locator('[data-rate="86400"]').click();page.wait_for_timeout(100)
    check('Jupiter shows the correct 2.42 spins per second without artificially slowing it','초당 2.42회' in page.locator('#body-spin').inner_text())
    page.locator('[data-body="saturn"]').click()
    check('Saturn shows the correct 2.27 spins per second','초당 2.27회' in page.locator('#body-spin').inner_text())
    page.locator('#body-close').click();page.locator('#live-button').click()
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUT/'desktop.png'))
    page.locator('[data-rate="86400"]').click()
    sample1=page.evaluate('({s:SolarTime.getState(),p:performance.now()})')
    page.wait_for_timeout(800)
    sample2=page.evaluate('({s:SolarTime.getState(),p:performance.now()})')
    ratio=(sample2['s']['simulationMs']-sample1['s']['simulationMs'])/(sample2['p']-sample1['p'])
    check('One day per second advances simulation at ×86400',abs(ratio-86400)<100)
    check('Time travel leaves the actual wall clock unaccelerated',sample2['s']['wallMs']-sample1['s']['wallMs']<1500)
    page.locator('#pause-button').click()
    # Label easing is UI animation, not simulation time. Isolate the scene-freeze invariant.
    page.evaluate('SolarTime.renderer.setOption("labels",false)')
    page.wait_for_timeout(120)
    frozen=page.evaluate('SolarTime.getState()')
    before_image=page.evaluate('document.getElementById("universe").toDataURL()')
    page.wait_for_timeout(450)
    after=page.evaluate('SolarTime.getState()')
    after_image=page.evaluate('document.getElementById("universe").toDataURL()')
    check('Pause freezes simulation time',frozen['simulationMs']==after['simulationMs'])
    check('Pause freezes Sun and stars as well',frozen['effectTime']==after['effectTime'] and before_image==after_image)
    page.evaluate('SolarTime.renderer.setOption("labels",true)')
    check('Pause shows the play SVG icon',page.locator('#play-icon').is_visible() and page.locator('#pause-icon').is_hidden())
    page.locator('#pause-button').click();page.wait_for_timeout(100)
    check('Resuming continues accelerated playback',not page.evaluate('SolarTime.getState().paused'))
    page.locator('#live-button').click();page.wait_for_timeout(80)
    # Exercise the single shared kernel, instead of the removed main-thread shader.
    page.evaluate("""()=>{const engine=new (SolarSurface.kernel().Engine)();
      window.testShade=(b,p,r,ms,t)=>{const job=SolarTime.renderer.surfaceJob(b,p,r,ms,t,performance.now());
        job.diam=64;job.textureWidth=256;const image=engine.render(job),canvas=document.createElement('canvas');
        canvas.width=canvas.height=64;canvas.getContext('2d').drawImage(image,0,0);return canvas;};}
    """)
    state=page.evaluate('SolarTime.getState()')
    check('Actual-time button resets rate and date',state['live'] and state['rate']==1 and abs(state['simulationMs']-state['wallMs'])<5)
    page.locator('[data-body="earth"]').click()
    check('Keyboard-accessible Earth selector opens details',page.locator('#body-panel').is_visible() and page.locator('#body-name').inner_text()=='지구')
    check('Selected body shows its own rotation period','23시간 56분 4초' in page.locator('#body-spin').inner_text())
    page.screenshot(path=str(OUT/'earth-details.png'))
    page.locator('#body-close').click()
    page.locator('#settings-button').click()
    check('Settings panel opens',page.locator('#settings-panel').is_visible())
    check('UI explains physical spin and the shared playback rate','실제 주기' in page.locator('#settings-panel').inner_text() and page.locator('#spin-mode-note').inner_text()=='자전·공전 시간 연동')
    page.locator('#show-pluto').uncheck();page.wait_for_timeout(60)
    check('Pluto visibility toggles both orbit and navigation',not page.evaluate('SolarTime.renderer.projected.some(p=>p.body.id==="pluto")') and page.locator('[data-body="pluto"]').is_hidden())
    page.locator('#show-pluto').check()
    page.locator('#show-moon').uncheck();page.wait_for_timeout(60)
    check('Moon visibility toggle works',not page.evaluate('SolarTime.renderer.projected.some(p=>p.body.id==="moon")'))
    page.locator('#show-moon').check()
    page.locator('#show-activity').uncheck();page.wait_for_timeout(100)
    check('Disabling Sun activity removes flutter without a separate spin clock',page.evaluate("""(()=>{
      const r=SolarTime.renderer,A=SolarAstro,t=SolarTime.getState().simulationMs,p={x:0,y:0,z:0};
      const a=testShade(A.SUN,p,30,t,0,true).toDataURL();
      const b=testShade(A.SUN,p,30,t,999,true).toDataURL();
      const next=testShade(A.SUN,p,30,t+A.SUN.spin*A.DAY/4,999,true).toDataURL();
      return a===b&&a!==next;
    })()"""))
    page.locator('#show-activity').check()
    page.locator('#show-labels').uncheck()
    check('Label setting reaches renderer',not page.evaluate('SolarTime.renderer.options.labels'))
    page.locator('#show-labels').check()
    page.locator('#quality').select_option('low')
    check('Low-power rendering limits pixel ratio',page.evaluate('SolarTime.renderer.dpr')<=1)
    page.locator('#quality').select_option('auto')
    page.locator('#settings-close').click()
    page.locator('#timezone-button').click()
    check('Time zone can switch to UTC',page.evaluate('SolarTime.getState().timezone')=='utc')
    page.locator('#date-button').click();page.locator('#date-input').fill('2040-01-01T12:30');page.locator('#date-form button[type="submit"]').click()
    # Exercise the single shared kernel, instead of the removed main-thread shader.
    page.evaluate("""()=>{const engine=new (SolarSurface.kernel().Engine)();
      window.testShade=(b,p,r,ms,t)=>{const job=SolarTime.renderer.surfaceJob(b,p,r,ms,t,performance.now());
        job.diam=64;job.textureWidth=256;const image=engine.render(job),canvas=document.createElement('canvas');
        canvas.width=canvas.height=64;canvas.getContext('2d').drawImage(image,0,0);return canvas;};}
    """)
    state=page.evaluate('SolarTime.getState()')
    check('Selected date is exact in UTC and starts paused',state['simulationMs']==2209033800000 and state['paused'] and not state['live'])
    page.locator('[data-rate="604800"]').click();page.wait_for_timeout(100)
    check('Speed button resumes a selected date',page.evaluate('SolarTime.getState().rate')==604800 and not page.evaluate('SolarTime.getState().paused'))
    page.locator('#live-button').click();page.locator('#timezone-button').click()
    page.locator('#help-button').click()
    check('Help is a modal dialog with accuracy disclosure',page.locator('#help-dialog').is_visible() and '정확도' in page.locator('#help-dialog').inner_text())
    page.keyboard.press('Escape')
    check('Escape closes native modal',page.locator('#help-dialog').is_hidden())
    a=page.evaluate('SolarTime.renderer.camera.azimuth')
    page.mouse.move(630,570);page.mouse.down();page.mouse.move(745,590,steps=6);page.mouse.up()
    check('Dragging rotates camera',abs(page.evaluate('SolarTime.renderer.camera.azimuth')-a)>.2)
    z=page.evaluate('SolarTime.renderer.camera.zoom');page.mouse.wheel(0,-100);page.wait_for_timeout(80)
    check('Mouse wheel zooms the view',page.evaluate('SolarTime.renderer.camera.zoom')>z)
    page.locator('#fit-view').click()
    check('Reset restores 45-degree view and unit zoom',page.evaluate('Math.abs(SolarTime.renderer.camera.elevation-Math.PI/4)<1e-8 && SolarTime.renderer.camera.zoom===1'))
    # Close observation uses the same camera owner for every body and input.
    for body in ['sun','earth','jupiter']:
        if page.evaluate('SolarTime.renderer.selected')!=body:
            page.locator('[data-body="'+body+'"]').click()
        page.locator('#focus-body').click();page.wait_for_timeout(150)
        check(body+' close-view button increases zoom and tracks the target',page.evaluate("""id=>{
          const r=SolarTime.renderer,p=r.projected.find(p=>p.body.id===id);
          return r.camera.focus===id&&r.camera.zoom>3&&Math.abs(p.screen.x-r.centerX)<.01&&Math.abs(p.screen.y-r.centerY)<.01;
        }""",body))
        check(body+' stays centered as simulation time advances',page.evaluate("""id=>{
          const r=SolarTime.renderer,A=SolarAstro;
          for(const t of [A.J2000,A.J2000+150*A.DAY,A.J2000+1000*A.DAY]){
            r.draw(t,4);const p=r.projected.find(p=>p.body.id===id);
            if(Math.abs(p.screen.x-r.centerX)>.01||Math.abs(p.screen.y-r.centerY)>.01)return false;
          }return true;
        }""",body))
        page.wait_for_timeout(80);page.screenshot(path=str(OUT/(body+'-closeup.png')))
    page.wait_for_function('SolarTime.renderer.surface.frames.get("jupiter")?.job.textureWidth===2048',timeout=30000)
    check('High zoom supplies higher resolution surface textures',page.evaluate('SolarTime.renderer.surface.frames.get("jupiter").image.width>200'))
    check('Zoom owner clamps invalid and excessive input without corrupting camera',page.evaluate("""(()=>{
      const r=SolarTime.renderer;r.setZoom(999);const max=r.camera.zoom;r.setZoom(NaN);
      if(max!==64||r.camera.zoom!==64)return false;r.setZoom(-100);
      if(r.camera.zoom!==.6||r.camera.focus!==null)return false;r.setZoom(64,'earth');r.draw(SolarTime.getState().simulationMs,6);return true;
    })()"""))
    page.wait_for_timeout(260)
    check('Maximum zoom is visible and its plus button is disabled',page.locator('#zoom-value').inner_text()=='64.0×' and page.locator('#zoom-in').is_disabled())
    page.locator('#zoom-out').click()
    check('Minus control shares the zoom limit owner',page.evaluate('SolarTime.renderer.camera.zoom')<64)
    page.locator('#focus-reset').click();page.wait_for_timeout(80)
    check('Overview button clears tracking and restores the requested lower composition',page.evaluate('SolarTime.renderer.camera.focus===null&&SolarTime.renderer.camera.zoom===1') and page.locator('#focus-reset').is_hidden())
    page.locator('#body-close').click()
    earth=page.evaluate('(()=>{const p=SolarTime.renderer.projected.find(p=>p.body.id==="earth");return p.screen;})()')
    page.mouse.move(earth['x'],earth['y']);page.mouse.wheel(0,-120);page.wait_for_timeout(150)
    check('Wheel zoom follows the planet under the pointer',page.evaluate('SolarTime.renderer.camera.focus')=='earth')
    page.locator('#fit-view').click();page.wait_for_timeout(60)
    sun=page.evaluate('SolarTime.renderer.projected.find(p=>p.body.id==="sun").screen')
    page.mouse.dblclick(sun['x'],sun['y']);page.wait_for_timeout(150)
    check('Double-clicking a body starts close observation, not fullscreen',page.evaluate('SolarTime.renderer.camera.focus==="sun"&&SolarTime.renderer.camera.zoom>3&&!document.fullscreenElement'))
    page.locator('#universe').focus();page.keyboard.press('0');page.wait_for_timeout(80)
    page.keyboard.press('+');page.wait_for_timeout(80)
    check('Keyboard zoom uses the same follow owner',page.evaluate('SolarTime.renderer.camera.zoom>1&&SolarTime.renderer.camera.focus==="sun"'))
    page.keyboard.press('0')
    # No obsolete off-screen labels are clamped onto the viewport edge at high zoom.
    check('Far-away bodies are excluded from label/picking work during close observation',page.evaluate("""(()=>{
      const r=SolarTime.renderer;r.focusBody('jupiter');r.setZoom(64);r.draw(SolarAstro.J2000,4);
      return r.hitTargets.filter(t=>t.label).every(t=>r.projected.some(p=>p.body.id===t.id&&r.visible(p.screen,p.r+20)));
    })()"""))
    page.locator('#fit-view').click()
    page.locator('#hide-ui').click()
    check('Viewing mode hides controls but keeps real clock',page.locator('.playback').is_hidden() and page.locator('#wall-clock').is_visible())
    check('Viewing-mode entry starts the cursor idle timer',page.evaluate('document.body.classList.contains("pointer-awake")'))
    page.wait_for_timeout(2050)
    check('Idle viewing mode hides the cursor on both canvas and controls',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor==="none" && getComputedStyle(document.querySelector("#show-ui")).cursor==="none"'))
    page.mouse.move(500,550)
    check('Moving the pointer restores it without leaving viewing mode',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor!=="none" && SolarTime.getState().zen'))
    page.wait_for_timeout(2050)
    check('Cursor hides again after subsequent inactivity',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor==="none"'))
    page.keyboard.press('h')
    check('H restores the UI and cursor from idle viewing mode',page.locator('.playback').is_visible() and page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor!=="none"'))
    page.wait_for_timeout(1900)
    check('No old idle timer hides the normal-mode cursor',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor!=="none"'))
    page.locator('#hide-ui').click();page.keyboard.press('Escape')
    check('Escape exits viewing mode',not page.evaluate('SolarTime.getState().zen'))
    page.locator('#hide-ui').click();page.mouse.move(500,550);page.mouse.down()
    page.wait_for_timeout(2050)
    check('Held pointer prevents cursor hiding during a drag',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor!=="none"'))
    page.mouse.up()
    page.wait_for_timeout(2050)
    check('Releasing a drag rearms the idle timer',page.evaluate('getComputedStyle(document.querySelector("#universe")).cursor==="none"'))
    page.locator('#show-ui').click()
    check('Viewing mode has a working exit',page.locator('.playback').is_visible())
    page.locator('#universe').focus();page.keyboard.press('Space')
    check('Space keyboard shortcut pauses',page.evaluate('SolarTime.getState().paused'))
    page.keyboard.press('r')
    check('R keyboard shortcut returns to NOW',page.evaluate('SolarTime.getState().live') and not page.evaluate('SolarTime.getState().paused'))
    check('No runtime errors during desktop interactions',not errors)
    f0=page.evaluate('SolarTime.renderer.frameCount');t0=perf_counter();page.wait_for_timeout(1200);f1=page.evaluate('SolarTime.renderer.frameCount');fps=(f1-f0)/(perf_counter()-t0)
    print('Measured desktop FPS:',round(fps,1))
    # Mobile geometry, accessible controls, and two-finger interaction handlers.
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,timezone_id='Asia/Seoul')
    mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
    mobile.set_content(HTML);mobile.wait_for_function('!!window.SolarTime',timeout=30000);mobile.wait_for_timeout(650)
    check('Mobile starts with all bodies',mobile.evaluate('SolarTime.renderer.projected.length')==11)
    check('Mobile playback bar stays within viewport',mobile.evaluate('(()=>{const r=document.querySelector(".playback-bar").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()'))
    check('Mobile page has no horizontal body overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    mobile.screenshot(path=str(OUT/'mobile.png'))
    mobile.locator('[data-rate="31557600"]').tap();mobile.wait_for_timeout(350)
    check('Mobile speed selection works',mobile.evaluate('SolarTime.getState().rate')==31557600)
    mobile.locator('#settings-button').tap()
    check('Mobile settings fit and scroll within viewport',mobile.evaluate('(()=>{const r=document.querySelector("#settings-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()'))
    mobile.locator('#settings-close').tap()
    check('Mobile has no runtime errors',not mobile_errors)
    # Narrow-screen control access and compact lunar spacing at multiple camera states.
    mobile.set_viewport_size({'width':320,'height':780});mobile.wait_for_timeout(200)
    check('Narrow mobile playback stays inside the viewport',mobile.evaluate('(()=>{const r=document.querySelector(".playback-bar").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()'))
    mobile.locator('[data-rate="86400"]').tap()
    check('One-day control remains reachable on a 320px viewport',mobile.evaluate('SolarTime.getState().rate')==86400)
    mobile.locator('[data-rate="31557600"]').tap()
    check('Farthest speed control remains reachable after horizontal scrolling',mobile.evaluate('SolarTime.getState().rate')==31557600)
    check('Moon size and orbit remain matched across camera zoom and elevation',mobile.evaluate("""(()=>{
      const r=SolarTime.renderer,A=SolarAstro;
      for(const zoom of [.6,1,3,64])for(const elevation of [15,45,80]) {
        r.camera.zoom=zoom;r.camera.elevation=elevation*A.DEG;r.dirty=true;r.draw(A.J2000+7*A.DAY,5);
        const e=r.projected.find(p=>p.body.id==='earth'),m=r.projected.find(p=>p.body.id==='moon');
        const offset=A.moonAt(A.J2000+7*A.DAY,A.MOON.displayOrbit*r.bodyScale/r.scale);
        if(Math.hypot(m.world.x-e.world.x-offset.x,m.world.y-e.world.y-offset.y,m.world.z-e.world.z-offset.z)>1e-8)return false;
      }
      r.resetCamera();return true;
    })()"""))
    # Reduced-motion preference has a quieter initial appearance.
    quiet=browser.new_page(viewport={'width':1280,'height':720},reduced_motion='reduce')
    quiet.set_content(HTML);quiet.wait_for_function('!!window.SolarTime',timeout=30000)
    check('Reduced-motion preference disables decorative animation by default',quiet.evaluate('!SolarTime.renderer.options.twinkle&&!SolarTime.renderer.options.activity'))
    check('Storage restrictions do not stop initialization',quiet.evaluate('!!window.SolarTime'))
    browser.close()
    (OUT/'browser-results.json').write_text(json.dumps({'passed':len(results),'tests':results,'desktop_fps':round(fps,1),'errors':errors+mobile_errors,'network_requests':requests,'execution':'Chromium, standalone HTML injected offline; desktop, mobile, reduced-motion and cursor/rotation regression tests.'},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'{len(results)} browser checks passed.')
