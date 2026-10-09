"""Consent/order integration on a routed production origin; no Google traffic."""
import json
from urllib.parse import urlparse


def verify_google_tag(browser, root, check, diagnostics):
    for host, saved in [('solartime.app', ''), ('www.solartime.app', 'granted'), ('solartime.app', 'denied'), ('solar-time.keg0320.workers.dev', '')]:
        ctx = browser.new_context()
        if saved:
            ctx.add_init_script('localStorage.setItem("solarTimeCookieConsentV1",' + json.dumps(saved) + ');')
        page = ctx.new_page()
        diagnostics.attach(ctx, page, 'google-tag-' + host + '-' + (saved or 'new'))
        errors, external = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        html = '<!doctype html><html><head><script src="/src/consent.js"></script><script src="/src/google-analytics.js"></script></head><body>Isolated tag test</body></html>'

        def route_request(route):
            u = urlparse(route.request.url)
            if u.hostname == host and u.path == '/__google_tag_test__':
                route.fulfill(status=200, content_type='text/html', body=html)
            elif u.hostname == host and u.path in ['/src/consent.js', '/src/google-analytics.js']:
                route.fulfill(status=200, content_type='application/javascript', body=(root / u.path[1:]).read_text(encoding='utf8'))
            elif u.hostname == 'www.googletagmanager.com' and u.path == '/gtag/js':
                external.append(route.request.url)
                route.fulfill(status=200, content_type='application/javascript', body='window.__testGoogleLoader=(window.__testGoogleLoader||0)+1;')
            else:
                route.abort()

        page.route('**/*', route_request)
        try:
            page.goto('https://' + host + '/__google_tag_test__', wait_until='load')
            state = page.evaluate('({calls:dataLayer.map(x=>Array.from(x)),production:SolarGoogleAnalytics.production,adsId:SolarGoogleAnalytics.adsId,saved:localStorage.getItem(SolarConsent.storageKey)})')
            label = 'Google tag ' + host + ' ' + (saved or 'new')
            check(state['adsId'] == 'AW-18454135815', label + ' exact approved Ads ID')
            check(state['calls'][0][:2] == ['consent', 'default'], label + ' consent first')
            keys = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']
            check(all(state['calls'][0][2][key] == 'denied' for key in keys), label + ' all denied defaults')
            configs = [c[1] for c in state['calls'] if c[0] == 'config']
            check(configs == (['G-4MP85CMH64', 'AW-18454135815'] if state['production'] else []), label + ' correct destination scope')
            check(len(external) == (1 if state['production'] else 0), label + ' one or no loader')
            if saved == 'granted':
                check(state['calls'][1][:2] == ['consent', 'update'] and all(state['calls'][1][2][key] == saved for key in keys), label + ' restored before configuration')
            elif saved == 'denied':
                check(not any(c[:2] == ['consent', 'update'] for c in state['calls']) and state['saved'] is None, label + ' old rejection is discarded before configuration')
            for value in [True, False]:
                last = page.evaluate('(v)=>{SolarGoogleAnalytics.updateConsent(v);return Array.from(dataLayer.at(-1));}', value)
                check(last[:2] == ['consent', 'update'] and all(last[2][key] == ('granted' if value else 'denied') for key in keys), label + ' consent change ' + str(value))
            page.add_script_tag(content=(root / 'src/google-analytics.js').read_text(encoding='utf8'))
            check(page.evaluate('dataLayer.filter(x=>x[0]==="config").length') == len(configs), label + ' repeated owner is idempotent')
            check(page.evaluate('dataLayer.every(x=>x[0]!=="event" && x[0]!=="set")'), label + ' no fabricated conversion or user data')
            check(not errors, label + ' no browser error')
        finally:
            ctx.close()
