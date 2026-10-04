'use strict';
function wav({seconds=1,channels=2,rate=8000,bits=16}={}){
 const align=channels*bits/8,data=Math.round(seconds*rate)*align,bytes=Buffer.alloc(44+data);bytes.write('RIFF');bytes.writeUInt32LE(36+data,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(channels,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*align,28);bytes.writeUInt16LE(align,32);bytes.writeUInt16LE(bits,34);bytes.write('data',36);bytes.writeUInt32LE(data,40);return new Blob([bytes],{type:'audio/wav'});
}
module.exports={wav};
