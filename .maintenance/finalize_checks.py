from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'tests/singapore.test.cjs';s=p.read_text();assert 'regions:REGION_META' in s;p.write_text(s.replace('regions:REGION_META','regions:REGIONS'))
p=root/'tests/v046-release.test.cjs';s=p.read_text();assert "'pe','pt','es','eu'" in s;p.write_text(s.replace("'pe','pt','es','eu'","'pe','pt','sg','es','eu'"))
