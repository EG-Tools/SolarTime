"""Offline DOM/UI regression: synthetic images, local translations, no live service or physical iPhone verification."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,re,os,struct,zlib,sys
from playwright.sync_api import sync_playwright

def png(w=32,h=16):
 def chunk(t,d):return struct.pack('!I',len(d))+t+d+struct.pack('!I',zlib.crc32(t+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+b'\x24\x32\x48'*w)*h))+chunk(b'IEND',b'')
image=png()
def load(browser,root,size,standalone=False):
 context=browser.new_context(viewport=dict(width=size[0],height=size[1]),locale='ko-KR',timezone_id='Asia/Seoul',reduced_motion='reduce',has_touch=standalone)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=(root/'index.html').read_text();scripts=re.findall(r'<script[^>]+src="([^"]+)"[^>]*></script>',html)
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
  for(const name of ['localStorage','sessionStorage']){const memory=new Map();Object.defineProperty(window,name,{value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)},configurable:true});}
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
 check(page.locator('#release-notes-version').inner_text()=='v0.47',tag+' visible release version')
 check(page.locator('#release-notes-list li').count()==7 and 'Singapore' in page.locator('#release-notes-list').inner_text(),tag+' visible English SG release note')
 page.locator('#release-notes-older').click();check(page.locator('#release-notes-version').inner_text()=='v0.46',tag+' historical release navigation')
 page.locator('#release-notes-newer').click();check(page.locator('#release-notes-version').inner_text()=='v0.47',tag+' current release navigation')
 check(not errors,tag+' no runtime errors')
 ctx.close()
 print('PASS',tag,flush=True)
def main():
 root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[2]
 with sync_playwright() as p:
  options={'headless':True,'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):options['executable_path']=os.environ['SOLAR_CHROMIUM_EXECUTABLE']
  browser=p.chromium.launch(**options)
  try:
   for size,installed in [((1280,800),False),((390,844),False),((844,390),False),((390,844),True),((844,390),True)]:suite(browser,root,size,installed)
  finally:browser.close()
 out=root/'.cloudflare/ui-regression.json';out.parent.mkdir(exist_ok=True)
 out.write_text(json.dumps({'mode':'offline synthetic DOM; installed mode is simulated, not a physical iPhone','passed':len(checks),'checks':checks},ensure_ascii=False,indent=2),encoding='utf8')
 print('UI checks passed:',len(checks),flush=True)
if __name__=='__main__':main()
