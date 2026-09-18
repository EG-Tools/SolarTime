"""One-time Singapore addition to the v0.47 candidate, not a runtime patch."""
from pathlib import Path
import json,re
root=Path(__file__).resolve().parents[1]
def edit(name,fn):
 p=root/name;text=p.read_text(encoding='utf8');p.write_text(fn(text),encoding='utf8')
def once(text,old,new):
 if text.count(old)!=1:raise ValueError('Expected one source marker: '+old)
 return text.replace(old,new)
def app(s):
 s=once(s,"'pe','pt','es','eu'","'pe','pt','sg','es','eu'")
 s=once(s,"    nz:{code:","    sg:{code:'SG',name:'Singapore',locale:'en-SG',html:'en-SG',copy:'en'},\n    nz:{code:")
 # Representative location in IANA zone.tab: SG +0117+10351 Asia/Singapore.
 s=once(s,'    nz:{label:',"    sg:{label:'SINGAPORE',timeZone:'Asia/Singapore',latitude:1.2833333333333334,longitude:103.85,region:'Singapore',city:'Singapore'},\n    nz:{label:")
 return s
edit('src/app.js',app)
def html(s):
 token='          <button type="button" role="menuitemradio" data-language="es">'
 s=once(s,token,'          <button type="button" role="menuitemradio" data-language="sg"><strong>SG</strong><span>Singapore</span></button>\n'+token)
 return re.sub(r'src="src/localization\.js\?v=[^"]+"','src="src/localization.js?v=0.47-r1"',s)
edit('index.html',html)
def localization(s):
 s=once(s,"    if(/seoul/i.test(zone))return 'kor';","    if(/seoul/i.test(zone))return 'kor';\n    if(/^(?:Asia\\/)?Singapore$/i.test(zone))return 'sg';")
 return once(s,"['en-ca','ca']","['en-sg','sg'],['en-ca','ca']")
edit('src/localization.js',localization)
# Adjust only the expected version of the module changed by this addition.
edit('tests/modules.test.cjs',lambda s:s.replace("name==='ui-runtime'?","['ui-runtime','localization'].includes(name)?"))
notes={
'kor':'싱가포르를 국가 목록에 추가했습니다. 기존 영어 번역을 공유하며 싱가포르 시간과 지구 보기 위치를 사용합니다.',
'en':'Added Singapore to the country list, reusing English translations with Singapore time and the shared Earth-view location control.',
'chn':'国家列表新增新加坡，复用英语翻译，并使用新加坡时间和共用的地球位置查看功能。',
'jpn':'国一覧にシンガポールを追加しました。既存の英語翻訳とシンガポール時間、共通の地球表示位置を使用します。',
'hi':'देश सूची में सिंगापुर जोड़ा गया; मौजूदा अंग्रेज़ी अनुवाद, सिंगापुर समय और साझा पृथ्वी-दृश्य नियंत्रण का उपयोग होता है।',
'es':'Se añadió Singapur a la lista de países, reutilizando el inglés, la hora de Singapur y el control compartido de ubicación terrestre.',
'de':'Singapur wurde zur Länderliste hinzugefügt und nutzt vorhandene englische Texte, die Ortszeit und die gemeinsame Erdansicht.',
'fr':'Singapour a été ajouté aux pays, avec les textes anglais existants, l’heure locale et la commande commune de vue terrestre.',
'pt':'Singapura foi adicionada à lista de países, usando as traduções em inglês, a hora local e o controle compartilhado de localização na Terra.',
'it':'Singapore è stato aggiunto all’elenco dei paesi con i testi inglesi esistenti, l’ora locale e il controllo condiviso della vista terrestre.',
'id':'Singapura ditambahkan ke daftar negara dengan terjemahan Inggris yang ada, waktu Singapura, dan kontrol lokasi tampilan Bumi bersama.'}
def release(s):
 a=s.index(' const DATA=')+len(' const DATA=');b=s.index(';\n const RELEASES=',a);data=json.loads(s[a:b]);assert data[0]['version']=='0.47'
 for lang,line in notes.items():data[0]['localized'][lang].append(line)
 return s[:a]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+s[b:]
edit('src/release-notes.js',release)
edit('CHANGELOG.md',lambda s:once(s,'## v0.47 · 2026-09-18\n','## v0.47 · 2026-09-18\n\n- Added Singapore (SG), reusing English translations with en-SG formatting, Asia/Singapore time and the existing regional Earth-view path.\n'))
print('Singapore added via the existing country, English-copy, time-zone and location contracts.')
