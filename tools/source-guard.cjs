/* Published render tiers must not silently become original masters. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function assertOriginal(root,file,manifest){
 const source=path.basename(file),entry=Object.values(manifest?.materials||{}).find(e=>e.source===source);
 const bytes=fs.readFileSync(file),sha256=digest(bytes);
 if(entry?.seamBaked&&entry.tiers?.some(t=>t.sha256===sha256))throw Error(source+' matches a published seam-baked render tier. Supply the original master.');
 return {bytes:bytes.length,sha256};
}
function validatePackage(root,descriptor){
 if(descriptor?.kind!=='originals'||descriptor.schema!==1||!Array.isArray(descriptor.files)||!descriptor.files.length)throw Error('Not an original-source package.');
 const seen=new Set(),realRoot=fs.realpathSync(root);
 return descriptor.files.map(entry=>{
  if(typeof entry.path!=='string'||entry.path.includes('\\')||entry.path.split('/').some(s=>!s||s==='.'||s==='..')||path.isAbsolute(entry.path)||seen.has(entry.path))throw Error('Unsafe/duplicate source path.');
  if(!/^[a-f0-9]{64}$/.test(entry.sha256)||!Number.isSafeInteger(entry.bytes)||entry.bytes<1)throw Error('Invalid source checksum/size.');
  if(!/^(?:[a-z0-9_-]+\.webp|music\/[^/]+\.mp3)$/i.test(entry.path))throw Error('Unsupported original source path.');
  seen.add(entry.path);const file=path.join(root,...entry.path.split('/'));
  if(!fs.realpathSync(file).startsWith(realRoot+path.sep))throw Error('Source escaped its package.');
  let cursor=root;for(const part of entry.path.split('/')){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())throw Error('Source paths must not contain symlinks.');}
  if(!fs.lstatSync(file).isFile())throw Error('Source must be a regular file.');
  const bytes=fs.readFileSync(file);if(bytes.length!==entry.bytes||digest(bytes)!==entry.sha256)throw Error('Source checksum mismatch: '+entry.path);
  return {entry,file,bytes};
 });
}
module.exports={digest,assertOriginal,validatePackage};
