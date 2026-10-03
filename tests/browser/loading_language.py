"""Real navigation/reload with app and translation requests deliberately held."""
from pathlib import Path
import json, mimetypes, os, time
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'),headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 try:
  for region,mode,locale,copy in [('en','manual','ko-KR','en'),('jpn','manual','ko-KR','jpn'),('hk','manual','ko-KR','zht'),('br','manual','ko-KR','pt'),('kor','auto','fr-FR','fr')]:
   ctx=browser.new_context(locale=locale,timezone_id='Asia/Seoul')
   try:
    ctx.add_init_script("localStorage.setItem('eg.solar-time.v0.01',"+json.dumps(json.dumps({'language':region,'languageMode':mode}))+");localStorage.setItem('solar-time.help-seen.v1','true');")
    held_app=[];held_locale=[]
    def fulfill(route):
     from urllib.parse import urlparse
     name=urlparse(route.request.url).path.lstrip('/') or 'index.html'
     file=(root/name).resolve()
     if not file.is_relative_to(root) or not file.is_file():route.abort();return
     kind='text/javascript' if file.suffix=='.js' else mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
     route.fulfill(status=200,content_type=kind,body=file.read_bytes())
    def intercept(route):
     from urllib.parse import urlparse
     url=urlparse(route.request.url)
     if url.hostname!='solar.test':route.abort();return
     if url.path=='/src/app.js':held_app.append(route)
     elif url.path.startswith('/src/locales/'):held_locale.append(route)
     else:fulfill(route)
    ctx.route('**/*',intercept)
    page=ctx.new_page()
    def wait_held(queue):
     deadline=time.monotonic()+15
     while not queue:
      if time.monotonic()>deadline:raise AssertionError('Expected a held request before timeout')
      page.wait_for_timeout(20)
    for reload in [False,True]:
     if reload:page.reload(wait_until='commit')
     else:page.goto('https://solar.test/',wait_until='commit')
     page.wait_for_function("document.querySelector('#loading [data-i18n=loading]')!==null")
     wait_held(held_app)
     assert page.locator('#loading [data-i18n=loading]').evaluate("e=>getComputedStyle(e).visibility")=='hidden'
     fulfill(held_app.pop())
     page.wait_for_function("getComputedStyle(document.querySelector('#loading [data-i18n=loading]')).visibility==='visible'")
     expected=json.loads((root/'src/locales'/f'{copy}.json').read_text(encoding='utf8'))['copy']['loading']
     assert page.locator('#loading [data-i18n=loading]').text_content()==expected
     wait_held(held_locale)
     assert page.evaluate('!window.SolarTime'), 'must already be translated while bundle is still blocked'
     page.wait_for_timeout(250)
     assert page.locator('#loading [data-i18n=loading]').text_content()==expected
     for route in held_locale:fulfill(route)
     held_locale.clear()
     page.wait_for_function('!!window.SolarTime')
     assert page.evaluate('SolarTime.getState().copyLanguage')==copy
    print('PASS',region,mode,locale,'navigation + reload',flush=True)
   finally:ctx.close()
 finally:browser.close()
