"""v0.12: shared right toolbar, camera yaw, saved views and zen input.
The offline bundle is injected because direct file navigation is blocked here.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, math, os, time
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
SECTION=os.environ.get('SECTION','all')
REPORT=ROOT/('docs/orbit-controls-'+SECTION+'-v0.12.json')
report={'version':'0.12','checks':[],'errors':[],'measurements':{},'limitations':['Linux headless Chromium; standalone HTML injected offline. Direct file navigation returned ERR_BLOCKED_BY_ADMINISTRATOR.','Camera storage uses an explicit in-memory test adapter. Windows launch and physical input are not tested.','Hardware GPU and live texture downloads are not verified.'], 'repository_changed':False,'deployed':False}
NORMAL=['zoom-in','zoom-out','fit-view','camera-preset-1','camera-preset-2','camera-preset-3','rotate-left','rotate-right'];ZEN=NORMAL+['show-ui']
BUNDLE=(ROOT/'dist/Solar-Time_v0.12.html').read_text()
def check(name,ok,detail=None):
 report['checks'].append({'name':name,'passed':bool(ok),'detail':detail});REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name+': '+str(detail))
def load(ctx):
 p=ctx.new_page();p.on('pageerror',lambda e:report['errors'].append(str(e)))
 p.evaluate('''()=>{const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)}}});}''')
 t=time.perf_counter();p.set_content(BUNDLE,wait_until='load');p.wait_for_function('window.SolarTime?.version==="0.12"',timeout=20000);p.wait_for_function('document.getElementById("loading").hidden',timeout=10000)
 report['measurements'].setdefault('injectedStartupMs',round((time.perf_counter()-t)*1000,1));return p
def camera(p):return p.evaluate('SolarTime.renderer.cameraSnapshot()')
def sample(p):return p.evaluate('({mono:performance.now(),camera:SolarTime.renderer.cameraSnapshot(),direction:SolarTime.renderer.autoRotateDirection})')
def delta(a,b):return math.atan2(math.sin(b-a),math.cos(b-a))
def speed(a,b):return delta(a['camera']['azimuth'],b['camera']['azimuth'])*180/math.pi/((b['mono']-a['mono'])/1000)
def toolbar(p):return p.locator('#view-controls button:visible').evaluate_all('(es)=>es.map(e=>e.id)')
def visible(p):return set(p.locator('button:visible').evaluate_all('(es)=>es.map(e=>e.id)'))
def key(p,k):p.locator('#universe').focus();p.keyboard.press(k)
def idle(p):p.wait_for_function('!document.body.classList.contains("pointer-awake")',timeout=5000);p.wait_for_timeout(220)
def geometry(p):return p.locator('#view-controls button:visible').evaluate_all('(es)=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2}})')
def fits(rs,w,h):return all(r['x']>=0 and r['y']>=0 and r['x']+r['w']<=w and r['y']+r['h']<=h for r in rs)
def column(rs):return all(abs(r['cx']-rs[0]['cx'])<1 for r in rs) and all(a['y']+a['h']<=b['y'] for a,b in zip(rs,rs[1:]))
try:
 with sync_playwright() as tool:
  browser=tool.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage']);report['measurements']['browserVersion']=browser.version
  if SECTION in ('all','core','remaining'):
   ctx=browser.new_context(viewport={'width':1648,'height':928},device_scale_factor=1,offline=True,timezone_id='Asia/Seoul');p=load(ctx)
   if SECTION in ('all','core'):
    check('Offline v0.12 starts with Solar Time tab title',p.title()=='Solar Time' and not p.evaluate('navigator.onLine') and p.locator('#fatal-error').is_hidden())
    rows=geometry(p);check('Single toolbar order is +, minus, home, 1, 2, 3, left, right',toolbar(p)==NORMAL,toolbar(p));check('Vertical column centered and no buttons overlap',column(rows) and fits(rows,1648,928),rows)
    check('Preset buttons moved, not cloned, and no longer beneath Help',p.locator('#camera-presets').count()==1 and p.locator('.masthead #camera-presets').count()==0 and p.locator('#fit-view').count()==1)
    check('Home and mode are icon-only with accessible names',p.locator('#fit-view').inner_text()=='' and p.locator('#show-ui').inner_text()=='' and p.locator('#fit-view').get_attribute('aria-label')=='기본 시점')
    check('Compact visual preset circles stay 19px',p.locator('#camera-preset-1').evaluate('e=>{const s=getComputedStyle(e,"::before");return parseFloat(s.width)+parseFloat(s.borderLeftWidth)+parseFloat(s.borderRightWidth)}')==19)
    before=camera(p);p.locator('#rotate-left').click();a=sample(p);p.wait_for_timeout(1000);b=sample(p);report['measurements']['leftDegreesPerSecond']=speed(a,b)
    check('Left toggle runs at 2 degrees per real second',-2.15<speed(a,b)<-1.85 and b['direction']==-1,speed(a,b))
    check('Automatic yaw preserves elevation, zoom, pan and target',all(b['camera'][k]==before[k] for k in ('elevation','zoom','panX','panY','focus')))
    check('Direction buttons are mutually exclusive and aria-pressed matches',p.locator('#rotate-left').get_attribute('aria-pressed')=='true' and p.locator('#rotate-right').get_attribute('aria-pressed')=='false')
    prior=sample(p);p.locator('#rotate-right').click();a=sample(p);check('Opposite toggle reverses from current pose',abs(delta(prior['camera']['azimuth'],a['camera']['azimuth']))<.06 and a['direction']==1)
    p.wait_for_timeout(1000);b=sample(p);report['measurements']['rightDegreesPerSecond']=speed(a,b);check('Right yaw uses the same slow speed',1.85<speed(a,b)<2.15,speed(a,b))
    p.locator('#rotate-right').click();stopped=camera(p);p.wait_for_timeout(300);check('Active toggle stops without resetting view',camera(p)==stopped and p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    p.locator('[data-rate="604800"]').click();p.locator('#pause-button').click();p.locator('#rotate-left').click();a=sample(p);p.wait_for_timeout(900);b=sample(p)
    check('Orbital rate and pause do not change camera speed',p.evaluate('SolarTime.clock.paused') and -2.2<speed(a,b)<-1.8,speed(a,b))
    p.locator('#fit-view').click();check('Home stops auto rotation and resets framing',camera(p)['zoom']==1 and camera(p)['focus'] is None and p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    p.locator('#rotate-left').click();p.locator('#zoom-in').click();check('Zoom takes manual control and stops yaw',camera(p)['zoom']>1 and p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    p.locator('#rotate-left').click();p.mouse.move(680,410);p.mouse.down();p.mouse.move(735,430,steps=6);p.mouse.up();check('Drag takes manual control and stops yaw',p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    p.locator('#fit-view').click();p.evaluate("SolarTime.renderer.focusBody('jupiter');SolarTime.renderer.setZoom(64)");p.wait_for_function('!!SolarTime.renderer.surface.get("jupiter")',timeout=20000)
    p.locator('#rotate-right').click();a=sample(p);accepted=p.evaluate('SolarTime.renderer.surface.stats.accepted');p.wait_for_timeout(2400);b=sample(p)
    stats=p.evaluate('({accepted:SolarTime.renderer.surface.stats.accepted,desired:SolarTime.renderer.surface.desired.get("jupiter")})')
    check('Close-up rotation preserves focus and zoom',b['camera']['focus']=='jupiter' and b['camera']['zoom']==64 and all(b['camera'][k]==a['camera'][k] for k in ('elevation','panX','panY')))
    check('Continuous yaw receives finished texture frames instead of starving',stats['accepted']>accepted+1,{'before':accepted,'after':stats['accepted']})
    check('Slow orbit does not use low 192px drag preview',stats['desired']['diam']>=512,stats['desired']['diam'])
    report['measurements']['renderBackends']=p.evaluate('({surface:SolarTime.renderer.surface.stats.backend,kernel:SolarTime.renderer.surface.stats.kernel,sky:SolarTime.renderer.sky.stats.backend})')
    p.locator('#camera-preset-1').click();check('Saving stops motion and asks Cancel/Save',p.locator('#preset-dialog').is_visible() and p.locator('#preset-title').inner_text()=='1번 카메라' and p.locator('#preset-confirm').inner_text()=='저장' and p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    check('Slot stays empty before confirmation',p.evaluate('SolarTime.getPresets()[0]') is None)
    p.locator('#preset-confirm').click();saved=p.evaluate('SolarTime.getPresets()[0]');check('Saved data stays v1 pose-only without auto-rotation state',saved==camera(p) and set(saved)=={'azimuth','elevation','zoom','panX','panY','focus'})
    p.locator('#camera-preset-1').click(button='right');check('Right click still asks Cancel/Delete',p.locator('#preset-confirm').inner_text()=='삭제');p.locator('#preset-cancel').click();check('Cancelled delete retains slot',p.evaluate('SolarTime.getPresets()[0]')==saved)
    p.locator('#fit-view').click();p.locator('#rotate-left').click();key(p,'1');check('Shortcut stops auto yaw and starts smooth transition',p.evaluate('!!SolarTime.renderer.cameraTween') and p.evaluate('SolarTime.renderer.autoRotateDirection')==0)
    p.wait_for_function('!SolarTime.renderer.cameraTween',timeout=6000);check('Shortcut reaches the exact stored pose',camera(p)==saved)
    p.locator('#fit-view').click();p.locator('#live-button').click();p.mouse.move(800,400);p.screenshot(path=str(OUT/'overview-v0.12.png'))
    p.locator('#hide-ui').click();p.wait_for_timeout(230);check('Zen wakes the entire same toolbar plus mode icon',toolbar(p)==ZEN and visible(p)==set(ZEN),sorted(visible(p)))
    check('Zen leaves all normal panels hidden and no tracking card',p.locator('.playback').is_hidden() and p.locator('.masthead').is_hidden() and p.locator('.footer').is_hidden() and p.locator('#focus-reset').count()==0)
    check('SEOUL label remains in zen',p.locator('#timezone-readout').is_visible() and p.locator('#timezone-readout').inner_text()=='SEOUL')
    p.locator('#rotate-right').click();p.mouse.move(820,430);p.wait_for_timeout(230);p.screenshot(path=str(OUT/'zen-awake-v0.12.png'))
    idle(p);a=sample(p);p.wait_for_timeout(800);b=sample(p);check('Automatic yaw does not wake idle buttons or cursor',not visible(p) and p.evaluate('getComputedStyle(document.getElementById("universe")).cursor')=='none' and 1.8<speed(a,b)<2.2)
    check('Idle toolbar is inert and aria-hidden',p.locator('#view-controls').evaluate('e=>e.inert&&e.getAttribute("aria-hidden")==="true"'));p.screenshot(path=str(OUT/'zen-idle-v0.12.png'))
   else:
    p.locator('#camera-preset-1').click();p.locator('#preset-confirm').click();saved=p.evaluate('SolarTime.getPresets()[0]');p.locator('#hide-ui').click()
   if SECTION in ('all','remaining'):
    p.mouse.move(800,430);p.locator('#rotate-right').click();idle(p);p.mouse.down();p.mouse.up();p.wait_for_timeout(220);check('Idle wake click preserves automatic yaw',p.evaluate('SolarTime.renderer.autoRotateDirection')==1 and toolbar(p)==ZEN);p.locator('#rotate-right').click()
    p.mouse.move(815,435);p.wait_for_timeout(230);check('Pointer activity restores every control in zen',toolbar(p)==ZEN and not p.locator('#view-controls').evaluate('e=>e.inert'))
    p.locator('#camera-preset-2').click();p.wait_for_timeout(2100);check('Zen confirmation remains interactive beyond idle timeout',p.locator('#preset-dialog').is_visible() and p.locator('#preset-confirm').is_visible() and p.locator('#preset-cancel').is_visible() and p.evaluate('document.body.classList.contains("pointer-awake")'))
    pop=p.locator('#preset-dialog').bounding_box();check('Popup fits inside viewport beside the right toolbar',pop['x']>=8 and pop['x']+pop['width']<=1641 and pop['y']+pop['height']<=921,pop);p.screenshot(path=str(OUT/'zen-save-v0.12.png'))
    p.locator('#preset-confirm').click();check('Saving within zen preserves the mode',p.evaluate('SolarTime.getState().zen') and p.evaluate('SolarTime.getPresets()[1]') is not None)
    p.locator('#camera-preset-2').click(button='right');p.locator('#preset-confirm').click();check('Confirmed delete clears only its slot',p.evaluate('SolarTime.getPresets()[1]') is None and p.evaluate('SolarTime.getPresets()[0]')==saved)
    p.locator('#zoom-in').click();check('Zen zoom works without leaving the mode',camera(p)['zoom']>1 and p.evaluate('SolarTime.getState().zen'))
    p.locator('#fit-view').click();check('Icon home resets while remaining in zen',camera(p)['zoom']==1 and p.evaluate('SolarTime.getState().zen'))
    p.locator('#show-ui').click();p.wait_for_timeout(2100);check('Mode exit restores normal toolbar without stale idle timeout',not p.evaluate('SolarTime.getState().zen') and toolbar(p)==NORMAL and p.locator('.playback').is_visible())
    p.locator('#rotate-left').click();p.wait_for_timeout(180);p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))');stop=sample(p);p.wait_for_timeout(600)
    check('Visibility event pauses camera but preserves direction',camera(p)==stop['camera'] and stop['direction']==-1)
    p.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))');p.wait_for_timeout(150);back=sample(p)
    check('Visibility resume skips invisible elapsed time',abs(delta(stop['camera']['azimuth'],back['camera']['azimuth']))<.011);p.locator('#fit-view').click()
    exported=p.evaluate('''async()=>{const html=await SolarTime.materials.offlineHTML();const d=new DOMParser().parseFromString(html,'text/html');return {title:d.title,version:html.includes("version:'0.12'"),ids:[...d.querySelectorAll('#view-controls button')].map(e=>e.id),showModeHidden:d.getElementById('show-ui').hidden,oldHomeText:!!d.querySelector('#fit-view .zen-label')};}''')
    check('Exported HTML keeps one toolbar and version v0.12',exported=={'title':'Solar Time','version':True,'ids':ZEN,'showModeHidden':True,'oldHomeText':False},exported);ctx.close()
   else:ctx.close()
  if SECTION in ('all','mobile'):
   for width,height in [(390,844),(320,568),(844,390)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},offline=True,has_touch=True,is_mobile=True,device_scale_factor=1,timezone_id='Asia/Seoul');m=load(ctx);rows=geometry(m)
    check(f'{width}x{height}: normal order/column fits',toolbar(m)==NORMAL and column(rows) and fits(rows,width,height),rows)
    m.locator('#hide-ui').tap();m.wait_for_timeout(220);rows=geometry(m);check(f'{width}x{height}: zen column fits without overlap',toolbar(m)==ZEN and column(rows) and fits(rows,width,height),rows)
    idle(m);m.touchscreen.tap(60,300);m.wait_for_timeout(220);check(f'{width}x{height}: one touch wakes toolbar',toolbar(m)==ZEN)
    m.locator('#rotate-left').tap();check(f'{width}x{height}: orbit toggle handles touch',m.evaluate('SolarTime.renderer.autoRotateDirection')==-1)
    m.locator('#camera-preset-3').tap();m.locator('#preset-confirm').tap();check(f'{width}x{height}: save in zen handles touch',m.evaluate('SolarTime.getPresets()[2]') is not None and m.evaluate('SolarTime.getState().zen'))
    m.mouse.move(width/2,height/2);m.screenshot(path=str(OUT/f'mobile-{width}-v0.12.png'));m.locator('#show-ui').tap();check(f'{width}x{height}: mode icon exits zen',not m.evaluate('SolarTime.getState().zen'));ctx.close()
  browser.close();check('No uncaught browser application errors',not report['errors'],report['errors'])
finally:
 report['checkCount']=len(report['checks']);report['passed']=bool(report['checks']) and all(c['passed'] for c in report['checks']) and not report['errors'];REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Report:',REPORT,flush=True)
