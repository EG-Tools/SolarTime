"""Real UI hooks with an in-memory GA4 sink. Never send traffic to Google."""

def verify_usage_analytics(browser, root, check, diagnostics, load):
    ctx, page, _, errors = load(browser, root, (1280, 800))
    diagnostics.attach(ctx, page, 'feature-analytics-offline')
    try:
        # The offline page is deliberately not a production host. Enable only
        # an in-memory owner to test feature hooks, not Google ingestion.
        page.evaluate("SolarConsent.choose('denied')")
        page.evaluate('''code=>{
          delete window.SolarUsageAnalytics;
          window.SolarGoogleAnalytics=Object.freeze({production:true,measurementId:'G-4MP85CMH64'});
          window.__usageEvents=[];window.gtag=(...args)=>__usageEvents.push(args);
          (0,eval)(code);
        }''', (root / 'src/usage-analytics.js').read_text(encoding='utf8'))
        def count(name):
            return page.evaluate('(name)=>__usageEvents.filter(e=>e[0]==="event"&&e[1]===name).length', name)
        page.locator('[data-body="earth"]').click()
        check(count('solar_body_select') == 0, 'usage denied selection sends no custom event')
        page.evaluate("SolarConsent.choose('granted')")
        check(count('solar_body_select') == 0, 'usage grant does not replay denied actions')
        page.locator('[data-body="moon"]').click()
        page.locator('#focus-body').click()
        check(count('solar_body_select') == 1 and count('solar_body_track') == 1, 'usage actual selection and tracking counted separately')
        page.wait_for_timeout(350)
        check(count('solar_body_track') == 1, 'usage camera animation produces no repeated events')
        page.locator('#help-button').click()
        check(count('solar_help_open') == 1, 'usage help opening counted once')
        page.locator('#help-button').click()
        page.locator('#timer-button').click()
        page.locator('#alarm-hours').fill('0')
        page.locator('#alarm-minutes').fill('0')
        page.locator('#alarm-enabled').click()
        check(count('solar_alarm_set') == 0, 'usage invalid zero-minute alarm excluded')
        page.locator('#alarm-minutes').fill('1')
        page.locator('#alarm-enabled').check()
        check(count('solar_alarm_set') == 1 and page.evaluate('SolarTime.getState().timers.alarm.enabled'), 'usage successful alarm set once')
        page.locator('#alarm-enabled').uncheck()
        check(count('solar_alarm_cancel') == 1, 'usage successful alarm cancellation once')
        page.locator('#timer-close').click()
        page.evaluate('''()=>{
          const a=document.getElementById('background-music');let src='',paused=true;
          Object.defineProperties(a,{src:{configurable:true,get:()=>src,set:v=>{src=v;}},
            paused:{configurable:true,get:()=>paused},ended:{configurable:true,get:()=>false},
            error:{configurable:true,get:()=>null}});
          a.load=()=>{};a.pause=()=>{paused=true;};
          a.play=()=>new Promise(resolve=>{window.__allowMusic=()=>{paused=false;resolve();};});
        }''')
        page.locator('#music-toggle').click()
        check(count('solar_music_play') == 0, 'usage music waits for successful play, not the button alone')
        page.evaluate('__allowMusic()')
        page.wait_for_function('__usageEvents.some(e=>e[1]==="solar_music_play")')
        check(count('solar_music_play') == 1, 'usage actual music start counted once')
        page.locator('#music-toggle').click()
        check(count('solar_music_stop') == 1, 'usage explicit music stop counted once')
        # Programmatic/automatic context refresh must not count as user change.
        page.evaluate("SolarTime.setLanguage('en')")
        check(count('solar_language_change') == 0, 'usage automatic/programmatic language refresh excluded')
        page.locator('#language-toggle').click()
        page.locator('[data-language="es"]').click()
        page.wait_for_function('SolarTime.getState().language==="es"')
        check(count('solar_language_change') == 1, 'usage committed manual language change counted')
        page.locator('#zen-toggle').click()
        check(count('solar_zen_on') == 1, 'usage viewing mode activation counted')
        page.keyboard.press('Escape')
        check(count('solar_zen_off') == 1, 'usage keyboard exit counted')
        page.evaluate("SolarConsent.choose('denied')")
        page.locator('[data-body="earth"]').click()
        check(count('solar_body_select') == 1, 'usage rejection immediately blocks new feature events')
        calls=page.evaluate('__usageEvents.filter(e=>e[0]==="event")')
        check(all(e[2]['send_to']=='G-4MP85CMH64' for e in calls), 'usage features are GA4-only, not Ads conversions')
        check(all(e[1] not in ['conversion','page_view','generate_lead'] for e in calls), 'usage no duplicate visits or false lead-form submissions')
        check(all(set(e[2]).issubset({'send_to','body_id','sound_type','selection_mode'}) for e in calls), 'usage bounded parameters exclude filenames, times, coordinates and native IDs')
        check(not errors, 'usage actual app hooks have no runtime errors')
    except BaseException as error:
        diagnostics.fail(error)
        raise
    finally:
        ctx.close()
