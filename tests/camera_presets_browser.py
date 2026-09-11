"""v0.10 UI and surface regression. Offline injected HTML; storage is an explicit in-memory fixture.
HTTP/file navigation is blocked by the test browser. Real hardware GPU is unavailable.
"""
from pathlib import Path
import json, os, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
report={'version':'0.10','checks':[],'errors':[],'measurements':{},'limitations':[
 'Standalone HTML injected offline: loopback HTTP navigation was blocked by browser policy.',
 'Storage persistence/denial tests use an in-memory Storage fixture because about:blank cannot access localStorage.',
 'No hardware GPU is available. Jupiter purple flash was not reproduced; guards and CPU image continuity are tested.']}

def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail})
 print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok: raise AssertionError(name+': '+str(detail))

def load(ctx,initial=None,blocked=False):
 page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.evaluate('''({initial,blocked})=>{
  const values={...initial};window.__presetStorage=values;
  Object.defineProperty(window,'localStorage',{configurable:true,value:{
   getItem(k){if(blocked)throw new DOMException('Denied','SecurityError');return values[k]??null},
   setItem(k,v){if(blocked)throw new DOMException('Denied','QuotaExceededError');values[k]=String(v)},
   removeItem(k){delete values[k]}
  }});
 }''',{'initial':initial or {},'blocked':blocked})
 page.set_content((ROOT/'dist/Solar-Time_v0.10.html').read_text(),wait_until='load')
 page.wait_for_function('window.SolarTime?.version === "0.10"',timeout=18000)
 page.wait_for_function('document.getElementById("loading").hidden',timeout=10000)
 page.evaluate('''()=>{const {renderer:r,clock:c}=SolarTime;c.toggle(performance.now());r.setOption('skyMotion',false);r.setOption('comets',false);r.setOption('quality','low');}''')
 return page

def camera(page): return page.evaluate('SolarTime.renderer.cameraSnapshot()')
def presets(page): return page.evaluate('SolarTime.getPresets()')
def key(page,text): page.locator('#universe').focus();page.keyboard.press(text)
def visible_buttons(page): return set(page.locator('button:visible').evaluate_all('(els)=>els.map(e=>e.id)'))
def idle(page): page.wait_for_function('!document.body.classList.contains("pointer-awake")',timeout=4500);page.wait_for_timeout(220)

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':1648,'height':928},timezone_id='Asia/Seoul',offline=True)
  page=load(context)
  check('Title, release and creator are current',page.title()=='Solar Time' and 'Life User' in page.locator('.signature').inner_text() and 'v0.10' in page.locator('.signature').inner_text())
  check('Exactly three empty camera slots appear below Help',len(presets(page))==3 and presets(page)==[None]*3 and page.locator('#camera-presets').bounding_box()['y']>page.locator('#help-button').bounding_box()['y']+page.locator('#help-button').bounding_box()['height'])
  page.evaluate('''()=>{const r=SolarTime.renderer;r.faceFeature('earth',37.5665,126.978,SolarTime.clock.value(performance.now()));r.setZoom(18);r.setPan(.08,-.09)}''')
  first=camera(page);before_time=page.evaluate('({rate:SolarTime.clock.rate,live:SolarTime.clock.live,paused:SolarTime.clock.paused,anchor:SolarTime.clock.anchorMs})')
  page.locator('#camera-preset-1').click()
  check('Left click saves full current camera including Earth tracking',presets(page)[0]==first and page.locator('#camera-preset-1').get_attribute('data-saved')=='true')
  key(page,'0');page.keyboard.press('1')
  check('Key 1 recalls saved angle, zoom and pan exactly',camera(page)==first)
  check('Recall leaves time and speed unchanged',before_time==page.evaluate('({rate:SolarTime.clock.rate,live:SolarTime.clock.live,paused:SolarTime.clock.paused,anchor:SolarTime.clock.anchorMs})'))
  page.evaluate('SolarTime.renderer.setOrbitView(3.5,-.6)');page.locator('#camera-preset-1').click();overwritten=camera(page)
  check('Clicking an occupied slot saves the new camera as requested',presets(page)[0]==overwritten and overwritten!=first)
  for i,target in [(2,'moon'),(3,'jupiter')]:
   page.evaluate('(target)=>{const r=SolarTime.renderer;r.focusBody(target);r.setOrbitView(target==="moon"?1.4:4.2,-.25);r.setPan(-.1,.12)}',target)
   expected=camera(page);page.locator(f'#camera-preset-{i}').click();key(page,'0');page.keyboard.press(str(i))
   check(f'Camera {i} stores and recalls independently',presets(page)[i-1]==expected and camera(page)==expected)
  page.locator('#camera-preset-1').focus();page.keyboard.press('2');check('Number shortcut is not swallowed by focused buttons',camera(page)==presets(page)[1])
  page.screenshot(path=str(OUT/'presets-v0.10.png'))
  box=page.locator('#camera-preset-1').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  page.mouse.click(x,y,button='right');popup=page.locator('#preset-delete-dialog').bounding_box()
  expected_x=max(8,min(x+8,1648-popup['width']-8));expected_y=max(8,min(y+8,928-popup['height']-8))
  check('Right click opens confirmation near cursor and inside viewport',abs(popup['x']-expected_x)<1 and abs(popup['y']-expected_y)<1 and presets(page)[0] is not None,popup)
  check('Cancel, not Delete, receives initial popup focus',page.evaluate('document.activeElement.id')=='preset-delete-cancel')
  page.screenshot(path=str(OUT/'preset-delete-v0.10.png'))
  page.locator('#preset-delete-cancel').click();check('Cancel keeps saved slot unchanged',presets(page)[0]==overwritten)
  page.mouse.click(x,y,button='right');page.keyboard.press('Escape');check('Escape cancels without deleting',not page.locator('#preset-delete-dialog').evaluate('(el)=>el.open') and presets(page)[0]==overwritten)
  page.mouse.click(x,y,button='right');page.mouse.click(25,350);check('Click outside cancels without deleting',not page.locator('#preset-delete-dialog').evaluate('(el)=>el.open') and presets(page)[0]==overwritten)
  page.mouse.click(x,y,button='right');page.locator('#preset-delete-confirm').click()
  check('Only explicit Delete clears the selected slot',presets(page)[0] is None and presets(page)[1] is not None and presets(page)[2] is not None)
  page.mouse.click(x,y,button='right');check('Right click on an empty slot does not delete another slot or open confirmation',not page.locator('#preset-delete-dialog').evaluate('(el)=>el.open'))
  old=camera(page);key(page,'1');check('An empty number key leaves camera untouched',camera(page)==old)
  # Restore Earth-facing view to test both the timezone text and globe annotation across zen.
  page.evaluate('''()=>{const r=SolarTime.renderer;r.faceFeature('earth',37.5665,126.978,SolarTime.clock.value(performance.now()));r.setPan(0,0)}''');page.locator('#camera-preset-1').click()
  expected=camera(page);key(page,'h');page.wait_for_timeout(220)
  check('SEOUL remains readable as non-interactive text in viewing mode',page.locator('#timezone-readout').is_visible() and page.locator('#timezone-readout').inner_text()=='SEOUL' and page.locator('#timezone-button').is_hidden())
  check('Viewing mode still reveals only home and mode buttons',visible_buttons(page)=={'fit-view','show-ui'},sorted(visible_buttons(page)))
  idle(page)
  check('SEOUL remains visible after controls and cursor fade',page.locator('#timezone-readout').is_visible() and not visible_buttons(page))
  page.screenshot(path=str(OUT/'seoul-zen-v0.10.png'))
  page.keyboard.press('2');check('Key 2 recalls Moon while keeping viewing mode',camera(page)==presets(page)[1] and page.evaluate('SolarTime.getState().zen'))
  page.keyboard.press('1');check('Key 1 restores Earth while keeping viewing mode and current time',camera(page)==expected and page.evaluate('SolarTime.getState().zen'))
  page.mouse.move(300,420);idle(page);check('Preset recall does not leak preset buttons into idle viewing mode',not visible_buttons(page))
  page.keyboard.press('h');check('Normal timezone button and preset controls return on mode exit',page.locator('#timezone-button').is_visible() and page.locator('#timezone-readout').is_hidden() and page.locator('#camera-presets').is_visible())
  saved=page.evaluate('window.__presetStorage');expected=presets(page);page.close()
  page=load(context,saved);check('All slots survive app startup with persisted valid storage',presets(page)==expected)
  key(page,'3');check('Restored persisted slot recalls correct Jupiter camera',camera(page)==expected[2])
  # Test the actual CPU render path, plus an asynchronous material revision during rendering.
  page.evaluate('''()=>{const r=SolarTime.renderer;r.setOption('quality','low');r.setZoom(9);r.invalidateSurfaces();}''')
  page.wait_for_function('SolarTime.renderer.surface.frames.has("jupiter")',timeout=25000)
  audit=page.evaluate('''async()=>{
   const r=SolarTime.renderer,s=r.surface,first=s.get('jupiter'),accepted=s.stats.accepted;
   SolarAssets.materialRevision=(SolarAssets.materialRevision||0)+1;
   const mono=performance.now();r.draw(SolarTime.clock.value(mono),0,mono);
   const retained=s.get('jupiter')===first;
   await new Promise(resolve=>setTimeout(resolve,1000));
   const frames=s.frames,frame=frames.get('jupiter');
   return {retained,exists:!!frame,width:frame?.image.width,height:frame?.image.height,backend:s.stats.backend,kernel:s.stats.kernel,acceptedBefore:accepted,acceptedAfter:s.stats.accepted};
  }''')
  check('Jupiter stays visible while a new material generation is queued',audit['retained'] and audit['exists'],audit)
  page.wait_for_timeout(800)
  page.screenshot(path=str(OUT/'jupiter-v0.10.png'))
  report['measurements']['surface']=page.evaluate('SolarTime.renderer.surface.stats')
  # Observe a paused Jupiter for continuity; decorative sky motion is stopped, so no color drift is expected.
  report['measurements']['jupiter_samples']=page.evaluate('''async()=>{
   const s=SolarTime.renderer.surface,rows=[],c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');
   for(let i=0;i<16;i++){const b=s.get('jupiter');if(b){ctx.clearRect(0,0,1,1);ctx.drawImage(b,0,0,1,1);rows.push([...ctx.getImageData(0,0,1,1).data]);}else rows.push(null);await new Promise(r=>setTimeout(r,80));}return rows;
  }''')
  rows=report['measurements']['jupiter_samples'];check('Repeated settled Jupiter frames are nonempty and color-stable on CPU',all(v and v[3]>0 for v in rows) and max(max(v[k] for v in rows)-min(v[k] for v in rows) for k in range(3))<=2,rows)
  export=page.evaluate('async()=>{const html=await SolarTime.materials.offlineHTML();return {title:html.includes("<title>Solar Time</title>"),preset:html.includes("camera-preset-3"),version:html.includes("version:\'0.10\'"),popup:html.includes("preset-delete-dialog")}}')
  check('Image-inclusive export retains new preset UI and version',all(export.values()),export)
  page.close()
  corrupt=load(context,{'solar-time.camera-presets.v1':json.dumps({'schema':1,'slots':[{'zoom':999},None,None]})})
  check('Corrupt preset storage is ignored without breaking startup',presets(corrupt)==[None]*3);corrupt.close()
  blocked=load(context,blocked=True);blocked.locator('#camera-preset-1').click();key(blocked,'0');blocked.keyboard.press('1')
  check('Blocked storage still permits in-session save and recall',presets(blocked)[0] is not None and camera(blocked)==presets(blocked)[0]);blocked.close()
  for width,height in [(390,844),(320,568)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},timezone_id='Asia/Seoul',offline=True,has_touch=True,is_mobile=True)
   m=load(ctx)
   positions=m.locator('[data-preset]').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})')
   check(f'{width}px camera buttons remain within viewport beneath Help',all(q['x']>=0 and q['x']+q['w']<=width and q['y']>=m.locator('#help-button').bounding_box()['y']+m.locator('#help-button').bounding_box()['height'] for q in positions),positions)
   m.locator('#camera-preset-3').click();rect=m.locator('#camera-preset-3').bounding_box();m.mouse.click(rect['x']+15,rect['y']+15,button='right');r=m.locator('#preset-delete-dialog').bounding_box()
   check(f'{width}px confirmation is clamped at screen edge',r['x']>=7 and r['x']+r['width']<=width-7 and r['y']+r['height']<=height-7,r)
   m.screenshot(path=str(OUT/f'mobile-confirm-{width}-v0.10.png'));m.locator('#preset-delete-cancel').click()
   m.locator('#hide-ui').click();idle(m);check(f'{width}px SEOUL stays readable with no idle buttons',m.locator('#timezone-readout').is_visible() and not visible_buttons(m))
   ctx.close()
  context.close();browser.close()
 check('No uncaught browser errors',not report['errors'],report['errors'])
except Exception as e:
 report['fatal']=str(e);raise
finally:
 (ROOT/'docs/camera-presets-v0.10.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
