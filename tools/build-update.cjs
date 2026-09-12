/* Build a local v0.13 -> v0.14 HTML updater. No dependencies or network access. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const payload={skySource:text('src/sky.js'),rendererSource:text('src/renderer.js'),skyImage:'data:image/webp;base64,'+fs.readFileSync(path.join(root,'assets/universe.webp')).toString('base64')};
const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>Solar Time · v0.14 업데이트</title>
<style>*{box-sizing:border-box}body{margin:0;background:#080c15;color:#e3e9f4;font:16px/1.7 'Segoe UI','Malgun Gothic',sans-serif;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:700px;width:100%;border:1px solid #273247;border-radius:20px;padding:36px;background:#101724}small{color:#9fb5d1;letter-spacing:.2em}h1{font-size:30px;margin:9px 0 18px}p{color:#b8c5d8}label{display:block;padding:26px;background:#182235;border:1px dashed #607690;border-radius:12px;cursor:pointer}input{display:block;width:100%;margin-top:12px;color:#dce7f7}button,a.download{border:0;border-radius:8px;padding:12px 20px;background:#d6e7ff;color:#102035;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;margin-top:20px}button:disabled{opacity:.4;cursor:default}[hidden]{display:none!important}#status{white-space:pre-wrap;font-size:14px;color:#b9c9de}footer{border-top:1px solid #293348;margin-top:24px;padding-top:18px;font-size:13px;color:#889db9}code{color:#dbe8ff}</style></head><body><main>
<small>LIFE USER / SOLAR TIME</small><h1>v0.13 → v0.14</h1><p>기존 실행 HTML의 행성 이미지와 기능은 유지하고, 렌더러와 구면 우주 배경을 교체합니다. 원본 파일은 덮어쓰지 않습니다.</p>
<label>기존 <strong>Solar-Time_v0.13.html</strong> 선택<input id="input" type="file" accept=".html,.htm,text/html"></label>
<button id="convert" disabled>v0.14 실행 파일 만들기</button> <a id="download" class="download" hidden download="Solar-Time_v0.14.html">v0.14 다운로드</a>
<p id="status" role="status">프로젝트의 dist 폴더 안에 있는 v0.13 실행 HTML을 선택하세요.\n사진이 포함된 v0.13 HTML도 사용할 수 있습니다.</p>
<footer>모든 처리는 현재 브라우저 안에서 이루어집니다. 파일 업로드·네트워크 요청·프로그램 설치가 없습니다. 개발용 index.html이나 다른 버전에는 적용하지 않습니다. 저장한 시점은 기존과 같은 브라우저 저장 규칙을 따릅니다.</footer></main>
<script>${escapeScript(text('tools/upgrade-core.js'))}</script>
<script>const payload=${escapeScript(JSON.stringify(payload))};
const input=document.getElementById('input'),button=document.getElementById('convert'),status=document.getElementById('status'),download=document.getElementById('download');let objectURL=null;
function clearOutput(){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}download.hidden=true;download.removeAttribute('href');}
input.addEventListener('change',()=>{clearOutput();button.disabled=!input.files.length;status.textContent=input.files.length?'선택됨: '+input.files[0].name:'v0.13 실행 HTML을 선택하세요.';});
button.addEventListener('click',async()=>{const file=input.files[0];if(!file)return;button.disabled=true;input.disabled=true;clearOutput();try{if(file.size>128*1024*1024)throw Error('128 MB 이하의 HTML을 선택해 주세요.');status.textContent='기존 기능과 행성 이미지를 유지하며 변환 중…';const result=SolarTimeUpgrade.upgrade(await file.text(),payload);objectURL=URL.createObjectURL(new Blob([result.html],{type:'text/html;charset=utf-8'}));download.href=objectURL;download.hidden=false;status.textContent='완료 · 행성/보조 이미지 '+result.materials+'개 유지 · 별 자료 '+result.stars+'개 유지\\n「v0.14 다운로드」를 누른 뒤 새 파일을 Chrome/Edge에서 여세요.';}catch(error){status.textContent='변환하지 않았습니다. '+error.message;}finally{button.disabled=false;input.disabled=false;}});
addEventListener('pagehide',clearOutput);
</script></body></html>`;
const target=path.join(root,'SolarTime_Update_v0.14.html');fs.writeFileSync(target,html);console.log('Built '+target);
