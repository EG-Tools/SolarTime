"""Check finite background depth and real wheel parallax on the local file."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    root = Path(__file__).resolve().parents[2]
    with sync_playwright() as p:
        options = {'headless': True, 'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
        if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['SOLAR_CHROMIUM_EXECUTABLE']
        browser = p.chromium.launch(**options)
        try:
            page = browser.new_page(viewport={'width': 1280, 'height': 800})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script("localStorage.setItem('solarTimeCookieConsentV1','denied');localStorage.setItem('solar-time.help-seen.v1','true');")
            page.goto((root/'index.html').as_uri(), wait_until='domcontentloaded')
            page.wait_for_function('window.SolarTime && !SolarTime.getState().opening', timeout=60000)
            before = page.evaluate("""async () => {
              const r=SolarTime.renderer,s=r.sky,e=SolarVisualEffects;
              r.setOption('skyMotion',false,false);r.stopAutoRotate(performance.now());
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
              if(s.stats.backend!=='gpu')throw Error('sky shader did not initialize: '+s.stats.error);
              const data=e.starWorldData(SolarAssets.starData);let min=Infinity,max=0;
              for(let i=0;i<data.length;i+=6){const d=Math.hypot(data[i],data[i+1],data[i+2]);min=Math.min(min,d);max=Math.max(max,d);}
              window.depthTestBefore={dolly:r.camera.dolly,axes:JSON.stringify(s.starAxes),data};
              return {min,max,count:data.length/6,zoom:document.querySelector('#zoom-value').textContent};
            }""")
            assert 7.99999 <= before['min'] < 8.1 and 98.9 < before['max'] <= 99.00001, before
            page.mouse.move(640,400)
            page.mouse.wheel(0,-360)
            page.wait_for_function('!!SolarTime.renderer.manualBackgroundStars && SolarTime.renderer.sky.manualZ!==undefined')
            page.wait_for_function('SolarTime.renderer.sky.manualX===SolarTime.renderer.manualBackgroundStars.offset[0]')
            page.wait_for_function('!SolarTime.renderer.cameraTween')
            after = page.evaluate("""() => {
              const r=SolarTime.renderer,s=r.sky,b=window.depthTestBefore,eye=r.manualBackgroundStars.offset;
              const dot=(v,w)=>v.reduce((a,x,i)=>a+x*w[i],0),axes=s.starAxes,near=[],far=[];
              for(let i=0;i<b.data.length;i+=6){
                const v=Array.from(b.data.slice(i,i+3)),distance=Math.hypot(...v),z=-dot(v,axes.forward);
                if(z<distance*.6)continue;
                const project=p=>[dot(p,axes.right)/-dot(p,axes.forward),dot(p,axes.down)/-dot(p,axes.forward)];
                const a=project(v),c=project(v.map((x,k)=>x-eye[k])),radial=Math.hypot(...a);
                if(radial<.1)continue;
                const movement=Math.hypot(c[0]-a[0],c[1]-a[1])/radial;
                if(distance<20)near.push(movement);if(distance>80)far.push(movement);
              }
              const cpu=Object.create(s);cpu.gl=null;cpu.starPose=null;cpu.visibleStars=[];
              const canvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;
              cpu.drawStars(canvas.getContext('2d'),0,r.options,()=>{});
              const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
              return {dolly:r.camera.dolly,changed:r.camera.dolly!==b.dolly,eye,uniform:Array.from(s.gl.getUniform(s.starProgram,s.starU.manualEye)),
                axesUnchanged:JSON.stringify(axes)===b.axes,near:avg(near),far:avg(far),cpuVisible:cpu.visibleStars.length,
                zoom:document.querySelector('#zoom-value').textContent,error:s.gl.getError()};
            }""")
            assert after['changed'] and after['axesUnchanged'], after
            assert after['near'] > after['far']*3 > 0, after
            assert after['cpuVisible'] > 0 and after['error'] == 0, after
            assert all(abs(a-b)<1e-6 for a,b in zip(after['eye'],after['uniform'])), after
            assert after['zoom'] == before['zoom'], 'physical dolly must not change lens readout'
            assert not errors, errors
            print(json.dumps({'before':before,'after':after}), flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
