'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('clock size uses the shared slider and the requested settings order',()=>{
 const html=read('index.html'),ids=['star-density','clock-size','clock-font','show-seconds','show-labels','avoid-labels','show-moon','show-pluto','show-comets'];
 let previous=-1;for(const id of ids){const index=html.indexOf('id="'+id+'"');assert.ok(index>previous,id);previous=index;}
 assert.match(html,/id="clock-size" class="solar-range" type="range" min="50" max="200" step="5" value="100"/);
 assert.doesNotMatch(html,/id="hour-cycle"/);
 assert.match(html,/<main class="clock-face">[\s\S]*class="date-line"[\s\S]*class="scene-status ui"[\s\S]*<\/main>/);
});

test('clock size is restored, persisted, reset and applied through one CSS scale',()=>{
 const app=read('src/app.js'),css=read('styles.css'),runtimeCss=read('src/runtime-optimizations.css');
 assert.match(app,/A\.clamp\(saved\.clockSize,\.5,2\)/);
 assert.match(app,/clockSize,clockFont/);
 assert.match(app,/clockSize=1;clockFont='georgia'/);
 assert.match(app,/setProperty\('--clock-scale',String\(clockSize\)\);scheduleClockFit\(\)/);
 assert.match(app,/function fitClockToViewport\(\)/);
 assert.match(app,/availableHalf\/requiredHalf/);
 assert.match(app,/dataset\.fitScale=String\(rounded\)/);
 assert.doesNotMatch(app,/\$\('hour-cycle'\)/);
 assert.match(css,/--clock-scale:1;--clock-fit-scale:1;--clock-base-size:78px/);
 assert.match(css,/font-size:calc\(var\(--clock-base-size\)\*var\(--clock-scale\)\*var\(--clock-fit-scale\)\)/);
 assert.match(css,/\.date-line\{font-size:12px;margin-top:3px\}/);
 assert.doesNotMatch(css,/@media\(max-width:680px\)\{\.date-line\{font-size:11px;margin-top:/);
 assert.match(runtimeCss,/#star-density-control,#clock-size-control\{border-top:0;margin-top:0;padding-top:5px\}/);
 assert.match(runtimeCss,/\.clock-face \.scene-status\{position:static;left:auto;transform:none;justify-content:center;margin-top:12px\}/);
});

test('every supported locale translates clock size',()=>{
 for(const file of fs.readdirSync(path.join(root,'src','locales')).filter(name=>name.endsWith('.json'))){
  const data=JSON.parse(read(path.join('src','locales',file)));assert.equal(typeof data.copy.clockSize,'string',file);assert.ok(data.copy.clockSize.trim(),file);
 }
});
