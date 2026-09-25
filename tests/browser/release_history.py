"""Verify real release navigation against version.json and the loaded source data."""
import json

def catalog(page):
 return page.evaluate('SolarReleaseNotes.RELEASES.map(r=>r.version)')

def verify_items(page,language,check,label):
 expected=page.evaluate("language=>{const version=document.getElementById('release-notes-version').textContent.slice(1);return Array.from(SolarReleaseNotes.itemsFor(SolarReleaseNotes.RELEASES.find(r=>r.version===version),language));}",language)
 check(bool(expected) and page.locator('#release-notes-list li').all_inner_texts()==expected,label+' complete translated release items')

def navigate_to_release(page,version,check,label):
 versions=catalog(page)
 check(version in versions,label+' requested historical version exists: '+version)
 current=page.locator('#release-notes-version').inner_text().removeprefix('v')
 check(current in versions,label+' displayed version exists in catalog')
 start,target=versions.index(current),versions.index(version)
 direction='older' if target>start else 'newer'
 for position in range(start,target,1 if target>start else -1):
  page.locator('#release-notes-'+direction).click()
  expected=versions[position+(1 if target>start else -1)]
  check(page.locator('#release-notes-version').inner_text()=='v'+expected,label+' navigation to '+expected)

def verify_current_release(page,root,label,language,check):
 expected=json.loads((root/'version.json').read_text(encoding='utf8'))['version']
 versions=catalog(page)
 check(versions[0]==expected,label+' catalog agrees with version.json')
 check(page.locator('#release-notes-version').inner_text()=='v'+expected,label+' visible current version')
 check(page.locator('#release-notes-newer').is_disabled(),label+' current release newer boundary')
 verify_items(page,language,check,label)

def verify_history(page,root,label,language,check):
 verify_current_release(page,root,label,language,check)
 # Keep independent semantic checks for historical notes, not just counts.
 anchors={'0.56':'scheduled-shutdown','0.55':'Microsoft Clarity','0.54':'clock-size','0.53':'cookie','0.52':'Black Marble','0.51':'JPL','0.50':'Auto Language'}
 versions=catalog(page)
 check(len(versions)==len(set(versions)),label+' unique history versions')
 for version in versions:
  navigate_to_release(page,version,check,label)
  verify_items(page,language,check,label+' v'+version)
  if version in anchors:check(anchors[version].lower() in page.locator('#release-notes-list').inner_text().lower(),label+' historical content '+version)
 check(page.locator('#release-notes-older').is_disabled(),label+' oldest release boundary')
 navigate_to_release(page,versions[0],check,label)
 verify_current_release(page,root,label,language,check)
