"""Offline recovery checks in real Chromium/Firefox/WebKit, with shared origin storage.
Desktop WebKit is not an iPhone Home Screen certification. No native shutdown.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import base64, json, mimetypes, os, re, struct, zlib
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://solar.test'

def png():
    def chunk(t, data):
        return struct.pack('!I', len(data))+t+data+struct.pack('!I', zlib.crc32(t+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',32,16,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+b'\x24\x32\x48'*32)*16))+chunk(b'IEND',b'')

IMAGE = png()
INIT = """() => {
 localStorage.setItem('solarTimeCookieConsentV1','denied');
 localStorage.setItem('solar-time.help-seen.v1','true');
 localStorage.setItem('solar-time.opening-mode.v1','"none"');
 if(!localStorage.getItem('eg.solar-time.v0.01'))localStorage.setItem('eg.solar-time.v0.01',JSON.stringify({language:'kor',languageMode:'manual'}));
 window.Worker=undefined;
} """

def routed(context, faults):
    def serve(route):
        u=urlparse(route.request.url);path=unquote(u.path)
        if 'pagead2.googlesyndication.com' in u.netloc:
            faults['ads'] += 1
            if faults['ads']==1: route.abort();return
            route.fulfill(body='window.adsbygoogle=[];',content_type='application/javascript');return
        if '/locales/' in path:
            if faults.get('locale')=='offline': route.abort();return
            if faults.get('locale')=='json': route.fulfill(body='{broken',content_type='application/json');return
            path='/src/locales/'+Path(path).name
        if path=='/version.json': route.fulfill(body=json.dumps(faults.get('version',json.loads((ROOT/'version.json').read_text()))),content_type='application/json');return
        if path=='/fixture':
            html=(ROOT/'index.html').read_text(encoding='utf8')
            html=re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
            route.fulfill(body=html,content_type='text/html');return
        if route.request.resource_type=='image' or path.endswith(('.png','.webp','.jpg','.jpeg')): route.fulfill(body=IMAGE,content_type='image/png');return
        candidate=(ROOT/path.lstrip('/')).resolve()
        if candidate.is_relative_to(ROOT) and candidate.is_file():
            kind='application/javascript' if candidate.suffix=='.js' else mimetypes.guess_type(str(candidate))[0] or 'application/octet-stream'
            route.fulfill(body=candidate.read_bytes(),content_type=kind);return
        route.abort()
    context.route('**/*',serve)
    context.add_init_script('('+INIT+')()')

def timer_page(context, page=None):
    page=page or context.new_page();page.goto(ORIGIN+'/fixture')
    for script in ['preferences','alarm-sound','timer-controller']:
        page.add_script_tag(content=(ROOT/('src/'+script+'.js')).read_text(encoding='utf8'))
    page.evaluate("""() => {
      const UI={bindScrollCues:()=>({update(){},dispose(){}}),bindPopup(){},bindDialog(){},visible:e=>!e.hidden,show:(e,fn)=>{e.hidden=false;fn?.();},hide:(e,fn)=>{e.hidden=true;fn?.();}};
      window.timer=SolarModules.TimerController.create({document,UI,Preferences:SolarModules.Preferences,translate:k=>k,shutdownBridge:{eligible:false}});
      document.getElementById('loading').hidden=true;
      window.SolarTime={canApplyUpdate:()=>!timer.isBusy()};
      window.addEventListener('pagehide',()=>timer.dispose());
    }""")
    return page

def arm(page, minutes):
    page.evaluate("""minutes=>{document.getElementById('alarm-hours').value='0';document.getElementById('alarm-minutes').value=String(minutes);const t=document.getElementById('alarm-enabled');t.checked=true;t.dispatchEvent(new Event('change'));}""",minutes)

def cancel(page):
    page.evaluate("""()=>{const t=document.getElementById('alarm-enabled');t.checked=false;t.dispatchEvent(new Event('change'));}""")

def main():
    engine=os.environ.get('SOLAR_BROWSER','chromium');report={'browser':engine,'passed':False,'checks':[],'limitations':['Desktop WebKit does not replace physical iPhone Home Screen verification.','Synthetic textures and silent generated audio; no native Windows shutdown.']}
    context=None
    try:
        with sync_playwright() as p:
            browser=getattr(p,engine).launch(headless=True,**({'args':['--no-sandbox']} if engine=='chromium' else {}))
            try:
                context=browser.new_context(viewport={'width':1280,'height':800},locale='ko-KR',reduced_motion='reduce')
                faults={'ads':0};routed(context,faults)
                a=timer_page(context);b=timer_page(context)
                arm(a,1);b.wait_for_function('timer.getState().alarm.enabled')
                cancel(a);b.wait_for_function('!timer.getState().alarm.enabled')
                arm(a,1);arm(a,5);b.wait_for_function('timer.getState().alarm.minutes===5')
                deadline=a.evaluate('timer.getState().alarm.deadline')
                timer_page(context,a);assert a.evaluate('timer.getState().alarm.deadline')==deadline
                report['checks'].append('cross-tab cancel/change and reload preserve the current deadline')
                a.evaluate("""()=>{const key='solar-time.timers.v1',s=JSON.parse(localStorage.getItem(key));s.alarm.deadline=Date.now()+500;localStorage.setItem(key,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key}));}""")
                a.wait_for_function('timer.getState().alarm.ringing',timeout=15000)
                b.wait_for_function('timer.getState().alarm.ringing',timeout=15000)
                a.wait_for_timeout(150)
                assert int(a.locator('#alarm-dialog').evaluate('(e)=>e.open'))+int(b.locator('#alarm-dialog').evaluate('(e)=>e.open'))==1
                for tab in [a,b]: tab.add_script_tag(content=(ROOT/'src/page-runtime.js').read_text(encoding='utf8'))
                faults['version']={'version':'999.0','revision':'r1'}
                for tab in [a,b]:
                    url=tab.url;tab.evaluate('SolarPageRuntime.checkForUpdate(true)');assert tab.url==url;assert tab.evaluate('SolarPageRuntime.getPendingUpdate().version')=='999.0'
                del faults['version']
                # Destroy the ringing owner and assert ownership recovery in the remaining tab.
                owner=a if a.locator('#alarm-dialog').evaluate('(e)=>e.open') else b
                survivor=b if owner==a else a
                owner.close();survivor.evaluate('timer.check()');survivor.wait_for_function("document.getElementById('alarm-dialog').open",timeout=15000)
                cancel(survivor);survivor.wait_for_function("!document.getElementById('alarm-dialog').open")
                report['checks'].append('single ringing owner, update deferral while ringing, owner-close recovery')
                survivor.close()
                # Real application boot under failed locale downloads, then successful retry.
                for failure in ['offline','json']:
                    faults['locale']=failure;page=context.new_page();page.goto(ORIGIN+'/index.html')
                    page.wait_for_function('!!window.SolarTime?.renderer',timeout=30000)
                    assert page.locator('#fatal-error').is_hidden()
                    assert page.evaluate('SolarTime.getState().copyLanguage')=='kor'
                    assert not page.evaluate("SolarModules.LanguageData.loaded('kor')")
                    faults['locale']=None;page.evaluate("window.dispatchEvent(new Event('online'))")
                    page.wait_for_function("SolarModules.LanguageData.loaded('kor')",timeout=15000)
                    assert page.evaluate("SolarTime.translate('settings')")=='화면 설정'
                    page.wait_for_function("document.getElementById('loading').hidden",timeout=15000)
                    page.set_viewport_size({'width':800,'height':600});page.wait_for_timeout(250)
                    page.set_viewport_size({'width':1280,'height':800});page.bring_to_front();page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
                    page.wait_for_timeout(250)
                    assert page.locator('#fatal-error').is_hidden()
                    assert page.evaluate('SolarTime.renderer.w')>0
                    if failure=='offline':
                        edges=page.evaluate("""()=>{const r=SolarTime.renderer,result=[];for(const id of ['saturn','uranus'])for(const screen of [{x:-150,y:r.h/2},{x:r.w+150,y:r.h/2},{x:r.w/2,y:-150},{x:r.w/2,y:r.h+150}])result.push(!r.visible(screen,102)&&r.visible(screen,r.bodyVisibleRadius({id},100,{surface:true}))&&r.bodyVisibleRadius({id},100)===r.bodyVisibleRadius({id},100,{surface:true}));return result;}""")
                        assert all(edges)
                    page.close()
                report['checks'].append('offline/malformed locale boot and recovery, resize/pageshow, ring-only viewport edges')
                # Never contact live ads: first script fails, second is a local inert stub.
                ad=context.new_page();ad.goto(ORIGIN+'/fixture');ad.set_viewport_size({'width':1800,'height':900})
                ad.evaluate("""()=>{document.querySelector('meta[name="solar-time-ad-slot"]').content='123';window.SolarConsent={value:()=> 'granted'};const native=matchMedia;window.matchMedia=q=>q.includes('min-width:1600px')?{matches:true,addEventListener(){}}:native(q);}""")
                ad.add_script_tag(content=(ROOT/'src/adsense.js').read_text(encoding='utf8'))
                ad.wait_for_function('window.adsbygoogle?.length===1',timeout=10000)
                assert faults['ads']==2
                assert ad.locator('script[src*="adsbygoogle.js"]').count()==1
                report['checks'].append('failed ad script is removed and retried once successfully')
                ad.close();report['passed']=True
            finally:
                if context:
                    if not report['passed']:
                        (ROOT/'.cloudflare').mkdir(exist_ok=True)
                        for i,page in enumerate(context.pages):
                            try: page.screenshot(path=str(ROOT/f'.cloudflare/recovery-{engine}-{i}.png'))
                            except Exception: pass
                    context.close()
                browser.close()
    except Exception as error:
        report['error']=str(error)
        raise
    finally:
        target=ROOT/f'.cloudflare/recovery-{engine}.json';target.parent.mkdir(exist_ok=True)
        target.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(engine, 'recovery checks passed',flush=True)

if __name__=='__main__':main()
