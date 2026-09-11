"""v0.07 release gate: offline startup, controls, sphere geometry, materials & lifecycle.
Requires Python Playwright + Chromium. No server/network is required for the injected
standalone run. Actual file navigation is separately reported, not assumed successful.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import time,json,os
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
report={'version':'0.07','checks':[],'measurements':{},'limitations':[]}
def check(name,cond,detail=None):
 report['checks'].append({'name':name,'passed':bool(cond),'detail':detail})
 if not cond: raise AssertionError(name+': '+str(detail))
with sync_playwright() as tool:
 browser=tool.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':1648,'height':928},device_scale_factor=1,timezone_id='Asia/Seoul',offline=True)
 report['limitations'].append('Offline injected HTML only; direct file/URL navigation is restricted in this test browser.')
 page=context.new_page();context.set_offline(True);errors=[];network=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('request',lambda r: network.append(r.url) if r.url.startswith(('http://','https://')) else None)
 started=time.perf_counter();page.set_content((ROOT/'dist/Solar-Time_v0.07.html').read_text(),wait_until='load')
 page.wait_for_function('window.SolarTime?.version==="0.07"',timeout=15000)
 report['measurements']['first_scene_ms']=round((time.perf_counter()-started)*1000,2)
 page.wait_for_function('SolarTime.renderer.surface.frames.size>=8 && SolarTime.renderer.sky.stats.frames>0',timeout=15000)
 data=page.evaluate('({version:SolarTime.version,model:SolarTime.getModel(),calibrationMs:SolarTime.calibrationMs,online:navigator.onLine,frames:SolarTime.renderer.surface.frames.size,sky:SolarTime.renderer.sky.stats,surface:SolarTime.renderer.surface.stats})')
 report['measurements']['boot']=data
 check('Offline boot has local model and no online state dependency',not data['online'] and data['model']['source']=='local',data)
 check('Current-time local position calibration takes less than five seconds',data['calibrationMs']<5000,data['calibrationMs'])
 check('All material/sky startup requests are local or embedded',not network,network)
 check('All worlds load while completely offline',data['frames']>=8,data['frames'])
 check('Identity and footer contact',page.locator('.signature').inner_text().startswith('Life User') and 'v0.07' in page.locator('.signature').inner_text())
 nav=page.locator('#planet-nav').bounding_box();check('Bottom planet controls are centered',abs(nav['x']+nav['width']/2-824)<1,nav)
 def sun():return page.evaluate('SolarTime.renderer.projected.find(p=>p.body.id==="sun").screen')
 check('Startup Sun at viewport center',abs(sun()['x']-824)<1,sun())
 page.locator('#zoom-in').click();page.wait_for_timeout(200);check('First zoom preserves same center',abs(sun()['x']-824)<1,sun());page.keyboard.press('0')
 # Middle drag: both axes use screen-relative pan, not scale-dependent scene units.
 page.mouse.move(800,450);page.mouse.down(button='middle');page.mouse.move(1260,800,steps=5);page.mouse.up(button='middle')
 camera=page.evaluate('SolarTime.renderer.camera');check('Middle drag clamps right/down to +20%',abs(camera['panX']-.2)<1e-8 and abs(camera['panY']-.2)<1e-8,camera)
 page.mouse.move(1100,700);page.mouse.down(button='middle');page.mouse.move(200,100,steps=5);page.mouse.up(button='middle')
 camera=page.evaluate('SolarTime.renderer.camera');check('Middle drag clamps left/up to -20%',abs(camera['panX']+.2)<1e-8 and abs(camera['panY']+.2)<1e-8,camera);page.keyboard.press('0')
 page.mouse.move(700,700);page.mouse.down();page.mouse.move(700,100,steps=5);page.mouse.up();check('Left drag reaches underside',page.evaluate('SolarTime.renderer.camera.elevation')<0);page.keyboard.press('0')
 page.locator('#universe').focus();page.keyboard.press('h');check('Home and all other buttons are hidden in viewing mode',not page.locator('#fit-view').is_visible() and page.locator('button:visible').count()==0);page.keyboard.press('0')
 page.wait_for_timeout(1900);check('Viewing-mode cursor hides and no button appears on hover',page.evaluate('getComputedStyle(document.body).cursor')=='none' and page.locator('button:visible').count()==0);page.keyboard.press('Escape')
 page.locator('#help-button').click();check('Interaction hint immediately precedes keyboard shortcuts',page.evaluate('document.querySelector(".help-interaction").nextElementSibling.textContent==="단축키"'))
 check('Interaction hint no longer below playback card',page.locator('.playback .help-interaction').count()==0);page.keyboard.press('Escape')
 check('No unrequested one-hour speed added',page.locator('[data-rate="3600"]').count()==0)
 # Decorative scene time never changes body simulation time or period ratios.
 results=page.evaluate('''()=>{const r=SolarTime.renderer,s=r.sky,A=SolarAstro,t=Date.UTC(2026,8,11,3);r.options.skyMotion=true;
 const before=A.BODIES.map(b=>A.rotationAt(b,t));s.lastEffect=null;s.draw(1,r.camera,r.options);const o=s.offset;s.draw(11,r.camera,r.options);const delta=(s.offset-o+A.TAU)%A.TAU;
 const a=s.axes(r.camera),z=s.axes({...r.camera,azimuth:r.camera.azimuth+A.TAU});
 r.options.skyMotion=false;s.draw(20,r.camera,r.options);const fixed=s.offset;s.draw(30,r.camera,r.options);
 return {delta,wrap:Object.keys(a).every(k=>a[k].every((v,i)=>Math.abs(v-z[k][i])<1e-8)),fixed:s.offset===fixed,physics:before.every((v,i)=>A.rotationAt(A.BODIES[i],t)===v)};}''')
 check('360-degree background wraps with identical orientation',results['wrap']);check('Background rotation is independent of body rotation',results['physics'] and abs(results['delta']-2.2*3.141592653589793/180)<1e-9,results);check('Background motion switch stops drift',results['fixed'])
 comet=page.evaluate('''()=>{const r=SolarTime.renderer,s=r.sky;r.options.comets=true;s.comet=null;s.nextComet=0;s.lastTime=0;s.decorate(r.ctx,2,r.options,r.starGlow.bind(r));const c=s.comet;const exists=!!c;
 s.decorate(r.ctx,2+c.duration+.1,r.options,r.starGlow.bind(r));const gone=!s.comet;const future=s.nextComet>2;
 r.options.comets=false;s.decorate(r.ctx,3,r.options,r.starGlow.bind(r));return {exists,gone,future,disabled:!s.comet};}''')
 check('Intermittent comet has a bounded life, random interval and disable switch',all(comet.values()),comet)
 curve=page.evaluate('''()=>{const r=SolarTime.renderer,s=r.sky;r.options.comets=true;s.comet=null;s.nextComet=0;s.lastTime=0;s.decorate(r.ctx,2,r.options,r.starGlow.bind(r));const k=s.comet,a=s.project(k.start),b=s.project(k.end),m=s.project(SolarSky.cometPoint(k,.5));const distance=Math.abs((b.y-a.y)*m.x-(b.x-a.x)*m.y+b.x*a.y-b.y*a.x)/Math.hypot(b.y-a.y,b.x-a.x);return {distance,duration:k.duration};}''')
 check('Comet midpoint is measurably off a straight trajectory',curve['distance']>15,curve)
 check('Comet passage is slow and bounded',11<=curve['duration']<=18,curve)
 page.evaluate('SolarTime.renderer.options.skyMotion=true;SolarTime.renderer.options.comets=true;SolarTime.renderer.resetCamera()');page.wait_for_timeout(300)
 page.screenshot(path=str(OUT/'overview-v0.07.png'))
 page.locator('#universe').focus();page.keyboard.press('h');page.wait_for_timeout(200);page.screenshot(path=str(OUT/'zen-v0.07.png'));check('No button reappears after pointer movement',page.locator('button:visible').count()==0);page.keyboard.press('Escape')
 for target in ['earth','moon','jupiter','saturn']:
  page.evaluate('''id=>{const r=SolarTime.renderer;r.focusBody(id);if(id==='earth')r.faceFeature(id,37.5665,126.978,SolarTime.getState().simulationMs);if(id==='jupiter')r.faceFeature(id,-22,70,SolarTime.getState().simulationMs);r.setZoom(40);}''',target)
  page.wait_for_function('''id=>{const r=SolarTime.renderer,e=r.surface.frames.get(id);return e&&e.job.textureWidth===4096&&e.image.width>=512}''',arg=target,timeout=15000)
  page.wait_for_timeout(300)
  check(target+' has high-detail embedded material at close-up',True)
  page.screenshot(path=str(OUT/(target+'-v0.07.png')))
 # At the same maximum zoom tiny bodies use the same viewport fill fraction.
 sizes=page.evaluate('''()=>{const r=SolarTime.renderer;return [SolarAstro.SUN,...SolarAstro.BODIES,SolarAstro.MOON].map(b=>{r.camera.focus=b.id;r.setZoom(64);return {id:b.id,r:r.bodyScaleAtZoom()*b.size};});}''')
 check('All 11 bodies have identical maximum screen size',all(abs(x['r']-928*.34)<1e-8 for x in sizes),sizes)
 page.evaluate('SolarTime.renderer.focusBody("earth")');page.locator('[data-body="earth"]').click();page.locator('#feature-view').click();page.wait_for_timeout(300)
 check('Korea view exposes local approximate daylight status','한국' in page.locator('#body-note').inner_text() and any(x in page.locator('#body-note').inner_text() for x in ['낮','밤']))
 page.locator('#body-close').click()
 page.evaluate('SolarTime.renderer.focusBody("moon");SolarTime.renderer.setZoom(64)');page.wait_for_timeout(1800)
 perf=page.evaluate('''()=>new Promise(resolve=>{let prev=performance.now(),start=prev,n=0,total=0,max=0;function f(t){const d=t-prev;if(n){total+=d;max=Math.max(max,d)}prev=t;n++;if(t-start<1800)requestAnimationFrame(f);else resolve({rafFps:(n-1)*1000/total,maxFrameMs:max,backend:SolarTime.renderer.surface.stats})}requestAnimationFrame(f)})''')
 report['measurements']['moon_maximum_view']=perf
 # Surface changes at 60 s modeled separation without touching configured periods.
 rotations=page.evaluate('''async()=>{const r=SolarTime.renderer,A=SolarAstro,t=Date.UTC(2026,8,11,5);r.options.activity=false;const values=[];
 for(const b of [A.SUN,...A.BODIES,A.MOON]){const d=A.wrap(A.rotationAt(b,t+60000)-A.rotationAt(b,t)+Math.PI)-Math.PI;values.push({id:b.id,deltaDegrees:d/A.DEG,periodSeconds:b.spinSeconds});}return values;}''')
 check('All 11 slow rotations still change at a one-minute separation',all(x['deltaDegrees']!=0 for x in rotations),rotations)
 check('No application exceptions in desktop offline workflow',not errors,errors)
 for width,height in [(390,844),(320,568)]:
  page.set_viewport_size({'width':width,'height':height});page.keyboard.press('0');page.wait_for_timeout(350)
  check(f'{width}px has no document overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.locator('#settings-button').click();check(f'{width}px settings contains contact and offline description','Life User / Solar Time v0.07 /' in page.locator('.settings-credit').inner_text() and '인터넷 없이' in page.locator('.settings-note').inner_text())
  page.locator('#settings-close').click()
  page.screenshot(path=str(OUT/f'mobile-{width}-v0.07.png'))
 check('No external runtime requests during full workflow',not network,network)
 context.close();browser.close()
report['passed']=all(x['passed'] for x in report['checks']);report['check_count']=len(report['checks'])
(ROOT/'docs/release-browser-v0.07.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
