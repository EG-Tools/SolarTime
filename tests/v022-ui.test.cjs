const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v0.22 uses one persistent timezone element',()=>{
  const html=read('index.html'),app=read('src/app.js');
  assert.match(html,/id="timezone-button"/);
  assert.doesNotMatch(html,/timezone-readout/);
  assert.doesNotMatch(app,/timezone-readout/);
  assert.match(app,/SEOUL\/UTC never swaps or disappears/);
});

test('clock font choices are expanded without bundled font files',()=>{
  const html=read('index.html'),app=read('src/app.js');
  for(const v of ['segoe-variable','calibri','corbel','candara','century','trebuchet','georgia','times','cascadia','lucida']){
    assert.match(html,new RegExp(`value="${v}"`));
    assert.match(app,new RegExp(`["']?${v.replace('-','\\-')}["']?\\s*:`));
  }
  assert.doesNotMatch(html,/\.woff2?|\.ttf|\.otf/i);
});

test('clock colon spacing and zen SEOUL visibility are explicit',()=>{
  const css=read('styles-v016.css');
  assert.match(css,/\.wall-clock \.colon\{margin-left:10px;margin-right:10px\}/);
  assert.match(css,/body\.zen #timezone-button\{display:inline-block!important;visibility:visible!important;opacity:1!important\}/);
});

test('all public version labels match package',()=>{
  const html=read('index.html'),pkg=JSON.parse(read('package.json')),app=read('src/app.js'),v=pkg.version.split('.').slice(1).join('.');
  assert.ok(html.includes('Solar Time v'+v));
  assert.ok(app.includes("version:'"+v+"'"));
});


test('surface resume is not called in every draw frame',()=>{
  const renderer=read('src/renderer.js'),app=read('src/app.js');
  const drawStart=renderer.indexOf('draw(ms,seconds');
  const drawEnd=renderer.indexOf('hit(x,y)',drawStart);
  assert.ok(drawStart>=0&&drawEnd>drawStart);
  assert.doesNotMatch(renderer.slice(drawStart,drawEnd),/this\.resume\(\)/);
  assert.match(app,/visibilitychange[\s\S]*renderer\.resume\(\)/);
  assert.match(app,/pageshow[\s\S]*renderer\.resume\(\)/);
});
