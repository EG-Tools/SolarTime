'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
function replace(file,before,after){const s=fs.readFileSync(file,'utf8');if(s.split(before).length!==2)throw Error('Unexpected source: '+file);fs.writeFileSync(file,s.replace(before,after));}
for(const [file,sha] of Object.entries({'src/app.js':'88a4d2542bb304b8c72207b7964ad72a13ae0714','src/timer-controller.js':'f9a0090413d705afc265e3481ec9e1ff5113cc81'})){
 const b=Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'));if(crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')!==sha)throw Error('Base source changed: '+file);
 fs.writeFileSync(file,b);
}
replace('src/timer-controller.js','shutdownBridge,onOpen=()=>{},shouldKeepOpen=()=>false','shutdownBridge,onAlarmStart=()=>{},onOpen=()=>{},shouldKeepOpen=()=>false');
replace('src/timer-controller.js','save();sync();ringing=true;startTone();if(!alarmDialog.open)',"save();sync();ringing=true;try{onAlarmStart();}catch(error){root.console?.warn?.('Alarm start hook failed',error);}startTone();if(!alarmDialog.open)");
replace('src/timer-controller.js',"state.alarm.minutes=5;schedule('alarm',{quiet:true});","state.alarm.minutes=5;setFields('alarm');schedule('alarm',{quiet:true});");
replace('src/app.js','shutdownBridge:Modules.WindowsShutdown.create(document),onOpen:','shutdownBridge:Modules.WindowsShutdown.create(document),onAlarmStart:()=>setMusicEnabled(false),onOpen:');
const versionFiles=[...fs.readdirSync('.').filter(n=>n.endsWith('.html')),'src/app.js','version.json','package.json','package-lock.json',...fs.readdirSync('tests').filter(n=>n.endsWith('.test.cjs')).map(n=>'tests/'+n)];
for(const file of versionFiles){const s=fs.readFileSync(file,'utf8'),next=s.replace(/0\.0\.57/g,'0.0.58').replace(/0\.57/g,'0.58').replaceAll('0\\.57','0\\.58');if(next!==s)fs.writeFileSync(file,next);}
replace('tests/v046-release.test.cjs',"['0.58','0.56','0.55','0.54','0.53','0.52','0.51']","['0.58','0.57','0.56','0.55','0.54','0.53','0.52']");
const notes={kor:['알람이 울리기 직전에 배경음악을 끄고 음악 버튼도 OFF 상태로 전환합니다.','알람을 끄거나 미뤄도 배경음악은 자동으로 다시 켜지지 않습니다. 기본 알람과 사용자 알람에 동일하게 적용합니다.','5분 미루기가 이전 입력 시간을 다시 사용하는 오류를 수정했습니다. 알람음 미리 듣기는 음악 상태를 바꾸지 않습니다.'],en:['An alarm switches background music and its button OFF before the first tone.','Stopping or snoozing an alarm never restarts the music automatically; default and custom sounds behave alike.','Fixed snooze reusing the previous delay instead of five minutes. Sound previews leave background music unchanged.']};
const release={version:'0.58',date:'2026.09.25',localized:Object.fromEntries(['kor','en','chn','zht','jpn','hi','es','de','fr','pt','it','id','nl'].map(c=>[c,notes[c]||notes.en]))};
replace('src/release-notes.js',' const RELEASE_057=',' const RELEASE_058='+JSON.stringify(release)+';\n const RELEASE_057=');
replace('src/release-notes.js','DATA.unshift(RELEASE_057,','DATA.unshift(RELEASE_058,RELEASE_057,');
fs.writeFileSync('CHANGELOG.md','# v0.58 r1 — alarm music OFF\n\n- Stop background music through its shared controller before alarm playback. Keep the music button OFF after stop/snooze.\n- Correct the five-minute snooze delay and test default/custom alarms, previews and pending music playback.\n- Windows shutdown helper and Cloudflare receipt API are unchanged; no PC helper reinstall is required.\n\n'+fs.readFileSync('CHANGELOG.md','utf8'));
fs.unlinkSync('.maintenance/apply-alarm-v058.cjs');
