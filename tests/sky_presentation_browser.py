"""Focused v0.11 sky presentation regression after the settled-quality fix."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'test-results';checks=[]
def check(name,ok,detail=None):
 checks.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True)
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':1648,'height':928},offline=True,timezone_id='Asia/Seoul');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'dist/Solar-Time_v0.11.html').read_text(),wait_until='load');page.wait_for_function('window.SolarTime?.version==="0.11"',timeout=20000)
 page.evaluate('''()=>{const r=SolarTime.renderer;r.setOption('skyMotion',false);r.setOption('comets',false);r.setOption('twinkle',false);SolarTime.clock.setDate(Date.UTC(2026,8,12,0),performance.now());r.resetCamera();}''')
 page.wait_for_function('SolarTime.renderer.sky.stats.frames>=1',timeout=20000);page.wait_for_timeout(2000)
 before=page.evaluate('SolarTime.renderer.sky.stats.frames')
 page.evaluate('''()=>{const r=SolarTime.renderer;r.animateCamera({...r.cameraSnapshot(),azimuth:1.7,elevation:-.2},performance.now(),1300)}''');page.wait_for_timeout(1900)
 check('Background commits intermediate camera frames',page.evaluate('SolarTime.renderer.sky.stats.frames')-before>=3)
 page.wait_for_function('SolarTime.renderer.sky.gl || SolarTime.renderer.sky.lastKey.endsWith(":512")',timeout=5000)
 check('CPU panorama restores settled resolution after camera animation',page.evaluate('SolarTime.renderer.sky.gl || SolarTime.renderer.sky.softwareCanvas.width===512'))
 page.evaluate('SolarTime.renderer.resetCamera()');page.wait_for_timeout(2500)
 page.screenshot(path=str(out/'overview-v0.11.png'))
 page.locator('#camera-preset-1').click();page.screenshot(path=str(out/'preset-save-v0.11.png'));page.locator('#preset-cancel').click()
 page.evaluate('''()=>{const r=SolarTime.renderer,s=r.sky,t=SolarTime.getState().effectTime;const point=(x,y)=>s.toPanorama(s.ray(x,y));r.setOption('comets',true);s.comet={start:point(100,350),control1:point(500,180),control2:point(1100,280),end:point(1570,500),time:t-12,duration:18};s.nextComet=t+1000;}''');page.wait_for_timeout(350)
 page.screenshot(path=str(out/'comet-v0.11.png'))
 check('Source and embedded sky are present without network requests',page.evaluate('SolarAssets.sky.startsWith("data:image/webp;base64,") && SolarTime.renderer.sky.ready'))
 check('No uncaught errors in final sky/preset smoke check',not errors,errors)
 result={'version':'0.11','checks':checks,'backend':page.evaluate('SolarTime.renderer.sky.stats.backend'),'errors':errors}
 c.close();b.close()
(ROOT/'docs/sky-presentation-v0.11.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
