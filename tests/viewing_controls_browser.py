"""v0.10 focused UI regression: injected offline HTML + mouse, keyboard and touch.
Run: python tests/viewing_controls_browser.py. No server or external request required.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
REPORT = ROOT / 'docs/viewing-controls-v0.10.json'
report = {'version': '0.10', 'checks': [], 'measurements': {}, 'errors': [],
          'environment': 'Linux headless Chromium; standalone HTML injected offline, with network disabled',
          'limitations': ['Direct file navigation returned ERR_BLOCKED_BY_ADMINISTRATOR; tests inject the HTML instead. Windows launch and physical mouse/touch devices are not tested.'],
          'repository_changed': False, 'deployed': False}
ALLOWED = {'fit-view', 'show-ui'}

def check(name, condition, detail=None):
    report['checks'].append({'name': name, 'passed': bool(condition), 'detail': detail})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    if not condition:
        raise AssertionError(name + ': ' + str(detail))

def buttons(page):
    return set(page.locator('button:visible').evaluate_all('(els) => els.map(el => el.id)'))

def awake(page):
    return page.evaluate('document.body.classList.contains("pointer-awake")')

def state(page):
    return page.evaluate('({...SolarTime.renderer.camera, zen:SolarTime.getState().zen})')

def wait_idle(page):
    page.wait_for_function('!document.body.classList.contains("pointer-awake")', timeout=4000)
    page.wait_for_timeout(210)  # Finish the existing fade, not the idle deadline.

def load(context):
    page = context.new_page()
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    started = time.perf_counter()
    page.set_content((ROOT/'dist/Solar-Time_v0.10.html').read_text(), wait_until='load')
    page.wait_for_function('window.SolarTime?.version === "0.10"', timeout=15000)
    page.wait_for_function('document.getElementById("loading").hidden', timeout=10000)
    report['measurements'].setdefault('injected_startup_ms', round((time.perf_counter()-started)*1000, 2))
    return page

try:
    with sync_playwright() as tool:
        browser = tool.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
                                      headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width':1648, 'height':928}, device_scale_factor=1,
                                      timezone_id='Asia/Seoul', offline=True)
        page = load(context)
        check('The injected offline standalone starts as Solar Time v0.10', page.title() == 'Solar Time' and not page.evaluate('navigator.onLine'))
        check('Tracking card and its label no longer exist', page.locator('#focus-reset,#focus-label').count() == 0)
        check('Normal mode keeps one home action and hides the viewing-mode exit', page.locator('#fit-view').count() == 1 and page.locator('#fit-view').is_visible() and page.locator('#show-ui').is_hidden())
        page.locator('[data-body="earth"]').click()
        page.locator('#focus-body').click()
        check('Earth tracking still works without its former card', state(page)['focus'] == 'earth' and page.locator('#focus-reset').count() == 0)
        page.locator('#body-close').click()
        page.locator('#universe').focus()
        page.keyboard.press('h')
        page.wait_for_timeout(220)
        check('Only home and mode actions appear on entering viewing mode', buttons(page) == ALLOWED, sorted(buttons(page)))
        check('No normal-mode panel, playback or navigation remains visible', page.locator('.playback').is_hidden() and page.locator('.masthead').is_hidden() and page.locator('.footer').is_hidden() and page.locator('#body-panel').is_hidden())
        page.screenshot(path=str(OUT/'zen-awake-v0.10.png'))
        wait_idle(page)
        check('Idle hides both actions and the cursor together', not buttons(page) and page.evaluate('getComputedStyle(document.getElementById("universe")).cursor') == 'none')
        check('Hidden controls are inert and excluded from accessibility navigation', page.locator('#view-controls').evaluate('(el)=>el.inert && el.getAttribute("aria-hidden")==="true"'))
        page.screenshot(path=str(OUT/'zen-idle-v0.10.png'))
        camera_before = state(page)
        page.mouse.move(20, 460)
        page.wait_for_timeout(220)
        check('Mouse movement reveals exactly the two actions', awake(page) and buttons(page) == ALLOWED)
        check('Revealing controls preserves the tracked body, zoom and camera', state(page) == camera_before)
        check('Awake controls regain their click and keyboard targets', page.locator('#view-controls').evaluate('(el)=>!el.inert && el.getAttribute("aria-hidden")==="false"'))
        wait_idle(page)
        page.mouse.down(); page.mouse.up()
        page.wait_for_timeout(220)
        check('One stationary click reveals controls without exiting viewing mode', awake(page) and buttons(page) == ALLOWED and state(page) == camera_before)
        # A first click at the location of a hidden button is only a wake gesture.
        rect = page.locator('#fit-view').bounding_box()
        page.mouse.move(rect['x']+rect['width']/2, rect['y']+rect['height']/2)
        wait_idle(page)
        page.mouse.down(); page.mouse.up()
        page.wait_for_timeout(220)
        check('A click on an invisible former button does not reset the camera', state(page)['focus'] == 'earth' and buttons(page) == ALLOWED)
        page.locator('#fit-view').click()
        check('Visible home action resets the view while staying in viewing mode', state(page)['focus'] is None and state(page)['zoom'] == 1 and state(page)['zen'])
        wait_idle(page)
        check('An auto-hidden focused action does not create a focus/wake loop', page.evaluate('document.activeElement.id') == 'universe' and not buttons(page))
        page.wait_for_timeout(250)
        check('Controls remain hidden after programmatic focus transfer', not awake(page))
        page.mouse.move(400,460)
        page.mouse.down(button='middle'); page.mouse.move(540,530,steps=6)
        page.wait_for_timeout(2100)
        check('Held middle-button drag keeps the two actions and cursor awake', buttons(page)==ALLOWED and awake(page) and page.evaluate('getComputedStyle(document.getElementById("universe")).cursor')!='none')
        page.mouse.up(button='middle')
        wait_idle(page)
        check('Releasing the middle drag rearms the idle timeout', not awake(page) and not buttons(page))
        page.mouse.move(600,450)
        page.locator('#fit-view').focus(); page.keyboard.press('0')
        check('The 0 shortcut works with a transient button focused', state(page)['panX']==0 and state(page)['panY']==0 and state(page)['zoom']==1 and state(page)['zen'])
        page.locator('#fit-view').focus(); page.keyboard.press('h')
        check('H exits viewing mode while a transient button is focused', not state(page)['zen'] and page.locator('.playback').is_visible())
        page.wait_for_timeout(2100)
        check('No old idle timer hides normal-mode controls or cursor', page.locator('#fit-view').is_visible() and not page.locator('#view-controls').evaluate('(el)=>el.inert') and page.evaluate('getComputedStyle(document.getElementById("universe")).cursor')!='none')
        page.locator('#hide-ui').click(); page.locator('#show-ui').click()
        check('Mode action returns to the normal interface', not state(page)['zen'] and page.locator('#show-ui').is_hidden())
        # Target-card removal is common to every celestial body.
        targets = page.evaluate('[SolarAstro.SUN,...SolarAstro.BODIES,SolarAstro.MOON].map(b=>b.id)')
        for target in targets:
            page.evaluate('(id)=>SolarTime.renderer.focusBody(id)', target)
            page.wait_for_timeout(30)
        check('All 11 target selections remain usable with no tracking card', len(targets)==11 and state(page)['focus']=='moon' and page.locator('#focus-reset,#focus-label').count()==0)
        page.locator('#fit-view').click(); page.locator('#universe').focus(); page.keyboard.press('h')
        wait_idle(page); page.keyboard.press('Tab')
        check('Keyboard activity exposes a reachable home action, never hidden normal UI', awake(page) and buttons(page)==ALLOWED and page.evaluate('document.activeElement.id') in ALLOWED)
        page.keyboard.press('Escape')
        check('Escape still exits viewing mode', not state(page)['zen'])
        page.locator('#universe').focus(); page.keyboard.press('0')
        page.screenshot(path=str(OUT/'overview-v0.10.png'))
        # Export uses a pristine DOM: no copied idle state or stale tracking card.
        exported = page.evaluate('async()=>{const html=await SolarTime.materials.offlineHTML();const d=new DOMParser().parseFromString(html,"text/html");return {title:d.title,card:!!d.getElementById("focus-reset"),home:d.querySelectorAll("#fit-view").length,exit:d.querySelectorAll("#show-ui").length,version:html.includes("version:\'0.10\'")};}')
        check('Image-inclusive HTML export preserves title, new controls and v0.10', exported == {'title':'Solar Time','card':False,'home':1,'exit':1,'version':True}, exported)
        report['measurements']['render_backends'] = page.evaluate('({surface:SolarTime.renderer.surface.stats.backend,sky:SolarTime.renderer.sky.stats.backend})')
        for width, height in [(390,844),(320,568)]:
            mobile_context = browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,
                                                 is_mobile=True,has_touch=True,offline=True,timezone_id='Asia/Seoul')
            mobile = load(mobile_context)
            mobile.locator('#hide-ui').tap()
            wait_idle(mobile)
            mobile.touchscreen.tap(70,380)
            mobile.wait_for_timeout(210)
            check(f'{width}px: one tap reveals only home and mode', buttons(mobile)==ALLOWED and state(mobile)['zen'])
            rects = mobile.locator('#view-controls button:visible').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}})')
            check(f'{width}px: both actions fit and have 44px minimum touch height', all(r['x']>=0 and r['y']>=0 and r['right']<=width and r['bottom']<=height and r['h']>=44 for r in rects),rects)
            mobile.locator('#fit-view').tap()
            check(f'{width}px: home does not exit viewing mode',state(mobile)['zen'] and state(mobile)['zoom']==1)
            mobile.screenshot(path=str(OUT/f'mobile-{width}-awake-v0.10.png'))
            mobile.locator('#show-ui').tap()
            check(f'{width}px: mode tap restores playback controls',not state(mobile)['zen'] and mobile.locator('.playback').is_visible())
            mobile_context.close()
        check('No application exceptions during input, idle and export checks', not report['errors'], report['errors'])
        context.close(); browser.close()
finally:
    report['check_count'] = len(report['checks'])
    report['passed'] = bool(report['checks']) and all(c['passed'] for c in report['checks'])
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'Report: {REPORT}',flush=True)
