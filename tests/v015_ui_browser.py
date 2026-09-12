"""Control integration checks, not a full ephemeris/material regression suite.
Actual release app/renderer/materials/sky + test astronomy/surface/style adapters.
Deterministic ESC cases mock browser fullscreen/keyboard permissions explicitly.
Requires Python Playwright + Chromium (CHROMIUM environment variable supported).
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
import json, os, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
STYLE='''body{margin:0;background:#010207;color:white;font:14px sans-serif}#universe,#starfield{position:fixed;left:0;top:0;width:100vw;height:100vh}#starfield{z-index:-2}#universe{z-index:-1}.ui{position:relative}button,input,select{font:inherit}svg{width:20px;height:20px}aside,dialog{background:#14202e;color:white}[hidden]{display:none!important}.zen .ui:not(#view-controls){visibility:hidden}.zen #view-controls{visibility:hidden}.zen.pointer-awake #view-controls{visibility:visible}.loading{display:none}'''
MOCK='''(mode)=>{window.testFS={active:false,entries:0,exits:0,locks:0,unlocks:0};
Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>testFS.active?document.documentElement:null});
document.documentElement.requestFullscreen=async()=>{testFS.entries++;testFS.active=true;document.dispatchEvent(new Event('fullscreenchange'));};
document.exitFullscreen=async()=>{testFS.exits++;testFS.active=false;document.dispatchEvent(new Event('fullscreenchange'));};
Object.defineProperty(navigator,'keyboard',{configurable:true,value:{lock:async keys=>{testFS.locks++;if(JSON.stringify(keys)!=='["Escape"]')throw Error('locked more than ESC');if(mode==='denied')throw Error('permission denied');},unlock:()=>testFS.unlocks++}});
}'''
def run():
    result={'version':'0.15','scope':'actual app/renderer/materials/sky with explicit test astronomy, surface, storage and CSS adapters; offline about:blank','escMockedPermissionCases':True,'checks':[]}
    def check(name,value):
        assert value,name
        print('PASS',name,flush=True);result['checks'].append({'name':name,'pass':True})
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
        def setup(mode='locked'):
            page=browser.new_page(viewport={'width':1280,'height':800})
            page.on('pageerror',lambda e: print('PAGE ERROR',e,flush=True))
            # Run offline on about:blank because the sandbox may block even loopback HTTP.
            # Only dependency adapters/storage are test fixtures; release source is unmodified.
            html=(ROOT/'index.html').read_text()
            html=re.sub(r'<script\b[^>]*src=[^>]+></script>', '', html)
            html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>', '', html)
            page.set_content(html)
            page.add_style_tag(content=STYLE)
            page.evaluate("Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});")
            page.evaluate("""()=>{const memory=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}});
            const base={azimuth:.4,elevation:.7,panX:0,panY:0};localStorage.setItem('solar-time.camera-presets.v1',JSON.stringify({schema:1,slots:[{...base,focus:'earth',zoom:20},{...base,focus:'moon',zoom:24},{...base,focus:'jupiter',zoom:30}]}));window.SolarAssets={materials:{},stars:[],sky:''};}""")
            if mode!='native':page.evaluate(MOCK,mode)
            page.add_script_tag(content=(ROOT/'tests/fixtures/controls-v015.js').read_text())
            for name in ['sky-asset','materials','sky','renderer','app']:
                page.add_script_tag(content=(ROOT/'src'/f'{name}.js').read_text())
            page.wait_for_function("window.SolarTime && SolarTime.renderer.sky.ready",timeout=20000)
            return page
        page=setup()
        check('v0.15 starts and the new 4096 sky is used without repacking old assets',page.evaluate("SolarTime.version==='0.15' && SolarAssets.skyVersion==='0.15' && SolarTime.renderer.sky.image.width===4096"))
        check('close-up starts an animation, not a jump',page.evaluate('''()=>{document.querySelector('[data-body="earth"]').click();const r=SolarTime.renderer,z=r.camera.zoom;document.getElementById('focus-body').click();return r.camera.zoom===z && r.cameraTween.to.focus==='earth';}'''))
        page.evaluate('SolarTime.renderer.advanceCamera(performance.now()+2000)')
        check('home button also starts the common transition',page.evaluate('''()=>{const r=SolarTime.renderer,z=r.camera.zoom;document.getElementById('fit-view').click();return r.camera.zoom===z && r.cameraTween.to.zoom===1;}'''))
        page.evaluate('SolarTime.renderer.advanceCamera(performance.now()+2000)')
        for key,focus in [('1','earth'),('2','moon'),('3','jupiter')]:
            page.evaluate("document.getElementById('zoom-in').focus()")
            page.keyboard.press(key)
            check('preset '+key+' works with button focus',page.evaluate(f'SolarTime.renderer.cameraTween.to.focus==={json.dumps(focus)}'))
        page.evaluate("document.getElementById('help-dialog').showModal()")
        page.keyboard.press('1');check('preset works with help modal open',page.evaluate("SolarTime.renderer.cameraTween.to.focus==='earth' && document.getElementById('help-dialog').open"))
        page.keyboard.press('Escape');check('normal ESC closes a modal without entering fullscreen',page.evaluate("!document.getElementById('help-dialog').open && testFS.entries===0"))
        page.evaluate("document.getElementById('date-button').click();document.getElementById('date-input').focus()")
        page.keyboard.press('2');check('preset works with date input focused and does not close the form',page.evaluate("SolarTime.renderer.cameraTween.to.focus==='moon' && document.getElementById('date-dialog').open"))
        page.keyboard.press('Escape')
        page.evaluate("SolarTime.renderer.options.moon=false;document.getElementById('show-moon').checked=false")
        page.keyboard.press('2');check('recalling a hidden Moon re-enables its display',page.evaluate("SolarTime.renderer.options.moon && document.getElementById('show-moon').checked && SolarTime.renderer.cameraTween.to.focus==='moon'"))
        page.evaluate("document.getElementById('camera-preset-1').click()")
        page.keyboard.press('3');check('preset works from the preset menu and cancels the pending menu action',page.evaluate("!document.getElementById('preset-dialog').open && SolarTime.renderer.cameraTween.to.focus==='jupiter'"))
        page.keyboard.press('h');check('H enters viewing mode with button focus',page.evaluate('SolarTime.getState().zen'))
        page.wait_for_timeout(2000);page.keyboard.press('1');check('presets still work after viewing-mode controls become inert',page.evaluate("SolarTime.renderer.cameraTween.to.focus==='earth'"))
        page.keyboard.press('f');check('F enters fullscreen while in viewing mode',page.evaluate('SolarTime.getState().fullscreen && SolarTime.getState().zen'))
        page.wait_for_function("SolarTime.getState().escapeLock==='locked'")
        page.keyboard.press('Escape');check('first ESC leaves viewing mode only',page.evaluate('!SolarTime.getState().zen && SolarTime.getState().fullscreen && testFS.exits===0'))
        page.keyboard.press('Escape');check('second ESC exits fullscreen once',page.evaluate('!SolarTime.getState().fullscreen && testFS.exits===1'))
        page.keyboard.press('Escape');check('ESC outside both modes never re-enters fullscreen',page.evaluate('testFS.entries===1 && testFS.exits===1'))
        page.keyboard.press('f');page.keyboard.press('f');check('F twice shares the same exit owner',page.evaluate('!SolarTime.getState().fullscreen && testFS.entries===2 && testFS.exits===2'))
        page.keyboard.press('f');page.keyboard.press('h')
        page.evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',repeat:false,cancelable:true,bubbles:true}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',repeat:true,cancelable:true,bubbles:true}));")
        check('held-key repeats do not consume the next ESC stage',page.evaluate('!SolarTime.getState().zen && SolarTime.getState().fullscreen'))
        page.keyboard.press('f')
        check('only ESC is requested for keyboard lock and unlock runs on exit',page.evaluate('testFS.locks>=3 && testFS.unlocks>=3'))
        check('renderer remains live without a fatal error',page.evaluate("document.getElementById('fatal-error').hidden && SolarTime.getState().frameCount>2"))
        page.close()
        page=setup('denied');page.keyboard.press('f');page.wait_for_function("SolarTime.getState().escapeLock==='denied'")
        check('denied keyboard permission does not break fullscreen rendering',page.evaluate("SolarTime.getState().fullscreen && document.getElementById('fatal-error').hidden"))
        page.keyboard.press('f');check('F still exits after keyboard permission denial',page.evaluate('!SolarTime.getState().fullscreen'))
        page.close()
        # Native Fullscreen API smoke check; no OS ESC interception claim is made here.
        page=setup('native');page.keyboard.press('f');page.wait_for_timeout(300)
        entered=page.evaluate('!!document.fullscreenElement');result['nativeFullscreenEntered']=entered
        if entered:
            page.keyboard.press('f');page.wait_for_timeout(200)
            check('native Chromium Fullscreen API toggles off via F',page.evaluate('!document.fullscreenElement'))
        result['nativeKeyboardLockStatus']=page.evaluate('SolarTime.getState().escapeLock')
        page.close();browser.close()
    result['passed']=len(result['checks']);(ROOT/'docs/ui-verification-v0.15.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result
if __name__=='__main__':run()
