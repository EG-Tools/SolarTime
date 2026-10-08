"""Real UI tracking keeps lens magnification separate from camera travel."""


def verify_tracking_lens(page):
    page.evaluate("""() => {
      const r=SolarTime.renderer;
      r.stopAutoRotate();r.restoreCamera(r.defaultCameraSnapshot());
      r.setZoom(.1);
      if(r.camera.zoom!==.8)throw Error('wide lens limit');
      window.__trackingLensSamples=[];
      const advance=r.advanceCamera.bind(r);
      window.__restoreTrackingSampler=()=>{r.advanceCamera=advance;};
      r.advanceCamera=function(mono){
        advance(mono);
        if(this.camera.focus||this.cameraTween?.to.focus)
          __trackingLensSamples.push({zoom:this.camera.zoom,dolly:this.camera.dolly});
      };
    }""")
    try:
        page.locator('[data-body="earth"]').click()
        page.locator('#focus-body').click()
        page.wait_for_function('!SolarTime.renderer.cameraTween && SolarTime.renderer.camera.focus === "earth"')
        before = page.evaluate('SolarTime.renderer.cameraSnapshot()')
        page.locator('#body-close').click()
        page.locator('#timezone-button').click()
        page.wait_for_function('!SolarTime.renderer.cameraTween')
        after = page.evaluate('SolarTime.renderer.cameraSnapshot()')
        samples = page.evaluate('__trackingLensSamples')
        assert len(samples) > 2 and all(abs(s['zoom'] - .8) < 1e-9 for s in samples), samples
        assert abs(after['dolly'] - before['dolly']) > 1e-6, (before, after)
        assert page.locator('#zoom-value').inner_text() == '0.8×'
    except Exception:
        print('TRACKING FAILURE', page.evaluate('({camera:SolarTime.renderer.cameraSnapshot(),state:SolarTime.getState(),samples:__trackingLensSamples.slice(-3)})'))
        raise
    finally:
        page.evaluate('__restoreTrackingSampler();delete window.__restoreTrackingSampler;delete window.__trackingLensSamples')
