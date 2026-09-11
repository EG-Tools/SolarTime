/* Solar Time v0.02 | No runtime dependencies.
 * Approximate, heliocentric J2000 ecliptic positions, NOT an observing ephemeris.
 * Planet elements: JPL / Standish & Williams, 3000 BC–3000 AD fit, tables 2a/2b.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * UTC is used in place of TDB; Earth uses the Earth–Moon barycenter.
 * Pluto is a fixed, illustrative J2000 Kepler orbit, not a JPL ephemeris.
 * Moon is a circular mean sidereal model; no perturbations/eclipses modeled.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarAstro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const J2000 = Date.UTC(2000, 0, 1, 12), MIN_TIME = Date.UTC(1800, 0, 1), MAX_TIME = Date.UTC(2999, 11, 31, 23, 59, 59);
  const wrap = (v, m = TAU) => ((v % m) + m) % m;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    ['pluto','명왕성','PLUTO',718,5,'#c8ada0',90560,-6.38723,119.61,
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
    Object.freeze({id,ko,en,orbit,size,color,period,spin,tilt,base,rates,correction,description:descriptions[id]}));
  const SUN = Object.freeze({id:'sun',ko:'태양',en:'SUN',size:28,color:'#ffb753',spin:25.38,tilt:7.25,
    description:'태양계의 중심. 표면의 입상 조직과 움직이는 코로나, 홍염은 감상을 위한 시각 효과입니다.'});
  const MOON = Object.freeze({id:'moon',ko:'달',en:'MOON',size:3.9,color:'#d0ced0',period:27.321661,spin:27.321661,tilt:6.68,
    description:'지구를 약 27.32일에 한 바퀴 도는 유일한 자연 위성. 거리와 크기는 보기 편하게 확대했습니다.'});
  // One rotation authority. The SAME simulation timestamp drives orbits and spins.
  // Zero longitude at J2000 is illustrative; this is not a prime-meridian ephemeris.
  function rotationAt(body, ms) {
    if (!Number.isFinite(ms) || !Number.isFinite(body.spin) || body.spin===0)
      throw new RangeError('Rotation requires a finite timestamp and a nonzero sidereal period.');
    return wrap((ms-J2000)/(DAY*body.spin),1)*TAU;
  }
  function rotationPoleTilt(body) {
    // Signed retrograde period already reverses angular velocity. Use its northern
    // pole here, otherwise tilt > 90 degrees would reverse the direction twice.
    return (body.spin<0?180-body.tilt:body.tilt)*DEG;
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
  function elementsAt(body, ms) {
    if (!Number.isFinite(ms)) throw new TypeError('A finite timestamp is required.');
    const T = (ms-J2000)/DAY/36525;
    const [a,e,inc,L,peri,node] = body.base.map((v,i)=>v+body.rates[i]*T);
    const c = body.correction;
    const extra = c ? c[0]*T*T+c[1]*Math.cos(c[3]*T*DEG)+c[2]*Math.sin(c[3]*T*DEG) : 0;
    return {a,e,inc:inc*DEG,node:node*DEG,omega:(peri-node)*DEG,M:wrap((L-peri+extra)*DEG)};
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
  function moonElements(ms) {
    const d=(ms-J2000)/DAY;
    const node=wrap((125.045-.0529538083*d)*DEG);
    const lon=wrap((218.3164477+360/MOON.period*d)*DEG);
    return {a:1,e:0,inc:5.145*DEG,node,omega:0,M:wrap(lon-node)};
  }
  function moonAt(ms, radius=38) { const el=moonElements(ms); return pointOnOrbit(el,el.M,radius); }
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
  return Object.freeze({DAY,TAU,DEG,J2000,MIN_TIME,MAX_TIME,BODIES,SUN,MOON,wrap,clamp,rotationAt,rotationPoleTilt,eccentricAnomaly,elementsAt,pointOnOrbit,positionAt,orbitAt,moonElements,moonAt,moonPhase,SimulationClock});
});
