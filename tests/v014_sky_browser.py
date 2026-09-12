"""Isolated real-browser sky tests; not the full application's legacy UI suite.
Requires Python Playwright and Chromium (CHROMIUM environment variable optional).
"""
from pathlib import Path
import base64, json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def run():
    result={'version':'0.14','scope':'sky component in Chromium; not full application','checks':[]}
    def check(name, value):
        assert value, name
        result['checks'].append({'name':name,'pass':True})
        print('PASS',name,flush=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'), headless=True,
            args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
        def setup(mode='gpu'):
            page=browser.new_page(viewport={'width':960,'height':540},device_scale_factor=1)
            page.set_content('<style>body{margin:0;background:black}canvas{width:960px;height:540px}</style><canvas id="starfield" aria-hidden="true"></canvas>')
            page.evaluate('(url)=>window.SolarAssets={sky:url,stars:[[0,1,0,.7,.4,0],[1,0,0,.8,.5,1]]}',
                'data:image/webp;base64,'+base64.b64encode((ROOT/'assets/universe.webp').read_bytes()).decode())
            if mode=='cpu':
                page.evaluate("""()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:original.call(this,type,...args)};}""")
            if mode=='shader-failure':
                page.evaluate("""()=>{const original=WebGLRenderingContext.prototype.getShaderParameter;WebGLRenderingContext.prototype.getShaderParameter=function(s,p){return p===this.COMPILE_STATUS?false:original.call(this,s,p)};}""")
            page.add_script_tag(content=(ROOT/'src/sky.js').read_text())
            page.evaluate("""()=>{window.sky=new SolarSky(document.querySelector('canvas'));sky.resize(960,540,1);window.camera={azimuth:25*Math.PI/180,elevation:45*Math.PI/180};window.opts={skyMotion:false,twinkle:true,comets:false};window.tick=0;window.running=true;function frame(){if(!running)return;sky.draw(tick++/60,camera,opts);requestAnimationFrame(frame);}frame();}""")
            page.wait_for_function('sky.ready && sky.stats.frames>0',timeout=20000)
            return page
        page=setup()
        check('WebGL initializes and renders the distributed lossless image',page.evaluate("sky.stats.backend==='gpu' && sky.stats.textureSize[0]===4096"))
        page.wait_for_timeout(100)
        frames=page.evaluate('sky.stats.frames');page.wait_for_timeout(120)
        check('unchanged sky does not issue redundant draws',page.evaluate('sky.stats.frames')==frames)
        check('retained WebGL framebuffer is nonblack',page.evaluate("""()=>{let a=new Uint8Array(960*540*4);sky.gl.readPixels(0,0,960,540,sky.gl.RGBA,sky.gl.UNSIGNED_BYTE,a);let n=0;for(let i=0;i<a.length;i+=4)n+=a[i]+a[i+1]+a[i+2];return n>100000;}"""))
        page.evaluate('running=false')
        stats=page.evaluate("""()=>{let n=sky.stats.frames;for(let i=0;i<30;i++){camera.azimuth+=.001;sky.draw(i/60,camera,opts);}return sky.stats.frames-n;}""")
        check('manual camera motion is not capped by the passive-background throttle',stats==30)
        drift=page.evaluate("""()=>{opts.skyMotion=true;let n=sky.stats.frames;for(let i=0;i<30;i++)sky.draw(1+i/60,camera,opts);opts.skyMotion=false;return sky.stats.frames-n;}""")
        check('passive drift coalesces rapid redundant updates',drift<10)
        pause=page.evaluate("""()=>{let offset=sky.offset,frames=sky.stats.frames;sky.pause();sky.draw(1000,camera,opts);sky.resume();sky.draw(1000,camera,opts);return {same:sky.offset===offset,frame:sky.stats.frames===frames};}""")
        check('pause/resume retains the view without hidden-time catch-up',pause['same'] and pause['frame'])
        page.evaluate('window.loss=sky.gl.getExtension("WEBGL_lose_context");loss.loseContext()')
        page.wait_for_function('sky.stats.backend==="context-lost"')
        page.wait_for_timeout(100);page.evaluate('loss.restoreContext()')
        page.wait_for_function('sky.ready && sky.stats.backend==="gpu"',timeout=10000)
        before=page.evaluate('sky.stats.frames');page.evaluate('sky.draw(1000,camera,opts)')
        check('context recovery redraws an otherwise stationary sky',page.evaluate('sky.stats.frames')==before+1)
        result['gpu']=page.evaluate('({...sky.stats})')
        page.evaluate('camera.azimuth=25*Math.PI/180;camera.elevation=Math.PI/4;sky.offset=0;sky.draw(1000,camera,opts)')
        page.screenshot(path=str(ROOT/'docs/sky-v0.14-browser.png'))
        page.evaluate('sky.dispose()');check('dispose releases decoded-image and GPU owners',page.evaluate('sky.gl===null&&sky.image===null&&sky.rayTables.size===0'))
        page.close()
        for mode in ['cpu','shader-failure']:
            page=setup(mode)
            check(mode+' recovers with a real 2D sky',page.evaluate("sky.stats.backend==='compatibility' && sky.ctx!==null && sky.pixels.width===2048"))
            check(mode+' preserves the visible background canvas id',page.evaluate("document.getElementById('starfield')===sky.canvas"))
            page.wait_for_timeout(500)
            check(mode+' CPU output is nonblack',page.evaluate("""()=>{const a=sky.ctx.getImageData(0,0,sky.canvas.width,sky.canvas.height).data;let n=0;for(let i=0;i<a.length;i+=4)n+=a[i]+a[i+1]+a[i+2];return n>100000;}"""))
            page.evaluate('running=false;sky.resize(320,1800,1);sky.draw(2000,camera,opts)')
            page.wait_for_function('sky.softwareCanvas && sky.softwareCanvas.width*sky.softwareCanvas.height<=160000 && !sky.softwareBusy',timeout=15000)
            check(mode+' portrait raster has a bounded allocation',page.evaluate('sky.softwareCanvas.width*sky.softwareCanvas.height<=160000'))
            page.evaluate('sky.pause()');before=page.evaluate('sky.stats.frames');page.wait_for_timeout(150)
            check(mode+' pause cancels queued CPU work',page.evaluate('sky.stats.frames')==before and page.evaluate('!sky.softwareBusy && sky.softwareTimer===null'))
            page.evaluate('sky.resume();sky.draw(2001,camera,opts)');page.wait_for_function(f'sky.stats.frames>{before}',timeout=15000)
            check(mode+' resumes from the retained texture',page.evaluate('sky.pixels!==null'))
            page.evaluate('sky.dispose()');page.close()
        browser.close()
    result['passed']=len(result['checks'])
    (ROOT/'docs/browser-verification-v0.14.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result
if __name__=='__main__':run()
