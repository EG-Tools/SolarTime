const test=require('node:test'),assert=require('node:assert/strict');
const {hash,sync}=require('../tools/code-revisions.cjs');
test('binary identity keeps byte distinctions while text normalizes line endings',()=>{
 const a=Buffer.from([0x80,13,10]),b=Buffer.from([0x81,13,10]);
 assert.equal(a.toString('utf8'),b.toString('utf8'));assert.notEqual(hash(a),hash(b));
 assert.notEqual(hash(Buffer.from([13,10])),hash(Buffer.from([10])));
 assert.equal(hash('a\r\nb\r'),hash('a\nb\n'));
});
test('generated build identity is stable after cache synchronization',()=>assert.deepEqual(sync(require('node:path').resolve(__dirname,'..')),[]));
