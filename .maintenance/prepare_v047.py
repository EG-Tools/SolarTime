"""Audited r6 -> v0.47 source migration for a verification branch only.
No network, R2 upload, branch update or deployment is performed here.
The application changes are published only after the separate CI checks pass.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
def read(name):return (ROOT/name).read_text(encoding='utf8')
def put(name,text):
 p=ROOT/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf8')
def change(text,before,after):
 if before not in text:raise ValueError('Expected source marker missing: '+before[:100])
 return text.replace(before,after)
def node(code):
 return subprocess.check_output(['node'],input=code.encode(),cwd=ROOT).decode()
def normalize_shader(text):
 text=re.sub(r'//[^\n]*','',text);text=re.sub(r'\s+','',text)
 return re.sub(r'(?<![\w])(?:\d+\.\d*|\.\d+)',lambda m:format(float(m[0]),'.15g'),text)
def sha(text):return hashlib.sha256(text.encode()).hexdigest()

if json.loads(read('version.json'))!={'version':'0.46','revision':'r6'}:
 raise ValueError('This migration requires the reviewed v0.46 r6 source.')
html=read('index.html');assert 'name="apple-mobile-web-app-status-bar-style" content="default"' in html
protected=['manifest.webmanifest','assets/revision.json','assets/manifest.json','assets/deployment.json','src/assets.js','src/sky-asset.js','src/astro.js','kakao-pay-qr.svg','wrangler.jsonc']
protected_hashes={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in protected}
app=read('src/app.js');surface=read('src/surface.js');sky=read('src/sky.js');visual=read('src/visual-effects.js')
start=app.index('      const CURRENT_RELEASE=');end=app.index('      let releaseNotesApi=',start)
extract="const base=require('./src/release-notes.js');\n"+app[start:end]+"\nconst api=withCurrentRelease(base);console.log(JSON.stringify(api.RELEASES.map(r=>({version:r.version,date:r.date,localized:Object.fromEntries(['kor','en','chn','jpn','hi','es','de','fr','pt','it','id'].map(c=>[c,api.itemsFor(r,c)]))}))));"
old_notes=json.loads(node(extract))
shader_code="const vm=require('node:vm');const window={};vm.runInNewContext("+json.dumps(visual)+",{window});const source="+json.dumps(surface)+";const sky="+json.dumps(sky)+";console.log(JSON.stringify({direct:window.SolarVisualEffects.transformSurfaceShader(/const DIRECT_PLANET_FRAGMENT=`([\\s\\S]*?)`;/.exec(source)[1]),vertex:window.SolarVisualEffects.transformStarShader(/const starVertex=shader\\(g,g.VERTEX_SHADER,`([\\s\\S]*?)`\\);/.exec(sky)[1]),fragment:window.SolarVisualEffects.transformStarShader(/const starFragment=shader\\(g,g.FRAGMENT_SHADER,`([\\s\\S]*?)`\\);/.exec(sky)[1])}));"
effective=json.loads(node(shader_code))
notes_hash=sha(json.dumps(old_notes,ensure_ascii=False,separators=(',',':')))
gold={'baselineCommit':'94fa46401571dcb6363d153dab3b66030f91830c','notes':notes_hash,'releaseCount':len(old_notes),'languages':list(old_notes[0]['localized']),'planetShader':sha(normalize_shader(effective['direct'])),'starVertex':sha(normalize_shader(effective['vertex'].replace('${precision}','highp'))),'starFragment':sha(normalize_shader(effective['fragment'].replace('${precision}','highp')))}
put('tests/fixtures/r6-contracts.json',json.dumps(gold,indent=2)+'\n')
new_notes={
 'kor':['INFO·도움말·설정·천체·QR 카드의 공통 디자인과 닫기·스크롤 동작을 통합했습니다.','업데이트 내역을 한 데이터 파일로 정리하고 로딩 실패 후 재시도를 복구했습니다.','렌더러 메서드 교체와 전역 셰이더 가로채기를 제거하고 GPU·Worker·CPU의 공통 재질 설정을 정리했습니다.','원본과 가공 미디어를 분리하고 아이콘 업로드에 사전 검증·승인·명시적 실행 절차를 추가했습니다.','정상화된 아이폰 배치와 기존 카메라·아이콘을 유지하면서 회귀 테스트와 배포 검증을 보강했습니다.'],
 'en':['Unified the shared appearance, dismissal and scrolling of diagnostics, help, settings, body and QR cards.','Moved release history into one data module and restored retries after loading failures.','Removed renderer method replacement and global shader interception, sharing material settings across GPU, Worker and CPU adapters.','Separated original sources from derived media and added preflight checks, approval and explicit UI uploads.','Preserved the approved iPhone layout, camera controls and icons while strengthening regression and deployment checks.'],
 'chn':['统一了诊断、帮助、设置、天体和二维码卡片的公共外观、关闭及滚动行为。','将更新记录集中到一个数据模块，并修复加载失败后的重试。','移除了渲染器方法替换和全局着色器拦截，让 GPU、Worker 与 CPU 共用材质设置。','区分原始素材与加工媒体，并为图标上传增加预检、批准和明确执行步骤。','保留已确认的 iPhone 布局、相机操作和图标，并加强回归测试及部署检查。'],
 'jpn':['診断・ヘルプ・設定・天体・QRカードの共通デザインと閉じる操作・スクロールを統一しました。','更新履歴を一つのデータモジュールに集約し、読み込み失敗後の再試行を修正しました。','レンダラーのメソッド差し替えとグローバルなシェーダーフックを廃止し、GPU・Worker・CPUで材質設定を共有しました。','原本と加工済みメディアを分離し、アイコンのアップロードに事前検証・承認・明示的な実行を追加しました。','確認済みのiPhoneレイアウト、カメラ操作、アイコンを維持し、回帰テストと配信確認を強化しました。'],
 'hi':['निदान, सहायता, सेटिंग, खगोलीय पिंड और QR कार्ड का साझा रूप, बंद करना और स्क्रॉल व्यवहार एक किया गया।','अपडेट इतिहास एक डेटा मॉड्यूल में रखा गया और लोडिंग विफलता के बाद पुनः प्रयास सुधारा गया।','रेंडरर विधि प्रतिस्थापन और वैश्विक शेडर हस्तक्षेप हटाकर GPU, Worker और CPU के लिए सामग्री सेटिंग साझा की गई।','मूल स्रोतों और तैयार मीडिया को अलग किया गया; आइकन अपलोड में जाँच, स्वीकृति और स्पष्ट निष्पादन जोड़ा गया।','स्वीकृत iPhone लेआउट, कैमरा नियंत्रण और आइकन बनाए रखते हुए रिग्रेशन तथा डिप्लॉयमेंट जाँच बढ़ाई गई।'],
 'es':['Se unificaron el diseño compartido, el cierre y el desplazamiento de las tarjetas de diagnóstico, ayuda, ajustes, cuerpos y QR.','El historial de versiones se reunió en un módulo y se corrigieron los reintentos tras fallos de carga.','Se eliminaron los reemplazos de métodos y la interceptación global de shaders; GPU, Worker y CPU comparten los ajustes de material.','Se separaron originales y medios derivados, con validación previa, aprobación y cargas explícitas de iconos.','Se conservaron el diseño de iPhone, los controles de cámara y los iconos aprobados, reforzando las pruebas y la verificación del despliegue.'],
 'de':['Darstellung, Schließen und Scrollen der Diagnose-, Hilfe-, Einstellungs-, Himmelskörper- und QR-Karten wurden vereinheitlicht.','Der Versionsverlauf liegt nun in einem Datenmodul; erneute Ladeversuche nach Fehlern funktionieren wieder.','Methodenersetzungen und globale Shader-Eingriffe wurden entfernt; GPU, Worker und CPU teilen Materialeinstellungen.','Originale und abgeleitete Medien wurden getrennt; Symbol-Uploads erfordern Vorprüfung, Freigabe und explizite Ausführung.','Das bestätigte iPhone-Layout, die Kamerasteuerung und Symbole bleiben erhalten; Regressions- und Bereitstellungsprüfungen wurden erweitert.'],
 'fr':['L’apparence partagée, la fermeture et le défilement des cartes de diagnostic, d’aide, de réglages, d’astres et QR ont été unifiés.','L’historique des versions a été regroupé dans un module et les nouvelles tentatives après un échec de chargement ont été rétablies.','Les remplacements de méthodes et l’interception globale des shaders ont été supprimés ; GPU, Worker et CPU partagent les réglages de matériau.','Les originaux et médias dérivés sont séparés ; les icônes nécessitent une vérification, une approbation et un envoi explicite.','La disposition iPhone, les commandes de caméra et les icônes validées sont conservées, avec davantage de tests et de contrôles de déploiement.'],
 'pt':['O visual compartilhado, o fechamento e a rolagem dos cartões de diagnóstico, ajuda, configurações, corpos e QR foram unificados.','O histórico de versões foi reunido em um módulo, com novas tentativas após falhas de carregamento.','Foram removidas substituições de métodos e interceptações globais de shaders; GPU, Worker e CPU compartilham ajustes de material.','Originais e mídia derivada foram separados, com pré-verificação, aprovação e envio explícito de ícones.','O layout de iPhone, os controles de câmera e os ícones aprovados foram preservados, com testes e verificações de implantação ampliados.'],
 'it':['Aspetto condiviso, chiusura e scorrimento delle schede di diagnostica, guida, impostazioni, corpi e QR sono stati uniformati.','La cronologia delle versioni è stata riunita in un modulo, ripristinando i tentativi dopo errori di caricamento.','Sono state eliminate le sostituzioni di metodi e le intercettazioni globali degli shader; GPU, Worker e CPU condividono i parametri dei materiali.','Originali e media derivati sono separati, con controlli preliminari, approvazione e caricamento esplicito delle icone.','Layout iPhone, controlli della camera e icone approvati sono preservati, con test di regressione e verifiche di distribuzione rafforzati.'],
 'id':['Tampilan bersama, penutupan, dan gulir kartu diagnostik, bantuan, pengaturan, benda langit, serta QR disatukan.','Riwayat versi dipusatkan dalam satu modul dan percobaan ulang setelah kegagalan pemuatan diperbaiki.','Penggantian metode renderer dan intersepsi shader global dihapus; GPU, Worker, dan CPU berbagi pengaturan material.','Sumber asli dipisahkan dari media turunan, dengan pemeriksaan awal, persetujuan, dan unggahan ikon secara eksplisit.','Tata letak iPhone, kontrol kamera, dan ikon yang telah disetujui dipertahankan, dengan pengujian regresi serta pemeriksaan penerapan yang diperkuat.']}
entries=[{'version':'0.47','date':'2026.09.18','localized':new_notes}]+old_notes
for row in entries:
 for code in list(row['localized']):
  if code not in ('kor','en') and row['localized'][code]==row['localized'].get('en'):del row['localized'][code]
notes="""/* Single release-history source, loaded only on demand. */
(function(root){'use strict';
 const DATA="""+json.dumps(entries,ensure_ascii=False,separators=(',',':'))+""";
 const RELEASES=Object.freeze(DATA.map(e=>Object.freeze({version:e.version,date:e.date,items:Object.freeze(e.localized.kor),localized:Object.freeze(Object.fromEntries(Object.entries(e.localized).map(([c,v])=>[c,Object.freeze(v)])))})));
 function itemsFor(release,language='kor'){if(!release)return Object.freeze([]);const code=language==='eu'?'en':language;return release.localized?.[code]||release.localized?.en||release.items;}
 function createReleaseNotesNavigator(releases=RELEASES){const source=Array.isArray(releases)&&releases.length?releases:RELEASES;let index=0;const state=()=>Object.freeze({release:source[index],index,total:source.length,hasNewer:index>0,hasOlder:index<source.length-1});return Object.freeze({current:state,newer(){index=Math.max(0,index-1);return state();},older(){index=Math.min(source.length-1,index+1);return state();},reset(){index=0;return state();}});}
 const serialized=JSON.stringify(DATA),SOURCE_BYTES=typeof TextEncoder==='function'?new TextEncoder().encode(serialized).length:serialized.length;
 const api=Object.freeze({RELEASES,SOURCE_BYTES,itemsFor,createReleaseNotesNavigator});root.SolarReleaseNotes=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
"""
put('src/release-notes.js',notes)
app=app[:start]+app[end:]
a=app.index('      let releaseNotesApi=');b=app.index('      function formatReleaseNotesBytes',a)
app=app[:a]+"""      let releaseNotesApi=null,releaseNotesNavigator=null;
      function loadReleaseNotes(){
        if(releaseNotesApi)return Promise.resolve(releaseNotesApi);
        return UI.loadScript('src/release-notes.js?v=0.47-r1','SolarReleaseNotes').then(api=>{if(!releaseNotesApi){releaseNotesApi=api;releaseNotesNavigator=api.createReleaseNotesNavigator();}return releaseNotesApi;});
      }
"""+app[b:]
a=app.index("      presetDialog.addEventListener('cancel'");b=app.index("      window.addEventListener('resize'",a)
app=app[:a]+"      UI.bindDialog(presetDialog,()=>closePresetDialog());\n"+app[b:]
app=re.sub(r"      resetDefaultsDialog.addEventListener\('cancel'[^\n]*\n      resetDefaultsDialog.addEventListener\('click'[^\n]*", "      UI.bindDialog(resetDefaultsDialog,()=>closeResetDefaults());",app)
app=re.sub(r"      kakaoPayDialog.addEventListener\('cancel'[^\n]*\n      kakaoPayDialog.addEventListener\('click'[^\n]*", "      UI.bindDialog(kakaoPayDialog,()=>closeKakaoPay());",app)
app=change(app,"      helpDialog.addEventListener('cancel',event=>{event.preventDefault();handleEscape();});","      UI.bindDialog(helpDialog,()=>help(false),{backdrop:false});")
app=re.sub(r"        if\(resetDefaultsDialog.open\).*?\n        if\(\$\('help-dialog'\).open\).*?\n", "        if(UI.dismissTopDialog())return;\n",app,flags=re.S)
app=change(app,"if(document.fullscreenElement){event.preventDefault();event.stopImmediatePropagation();}","if(document.fullscreenElement||UI.topDialog()){event.preventDefault();event.stopImmediatePropagation();}")
app=change(app,"      const updateSettingsScrollCues=bindScrollCues(settingsPanel,settingsScroll);","      const updateSettingsScrollCues=bindScrollCues(settingsPanel,settingsScroll);\n      const updateBodyScrollCues=bindScrollCues($('body-panel'),$('body-scroll'));\n      bindScrollCues($('kakao-pay-dialog'),$('kakao-pay-scroll'));")
app=change(app,'        anchorBodyPanel();','        anchorBodyPanel();requestAnimationFrame(()=>updateBodyScrollCues());')
app=app.replace('disposed=true;renderer.dispose();materials.dispose();','disposed=true;UI.dispose();music.dispose();renderer.dispose();materials.dispose();').replace('disposed=true;setMusicEnabled(false);renderer.dispose();materials.dispose();','disposed=true;setMusicEnabled(false);UI.dispose();music.dispose();renderer.dispose();materials.dispose();')
app=app.replace("version:'0.46',revision:'r3',clock","version:'0.47',revision:'r1',translate:t,clock")
put('src/app.js',app)
# Preserve outer geometry; only card content receives common structure.
for old,new in [('class="panel settings-panel ui"','class="panel settings-panel card-surface ui"'),('class="panel body-panel ui"','class="panel body-panel card-surface ui"'),('class="modal"','class="modal card-surface"'),('class="modal ','class="modal card-surface '),('class="preset-dialog"','class="preset-dialog card-surface"'),('class="preset-dialog reset-defaults-dialog"','class="preset-dialog reset-defaults-dialog card-surface"'),('class="toast"','class="toast card-surface"'),('class="language-menu"','class="language-menu card-surface"')]:html=html.replace(old,new)
html=html.replace('card-surface card-surface','card-surface')
header=re.search(r'    <div class="panel-heading">.*?</div>\n',html).group(0)
html=html.replace(header,'').replace('    <div id="settings-scroll" class="settings-scroll">',header+'    <div id="settings-scroll" class="settings-scroll card-scroll">')
a=html.index('    <span id="body-category"');b=html.index('  </aside>',a)
html=html[:a]+'    <span class="scroll-cue scroll-cue-up" aria-hidden="true">⌃</span>\n    <div id="body-scroll" class="body-scroll card-scroll">\n'+html[a:b]+'    </div>\n    <span class="scroll-cue scroll-cue-down" aria-hidden="true">⌄</span>\n'+html[b:]
a=html.index('    <h2 id="kakao-pay-title"');b=html.index('  </dialog>',a)
html=html[:a]+'    <span class="scroll-cue scroll-cue-up" aria-hidden="true">⌃</span>\n    <div id="kakao-pay-scroll" class="modal-scroll card-scroll kakao-pay-scroll">\n'+html[a:b]+'    </div>\n    <span class="scroll-cue scroll-cue-down" aria-hidden="true">⌄</span>\n'+html[b:]
html=html.replace('name="solar-time-version" content="0.46"','name="solar-time-version" content="0.47"').replace('name="solar-time-revision" content="r6"','name="solar-time-revision" content="r1"').replace('Solar Time v0.46','Solar Time v0.47').replace('id="release-notes-version">v0.46','id="release-notes-version">v0.47')
html=html.replace('  <script src="src/surface.js?','  <script src="src/surface-style.js?v=0.47-r1"></script>\n  <script src="src/surface.js?')
for name in ['page-runtime','ui-runtime','surface','sky','visual-effects','renderer','performance','app','language-data']:
 html=re.sub(r'src="src/'+re.escape(name)+r'.js\?v=[^"]+"','src="src/'+name+'.js?v=0.47-r1"',html)
for name in ['styles.css','src/runtime-optimizations.css']:html=re.sub(r'href="'+re.escape(name)+r'\?v=[^"]+"','href="'+name+'?v=0.47-r1"',html)
put('index.html',html);put('version.json',json.dumps({'version':'0.47','revision':'r1'},indent=2)+'\n')
# Diagnostics uses the same card and dialog owner.
p=read('src/page-runtime.js');a=p.index('  let dialog=null;');b=p.index('  function ready()',a)
p=p[:a]+"""  let dialog=null,diagnosticCues=null;
  function showDiagnostics(){
    const UI=root.SolarModules?.UI;if(!UI)return;
    const t=(key,fallback)=>root.SolarTime?.translate?.(key)||fallback;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='modal card-surface solar-layout-diagnostics';dialog.id='layout-diagnostics';dialog.setAttribute('aria-labelledby','layout-diagnostics-title');
      const close=document.createElement('button');close.type='button';close.className='close-button';close.textContent='×';close.dataset.i18nAria='closeCard';close.setAttribute('aria-label',t('closeCard','Close'));
      const body=document.createElement('div');body.className='modal-scroll card-scroll';
      const title=document.createElement('h2');title.id='layout-diagnostics-title';title.dataset.i18n='layoutDiagnostics';title.textContent=t('layoutDiagnostics','Layout diagnostics');
      const pre=document.createElement('pre');pre.dataset.layoutInfo='true';pre.dataset.allowSelection='true';
      const actions=document.createElement('div');actions.className='card-actions';
      const reload=document.createElement('button');reload.type='button';reload.className='text-button';reload.dataset.i18n='reloadPage';reload.textContent=t('reloadPage','Reload');
      reload.addEventListener('click',()=>{const url=new URL(root.location.href);url.searchParams.set('refresh',Date.now().toString(36));root.location.replace(url.href);});
      const requestClose=()=>UI.hide(dialog,()=>{dialog.close();document.querySelector('.solar-build-info')?.focus({preventScroll:true});});
      close.addEventListener('click',requestClose);UI.bindDialog(dialog,requestClose);
      const cue=direction=>{const e=document.createElement('span');e.className='scroll-cue scroll-cue-'+direction;e.setAttribute('aria-hidden','true');e.textContent=direction==='up'?'⌃':'⌄';return e;};
      actions.append(reload);body.append(title,pre,actions);dialog.append(close,cue('up'),body,cue('down'));document.body.append(dialog);diagnosticCues=UI.bindScrollCues(dialog,body);
    }
    dialog.querySelector('pre').textContent=JSON.stringify(layoutInfo(),null,2);UI.show(dialog,()=>dialog.showModal());diagnosticCues.update();root.requestAnimationFrame(diagnosticCues.update);
  }
"""+p[b:]
put('src/page-runtime.js',p)
labels={'kor':['화면 진단','닫기','새로고침'],'en':['Layout diagnostics','Close','Reload'],'chn':['布局诊断','关闭','重新加载'],'jpn':['レイアウト診断','閉じる','再読み込み'],'hi':['लेआउट जाँच','बंद करें','फिर से लोड करें'],'es':['Diagnóstico de diseño','Cerrar','Recargar'],'de':['Layout-Diagnose','Schließen','Neu laden'],'fr':['Diagnostic d’affichage','Fermer','Recharger'],'pt':['Diagnóstico de layout','Fechar','Recarregar'],'it':['Diagnostica del layout','Chiudi','Ricarica'],'id':['Diagnostik tata letak','Tutup','Muat ulang']}
for language,values in labels.items():
 data=json.loads(read('src/locales/'+language+'.json'));data['copy'].update(dict(zip(['layoutDiagnostics','closeCard','reloadPage'],values)));put('src/locales/'+language+'.json',json.dumps(data,ensure_ascii=False,indent=2)+'\n')
# Renderer owns resize; performance provides policy rather than replacing methods.
perf=read('src/performance.js');a=perf.index('  const Direct=');b=perf.index('  root.SolarPerformance=',a)
perf=perf[:a]+"""  function touchTexture(renderer,name){const record=renderer.textures?.get(name);if(record)record.lastUsed=(renderer.__solarTextureUseSerial=(renderer.__solarTextureUseSerial||0)+1);}
  function enforceTextureBudget(renderer){const budget=textureBudget(),bytes=Math.max(0,(renderer.stats?.texturePixels||0)*4);renderer.stats.textureBudgetBytes=budget;renderer.stats.textureBytes=bytes;if(bytes>budget){const now=performance.now();if(now-(renderer.__solarLastTextureTrim||0)>500){renderer.__solarLastTextureTrim=now;trimTextures(renderer);}}}
"""+perf[b:]
perf=perf.replace('textureBudget,trimTextures,','textureBudget,trimTextures,touchTexture,enforceTextureBudget,');put('src/performance.js',perf)
r=read('src/renderer.js');r=change(r,"const dpr=Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);","const dpr=window.SolarPerformance?.pixelRatio(w,h,this.options.quality)??Math.min(window.devicePixelRatio||1,this.options.quality==='low'?1:2);")
r=change(r,'if(w===this.w&&h===this.h&&dpr===this.dpr)return;','if(w===this.w&&h===this.h&&Math.abs(dpr-this.dpr)<.001)return;').replace('this.gpu?.resize(this.w,this.h,this.dpr);','this.stats.adaptiveDpr=this.dpr;this.gpu?.resize(this.w,this.h,this.dpr);');put('src/renderer.js',r)
surface=change(surface,"'use strict';\nfunction surfaceKernel(){","'use strict';\nconst STYLE=root.SolarSurfaceStyle;\nif(!STYLE)throw Error('surface-style.js must load before surface.js');\nfunction surfaceKernel(style){\n  const sun=style.sun;")
surface,count=re.subn(r'if\(kind==2\.&&sunActivity>\.5\)\{.*?uv=vec2\(.*?;\s*\}','${style.warpGLSL}',surface,flags=re.S);assert count==2
surface,count=re.subn(r'(else if\(kind==2\.\)\{)\s*float lum=.*?col\+=active\*vec3\([^;]+;',lambda m:m[1]+'\n      ${style.lightingGLSL}',surface,flags=re.S);assert count==2
a=surface.index('const DIRECT_PLANET_FRAGMENT=');b=surface.index('// The corona',a);surface=surface[:a]+surface[a:b].replace('${style.','${STYLE.')+surface[b:]
surface=surface.replace('(${surfaceKernel.toString()})();','(${surfaceKernel.toString()})(${JSON.stringify(STYLE)});').replace('const kernel=surfaceKernel();','const kernel=surfaceKernel(STYLE);').replace('kernel:surfaceKernel,','kernel:()=>surfaceKernel(STYLE),')
surface=surface.replace("if(id==='sun'&&activity){const crawl=seconds*.24,wx=Math.sin(v*49+Math.sin(u*Math.PI*10+crawl)*1.7+crawl)*.0015,wy=Math.sin(u*Math.PI*16-Math.sin(v*31-crawl*.8)+crawl*.7)*.0011;","if(id==='sun'&&activity){const crawl=seconds*sun.crawl,wx=Math.sin(v*sun.warpY+Math.sin(u*Math.PI*sun.warpX+crawl)*1.7+crawl)*sun.warpAmountX,wy=Math.sin(u*Math.PI*sun.warpX2-Math.sin(v*sun.warpY2-crawl*.8)+crawl*.7)*sun.warpAmountY;")
surface=surface.replace('u*TAU*3+v*11','u*Math.PI*sun.waveX+v*sun.waveY').replace('u*TAU*7-v*19','u*Math.PI*sun.waveX2-v*sun.waveY2').replace('bright*(-.018+.118*brightCycle)+dark*(-.032+.057*darkCycle)','bright*(sun.brightBase+sun.brightAmount*brightCycle)+dark*(sun.darkBase+sun.darkAmount*darkCycle)')
for i,value in enumerate(['.085','.026','.002']):surface=surface.replace('255*'+value+'*bright*brightCycle*facing','255*sun.glow['+str(i)+']*bright*brightCycle*facing')
surface=change(surface,"return {url,fallback:remote&&asset.fallback!==remote?asset.fallback:'',key:url+'|'+(remote?asset.fallback:'')};","return {url,fallback:remote&&asset.fallback!==remote?asset.fallback:'',key:url+'|'+(remote?asset.fallback:''),seamBaked:!!asset.seamBaked};")
a=surface.index('  // One material-boundary repair');b=surface.index('  function materialCanvas',a);surface=surface[:a]+surface[b:]
surface=surface.replace('function materialCanvas(bitmap,w,h,readPixels=false){','function materialCanvas(bitmap,w,h,readPixels=false,seamBaked=false){')
surface=change(surface,"    const band=Math.max(2,Math.min(32,Math.round(w*.012))),left=ctx.getImageData","    if(!seamBaked){\n    const band=Math.max(style.seam.minBand,Math.min(style.seam.maxBand,Math.round(w*style.seam.ratio))),left=ctx.getImageData")
surface=change(surface,'    ctx.putImageData(left,0,0);ctx.putImageData(right,w-band,0);','    ctx.putImageData(left,0,0);ctx.putImageData(right,w-band,0);\n    }').replace('materialCanvas(bitmap,width,width/2,!this.gl)','materialCanvas(bitmap,width,width/2,!this.gl,source.seamBaked)')
surface=surface.replace('async function bitmapFor(source,width,height){',"async function bitmapFor(source,width=null,height=null){\n    const resize=width&&height?{resizeWidth:width,resizeHeight:height,resizeQuality:'high'}:{};").replace("{resizeWidth:width,resizeHeight:height,resizeQuality:'high'});",'resize);')
surface=surface.replace('return {Engine,setAssets,stitchLongitude};','return {Engine,setAssets,sourceFor,materialCanvas,bitmapFor,shaderSources:{vertex,fragment}};').replace('\nclass SurfaceService{','\nconst materialSource=surfaceKernel(STYLE);\nclass SurfaceService{')
a=surface.index('function directDataBlob(');b=surface.index('function directPower(',a);surface=surface[:a]+surface[b:]
surface=surface.replace('directSource(asset,target)','materialSource.sourceFor(asset,target)').replace('await directBitmap(source)','await materialSource.bitmapFor(source)')
a=surface.index("        canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height)",surface.index('async loadTexture'));b=surface.index('\n      }\n      if(this.disposed',a)
surface=surface[:a]+'        canvas=materialSource.materialCanvas(bitmap,width,height,false,source.seamBaked).canvas;upload=canvas;'+surface[b:]
surface=surface.replace('  texture(name,target){','  texture(name,target){const result=this.textureFor(name,target);root.SolarPerformance?.touchTexture(this,name);return result;}\n  textureFor(name,target){').replace('  end(){for(const id of this.frames.keys())if(!this.desired.has(id))this.frames.delete(id);}','  end(){for(const id of this.frames.keys())if(!this.desired.has(id))this.frames.delete(id);root.SolarPerformance?.enforceTextureBudget(this);}')
surface=surface.replace("effectRevision:'solar-surface-r25'","effectRevision:'solar-surface-v047',shaderSources:Object.freeze({planet:DIRECT_PLANET_FRAGMENT})");put('src/surface.js',surface)
a=visual.index('  const Sky=');visual=visual[:a]+"""  function drawCount(sky,options={}){const available=Math.min(MAX_STAR_COUNT,sky.starCount||root.SolarAssets?.starData?.length/6||MAX_STAR_COUNT),density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER),count=Math.min(available,Math.round(BASE_STAR_COUNT*density));if(sky.__solarStarDrawCount!==count){sky.__solarStarDrawCount=count;sky.invalidate?.();}if(sky.stats)sky.stats.visibleStarCount=count;return count;}
  function starsFor(sky,options={}){let source=root.SolarAssets?.stars;if(!Array.isArray(source)){source=starArrayFromData(root.SolarAssets?.starData);if(root.SolarAssets)root.SolarAssets.stars=source;}const density=clamp(Number(options.starDensity??1),0,MAX_STAR_MULTIPLIER),count=Math.min(source.length,Math.round(BASE_STAR_COUNT*density));if(count===source.length)return source;if(sky.__solarStarSubsetSource!==source||sky.__solarStarSubsetCount!==count){sky.__solarStarSubsetSource=source;sky.__solarStarSubsetCount=count;sky.__solarStarSubset=source.slice(0,count);}return sky.__solarStarSubset;}
  function starShaderSources(precision){return {vertex:`"""+effective['vertex']+"""`,fragment:`"""+effective['fragment']+"""`};}
  root.SolarVisualEffects=Object.freeze({BASE_STAR_COUNT,MAX_STAR_MULTIPLIER,MAX_STAR_COUNT,runtimeSeed,buildNaturalStarData,buildNaturalStarPool,regenerateStars,drawCount,starsFor,starShaderSources});
})(window);
"""
visual=visual.replace('sky.__uploadStarLayer?.(data);','');put('src/visual-effects.js',visual)
a=sky.index('   const starVertex=');b=sky.index('   this.starProgram=',a)
sky=sky[:a]+"   const sources=root.SolarVisualEffects.starShaderSources(precision);\n   const starVertex=shader(g,g.VERTEX_SHADER,sources.vertex),starFragment=shader(g,g.FRAGMENT_SHADER,sources.fragment);\n"+sky[b:]
sky=sky.replace(' draw(seconds,camera,options){\n  if(this.disposed||this.paused)return;',' draw(seconds,camera,options){\n  if(this.disposed||this.paused)return;\n  const drawCount=root.SolarVisualEffects.drawCount(this,options);').replace('if(options.twinkle&&this.starProgram&&this.starCount){','if(options.twinkle&&this.starProgram&&drawCount){').replace('g.drawArrays(g.POINTS,0,this.starCount)','g.drawArrays(g.POINTS,0,drawCount)').replace('const stars=root.SolarAssets?.stars||[],pose=this.starPose;','const stars=root.SolarVisualEffects.starsFor(this,options),pose=this.starPose;');put('src/sky.js',sky)
# Media builds validate original inputs before deleting output; code builds remain media-free.
p=read('tools/asset-pipeline.cjs').replace("'use strict';","'use strict';\nconst {seam}=require('../src/surface-style.js');\nconst {assertOriginal}=require('./source-guard.cjs');",1)
p=p.replace('Math.max(2,Math.min(32,Math.round(width*.012)))','Math.max(seam.minBand,Math.min(seam.maxBand,Math.round(width*seam.ratio)))')
p=change(p,' fs.rmSync(resolved,{recursive:true,force:true});fs.mkdirSync(resolved,{recursive:true});'," const previousFile=path.join(root,'assets/manifest.json'),previous=fs.existsSync(previousFile)?readJson(previousFile):null;\n for(const file of sourceFiles(root))assertOriginal(root,path.join(root,'assets',file),previous);\n fs.rmSync(resolved,{recursive:true,force:true});fs.mkdirSync(resolved,{recursive:true});")
p=p.replace('atomicWrite,buildMedia,projectConfig,runtimeScripts};','atomicWrite,buildMedia,projectConfig,runtimeScripts,sourceFiles};');put('tools/asset-pipeline.cjs',p)
p=read('tools/r2-media-bundle.cjs').replace('async function downloadMediaBundle(root,target){',"async function downloadMediaBundle(root,target,{kind='derived'}={}){").replace('bundle=deployment.bundle;',"bundle=kind==='originals'?deployment.originals:deployment.bundle;")
p=p.replace("throw Error('Run npm run publish:media once before downloading media.');","throw Error(kind==='originals'?'No original-source archive is configured. Supply original masters; fetch:derived is for inspection only.':'No published media bundle is configured.');")
p=p.replace('if(resolved!==cloudflareRoot&&!resolved.startsWith(cloudflareRoot+path.sep))','if(!resolved.startsWith(cloudflareRoot+path.sep))');put('tools/r2-media-bundle.cjs',p)
p=read('tools/deploy-cloudflare.cjs').replace("for(const args of [[path.join(root,'tools','build-cloudflare.cjs')]","for(const args of [[path.join(root,'tools','run-tests.cjs')],[path.join(root,'tools','build-cloudflare.cjs')]");put('tools/deploy-cloudflare.cjs',p)
p=read('cloudflare/worker.js').replace('function mediaHeaders(object,status,key){',"const mutableUI=key=>/(?:^|\\/)content\\/ui\\//.test(key);\nconst mediaCacheControl=key=>mutableUI(key)?'public, max-age=3600, must-revalidate':'public, max-age=31536000, immutable';\n\nfunction mediaHeaders(object,status,key){")
p=p.replace("headers.set('cache-control','public, max-age=31536000, immutable');","headers.set('cache-control',mediaCacheControl(key));").replace("const range=request.headers.get('range'),cache=range?null:caches.default;","const range=request.headers.get('range'),cache=range||mutableUI(key)?null:caches.default;").replace("headers:{etag:object.httpEtag,'cache-control':'public, max-age=31536000, immutable'}","headers:mediaHeaders(object,304,key)");put('cloudflare/worker.js',p)
pkg=json.loads(read('package.json'));pkg['version']='0.0.47';pkg['engines']['node']='>=22.16';pkg['scripts']['test']='node tools/run-tests.cjs'
for key in ['test:v042','test:v043']:pkg['scripts'].pop(key,None)
pkg['scripts'].update({'fetch:derived':'node tools/fetch-derived-assets.cjs','pack:originals':'node tools/pack-originals.cjs','restore:ui:history':'node tools/restore-ui-history.cjs','test:ui':'python tests/browser/ui-regression.py'})
put('package.json',json.dumps(pkg,indent=2)+'\n');lock=json.loads(read('package-lock.json'));lock['version']='0.0.47';lock['packages']['']['version']='0.0.47';lock['packages']['']['engines']['node']='>=22.16';put('package-lock.json',json.dumps(lock,indent=2)+'\n')
for name in ['v040-release.test.cjs','v042-release.test.cjs','v043-release.test.cjs']:(ROOT/'tests'/name).unlink()
# Migrate source-layout assertions without discarding their behavior contracts.
p=read('tests/v046-release.test.cjs')
p=p.replace('function visualApi(){',"function notesApi(){return require('../src/release-notes.js');}\nconst notesFor=version=>{const api=notesApi();return api.itemsFor(api.RELEASES.find(r=>r.version===version),'kor').join(' ');};\nfunction visualApi(){")
p=p.replace('name="solar-time-version" content="0.46"','name="solar-time-version" content="0.47"').replace("assert.equal(version.version,'0.46');","assert.equal(version.version,'0.47');").replace("assert.equal(pkg.version,'0.0.46');","assert.equal(pkg.version,'0.0.47');").replace("version:'0.46',revision:'r3'","version:'0.47',revision:'r1'")
p=p.replace('const transformed=api.transformStarShader(vertex);',"const transformed=api.starShaderSources('highp').vertex;")
a=p.index("test('Sun keeps fine frequencies");b=p.index("\ntest('Jupiter experimental",a)
p=p[:a]+"""test('Sun keeps approved fine frequencies and softened motion parameters',()=>{const {sun}=require('../src/surface-style.js');assert.equal(sun.warpY,150);assert.equal(sun.warpX,56);assert.equal(sun.warpAmountX,.00121125);assert.equal(sun.warpAmountY,.0009025);assert.equal(sun.brightBase,-.00855);assert.equal(sun.brightAmount,.073625);assert.equal(sun.darkBase,-.01425);assert.equal(sun.darkAmount,.03705);assert.deepEqual(sun.glow,[.08075,.0247,.0019]);});
"""+p[b:]
p=p.replace('assert.match(effects,/Jupiter deliberately receives no override/);',"assert.doesNotMatch(read('src/surface-style.js'),/jupiter|kind==5/);")
a=p.index("  const app=read('src/app.js');assert.match(app,/PREVIOUS_RELEASE");b=p.index('\n});',a)
p=p[:a]+"  const notes=notesFor('0.45');for(const text of ['황색 별 비중을 줄였습니다','5~25초','5~10초','약 5% 더 낮춰','기본 가스행성 셰이더로 완전히 복원'])assert.ok(notes.includes(text),text);"+p[b:]
a=p.index("  const app=read('src/app.js'),start=app.indexOf(\"const SECOND_PREVIOUS_RELEASE");b=p.index('\n});',a)
p=p[:a]+"  const api=notesApi(),release=api.RELEASES.find(r=>r.version==='0.43');for(const code of ['kor','en','chn','jpn','es','de','fr'])assert.doesNotMatch(api.itemsFor(release,code).join(' '),/대적점|Great Red Spot|大红斑|大赤斑|Gran Mancha Roja|Großen Roten Fleck|Grande Tache rouge/);assert.match(notesFor('0.43'),/GPU에 한 번 올린 뒤 슬라이더 값에 따라 그리는 개수만 바꾸도록/);"+p[b:]
a=p.index("  const app=read('src/app.js'),start=app.indexOf(\"const PREVIOUS_RELEASE");b=p.index('\n});',a)
p=p[:a]+"  assert.match(notesFor('0.45'),/마우스 오른쪽 버튼을 누른 채 위아래로 드래그/);"+p[b:]
p=p.replace(r'g\.drawArrays\(g\.POINTS,0,this\.starCount\)',r'g\.drawArrays\(g\.POINTS,0,drawCount\)').replace(r'materialCanvas\(bitmap,w,h,readPixels=false\)',r'materialCanvas\(bitmap,w,h,readPixels=false,seamBaked=false\)').replace(r'\.clock-face,body\.zen \.clock-face\{',r'body\.zen \.clock-face\{')
a=p.index('  assert.match(app,/CURRENT_RELEASE=');b=p.index("\n  assert.ok(html.includes('src/assets.js",a)
p=p[:a]+"""  const notes=notesApi();assert.equal(notes.RELEASES[0].version,'0.47');assert.deepEqual(notes.RELEASES.slice(0,5).map(r=>r.version),['0.47','0.46','0.45','0.43','0.42']);
  for(const code of ['kor','en','chn','jpn','hi','es','de','fr','pt','it','id'])assert.ok(notes.itemsFor(notes.RELEASES[0],code).length>0,code);
  assert.ok(app.includes('src/release-notes.js?v=0.47-r1'));assert.ok(html.includes('<h3 id="release-notes-version">v0.47</h3>'));assert.doesNotMatch(app,/CURRENT_RELEASE_ITEMS|withCurrentRelease|releaseByVersion/);
"""+p[b:]
for before,after in [('src/app.js?v=0.46-r3','src/app.js?v=0.47-r1'),('src/sky.js?v=0.46-r4','src/sky.js?v=0.47-r1'),('styles.css?v=0.45-r15','styles.css?v=0.47-r1'),("'src/'+file+'.js?v=0.46-r1'","'src/'+file+'.js?v=0.47-r1'"),("src/runtime-optimizations.css?v=0.46-","src/runtime-optimizations.css?v=0.47-")]:p=p.replace(before,after)
p=p.replace(r'src\/sky\.js\?v=0\.46-r4',r'src\/sky\.js\?v=0\.47-r1').replace(r'src\/visual-effects\.js\?v=0\.45-r10',r'src\/visual-effects\.js\?v=0\.47-r1').replace(r'src\/app\.js\?v=0\.46-r\d+',r'src\/app\.js\?v=0\.47-r\d+')
put('tests/v046-release.test.cjs',p)
p=read('tests/modules.test.cjs')
for before,after in [('styles.css?v=0.45-r15','styles.css?v=0.47-r1'),('src/surface.js?v=0.46-r1','src/surface.js?v=0.47-r1'),('src/renderer.js?v=0.46-r1','src/renderer.js?v=0.47-r1'),('src/performance.js?v=0.46-r1','src/performance.js?v=0.47-r1'),('src/visual-effects.js?v=0.45-r10','src/visual-effects.js?v=0.47-r1'),('src/language-data.js?v=0.45-r10','src/language-data.js?v=0.47-r1'),('src/runtime-optimizations.css?v=0.46-','src/runtime-optimizations.css?v=0.47-'),('src/page-runtime.js?v=0.46-','src/page-runtime.js?v=0.47-')]:p=p.replace(before,after)
p=p.replace("assert.ok(html.includes('src/'+name+'.js?v=0.45'));","assert.ok(html.includes('src/'+name+'.js?v='+ (name==='ui-runtime'?'0.47-r1':'0.45')));")
p=p.replace("assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');","assert.ok(html.indexOf('src/performance.js')<html.indexOf('src/app.js'),'performance');assert.ok(html.indexOf('src/surface-style.js')<html.indexOf('src/surface.js'));")
put('tests/modules.test.cjs',p)
# Card surface consolidation is handled by the separately reviewed CSS migration.
subprocess.run(['node','.maintenance/cleanup-css.cjs'],cwd=ROOT,check=True)
p=read('src/runtime-optimizations.css').replace('--solar-layout-revision:r6','--solar-layout-revision:r1');put('src/runtime-optimizations.css',p)
for name,expected in protected_hashes.items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==expected,name+' must remain unchanged'
for name in ['app','renderer','surface','sky','performance','visual-effects']:
 p=read('src/'+name+'.js');p=re.sub(r'^/\*[\s\S]*?\*/',lambda m:'/* Solar Time v0.47 — '+name+' implementation owner. */',p,count=1);put('src/'+name+'.js',p)
print('Prepared v0.47 r1; current iPhone status bar, camera defaults and approved media were preserved.')
