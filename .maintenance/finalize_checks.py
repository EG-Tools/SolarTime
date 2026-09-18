from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'tests/singapore.test.cjs';s=p.read_text();assert 'regions:REGION_META' in s;p.write_text(s.replace('regions:REGION_META','regions:REGIONS'))
p=root/'tests/v046-release.test.cjs';s=p.read_text();assert "'pe','pt','es','eu'" in s;p.write_text(s.replace("'pe','pt','es','eu'","'pe','pt','sg','es','eu'"))
for name in ['modules.test.cjs','v046-release.test.cjs']:
 p=root/'tests'/name;s=p.read_text();assert 'src/localization.js?v=0.45-r11' in s;s=s.replace("'src/localization.js?v=0.45-r11'","'src/localization.js?v='+JSON.parse(read('version.json')).version+'-'+JSON.parse(read('version.json')).revision");p.write_text(s)
