from pathlib import Path
import json,re
r=Path.cwd()
assert json.loads((r/'version.json').read_text())=={'version':'0.47','revision':'r2'}, 'Expected r2 baseline'
def edit(file,pairs):
 s=(r/file).read_text()
 for old,new in pairs:
  assert old in s,(file,old)
  s=s.replace(old,new)
 (r/file).write_text(s)
edit('src/app.js',[
 ("'au','at','br'","'au','at','be','br'"),("'mx','mz','nz'","'mx','mz','nl','nz'"),
 ("    br:{code:'BR'", "    be:{code:'BE',name:'België',locale:'nl-BE',html:'nl-BE',copy:'nl'},\n    nl:{code:'NL',name:'Nederland',locale:'nl-NL',html:'nl-NL',copy:'nl'},\n    br:{code:'BR'"),
 ("    br:{label:'BRAZIL'", "    // Representative cities from tzdb zone.tab; both regions share Dutch copy.\n    be:{label:'BELGIUM',timeZone:'Europe/Brussels',latitude:50.833333333333336,longitude:4.333333333333333,region:'België',city:'Brussel'},\n    nl:{label:'NETHERLANDS',timeZone:'Europe/Amsterdam',latitude:52.36666666666667,longitude:4.9,region:'Nederland',city:'Amsterdam'},\n    br:{label:'BRAZIL'"),
 ("    pt:Object.freeze({label:'Densidade", "    nl:Object.freeze({label:'Sterdichtheid',aria:'Dichtheid van de deeltjessterren. Bij nul zijn de deeltjessterren verborgen.'}),\n    pt:Object.freeze({label:'Densidade"),
 ("['en','hi','es','de','fr','pt','it','id'].includes(copyLanguage())", "['en','hi','es','de','fr','pt','it','id','nl'].includes(copyLanguage())"),
 ("version:'0.47',revision:'r2'","version:'0.47',revision:'r3'"),
 ("src/release-notes.js?v=0.47-r2","src/release-notes.js?v=0.47-r3")])
edit('src/language-data.js',[("'pt','it','id']","'pt','it','id','nl']")])
edit('src/localization.js',[
 ("    if(/seoul/i.test(zone))return 'kor';", "    if(/seoul/i.test(zone))return 'kor';\n    if(/^Europe\\/Amsterdam$/i.test(zone))return 'nl';\n    if(/^Europe\\/Brussels$/i.test(zone))return 'be';"),
 ("      ['pt-ao','ao']", "      // Country selection and display language remain linked, as for Canada and Singapore.\n      // Belgium is multilingual; this entry currently uses the Dutch interface.\n      ['nl-be','be'],['fr-be','be'],['de-be','be'],['nl','nl'],\n      ['pt-ao','ao']")])
edit('index.html',[
 ('data-language="br"><strong>BR', 'data-language="be"><strong>BE</strong><span>België</span></button>\n          <button type="button" role="menuitemradio" data-language="br"><strong>BR'),
 ('data-language="nz"><strong>NZ', 'data-language="nl"><strong>NL</strong><span>Nederland</span></button>\n          <button type="button" role="menuitemradio" data-language="nz"><strong>NZ'),
 ('name="solar-time-revision" content="r2"','name="solar-time-revision" content="r3"'),
 ('src/app.js?v=0.47-r2','src/app.js?v=0.47-r3'),
 ('src/page-runtime.js?v=0.47-r2','src/page-runtime.js?v=0.47-r3'),
 ('src/runtime-optimizations.css?v=0.47-r2','src/runtime-optimizations.css?v=0.47-r3'),
 ('src/localization.js?v=0.47-r1','src/localization.js?v=0.47-r3'),
 ('src/language-data.js?v=0.47-r1','src/language-data.js?v=0.47-r3')])
edit('src/runtime-optimizations.css', [('--solar-layout-revision:r2','--solar-layout-revision:r3')])
(r/'version.json').write_text(json.dumps({'version':'0.47','revision':'r3'},indent=2)+'\n')
# Preserve historical release wording exactly; add the country change to the current release.
p=r/'src/release-notes.js';s=p.read_text();a=s.index(' const DATA=')+len(' const DATA=');b=s.index(';\n const RELEASES=',a);data=json.loads(s[a:b]);cur=data[0]['localized']
new={
'kor':'벨기에와 네덜란드를 추가했습니다. 네덜란드어 번역을 공유하고 각 나라의 지역 시간·지구 보기·선택값 저장을 기존 공통 기능에 연결했습니다.',
'en':'Added Belgium and the Netherlands with a shared Dutch interface, regional time, Earth-view locations and saved country selection.',
'chn':'新增比利时和荷兰，共用荷兰语界面，并接入现有的地区时间、地球位置查看和国家选择保存功能。',
'jpn':'ベルギーとオランダを追加しました。オランダ語の表示を共有し、地域時刻・地球上の位置表示・国選択の保存を既存機能に統合しました。',
'hi':'बेल्जियम और नीदरलैंड जोड़े गए। दोनों साझा डच इंटरफ़ेस, क्षेत्रीय समय, पृथ्वी पर स्थान देखने और देश चयन सहेजने की मौजूदा सुविधाओं का उपयोग करते हैं।',
'es':'Se añadieron Bélgica y los Países Bajos con una interfaz compartida en neerlandés, hora regional, ubicaciones en la Tierra y selección de país guardada.',
'de':'Belgien und die Niederlande wurden mit gemeinsamer niederländischer Oberfläche, regionaler Zeit, Erdansichten und gespeicherter Länderauswahl ergänzt.',
'fr':'Ajout de la Belgique et des Pays-Bas avec une interface néerlandaise partagée, l’heure régionale, les positions sur Terre et la mémorisation du pays choisi.',
'pt':'Adicionámos a Bélgica e os Países Baixos com uma interface partilhada em neerlandês, hora regional, localizações na Terra e seleção de país guardada.',
'it':'Aggiunti Belgio e Paesi Bassi con un’interfaccia olandese condivisa, ora regionale, posizioni sulla Terra e salvataggio del paese selezionato.',
'id':'Menambahkan Belgia dan Belanda dengan antarmuka bahasa Belanda bersama, waktu regional, lokasi tampilan Bumi, dan penyimpanan pilihan negara.'}
for code,rows in cur.items():
 assert len(rows)==7,(code,len(rows))
 rows.append(new[code])
cur['nl']=[
'De gedeelde vormgeving, sluitbediening en het scrollgedrag van diagnose-, help-, instellingen-, hemellichaam- en QR-kaarten zijn samengevoegd.',
'De updategeschiedenis staat nu in één gegevensmodule; opnieuw proberen na een laadfout werkt weer.',
'Het vervangen van renderermethoden en het onderscheppen van shaders is verwijderd. GPU-, Worker- en CPU-weergave delen dezelfde materiaalinstellingen.',
'Originele bronbestanden en afgeleide media zijn gescheiden. Voor pictogramuploads zijn voorafgaande controles, goedkeuring en expliciete uitvoering toegevoegd.',
'De goedgekeurde iPhone-indeling, camerabediening en pictogrammen zijn behouden, met uitgebreidere regressie- en publicatiecontroles.',
'Singapore is toegevoegd aan de landenlijst met de bestaande Engelse vertaling, lokale tijd en gedeelde locatiebediening op de aarde.',
'Een filter op basis van pixeloppervlakte beperkt het flikkeren van kleine sterren tijdens beweging. De kans op gele en rode sterren is elk met 30% verminderd; het vrijgekomen aandeel is gelijk verdeeld over witte en blauwe sterren.',
'België en Nederland zijn toegevoegd met een gedeelde Nederlandse interface, regionale tijd, locaties op de aarde en opgeslagen landkeuze.'
]
p.write_text(s[:a]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+s[b:])
edit('tests/cleanup-contracts.test.cjs', [("api.itemsFor(api.RELEASES[0],code).length,7","api.itemsFor(api.RELEASES[0],code).length,8"),("{version:'0.47',revision:'r2'}","{version:'0.47',revision:'r3'}")])
for file in ['tests/modules.test.cjs','tests/v046-release.test.cjs']:
 s=(r/file).read_text()
 s=s.replace('src/localization.js?v=0.47-r1','src/localization.js?v=0.47-r3').replace('src/language-data.js?v=0.47-r1','src/language-data.js?v=0.47-r3')
 s=s.replace("'au','at','br'","'au','at','be','br'").replace("'mx','mz','nz'","'mx','mz','nl','nz'")
 s=s.replace("version:'0.47',revision:'r2'","version:'0.47',revision:'r3'").replace('src/app.js?v=0.47-r2','src/app.js?v=0.47-r3')
 (r/file).write_text(s)
p=r/'CHANGELOG.md';s=p.read_text();p.write_text('# Maintenance changelog\n\n## v0.47 r3 · 2026-09-19\n\n- Added Netherlands (NL) and Belgium (BE) with one complete shared Dutch locale.\n- Kept separate nl-NL/nl-BE date formatting, Europe/Amsterdam/Europe/Brussels time and representative Earth-view cities.\n- Belgium is multilingual; the BE entry currently selects the Dutch interface, following the existing one-language-per-country design.\n- Preserved the r2 tiny-star filter, colour balance, iPhone layout, common cards and approved R2 media.\n\n'+s.split('# Maintenance changelog\n',1)[1].lstrip())
# Dutch syntax and interpolation consistency.
en=json.loads((r/'src/locales/en.json').read_text());nl=json.loads((r/'src/locales/nl.json').read_text())
for group in en:
 assert en[group].keys()==nl[group].keys(),group
for key,value in en['copy'].items():
 assert sorted(re.findall(r'\{\w+\}',value))==sorted(re.findall(r'\{\w+\}',nl['copy'][key])),key
print('NL locale complete:',len(nl['copy']),'UI strings,',len(nl['bodies']),'bodies,',len(nl['phases']),'moon phases')

# Final candidate adjustments verified against the locally tested bytes.
p=r/'tests/v046-release.test.cjs';p.write_text(p.read_text().replace('src/release-notes.js?v=0.47-r2','src/release-notes.js?v=0.47-r3'))
edit('src/localization.js', [("    if(/^Europe\\/Amsterdam$/i.test(zone))return 'nl';\n    if(/^Europe\\/Brussels$/i.test(zone))return 'be';","    if(/^Europe\\/(?:Amsterdam|Brussels)$/i.test(zone)){\n      // These zone IDs can be aliases in tzdb/ICU. An explicit NL/BE locale\n      // disambiguates the country without changing other regions' precedence.\n      for(const value of languages){\n        if(/^nl-nl(?:-|$)/.test(value))return 'nl';\n        if(/^(?:nl|fr|de)-be(?:-|$)/.test(value))return 'be';\n      }\n      return /Amsterdam$/i.test(zone)?'nl':'be';\n    }")])
p=r/'tests/browser/ui-regression.py';s=p.read_text();assert __import__('hashlib').sha256(s.encode()).hexdigest()=='7293588e2a399884eece65a5ace2921f662eadc75e736206ba06e496ae9eaba7'
for a,b,value in [[9255, 9255, ' '], [9220, 9220, '\n   # Isolate software-GPU resources and animated cameras between viewport cases.\n   browser=p.chromium.launch(**options)\n   try:'], [9060, 9107, ''], [8608, 8608, '\')\n page.locator(\'#help-dialog .close-button\').first.click()\n for country,lang,zone,label,city,lat,lon in [(\'nl\',\'nl-NL\',\'Europe/Amsterdam\',\'NETHERLANDS\',\'Amsterdam\',52+22/60,4.9),(\'be\',\'nl-BE\',\'Europe/Brussels\',\'BELGIUM\',\'Brussel\',50+50/60,4+20/60)]:\n  page.locator(\'#language-toggle\').click();page.locator(\'[data-language="\'+country+\'"]\').click()\n  page.wait_for_function(\'(code)=>SolarTime.getState().language===code\',arg=country)\n  state=page.evaluate(\'SolarTime.getState()\')\n  check(state[\'timeZone\']==zone and state[\'region\']==label,tag+\' \'+country+\' regional time\')\n  check(page.locator(\'html\').get_attribute(\'lang\')==lang,tag+\' \'+country+\' document language\')\n  check(page.locator(\'#star-density-label\').inner_text()==\'Sterdichtheid\',tag+\' \'+country+\' Dutch setting label\')\n  check(page.locator(\'[data-body="earth"]\').inner_text()==\'Aarde\',tag+\' \'+country+\' Dutch body label\')\n  check(page.evaluate("JSON.parse(localStorage.getItem(\'eg.solar-time.v0.01\')).language")==country,tag+\' \'+country+\' persisted selection\')\n  page.locator(\'#timezone-button\').click();args=page.evaluate(\'__featureArgs\')\n  check(args[0]==\'earth\' and abs(args[1]-lat)<1e-8 and abs(args[2]-lon)<1e-8,tag+\' \'+country+\' Earth-view city\')\n  page.locator(\'#help-button\').click()\n  if not page.locator(\'#release-notes-list\').is_visible():page.locator(\'#release-notes-toggle\').click()\n  check(\'België en Nederland\' in page.locator(\'#release-notes-list\').inner_text(),tag+\' \'+country+\' Dutch release history\')\n  page.locator(\'#help-dialog .close-button\').first.click()\n check(len([u for u in page.evaluate(\'__fixtureRequests\') if \'/locales/nl.json\' in u])==1,tag+\' one shared Dutch request'], [8202, 8203, '8']]:s=s[:a]+value+s[b:]
p.write_text(s)
EXPECTED={'CHANGELOG.md': '1d185eb5b722eb3459a165471a9bfc6744d84b9d09cdfa8f1e55276aed215c7c', 'index.html': '9bdbadf52368c63ee69db99cee6f76883d08531510d3373b7c64428803ed1ed3', 'src/app.js': '9ec9b844d056b66aa5c4b5cb520c0423ba76f0ffccd4ec3fd47b1e33e71b0e9e', 'src/language-data.js': '5c030ae75417ad5092ac111f122400b1330b95b79f2ca9eec0550083e188258c', 'src/localization.js': 'ca082647d93f4acc93c449e2962e8cf0887d8c763db4b063eef78e86e9c6122e', 'src/release-notes.js': '5c55b5e9c7f9cbd543afcc65c03c9d4e8ee90140663272144040039f7aa7f20f', 'src/runtime-optimizations.css': 'e806c8dce69b3fcf727eedcfe8fb86f6fdcafaa7a062fcaf4de963aee4633a17', 'tests/browser/ui-regression.py': 'acac7150b4ae6458714509be5ddaef8a8fad088e023be10f2111922cc7996d17', 'tests/cleanup-contracts.test.cjs': 'b646d11578fb525bb1b5649f884e84a2510c95ee3d98b9322c297d9692a9991f', 'tests/modules.test.cjs': 'e107261b913856a2e48e0b89c1b17ae29bd7c534d6658c9d40af72dedcb3af37', 'tests/v046-release.test.cjs': 'de21ab3b7443bd5add04343c82f5912de476f11146cdbf042c5ae05ed57df4d7', 'version.json': 'd039cab4a0593758cda870e94cf5493924d098eb77dd9a77e951db2ddc9bee17', 'src/locales/nl.json': 'cccdf35a9c8d9b480819bf96de248c3078baedf4ee30f23a7ef4d1af31691fef', 'tests/netherlands-belgium.test.cjs': '931829ae85563ffb79c58c04721054e35dc969224fa268e28fb819c97f5e612f'}
for file,digest in EXPECTED.items():
 assert __import__('hashlib').sha256((r/file).read_bytes()).hexdigest()==digest,file+' differs from tested bytes'
print('All '+str(len(EXPECTED))+' candidate files match locally tested SHA-256 digests.')
