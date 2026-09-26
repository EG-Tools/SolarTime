'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function moduleFrom(file){const context={window:{SolarModules:{}}};for(const dependency of ['src/alarm-sound.js'])vm.runInNewContext(read(dependency),context);vm.runInNewContext(read(file),context,{filename:file});return context.window.SolarModules;}

test('top actions follow music, language, timer, settings, help and fullscreen order',()=>{
 const html=read('index.html'),ids=['music-toggle','language-toggle','timer-button','settings-button','help-button','fullscreen-button'];
 let previous=-1;for(const id of ids){const index=html.indexOf('id="'+id+'"');assert.ok(index>previous,id);previous=index;}
});

test('timer provides exclusive sound choices, alarm actions and a zen-safe shutdown countdown',()=>{
 const html=read('index.html'),code=read('src/timer-controller.js');
 assert.match(html,/name="alarm-sound-mode" value="default" checked/);
 assert.match(html,/name="alarm-sound-mode" value="custom"/);
 assert.match(html,/accept="audio\/\*,\.mp3,\.wav,\.ogg,\.m4a,\.aac,\.flac,\.opus"/);
 assert.match(html,/id="alarm-snooze"/);assert.match(html,/id="alarm-stop"/);
 assert.doesNotMatch(code,/bindDialog\(alarmDialog,[^\n]+backdrop:false/);
 assert.match(code,/document\.addEventListener\('pointerdown',closeOnViewport\)/);
 assert.match(code,/shouldKeepOpen\(event\)/);assert.match(read('src/app.js'),/shouldKeepOpen:event=>\$\('help-dialog'\)\.open\|\|\$\('help-button'\)\.contains\(event\.target\)/);
 assert.match(code,/if\(downloadDialog\.open\|\|installDialog\.open\|\|removeDialog\.open\|\|alarmDialog\.open\|\|shutdownDialog\.open\|\|shouldKeepOpen\(event\)\)return/);
 assert.match(code,/!panel\.contains\(event\.target\)&&!button\.contains\(event\.target\)/);
 assert.match(html,/id="shutdown-countdown">10</);assert.match(html,/id="shutdown-cancel"/);
 assert.doesNotMatch(html,/id="shutdown-helper-download"/);assert.match(html,/id="shutdown-helper-progress"/);
 assert.match(code,/state\.helperProgress=50/);assert.match(code,/state\.helperProgress=100/);
 assert.match(html,/id="shutdown-helper-download-dialog"/);assert.match(html,/id="shutdown-helper-download-yes"/);assert.match(code,/shutdownBridge\?\.download\?\.\(\)/);assert.doesNotMatch(code,/URL\.createObjectURL/);
 assert.match(html,/id="shutdown-helper-install-dialog"/);assert.match(html,/id="shutdown-helper-install-yes"/);assert.match(code,/nativeResult\('probe'\)/);assert.match(code,/state\.helperConfirmed=true;state\.helperProgress=100;state\.helperEnabled=true/);
 assert.match(code,/pollHelperInstall\(time\)/);assert.match(code,/shutdownBridge\?\.installStatus\?\.\(token\)/);assert.match(code,/state\.helperInstallToken=token/);
 assert.match(code,/state\.helperConfirmed=saved\.helperConfirmed===true/);assert.match(code,/!state\.helperConfirmed&&state\.helperProgress>=100/);
 assert.match(html,/id="shutdown-helper-remove"[^>]+disabled/);assert.match(html,/id="shutdown-helper-remove-dialog"/);assert.match(code,/nativeResult\('uninstall'\)/);
 assert.match(html,/Maryan Dembitskyi - Soft Morning/);assert.doesNotMatch(html,/>Pixabay<\/a>/);assert.equal(moduleFrom('src/timer-controller.js').TimerController.DEFAULT_ALARM_FILE,'00 - Soft Morning.mp3');assert.match(code,/customSource\.loop=true/);
 assert.match(html,/id="alarm-preview-default"[^>]+aria-pressed="false"/);assert.match(html,/id="alarm-preview-custom"[^>]+aria-pressed="false"/);
 assert.match(code,/function togglePreview\(kind\)/);assert.match(code,/source\.onended=/);assert.match(code,/function playDefaultPreview\(request,urls\)/);assert.match(code,/new root\.Audio/);assert.match(code,/else \{stopPreview\(\);UI\.hide\(panel\);\}/);
 const css=read('src/runtime-optimizations.css');assert.match(css,/\.timer-sound-preview>span[^}]+border-left:7px solid currentColor/);assert.match(css,/\.timer-sound-preview\[aria-pressed=true\]>span[^}]+background:currentColor/);assert.match(css,/\.shutdown-helper-install-dialog,\.shutdown-helper-remove-dialog\{[^}]+inset:50% auto auto 50%[^}]+transform:translate\(-50%,-50%\)/);
 assert.doesNotMatch(html,/id="shutdown-dialog"[^>]*class="[^"]*\bui\b/);
 assert.match(code,/remaining>0&&remaining<=10/);assert.match(code,/nativeResult\('cancel'\)/);
});

test('timer duration is capped at 99 hours 59 minutes and all interface languages have timer copy',()=>{
 const timer=moduleFrom('src/timer-controller.js').TimerController;
 assert.equal(timer.totalMinutes(99,59),5999);assert.equal(timer.totalMinutes(120,80),5999);assert.equal(timer.totalMinutes(-4,-2),0);
 const keys=['timer','alarm','scheduledShutdown','defaultAlarmSound','customAlarmSound','shutdownHelper','shutdownUnsupported','shutdownCountdownTitle','cancelShutdown','helperSetup','helperNotInstalled','helperDownloadReady','helperInstallComplete','helperDisabled','helperDownloadTitle','helperDownloadDescription','helperDownloadPrivacy','helperDownloadPermission','helperDownloadSource','helperViewSource','helperDownloadQuestion','helperInstallTitle','helperInstallDescription','helperInstallQuestion','removeHelper','helperRemoveTitle','helperRemoveDescription','helperRemoveQuestion','helperRemoveRequested'];
 for(const code of ['kor','en','chn','zht','jpn','hi','es','de','fr','pt','it','id','nl'])for(const key of keys)assert.ok(JSON.parse(read('src/locales/'+code+'.json')).copy[key],code+' '+key);
});

test('native shutdown bridge is Windows desktop only and clamps shutdown.exe seconds',()=>{
 const bridgeSource=read('src/windows-shutdown.js'),bridge=moduleFrom('src/windows-shutdown.js').WindowsShutdown;
 assert.deepEqual({...bridge.platform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Win32')},{windows:true,mobile:false});
 assert.equal(bridge.platform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)','iPhone').mobile,true);
 assert.equal(bridge.platform('Mozilla/5.0 (X11; Linux x86_64)','Linux x86_64').windows,false);
 const helper=read('windows/SolarTimeShutdownHelper.cmd');
 assert.match(helper,/shutdown\.exe/);assert.match(helper,/359940/);assert.match(helper,/Invoke-ShutdownCommand/);assert.match(helper,/\/s \/t /);assert.match(helper,/\/a/);
 assert.match(helper,/Zone\.Identifier/);assert.match(helper,/Send-HelperReceipt/);assert.match(helper,/Get-HelperRevision/);assert.match(helper,/Save-HelperState/);
 assert.match(helper,/PowerShell\\v1\.0\\powershell\.exe/);assert.doesNotMatch(helper,/shell\.Run|wscript\.exe|WScript\.Sleep/);
 assert.match(helper,/\$Request\.at -le/);assert.match(helper,/\$result\.ok=\(\$code -eq 0\)/);
 const windowsHelper=helper.replace(/\r?\n/g,'\r\n'),hash=require('node:crypto').createHash('sha256').update(windowsHelper).digest('hex').toUpperCase();assert.equal(bridge.HELPER_SHA256,hash);assert.match(bridge.HELPER_URL,/solar-time\.keg0320\.workers\.dev\/media\/releases\/content\/windows\/SolarTimeShutdownHelper\.[a-f0-9]{16}\.cmd/);assert.match(bridge.HELPER_SOURCE_URL,/SolarTimeShutdownHelper\.[a-f0-9]{16}\.source\.txt/);assert.match(read('tools/upload-windows-helper.cjs'),/replace\(\/\\r\?\\n\/g,'\\r\\n'\)/);
 assert.doesNotMatch(bridgeSource,/helperBase64|application\/octet-stream/);assert.match(bridgeSource,/download\(\).*HELPER_URL/);assert.match(bridgeSource,/crypto\?\.getRandomValues/);assert.match(bridgeSource,/installStatus/);assert.match(bridgeSource,/uninstall\(\).*command\('uninstall'\)/);
});

test('Windows helper is an explicit Cloudflare opt-in and is excluded from the static site graph',()=>{
 const html=read('index.html'),controller=read('src/timer-controller.js'),{releaseFiles}=require('../tools/release-files.cjs'),files=releaseFiles(root);
 assert.match(html,/class="timer-helper-label"><label[^>]+>[^<]+<\/label><button id="shutdown-helper-remove"[^>]+disabled[^>]*>[^<]+<\/button><\/div><input id="shutdown-helper-enabled" type="checkbox"/);assert.ok(!files.includes('windows/SolarTimeShutdownHelper.cmd'));
 assert.ok(files.includes('src/timer-controller.js'));assert.ok(files.includes('src/windows-shutdown.js'));
 const build=read('tools/cloudflare-site.cjs');assert.doesNotMatch(build,/windows\/SolarTimeShutdownHelper\.cmd/);const worker=read('cloudflare/worker.js');assert.match(worker,/content-disposition','attachment; filename="SolarTimeShutdownHelper\.cmd"/);assert.match(worker,/x-content-type-options','nosniff'/);
 assert.match(controller,/nativeResult\('uninstall'\)/);assert.match(controller,/await cancel\('shutdown'\)/);assert.match(read('styles.css'),/\.toast\.card-surface\{/);
});
