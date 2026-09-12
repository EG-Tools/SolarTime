"""Validate the updater's actual file chooser and browser download, offline.
The input is a deliberately non-executed fixture, not the original complete app.
"""
from pathlib import Path
import hashlib, json, os, tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

def run():
    data={'materials':{'earth':'original-earth-bytes','moon':'original-moon-bytes'},'sky':'old','stars':[[1,0,0,.5,.5,1]],'materialInfo':{'earth':{'width':4096}}}
    html='''<!doctype html><html lang="ko"><head><title>Original fixture</title></head><body>Life User v0.13
<script id="solar-assets">window.SolarAssets=ASSETS;</script>
<script>root.SolarSky=Sky;</script><script>/* Solar Time v0.13 */window.SolarRenderer=Renderer;</script>
<script>globalThis.INPUT_MUST_NOT_EXECUTE=true;const key='solar-time.camera-presets.v1';const filename='SolarTime_v0.13_photos.html';</script></body></html>'''.replace('ASSETS',json.dumps(data))
    with tempfile.TemporaryDirectory() as folder, sync_playwright() as p:
        folder=Path(folder);source=folder/'Solar-Time_v0.13.html';source.write_text(html)
        digest=hashlib.sha256(source.read_bytes()).hexdigest()
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        page=browser.new_page(accept_downloads=True);errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        # This managed browser blocks file: navigation; load the exact HTML bytes in memory.
        page.set_content((ROOT/'SolarTime_Update_v0.14.html').read_text());page.set_input_files('#input',str(source));page.click('#convert')
        page.wait_for_selector('#download:visible',timeout=10000)
        assert page.evaluate('globalThis.INPUT_MUST_NOT_EXECUTE') is None
        with page.expect_download() as info:page.click('#download')
        download=info.value;assert download.suggested_filename=='Solar-Time_v0.14.html'
        output=folder/'out.html';download.save_as(str(output));text=output.read_text()
        assert 'original-earth-bytes' in text and 'original-moon-bytes' in text
        assert 'continuous spherical sky' in text and 'SolarTime_v0.14_photos.html' in text
        assert 'solar-time.camera-presets.v1' in text
        assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
        assert not errors,errors
        assert not any(x.startswith(('http://','https://')) for x in requests),requests
        # Incorrect input clears the previous download, rather than exporting it.
        bad=folder/'index.html';bad.write_text('<script src="src/app.js"></script>')
        page.set_input_files('#input',str(bad));page.click('#convert');page.get_by_text('변환하지 않았습니다.',exact=False).wait_for()
        assert page.is_hidden('#download')
        browser.close()
    result={'version':'0.14','scope':'offline updater HTML loaded via set_content with a non-executed fixture; file URL navigation not tested','checks':{
        'fileChooser':True,'download':True,'planetImagesPreserved':True,'storageKeysPreserved':True,
        'sourceFileUnmodified':True,'inputScriptsNotEvaluated':True,'noNetworkRequests':True,'invalidInputRejected':True},'passed':8}
    (ROOT/'docs/updater-verification-v0.14.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':run()
