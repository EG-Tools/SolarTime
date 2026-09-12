"""v0.13 focused UI/render lifecycle regressions. Local-source and bundle modes.
Navigation is restricted in the test environment; load HTML via set_content.
LocalStorage uses an explicit test adapter (not a native-origin persistence test).
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json,time
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
SECTION=os.environ.get('SECTION','ui');MODE=os.environ.get('MODE','source')
REPORT=ROOT/f'docs/refinements-{SECTION}{os.environ.get("WIDTH","")}-v0.13.json'
report={'version':'0.13','section':SECTION,'mode':MODE,'checks':[],'errors':[],'measurements':{},'limitations':['Offline HTML injection; localhost navigation returned ERR_BLOCKED_BY_ADMINISTRATOR.','LocalStorage uses a test adapter on the opaque document origin.','Hardware GPU and actual Windows launch are not verified.']}
def record(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+str(detail))
def document():
 if MODE=='bundle':return (ROOT/'dist/Solar-Time_v0.13.html').read_text()
 text=(ROOT/'index.html').read_text().replace('<link rel="stylesheet" href="styles.css">','<style>'+(ROOT/'styles.css').read_text()+'</style>')
 for name in ['assets','materials','astro','surface','sky','renderer','app']:
  id=' id="solar-assets"' if name=='assets' else ''
  text=text.replace(f'<script{id} src="src/{name}.js"></script>',f'<script{id}>'+ (ROOT/f'src/{name}.js').read_text().replace('</script','<\\/script')+'</script>')
 return text
HTML=document()
def load(ctx,preferences=None):
 p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)))
 p.evaluate('''data=>{window.testStorage=data;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.testStorage[k]??null,setItem:(k,v)=>{window.testStorage[k]=String(v)}}});}''', preferences or {})
 p.set_content(HTML,wait_until='load');p.wait_for_function('window.SolarTime?.version==="0.13"');p.wait_for_function('document.getElementById("loading").hidden');return p
TOOLBAR=['zoom-in','zoom-out','fit-view','camera-preset-1','camera-preset-2','camera-preset-3','rotate-left','rotate-right','zen-toggle']
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 try:
  ctx=browser.new_context(viewport={'width':1648,'height':928},offline=True,timezone_id='Asia/Seoul',reduced_motion='no-preference')
  p=load(ctx);report['measurements']['browser']=browser.version
  if SECTION=='ui':
   record('Starts v0.13 offline with correct title',p.title()=='Solar Time' and not p.evaluate('navigator.onLine') and p.locator('#fatal-error').is_hidden())
   record('Seconds and label avoidance default OFF',p.locator('#seconds-group').is_hidden() and not p.evaluate('SolarTime.renderer.options.avoidLabels') and not p.evaluate('SolarTime.getState().showSeconds'))
   record('Clock accessible time excludes seconds by default','초' not in p.locator('#wall-clock').get_attribute('aria-label'))
   record('One same-size mode toggle after right rotation; footer mode button removed',p.locator('#view-controls button').evaluate_all('(es)=>es.map(e=>e.id)')==TOOLBAR and p.locator('#hide-ui,#show-ui').count()==0 and p.locator('#zen-toggle').bounding_box()['width']==p.locator('#rotate-right').bounding_box()['width'])
   nav=p.locator('#planet-nav').bounding_box();record('Footer planet navigation stays screen centered',abs(nav['x']+nav['width']/2-824)<1,nav)
   p.locator('#camera-preset-1').click();left=p.locator('#preset-dialog').inner_text()
   record('Left-click opens Apply Save Delete Cancel in order',p.locator('.preset-actions button').all_text_contents()==['적용','저장','삭제','취소'])
   record('Empty slot disables apply and delete only',p.locator('#preset-apply').is_disabled() and p.locator('#preset-delete').is_disabled() and p.locator('#preset-save').is_enabled())
   p.locator('#preset-cancel').click();p.locator('#camera-preset-1').click(button='right')
   record('Right-click opens the exact same menu for an empty slot',p.locator('#preset-dialog').inner_text()==left)
   p.locator('#preset-cancel').click();record('Cancel does not write an empty preset',p.evaluate('SolarTime.getPresets()[0]') is None)
   p.evaluate('SolarTime.renderer.setOrbitView(1.4,.42);SolarTime.renderer.setPan(.11,-.07)')
   first=p.evaluate('SolarTime.renderer.cameraSnapshot()');p.locator('#camera-preset-1').click();p.locator('#preset-save').click()
   record('Save writes camera angle, zoom, focus and both pan axes',p.evaluate('SolarTime.getPresets()[0]')==first)
   p.locator('#fit-view').click();p.locator('#camera-preset-1').click(button='right');record('Saved slot enables apply and delete',p.locator('#preset-apply').is_enabled() and p.locator('#preset-delete').is_enabled())
   p.screenshot(path=str(OUT/'camera-menu-v0.13.png'))
   p.locator('#preset-apply').click();record('Apply initiates smooth transition instead of an immediate jump',p.evaluate('!!SolarTime.renderer.cameraTween'))
   p.wait_for_function('!SolarTime.renderer.cameraTween');record('Apply arrives exactly at saved camera',p.evaluate('SolarTime.renderer.cameraSnapshot()')==first)
   p.locator('#fit-view').click();p.locator('#universe').focus();p.keyboard.press('1');p.wait_for_function('!SolarTime.renderer.cameraTween');record('Number shortcut retains same smooth recall',p.evaluate('SolarTime.renderer.cameraSnapshot()')==first)
   p.locator('#camera-preset-2').click();p.locator('#preset-save').click();second=p.evaluate('SolarTime.getPresets()[1]')
   p.locator('#camera-preset-1').click(button='right');p.keyboard.press('Escape');record('Esc cancels without deleting a saved camera',p.evaluate('SolarTime.getPresets()[0]')==first)
   p.locator('#camera-preset-1').click();p.locator('#preset-delete').click();record('Explicit delete affects only selected slot',p.evaluate('SolarTime.getPresets()[0]') is None and p.evaluate('SolarTime.getPresets()[1]')==second)
   p.locator('#fit-view').click();p.locator('#settings-button').click();p.locator('#show-seconds').check();record('Enabling seconds shows both separator and digits',p.locator('#seconds-group').is_visible() and p.locator('#seconds-group .colon').is_visible() and p.evaluate('SolarTime.getState().showSeconds'))
   p.locator('#avoid-labels').check();record('Avoidance option drives the renderer and persisted settings',p.evaluate('SolarTime.renderer.options.avoidLabels') and json.loads(p.evaluate('localStorage.getItem("eg.solar-time.v0.01")'))['avoidLabels'])
   saved=p.evaluate('window.testStorage');p.locator('#show-seconds').uncheck();p.locator('#avoid-labels').uncheck();p.locator('#settings-close').click()
   record('Turning seconds OFF hides whole group without changing simulation rate',p.locator('#seconds-group').is_hidden() and p.evaluate('SolarTime.getState().rate')==1)
   p.locator('#zen-toggle').click();p.wait_for_timeout(250)
   record('Toolbar toggle enters zen and reflects pressed state',p.evaluate('SolarTime.getState().zen') and p.locator('#zen-toggle').get_attribute('aria-pressed')=='true')
   p.screenshot(path=str(OUT/'zen-awake-v0.13.png'));p.wait_for_function('!document.body.classList.contains("pointer-awake")');p.wait_for_timeout(220)
   record('Zen idle hides toolbar and cursor, keeps Seoul readout',p.locator('#view-controls').is_hidden() and p.locator('#timezone-readout').is_visible() and p.locator('#timezone-readout').inner_text()=='SEOUL' and p.locator('body').evaluate('e=>getComputedStyle(e).cursor')=='none')
   p.mouse.move(1200,430);p.wait_for_timeout(230);record('Mouse movement reveals same complete toolbar',p.locator('#view-controls button:visible').evaluate_all('(es)=>es.map(e=>e.id)')==TOOLBAR)
   p.locator('#camera-preset-2').click(button='right');p.wait_for_timeout(1900);record('Unified popup remains awake and usable in zen',p.locator('#preset-dialog').is_visible() and p.locator('#preset-apply').is_visible() and p.evaluate('document.body.classList.contains("pointer-awake")'))
   p.locator('#preset-cancel').click();p.locator('#zen-toggle').click();record('Same toggle exits zen; normal toolbar not inert',not p.evaluate('SolarTime.getState().zen') and not p.locator('#view-controls').evaluate('e=>e.inert'))
   p.evaluate('SolarTime.renderer.setOption("activity",false);SolarTime.renderer.setOption("skyMotion",false)');p.screenshot(path=str(OUT/'overview-v0.13.png'))
   p.close();q=load(ctx,saved);record('Saved display options and camera slots load on next startup',q.locator('#seconds-group').is_visible() and q.evaluate('SolarTime.renderer.options.avoidLabels') and q.evaluate('SolarTime.getPresets()[1]')==second);q.close()
  elif SECTION=='graphics':
   p.evaluate('''()=>{const r=SolarTime.renderer;r.options.skyMotion=false;r.options.activity=false;r.options.twinkle=false;r.options.comets=false;SolarTime.clock.toggle(performance.now());r.faceFeature('earth',37.5665,126.978,SolarTime.clock.value(performance.now()));r.setZoom(64);}''')
   p.wait_for_function('SolarTime.renderer.surface.frames.get("earth")?.job.textureWidth===4096 && SolarTime.renderer.surface.stats.kernel',timeout=20000)
   record('First detailed Earth result requests 4096 texture and bounded raster directly',p.evaluate('SolarTime.renderer.surface.frames.get("earth").job.diam<=1024 && SolarTime.renderer.surface.frames.get("earth").job.textureWidth===4096'))
   p.evaluate('''()=>{const r=SolarTime.renderer;window.lastSurface=r.surface;window.lastWorker=r.surface.worker;window.lastEarth=r.surface.get('earth');window.texBefore=r.surface.stats.kernel.texturesBuilt;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}''')
   record('Hiding tab retains last textured Earth and owner',p.evaluate('SolarTime.renderer.surface===lastSurface && lastSurface.get("earth")===lastEarth && lastSurface.paused'))
   count=p.evaluate('lastSurface.stats.submitted');p.wait_for_timeout(350);record('Hidden tab submits no new surface jobs',p.evaluate('lastSurface.stats.submitted')==count)
   p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))')
   record('Tab return has a complete existing texture before any new frame',p.evaluate('lastSurface.get("earth")===lastEarth && SolarTime.renderer.surface===lastSurface && lastSurface.worker===lastWorker'))
   p.wait_for_timeout(1200);record('Decoded maps are reused across tab return',p.evaluate('lastSurface.stats.kernel.texturesBuilt===texBefore'))
   p.evaluate('''()=>{const r=SolarTime.renderer;window.jobBefore=r.surface.frames.get('earth').job;r.setOrbitView(r.camera.azimuth+.025,r.camera.elevation+.015);}''')
   p.wait_for_timeout(30)
   record('Camera drag frame never requests low-detail preview',p.evaluate('[...lastSurface.desired.values()].filter(j=>j.id==="earth").every(j=>j.diam===jobBefore.diam&&j.textureWidth===4096)'))
   p.wait_for_function('lastSurface.frames.get("earth").job.geometry===lastSurface.desired.get("earth").geometry',timeout=15000)
   record('Camera settles at exact new pose with high detail',p.evaluate('lastSurface.frames.get("earth").job.textureWidth===4096'))
   p.evaluate('''()=>{const r=SolarTime.renderer;r.faceFeature('earth',37.5665,126.978,SolarTime.clock.value(performance.now()));r.setZoom(256);}''')
   p.wait_for_function('lastSurface.frames.get("earth").job.diam===1024',timeout=15000)
   size=p.evaluate('SolarTime.renderer.projected.find(p=>p.body.id==="earth").r*2');record('Korea close-up can exceed viewport while preserving 1024 output cap',abs(size-928*2.2)<.01 and p.evaluate('lastSurface.get("earth").width<=1024'),size)
   p.screenshot(path=str(OUT/'korea-closeup-v0.13.png'))
   p.evaluate('SolarTime.renderer.focusBody("moon");SolarTime.renderer.setZoom(256)');p.wait_for_function('lastSurface.frames.has("moon")',timeout=15000)
   record('Small Moon receives the same extended zoom, not a global scale multiplier',p.evaluate('Math.abs(SolarTime.renderer.projected.find(p=>p.body.id==="moon").r*2-928*2.2)<.01 && SolarTime.renderer.projected.find(p=>p.body.id==="sun").r<260'))
   # Actual embedded source images all pass through the exact production texture pipeline.
   seam=p.evaluate('''async()=>{const k=SolarSurface.kernel();k.setAssets(SolarAssets.materials);const e=new k.Engine({gpu:false});const rows=[];for(const id of Object.keys(SolarAssets.materials)){const t=await e.texture(id,1024);let max=0;for(let y=0;y<t.height;y++)for(let c=0;c<4;c++)max=Math.max(max,Math.abs(t.data[y*t.width*4+c]-t.data[(y*t.width+t.width-1)*4+c]));rows.push({id,width:t.width,maxEdgeDifference:max});}e.clear();return rows;}''')
   record('Every embedded planet, cloud and relief map has matching left/right pixels',all(x['maxEdgeDifference']==0 for x in seam),seam)
   report['measurements']['surfaceBackend']=p.evaluate('lastSurface.stats');p.close()
  elif SECTION=='mobile':
   p.close()
   for w,h in [(390,844),(320,568),(844,390)]:
    if os.environ.get('WIDTH') and w!=int(os.environ['WIDTH']):continue
    c=browser.new_context(viewport={'width':w,'height':h},offline=True,timezone_id='Asia/Seoul',is_mobile=True,has_touch=True);q=load(c)
    rs=q.locator('#view-controls button:visible').evaluate_all('(es)=>es.map(e=>{const b=e.getBoundingClientRect();return {id:e.id,x:b.x,y:b.y,w:b.width,h:b.height}})')
    record(f'{w}x{h}: toolbar fits without clipping',all(x['x']>=0 and x['y']>=0 and x['x']+x['w']<=w and x['y']+x['h']<=h for x in rs),rs)
    record(f'{w}x{h}: toolbar buttons are not covered by playback or other UI',q.locator('#view-controls button:visible').evaluate_all('(es)=>es.every(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest("button")===e})'))
    q.locator('#camera-preset-1').click();box=q.locator('#preset-dialog').bounding_box()
    record(f'{w}x{h}: four-action popup clamped at cursor inside screen',box['x']>=8 and box['y']>=8 and box['x']+box['width']<=w-7 and box['y']+box['height']<=h-7,box)
    record(f'{w}x{h}: four popup actions are visible',all(q.locator('#'+id).is_visible() for id in ['preset-apply','preset-save','preset-delete','preset-cancel']))
    if w==320:
     q.evaluate('SolarTime.clock.toggle(performance.now());SolarTime.renderer.options.skyMotion=false')
     print('Taking optional mobile screenshot',flush=True)
     q.screenshot(path=str(OUT/'mobile-menu-v0.13.png'),timeout=7000)
     print('Mobile screenshot ready',flush=True)
    print('Closing popup and entering mobile zen',flush=True)
    q.locator('#preset-cancel').click(timeout=5000);q.locator('#zen-toggle').click(timeout=5000);q.wait_for_timeout(250)
    record(f'{w}x{h}: mode toggle works and Seoul stays visible',q.evaluate('SolarTime.getState().zen') and q.locator('#timezone-readout').is_visible())
    q.locator('#zen-toggle').click();q.locator('#settings-button').click();q.locator('#show-seconds').check()
    record(f'{w}x{h}: seconds and settings remain accessible',q.locator('#seconds-group').is_visible());c.close()
  record('No uncaught page errors',len(report['errors'])==0,report['errors'])
 finally:
  REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
