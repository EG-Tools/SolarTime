"""An expected failure proves screenshot, trace and partial-check preservation."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from regression_diagnostics import BrowserDiagnostics
root=Path(__file__).resolve().parents[2]
d=BrowserDiagnostics(root,'diagnostics-selftest',['one completed check'])
with sync_playwright() as p:
 opt={'headless':True,'args':['--no-sandbox']}
 if os.environ.get('SOLAR_CHROMIUM_EXECUTABLE'):opt['executable_path']=os.environ['SOLAR_CHROMIUM_EXECUTABLE']
 browser=p.chromium.launch(**opt)
 try:
  page=browser.new_page();d.attach(page.context,page,'intentional failure')
  page.set_content('<title>Diagnostic self-test</title><p>Expected failure fixture</p>')
  page.evaluate("console.error('expected diagnostic message')")
  try:raise AssertionError('intentional diagnostic capture test')
  except AssertionError as error:d.fail(error)
 finally:browser.close()
report=json.loads((root/'.cloudflare/diagnostics-selftest.json').read_text())
assert report['status']=='failed' and report['passed']==1 and report['error']['type']=='AssertionError'
assert any('expected diagnostic message' in m['text'] for m in report['console'])
assert any(p.stat().st_size>0 for p in d.folder.glob('*.png'))
assert any(p.stat().st_size>0 for p in d.folder.glob('trace-*.zip'))
print('PASS: expected failure preserved screenshot, trace, console and partial checks.')
