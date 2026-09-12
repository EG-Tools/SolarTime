"""v0.11 focused regression: offline app, save/delete modal, motion and sky.
Run after npm run build. Storage is a fixture because about:blank has no origin.
"""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
report={'version':'0.11','checks':[],'errors':[],'measurements':{},'limitations':['Linux headless Chromium; standalone HTML injected offline. Storage tests use an explicit fixture.','No hardware GPU available; screenshots use the CPU-compatible sky and worker surface paths.','No Windows physical-device or live image-server verification.']}
def check(name,value,detail=None):
 report['checks'].append({'name':name,'passed':bool(value),'detail':detail});print(('PASS ' if value else 'FAIL ')+name,flush=True)
 (ROOT/'docs/camera-presets-v0.11.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if not value:raise AssertionError(name+': '+str(detail))
def load(ctx,initial=None,blocked=False):
 page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.evaluate('''({initial,blocked})=>{const data={...initial};window.__presetStorage=data;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){if(blocked)throw Error('blocked');return data[k]??null},setItem(k,v){if(blocked)throw Error('blocked');data[k]=String(v)}}})}''',{'initial':initial or {},'blocked':blocked})
 page.set_content((ROOT/'dist/Solar-Time_v0.11.html').read_text(),wait_until='load');page.wait_for_function('window.SolarTime?.version==="0.11"',timeout=20000)
 page.wait_for_function('document.getElementById("loading").hidden',timeout=10000)
 page.evaluate('''()=>{const r=SolarTime.renderer;r.setOption('skyMotion',false);r.setOption('comets',false);SolarTime.clock.setDate(Date.UTC(2026,8,12,0),performance.now());}''')
 return page
def camera(p):return p.evaluate('SolarTime.renderer.cameraSnapshot()')
def slots(p):return p.evaluate('SolarTime.getPresets()')
def key(p,k):p.locator('#universe').focus();p.keyboard.press(k)
def settled(p):p.wait_for_function('!SolarTime.renderer.cameraTween',timeout=5000)
def save(p,n):
 p.locator(f'#camera-preset-{n}').click();p.locator('#preset-confirm').click()
def visbuttons(p):return set(p.locator('button:visible').evaluate_all('(els)=>els.map(e=>e.id)'))
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=b.new_context(viewport={'width':1648,'height':928},timezone_id='Asia/Seoul',offline=True)
  if not os.environ.get('MOBILE_ONLY'):
   page=load(ctx)
   page.wait_for_timeout(3000)
   check('Offline startup, exact title and v0.11 creator',page.title()=='Solar Time' and 'Life User' in page.locator('.signature').inner_text() and 'v0.11' in page.locator('.signature').inner_text())
   rects=[page.locator('#camera-preset-'+str(i)).bounding_box() for i in (1,2,3)];helpbox=page.locator('#help-button').bounding_box()
   check('Three half-size buttons share one horizontal row under Help',all(abs(q['y']-rects[0]['y'])<.1 and abs(q['width']-19)<.1 and abs(q['height']-19)<.1 for q in rects) and rects[0]['x']<rects[1]['x']<rects[2]['x'] and rects[0]['y']>helpbox['y']+helpbox['height'],rects)
   page.screenshot(path=str(OUT/'overview-v0.11.png'))
   check('Inherited v0.10 key starts with three empty slots in empty storage',slots(page)==[None]*3)
   page.evaluate("SolarTime.renderer.setOrbitView(1.7,-.25)");first=camera(page);page.locator('#camera-preset-1').click()
   check('Left click opens 1번 카메라 / 취소 / 저장 and does not save yet',page.locator('#preset-title').inner_text()=='1번 카메라' and page.locator('#preset-confirm').inner_text()=='저장' and slots(page)[0] is None)
   check('Cancel receives initial focus',page.evaluate('document.activeElement.id')=='preset-cancel')
   popup=page.locator('#preset-dialog').bounding_box();check('Save popup fits the screen near the pointer',popup['x']>=8 and popup['x']+popup['width']<=1641 and abs(popup['y']-(rects[0]['y']+rects[0]['height']/2+8))<1,popup)
   page.screenshot(path=str(OUT/'preset-save-v0.11.png'))
   page.locator('#preset-cancel').click();check('Save cancellation leaves slot empty',slots(page)[0] is None)
   page.locator('#camera-preset-1').click();page.keyboard.press('Escape');check('Escape cancels pending save',slots(page)[0] is None and not page.locator('#preset-dialog').evaluate('(e)=>e.open'))
   page.locator('#camera-preset-1').click();page.mouse.click(25,450);check('Outside click cancels pending save',slots(page)[0] is None)
   save(page,1);check('Only explicit Save stores current pose',slots(page)[0]==first)
   page.evaluate('SolarTime.renderer.setOrbitView(2.3,.1)');page.locator('#camera-preset-1').click();check('Occupied slot asks before overwriting',slots(page)[0]==first and '덮어' in page.locator('#preset-note').inner_text())
   page.locator('#preset-cancel').click();check('Cancelled overwrite preserves prior pose',slots(page)[0]==first)
   oldclock=page.evaluate('({anchor:SolarTime.clock.anchorMs,rate:SolarTime.clock.rate,paused:SolarTime.clock.paused})')
   key(page,'1');check('Shortcut starts a renderer-owned camera animation',page.evaluate('!!SolarTime.renderer.cameraTween'))
   page.wait_for_timeout(250);check('Intermediate camera is between old and target, not teleported',camera(page)!=first and .1>camera(page)['elevation']>first['elevation'])
   settled(page);check('Camera arrives at exact saved pose',camera(page)==first)
   check('Transition did not alter simulation time/rate/pause',oldclock==page.evaluate('({anchor:SolarTime.clock.anchorMs,rate:SolarTime.clock.rate,paused:SolarTime.clock.paused})'))
   page.evaluate("SolarTime.renderer.focusBody('moon');SolarTime.renderer.setZoom(20)");save(page,2)
   page.evaluate("SolarTime.renderer.focusBody('jupiter');SolarTime.renderer.setZoom(23);SolarTime.renderer.setOrbitView(2.1,.4)");save(page,3)
   sky_before=page.evaluate('SolarTime.renderer.sky.stats.frames');key(page,'2');start=camera(page)
   trace=page.evaluate('''async()=>{const out=[];const r=SolarTime.renderer;for(let i=0;i<26;i++){await new Promise(res=>setTimeout(res,65));out.push({camera:r.cameraSnapshot(),active:!!r.cameraTween,largest:Math.max(...r.projected.map(p=>p.r))});}return out;}''')
   settled(page);check('Different targets travel smoothly and arrive at Moon',camera(page)==slots(page)[1] and any(s['active'] and s['camera']['zoom']<2 for s in trace),{'sampleCount':len(trace),'minimumZoom':min(s['camera']['zoom'] for s in trace)})
   check('Transition preserves the per-body size cap',all(s['largest']<928*.34+1 for s in trace))
   check('CPU sky produces intermediate frames instead of freezing until transition ends',page.evaluate('SolarTime.renderer.sky.stats.frames')-sky_before>=3)
   report['measurements']['transitionSamples']=trace
   key(page,'1');page.wait_for_timeout(180);page.keyboard.press('3');settled(page);check('Rapid shortcut retargeting ends at latest requested camera',camera(page)==slots(page)[2])
   key(page,'2');page.wait_for_timeout(200);page.mouse.move(700,450);page.mouse.down();page.mouse.move(745,470,steps=3);page.mouse.up();stop=camera(page);page.wait_for_timeout(1700)
   check('Manual drag interrupts transition without resuming it later',not page.evaluate('!!SolarTime.renderer.cameraTween') and camera(page)==stop)
   key(page,'1');page.wait_for_timeout(200);page.keyboard.press('0');page.wait_for_timeout(1300);check('Home interrupts camera transition',camera(page)['zoom']==1 and camera(page)['focus'] is None and not page.evaluate('!!SolarTime.renderer.cameraTween'))
   page.locator('#camera-preset-1').click(button='right');check('Right click still asks Delete, separate from Save',page.locator('#preset-confirm').inner_text()=='삭제' and slots(page)[0]==first)
   page.locator('#preset-cancel').click();check('Cancelled deletion preserves pose',slots(page)[0]==first)
   page.locator('#camera-preset-1').click(button='right');page.locator('#preset-confirm').click();check('Confirmed deletion clears only chosen slot',slots(page)[0] is None and slots(page)[1] is not None and slots(page)[2] is not None)
   page.locator('#camera-preset-1').click(button='right');check('Empty slot has no deletion modal',not page.locator('#preset-dialog').evaluate('(e)=>e.open'))
   before=camera(page);key(page,'1');check('Empty shortcut leaves current camera unchanged',camera(page)==before)
   page.evaluate("SolarTime.renderer.faceFeature('earth',37.5665,126.978,SolarTime.clock.value(performance.now()))");save(page,1);key(page,'h');page.wait_for_timeout(200)
   check('Zen shows only Home and mode controls on activity',visbuttons(page)=={'fit-view','show-ui'})
   check('SEOUL remains visible in zen',page.locator('#timezone-readout').is_visible() and page.locator('#timezone-readout').inner_text()=='SEOUL')
   page.wait_for_function('!document.body.classList.contains("pointer-awake")',timeout=4000);page.wait_for_timeout(240);check('Zen idle keeps buttons hidden',not visbuttons(page))
   page.keyboard.press('2');settled(page);check('Preset switching works in zen without showing preset buttons',page.evaluate('SolarTime.getState().zen') and camera(page)==slots(page)[1] and page.locator('#camera-presets').is_hidden())
   page.keyboard.press('h');key(page,'0')
   # Force one normal-path background comet to a deterministic visible point.
   page.evaluate('''()=>{const r=SolarTime.renderer,s=r.sky,t=SolarTime.getState().effectTime;const point=(x,y)=>s.toPanorama(s.ray(x,y));r.setOption('comets',true);s.comet={start:point(40,240),control1:point(560,55),control2:point(1030,95),end:point(1590,330),time:t-12,duration:18};s.nextComet=t+1000;}''')
   page.wait_for_timeout(500);page.screenshot(path=str(OUT/'comet-v0.11.png'))
   report['measurements']['backends']=page.evaluate('({sky:SolarTime.renderer.sky.stats.backend,surface:SolarTime.renderer.surface.stats.kernel?.backend})')
   check('All received surfaces still belong to the correct body',page.evaluate('Array.from(SolarTime.renderer.surface.frames).every(([id,f])=>f.job.id===id)'))
   result=page.evaluate('''async()=>{const html=await SolarTime.materials.offlineHTML();return {title:html.includes('<title>Solar Time</title>'),version:html.includes("version:'0.11'"),confirmation:html.includes('id="preset-dialog"'),motion:html.includes('animateCamera('),ribbon:html.includes('drawCometRibbon(')};}''')
   check('Image-inclusive HTML export retains all new code and title',all(result.values()),result)
   data=page.evaluate('window.__presetStorage');expected=slots(page);page.close()
   restored=load(ctx,data);check('v1 camera storage remains compatible and persistent',slots(restored)==expected);key(restored,'3');settled(restored);check('Reloaded slot interpolates to correct camera',camera(restored)==expected[2]);restored.close()
   blocked=load(ctx,blocked=True);save(blocked,1);key(blocked,'0');key(blocked,'1');settled(blocked);check('Blocked storage allows in-session confirm/save/recall',slots(blocked)[0] is not None and camera(blocked)==slots(blocked)[0]);blocked.close()
  for width in (390,320):
   c=b.new_context(viewport={'width':width,'height':844 if width==390 else 568},offline=True,has_touch=True,timezone_id='Asia/Seoul');m=load(c)
   rs=[m.locator('#camera-preset-'+str(i)).bounding_box() for i in (1,2,3)]
   check(f'{width}px mobile buttons are horizontal and half size',all(abs(q['y']-rs[0]['y'])<1 and abs(q['width']-16.5)<.1 for q in rs) and rs[-1]['x']+rs[-1]['width']<=width-8,rs)
   m.locator('#camera-preset-3').tap();popup=m.locator('#preset-dialog').bounding_box()
   check(f'{width}px touch opens save modal inside viewport',popup['x']>=8 and popup['x']+popup['width']<=width-7 and m.locator('#preset-title').inner_text()=='3번 카메라' and slots(m)[2] is None,popup)
   m.screenshot(path=str(OUT/f'mobile-save-{width}-v0.11.png'));m.locator('#preset-confirm').tap();check(f'{width}px touch Save confirms only chosen slot',slots(m)[2] is not None and slots(m)[0] is None)
   c.close()
  check('No uncaught application exceptions',not report['errors'],report['errors']);ctx.close();b.close()
finally:
 report['passed']=bool(report['checks']) and all(q['passed'] for q in report['checks']) and not report['errors']
 (ROOT/'docs/camera-presets-v0.11.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
