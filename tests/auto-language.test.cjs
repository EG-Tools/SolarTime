'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('automatic language is the first translated language-menu choice',()=>{
 const html=read('index.html'),scroll=html.indexOf('id="language-scroll"'),automatic=html.indexOf('data-language-auto',scroll),firstCountry=html.indexOf('data-language="',scroll);
 assert.ok(scroll>=0&&automatic>scroll&&automatic<firstCountry);
 assert.match(html.slice(automatic,firstCountry),/id="auto-language-mode">자동<\/strong><span id="auto-language-name">언어/);
});

test('automatic label follows browser language and stays independent from app choices',()=>{
 const source=read('src/localization.js'),label=languages=>{const window={};vm.runInNewContext(source,{window,navigator:{languages,language:languages[0]},Intl});return Array.from(window.SolarModules.Localization.automaticLanguageLabel());};
 assert.deepEqual(label(['ko-KR']),['자동','언어']);assert.deepEqual(label(['en-US']),['AUTO','Language']);
 assert.deepEqual(label(['zh-TW']),['自動','語言']);assert.deepEqual(label(['ja-JP']),['自動','言語']);assert.deepEqual(label(['es-ES']),['AUTO','Idioma']);
});

test('automatic country follows timezone while automatic copy follows browser preference',()=>{
 const source=read('src/localization.js'),window={};
 const DateTimeFormat=()=>({resolvedOptions:()=>({timeZone:'Asia/Seoul'})});
 vm.runInNewContext(source,{window,navigator:{languages:['en-US','ko-KR'],language:'en-US'},Intl:{DateTimeFormat}});
 assert.equal(window.SolarModules.Localization.detect(),'kor');
 assert.equal(window.SolarModules.Localization.detectCopy(),'en');
});

test('new users and factory reset use automatic mode while old saved countries remain manual',()=>{
 const app=read('src/app.js');
 assert.match(app,/language=detectedLanguage\(\),languageMode='auto'/);assert.match(app,/language,languageMode,camera:/);
 assert.match(app,/language=nextLanguage;languageMode='auto'/);
 assert.match(app,/saved\.languageMode==='auto'/);assert.match(app,/languageMode='manual'/);
 assert.match(app,/languageMode==='auto'\?detectedCopyLanguage\(\)/);
 assert.match(app,/languageMode==='auto'\?languageMenu\.querySelector\('\[data-language-auto\]'\)/);
});
