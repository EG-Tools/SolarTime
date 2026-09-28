"""Cookie-choice behavior and real UI controls; all external traffic is intercepted."""
import re
from urllib.parse import urlparse


def verify_consent_controls(browser, root, check, diagnostics, load):
    for size in [(1280, 800), (390, 844), (844, 390)]:
        ctx, page, _, errors = load(browser, root, size)
        diagnostics.attach(ctx, page, 'consent-controls-' + str(size))
        try:
            page.evaluate('SolarCookieConsent.reset()')
            check(page.locator('#cookie-consent').is_visible(), str(size) + ' no choice opens banner')
            before = page.evaluate('localStorage.getItem(SolarConsent.storageKey)')
            page.locator('#cookie-dismiss').click()
            check(page.locator('#cookie-consent').is_hidden(), str(size) + ' X closes actual banner')
            check(page.evaluate('SolarConsent.value()') == '' and page.evaluate('localStorage.getItem(SolarConsent.storageKey)') == before,
                  str(size) + ' X stores no acceptance or rejection')
            page.evaluate('SolarCookieConsent.show()')
            page.locator('#cookie-accept').click()
            saved = page.evaluate('localStorage.getItem(SolarConsent.storageKey)')
            page.locator('#help-button').click()
            page.locator('#help-cookie-settings').click()
            check(page.locator('#cookie-consent').is_visible() and page.locator('#help-button').get_attribute('aria-expanded') == 'false', str(size) + ' help opens usable cookie controls')
            check(page.evaluate('SolarConsent.value()') == 'granted', str(size) + ' opening settings does not revoke choice')
            page.locator('#cookie-dismiss').click()
            check(page.evaluate('localStorage.getItem(SolarConsent.storageKey)') == saved, str(size) + ' settings X does not change or renew acceptance')
            page.evaluate('SolarCookieConsent.show()')
            page.keyboard.press('Escape')
            check(page.locator('#cookie-consent').is_hidden() and page.evaluate('SolarConsent.value()') == 'granted', str(size) + ' focused Escape dismisses without changing consent')
            page.evaluate('SolarCookieConsent.show()')
            page.locator('#cookie-reject').click()
            check(page.evaluate('SolarConsent.value()') == 'denied', str(size) + ' rejection from settings works')
            page.locator('#settings-button').click()
            page.locator('#review-cookie-consent').click()
            check(page.locator('#cookie-consent').is_visible(), str(size) + ' existing Display settings entry stays usable')
            # Every existing shared language renders the new labels, without clipping.
            for language in ['kor', 'en', 'chn', 'zht', 'jpn', 'hi', 'es', 'de', 'fr', 'pt', 'it', 'id', 'nl']:
                page.evaluate('(language)=>SolarTime.setLanguage(language)', 'tw' if language == 'zht' else language)
                page.wait_for_function('(code)=>SolarTime.getState().copyLanguage===code', arg=language)
                check(page.locator('#cookie-dismiss').get_attribute('aria-label') == page.evaluate("SolarTime.translate('cookieDismiss')"), str(size) + ' localized X ' + language)
                geometry = page.locator('#cookie-consent').evaluate('''e=>{
                  const b=e.getBoundingClientRect(),x=e.querySelector('#cookie-dismiss').getBoundingClientRect();
                  const peers=[...e.querySelectorAll('.cookie-consent-copy,.cookie-consent-actions')].map(n=>n.getBoundingClientRect());
                  return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1&&
                    x.width>=32&&x.height>=32&&x.left>=b.left&&x.right<=b.right&&x.bottom<=b.bottom&&
                    peers.every(p=>x.left>=p.right||x.right<=p.left||x.top>=p.bottom||x.bottom<=p.top);
                }''')
                check(geometry, str(size) + ' banner/X fit without overlap ' + language)
            if size == (390, 844):
                page.evaluate("SolarTime.setLanguage('kor')")
                page.screenshot(path=str(root / '.cloudflare/consent-mobile.png'))
            check(not errors, str(size) + ' consent UI has no runtime errors')
        except BaseException as error:
            diagnostics.fail(error)
            raise
        finally:
            ctx.close()

    # True reloads and new visits on a routed origin using the actual consent owners.
    html = (root / 'index.html').read_text(encoding='utf8')
    banner = re.search(r'  <section id="cookie-consent"[\s\S]*?</section>', html).group(0)
    scripts = (root / 'src/consent.js').read_text(encoding='utf8')
    scripts += "\nwindow.SolarGoogleAnalytics={production:true,measurementId:'G-4MP85CMH64'};\n"
    scripts += (root / 'src/usage-analytics.js').read_text(encoding='utf8')
    body = '<!doctype html><html><head><meta charset="utf-8"></head><body><button id="help-button">Help</button>' + banner
    body += '<script>' + scripts + '</script><script>' + (root / 'src/cookie-consent.js').read_text(encoding='utf8') + '</script></body></html>'
    def attach(context):
        context.add_init_script('window.__consentNow=Date.UTC(2026,8,28,12);Date.now=()=>window.__consentNow;')
        page = context.new_page()
        page.route('**/*', lambda route: route.fulfill(status=200, content_type='text/html', body=body) if urlparse(route.request.url).hostname == 'consent.test' else route.abort())
        diagnostics.attach(context, page, 'consent-reload')
        return page
    ctx = browser.new_context()
    page = attach(ctx)
    try:
        page.goto('https://consent.test/', wait_until='load')
        check(page.locator('#cookie-consent').is_visible(), 'new visitor sees choice')
        page.locator('#cookie-dismiss').click()
        check(page.evaluate("SolarUsageAnalytics.track('solar_music_play')") is False, 'X never grants feature tracking')
        page.reload(wait_until='load')
        check(page.locator('#cookie-consent').is_visible(), 'real reload after X asks again')
        page.locator('#cookie-accept').click()
        raw = page.evaluate('localStorage.getItem(SolarConsent.storageKey)')
        page.reload(wait_until='load')
        check(page.locator('#cookie-consent').is_hidden() and page.evaluate('SolarConsent.value()') == 'granted', 'real reload remembers acceptance')
        check(page.evaluate('localStorage.getItem(SolarConsent.storageKey)') == raw, 'reload never renews saved expiry')
        state = ctx.storage_state()
        revisit = browser.new_context(storage_state=state)
        again = attach(revisit)
        try:
            again.goto('https://consent.test/', wait_until='load')
            check(again.locator('#cookie-consent').is_hidden() and again.evaluate('SolarConsent.value()') == 'granted', 'new visit remembers accepted record')
        finally:
            revisit.close()
        page.evaluate('SolarCookieConsent.show()')
        page.locator('#cookie-reject').click()
        page.reload(wait_until='load')
        check(page.locator('#cookie-consent').is_hidden() and page.evaluate('SolarConsent.value()') == 'denied', 'real reload remembers rejection')
        check(page.evaluate("SolarUsageAnalytics.track('solar_music_play')") is False, 'remembered rejection blocks features')
        page.evaluate('SolarCookieConsent.show()')
        page.locator('#cookie-accept').click()
        page.evaluate("window.__finish=SolarUsageAnalytics.begin('solar_music_play');window.__consentNow=JSON.parse(localStorage.getItem(SolarConsent.storageKey)).expiresAt;window.dispatchEvent(new Event('pageshow'));")
        check(page.evaluate('SolarConsent.value()') == '' and page.locator('#cookie-consent').is_visible(), 'expiry revokes and asks again on return')
        check(page.evaluate('__finish()') is False, 'expired async action never reports as consented')
        check(page.evaluate('dataLayer.filter(c=>c[0]==="event").length') == 0, 'no test analytics events sent after denial or expiry')
        page.evaluate("localStorage.setItem(SolarConsent.storageKey,'denied')")
        page.reload(wait_until='load')
        legacy = page.evaluate('localStorage.getItem(SolarConsent.storageKey)')
        check(page.evaluate('SolarConsent.value()') == 'denied' and page.locator('#cookie-consent').is_hidden(), 'legacy rejection migrates without nagging')
        page.reload(wait_until='load')
        check(page.evaluate('localStorage.getItem(SolarConsent.storageKey)') == legacy, 'legacy timestamp migration is one time')
    except BaseException as error:
        diagnostics.fail(error)
        raise
    finally:
        ctx.close()
