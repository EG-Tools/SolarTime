/* Solar Time v0.53 | Layered ephemeris and deterministic display model.
 * Planet elements: JPL / Standish & Williams table 1 for 1800–2050,
 * tables 2a/2b for the long-term 1800–2999 presentation range.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * UTC is used in place of TDB; the tabulated Earth–Moon barycenter is
 * corrected to the Earth's center with the precision lunar vector.
 * Moon, Europa and Pluto use Astronomy Engine's dedicated ELP/VSOP,
 * Galilean-moon and gravitational models. Global lunar-caused solar eclipses
 * use its shadow geometry instead of the display orbit.
 */
(function (root, factory) {
  let precision=root.Astronomy;
  if(!precision&&typeof require==='function')try{precision=require('astronomy-engine');}catch(_){/* browser fallback is loaded separately */}
  const api = factory(precision);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarAstro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Astronomy) {
  'use strict';
  const DAY = 86400000, TAU = Math.PI * 2, DEG = Math.PI / 180;
  const J2000 = Date.UTC(2000, 0, 1, 12), MIN_TIME = Date.UTC(1800, 0, 1), MAX_TIME = Date.UTC(2999, 11, 31, 23, 59, 59);
  const CURRENT_START=Date.UTC(1800,0,1),CURRENT_END=Date.UTC(2051,0,1),HAS_PRECISION=!!(Astronomy?.GeoMoon&&Astronomy?.JupiterMoons&&Astronomy?.HelioVector&&Astronomy?.SearchGlobalSolarEclipse);
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
    ['earth','지구','EARTH',198,11.5,'#73b9ec',365.256,0.99726968,23.439,
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
  // JPL table 1: fitted specifically for 1800–2050 and measurably tighter than
  // the long-range table, especially for the outer planets. Pluto is absent
  // from JPL's table and is handled by the dedicated precision engine below.
  const CURRENT_ELEMENT_SETS=Object.freeze({
    mercury:Object.freeze({base:Object.freeze([.38709927,.20563593,7.00497902,252.25032350,77.45779628,48.33076593]),rates:Object.freeze([.00000037,.00001906,-.00594749,149472.67411175,.16047689,-.12534081])}),
    venus:Object.freeze({base:Object.freeze([.72333566,.00677672,3.39467605,181.97909950,131.60246718,76.67984255]),rates:Object.freeze([.00000390,-.00004107,-.00078890,58517.81538729,.00268329,-.27769418])}),
    earth:Object.freeze({base:Object.freeze([1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0]),rates:Object.freeze([.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0])}),
    mars:Object.freeze({base:Object.freeze([1.52371034,.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891]),rates:Object.freeze([.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343])}),
    jupiter:Object.freeze({base:Object.freeze([5.20288700,.04838624,1.30439695,34.39644051,14.72847983,100.47390909]),rates:Object.freeze([-.00011607,-.00013253,-.00183714,3034.74612775,.21252668,.20469106])}),
    saturn:Object.freeze({base:Object.freeze([9.53667594,.05386179,2.48599187,49.95424423,92.59887831,113.66242448]),rates:Object.freeze([-.00125060,-.00050991,.00193609,1222.49362201,-.41897216,-.28867794])}),
    uranus:Object.freeze({base:Object.freeze([19.18916464,.04725744,.77263783,313.23810451,170.95427630,74.01692503]),rates:Object.freeze([-.00196176,-.00004397,-.00242939,428.48202785,.40805281,.04240589])}),
    neptune:Object.freeze({base:Object.freeze([30.06992276,.00859048,1.77004347,-55.12002969,44.96476227,131.78422574]),rates:Object.freeze([.00026291,.00005105,.00035372,218.45945325,-.32241464,-.00508664])})
  });
  const descriptions = {
    mercury:'금속성 핵이 매우 큰 암석 행성. 물은 대부분 영구 그늘의 극지 분화구에 얼음 형태로 남아 있습니다.',
    venus:'규산염 암석으로 된 행성. 이산화탄소 대기와 황산 구름이 두껍게 덮고 있어 표면에 액체 물은 없습니다.',
    earth:'규산염 암석과 금속 핵으로 된 행성. 표면 대부분을 액체 물의 바다가 덮고, 대기는 질소와 산소가 중심입니다.',
    mars:'철 산화물이 섞인 암석과 먼지로 붉게 보이는 행성. 물은 주로 극관과 지하에 얼음으로 남아 있습니다.',
    jupiter:'수소와 헬륨이 대부분인 가스 거대 행성. 단단한 표면 없이 깊은 대기와 구름층, 거대한 폭풍을 가집니다.',
    saturn:'수소와 헬륨이 대부분인 가스 거대 행성. 고리는 물얼음이 주성분이며 암석과 먼지가 섞여 있습니다.',
    uranus:'수소·헬륨 대기 아래 물·암모니아·메테인 계열 물질이 많은 얼음 거대 행성. 기울어진 자전축과 옅은 고리가 특징입니다.',
    neptune:'수소·헬륨 대기 아래 물·암모니아·메테인 계열 물질이 많은 얼음 거대 행성. 메테인이 푸른빛에 영향을 줍니다.',
    pluto:'암석과 물얼음으로 된 왜행성. 표면은 질소·메테인·일산화탄소 얼음이 덮고 있습니다.'
  };
  // The normal overview gives Mercury extra clearance from the Sun, then uses
  // one user-adjustable interval for every neighboring heliocentric orbit.
  const OVERVIEW_ORBIT=Object.freeze({start:defs[0][3]*2,gap:90,minGap:50,maxGap:400});
  const BODIES = defs.map(([id,ko,en,orbit,size,color,period,spin,tilt,base,rates,correction],index) =>
    Object.freeze({id,ko,en,orbit,overviewOrbit:OVERVIEW_ORBIT.start+OVERVIEW_ORBIT.gap*index,size,color,period:round2(period*86400)/86400,
      periodSeconds:round2(period*86400),spin:round2(spin*86400)/86400,spinSeconds:round2(spin*86400),
      referenceSpinDays:spin,tilt:round3(tilt),base:Object.freeze(base),rates:Object.freeze(rates),
      correction:correction&&Object.freeze(correction),current:CURRENT_ELEMENT_SETS[id]||null,description:descriptions[id]}));
  // The overview uses evenly spaced orbit anchors, but radial motion is still
  // derived from the physical AU orbit. Mapping the physical radius through
  // these anchors prevents Pluto's large eccentricity from being multiplied by
  // the compressed 718 px orbit and falsely reaching the Uranus track.
  const DISPLAY_ORBIT_ANCHORS=Object.freeze([
    Object.freeze({distance:0,index:-1,actualOrbit:0}),
    ...BODIES.map((body,index)=>Object.freeze({distance:body.base[0],index,actualOrbit:body.orbit}))
  ]);
  function displayDistance(distance,actualMix=0,overviewGap=OVERVIEW_ORBIT.gap){
    if(!Number.isFinite(distance)||distance<0)throw new RangeError('Display distance must be finite and nonnegative.');
    const gap=clamp(Number.isFinite(overviewGap)?overviewGap:OVERVIEW_ORBIT.gap,OVERVIEW_ORBIT.minGap,OVERVIEW_ORBIT.maxGap);
    let upper=DISPLAY_ORBIT_ANCHORS.findIndex(anchor=>distance<=anchor.distance);
    if(upper<0)upper=DISPLAY_ORBIT_ANCHORS.length-1;
    else if(upper<1)upper=1;
    const a=DISPLAY_ORBIT_ANCHORS[upper-1],b=DISPLAY_ORBIT_ANCHORS[upper],span=b.distance-a.distance||1;
    const position=(distance-a.distance)/span;
    const overviewA=a.index<0?0:OVERVIEW_ORBIT.start+gap*a.index;
    const overviewB=OVERVIEW_ORBIT.start+gap*b.index;
    const overview=overviewA+(overviewB-overviewA)*position;
    const actual=a.actualOrbit+(b.actualOrbit-a.actualOrbit)*position;
    return overview+(actual-overview)*clamp(Number.isFinite(actualMix)?actualMix:0,0,1);
  }
  function displayPoint(point){
    const radius=Math.hypot(point.x,point.y,point.z);if(!(radius>1e-12))return point;
    const scale=displayDistance(radius)/radius;
    return {x:point.x*scale,y:point.y*scale,z:point.z*scale,physicalDistance:radius};
  }
  const SUN = Object.freeze({id:'sun',ko:'태양',en:'SUN',size:28,color:'#ffb753',spin:25.38,spinSeconds:2192832,referenceSpinDays:25.38,tilt:7.25,
    description:'수소와 헬륨이 대부분인 항성. 중심의 핵융합 에너지가 뜨거운 플라스마와 빛으로 방출됩니다.'});
  // Satellite display-orbit radii are reference-screen values. The renderer keeps
  // them illustrative normally and scales each local system with its parent when
  // actual-size presentation is enabled.
  const MOON = Object.freeze({id:'moon',ko:'달',en:'MOON',size:3.9,displayOrbit:30,color:'#d0ced0',period:2360591.51/86400,periodSeconds:2360591.51,spin:2360591.51/86400,spinSeconds:2360591.51,referenceSpinDays:27.321661,tilt:6.68,
    parent:'earth',description:'규산염 암석으로 된 지구의 자연 위성. 물은 주로 영구 그늘의 극지 토양과 분화구에 얼음으로 존재합니다.'});
  const EUROPA = Object.freeze({id:'europa',ko:'유로파',en:'EUROPA',size:3.8,displayOrbit:45,color:'#d8c89c',period:3.551181,periodSeconds:306822.04,spin:3.551181,spinSeconds:306822.04,referenceSpinDays:3.551181,tilt:.1,
    parent:'jupiter',description:'물얼음 지각으로 덮인 목성의 갈릴레이 위성. 얼음 아래에는 염분을 포함한 거대한 액체 바다가 있을 가능성이 큽니다.'});
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
  function ephemerisTier(ms){return ms>=CURRENT_START&&ms<CURRENT_END?'jpl-1800-2050':'jpl-long-term';}
  function modelStatus() {return annual&&Object.freeze({year:annual.year,epoch:annual.epoch,start:annual.start,end:annual.end,
    calibrations:yearBuilds,referenceEvaluations,source:ephemerisTier(annual.epoch),precisionBodies:HAS_PRECISION,networkRequired:false,periodUnit:'seconds',decimals:2});}
  function modelYear(ms) {const a=annualState(ms);return ephemerisTier(ms)+':'+a.year+':'+a.epoch;}
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
  function rawReferenceElementsAt(body,ms,useCurrent) {
    if (!Number.isFinite(ms)) throw new TypeError('A finite timestamp is required.');
    const T = (ms-J2000)/DAY/36525;
    const current=useCurrent&&body.current,base=current?current.base:body.base,rates=current?current.rates:body.rates;
    const [a,e,inc,L,peri,node] = base.map((v,i)=>v+rates[i]*T);
    const c = current?null:body.correction;
    const extra = c ? c[0]*T*T+c[1]*Math.cos(c[3]*T*DEG)+c[2]*Math.sin(c[3]*T*DEG) : 0;
    return {a,e,inc:inc*DEG,node:node*DEG,omega:(peri-node)*DEG,M:wrap((L-peri+extra)*DEG)};
  }
  const boundaryElementOffsets=new Map();
  const signedAngleDifference=(to,from)=>wrap(to-from+Math.PI)-Math.PI;
  function referenceElementsAt(body, ms) {
    if (!Number.isFinite(ms)) throw new TypeError('A finite timestamp is required.');
    const current=ms>=CURRENT_START&&ms<CURRENT_END&&body.current;
    const result=rawReferenceElementsAt(body,ms,current);
    if(current||ms<CURRENT_END||!body.current)return result;
    let offset=boundaryElementOffsets.get(body.id);
    if(!offset){
      // The two published JPL fits do not meet at exactly the same state. Treat
      // the accurate 1800–2050 solution as the phase anchor for the long-term
      // coefficients. Rates remain those of the long-term model; only its
      // constant element origins are calibrated once at the boundary.
      const anchor=rawReferenceElementsAt(body,CURRENT_END,true),long=rawReferenceElementsAt(body,CURRENT_END,false);
      offset=Object.freeze({a:anchor.a-long.a,e:anchor.e-long.e,inc:anchor.inc-long.inc,
        node:signedAngleDifference(anchor.node,long.node),omega:signedAngleDifference(anchor.omega,long.omega),M:signedAngleDifference(anchor.M,long.M)});
      boundaryElementOffsets.set(body.id,offset);
    }
    return {a:result.a+offset.a,e:result.e+offset.e,inc:result.inc+offset.inc,
      node:result.node+offset.node,omega:result.omega+offset.omega,M:wrap(result.M+offset.M)};
  }
  function elementsAt(body,ms) {
    if(!BODIES.includes(body))throw new RangeError('Unknown orbital body.');
    annualState(ms);
    // Evaluate the fitted rates at the requested instant. The former annual
    // phase propagation rounded each orbit to a fixed sidereal period and
    // discarded part of the accuracy supplied by JPL's longitude rate.
    return referenceElementsAt(body,ms);
  }
  // Both a planet and every point of its orbit use this exact transform.
  function pointOnOrbit(elements, E, semiMajor = elements.a) {
    const {e,inc,node,omega} = elements;
    const x = semiMajor*(Math.cos(E)-e), y = semiMajor*Math.sqrt(1-e*e)*Math.sin(E);
    const co=Math.cos(omega), so=Math.sin(omega), cn=Math.cos(node), sn=Math.sin(node), ci=Math.cos(inc), si=Math.sin(inc);
    return {x:(co*cn-so*sn*ci)*x+(-so*cn-co*sn*ci)*y,
      y:(co*sn+so*cn*ci)*x+(-so*sn+co*cn*ci)*y, z:so*si*x+co*si*y};
  }
  function equatorialToEcliptic(vector) {
    const ce=Math.cos(J2000_OBLIQUITY),se=Math.sin(J2000_OBLIQUITY);
    return {x:vector.x,y:ce*vector.y+se*vector.z,z:-se*vector.y+ce*vector.z};
  }
  function precisionBodyVector(bodyId,ms){
    if(!HAS_PRECISION)return null;
    const name={pluto:'Pluto'}[bodyId];if(!name)return null;
    try{return equatorialToEcliptic(Astronomy.HelioVector(Astronomy.Body[name],new Date(ms)));}catch(_){return null;}
  }
  function positionAt(body, ms, display=false) {
    const elements=elementsAt(body,ms), E=eccentricAnomaly(elements.M,elements.e);
    let physical=precisionBodyVector(body.id,ms)||pointOnOrbit(elements,E);
    // JPL's table supplies the Earth-Moon barycenter. Move it to the Earth's
    // center using the precision lunar vector whenever that model is present.
    if(body.id==='earth'&&HAS_PRECISION){
      try{const moon=equatorialToEcliptic(Astronomy.GeoMoon(new Date(ms))),ratio=82.30056;physical={x:physical.x-moon.x/ratio,y:physical.y-moon.y/ratio,z:physical.z-moon.z/ratio};}catch(_){/* keep EMB fallback */}
    }
    const point=display?displayPoint(physical):physical;
    return {...point,elements,E};
  }
  function orbitAt(body, ms, count=360) {
    if(body.id==='pluto'&&HAS_PRECISION){
      const span=body.periodSeconds*1000,start=clamp(ms-span/2,MIN_TIME,MAX_TIME-span),points=[];
      for(let i=0;i<count;i++)points.push(displayPoint(precisionBodyVector('pluto',start+span*i/count)));
      points.push({...points[0]});return points;
    }
    const el=elementsAt(body,ms);
    return Array.from({length:count+1},(_,i)=>displayPoint(pointOnOrbit(el,TAU*i/count)));
  }
  const SATELLITE_EPOCH=Date.UTC(2026,8,13);
  // Deterministic offline fallback ellipses from JPL Horizons parent-relative
  // state vectors at 2026-09-13 00:00 TDB. Normal builds use the dedicated
  // precision models above; these keep the app usable if that script is absent.
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
  const SATELLITE_MEAN_AU=Object.freeze({moon:.00256955529,europa:.004485883});
  function precisionSatelliteVector(body,ms,radius){
    if(!HAS_PRECISION)return null;
    try{
      const vector=body.id==='moon'?Astronomy.GeoMoon(new Date(ms)):body.id==='europa'?Astronomy.JupiterMoons(new Date(ms)).europa:null;
      if(!vector)return null;
      const ecliptic=equatorialToEcliptic(vector),scale=radius/SATELLITE_MEAN_AU[body.id];
      return {x:ecliptic.x*scale,y:ecliptic.y*scale,z:ecliptic.z*scale};
    }catch(_){return null;}
  }
  function satelliteAt(body,ms,radius=body.displayOrbit){
    if(!Number.isFinite(radius))throw new TypeError('A finite radius is required.');
    const precise=precisionSatelliteVector(body,ms,radius);if(precise)return precise;
    const el=satelliteElements(body,ms),E=eccentricAnomaly(el.M,el.e);
    return pointOnOrbit(el,E,radius);
  }
  function moonAt(ms,radius=MOON.displayOrbit){return satelliteAt(MOON,ms,radius);}
  function europaAt(ms,radius=EUROPA.displayOrbit){return satelliteAt(EUROPA,ms,radius);}
  function satelliteOrbit(body,ms,radius=body.displayOrbit,count=90){
    if(!Number.isInteger(count)||count<3)throw new RangeError('Satellite orbit count must be at least 3.');
    if(HAS_PRECISION){
      const points=[];
      for(let i=0;i<count;i++)points.push(satelliteAt(body,ms+body.periodSeconds*1000*i/count,radius));
      points.push({...points[0]});return points;
    }
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
  const ECLIPSE_SEARCH=Object.freeze({
    moon:Object.freeze({step:DAY/4,span:DAY*550,limit:1.25*DEG}),
    europa:Object.freeze({step:DAY/48,span:DAY*8,limit:6.5*DEG})
  });
  const AU_KM=Astronomy?.KM_PER_AU||149597870.7,SUN_RADIUS_AU=695700/AU_KM,JUPITER_RADIUS_AU=(Astronomy?.JUPITER_EQUATORIAL_RADIUS_KM||71492)/AU_KM,EUROPA_RADIUS_AU=(Astronomy?.EUROPA_RADIUS_KM||1560.8)/AU_KM;
  function eclipseAlignment(bodyOrId,ms){
    const body=typeof bodyOrId==='string'?SATELLITES.find(value=>value.id===bodyOrId):bodyOrId,spec=body&&ECLIPSE_SEARCH[body.id];
    if(!spec||!Number.isFinite(ms))throw new RangeError('Eclipse alignment requires Moon or Europa and a finite timestamp.');
    const parent=BODIES.find(value=>value.id===body.parent),local=satelliteAt(body,ms,1),solar=positionAt(parent,ms);
    const denominator=(Math.hypot(local.x,local.y,local.z)||1)*(Math.hypot(solar.x,solar.y,solar.z)||1);
    // Both controls represent a transit: the satellite lies between its parent
    // and the Sun. Moon and Europa therefore share the same alignment sign.
    return clamp(-(local.x*solar.x+local.y*solar.y+local.z*solar.z)/denominator,-1,1);
  }
  function refineEclipse(body,left,right){
    for(let i=0;i<32;i++){
      const third=(right-left)/3,a=left+third,b=right-third;
      if(eclipseAlignment(body,a)<eclipseAlignment(body,b))left=a;else right=b;
    }
    return (left+right)/2;
  }
  function europaShadowGeometry(ms){
    if(!HAS_PRECISION)return null;
    try{
      const local=precisionSatelliteVector(EUROPA,ms,SATELLITE_MEAN_AU.europa),jupiter=equatorialToEcliptic(Astronomy.HelioVector(Astronomy.Body.Jupiter,new Date(ms)));
      const sun={x:-jupiter.x,y:-jupiter.y,z:-jupiter.z},sunDistance=Math.hypot(sun.x,sun.y,sun.z),inverse=1/(sunDistance||1),unit={x:sun.x*inverse,y:sun.y*inverse,z:sun.z*inverse};
      const along=local.x*unit.x+local.y*unit.y+local.z*unit.z,lateral=Math.sqrt(Math.max(0,local.x*local.x+local.y*local.y+local.z*local.z-along*along));
      const europaSunDistance=Math.max(.1,sunDistance-along),umbraLength=EUROPA_RADIUS_AU*europaSunDistance/(SUN_RADIUS_AU-EUROPA_RADIUS_AU),shadowRadius=Math.max(0,EUROPA_RADIUS_AU*(1-along/umbraLength)),limit=JUPITER_RADIUS_AU+shadowRadius;
      return Object.freeze({along,lateral,umbraLength,shadowRadius,limit,impact:lateral/limit,intersects:along>0&&along<umbraLength&&lateral<=limit});
    }catch(_){return null;}
  }
  function precisionMoonEclipse(startMs,direction){
    if(!HAS_PRECISION)return null;
    const sign=direction<0?-1:1,epsilon=60000,asEvent=value=>{
      const ms=value?.peak?.date?.getTime?.();
      return Number.isFinite(ms)&&ms>=MIN_TIME&&ms<=MAX_TIME?Object.freeze({body:'moon',ms:Math.round(ms/1000)*1000,separation:0,direction:sign,kind:value.kind,precision:'shadow'}):null;
    };
    try{
      if(sign>0){
        // SearchGlobalSolarEclipse may return the eclipse whose peak is just
        // behind the supplied time. Repeated `next` clicks would then keep
        // returning the same timestamp. Enforce a strictly future result and
        // advance by the library's own event cursor when that happens.
        let value=Astronomy.SearchGlobalSolarEclipse(new Date(startMs+epsilon));
        for(let guard=0;guard<4;guard++){
          const event=asEvent(value);if(!event)return null;
          if(event.ms>startMs+epsilon)return event;
          value=Astronomy.NextGlobalSolarEclipse(value.peak);
        }
        return null;
      }
      if(startMs<=MIN_TIME+epsilon)return null;
      const from=Math.max(MIN_TIME,startMs-DAY*550);let value=Astronomy.SearchGlobalSolarEclipse(new Date(from)),candidate=null;
      for(let guard=0;guard<8;guard++){
        const event=asEvent(value);if(!event||event.ms>=startMs-epsilon)break;
        candidate=event;value=Astronomy.NextGlobalSolarEclipse(value.peak);
      }
      return candidate;
    }catch(_){return null;}
  }
  function eclipseEvent(bodyOrId,startMs,direction=1){
    const body=typeof bodyOrId==='string'?SATELLITES.find(value=>value.id===bodyOrId):bodyOrId,spec=body&&ECLIPSE_SEARCH[body.id],sign=direction<0?-1:1;
    if(!spec||!Number.isFinite(startMs))throw new RangeError('Eclipse search requires Moon or Europa and a finite timestamp.');
    if(body.id==='moon'){
      const precise=precisionMoonEclipse(startMs,sign);if(precise)return precise;
    }
    let a=clamp(startMs+sign*60000,MIN_TIME,MAX_TIME),sa=eclipseAlignment(body,a),b=a+sign*spec.step;
    const limit=clamp(startMs+sign*spec.span,MIN_TIME,MAX_TIME),threshold=Math.cos(spec.limit);
    if(b<MIN_TIME||b>MAX_TIME)return null;
    let sb=eclipseAlignment(body,b);
    while(sign>0?b<limit:b>limit){
      const c=b+sign*spec.step;if(c<MIN_TIME||c>MAX_TIME)break;
      const sc=eclipseAlignment(body,c);
      if(sb>sa&&sb>=sc){
        const ms=refineEclipse(body,Math.min(a,c),Math.max(a,c)),alignment=eclipseAlignment(body,ms);
        const shadow=body.id==='europa'?europaShadowGeometry(ms):null;
        if((shadow?shadow.intersects:alignment>=threshold))return Object.freeze({body:body.id,ms:Math.round(ms/60000)*60000,separation:Math.acos(alignment)/DEG,direction:sign,impact:shadow?.impact,precision:shadow?'shadow':'angular'});
      }
      a=b;sa=sb;b=c;sb=sc;
    }
    return null;
  }
  // Five-or-more-planet alignment dates use two deliberately separate meanings.
  // `sky` dates are the existing curated Earth-observer parade dates. `space`
  // dates are rare model-generated heliocentric diameter alignments: at least
  // five major planets lie within two degrees of one axis through the Sun.
  // Broad "same side" groupings are not presented as straight space alignments.
  const PLANETARY_ALIGNMENT_EVENTS=Object.freeze([
    ['2048-05-28T00:00:00.000Z',['earth','jupiter','venus','mercury','mars'],'space',1.995],
    ['2079-07-25T00:00:00.000Z',['saturn','neptune','uranus','earth','venus'],'space',1.815],
    ['2441-05-07T00:00:00.000Z',['mars','uranus','saturn','earth','mercury'],'space',1.941],
    ['2480-11-05T00:00:00.000Z',['uranus','mercury','earth','mars','venus'],'space',1.846],
    ['1962-02-05T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn'],'sky'],
    ['2000-05-05T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn'],'sky'],
    ['2002-05-13T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn'],'sky'],
    ['2022-06-24T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn','uranus','neptune'],'sky'],
    ['2027-07-02T06:00:00.000Z',['mercury','venus','saturn','uranus','neptune'],'sky'],
    ['2027-12-25T06:00:00.000Z',['mercury','venus','mars','saturn','uranus','neptune'],'sky'],
    ['2028-01-08T06:00:00.000Z',['mercury','venus','mars','saturn','neptune'],'sky'],
    ['2040-09-08T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn'],'sky'],
    ['2080-03-15T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn','uranus'],'sky'],
    ['2675-03-20T06:00:00.000Z',['mercury','venus','mars','jupiter','saturn'],'sky']
  ].map(([epoch,planets,kind,maxError])=>{
    const ms=Date.parse(epoch),date=epoch.slice(0,10);
    return Object.freeze({date,epoch,ms,planets:Object.freeze(planets),kind,...(Number.isFinite(maxError)?{maxError}:null)});
  }).sort((a,b)=>a.ms-b.ms));
  function planetaryAlignmentEvent(startMs,direction=1){
    if(!Number.isFinite(startMs))throw new RangeError('Alignment navigation requires a finite timestamp.');
    const sign=direction<0?-1:1,epsilon=60000;
    if(sign>0)return PLANETARY_ALIGNMENT_EVENTS.find(event=>event.ms>startMs+epsilon)||null;
    for(let i=PLANETARY_ALIGNMENT_EVENTS.length-1;i>=0;i--)if(PLANETARY_ALIGNMENT_EVENTS[i].ms<startMs-epsilon)return PLANETARY_ALIGNMENT_EVENTS[i];
    return null;
  }
  // Anchored to time, never frame count: refresh rate and sleeping tabs cannot slow the orbit.
  class SimulationClock {
    constructor(now=Date.now(), mono=0) { this.anchorMs=now; this.anchorMono=mono; this.rate=1; this.live=true; this.paused=false;this.travel=null; }
    value(mono,wall=Date.now()) {
      if(this.travel){
        const travel=this.travel,p=clamp((mono-travel.startMono)/travel.duration,0,1),eased=p*p*(3-2*p);
        if(p>=1){this.anchorMs=travel.targetMs;this.anchorMono=mono;this.rate=1;this.live=false;this.paused=true;this.travel=null;return this.anchorMs;}
        return travel.startMs+(travel.targetMs-travel.startMs)*eased;
      }
      if (this.paused) return this.anchorMs;
      return clamp(this.live ? wall : this.anchorMs+(mono-this.anchorMono)*this.rate,MIN_TIME,MAX_TIME);
    }
    setRate(rate,mono,wall=Date.now()) {
      if (!Number.isFinite(rate) || rate<=0) throw new RangeError('Playback rate must be positive.');
      this.anchorMs=this.value(mono,wall);this.travel=null; this.anchorMono=mono; this.rate=rate;
      this.live=false; this.paused=false;
    }
    setDate(ms,mono) {
      if (!Number.isFinite(ms) || ms<MIN_TIME || ms>MAX_TIME) throw new RangeError('Date outside 1800–2999.');
      this.travel=null;this.anchorMs=ms; this.anchorMono=mono; this.live=false; this.rate=1; this.paused=true;
    }
    travelTo(ms,mono,duration=1800,wall=Date.now()) {
      if (!Number.isFinite(ms) || ms<MIN_TIME || ms>MAX_TIME) throw new RangeError('Date outside 1800–2999.');
      if (!Number.isFinite(duration) || duration<=0) throw new RangeError('Travel duration must be positive.');
      const startMs=this.value(mono,wall);this.travel={startMs,targetMs:ms,startMono:mono,duration};
      this.anchorMs=startMs;this.anchorMono=mono;this.rate=1;this.live=false;this.paused=false;return ms;
    }
    toggle(mono,wall=Date.now()) {
      if (!this.paused) { this.anchorMs=this.value(mono,wall);this.travel=null; this.anchorMono=mono; this.paused=true; }
      else { this.anchorMono=mono; this.paused=false; }
    }
    now(mono,wall=Date.now()) { this.travel=null;this.anchorMs=wall; this.anchorMono=mono; this.rate=1; this.live=true; this.paused=false; }
  }
  return Object.freeze({DAY,TAU,DEG,J2000,MIN_TIME,MAX_TIME,CURRENT_START,CURRENT_END,OVERVIEW_ORBIT,BODIES,SUN,MOON,EUROPA,SATELLITES,SATELLITE_EPOCH,PLANETARY_ALIGNMENT_EVENTS,wrap,clamp,ephemerisTier,rotationAt,calibrateAt,modelStatus,modelYear,rotationPoleTilt,surfaceDirection,bodyAxes,siteSun,eccentricAnomaly,elementsAt,pointOnOrbit,displayDistance,positionAt,orbitAt,satelliteElements,moonElements,moonAt,europaAt,satelliteAt,satelliteOrbit,moonPhase,eclipseAlignment,europaShadowGeometry,eclipseEvent,planetaryAlignmentEvent,SimulationClock});
});
