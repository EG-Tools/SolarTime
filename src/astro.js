/* Solar Time v0.06 | Annual reference + fixed-period loops.
 * Approximate, heliocentric J2000 ecliptic positions, NOT an observing ephemeris.
 * Planet elements: JPL / Standish & Williams, 3000 BC–3000 AD fit, tables 2a/2b.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * UTC is used in place of TDB; Earth uses the Earth–Moon barycenter.
 * Pluto is a fixed, illustrative J2000 Kepler orbit, not a JPL ephemeris.
 * Moon and Europa use mild elliptical mean sidereal models phase-anchored to JPL
 * Horizons state vectors at 2026-09-13 00:00 TDB; no perturbations/eclipses.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarAstro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const J2000 = Date.UTC(2000, 0, 1, 12), MIN_TIME = Date.UTC(1800, 0, 1), MAX_TIME = Date.UTC(2999, 11, 31, 23, 59, 59);
  const round2 = value => Math.round(value*100)/100;
  const round3 = value => Math.round(value*1000)/1000;
  const wrap = (v, m = TAU) => ((v % m) + m) % m;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const J2000_OBLIQUITY=23.4392911*DEG;
  // NASA/NSSDCA J2000 rotational north poles (equatorial RA/Dec, degrees).
  // Pluto's fact sheet specifies the positive pole; the signed retrograde
  // period below uses its antipodal conventional north pole exactly once.
  const ROTATION_POLES=Object.freeze({
    sun:Object.freeze({ra:286.13,dec:63.87}),
    mercury:Object.freeze({ra:281.010,dec:61.414}),
    venus:Object.freeze({ra:272.76,dec:67.16}),
    earth:Object.freeze({ra:0,dec:90}),
    mars:Object.freeze({ra:317.681,dec:52.887}),
    jupiter:Object.freeze({ra:268.057,dec:64.495}),
    saturn:Object.freeze({ra:40.589,dec:83.537}),
    uranus:Object.freeze({ra:257.311,dec:-15.175}),
    neptune:Object.freeze({ra:299.3337,dec:42.9504}),
    pluto:Object.freeze({ra:132.99,dec:-6.16,positive:true})
  });
  // Signed sidereal rotation periods in Earth days, not solar-day lengths.
  // Saturn: Cassini ring-seismology representative period (NASA, 2019).
  // Uranus: Hubble auroral period (NASA, 2025). See README.md for sources.
  const defs = [
    ['mercury','수성','MERCURY', 95, 6.5,'#baa999',87.9691,58.646,0.034,
      [0.38709843,.20563661,7.00559432,252.25166724,77.45771895,48.33961819],
      [0,.00002123,-.00590158,149472.67486623,.15940013,-.12214182]],
    ['venus','금성','VENUS',143,10.5,'#e3bd7c',224.701,-243.025,177.36,
      [.72332102,.00676399,3.39777545,181.97970850,131.76755713,76.67261496],
      [-.00000026,-.00005107,.00043494,58517.81560260,.05679648,-.27274174]],
    ['earth','지구','EARTH',198,17.25,'#73b9ec',365.256,0.99726968,23.439,
      [1.00000018,.01673163,-.00054346,100.46691572,102.93005885,-5.11260389],
      [-.00000003,-.00003661,-.01337178,35999.37306329,.31795260,-.24123856]],
    ['mars','화성','MARS',254,8.5,'#d88762',686.98,1.025957,25.19,
      [1.52371243,.09336511,1.85181869,-4.56813164,-23.91744784,49.71320984],
      [.00000097,.00009149,-.00724757,19140.29934243,.45223625,-.26852431]],
    ['jupiter','목성','JUPITER',344,29,'#d7b59a',4332.589,.41354,3.13,
      [5.20248019,.04853590,1.29861416,34.33479152,14.27495244,100.29282654],
      [-.00002864,.00018026,-.00322699,3034.90371757,.18199196,.13024619],[-.00012452,.06064060,-.35635438,38.35125]],
    ['saturn','토성','SATURN',440,24,'#dbc59b',10759.22,(10*3600+33*60+38)/86400,26.73,
      [9.54149883,.05550825,2.49424102,50.07571329,92.86136063,113.63998702],
      [-.00003065,-.00032044,.00451969,1222.11494724,.54179478,-.25015002],[.00025899,-.13434469,.87320147,38.35125]],
    ['uranus','천왕성','URANUS',533,16.5,'#9ed7dc',30685.4,-(17*3600+14*60+52)/86400,97.77,
      [19.18797948,.04685740,.77298127,314.20276625,172.43404441,73.96250215],
      [-.00020455,-.00001550,-.00180155,428.49512595,.09266985,.05739699],[.00058331,-.97731848,.17689245,7.67025]],
    ['neptune','해왕성','NEPTUNE',625,16,'#5389ef',60189,.67125,28.32,
      [30.06952752,.00895439,1.77005520,304.22289287,46.68158724,131.78635853],
      [.00006447,.00000818,.00022400,218.46515314,.01009938,-.00606302],[-.00041348,.68346318,-.10162547,7.67025]],
    ['pluto','명왕성','PLUTO',718,5,'#c8ada0',90560,-6.38723,119.51,
      [39.482,.2488,17.14,238.929,224.069,110.304],
      [0,0,0,360*36525/90560,0,0]]
  ];
  const descriptions = {
    mercury:'태양에 가장 가까운 작은 암석 행성. 빠른 공전이 이 태양계의 가장 짧은 한 해를 만듭니다.',
    venus:'두꺼운 구름으로 덮인 금성. 다른 행성 대부분과 반대 방향으로 아주 천천히 자전합니다.',
    earth:'우리가 시간을 세는 푸른 행성. 곁의 달은 지구와 함께 태양 주위를 여행합니다.',
    mars:'산화철이 붉게 물들인 이웃 행성. 지구보다 긴 한 해를 가집니다.',
    jupiter:'태양계에서 가장 큰 행성. 띠 모양의 구름과 거대한 소용돌이를 표현했습니다.',
    saturn:'얼음과 암석 입자의 고리가 둘러싼 행성. 고리의 앞뒤가 행성과 함께 입체적으로 겹칩니다.',
    uranus:'청록색 얼음 거대 행성. 옆으로 누운 듯한 자전축과 옅은 고리가 특징입니다.',
    neptune:'짙은 푸른색의 가장 바깥쪽 행성. 한 번의 공전에 약 165년이 걸립니다.',
    pluto:'행성이 아닌 왜행성입니다. 기울어진 타원 궤도는 고정된 평균 요소로 개략적으로 표현합니다.'
  };
  const BODIES = defs.map(([id,ko,en,orbit,size,color,period,spin,tilt,base,rates,correction]) =>
    Object.freeze({id,ko,en,orbit,size,color,period:round2(period*86400)/86400,
      periodSeconds:round2(period*86400),spin:round2(spin*86400)/86400,spinSeconds:round2(spin*86400),
      referenceSpinDays:spin,tilt:round3(tilt),base:Object.freeze(base),rates:Object.freeze(rates),
      correction:correction&&Object.freeze(correction),description:descriptions[id]}));
  const SUN = Object.freeze({id:'sun',ko:'태양',en:'SUN',size:28,color:'#ffb753',spin:25.38,spinSeconds:2192832,referenceSpinDays:25.38,tilt:7.25,
    description:'태양계의 중심. 표면의 입상 조직과 부드러운 샤인은 감상을 위한 시각 효과입니다.'});
  // Lunar display-orbit radius is in reference-screen units, like body sizes.
  // It is intentionally independent of Earth's display radius (not a physical distance).
  const MOON = Object.freeze({id:'moon',ko:'달',en:'MOON',size:3.9,displayOrbit:30,color:'#d0ced0',period:2360591.51/86400,periodSeconds:2360591.51,spin:2360591.51/86400,spinSeconds:2360591.51,referenceSpinDays:27.321661,tilt:6.68,
    parent:'earth',description:'지구를 약 27.32일에 한 바퀴 도는 유일한 자연 위성. 현재 시뮬레이션 시각의 공전 위치를 표시하며 거리와 크기는 보기 편하게 확대했습니다.'});
  const EUROPA = Object.freeze({id:'europa',ko:'유로파',en:'EUROPA',size:3.8,displayOrbit:45,color:'#d8c89c',period:3.551181,periodSeconds:306822.04,spin:3.551181,spinSeconds:306822.04,referenceSpinDays:3.551181,tilt:.1,
    parent:'jupiter',description:'갈릴레오 위성 중 하나인 얼음 세계. 목성을 약 3.55일에 돌며 현재 시뮬레이션 시각의 공전 위치를 표시합니다.'});
  const SATELLITES=Object.freeze([MOON,EUROPA]);
  // One local reference owner. A frame does not numerically integrate its predecessor:
  // any timestamp (seek, reopen, sleep, leap year) gives the same phase directly.
  // The saved period is seconds to TWO decimals, never degrees/second rounded to 0.
  // Reference elements are evaluated once at startup/explicit seek, and at a UTC year boundary.
  // No fetch, online status check, remote clock, retry or network timeout is involved.
  const ALL=[SUN,...BODIES,...SATELLITES],axesCache=new Map();
  let annual=null,yearBuilds=0,referenceEvaluations=0;
  function referenceRotation(body,ms) {
    if(body.id==='earth')return wrap((280.46061837+360.98564736629*(ms-J2000)/DAY)*DEG);
    return wrap((ms-J2000)/(DAY*body.referenceSpinDays),1)*TAU;
  }
  function calibrateAt(ms) {
    if(!Number.isFinite(ms))throw new TypeError('A finite timestamp is required.');
    const year=new Date(ms).getUTCFullYear(),start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);
    const orbits=new Map(BODIES.map(body=>{referenceEvaluations++;return [body.id,referenceElementsAt(body,ms)];}));
    const spins=new Map(ALL.map(body=>[body.id,referenceRotation(body,ms)]));
    annual={year,start,end,epoch:ms,orbits,spins};yearBuilds++;return modelStatus();
  }
  function annualState(ms) {
    if(!Number.isFinite(ms))throw new TypeError('A finite timestamp is required.');
    if(!annual||ms<annual.start||ms>=annual.end)calibrateAt(Date.UTC(new Date(ms).getUTCFullYear(),0,1));
    return annual;
  }
  function modelStatus() {return annual&&Object.freeze({year:annual.year,epoch:annual.epoch,start:annual.start,end:annual.end,
    calibrations:yearBuilds,referenceEvaluations,source:'local',networkRequired:false,periodUnit:'seconds',decimals:2});}
  function modelYear(ms) {const a=annualState(ms);return a.year+':'+a.epoch;}
  function rotationAt(body,ms) {
    if(!Number.isFinite(ms)||!Number.isFinite(body.spinSeconds)||body.spinSeconds===0)
      throw new RangeError('Rotation requires a finite timestamp and a nonzero signed period.');
    const y=annualState(ms),anchor=y.spins.get(body.id);
    if(anchor===undefined)throw new RangeError('Unknown body.');
    return wrap(anchor+wrap((ms-y.epoch)/(body.spinSeconds*1000),1)*TAU);
  }
  function rotationPoleTilt(body) {
    // Signed retrograde period already reverses angular velocity. Use its northern
    // pole here, otherwise tilt > 90 degrees would reverse the direction twice.
    return (body.spin<0?180-body.tilt:body.tilt)*DEG;
  }
  function equatorialPole(spec,retrograde=false){
    const ra=spec.ra*DEG,dec=spec.dec*DEG,cd=Math.cos(dec);
    let x=cd*Math.cos(ra),yEq=cd*Math.sin(ra),zEq=Math.sin(dec);
    let y=Math.cos(J2000_OBLIQUITY)*yEq+Math.sin(J2000_OBLIQUITY)*zEq;
    let z=-Math.sin(J2000_OBLIQUITY)*yEq+Math.cos(J2000_OBLIQUITY)*zEq;
    if(spec.positive&&retrograde){x=-x;y=-y;z=-z;}
    const n=Math.hypot(x,y,z)||1;return {x:x/n,y:y/n,z:z/n};
  }
  // Greenwich sidereal rotation and existing orbital sunlight are sufficient for
  // a day/night indication. No weather, terrain/refraction or eclipse calculation.
  function bodyAxes(body){
    if(axesCache.has(body.id))return axesCache.get(body.id);
    const spec=ROTATION_POLES[body.id];let pole,u,v;
    if(spec){
      pole=equatorialPole(spec,body.spin<0);const h=Math.hypot(pole.x,pole.y);
      u=h>1e-12?{x:pole.y/h,y:-pole.x/h,z:0}:{x:1,y:0,z:0};
      v={x:pole.y*u.z-pole.z*u.y,y:pole.z*u.x-pole.x*u.z,z:pole.x*u.y-pole.y*u.x};
    }else{
      // The Moon keeps its compact mean-orbit presentation; its pole has
      // periodic terms that are outside this illustrative lunar model.
      const tilt=rotationPoleTilt(body),ct=Math.cos(tilt),st=Math.sin(tilt);
      u={x:1,y:0,z:0};v={x:0,y:ct,z:st};pole={x:0,y:-st,z:ct};
    }
    const axes=Object.freeze({u:Object.freeze(u),v:Object.freeze(v),pole:Object.freeze(pole)});
    axesCache.set(body.id,axes);return axes;
  }
  function surfaceDirection(body,latitude,longitude,ms){
    const frame=bodyAxes(body),a=longitude*DEG+rotationAt(body,ms),lat=latitude*DEG;
    const x=Math.cos(lat)*Math.cos(a),y=Math.cos(lat)*Math.sin(a),z=Math.sin(lat);
    return {x:frame.u.x*x+frame.v.x*y+frame.pole.x*z,y:frame.u.y*x+frame.v.y*y+frame.pole.y*z,z:frame.u.z*x+frame.v.z*y+frame.pole.z*z};
  }

  function siteSun(ms,latitude=37.5665,longitude=126.978){
    const earth=BODIES.find(b=>b.id==='earth'),p=positionAt(earth,ms),n=surfaceDirection(earth,latitude,longitude,ms);
    const cosine=-(p.x*n.x+p.y*n.y+p.z*n.z)/Math.hypot(p.x,p.y,p.z);
    return {altitude:Math.asin(clamp(cosine,-1,1))/DEG,latitude,longitude};
  }
  function eccentricAnomaly(M, e) {
    M = wrap(M + Math.PI) - Math.PI;
    let E = M;
    for (let i=0;i<16;i++) {
      const step = (E - e*Math.sin(E) - M) / (1 - e*Math.cos(E));
      E -= step;
      if (Math.abs(step) < 1e-12) break;
    }
    return E;
  }
  function referenceElementsAt(body, ms) {
    if (!Number.isFinite(ms)) throw new TypeError('A finite timestamp is required.');
    const T = (ms-J2000)/DAY/36525;
    const [a,e,inc,L,peri,node] = body.base.map((v,i)=>v+body.rates[i]*T);
    const c = body.correction;
    const extra = c ? c[0]*T*T+c[1]*Math.cos(c[3]*T*DEG)+c[2]*Math.sin(c[3]*T*DEG) : 0;
    return {a,e,inc:inc*DEG,node:node*DEG,omega:(peri-node)*DEG,M:wrap((L-peri+extra)*DEG)};
  }
  function elementsAt(body,ms) {
    const year=annualState(ms),base=year.orbits.get(body.id);
    if(!base)throw new RangeError('Unknown orbital body.');
    return {...base,M:wrap(base.M+TAU*wrap((ms-year.epoch)/(body.periodSeconds*1000),1))};
  }
  // Both a planet and every point of its orbit use this exact transform.
  function pointOnOrbit(elements, E, semiMajor = elements.a) {
    const {e,inc,node,omega} = elements;
    const x = semiMajor*(Math.cos(E)-e), y = semiMajor*Math.sqrt(1-e*e)*Math.sin(E);
    const co=Math.cos(omega), so=Math.sin(omega), cn=Math.cos(node), sn=Math.sin(node), ci=Math.cos(inc), si=Math.sin(inc);
    return {x:(co*cn-so*sn*ci)*x+(-so*cn-co*sn*ci)*y,
      y:(co*sn+so*cn*ci)*x+(-so*sn+co*cn*ci)*y, z:so*si*x+co*si*y};
  }
  function positionAt(body, ms, display=false) {
    const elements=elementsAt(body,ms), E=eccentricAnomaly(elements.M,elements.e);
    return {...pointOnOrbit(elements,E,display ? body.orbit : elements.a),elements,E};
  }
  function orbitAt(body, ms, count=360) {
    const el=elementsAt(body,ms);
    return Array.from({length:count+1},(_,i)=>pointOnOrbit(el,TAU*i/count,body.orbit));
  }
  const SATELLITE_EPOCH=Date.UTC(2026,8,13);
  // Fixed osculating ellipses from JPL Horizons parent-relative state vectors
  // at 2026-09-13 00:00 TDB. Long-term tidal recession and perturbations are
  // intentionally omitted; each timestamp still resolves directly with Kepler.
  const satelliteStates=Object.freeze({
    moon:Object.freeze({e:.05,M0:1.478549158145498,
      peri:Object.freeze({x:-.2212582051236265,y:.9729528378989719,z:.06638962185318163}),
      pole:Object.freeze({x:-.0465287224982116,y:-.07853137328439469,z:.9958252363706953})}),
    europa:Object.freeze({e:.01,M0:-.1424497316293192,
      peri:Object.freeze({x:-.8040980656771407,y:-.5935108906148845,z:-.03422168166246992}),
      pole:Object.freeze({x:-.020239681604346447,y:-.03020057409227212,z:.9993389217943289})})
  });
  function satelliteElements(body,ms){
    if(!Number.isFinite(ms))throw new TypeError('A finite timestamp is required.');
    const state=satelliteStates[body.id];if(!state)throw new RangeError('Unknown satellite.');
    const inc=Math.acos(clamp(state.pole.z,-1,1)),node=wrap(Math.atan2(state.pole.x,-state.pole.y));
    const sinInc=Math.sin(inc),sinOmega=sinInc>1e-12?state.peri.z/sinInc:0;
    const cosOmega=state.peri.x*Math.cos(node)+state.peri.y*Math.sin(node),omega=Math.atan2(sinOmega,cosOmega);
    const M=wrap(state.M0+TAU*wrap((ms-SATELLITE_EPOCH)/(body.periodSeconds*1000),1));
    return {a:1,e:state.e,inc,node,omega,M};
  }
  function moonElements(ms) {return satelliteElements(MOON,ms);}
  function satelliteAt(body,ms,radius=body.displayOrbit){
    if(!Number.isFinite(radius))throw new TypeError('A finite radius is required.');
    const el=satelliteElements(body,ms),E=eccentricAnomaly(el.M,el.e);
    return pointOnOrbit(el,E,radius);
  }
  function moonAt(ms,radius=MOON.displayOrbit){return satelliteAt(MOON,ms,radius);}
  function europaAt(ms,radius=EUROPA.displayOrbit){return satelliteAt(EUROPA,ms,radius);}
  function satelliteOrbit(body,ms,radius=body.displayOrbit,count=90){
    if(!Number.isInteger(count)||count<3)throw new RangeError('Satellite orbit count must be at least 3.');
    const el=satelliteElements(body,ms);
    return Array.from({length:count+1},(_,i)=>pointOnOrbit(el,i/count*TAU,radius));
  }
  function moonPhase(ms) {
    const m=moonAt(ms,1), e=positionAt(BODIES[2],ms);
    const elongation=wrap(Math.atan2(m.y,m.x)-Math.atan2(-e.y,-e.x));
    const fraction=(1-Math.cos(elongation))/2, phase=elongation/TAU;
    const names=['삭 부근','초승달','상현달','차오르는 달','보름달 부근','기우는 달','하현달','그믐달'];
    return {fraction,phase,name:names[Math.round(phase*8)%8]};
  }
  // Anchored to time, never frame count: refresh rate and sleeping tabs cannot slow the orbit.
  class SimulationClock {
    constructor(now=Date.now(), mono=0) { this.anchorMs=now; this.anchorMono=mono; this.rate=1; this.live=true; this.paused=false; }
    value(mono,wall=Date.now()) {
      if (this.paused) return this.anchorMs;
      return clamp(this.live ? wall : this.anchorMs+(mono-this.anchorMono)*this.rate,MIN_TIME,MAX_TIME);
    }
    setRate(rate,mono,wall=Date.now()) {
      if (!Number.isFinite(rate) || rate<=0) throw new RangeError('Playback rate must be positive.');
      this.anchorMs=this.value(mono,wall); this.anchorMono=mono; this.rate=rate;
      this.live=false; this.paused=false;
    }
    setDate(ms,mono) {
      if (!Number.isFinite(ms) || ms<MIN_TIME || ms>MAX_TIME) throw new RangeError('Date outside 1800–2999.');
      this.anchorMs=ms; this.anchorMono=mono; this.live=false; this.rate=1; this.paused=true;
    }
    toggle(mono,wall=Date.now()) {
      if (!this.paused) { this.anchorMs=this.value(mono,wall); this.anchorMono=mono; this.paused=true; }
      else { this.anchorMono=mono; this.paused=false; }
    }
    now(mono,wall=Date.now()) { this.anchorMs=wall; this.anchorMono=mono; this.rate=1; this.live=true; this.paused=false; }
  }
  return Object.freeze({DAY,TAU,DEG,J2000,MIN_TIME,MAX_TIME,BODIES,SUN,MOON,EUROPA,SATELLITES,SATELLITE_EPOCH,wrap,clamp,rotationAt,calibrateAt,modelStatus,modelYear,rotationPoleTilt,surfaceDirection,bodyAxes,siteSun,eccentricAnomaly,elementsAt,pointOnOrbit,positionAt,orbitAt,satelliteElements,moonElements,moonAt,europaAt,satelliteAt,satelliteOrbit,moonPhase,SimulationClock});
});
