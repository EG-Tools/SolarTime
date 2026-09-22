"""Offline DOM/UI regression: synthetic images, local translations, no live service or physical iPhone verification."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,re,os,struct,zlib,sys
from playwright.sync_api import sync_playwright

def png(w=32,h=16):
 def chunk(t,d):return struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+b'\x24\x32\x48'*w)*h))+chunk(b'IEND',b'')
image=png()
def load(browser,root,size,standalone=False,locale='ko-KR',timezone_id='Asia/Seoul'):
 context=browser.new_context(viewport=dict(width=size[0],height=size[1]),locale=locale,timezone_id=timezone_id,reduced_motion='reduce',has_touch=standalone)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=(root/'index.html').read_text();scripts=[src for src in re.findall(r'<script[^>]+src="([^"]+)"[^>]*></script>',html) if not urlparse(src).scheme]
 html=re.sub(r'<script[^>]+src="[^"]+"[^>]*></script>','',html)
 html=re.sub(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>',lambda m:'<style>'+ (root/m[1].split('?')[0]).read_text()+'</style>',html)
 html=re.sub(r'<link[^>]*>','',html);html=html.replace('<head>','<head><base href="https://solar.test/">')
 # Offline DOM injection: no navigation and no access to remote images or services.
 page.route('**/*',lambda route:route.abort())
 page.set_content(html,wait_until='domcontentloaded')
 import base64
 payload={'image':'data:image/png;base64,'+base64.b64encode(image).decode(),'standalone':standalone,'locales':{p.stem:json.loads(p.read_text()) for p in (root/'src/locales').glob('*.json')},'notes':(root/'src/release-notes.js').read_text()}
 page.evaluate(r"""p=>{
  Date.now=()=>1789732800000;
  if(p.standalone)Object.defineProperty(navigator,'standalone',{get:()=>true});
  window.Worker=undefined;
  for(const name of ['localStorage','sessionStorage']){const memory=new Map(name==='localStorage'?[['solarTimeCookieConsentV1','denied']]:[]);Object.defineProperty(window,name,{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},configurable:true});}
  const NativeImage=window.Image;window.Image=class extends NativeImage{set src(value){super.src=p.image;}get src(){return super.src;}};
  window.__fixtureRequests=[];
  window.fetch=async input=>{const url=String(input);__fixtureRequests.push(url);const match=/locales\/([^.]+)\.json/.exec(url);if(match)return new Response(JSON.stringify(p.locales[match[1]]),{headers:{'Content-Type':'application/json'}});const bytes=Uint8Array.from(atob(p.image.split(',')[1]),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'image/png'}});};
  const append=document.head.append.bind(document.head);document.head.append=(...nodes)=>{for(const node of nodes){if(node.tagName==='SCRIPT'&&node.src.includes('src/release-notes.js')){node.type='text/plain';node.removeAttribute('src');append(node);queueMicrotask(()=>{try{(0,eval)(p.notes);node.dispatchEvent(new Event('load'));}catch(e){node.dispatchEvent(new Event('error'));throw e;}});}else append(node);}};
 }""",payload)
 for src in scripts:
  code=(root/src.split('?')[0]).read_text()
  page.evaluate("""({code,src})=>{Object.defineProperty(document,'currentScript',{value:{src:'https://solar.test/'+src},configurable:true});try{(0,eval)(code);}finally{delete document.currentScript;}}""",{'code':code,'src':src})
 try:page.wait_for_function('!!window.SolarTime',timeout=15000);page.wait_for_function("document.getElementById('loading').hidden",timeout=10000)
 except Exception:
  print('BOOT FAILURE',root,size,errors,page.locator('#fatal-message').inner_text());raise
 return context,page,page.evaluate('__fixtureRequests'),errors


checks=[]
def check(value,label):
 assert value,label
 checks.append(label)
def box(page,selector):return page.locator(selector).bounding_box()
def surface(page,selector):return page.locator(selector).evaluate("e=>{const s=getComputedStyle(e);return [s.backgroundImage,s.borderColor,s.backdropFilter,s.boxShadow]}")
def suite(browser,root,size,installed):
 ctx,page,requests,errors=load(browser,root,size,installed)
 tag=str(size)+(' installed-simulation' if installed else ' browser')
 check(not errors,tag+' boot')
 if size==(1280,800):
  popup_result=page.evaluate((root/'tests/browser/popup-regression.js').read_text())
  check(popup_result['passed']>=100,tag+' common popup lifecycle for button and H')
  page.evaluate("""()=>{window.dispatchEvent(new Event('resize'));window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}""")
  page.wait_for_function("!document.getElementById('planet-layer').classList.contains('viewport-resizing')&&!document.getElementById('universe').classList.contains('viewport-resizing')",timeout=4000)
  check(page.locator('#planet-layer').evaluate("e=>getComputedStyle(e).opacity==='1'") and page.locator('#universe').evaluate("e=>getComputedStyle(e).opacity==='1'"),tag+' persisted resize restoration reveals both canvases')
 check(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').get_attribute('content')=='default',tag+' status bar')
 page.locator('#settings-button').click()
 settings_surface=surface(page,'#settings-panel')
 before=box(page,'#settings-close');page.locator('#settings-scroll').evaluate('e=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(30)
 check(abs(before['y']-box(page,'#settings-close')['y'])<.1,tag+' fixed settings close')
 page.locator('#reset-defaults').click();r=box(page,'#reset-defaults-dialog');page.mouse.click(r['x']+5,r['y']+5)
 check(page.locator('#reset-defaults-dialog').evaluate('e=>e.open'),tag+' card interior is not backdrop')
 page.mouse.click(1,1);check(not page.locator('#reset-defaults-dialog').evaluate('e=>e.open'),tag+' backdrop closes')
 page.locator('#settings-close').click()
 page.locator('[data-body="earth"]').click();page.wait_for_timeout(100)
 before=box(page,'#body-close');page.locator('#body-scroll').evaluate('e=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(30)
 check(abs(before['y']-box(page,'#body-close')['y'])<.1,tag+' fixed body close')
 check(surface(page,'#body-panel')==settings_surface,tag+' body surface')
 page.locator('#body-close').click()
 if size==(1280,800):
  # Freeze the user's optional overview rotation while checking that eclipse and
  # alignment navigation do not initiate their own camera move. Otherwise the
  # continuously rotating default camera can advance between two snapshots.
  page.evaluate('SolarTime.renderer.setAutoRotate(0, performance.now())')
  page.locator('[data-body="moon"]').click();page.wait_for_timeout(100)
  check(page.locator('#eclipse-control').is_visible(),tag+' Moon eclipse controls')
  page.wait_for_function('!SolarTime.renderer.cameraTween',timeout=7000)
  moon_camera=page.evaluate('SolarTime.renderer.cameraSnapshot()')
  page.locator('#eclipse-next').click();first=page.evaluate('SolarTime.clock.travel.targetMs')
  check(page.evaluate('SolarTime.renderer.cameraSnapshot()')==moon_camera,tag+' Moon eclipse preserves the current camera')
  check(first>1789732800000,tag+' Moon next eclipse starts smooth future travel')
  check(page.locator('#eclipse-date').inner_text()!='—',tag+' Moon eclipse target date')
  page.locator('#eclipse-next').click();second=page.evaluate('SolarTime.clock.travel.targetMs')
  check(second>first,tag+' repeated Moon next advances from active target')
  page.wait_for_function("SolarTime.getState().paused&&!SolarTime.getState().live",timeout=4000)
  page.locator('#pause-button').click();state=page.evaluate('SolarTime.getState()')
  check(not state['paused'] and state['rate']==1 and page.locator('#speed-value').inner_text()=='1 ×',tag+' eclipse resume displays actual 1x rate')
  page.locator('#live-button').click()
  state=page.evaluate('SolarTime.getState()')
  check(state['live'] and not state['paused'] and page.locator('#eclipse-date').inner_text()=='—',tag+' real time resets eclipse travel')
  page.locator('#body-close').click();page.locator('[data-body="europa"]').click();page.wait_for_timeout(100)
  check(page.locator('#eclipse-control').is_visible(),tag+' Europa eclipse controls')
  page.wait_for_function('!SolarTime.renderer.cameraTween',timeout=7000)
  europa_camera=page.evaluate('SolarTime.renderer.cameraSnapshot()')
  page.locator('#eclipse-previous').click()
  check(page.evaluate('SolarTime.renderer.cameraSnapshot()')==europa_camera,tag+' Europa eclipse preserves the current camera')
  check(page.evaluate('SolarTime.clock.travel.targetMs')<1789732800000,tag+' Europa previous eclipse travel')
  page.locator('#live-button').click();page.locator('#body-close').click();page.locator('[data-body="sun"]').click();page.wait_for_timeout(100)
  check(page.locator('#alignment-control').is_visible(),tag+' Sun planetary alignment controls')
  page.wait_for_function('!SolarTime.renderer.cameraTween',timeout=7000)
  alignment_camera=page.evaluate('SolarTime.renderer.cameraSnapshot()')
  page.locator('#alignment-next').click();first=page.evaluate('SolarTime.clock.travel.targetMs')
  check(page.evaluate('SolarTime.renderer.cameraSnapshot()')==alignment_camera,tag+' alignment preserves the current camera')
  check(first>1789732800000 and page.locator('#alignment-date').inner_text()!='—',tag+' next alignment starts smooth future travel')
  page.locator('#alignment-next').click();second=page.evaluate('SolarTime.clock.travel.targetMs')
  check(second>first,tag+' repeated alignment next advances from active target')
  page.locator('#live-button').click()
  check(page.locator('#alignment-date').inner_text()=='—',tag+' real time resets alignment travel')
  page.locator('#body-close').click()
 page.locator('#help-button').click();help_surface=surface(page,'#help-dialog')
 check(help_surface==settings_surface,tag+' help surface')
 check(not page.evaluate('!!window.SolarReleaseNotes'),tag+' release history remains lazy')
 page.locator('.solar-build-info').click()
 check(surface(page,'#layout-diagnostics')==help_surface,tag+' diagnostics common surface')
 check(page.locator('#layout-diagnostics pre').evaluate("e=>e.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true}))"),tag+' diagnostic text selectable')
 page.keyboard.press('Escape')
 check(not page.locator('#layout-diagnostics').evaluate('e=>e.open') and page.locator('#help-dialog').evaluate('e=>e.open'),tag+' Escape closes only top card')
 page.locator('#kakao-pay-link').click()
 check(surface(page,'#kakao-pay-dialog')==help_surface,tag+' QR common surface')
 scroll=page.locator('#kakao-pay-scroll').evaluate('e=>({padding:parseFloat(getComputedStyle(e).paddingTop),overflow:getComputedStyle(e).overflowY,client:e.clientHeight,total:e.scrollHeight})')
 check(scroll['padding']>0 and scroll['overflow']=='auto',tag+' QR padding and scroll')
 page.locator('#kakao-pay-scroll').evaluate('e=>e.scrollTop=e.scrollHeight')
 check(page.locator('#kakao-pay-dialog .close-button').is_visible(),tag+' QR close remains visible')
 page.keyboard.press('Escape');page.keyboard.press('Escape')
 for language in ['sg','en','sg']:
  page.locator('#language-toggle').click();page.locator('[data-language="'+language+'"]').click()
  page.wait_for_function('code=>SolarTime.getState().language===code',arg=language)
 state=page.evaluate('SolarTime.getState()')
 check(state['timeZone']=='Asia/Singapore' and state['region']=='SINGAPORE',tag+' SG region and time')
 check(page.locator('html').get_attribute('lang')=='en-SG',tag+' SG locale')
 check(page.evaluate("JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).language")=='sg',tag+' SG saved preference')
 urls=page.evaluate('__fixtureRequests')
 check(sum('/locales/en.json' in u for u in urls)==1 and not any('/locales/sg.json' in u for u in urls),tag+' one shared English payload')
 page.evaluate("()=>{const r=SolarTime.renderer,fn=r.animateFeature.bind(r);r.animateFeature=(...args)=>{window.__featureArgs=args;return fn(...args);}}")
 page.locator('#timezone-button').click();args=page.evaluate('__featureArgs')
 check(args[0]=='earth' and abs(args[1]-(1+17/60))<1e-8 and args[2]==103.85,tag+' SG uses shared Earth camera')
 page.locator('#help-button').click();page.locator('#release-notes-toggle').click()
 page.wait_for_function('!!window.SolarReleaseNotes')
 check(page.locator('#release-notes-version').inner_text()=='v0.53',tag+' visible release version')
 check(page.locator('#release-notes-list li').count()==4 and 'cookie' in page.locator('#release-notes-list').inner_text().lower(),tag+' visible English SG release note')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.52' and 'Black Marble' in page.locator('#release-notes-list').inner_text(),tag+' previous release navigation')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.51' and 'JPL' in page.locator('#release-notes-list').inner_text(),tag+' astronomy release navigation')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.50' and 'Auto Language' in page.locator('#release-notes-list').inner_text(),tag+' language release navigation')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.48',tag+' earlier release navigation')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.47',tag+' historical release navigation')
 for _ in range(5):page.locator('#release-notes-newer').click()
 check(page.locator('#release-notes-version').inner_text()=='v0.53',tag+' current release navigation')
 page.locator('#help-dialog .close-button').first.click()
 for country,lang,zone,label,city,lat,lon in [('nl','nl-NL','Europe/Amsterdam','NETHERLANDS','Amsterdam',52+22/60,4.9),('be','nl-BE','Europe/Brussels','BELGIUM','Brussel',50+50/60,4+20/60)]:
  page.locator('#language-toggle').click();page.locator('[data-language="'+country+'"]').click()
  page.wait_for_function('(code)=>SolarTime.getState().language===code',arg=country)
  state=page.evaluate('SolarTime.getState()')
  check(state['timeZone']==zone and state['region']==label,tag+' '+country+' regional time')
  check(page.locator('html').get_attribute('lang')==lang,tag+' '+country+' document language')
  check(page.locator('#star-density-label').inner_text()=='Sterdichtheid',tag+' '+country+' Dutch setting label')
  check(page.locator('[data-body="earth"]').inner_text()=='Aarde',tag+' '+country+' Dutch body label')
  check(page.evaluate("JSON.parse(localStorage.getItem('eg.solar-time.v0.01')).language")==country,tag+' '+country+' persisted selection')
  page.locator('#timezone-button').click();args=page.evaluate('__featureArgs')
  check(args[0]=='earth' and abs(args[1]-lat)<1e-8 and abs(args[2]-lon)<1e-8,tag+' '+country+' Earth-view city')
  page.locator('#help-button').click()
  if not page.locator('#release-notes-list').is_visible():page.locator('#release-notes-toggle').click()
  check(page.locator('#release-notes-version').inner_text()=='v0.53' and 'cookiemelding' in page.locator('#release-notes-list').inner_text(),tag+' '+country+' current Dutch release')
  for _ in range(4):page.locator('#release-notes-older').click()
  check('Willekeurige rotatie' in page.locator('#release-notes-list').inner_text(),tag+' '+country+' Dutch release history')
  for _ in range(4):page.locator('#release-notes-newer').click()
  page.locator('#help-dialog .close-button').first.click()
 check(len([u for u in page.evaluate('__fixtureRequests') if '/locales/nl.json' in u])==1,tag+' one shared Dutch request')
 # Country Zoom reference and shared random toggle, including compact installed simulations.
 page.evaluate("SolarTime.renderer.setAutoRotate(0,performance.now())")
 page.locator('#timezone-button').click()
 page.wait_for_function('!SolarTime.renderer.cameraTween',timeout=7000)
 check(page.evaluate('SolarTime.renderer.camera.zoom')==250,tag+' country initial 250x')
 check(page.locator('#zoom-value').inner_text()=='250.0×',tag+' zoom readout is 250x not 250 percent')
 page.mouse.move(size[0]*.6,size[1]*.55);page.mouse.wheel(0,-120)
 page.wait_for_timeout(350)
 check(page.evaluate('SolarTime.renderer.camera.zoom')>250,tag+' wheel can approach beyond country preset')
 page.mouse.wheel(0,120);page.mouse.wheel(0,120);page.wait_for_timeout(350)
 check(page.evaluate('SolarTime.renderer.camera.zoom')<250,tag+' wheel can move away')
 left=box(page,'#rotate-right');random_box=box(page,'#random-rotate')
 check(random_box['y']>left['y']+left['height'],tag+' random below visual left rotation')
 check(page.locator('#random-rotate svg ellipse').count()==2,tag+' crossed circle icon')
 check(page.locator('#random-rotate').get_attribute('aria-pressed')=='false',tag+' initial random off')
 page.evaluate("""()=>{
  window.__starPoolBefore=SolarAssets.starData;
  const r=SolarTime.renderer,advance=r.advanceAutoRotate.bind(r);
  window.__rotationSpeed={seconds:0,travel:0,frames:0};
  window.__fixedDirectionErrors=[];
  r.advanceAutoRotate=function(mono){
   const old=this.autoRotation,dt=old&&old.mono!==null?Math.max(0,mono-old.mono)/1000:0;
   const a=this.camera.azimuth,e=this.camera.elevation,result=advance(mono);
   if(old&&dt>0){
    const delta=(x,y)=>((x-y+Math.PI*3)%(Math.PI*2))-Math.PI;
    __rotationSpeed.seconds+=old.direction===2?Math.min(.25,dt):dt;
    __rotationSpeed.travel+=Math.hypot(delta(this.camera.azimuth,a),delta(this.camera.elevation,e))*180/Math.PI;
    __rotationSpeed.frames++;
    if(old.direction===2){
     const path=this.randomRotation,t=Math.min(.25,dt);
     __fixedDirectionErrors.push(Math.max(Math.abs(delta(this.camera.azimuth,a)/t-path.yawRate),Math.abs(delta(this.camera.elevation,e)/t-path.pitchRate)));
    }
   }
   return result;
  };
 }""")
 before=page.evaluate('({...SolarTime.renderer.camera})')
 page.locator('#random-rotate').click();page.wait_for_timeout(1200)
 active=page.evaluate('({...SolarTime.renderer.camera})')
 check(page.locator('#random-rotate').get_attribute('aria-pressed')=='true',tag+' random on')
 check(all(active[k]==before[k] for k in ['zoom','dolly','panX','panY','focus']),tag+' random preserves distance and framing')
 check(active['azimuth']!=before['azimuth'] and active['elevation']!=before['elevation'],tag+' random changes both angles')
 speed=page.evaluate('__rotationSpeed')
 check(speed['frames']>=5 and speed['seconds']>.5,tag+' random is advanced by the real frame loop')
 check(abs(speed['travel']/speed['seconds']-1.8)<.002,tag+' random moves at 1.8 degrees/s immediately, not a tiny nonzero delta')
 check(page.evaluate('SolarAssets.starData===__starPoolBefore'),tag+' random toggle never regenerates stars')
 check(page.evaluate('Object.isFrozen(SolarTime.renderer.randomRotation)'),tag+' chosen rotation direction is immutable')
 check(page.evaluate('__fixedDirectionErrors.length>=5 && __fixedDirectionErrors.every(e=>Number.isFinite(e)&&e<1e-7)'),tag+' every real frame follows the selected fixed direction')
 page.locator('#random-rotate').click();stopped=page.evaluate('({...SolarTime.renderer.camera})');page.wait_for_timeout(200)
 check(page.evaluate('({...SolarTime.renderer.camera})')==stopped,tag+' random off freezes camera')
 for direction in ['rotate-left','rotate-right']:
  page.evaluate('window.__rotationSpeed={seconds:0,travel:0,frames:0}')
  page.locator('#'+direction).click();page.wait_for_timeout(600);page.locator('#'+direction).click()
  turn_speed=page.evaluate('__rotationSpeed')
  check(turn_speed['seconds']>.3 and abs(turn_speed['travel']/turn_speed['seconds']-1.8)<.00001,tag+' '+direction+' keeps its original speed')
  check(abs(turn_speed['travel']/turn_speed['seconds']-speed['travel']/speed['seconds'])<.002,tag+' random speed matches '+direction)
 page.locator('#random-rotate').click();page.locator('#rotate-right').click()
 check(page.locator('#random-rotate').get_attribute('aria-pressed')=='false' and page.locator('#rotate-right').get_attribute('aria-pressed')=='true',tag+' left excludes random')
 page.locator('#random-rotate').click()
 check(page.locator('#rotate-right').get_attribute('aria-pressed')=='false',tag+' random excludes left')
 # Both poles and the +/-180 wrap remain continuous, even on a running path.
 page.evaluate("()=>{const r=SolarTime.renderer;r.setOrbitView(.4,170*Math.PI/180,performance.now());window.__randomPath=r.randomRotation;window.__orbitInput=[];const rotate=r.rotateViewBy.bind(r);r.rotateViewBy=(a,e,mono)=>{const before={...r.camera};const out=rotate(a,e,mono);__orbitInput.push({before,after:{...r.camera},a,e,mono});return out;};}")
 page.mouse.move(size[0]*.5,size[1]*.45);page.mouse.down();page.wait_for_timeout(250)
 page.mouse.move(size[0]*.5+24,size[1]*.45+100,steps=10);page.mouse.up()
 check(page.locator('#random-rotate').get_attribute('aria-pressed')=='true',tag+' manual drag retains random ON')
 check(page.evaluate('SolarTime.renderer.randomRotation===__randomPath'),tag+' manual drag retains existing random path')
 check(page.evaluate('SolarTime.renderer.camera.elevation<0'),tag+' manual drag crosses 180 without clipping')
 check(page.evaluate("__orbitInput.length>0&&__orbitInput.every(v=>Math.abs(((v.after.elevation-v.before.elevation+Math.PI*3)%(Math.PI*2)-Math.PI)-v.e)<.015)"),tag+' no pole snap or stale-pointerdown reset')
 after_drag=page.evaluate('({...SolarTime.renderer.camera})');page.wait_for_timeout(300)
 check(page.evaluate('__fixedDirectionErrors.every(e=>Number.isFinite(e)&&e<1e-7)'),tag+' same direction survives manual control and resumes without reselecting')
 check(page.evaluate('SolarTime.renderer.camera.elevation')!=after_drag['elevation'],tag+' random continues after releasing pointer')
 page.locator('#random-rotate').click()
 check(page.locator('#random-rotate').get_attribute('aria-pressed')=='false',tag+' explicit toggle turns random OFF')
 page.locator('[data-body="earth"]').click();page.wait_for_timeout(350)
 page.evaluate("""()=>{window.__statNode=document.getElementById('stat-value-gravity').firstChild;window.__statMutations=0;window.__statObserver=new MutationObserver(r=>__statMutations+=r.length);__statObserver.observe(document.getElementById('stat-value-gravity'),{childList:true,characterData:true,attributes:true,subtree:true});}""")
 page.wait_for_timeout(650)
 check(page.evaluate("__statNode===document.getElementById('stat-value-gravity').firstChild && __statMutations===0"),tag+' unchanged stat nodes have zero DOM mutations')
 page.evaluate('__statObserver.disconnect()')
 check(not errors,tag+' no runtime errors')
 ctx.close()
 print('PASS',tag,flush=True)
def main():
 root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[2]
 with sync_playwright() as p:
  options={'headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['SOLAR_CHROMIUM_EXECUTABLE']
  for size,installed in [((1280,800),False),((390,844),False),((844,390),False),((390,844),True),((844,390),True)]:
   # Isolate software-GPU resources and animated cameras between viewport cases.
   browser=p.chromium.launch(**options)
   try:suite(browser,root,size,installed)
   finally:browser.close()
  browser=p.chromium.launch(**options)
  try:
   ctx,page,requests,errors=load(browser,root,(1280,800),False,locale='en-US')
   state=page.evaluate('SolarTime.getState()')
   check(state['language']=='kor' and state['copyLanguage']=='en' and state['region']=='KOREA','automatic country and browser copy are independent')
   check(page.locator('html').get_attribute('lang')=='en' and page.evaluate("SolarTime.translate('settings')")=='Display settings','automatic English copy is applied in Seoul')
   page.evaluate("""()=>{window.__testLanguages=['fr-FR','en-US'];Object.defineProperty(navigator,'languages',{get:()=>window.__testLanguages,configurable:true});window.dispatchEvent(new Event('languagechange'));}""")
   page.wait_for_function("SolarTime.getState().copyLanguage==='fr'")
   check(page.evaluate("__fixtureRequests.some(url=>url.includes('/locales/fr.json'))"),'automatic browser language change loads its locale')
   check(page.evaluate("SolarTime.translate('settings')")=='Réglages d’affichage','automatic browser language change never exposes internal keys')
   check(not errors,'automatic English copy has no runtime errors')
   ctx.close()
   ctx,page,requests,errors=load(browser,root,(1280,800),False,locale='en-US',timezone_id='America/Los_Angeles')
   state=page.evaluate('SolarTime.getState()')
   check(state['language']=='en' and state['timeZone']=='America/Los_Angeles','automatic clock uses the actual device timezone')
   page.locator('[data-body="sun"]').click();page.locator('#alignment-next').click()
   check(page.locator('#alignment-date').inner_text()=='2027.07.01','alignment card uses the same local date as the simulation clock')
   check('America/Los_Angeles' in (page.locator('#alignment-date').get_attribute('title') or ''),'alignment tooltip identifies its local timezone')
   check(not errors,'automatic Pacific-time copy has no runtime errors')
   ctx.close()
  finally:browser.close()
 out=root/'.cloudflare/ui-regression.json';out.parent.mkdir(exist_ok=True)
 out.write_text(json.dumps({'mode':'offline synthetic DOM; installed mode is simulated, not a physical iPhone','passed':len(checks),'checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
 print('UI checks passed:',len(checks),flush=True)
if __name__=='__main__':main()
