from pathlib import Path
import json, hashlib, sys

root = Path(sys.argv[1]).resolve()
changes = {}
def load(name):
    return (root/name).read_text(encoding='utf-8')
def save(name, text):
    assert text != load(name), 'No change: '+name
    (root/name).write_text(text, encoding='utf-8', newline='\n')
    changes[name] = hashlib.sha256((root/name).read_bytes()).hexdigest()
def replace_one(text, old, new):
    assert text.count(old) == 1, 'Expected exactly one anchor: '+old[:100]
    return text.replace(old, new, 1)

assert json.loads(load('version.json')) == {'version':'0.48','revision':'r2'}, 'Wrong base release'
name='src/renderer.js'
s=load(name)
a=s.index('    newRandomRotation(generation) {')
b=s.index('    beginAutoRotation(', a)
s=s[:a]+'''    newRandomRotation(generation) {
      // Choose ONE direction per OFF -> ON. Keep it through manual input,
      // camera tweens and suspension; only re-enabling samples another heading.
      // This RNG is independent of the star pool and never runs in the frame loop.
      const heading=random(Math.floor(Math.random()*4294967296)>>>0)()*TAU;
      return Object.freeze({generation,heading,
        yawRate:Math.cos(heading)*AUTO_ROTATE_SPEED,
        pitchRate:Math.sin(heading)*AUTO_ROTATE_SPEED});
    }
    advanceRandomRotation(seconds) {
      const path=this.randomRotation;if(!path||!Number.isFinite(seconds)||seconds<=0)return false;
      // Fixed unit heading at the SAME speed as left/right. No timer, easing,
      // segment changes or frame-by-frame random sampling. Retain the stall cap.
      const dt=Math.min(.25,seconds);
      this.camera.azimuth=A.wrap(this.camera.azimuth+path.yawRate*dt);
      this.camera.elevation=normalizeElevation(this.camera.elevation+path.pitchRate*dt);
      this.dirty=true;return true;
    }
'''+s[b:]
save(name,s)

for name in ['index.html','src/app.js','src/runtime-optimizations.css','tests/cleanup-contracts.test.cjs','tests/modules.test.cjs','tests/v046-release.test.cjs']:
    s=load(name)
    s=s.replace('0.48-r2','0.48-r3').replace("version:'0.48',revision:'r2'","version:'0.48',revision:'r3'")
    if name=='src/runtime-optimizations.css':s=replace_one(s,'--solar-layout-revision:r2','--solar-layout-revision:r3')
    if name=='tests/v046-release.test.cjs':s=s.replace('name="solar-time-revision" content="r2"','name="solar-time-revision" content="r3"')
    if name=='tests/modules.test.cjs':s=s.replace('--solar-layout-revision:r2','--solar-layout-revision:r3')
    if name=='index.html':s=replace_one(s,'name="solar-time-revision" content="r2"','name="solar-time-revision" content="r3"')
    save(name,s)
save('version.json',json.dumps({'version':'0.48','revision':'r3'},indent=2)+'\n')

name='src/release-notes.js'
s=load(name);a=s.index(' const DATA=')+len(' const DATA=');b=s.index(';\n const RELEASES=',a)
data=json.loads(s[a:b]);assert data[0]['version']=='0.48'
messages={
'kor':'랜덤 회전은 켤 때 방향을 한 번 정하고, 끌 때까지 좌·우 회전과 같은 초당 1.8도로 그 방향을 유지합니다. 다시 켜면 새 방향을 정합니다.',
'en':'Random rotation chooses one direction when switched on and keeps it at the same 1.8°/s speed as left/right until switched off. Switching it on again chooses a new direction.',
'chn':'随机旋转在开启时选定一个方向，并以与左右旋转相同的每秒1.8°沿该方向持续转动，直到关闭。再次开启时重新选择方向。',
'jpn':'ランダム回転はオンにしたときに一つの方向を選び、オフにするまで左右回転と同じ毎秒1.8°でその方向に回り続けます。再びオンにすると新しい方向を選びます。',
'hi':'रैंडम घुमाव चालू करते समय एक दिशा चुनता है और बंद होने तक बाएँ/दाएँ घुमाव जैसी 1.8° प्रति सेकंड गति से उसी दिशा में चलता रहता है। दोबारा चालू करने पर नई दिशा चुनी जाती है।',
'es':'La rotación aleatoria elige una dirección al activarse y la mantiene a 1,8°/s, igual que el giro a izquierda/derecha, hasta desactivarse. Al activarla de nuevo, elige otra dirección.',
'de':'Die Zufallsrotation wählt beim Einschalten eine Richtung und behält sie mit denselben 1,8°/s wie die Links-/Rechtsdrehung bis zum Ausschalten bei. Erneutes Einschalten wählt eine neue Richtung.',
'fr':'La rotation aléatoire choisit une direction à l’activation et la conserve à 1,8°/s, comme la rotation gauche/droite, jusqu’à sa désactivation. Une nouvelle activation choisit une nouvelle direction.',
'pt':'A rotação aleatória escolhe uma direção ao ser ativada e mantém-na a 1,8°/s, como a rotação à esquerda/direita, até ser desativada. Ao ativá-la novamente, escolhe uma nova direção.',
'it':'La rotazione casuale sceglie una direzione all’attivazione e la mantiene a 1,8°/s, come la rotazione a sinistra/destra, fino alla disattivazione. Alla successiva attivazione sceglie una nuova direzione.',
'id':'Rotasi acak memilih satu arah saat diaktifkan dan terus berputar ke arah itu pada 1,8°/detik, sama seperti putaran kiri/kanan, hingga dimatikan. Mengaktifkannya kembali memilih arah baru.',
'nl':'Willekeurige rotatie kiest bij het inschakelen één richting en behoudt die met dezelfde 1,8°/s als links/rechts draaien totdat u de rotatie uitschakelt. Opnieuw inschakelen kiest een nieuwe richting.'
}
assert set(messages)==set(data[0]['localized'])
for code,text in messages.items():
    # Replace only the current rotation sentence, preserving historical bytes.
    old=json.dumps(data[0]['localized'][code][1],ensure_ascii=False)
    new=json.dumps(text,ensure_ascii=False)
    s=replace_one(s,old,new)
save(name,s)
name='CHANGELOG.md'
save(name,replace_one(load(name),'# Maintenance changelog\n','# Maintenance changelog\n\n## v0.48 r3 · 2026-09-19\n\n- Clarified random rotation: choose one yaw/pitch direction on each OFF-to-ON activation and keep that direction until OFF. Re-enabling selects a new direction.\n- Keep the same 1.8 degrees/second speed as left/right, with no direction-change timer or easing.\n- Preserve the direction through manual input, wheel/preset transitions and tab suspension.\n- No changes to stars, palette, 250x country view, camera limits, shared card styling, iPhone layout, icons or R2 media.\n'))

name='tests/camera-motion.test.cjs';s=load(name)
s=replace_one(s,'M.random=()=>seed;',"M.random=()=>typeof seed==='function'?seed():seed;")
s=replace_one(s,'random angles are frame-rate independent across many segment boundaries','fixed random direction is frame-rate independent across multiple full revolutions')
s=replace_one(s,'random angular speeds remain bounded and continuous at direction changes','fixed random angular speed remains identical to left/right over long runs')
a=s.index("test('random heading turns through an opposite direction without slowing through zero',()=>{")
b=s.index("test('manual release and tween completion",a)
s=s[:a]+'''test('one sampled direction stays fixed for ten minutes, across the former 8-16 second turns',()=>{
 const {r}=renderer();r.setRandomRotate(true,0);const path=r.randomRotation,beforePath=plain(path);
 assert.ok(Object.isFrozen(path));close(Math.hypot(path.yawRate,path.pitchRate)/A.DEG,1.8);
 let previous=plain(r.camera);
 for(let i=1;i<=600*60;i++){
  r.advanceAutoRotate(i*1000/60);
  close(wrapDelta(r.camera.azimuth,previous.azimuth)*60,path.yawRate);
  close(wrapDelta(r.camera.elevation,previous.elevation)*60,path.pitchRate);
  previous=plain(r.camera);
 }
 assert.equal(r.randomRotation,path);assert.deepEqual(plain(path),beforePath);
});
test('only a fresh activation samples another direction; frames and repeated ON do not',()=>{
 let samples=0;const seeds=[.127694,.75,.25];const {r}=renderer(()=>seeds[samples++]);
 r.setRandomRotate(true,0);const first=r.randomRotation;assert.equal(samples,1);
 for(let i=1;i<=1200;i++)r.advanceAutoRotate(i*1000/60);
 r.setRandomRotate(true,20000);r.rotateViewBy(.02,-.04,20000);
 r.animateHome(20000,1000);r.advanceCamera(21000);
 assert.equal(samples,1);assert.equal(r.randomRotation,first);
 r.setRandomRotate(false,21000);const stopped=plain(r.camera);r.advanceAutoRotate(30000);
 assert.deepEqual(plain(r.camera),stopped);
 r.setRandomRotate(true,30000);assert.equal(samples,2);assert.notEqual(r.randomRotation.heading,first.heading);
 const second=r.randomRotation;r.setAutoRotate(1,30000);assert.equal(samples,2);
 r.setRandomRotate(true,30000);assert.equal(samples,3);assert.notEqual(r.randomRotation.heading,second.heading);
});
test('manual drag, zoom, presets and tab suspension retain the same signed yaw/pitch rates',()=>{
 const {r,now}=renderer();r.setRandomRotate(true,0);const path=r.randomRotation;
 const advance=mono=>{const before=plain(r.camera);r.advanceAutoRotate(mono+20);close(wrapDelta(r.camera.azimuth,before.azimuth),path.yawRate*.02);close(wrapDelta(r.camera.elevation,before.elevation),path.pitchRate*.02);assert.equal(r.randomRotation,path);};
 r.rotateViewBy(.1,2,100);advance(100);
 r.smoothZoom(350,null,200);r.advanceCamera(400);advance(400);
 r.animateHome(500,1000);r.advanceCamera(1500);advance(1500);
 now(1520);r.suspend();r.advanceAutoRotate(60000);advance(60000);
});
'''+s[b:]
save(name,s)

name='tests/browser/ui-regression.py';s=load(name)
s=replace_one(s,'window.__rotationSpeed={seconds:0,travel:0,frames:0};','window.__rotationSpeed={seconds:0,travel:0,frames:0};\n  window.__fixedDirectionErrors=[];')
s=replace_one(s,'    __rotationSpeed.frames++;','''    __rotationSpeed.frames++;
    if(old.direction===2){
     const path=this.randomRotation,t=Math.min(.25,dt);
     __fixedDirectionErrors.push(Math.max(Math.abs(delta(this.camera.azimuth,a)/t-path.yawRate),Math.abs(delta(this.camera.elevation,e)/t-path.pitchRate)));
    }''')
s=replace_one(s," check(page.evaluate('SolarAssets.starData===__starPoolBefore'),tag+' random toggle never regenerates stars')",''' check(page.evaluate('SolarAssets.starData===__starPoolBefore'),tag+' random toggle never regenerates stars')
 check(page.evaluate('Object.isFrozen(SolarTime.renderer.randomRotation)'),tag+' chosen rotation direction is immutable')
 check(page.evaluate('__fixedDirectionErrors.length>=5 && __fixedDirectionErrors.every(e=>Number.isFinite(e)&&e<1e-7)'),tag+' every real frame follows the selected fixed direction')''')
s=replace_one(s," after_drag=page.evaluate('({...SolarTime.renderer.camera})');page.wait_for_timeout(300)"," after_drag=page.evaluate('({...SolarTime.renderer.camera})');page.wait_for_timeout(300)\n check(page.evaluate('__fixedDirectionErrors.every(e=>Number.isFinite(e)&&e<1e-7)'),tag+' same direction survives manual control and resumes without reselecting')")
save(name,s)

print(json.dumps(changes,indent=2))
