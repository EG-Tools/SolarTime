"""Real Chromium decode / GPU swaps with delayed synthetic 4K, no live network."""

def verify_closeup_textures(browser, root, check, diagnostics):
    ctx=browser.new_context(viewport={'width':640,'height':640})
    page=ctx.new_page();diagnostics.attach(ctx,page,'progressive texture loading')
    page.route('**/*',lambda route:route.abort())
    page.set_content('<canvas id="test" width="512" height="512"></canvas>')
    for file in ['src/surface-style.js','src/performance.js','src/surface.js']:
        page.evaluate((root/file).read_text(encoding='utf8'))
    page.evaluate("""async()=>{
      const blobs={};for(const width of [256,1024,4096]){
        const c=new OffscreenCanvas(width,width/2),g=c.getContext('2d');
        g.fillStyle=width===4096?'#1e64d2':width===1024?'#c8321e':'#555555';g.fillRect(0,0,width,width/2);
        blobs[width]=await c.convertToBlob({type:'image/png'});
      }
      window.textureRequests=[];window.release4K=null;
      window.fetch=async url=>{const width=Number(/(\\d+)\\.webp/.exec(url)[1]);textureRequests.push(width);
        if(width===4096)await new Promise(resolve=>window.release4K=resolve);
        return new Response(blobs[width],{headers:{'content-type':'image/png'}});
      };
      const tiers=[256,1024,4096].map(width=>({width,path:width+'.webp'}));
      window.SolarAssets={materials:{moon:{base:'https://texture.test/',tiers,seamBaked:true,fallback:'https://texture.test/256.webp'}}};
      window.testGPU=new SolarSurface.DirectRenderer(document.getElementById('test'));testGPU.resize(512,512,1);
      window.textureJob={id:'moon',textureWidth:4096,priority:2,frame:{u:[1,0,0],v:[0,1,0],pole:[0,0,1]},phase:0,light:[0,0,1],nightLights:false};
      window.drawTexture=()=>{testGPU.begin();testGPU.planet(textureJob,{id:'moon'},{x:256,y:256},220,0,false);
        const pixel=new Uint8Array(4);testGPU.gl.readPixels(256,256,1,1,testGPU.gl.RGBA,testGPU.gl.UNSIGNED_BYTE,pixel);return Array.from(pixel);};
      testGPU.desired.set('moon',textureJob);testGPU.textureFor('moon',4096);
    }""")
    page.wait_for_function("testGPU.textures.get('moon')?.width===256")
    page.evaluate("testGPU.textureFor('moon',4096)")
    page.wait_for_function("testGPU.textures.get('moon')?.width===1024")
    check(page.evaluate('textureRequests')==[256,1024],'real decode publishes medium before requesting 4K')
    pixel=page.evaluate('drawTexture()')
    check(pixel[0]>pixel[2]*2 and pixel[3]>240,'1024 preview is visibly rendered while original 4K is pending')
    page.wait_for_function('!!release4K')
    check(page.evaluate("testGPU.textures.get('moon').width") ==1024,'delayed high-resolution network does not blank the preview')
    page.evaluate('release4K()');page.wait_for_function("testGPU.textures.get('moon')?.width===4096")
    pixel=page.evaluate('drawTexture()')
    check(pixel[2]>pixel[0]*2 and pixel[3]>240,'4096 replaces preview atomically on real WebGL')
    check(page.evaluate('textureRequests')==[256,1024,4096],'progressive path skips redundant 512 and 2048 transfers')
    page.evaluate("testGPU.textureFor('moon',1024)");page.wait_for_timeout(700)
    page.evaluate("testGPU.textureFor('moon',1024)")
    check(page.evaluate("testGPU.textures.get('moon').width")==1024,'cached medium tier remains available for zoom-out')
    before=page.evaluate('testGPU.stats.texturesLoaded')
    page.evaluate("testGPU.textureFor('moon',4096)")
    check(page.evaluate("testGPU.textures.get('moon').width")==4096,'ready retained 4K bypasses the progressive download')
    check(page.evaluate('testGPU.stats.texturesLoaded')==before and page.evaluate('textureRequests')==[256,1024,4096],'revisit performs zero new download/decode/GPU upload')
    check(page.evaluate('testGPU.stats.texturePixels*4<=SolarPerformance.textureBudget()'),'active and recent textures fit the shared budget')
    check(page.evaluate('testGPU.gl.getError()')==0,'progressive replacement has no WebGL error')
    page.evaluate('testGPU.dispose()')
    check(page.evaluate('testGPU.recentTextures.size')==0,'renderer disposal releases retained textures')
    ctx.close()
