"""Check approach particles through direct, boot and replay Saturn boarding."""
import functools
import http.server
import json
import os
import io
import threading
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright


def main():
    root = Path(__file__).resolve().parents[2]
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            options = {'headless': True, 'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
            if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):
                options['executable_path'] = os.environ['SOLAR_CHROMIUM_EXECUTABLE']
            browser = p.chromium.launch(**options)
            try:
                for mode in ['direct','boot','replay']:
                    width,height,ratio=1280,800,1
                    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=ratio)
                    try:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.add_init_script("localStorage.setItem('solarTimeCookieConsentV1','denied');localStorage.setItem('solar-time.help-seen.v1','true');Math.random=()=>.25;")
                        if mode=='boot':
                            page.add_init_script("localStorage.setItem('solar-time.opening-mode.v1',JSON.stringify('saturn'))")
                        address=(root/'index.html').as_uri() if os.environ.get('SOLAR_TEST_FILE','1')=='1' else f'http://127.0.0.1:{server.server_port}/'
                        page.goto(address, wait_until='domcontentloaded')
                        if mode!='boot':
                            page.wait_for_function('window.SolarTime && !SolarTime.getState().opening',timeout=30000)
                            if mode=='direct':
                                page.evaluate('SolarTime.renderer.startRingTour()')
                            else:
                                page.evaluate("document.querySelector('[data-opening=saturn]').click()")
                                page.keyboard.press('t')
                        page.wait_for_function('!!window.SolarTime?.renderer.ringTour',timeout=50000)
                        rows=[]
                        for age in [2.2,4]:
                            page.wait_for_function(f'SolarTime.renderer.ringTour?.age>={age}',timeout=60000)
                            result=page.evaluate("""() => {
                              const r=SolarTime.renderer,t=r.ringTour,f=r.openingParticleFrame(performance.now());
                              if(!f)throw Error('approach field is missing');
                              const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;
                              canvas.id='saturn-particle-probe';canvas.style.cssText='position:fixed;inset:0;z-index:999999;background:#000;pointer-events:none';
                              const c=canvas.getContext('2d');
                              let visible=0;
                              const frame=r.openingParticleProjection(f);
                              r.drawFlightParticles(c,f,(p,field,out)=>{const q=r.projectOpeningParticle(p,field,out,true,frame);if(q.visible&&q.alpha>.01)visible++;return q;});
                              document.body.append(canvas);
                              if(f.replay.saturnTour!==t||!t.usesWarpParticles)throw Error('t1 Saturn lifecycle is missing');
                              if(f.points.some(p=>p.tile===undefined||p.color<0||p.color>3))throw Error('t1 warp particle style is missing');
                              if(r.openingParticles!==f)throw Error('Saturn lost its shared t1 field');
                              return {age:t.age,visible,alpha:f.alpha,count:f.points.length};
                            }""")
                            # file:// atlas images taint canvas reads; inspect rendered pixels via a browser screenshot.
                            probe=Image.open(io.BytesIO(page.locator('#saturn-particle-probe').screenshot())).convert('RGB')
                            pixels=[rgb for rgb in probe.getdata() if max(rgb)>=8]
                            result['lit']=len(pixels)
                            result['colorSpread']=sum(max(rgb)-min(rgb) for rgb in pixels)/max(1,len(pixels))
                            page.locator('#saturn-particle-probe').evaluate('(canvas)=>canvas.remove()')
                            assert result['visible']>=50 and result['lit']>=200,result
                            rows.append(result)
                        folder=root/'.cloudflare/browser-artifacts/travel-particles';folder.mkdir(parents=True,exist_ok=True)
                        page.screenshot(path=str(folder/f'{mode}.png'))
                        page.evaluate("""() => {
                          const r=SolarTime.renderer,t=r.ringTour;t.age=10;t.state='cruising';t.pose=t.cameraPose();
                          const f=r.openingParticleFrame(performance.now());
                          if(!f)throw Error('extended approach field disappeared at docking');
                          const frame=r.openingParticleProjection(f),visible=f.points.reduce((count,p)=>{
                            const q=r.projectOpeningParticle(p,f,{},true,frame);return count+(q.visible&&q.alpha>.01?1:0);
                          },0);
                          if(visible<50)throw Error('extended docking particles are not visibly retained: '+visible);
                          t.age=10.499;if(!r.openingParticleFrame(performance.now()))throw Error('approach field ended before its half-second afterglow');
                          t.age=10.5;if(r.openingParticleFrame(performance.now())||r.openingParticles)throw Error('approach field survived its shortened deadline');
                        }""")
                        page.wait_for_function("SolarTime.renderer.ringTour?.state==='cruising'")
                        before=page.locator('#zoom-value').inner_text()
                        page.mouse.move(640,400)
                        page.mouse.down(button='right')
                        page.mouse.move(640,320,steps=8)
                        page.mouse.up(button='right')
                        lens=page.evaluate("""() => {const r=SolarTime.renderer,t=r.ringTour;return {fov:t.fov,text:document.querySelector('#zoom-value').textContent,expected:(r.camera.zoom*Math.tan(t.startPose.fov*Math.PI/360)/Math.tan(t.fov*Math.PI/360)).toFixed(1)+'×'};}""")
                        assert lens['fov']<72 and lens['text']!=before and lens['text']==lens['expected'],lens
                        floor=page.evaluate("""() => {const r=SolarTime.renderer,t=r.ringTour;t.zoom(.000001);const level=r.camera.zoom*Math.tan(t.startPose.fov*Math.PI/360)/Math.tan(t.fov*Math.PI/360);return {fov:t.fov,level};}""")
                        assert floor['level']>=.8-1e-9,floor
                        lens['floor']=floor
                        page.keyboard.press('Escape')
                        page.wait_for_function('!SolarTime.renderer.ringTour',timeout=60000)
                        page.wait_for_function("document.querySelector('#zoom-value').textContent===SolarTime.renderer.camera.zoom.toFixed(1)+'×'")
                        assert not errors,errors
                        print(json.dumps({'mode':mode,'address':address,'rows':rows,'lens':lens}),flush=True)
                    finally:
                        context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == '__main__':
    main()
