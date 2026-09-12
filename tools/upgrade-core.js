/* Pure text/JSON patcher. Never evaluates scripts from the selected HTML. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SolarTimeUpgrade=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const escapeScript=code=>code.replace(/<\/script/gi,'<\\/script');
 function upgrade(html,payload){
  if(typeof html!=='string'||html.length>128*1024*1024)throw Error('128 MB 이하의 v0.13 HTML을 선택해 주세요.');
  if(!payload||typeof payload.skySource!=='string'||typeof payload.rendererSource!=='string'||!/^data:image\/webp;base64,/.test(payload.skyImage))throw Error('업데이트 자료가 손상되었습니다. 도구를 다시 받아 주세요.');
  if(/<script\b[^>]*\bsrc\s*=/i.test(html))throw Error('개발용 index.html이 아닌 dist/Solar-Time_v0.13.html을 선택해 주세요.');
  const scripts=[];const pattern=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;let match;
  while((match=pattern.exec(html)))scripts.push({start:match.index,end:pattern.lastIndex,attrs:match[1],code:match[2]});
  const only=(test,label)=>{const found=scripts.filter(test);if(found.length!==1)throw Error(label+' 영역을 찾지 못했습니다. 원본 v0.13 실행 HTML인지 확인해 주세요.');return found[0];};
  const assets=only(s=>/\bid\s*=\s*["']solar-assets["']/i.test(s.attrs),'내장 이미지');
  const sky=only(s=>/\broot\.SolarSky\s*=\s*Sky\b/.test(s.code),'우주 배경');
  const renderer=only(s=>/\bwindow\.SolarRenderer\s*=\s*Renderer\b/.test(s.code),'렌더러');
  if(!/Solar Time v0\.13\b/.test(renderer.code))throw Error('이 업데이트는 v0.13 전용입니다. 다른 버전에는 적용하지 않습니다.');
  const json=assets.code.match(/\bwindow\.SolarAssets\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if(!json)throw Error('내장 이미지의 JSON 형식을 읽을 수 없습니다.');
  let data;try{data=JSON.parse(json[1]);}catch(_){throw Error('내장 이미지 JSON이 손상되었습니다.');}
  if(!data||!data.materials||typeof data.materials!=='object'||Array.isArray(data.materials)||!Array.isArray(data.stars))throw Error('기존 행성 이미지 또는 별 자료가 없습니다.');
  data.sky=payload.skyImage;
  const replacements=[{...assets,replacement:'window.SolarAssets='+JSON.stringify(data)+';'},
    {...sky,replacement:payload.skySource},{...renderer,replacement:payload.rendererSource}];
  replacements.sort((a,b)=>b.start-a.start);
  for(const item of replacements){const code='<script'+item.attrs+'>\n'+escapeScript(item.replacement)+'\n<'+ '/script>';html=html.slice(0,item.start)+code+html.slice(item.end);}
  // UI credits and the photo-export filename; all storage keys remain unchanged.
  html=html.replace(/v0\.13(?!\d)/g,'v0.14');
  return {html,materials:Object.keys(data.materials).length,stars:data.stars.length,version:'0.14'};
 }
 return {upgrade};
});
