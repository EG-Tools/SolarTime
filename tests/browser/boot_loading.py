"""Compare startup with/without the boot optimizations, using live media.

Local source is served through an isolated route; browser caches are disabled
by routing. This is a lab comparison, not a production latency guarantee.
"""
import asyncio
import json
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright


async def main():
    root = Path(__file__).resolve().parents[2]
    rows = []
    async with async_playwright() as p:
        options = {'headless': True, 'args': ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
        if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['SOLAR_CHROMIUM_EXECUTABLE']
        browser = await p.chromium.launch(**options)
        try:
            for optimized in [False, True, True, False, False, True]:
                context = await browser.new_context(viewport={'width': 1280, 'height': 800}, locale='ko-KR')
                errors = []
                async def route_request(route):
                    url = urlparse(route.request.url)
                    if url.hostname == 'solar-boot.test':
                        relative = unquote(url.path).lstrip('/') or 'index.html'
                        file = (root / relative).resolve()
                        if not file.is_relative_to(root) or not file.is_file():
                            await route.fulfill(status=404, body='Not found')
                            return
                        body = file.read_bytes()
                        if not optimized and relative == 'src/surface.js':
                            body = body.replace(b'(this.loadQueue[0].target<=256?4:2)', b'2')
                        if not optimized and relative == 'src/app.js':
                            body = body.replace(b'LanguageData.load(initialCopyCode).catch(()=>{});', b'')
                        await route.fulfill(body=body, content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
                    elif url.hostname == 'solar-time.keg0320.workers.dev':
                        await route.continue_()
                    else:
                        await route.abort()
                try:
                    await context.route('**/*', route_request)
                    await context.add_init_script("""(() => {
                      localStorage.setItem('solarTimeCookieConsentV1','denied');
                      localStorage.setItem('solar-time.help-seen.v1','true');
                      localStorage.setItem('eg.solar-time.v0.01',JSON.stringify({language:'fr',languageMode:'manual'}));
                      Math.random=()=>.25;
                      window.__bootAudit={};
                      const timer=setInterval(()=>{
                        const a=__bootAudit,el=document.querySelector('#loading');
                        if(window.SolarTime&&!a.app)a.app=performance.now();
                        if(el?.classList.contains('done')&&!a.scene){a.scene=performance.now();clearInterval(timer);}
                      },10);
                    })();""")
                    page = await context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    await page.goto('https://solar-boot.test/', wait_until='domcontentloaded')
                    await page.wait_for_function('window.__bootAudit?.scene', timeout=20000)
                    result = await page.evaluate("""() => ({...__bootAudit,
                      language:SolarTime.getState().copyLanguage,
                      locale:performance.getEntriesByType('resource').filter(r=>r.name.includes('/locales/')).map(r=>({url:r.name,start:r.startTime})),
                      texturesReady:SolarTime.renderer.surface.visibleTexturesReady(),
                      accepted:SolarTime.renderer.surface.stats.accepted})""")
                    assert not errors, errors
                    assert result['language'] == 'fr' and len(result['locale']) == 1, result
                    assert result['texturesReady'], result
                    result['optimized'] = optimized
                    rows.append(result)
                    print(json.dumps(result), flush=True)
                finally:
                    await context.close()
        finally:
            await browser.close()
    print(json.dumps({'runs': rows}), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
