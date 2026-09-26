"""Check generated copy through the real application; reuse existing Chromium CI."""
import json

def verify_translation_source(page, root, tag, check):
    config=json.loads((root/'i18n/config.json').read_text(encoding='utf8'))
    for code in config['languages']:
        region='tw' if code=='zht' else code
        page.evaluate('async region=>await SolarTime.setLanguage(region)', region)
        check(page.evaluate('SolarTime.getState().copyLanguage')==code,tag+' canonical copy '+code)
        expected=json.loads((root/'src/locales'/f'{code}.json').read_text(encoding='utf8'))
        keys=['settings','timer','alarm','scheduledShutdown','shutdownUnknown','starDensityLabel']
        actual=page.evaluate('keys=>Object.fromEntries(keys.map(k=>[k,SolarTime.translate(k)]))',keys)
        check(actual=={k:expected['copy'][k] for k in keys},tag+' generated interface/timer '+code)
        check(page.locator('#star-density-label').text_content()==expected['copy']['starDensityLabel'],tag+' generated density '+code)
        page.locator('[data-body="earth"]').click()
        check(page.locator('#body-name').text_content()==expected['bodies']['earth'][0] and page.locator('#body-description').text_content()==expected['bodies']['earth'][1],tag+' generated body '+code)
        page.locator('#body-close').click()
    page.evaluate("async()=>await SolarTime.setLanguage('auto')")
    check(page.evaluate("SolarTime.getState().languageMode==='auto'"),tag+' source test restores AUTO')
