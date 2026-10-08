"""Check distant-body pixels and the real camera on desktop/mobile viewports."""
import functools
import http.server
import json
import os
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    root = Path(__file__).resolve().parents[2]
    artifacts = root / '.cloudflare/browser-artifacts/body-points'
    artifacts.mkdir(parents=True, exist_ok=True)
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
                for width, height, ratio in [(1280, 800, 1), (390, 844, 2)]:
                    context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=ratio)
                    try:
                        page = context.new_page()
                        errors = []
                        page.on('pageerror', lambda error: errors.append(str(error)))
                        page.add_init_script("localStorage.setItem('solarTimeCookieConsentV1','denied');localStorage.setItem('solar-time.help-seen.v1','true');Math.random=()=>.25;")
                        page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='domcontentloaded')
                        page.wait_for_function('window.SolarTime && !SolarTime.getState().opening', timeout=30000)
                        result = page.evaluate("""() => {
                          const r=SolarTime.renderer,canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;
                          const c=canvas.getContext('2d'),body={id:'earth',color:'#4499ff'},target={body,r:.3,screen:{x:100,y:60,z:0,behind:false}};
                          const blocker=z=>({body:{id:'saturn'},r:20,screen:{x:100,y:60,z,behind:false}});
                          r.drawBodyPoint(c,target);const lit=c.getImageData(100,60,1,1).data[3];c.clearRect(0,0,200,120);
                          r.drawBodyPoint(c,target,[blocker(1),blocker(2)]);const hidden=c.getImageData(100,60,1,1).data[3];c.clearRect(0,0,200,120);
                          r.drawBodyPoint(c,target,[blocker(-1)]);const foreground=c.getImageData(100,60,1,1).data[3];
                          r.stopAutoRotate();r.options.labels=false;
                          const home=r.defaultCameraSnapshot(),tracking=r.trackingMoveState('earth',home),ms=SolarTime.getState().simulationMs,samples=[];
                          for(const radius of [.02,.1,.5,1,2.2,3.5,5.2,8,20]){
                            r.restoreCamera({...tracking,dolly:tracking.dolly*radius/(Math.min(r.w,r.h)*.25)});
                            r.draw(ms,0,performance.now());const item=r.currentFrameItem('earth');
                            samples.push({requested:radius,radius:item.r,point:r.bodyPointLod(item.body,item.r),x:item.screen.x,y:item.screen.y});
                          }
                          r.restoreCamera({...home,dolly:home.dolly*.03});
                          return {lit,hidden,foreground,samples};
                        }""")
                        assert result['lit'] > 0 and result['foreground'] == result['lit'] and result['hidden'] == 0, result
                        for row in result['samples']:
                            assert abs(row['radius'] - row['requested']) < .00001, row
                        page.wait_for_timeout(250)
                        page.screenshot(path=str(artifacts / f'far-{width}.png'))
                        page.evaluate('SolarTime.renderer.restoreCamera(SolarTime.renderer.defaultCameraSnapshot())')
                        page.wait_for_timeout(250)
                        page.screenshot(path=str(artifacts / f'normal-{width}.png'))
                        assert not errors, errors
                        print(json.dumps({'width': width, 'dpr': ratio, **result}), flush=True)
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
