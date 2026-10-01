"""Small, offline CPU/worker/direct WebGL check for spherical cloud opacity."""

def verify_cloud_weather(browser, root, check, diagnostics=None):
    ctx = browser.new_context(viewport={'width': 640, 'height': 640})
    try:
        page = ctx.new_page()
        if diagnostics:
            diagnostics.attach(ctx, page, 'spherical cloud weather')
        page.route('**/*', lambda route: route.abort())
        page.set_content('<canvas id="test" width="128" height="128"></canvas>')
        for file in ['src/surface-style.js', 'src/surface.js']:
            page.evaluate((root/file).read_text(encoding='utf8'))
        result = page.evaluate("""async () => {
          const source=document.createElement('canvas');source.width=64;source.height=32;
          const paint=source.getContext('2d');paint.fillStyle='#606060';paint.fillRect(0,0,64,32);
          const earth=source.toDataURL();paint.fillStyle='#bbbbbb';paint.fillRect(0,0,64,32);
          const clouds=source.toDataURL();paint.fillStyle='#eeeeee';paint.fillRect(0,0,32,32);paint.fillStyle='#222222';paint.fillRect(32,0,32,32);
          const assets={earth,clouds,'clouds-alt':source.toDataURL()};window.SolarAssets={materials:assets};
          const kernel=SolarSurface.kernel();kernel.setAssets(assets);
          // Exercise upload-time blending with deliberately mismatched edges,
          // not a uniform texture that could hide a latitude/longitude seam.
          const tile=document.createElement('canvas');tile.width=256;tile.height=128;
          const tc=tile.getContext('2d'),pixels=tc.createImageData(256,128);
          for(let y=0;y<128;y++)for(let x=0;x<256;x++){
            const p=(y*256+x)*4;pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=Math.round(x*.5+y*.4);pixels.data[p+3]=255;
          }
          tc.putImageData(pixels,0,0);
          const prepared=kernel.materialCanvas(tile,256,128,true,true,true).image.data;
          let seamDifference=0;
          for(let y=0;y<128;y++)seamDifference=Math.max(seamDifference,Math.abs(prepared[y*256*4]-prepared[(y*256+255)*4]));
          for(let x=0;x<256;x++)seamDifference=Math.max(seamDifference,Math.abs(prepared[x*4]-prepared[(127*256+x)*4]));
          const interiorUnchanged=prepared[(64*256+128)*4]===pixels.data[(64*256+128)*4];
          if(seamDifference!==0||!interiorUnchanged)throw Error('Tiled source seam or interior changed incorrectly');
          const gpu=new kernel.Engine(),cpu=new kernel.Engine({gpu:false});
          const direct=new SolarSurface.DirectRenderer(document.getElementById('test'));
          direct.resize(128,128,1);
          const job={id:'earth',diam:128,textureWidth:64,cloudTextureWidth:64,cloudAmount:.5,cloudSeed:.321,cloudReveal:.55,
            weatherDay:20726,cloudSpinDays:.997,phase:.2,frame:{u:[1,0,0],v:[0,0,1],pole:[0,-1,0]},light:[.3,.2,.9327379]};
          const manualTextures=[];
          try {
            const backend=gpu.stats.backend;
            await cpu.render(job);const cpuPixels=cpu.ctx.getImageData(0,0,128,128).data;
            const gl=direct.gl;
            const textures={};for(const id of ['earth','clouds','clouds-alt']){
              const map=await cpu.texture(id,64),texture=gl.createTexture();manualTextures.push(texture);
              gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,64,32,0,gl.RGBA,gl.UNSIGNED_BYTE,map.data);
              gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,id==='clouds-alt'?gl.REPEAT:gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
              textures[id]={texture,width:64};
            }
            direct.resetTextureBindings();direct.texture=id=>textures[id];
            direct.cloudBlendUntil=1; // Compare fully blended frames, not the loading fade.
            direct.cloudWeather=new kernel.CloudWeather();direct.cloudWeather.prepare(job.cloudSeed);
            const weatherDeadline=performance.now()+5000;
            while(direct.cloudWeather.pending){if(performance.now()>weatherDeadline)throw Error('Weather preparation timeout');await new Promise(resolve=>setTimeout(resolve,5));}
            direct.cloudWeather.readyAt=-Infinity; // Compare completed detailed frames after cooperative preparation.
            direct.begin();direct.planet(job,{id:'earth'},{x:64,y:64},64,0,false);
            const directPixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,directPixels);
            await gpu.render(job);const gpuPixels=new Uint8Array(128*128*4);
            gpu.gl.readPixels(0,0,128,128,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,gpuPixels);
            let difference=0,visible=0;
            for(let y=40;y<88;y++)for(let x=40;x<88;x++)for(let k=0;k<3;k++){
              const i=(y*128+x)*4+k,j=((127-y)*128+x)*4+k;
              difference=Math.max(difference,Math.abs(cpuPixels[i]-gpuPixels[j]),Math.abs(cpuPixels[i]-directPixels[j]));
              visible=Math.max(visible,directPixels[j]);
            }
            const builds=direct.cloudWeather.builds;
            direct.planet({...job,cloudAmount:0,cloudSeed:.999},{id:'earth'},{x:64,y:64},64,0,false);
            const disabled=direct.cloudWeather.builds===builds&&direct.cloudWeather.seed===job.cloudSeed;
            direct.planet({...job,weatherDay:20730},{id:'earth'},{x:64,y:64},64,0,false);
            const cached=direct.cloudWeather.builds===builds,errors=[gl.getError(),gpu.gl.getError()];
            const service=new SolarSurface.Service();
            const workerFrame=await new Promise((resolve,reject)=>{
              const timer=setTimeout(()=>{service.dispose();reject(Error('Cloud worker timeout'));},10000);
              const receive=service.receive.bind(service);service.receive=msg=>{receive(msg);if(msg.kind==='done'){
                clearTimeout(timer);const result={backend:service.stats.backend,ready:!!service.get('earth'),error:service.stats.workerError};
                service.dispose();resolve(result);
              }};
              service.update([{...job,geometry:'weather-test'}],performance.now());
            });
            const owner=direct.cloudWeather;direct.dispose();
            return {backend,difference,visible,disabled,cached,errors,workerFrame,seamDifference,interiorUnchanged,disposed:owner.map===null&&owner.texture===null};
          } finally {for(const texture of manualTextures)direct.gl.deleteTexture(texture);direct.dispose();gpu.clear();cpu.clear();}
        }""")
        check(result['backend'] == 'gpu', 'cloud shader compiles on real WebGL')
        check(result['visible'] > 80, 'cloud surface really renders visible pixels')
        check(result['difference'] <= 3, 'CPU/direct/worker-compatible GPU agree within RGB rounding')
        check(result['disabled'] and result['cached'], 'disabled clouds skip work and time travel reuses the mask')
        check(result['errors'] == [0, 0], 'new cloud sampler has no GL binding error')
        check(result['workerFrame']['backend'] == 'worker' and result['workerFrame']['ready'], 'serialized worker produces a cloud frame')
        check(result['disposed'], 'direct renderer releases its weather resources')
        return result
    finally:
        ctx.close()

if __name__ == '__main__':
    from pathlib import Path
    from playwright.sync_api import sync_playwright
    def check(ok, message):
        if not ok:
            raise AssertionError(message)
        print('PASS', message)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        try:
            print(verify_cloud_weather(browser,Path(__file__).resolve().parents[2],check))
        finally:
            browser.close()
