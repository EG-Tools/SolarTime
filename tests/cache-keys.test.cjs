'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');

test('the large sky runtime uses a content-derived cache key',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=fs.readFileSync(path.join(root,'src','sky.js'));
  const expected=crypto.createHash('sha256').update(source).digest('hex').slice(0,12);
  const match=html.match(/src\/sky\.js\?v=([a-f0-9]{12})/);
  assert.ok(match,'sky.js must use a 12-character content cache key');
  assert.equal(match[1],expected,'sky.js cache key must change whenever its bytes change');
});
