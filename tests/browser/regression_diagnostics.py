"""Bounded diagnostics for offline browser tests; no production accounts or secrets."""
from pathlib import Path
import json, os, traceback

class BrowserDiagnostics:
 def __init__(self, root, name, checks=None):
  self.root=Path(root);self.name=name;self.checks=checks if checks is not None else []
  self.folder=self.root/'.cloudflare/browser-artifacts'/name
  self.folder.mkdir(parents=True,exist_ok=True)
  self.pages=[];self.contexts=[];self.error=None;self.captured=False;self.console=[];self.page_errors=[]
  self._write('running')
 def attach(self,context,page,label):
  if context not in self.contexts:
   self.contexts.append(context)
   context.tracing.start(screenshots=True,snapshots=True,sources=True)
  self.pages.append((page,label))
  def record(items,value):
   items.append(value)
   if len(items)>200:del items[:-200]
  page.on('console',lambda m:record(self.console,{'case':label,'type':m.type,'text':m.text[:4000]}))
  page.on('pageerror',lambda e:record(self.page_errors,{'case':label,'error':str(e)[:4000]}))
 def fail(self,error):
  if self.error is None:self.error={'type':type(error).__name__,'message':str(error),'traceback':''.join(traceback.format_exception(type(error),error,error.__traceback__))}
  if self.captured:return
  self.captured=True
  for i,(page,label) in enumerate(self.pages):
   if page.is_closed():continue
   stem=self.folder/('case-'+str(i))
   try:page.screenshot(path=str(stem)+'.png',full_page=True,timeout=5000)
   except Exception as e:(self.folder/('capture-'+str(i)+'.txt')).write_text(str(e),encoding='utf8')
   try:Path(str(stem)+'.html').write_text(page.content(),encoding='utf8')
   except Exception:pass
  for i,context in enumerate(self.contexts):
   try:context.tracing.stop(path=str(self.folder/('trace-'+str(i)+'.zip')))
   except Exception:pass
  self.finish()
 def finish(self):
  self._write('failed' if self.error else 'passed')
 def _write(self,status):
  report={'mode':'offline synthetic browser; not a physical iPhone','status':status,'commit':os.environ.get('GITHUB_SHA','local'),'passed':len(self.checks),'checks':self.checks,'error':self.error,'console':self.console,'pageErrors':self.page_errors}
  target=self.root/'.cloudflare'/(self.name+'.json')
  target.parent.mkdir(parents=True,exist_ok=True)
  temp=target.with_suffix('.tmp');temp.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');temp.replace(target)
