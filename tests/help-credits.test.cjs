'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const help=html.slice(html.indexOf('<dialog id="help-dialog"'),html.indexOf('<dialog id="kakao-pay-dialog"'));
const background='<span id="background-music-credit" class="music-credit support-credit">BACKGROUND MUSIC SUNO AI - <a id="background-music-author" class="contact-email" href="https://suno.com/@lyrikey" target="_blank" rel="noopener noreferrer">Lyrikey</a></span>';
const alarm='<span id="alarm-music-credit" class="music-credit support-credit">Alram Music - <a id="alarm-music-author" class="contact-email" href="https://pixabay.com/ko/users/marmixer-6762941/" target="_blank" rel="noopener noreferrer">Maryan Dembitskyi</a></span>';
test('help credits preserve exact requested wording, author URLs and safe new-tab attributes',()=>{
 assert.ok(help.includes(background));assert.ok(help.includes(alarm));
 for(const id of ['background-music-credit','background-music-author','alarm-music-credit','alarm-music-author'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
});
test('alarm credit directly follows background credit without replacing support or identity',()=>{
 assert.ok(help.includes(background+alarm+'<span class="support-identity">'));
 assert.ok(help.includes('mailto:Lyrikey@Naver.com'));
 assert.doesNotMatch(help,/BACKGROUND MUSIC · SUNO AI/);
});
