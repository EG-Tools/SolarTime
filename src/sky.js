/* Solar Time v0.47 — sky implementation owner. */
(function(root){'use strict';
 const TAU=Math.PI*2,DEG=Math.PI/180,COS30=Math.sqrt(.75),REPLAY_MOMENTUM_SECONDS=6,J2000_OBLIQUITY=23.4392911*DEG,FEATURE_SKY_DEPTH=99,SKY_PANORAMA_OFFSET=0,FEATURE_HOVER=Object.freeze({delay:500,fadeIn:500,fade:600,hoverFade:2000,pulse:10000,traceDelay:300,traceStep:300,lineAlpha:.7,revealHold:5000,revealFade:2000}),FEATURE_QUIET_PADDING=.025;
const FEATURE_SPARKLE=Object.freeze({period:4.5,variation:3.5,rise:.18,fall:.38,base:.78,peak:.22,rayLength:1.4,rayAlpha:.28,rayWidth:.18,rotation:.28});
const FEATURE_PINNED_PULSE=Object.freeze({duration:10000,maxScale:1.3,minPeak:.34,peakRange:.32});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function clipGuideSegment(a,b,width,height,margin=20){
 let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x+margin],[dx,width+margin-a.x],[-dy,a.y+margin],[dy,height+margin-a.y]]){
  if(!p){if(q<0)return null;continue;}
  const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;
 }
 return [a.x+dx*lo,a.y+dy*lo,a.x+dx*hi,a.y+dy*hi];
}
const seededUnit=value=>{const x=Math.sin(value*12.9898)*43758.5453;return x-Math.floor(x);};
const edgeShadeStrength=()=>root.document?.documentElement?.classList?.contains('solar-phone-layout')?0:.24;
function equatorialDirection(raHours,declination){
 const ra=raHours*Math.PI/12,dec=declination*DEG,cd=Math.cos(dec),x=cd*Math.cos(ra),yEq=cd*Math.sin(ra),zEq=Math.sin(dec);
 return Object.freeze({x,y:Math.cos(J2000_OBLIQUITY)*yEq+Math.sin(J2000_OBLIQUITY)*zEq,z:-Math.sin(J2000_OBLIQUITY)*yEq+Math.cos(J2000_OBLIQUITY)*zEq});
}
 function panoramaDirection(u,v){
  const longitude=(u-.5)*TAU,latitude=(.5-v)*Math.PI,cosLatitude=Math.cos(latitude),p={x:cosLatitude*Math.cos(longitude),y:cosLatitude*Math.sin(longitude),z:Math.sin(latitude)};
  return Object.freeze(rotate(p,-Math.PI/6,'x'));
 }
 function tangentDirection(direction){
  let tangent={x:-direction.y,y:direction.x,z:0},length=Math.hypot(tangent.x,tangent.y,tangent.z);
  if(length<1e-5){tangent={x:1,y:0,z:0};length=1;}
  return Object.freeze({x:tangent.x/length,y:tangent.y/length,z:tangent.z/length});
 }
 // M31 keeps its real J2000 direction. The source coordinates remain only as
 // a compatibility fallback for the published panorama; local preview uses a
 // transparent atlas and never copies pixels out of the background texture.
 const ANDROMEDA_GALAXY=Object.freeze({direction:equatorialDirection(.7123,41.269),sourceU:.606,sourceV:.76,radius:.2,aspect:.52,gain:.9,cell:[0,0],angularSize:.075,alpha:.56,roll:0});
 const DECORATIVE_GALAXIES=Object.freeze([
  Object.freeze({direction:panoramaDirection(.83,.12),cell:[1,0],angularSize:.105,alpha:.44,roll:.35}),
  Object.freeze({direction:panoramaDirection(.39,.84),cell:[0,1],angularSize:.11,alpha:.46,roll:-.28})
 ]);
 const SKY_GALAXIES=Object.freeze([ANDROMEDA_GALAXY,...DECORATIVE_GALAXIES].map(galaxy=>Object.freeze({...galaxy,tangent:tangentDirection(galaxy.direction)})));
// SIMBAD ICRS J2000 positions. Unlike the decorative runtime star pool, these
// seven directions are permanent points on the celestial sphere.
const BIG_DIPPER=Object.freeze({
 id:'big-dipper',
 card:Object.freeze({category:'ASTERISM',english:'BIG DIPPER'}),
  style:Object.freeze({sizeScale:1.08,lightScale:5,coreAlpha:1,ambientGlow:.8,ambientRadiusScale:.62,activeGlowScale:.8,activeRadiusScale:.7,pointAlpha:1}),
 stars:Object.freeze([
   [54061,'Dubhe',11+3/60+43.67152/3600,61+45/60+3.7249/3600,1.79,'255,242,220'],
   [53910,'Merak',11+1/60+50.47975/3600,56+22/60+56.7611/3600,2.37,'238,245,255'],
   [58001,'Phecda',11+53/60+49.847/3600,53+41/60+41.14/3600,2.44,'237,244,255'],
   [59774,'Megrez',12+15/60+25.55985/3600,57+1/60+57.4211/3600,3.31,'241,246,255'],
   [62956,'Alioth',12+54/60+1.749/3600,55+57/60+35.36/3600,1.76,'235,243,255'],
   [65378,'Mizar',13+23/60+55.54/3600,54+55/60+31.27/3600,2.23,'239,245,255'],
   [67301,'Alkaid',13+47/60+32.43776/3600,49+18/60+47.7602/3600,1.85,'227,239,255']
  ].map(([hip,name,ra,dec,magnitude,color],index)=>Object.freeze({hip,name,ra,dec,magnitude,color,depth:FEATURE_SKY_DEPTH,motionSeed:(index+1)*1.6180339887,direction:equatorialDirection(ra,dec)}))),
 edges:Object.freeze([[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]].map(Object.freeze)),
 // Begin at Alkaid and follow the handle. Megrez then forks across both
 // bowl sides, which converge at Merak on the final beat.
 traceGroups:Object.freeze([[[6,5]],[[5,4]],[[4,3]],[[3,2],[3,0]],[[2,1],[0,1]]].map(group=>Object.freeze(group.map(Object.freeze))))
});
// Polaris (Alpha Ursae Minoris), SIMBAD ICRS J2000. Its point is deliberately
// uses the same style as the Big Dipper at 1.8 times its linear size.
const POLARIS_STYLE=Object.freeze({...BIG_DIPPER.style,sizeScale:BIG_DIPPER.style.sizeScale*1.8});
const POLARIS=Object.freeze({
 id:'polaris',
 card:Object.freeze({category:'STAR',english:'POLARIS'}),
 marker:Object.freeze({kind:'circle',diameterScale:2,color:'214,235,255'}),
 hitRadiusScale:2,
 style:POLARIS_STYLE,
 stars:Object.freeze([
   Object.freeze({hip:11767,name:'Polaris',style:POLARIS_STYLE,ra:2+31/60+49.09/3600,dec:89+15/60+50.8/3600,magnitude:1.98,color:'225,240,255',depth:FEATURE_SKY_DEPTH,motionSeed:11.326237921,direction:equatorialDirection(2+31/60+49.09/3600,89+15/60+50.8/3600)})
 ]),
 edges:Object.freeze([]),
 traceGroups:Object.freeze([])
});
// HYG v4.1 subset (David Nash / Astronexus), CC BY-SA 4.0.
// Positions are J2000 RA hours / declination degrees; colours are illustrative.
// This derived data table remains CC BY-SA 4.0; see assets/CREDITS.md.
const CATALOG_STAR_ROWS=Object.freeze([
 [48319,"Ups UMa",9.849867,59.038735,3.78,"F"],
 [41704,"Muscida",8.504431,60.718169,3.35,"G"],
 [46853,"The UMa",9.547715,51.6773,3.17,"F"],
 [44127,"Talitha",8.986828,48.041826,3.12,"A"],
 [44471,"Alkaphrah",9.060427,47.156525,3.57,"A"],
 [54539,"Psi UMa",11.161062,44.498487,3,"K"],
 [50801,"Tania Australis",10.372155,41.499516,3.06,"M"],
 [50372,"Tania Borealis",10.284952,42.914365,3.45,"A"],
 [57399,"Taiyangshou",11.767515,47.779406,3.69,"K"],
 [55219,"Alula Borealis",11.307983,33.094306,3.49,"K"],
 [48402,"Phi UMa",9.868433,54.064332,4.55,"A"],
 [46733,"23 UMa",9.525453,63.061861,3.65,"F"],
 [85822,"Yildun",17.536918,86.58646,4.35,"A"],
 [82080,"Eps UMi",16.766159,82.037262,4.21,"G"],
 [77055,"Zet UMi",15.734299,77.794493,4.29,"A"],
 [79822,"Eta UMi",16.291791,75.75533,4.95,"F"],
 [75097,"Pherkad",15.345483,71.834016,3,"A"],
 [72607,"Kochab",14.845105,74.155505,2.07,"K"],
 [746,"Caph",0.152887,59.14978,2.28,"F"],
 [3179,"Schedar",0.675116,56.537331,2.24,"K"],
 [4427,"Cih",0.945143,60.71674,2.15,"B"],
 [6686,"Ruchbah",1.430216,60.235283,2.66,"A"],
 [8886,"Segin",1.906584,63.670101,3.35,"B"],
 [27989,"Betelgeuse",5.919529,7.407063,0.45,"M"],
 [26207,"Meissa",5.585633,9.934158,3.39,"O"],
 [25336,"Bellatrix",5.418851,6.349702,1.64,"B"],
 [25930,"Mintaka",5.533445,-0.299092,2.25,"O"],
 [26311,"Alnilam",5.603559,-1.20192,1.69,"B"],
 [26727,"Alnitak",5.679313,-1.942572,1.74,"O"],
 [27366,"Saiph",5.795941,-9.669605,2.07,"B"],
 [24436,"Rigel",5.242298,-8.20164,0.18,"B"],
 [26241,"Hatysa",5.590551,-5.909901,2.75,"O"],
 [28691,"64 Orionis",6.057602,19.690561,5.14,"B"],
 [29426,"Xi Orionis",6.198999,14.208765,4.45,"B"],
 [29038,"Nu Orionis",6.126201,14.768472,4.42,"B"],
 [27913,"Chi-1 Orionis",5.906386,20.276174,4.39,"G"],
 [28614,"Mu Orionis",6.039722,9.647276,4.12,"A"],
 [22449,"Tabit",4.830669,6.961276,3.19,"F"],
 [22549,"Pi-4 Orionis",4.853434,5.605104,3.68,"B"],
 [22730,"5 Orionis",4.889659,2.508225,5.33,"M"],
 [23123,"Pi-6 Orionis",4.975806,1.714016,4.47,"K"],
 [22509,"Pi-2 Orionis",4.843534,8.900176,4.35,"A"],
 [22845,"Pi-1 Orionis",4.914924,10.150833,4.64,"A"],
 [78820,"Acrab",16.09062,-19.805453,2.56,"B"],
 [78401,"Dschubba",16.005557,-22.62171,2.29,"B"],
 [80112,"Alniyat",16.353143,-25.592796,2.9,"B"],
 [80763,"Antares",16.490128,-26.432002,1.06,"M"],
 [81266,"Paikauhale",16.598043,-28.216016,2.82,"B"],
 [82396,"Larawag",16.83608,-34.293232,2.29,"K"],
 [82514,"Xamidimura",16.864509,-38.04738,3,"B"],
 [82729,"Zet-2 Sco",16.909731,-42.361313,3.62,"K"],
 [84143,"Eta Sco",17.202552,-43.239189,3.32,"F"],
 [86228,"Sargas",17.62198,-42.997824,1.86,"F"],
 [87073,"Iot-1 Sco",17.793078,-40.126997,2.99,"F"],
 [86670,"Kap Sco",17.708132,-39.029983,2.39,"B"],
 [85927,"Shaula",17.560145,-37.103821,1.62,"B"],
 [85696,"Lesath",17.512732,-37.295811,2.7,"B"],
 [82671,"Zeta-1 Sco",16.899924,-42.362025,4.7,"B"],
 [78265,"Fang",15.980865,-26.114105,2.89,"B"],
 [49669,"Regulus",10.139532,11.967207,1.36,"B"],
 [49583,"Eta Leo",10.122209,16.762664,3.48,"A"],
 [50583,"Algieba",10.332873,19.841489,2.01,"K"],
 [50335,"Adhafera",10.278171,23.417311,3.43,"F"],
 [48455,"Rasalas",9.879398,26.006951,3.88,"K"],
 [47908,"Ras Elased Australis",9.764188,23.774255,2.97,"G"],
 [54872,"Zosma",11.235138,20.523717,2.56,"A"],
 [57632,"Denebola",11.817663,14.57206,2.14,"A"],
 [54879,"Chertan",11.237335,15.42957,3.33,"A"],
 [102098,"Deneb",20.690532,45.280338,1.25,"A"],
 [100453,"Sadr",20.370473,40.256679,2.23,"F"],
 [95947,"Albireo",19.512023,27.959681,3.05,"K"],
 [94779,"Kap Cyg",19.28504,53.368459,3.8,"K"],
 [95853,"Iot-2 Cyg",19.495098,51.729779,3.76,"A"],
 [97165,"Fawaris",19.749574,45.13081,2.86,"B"],
 [102488,"Aljanah",20.770178,33.970256,2.48,"K"],
 [104732,"Zet Cyg",21.215607,30.226916,3.21,"G"],
 [98110,"Eta Cyg",19.938438,35.083424,3.89,"K"],
 [107310,"Mu-1 Cyg",21.73571,28.742632,4.49,"F"],
 [25428,"Elnath",5.438198,28.60745,1.65,"B"],
 [20889,"Ain",4.476943,19.180431,3.53,"K"],
 [20455,"Secunda Hyadum",4.382247,17.542514,3.77,"G"],
 [20205,"Prima Hyadum",4.329889,15.627642,3.65,"G"],
 [20894,"Chamukuy",4.477705,15.870883,3.4,"A"],
 [21421,"Aldebaran",4.598677,16.509301,0.87,"K"],
 [26451,"Tianguan",5.627413,21.142549,2.97,"B"],
 [18724,"Lam Tau",4.011338,12.490347,3.41,"B"],
 [15900,"Omi Tau",3.413554,9.02887,3.61,"G"],
 [21881,"Tau Tauri",4.704084,22.956926,4.27,"B"],
 [20648,"Delta-3 Tauri",4.424828,17.92791,4.3,"A"],
 [17847,"Atlas",3.819373,24.053415,3.62,"B"],
 [13209,"Bharani",2.833063,27.260507,3.61,"B"],
 [9884,"Hamal",2.119555,23.462423,2.01,"K"],
 [8903,"Sheratan",1.910668,20.808035,2.64,"A"],
 [8832,"Mesarthim",1.89217,19.293852,3.88,"A"],
 [37826,"Pollux",7.755277,28.026199,1.16,"K"],
 [36962,"Upsilon Geminorum",7.598708,26.895741,4.06,"K"],
 [35550,"Wasat",7.335383,21.98232,3.5,"F"],
 [34088,"Mekbuda",7.068481,20.570297,4.01,"G"],
 [31681,"Alhena",6.628528,16.399252,1.93,"A"],
 [36850,"Castor",7.576634,31.888276,1.58,"A"],
 [34693,"Tau Geminorum",7.185659,30.245163,4.41,"K"],
 [32246,"Mebsuta",6.732202,25.131124,3.06,"A"],
 [30343,"Tejat",6.382673,22.513586,2.87,"M"],
 [29655,"Propus",6.247961,22.506799,3.31,"M"],
 [28734,"1 Geminorum",6.068671,23.263341,4.16,"G"],
 [32362,"Alzirr",6.754824,12.895591,3.35,"F"],
 [35350,"Lambda Geminorum",7.30155,16.540383,3.58,"A"],
 [37740,"Kappa Geminorum",7.740793,24.397993,3.57,"G"],
 [36046,"Iota Geminorum",7.428779,27.79808,3.78,"G"],
 [33018,"Theta Geminorum",6.879816,33.961254,3.6,"A"],
 [30883,"Nu Geminorum",6.482719,20.212133,4.13,"B"],
 [43103,"Iota Cancri",8.778284,28.759898,4.03,"G"],
 [42806,"Asellus Borealis",8.721431,21.468501,4.66,"A"],
 [42911,"Asellus Australis",8.74475,18.154309,3.94,"K"],
 [40526,"Tarf",8.275256,9.185545,3.53,"K"],
 [44066,"Acubens",8.974784,11.857701,4.26,"A"],
 [40843,"Chi Cancri",8.334406,27.217707,5.13,"F"],
 [57380,"Nu Virginis",11.764322,6.529376,4.04,"M"],
 [60129,"Zaniah",12.331766,-0.666803,3.89,"A"],
 [61941,"Porrima",12.694345,-1.449375,2.74,"F"],
 [65474,"Spica",13.419883,-11.161322,0.98,"B"],
 [69427,"Kang",14.214929,-10.273702,4.18,"K"],
 [69701,"Syrma",14.266908,-6.000547,4.07,"F"],
 [71957,"Mu Virginis",14.717673,-5.658207,3.87,"F"],
 [66249,"Heze",13.57822,-0.59582,3.38,"A"],
 [68520,"Tau Virginis",14.027443,1.544532,4.23,"A"],
 [72220,"109 Virginis",14.770812,1.892885,3.73,"A"],
 [63090,"Minelauva",12.926725,3.39747,3.39,"M"],
 [63608,"Vindemiatrix",13.036278,10.95915,2.85,"G"],
 [60030,"13 Virginis",12.311199,-0.787184,5.9,"A"],
 [77853,"Theta Librae",15.897093,-16.729293,4.13,"K"],
 [76333,"Zubenelhakrabi",15.592105,-14.789537,3.91,"K"],
 [74785,"Zubeneschamali",15.283449,-9.382917,2.61,"B"],
 [72622,"Zubenelgenubi",14.847977,-16.041778,2.75,"A"],
 [73714,"Brachium",15.067839,-25.281965,3.25,"M"],
 [88635,"Alnasl",18.096803,-30.424091,2.98,"K"],
 [89931,"Kaus Media",18.3499,-29.828103,2.72,"K"],
 [90185,"Kaus Australis",18.402868,-34.384616,1.79,"B"],
 [93506,"Ascella",19.043532,-29.880105,2.6,"A"],
 [92041,"Phi Sagittarii",18.76094,-26.990778,3.17,"B"],
 [90496,"Kaus Borealis",18.466179,-25.4217,2.82,"K"],
 [89341,"Polis",18.229392,-21.058834,3.84,"B"],
 [93864,"Tau Sagittarii",19.11567,-27.670423,3.32,"K"],
 [92855,"Nunki",18.92109,-26.296722,2.05,"B"],
 [93085,"Xi-2 Sagittarii",18.962167,-21.106654,3.52,"G"],
 [93683,"Omicron Sagittarii",19.07805,-21.741496,3.76,"K"],
 [89642,"Eta Sagittarii",18.293793,-36.761686,3.1,"M"],
 [87072,"3 Sagittarii",17.792674,-27.830788,4.53,"F"],
 [94820,"43 Sagittarii",19.293911,-18.952908,4.88,"K"],
 [95168,"Rho-1 Sagittarii",19.361211,-17.847197,3.92,"F"],
 [96406,"51 Sagittarii",19.600459,-24.719081,5.64,"A"],
 [98688,"62 Sagittarii",20.044299,-27.709845,4.43,"M"],
 [98412,"Theta-1 Sagittarii",19.995605,-35.276305,4.37,"B"],
 [98032,"Iota Sagittarii",19.921026,-41.868288,4.12,"K"],
 [95347,"Rukbat",19.398103,-40.61594,3.96,"B"],
 [95294,"Arkab Posterior",19.386976,-44.799778,4.27,"F"],
 [100064,"Algedi",20.300904,-12.544852,3.58,"G"],
 [100345,"Dabih",20.350187,-14.781367,3.05,"A"],
 [104139,"Theta Capricorni",21.099118,-17.232861,4.08,"A"],
 [105515,"Iota Capricorni",21.370776,-16.834542,4.28,"G"],
 [106985,"Nashira",21.668181,-16.662308,3.69,"A"],
 [107556,"Deneb Algedi",21.784011,-16.127286,2.85,"A"],
 [105881,"Zeta Capricorni",21.444452,-22.411332,3.77,"G"],
 [102978,"Omega Capricorni",20.863692,-26.919133,4.12,"K"],
 [102485,"Psi Capricorni",20.76826,-25.270898,4.13,"F"],
 [102618,"Albali",20.794598,-9.495776,3.78,"A"],
 [106278,"Sadalsuud",21.525982,-5.571172,2.9,"G"],
 [109074,"Sadalmelik",22.096399,-0.319851,2.95,"G"],
 [110395,"Sadachbia",22.360938,-1.387331,3.86,"A"],
 [110960,"Zeta-1 Aquarii",22.480531,-0.019972,3.65,"F"],
 [111497,"Eta Aquarii",22.589272,-0.117498,4.04,"B"],
 [112961,"Lambda Aquarii",22.87691,-7.579599,3.73,"M"],
 [114855,"Psi-1 Aquarii",23.264859,-9.087737,4.24,"K"],
 [115438,"98 Aquarii",23.382842,-20.10058,3.96,"K"],
 [110003,"Ancha",22.280565,-7.78329,4.17,"G"],
 [109139,"Iota Aquarii",22.107286,-13.869679,4.29,"B"],
 [112716,"Tau-2 Aquarii",22.826528,-13.592632,4.05,"K"],
 [113136,"Skat",22.910837,-15.82082,3.27,"A"],
 [114341,"88 Aquarii",23.157443,-21.17241,3.68,"K"],
 [111123,"Sigma Aquarii",22.510782,-10.67795,4.82,"A"],
 [4889,"Sigma Piscium",1.046971,31.804263,5.5,"B"],
 [5742,"Phi Piscium",1.229152,24.583713,4.67,"K"],
 [6193,"Upsilon Piscium",1.324443,27.264059,4.74,"A"],
 [7097,"Alpherg",1.524725,15.345823,3.62,"G"],
 [8198,"Torcular",1.756564,9.157736,4.26,"K"],
 [9487,"Alrescha",2.034117,2.763759,3.82,"A"],
 [8833,"Xi Piscium",1.892597,3.187536,4.61,"K"],
 [7884,"Nu Piscium",1.690526,5.487613,4.45,"K"],
 [7007,"Mu Piscium",1.503087,6.14382,4.84,"K"],
 [4906,"Epsilon Piscium",1.049058,7.890135,4.27,"K"],
 [3760,"62 Piscium",0.804836,7.299928,5.92,"G"],
 [1645,"41 Piscium",0.343295,8.190271,5.38,"K"],
 [118268,"Omega Piscium",23.988525,6.863321,4.03,"F"],
 [116771,"Iota Piscium",23.665844,5.626292,4.13,"F"],
 [117245,"19 Piscium",23.773199,3.486811,4.95,"A"],
 [116928,"Lambda Piscium",23.700779,1.780041,4.49,"A"],
 [115738,"Kappa Piscium",23.448876,1.255608,4.95,"A"],
 [114971,"Gamma Piscium",23.286094,3.282289,3.7,"G"],
 [115227,"7 Piscium",23.339051,5.381307,5.05,"K"],
 [115830,"Theta Piscium",23.466138,6.378992,4.27,"K"],
 [3786,"Delta Piscium",0.811373,7.585079,4.44,"K"],
 [677,"Alpheratz",0.139791,29.090432,2.07,"B"],
 [1067,"Algenib",0.220598,15.183596,2.83,"B"],
 [113963,"Markab",23.079348,15.205264,2.49,"B"],
 [113881,"Scheat",23.062901,28.082789,2.44,"M"],
 [112158,"Matar",22.716704,30.221245,2.93,"G"],
 [109352,"Pi-1 Pegasi",22.153789,33.172337,5.58,"G"],
 [112748,"Sadalbari",22.833385,24.601579,3.51,"M"],
 [112440,"Lambda Pegasi",22.775521,23.565654,3.97,"G"],
 [109176,"Iota Pegasi",22.116847,25.345112,3.77,"F"],
 [107354,"Kappa Pegasi",21.744092,25.645036,4.14,"F"],
 [112447,"Xi Pegasi",22.778216,12.172888,4.2,"F"],
 [112029,"Homam",22.691033,10.831364,3.41,"B"],
 [109427,"Biham",22.169996,6.197865,3.52,"A"],
 [107315,"Enif",21.736433,9.875011,2.38,"K"],
 [3092,"Delta Andromedae",0.655462,30.861024,3.27,"K"],
 [5447,"Mirach",1.162194,35.620558,2.07,"M"],
 [9640,"Almach",2.064984,42.329725,2.1,"B"],
 [4436,"Mu Andromedae",0.945885,38.499345,3.86,"A"],
 [3881,"Nu Andromedae",0.830234,41.078911,4.53,"B"],
 [61084,"Gacrux",12.519429,-57.113212,1.59,"M"],
 [60718,"Acrux",12.443311,-63.099092,0.77,"B"],
 [62434,"Mimosa",12.795359,-59.688764,1.25,"B"],
 [59747,"Imai",12.252427,-58.748928,2.79,"B"],
 [765,"Eps Phe",0.156836,-45.747426,3.88,"K"],
 [2072,"Kap Phe",0.436716,-43.679829,3.93,"A"],
 [2081,"Ankaa",0.438056,-42.305981,2.4,"K"],
 [5165,"Bet Phe",1.101407,-46.718414,3.32,"G"],
 [5348,"Wurren",1.139742,-55.24576,3.94,"B"],
 [6867,"Gam Phe",1.472759,-43.318234,3.41,"K"],
 [7083,"Del Phe",1.520851,-49.072702,3.93,"K"],
 [8837,"Psi Phe",1.894102,-46.302669,4.39,"M"],
 [30438,"Canopus",6.399195,-52.69566,-0.62,"F"],
 [31685,"Nu  Pup",6.629353,-43.195934,3.17,"B"],
 [39429,"Naos",8.059737,-40.003148,2.21,"O"],
 [39953,"Gam2Vel",8.158876,-47.336588,1.75,"W"],
 [41037,"Avior",8.375236,-59.509483,1.86,"K"],
 [42536,"42536",8.671554,-52.921887,3.6,"B"],
 [42568,"42568",8.676953,-59.761003,4.31,"B"],
 [42913,"Alsephina",8.745059,-54.708821,1.93,"A"],
 [44816,"Suhail",9.133268,-43.432589,2.23,"K"],
 [45080,"45080",9.182804,-58.966896,3.43,"B"],
 [45238,"Miaplacidus",9.220041,-69.717208,1.67,"A"],
 [45556,"Aspidiske",9.284838,-59.275229,2.21,"A"],
 [45941,"Markeb",9.368562,-55.010668,2.47,"B"],
 [46651,"Psi Vel",9.511674,-40.466769,3.6,"F"],
 [48774,"Phi Vel",9.947708,-54.56779,3.52,"B"],
 [50099,"Ome Car",10.228961,-70.037903,3.29,"B"],
 [50191,"50191",10.245607,-42.121942,3.85,"A"],
 [50371,"50371",10.28472,-61.332304,3.39,"K"],
 [51232,"51232",10.464649,-58.739403,3.81,"F"],
 [51986,"51986",10.621717,-48.22562,3.84,"A"],
 [52419,"The Car",10.715949,-64.39445,2.74,"B"],
 [52468,"52468",10.725639,-60.566619,4.58,"K"],
 [52727,"Mu  Vel",10.779488,-49.420255,2.69,"G"],
 [53253,"53253",10.891559,-58.853171,3.78,"K"],
 [54463,"54463",11.143165,-58.975037,3.93,"G"],
 [56480,"56480",11.579355,-54.264091,4.62,"B"],
 [56561,"Lam Cen",11.596363,-63.019841,3.11,"B"],
 [59196,"Del Cen",12.13931,-50.722425,2.58,"B"],
 [60823,"Sig Cen",12.467331,-50.230635,3.91,"B"],
 [61932,"Gam Cen",12.691971,-48.959888,2.2,"A"],
 [65109,"Iot Cen",13.343296,-36.712295,2.75,"A"],
 [65936,"65936",13.517405,-39.407307,3.9,"G"],
 [66657,"Eps Cen",13.664796,-53.466394,2.29,"B"],
 [67464,"Nu  Cen",13.825078,-41.687709,3.41,"B"],
 [67472,"Mu  Cen",13.826943,-42.473732,3.47,"B"],
 [68002,"Zet Cen",13.925667,-47.288375,2.55,"B"],
 [68282,"Ups1Cen",13.977987,-44.803584,3.87,"B"],
 [68702,"Hadar",14.063729,-60.373039,0.61,"B"],
 [68933,"Menkent",14.111395,-36.369954,2.06,"K"],
 [71352,"Eta Cen",14.591786,-42.157824,2.33,"B"],
 [71683,"Rigil Kentaurus",14.660765,-60.833976,-0.01,"G"],
 [73334,"Kap Cen",14.986025,-42.104194,3.13,"B"],
 [74946,"Gam TrA",15.315181,-68.679545,2.87,"A"],
 [77952,"Bet TrA",15.919083,-63.430727,2.83,"F"],
 [82273,"Atria",16.811077,-69.027715,1.91,"K"],
 [86929,"Eta Pav",17.762221,-64.723871,3.61,"K"],
 [88866,"Pi  Pav",18.143,-63.668553,4.33,"A"],
 [90098,"Xi  Pav",18.387117,-61.493901,4.35,"M"],
 [91792,"Zet Pav",18.71726,-71.428113,4.01,"K"],
 [92609,"Lam Pav",18.870288,-62.187593,4.22,"B"],
 [93015,"Kap Pav",18.949177,-67.233495,4.4,"F"],
 [98495,"Eps Pav",20.009845,-72.910504,3.97,"A"],
 [99240,"Del Pav",20.145157,-66.182068,3.55,"G"],
 [100751,"Peacock",20.427459,-56.73509,1.94,"B"],
 [102395,"Bet Pav",20.749314,-66.203212,3.42,"A"],
 [105858,"Gam Pav",21.440705,-65.366198,4.21,"F"],
 [108085,"Aldhanab",21.898808,-37.364852,3,"B"],
 [109111,"Lam Gru",22.101914,-39.543353,4.47,"M"],
 [109268,"Alnair",22.137209,-46.960975,1.73,"B"],
 [110997,"Del1Gru",22.487825,-43.495565,3.97,"G"],
 [112122,"Tiaki",22.711115,-46.884577,2.07,"M"],
 [112623,"Eps Gru",22.809239,-51.316864,3.49,"A"],
 [113638,"Zet Gru",23.014677,-52.754137,4.11,"G"],
 [114131,"The Gru",23.11465,-43.520358,4.28,"F"],
 [114421,"Iot Gru",23.17264,-45.246711,3.88,"K"],
].map(Object.freeze));
const CATALOG_STARS=new Map([
 [54061,BIG_DIPPER.stars[0]],
 [53910,BIG_DIPPER.stars[1]],
 [58001,BIG_DIPPER.stars[2]],
 [59774,BIG_DIPPER.stars[3]],
 [62956,BIG_DIPPER.stars[4]],
 [65378,BIG_DIPPER.stars[5]],
 [67301,BIG_DIPPER.stars[6]],
 [11767,POLARIS.stars[0]],
]);
const SPECTRAL_TONES=Object.freeze({O:'222,235,255',B:'227,239,255',A:'239,245,255',F:'255,249,235',G:'255,242,218',K:'255,221,181',M:'255,201,160'});
for(const [hip,name,ra,dec,magnitude,spectrum] of CATALOG_STAR_ROWS)CATALOG_STARS.set(hip,Object.freeze({hip,name:name||String(hip),ra,dec,magnitude,color:SPECTRAL_TONES[spectrum]||SPECTRAL_TONES.A,depth:FEATURE_SKY_DEPTH,motionSeed:hip*1.6180339887,direction:equatorialDirection(ra,dec)}));
// Recognisable Western guide topology adapted from Stellarium's Western sky
// culture (CC BY-SA). These are stick figures, not IAU boundaries.
const CONSTELLATION_ROWS=Object.freeze([
 ["ursa-major","Ursa Major",[[67301,65378,62956,59774,54061,53910,58001,59774],[58001,57399,54539,50372],[54539,50801],[53910,48402,46853,44471],[46853,44127],[48402,48319,41704,46733,54061]]],
 ["ursa-minor","Ursa Minor",[[11767,85822,82080,77055,79822,75097,72607,77055]]],
 ["cassiopeia","Cassiopeia",[[746,3179,4427,6686,8886]]],
 ["orion","Orion",[[26727,26311,25930],[28691,29426,29038,27913],[29426,28614,27989,26727,27366,24436,25930,25336,26207,27989],[25336,22449,22549,22730,23123],[22449,22509,22845],[29038,28614]]],
 ["scorpius","Scorpius",[[85927,86670,87073,86228,84143,82671,82514,82396,81266,80763,78401],[80763,78265],[80763,78820]]],
 ["leo","Leo",[[49669,49583,50583,50335,48455,47908],[50583,54872,57632,54879,49669],[54879,54872]]],
 ["cygnus","Cygnus",[[94779,95853,97165,100453,102098],[100453,102488,104732,107310],[100453,98110,95947]]],
 ["taurus","Taurus",[[25428,21881,20889],[21421,26451],[20205,20455],[20205,18724,15900],[21421,20889],[21421,20894,20205],[20889,20648,20455,17847]]],
 ["aries","Aries",[[13209,9884,8903,8832]]],
 ["gemini","Gemini",[[31681,34088,35550,35350,32362],[35550,36962,37740],[36962,37826],[36962,36046,34693,36850],[34693,33018],[34693,32246,30883],[32246,30343,29655,28734]]],
 ["cancer","Cancer",[[43103,42806,40843],[42806,42911,40526],[42911,44066]]],
 ["virgo","Virgo",[[57380,60030,61941,65474,69427,69701,71957],[65474,66249,68520,72220],[66249,63090,63608],[63090,61941]]],
 ["libra","Libra",[[77853,76333,74785,72622,73714,76333]]],
 ["sagittarius","Sagittarius",[[89931,90496],[89642,90185,88635,87072],[88635,89931,90185,93506,92041,89931],[92041,90496,89341],[93506,93864,92855,92041],[92855,93085,93683,94820,95168],[93864,96406,98688,98412,98032,95347],[98032,95294]]],
 ["capricornus","Capricornus",[[100064,100345,104139,105515,106985,107556],[105515,105881,104139],[100345,102485],[104139,102978]]],
 ["aquarius","Aquarius",[[106278,109074,110395,110960,111497,112961,114855,115438],[109074,110003,109139],[110003,111123,112716,113136,114341],[102618,106278]]],
 ["pisces","Pisces",[[4889,5742],[4889,6193,5742,7097,8198,9487,8833,7884,7007,4906,3786,1645,118268,116771,116928,115738,114971,115830,116771]]],
 ["pegasus","Pegasus",[[677,1067,113963,113881,677],[113881,112158,109352],[113881,112748,112440,109176,107354],[113963,112447,112029,109427,107315]]],
 ["andromeda","Andromeda",[[677,3092,5447,9640],[5447,4436,3881]]],
 ["crux","Crux",[[61084,60718],[62434,59747]]],
 ["centaurus","Centaurus",[[71683,68702,66657,68002,68282,67472,67464,65936,65109],[67464,68933],[67472,71352,73334],[68002,61932,60823,59196,56480,56561]]],
 ["carina","Carina",[[45238,50099,52419,52468,54463,53253,51232,50371,45556],[42568,41037,30438],[45080,45556],[45080,42568],[30438,31685],[41037,39429]]],
 ["vela","Vela",[[39953,42536,42913,45941,48774,52727,51986,50191,46651,44816,39953]]],
 ["triangulum-australe","Triangulum Australe",[[82273,74946,77952,82273]]],
 ["pavo","Pavo",[[100751,105858,102395,99240,100751],[99240,98495,91792,93015,99240],[93015,92609,90098,88866,92609],[88866,86929]]],
 ["grus","Grus",[[114131,110997,109268,112122,114421,114131],[112122,113638],[112122,112623],[109268,109111,108085]]],
 ["phoenix","Phoenix",[[5348,5165,2072,5348],[5165,7083,8837,5165,6867,2072,2081,765,2072]]],
]);
function constellationFeature([id,english,paths]){
 const hips=[...new Set(paths.flat())],stars=Object.freeze(hips.map(hip=>CATALOG_STARS.get(hip))),edges=[],seen=new Set();
 for(const path of paths)for(let i=1;i<path.length;i++){const edge=[hips.indexOf(path[i-1]),hips.indexOf(path[i])],key=[...edge].sort((a,b)=>a-b).join(':');if(!seen.has(key)){seen.add(key);edges.push(Object.freeze(edge));}}
 const pending=new Set(edges),reached=new Set([0]),traceGroups=[];
 while(pending.size){const group=[];for(const edge of pending)if(reached.has(edge[0])||reached.has(edge[1]))group.push(reached.has(edge[0])?edge:Object.freeze([edge[1],edge[0]]));
  if(!group.length){reached.add(pending.values().next().value[0]);continue;}
  for(const edge of edges)if(group.some(link=>link.includes(edge[0])&&link.includes(edge[1])))pending.delete(edge);
  for(const [a,b] of group){reached.add(a);reached.add(b);}traceGroups.push(Object.freeze(group));
 }
 return Object.freeze({id,stars,edges:Object.freeze(edges),traceGroups:Object.freeze(traceGroups),style:BIG_DIPPER.style,card:Object.freeze({category:'CONSTELLATION',english:english.toUpperCase()})});
}
const SKY_FEATURES=Object.freeze(Object.fromEntries([BIG_DIPPER,POLARIS,...CONSTELLATION_ROWS.map(constellationFeature)].map(feature=>[feature.id,feature])));
const FEATURE_RELATION_FADE=700,FEATURE_GUIDE_GOLD=Object.freeze([233,189,103]),FEATURE_GUIDE_ICE=Object.freeze([210,232,255]),FEATURE_RELATIONS=new Map(Object.keys(SKY_FEATURES).map(id=>[id,new Set()]));
{
 const features=Object.values(SKY_FEATURES);
 for(let i=0;i<features.length;i++)for(let j=i+1;j<features.length;j++)if(features[i].stars.some(star=>features[j].stars.includes(star))){FEATURE_RELATIONS.get(features[i].id).add(features[j].id);FEATURE_RELATIONS.get(features[j].id).add(features[i].id);}
}
// Catalogue topology is immutable. Resolve shared edges once, not per frame.
const FEATURE_EDGE_KEYS=new Map(Object.values(SKY_FEATURES).map(feature=>[feature,new Map(feature.edges.flatMap(([a,b])=>{const key=[feature.stars[a].name,feature.stars[b].name].sort().join('|');return [[a+':'+b,key],[b+':'+a,key]];}))]));
const FEATURE_TRACE_GROUPS=new Map(Object.values(SKY_FEATURES).map(feature=>[feature,feature.traceGroups||feature.edges.map(edge=>[edge])]));
const featureTraceDuration=id=>FEATURE_HOVER.traceStep*Math.max(1,SKY_FEATURES[id]?.traceGroups?.length||0);
function featureDirection(feature){
 const sum=feature.stars.reduce((out,star)=>({x:out.x+star.direction.x,y:out.y+star.direction.y,z:out.z+star.direction.z}),{x:0,y:0,z:0}),length=Math.hypot(sum.x,sum.y,sum.z)||1;
 return Object.freeze({x:sum.x/length,y:sum.y/length,z:sum.z/length});
}
function segmentDistance(x,y,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;if(length2<1e-8)return Math.hypot(x-a.x,y-a.y);
 const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/length2,0,1);return Math.hypot(x-(a.x+dx*t),y-(a.y+dy*t));
}
function samplePanorama(tex,u,v,out,index=0){
 const w=tex.width,h=tex.height,tx=((u%1+1)%1)*w-.5,ty=clamp(v*h-.5,0,h-1);
 const ix=Math.floor(tx),y0=Math.floor(ty),x0=(ix%w+w)%w,x1=(x0+1)%w,y1=Math.min(h-1,y0+1),fx=tx-ix,fy=ty-y0;
 const a=(y0*w+x0)*4,b=(y0*w+x1)*4,c=(y1*w+x0)*4,d=(y1*w+x1)*4;
 const wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy,data=tex.data;
 for(let k=0;k<3;k++)out[index+k]=data[a+k]*wa+data[b+k]*wb+data[c+k]*wc+data[d+k]*wd;
}
function cometPoint(path,t){
 const f=clamp(t,0,1),u=1-f,q={};
 for(const a of ['x','y','z'])q[a]=u*u*u*path.start[a]+3*u*u*f*path.control1[a]+3*u*f*f*path.control2[a]+f*f*f*path.end[a];
 const n=Math.hypot(q.x,q.y,q.z)||1;return {x:q.x/n,y:q.y/n,z:q.z/n};
}
function cometTail(path,t,project,samples=96){
 const points=[],start=Math.max(0,t-.115);
 for(let i=0;i<=samples;i++){
  const point=project(cometPoint(path,start+(t-start)*i/samples));
  if(!point){points.length=0;continue;}
  const previous=points[points.length-1];
  if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>.03)points.push(point);
 }
 return points;
}
function drawCometRibbon(ctx,points,opacity=1){
 if(points.length<2)return;
 const first=points[0],last=points[points.length-1],count=points.length;
 let length=0;for(let i=1;i<count;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 if(length<.1)return;
 const normals=points.map((point,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(count-1,i+1)],d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:-(b.y-a.y)/d,y:(b.x-a.x)/d};});
 ctx.save();ctx.globalCompositeOperation='screen';ctx.setLineDash([]);
 for(const [width,alpha] of [[5.2,.035],[3.6,.055],[2.3,.08],[1.25,.13],[.48,.21]]){
  const gradient=ctx.createLinearGradient(first.x,first.y,last.x,last.y);
  gradient.addColorStop(0,'rgba(143,178,208,0)');gradient.addColorStop(.28,`rgba(149,184,212,${alpha*.15*opacity})`);
  gradient.addColorStop(.72,`rgba(176,209,232,${alpha*.64*opacity})`);gradient.addColorStop(1,`rgba(229,240,249,${alpha*opacity})`);
  ctx.fillStyle=gradient;ctx.beginPath();
  for(let side=0;side<2;side++)for(let j=0;j<count;j++){
   const i=side?count-1-j:j,f=i/(count-1),p=points[i],n=normals[i];
   const envelope=Math.sin(Math.PI*Math.pow(f,.65))*.78+.12*f,offset=width*envelope*(side?-1:1);
   const x=p.x+n.x*offset,y=p.y+n.y*offset;if(!side&&!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function rand(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function starField(source,total=4400){
 if(source instanceof Float32Array&&source.length>=6)return source;
 const field=(Array.isArray(source)?source:[]).filter(star=>Array.isArray(star)&&star.length>=6).map(star=>star.slice(0,6));
 const random=rand(204031),target=Math.max(total,field.length);
 while(field.length<target){
  const z=random()*2-1,angle=random()*TAU,radius=Math.sqrt(Math.max(0,1-z*z)),rare=random();
  field.push([Math.cos(angle)*radius,Math.sin(angle)*radius,z,.28+Math.pow(rare,7)*.92,.16+random()*.32+(rare>.985?.18:0),random()*12]);
 }
 return field;
}
function shader(g,type,source){
 const s=g.createShader(type);if(!s)throw Error('Cannot allocate sky shader');
 g.shaderSource(s,source);g.compileShader(s);
 if(!g.getShaderParameter(s,g.COMPILE_STATUS)){const error=g.getShaderInfoLog(s);g.deleteShader(s);throw Error(error||'Sky shader compilation failed');}
 return s;
}
function rotate(p,angle,axis){const c=Math.cos(angle),s=Math.sin(angle);return axis==='z'?{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z}:{x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};}
 function rasterSize(w,h,moving){
 const desired=moving?320:512,budget=moving?90000:160000;
 const width=Math.max(1,Math.floor(Math.min(desired,Math.sqrt(budget*w/h))));
  return [width,Math.max(1,Math.floor(Math.min(budget/width,width*h/w)))];
 }
 function skySources(asset,width=2048){
  if(typeof asset==='string')return [asset];
  const tiers=asset?.tiers||[],tier=tiers.find(row=>row.width>=width)||tiers[tiers.length-1],remote=tier&&asset.base?new URL(tier.path,asset.base).href:'';
  return [remote,asset?.fallback].filter((url,index,list)=>url&&list.indexOf(url)===index);
 }
 function decodeSkyImage(image,signal,timeoutMs=15000){
  return new Promise((resolve,reject)=>{
   let settled=false;
   const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener?.('abort',abort);error?reject(error):resolve(image);};
   const abort=()=>{image.src='';finish(Error('Sky image request was cancelled.'));};
   const timer=setTimeout(()=>{image.src='';finish(Error('Sky image request timed out.'));},timeoutMs);
   if(signal?.aborted){abort();return;}signal?.addEventListener?.('abort',abort,{once:true});
   image.decode().then(()=>finish(),finish);
  });
 }
 async function loadSkyImage(asset,width=2048,signal){
  let lastError;
  for(const url of skySources(asset,width))try{const image=new Image();image.decoding='async';if(!url.startsWith('file:')&&!url.startsWith('data:'))image.crossOrigin='anonymous';image.src=url;await decodeSkyImage(image,signal);return image;}catch(error){lastError=error;if(signal?.aborted)break;}
  throw lastError||Error('Sky asset could not be decoded.');
 }
class Sky{
 constructor(canvas){
   this.canvas=canvas;this.ready=false;this.disposed=false;this.paused=false;
   this.featureTracked=null;this.featurePinned=new Set();this.featureDisplayMaster=true;this.featurePinnedTransitions=new Map();this.featureTransientTransitions=new Map();this.featureRelationFocusId=null;this.featureRelationTransitions=new Map();
  this.abort=new AbortController();this.gl=null;this.initTicket=0;this.softwareEpoch=0;this.detailRequested=false;this.detailPromise=null;
  this.stats={backend:'loading',frames:0,skipped:0,starProjections:0};
  this.random=rand(610639);this.comet=null;this.nextComet=18+this.random()*22;this.lastTime=0;
    // The Milky Way, catalogue stars and constellations now share one stable
    // celestial frame across reloads, openings and warp reconstruction.
    const separateGalaxyAtlas=!!root.SolarAssets?.sky?.galaxyAtlas;
    this.offset=SKY_PANORAMA_OFFSET;this.fixedGalaxy=Object.freeze({...this.toPanorama(ANDROMEDA_GALAXY.direction),radius:separateGalaxyAtlas?0:ANDROMEDA_GALAXY.radius});this.tanFov=Math.tan(30.4*Math.PI/180);this.lastGPU=-Infinity;
    this.galaxies=Object.freeze((root.SolarAssets?.sky?.galaxyIndices||[0,1,2]).map(index=>SKY_GALAXIES[index]).filter(Boolean));
    this.galaxyAtlas=null;this.loadGalaxyAtlas(root.SolarAssets?.sky?.galaxyAtlas);
  this.rayTables=new Map();this.visibleStars=[];this.cameraMotionAt=-Infinity;
  this.gamma=new Float32Array(4096);for(let i=0;i<4096;i++)this.gamma[i]=Math.pow(i/4095,.95)*255*.5896;
  canvas.addEventListener('webglcontextlost',e=>{
   e.preventDefault();this.initTicket++;this.ready=false;this.detailPromise=null;this.stats.backend='context-lost';
   this.texture=this.quietTexture=this.buffer=this.program=this.starBuffer=this.starProgram=null;this.starA=this.starU=null;this.cancelSoftware();this.invalidate();
  },{signal:this.abort.signal});
  canvas.addEventListener('webglcontextrestored',()=>{if(!this.disposed){this.invalidate();this.initialize();}},{signal:this.abort.signal});
  this.initialize();
 }
 invalidate(){this.lastPose=null;this.lastKey='';this.lastGPU=-Infinity;this.starPose=null;}
 memoryUsage(){
  const active=!!this.gl&&!this.disposed&&this.ready;
  const textures=(active&&this.texture?(this.stats.textureSize?.[0]||0)*(this.stats.textureSize?.[1]||0)*4*4/3:0)+(active&&this.quietTexture?(this.quietMask?.pixels.byteLength||0):0);
  const buffers=active?(this.buffer?48:0)+(this.starBuffer?this.starCount*24:0):0;
  const framebufferEstimate=active?this.canvas.width*this.canvas.height*4:0;
  return {textures,buffers,framebufferEstimate,knownBytes:textures+buffers,totalEstimate:textures+buffers+framebufferEstimate};
 }
  loadGalaxyAtlas(url){
   if(!url)return null;
   const image=new Image();image.decoding='async';if(!url.startsWith('file:')&&!url.startsWith('data:'))image.crossOrigin='anonymous';image.src=url;
   this.galaxyAtlasPromise=decodeSkyImage(image,null).then(()=>{
    if(this.disposed)return null;
    // Match the panorama exposure once, not with a filter on every frame.
    // Luminance feathers the faint opaque haze in the source into the sky.
    const atlas=document.createElement('canvas');atlas.width=image.width;atlas.height=image.height;
    const context=atlas.getContext('2d');context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,atlas.width,atlas.height),data=pixels.data,tone=new Uint8ClampedArray(256);
    for(let value=0;value<256;value++)tone[value]=Math.pow(value/255,.95)*255*.5984;
    for(let i=0;i<data.length;i+=4){
     const luminance=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
     const edge=clamp((luminance-.035)/.465,0,1);
     const feather=edge*edge*(3-2*edge);
     // Retain the luminous core while suppressing the diffuse outer haze.
     data[i+3]*=feather*(.35+.65*feather);
     data[i]=tone[data[i]];data[i+1]=tone[data[i+1]];data[i+2]=tone[data[i+2]];
    }
    context.putImageData(pixels,0,0);this.galaxyAtlas=atlas;this.stats.galaxyAtlas=[atlas.width,atlas.height];return atlas;
   }).catch(error=>{if(!this.disposed)this.stats.galaxyAtlasError=String(error.message||error);return null;});
   return this.galaxyAtlasPromise;
  }
 async uploadSkyImage(image){
  const g=this.gl;if(!g||g.isContextLost()||!image)return false;
  const max=g.getParameter(g.MAX_TEXTURE_SIZE),width=2**Math.floor(Math.log2(Math.min(image.width,max))),height=width/2;
  let upload=image;
  if(image.width!==width||image.height!==height){upload=document.createElement('canvas');upload.width=width;upload.height=height;upload.getContext('2d').drawImage(image,0,0,width,height);}
  const texture=g.createTexture(),ticket=this.initTicket;
  const valid=()=>!this.disposed&&ticket===this.initTicket&&!g.isContextLost();
  const bind=()=>{g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  try{
   if(width*height>=512*1024&&typeof createImageBitmap==='function'&&typeof requestAnimationFrame==='function'){
    await frame();if(!valid()){g.deleteTexture(texture);return false;}
    bind();g.texImage2D(g.TEXTURE_2D,0,g.RGBA,width,height,0,g.RGBA,g.UNSIGNED_BYTE,null);
    const rows=Math.max(1,Math.floor(256*1024/width));
    for(let y=0;y<height;y+=rows){
     const strip=await createImageBitmap(upload,0,y,width,Math.min(rows,height-y),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
     try{
      await frame();if(!valid()){g.deleteTexture(texture);return false;}
      bind();g.texSubImage2D(g.TEXTURE_2D,0,0,y,g.RGBA,g.UNSIGNED_BYTE,strip);
     }finally{strip.close();}
    }
    await frame();if(!valid()){g.deleteTexture(texture);return false;}
   }else{bind();g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,upload);}
   bind();
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   g.generateMipmap(g.TEXTURE_2D);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
  }catch(error){g.deleteTexture(texture);throw error;}
  const previous=this.texture;this.texture=texture;this.image=image;if(previous)g.deleteTexture(previous);
  this.stats.textureSize=[width,height];this.stats.textureStage=width;this.invalidate();return true;
 }
 startDetailUpgrade(){
  this.detailRequested=true;
  if(this.detailPromise||this.disposed||!this.ready||!this.gl)return this.detailPromise;
  const ticket=this.initTicket,asset=root.SolarAssets?.sky;
  this.detailPromise=(async()=>{
   const maxTextureSize=this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
   const widths=Array.isArray(asset?.tiers)?[...new Set(asset.tiers.map(tier=>tier.width))].filter(width=>width>=1024&&width<=maxTextureSize).sort((a,b)=>a-b):[1024,2048];
   for(const width of widths){
    if(this.disposed||ticket!==this.initTicket)return;
    const image=await loadSkyImage(asset,width,this.abort.signal);
    if(this.disposed||ticket!==this.initTicket)return;
    if(image.width>(this.image?.width||0))await this.uploadSkyImage(image);
   }
  })().catch(error=>{if(!this.disposed&&ticket===this.initTicket)this.stats.detailError=String(error.message||error);})
    .finally(()=>{if(ticket===this.initTicket)this.detailPromise=null;});
  return this.detailPromise;
 }
  async initialize(){
  const ticket=++this.initTicket;
  try{
    // A tiny panorama unlocks the GPU star field and first complete frame. The
    // larger panorama tiers are deliberately deferred until the scene is shown.
    if(!this.image){const image=await loadSkyImage(root.SolarAssets?.sky,512,this.abort.signal);if(this.disposed||ticket!==this.initTicket)return;this.image=image;}
   if(this.disposed||ticket!==this.initTicket)return;
   // The visible canvas is retained on unchanged poses, so a preserved buffer
   // is intentional. Disabling it while skipping draws produces a black sky.
   const g=this.canvas.getContext('webgl',{alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true});
   if(!g)throw Error('WebGL unavailable');this.gl=g;
   if(g.isContextLost())return;
   this.releaseGPU();this.ready=false;
   const precision=g.getShaderPrecisionFormat(g.FRAGMENT_SHADER,g.HIGH_FLOAT)?.precision?'highp':'mediump';
   const vs=shader(g,g.VERTEX_SHADER,'attribute vec2 a;varying vec2 p;void main(){p=a;gl_Position=vec4(a,0.,1.);}');
   let fs;
   try{fs=shader(g,g.FRAGMENT_SHADER,`precision ${precision} float;
    varying vec2 p;uniform sampler2D sky,quietMask;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,edgeShade;uniform vec4 fixedGalaxy;
    void main(){
     vec3 ray=normalize(vec3(p.x*size.x/size.y*fov,-p.y*fov,-1.));vec3 q=normalize(right*ray.x+down*ray.y+forward*ray.z);
     float longitude=length(q.xy)>.0000001?atan(q.y,q.x):0.;
     vec2 uv=vec2(fract(longitude/6.28318530718+.5),.5-asin(clamp(q.z,-1.,1.))/3.14159265359);
     vec3 haze=texture2D(sky,uv).rgb;float vignette=1.-edgeShade*pow(clamp(length(p)*.6,0.,1.),2.);
     haze*=texture2D(quietMask,uv).r;
     if(fixedGalaxy.w>0.){
     float latitude=asin(clamp(q.z,-1.,1.)),targetLongitude=atan(fixedGalaxy.y,fixedGalaxy.x),targetLatitude=asin(clamp(fixedGalaxy.z,-1.,1.));
     float longitudeDelta=atan(sin(longitude-targetLongitude),cos(longitude-targetLongitude));
     vec2 galaxyDelta=vec2(longitudeDelta*cos(targetLatitude),latitude-targetLatitude);
      float galaxyActive=step(.00001,fixedGalaxy.w),galaxyRadius=max(fixedGalaxy.w,.00001);
      float galaxyDistance=length(vec2(galaxyDelta.x/galaxyRadius,galaxyDelta.y/(galaxyRadius*${ANDROMEDA_GALAXY.aspect.toFixed(4)})));
      float galaxyMask=(1.-smoothstep(.72,1.,galaxyDistance))*galaxyActive;
     vec2 galaxyUv=vec2(fract(${ANDROMEDA_GALAXY.sourceU.toFixed(4)}+galaxyDelta.x/(6.28318530718*.685)),clamp(${ANDROMEDA_GALAXY.sourceV.toFixed(4)}-galaxyDelta.y/3.14159265359,0.,1.));
     haze+=max(texture2D(sky,galaxyUv).rgb-vec3(.005),vec3(0.))*galaxyMask*${ANDROMEDA_GALAXY.gain.toFixed(4)};
     }
     vec3 col=vec3(.001,.002,.006)+pow(haze,vec3(.95))*.5984;
     gl_FragColor=vec4(col*vignette,1.);
    }`);}catch(error){g.deleteShader(vs);throw error;}
   const program=g.createProgram();this.program=program;
   g.attachShader(program,vs);g.attachShader(program,fs);g.linkProgram(program);g.deleteShader(vs);g.deleteShader(fs);
   if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program)||'Sky link failed');
   this.buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buffer);
   g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);
   // Cache all locations once. Never query driver state in the drawing loop.
   this.attribute=g.getAttribLocation(program,'a');g.enableVertexAttribArray(this.attribute);g.vertexAttribPointer(this.attribute,2,g.FLOAT,false,0,0);
   this.u=Object.fromEntries(['right','down','forward','size','fov','sky','quietMask','edgeShade','fixedGalaxy'].map(k=>[k,g.getUniformLocation(program,k)]));
   await this.uploadSkyImage(this.image);
   if(this.disposed||ticket!==this.initTicket)return;
   const maskWork=this.buildFeatureQuietMask();let maskStep;
   do{
    maskStep=maskWork.next();
    if(!maskStep.done)await new Promise(resolve=>setTimeout(resolve,0));
    if(this.disposed||ticket!==this.initTicket){maskWork.return();return;}
   }while(!maskStep.done);
   const mask=maskStep.value;this.quietTexture=g.createTexture();g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,this.quietTexture);
   g.texImage2D(g.TEXTURE_2D,0,g.LUMINANCE,mask.width,mask.height,0,g.LUMINANCE,g.UNSIGNED_BYTE,mask.pixels);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.REPEAT);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);
   this.edgeShadeStrength=null;g.useProgram(program);g.uniform1i(this.u.sky,0);g.uniform1i(this.u.quietMask,1);g.uniform1f(this.u.fov,this.tanFov);
   const sources=root.SolarVisualEffects.starShaderSources(precision,Object.keys(SKY_FEATURES).length);
   const starVertex=shader(g,g.VERTEX_SHADER,sources.vertex);let starFragment;
   try{starFragment=shader(g,g.FRAGMENT_SHADER,sources.fragment);}catch(error){g.deleteShader(starVertex);throw error;}
   this.starProgram=g.createProgram();g.attachShader(this.starProgram,starVertex);g.attachShader(this.starProgram,starFragment);g.linkProgram(this.starProgram);g.deleteShader(starVertex);g.deleteShader(starFragment);
   if(!g.getProgramParameter(this.starProgram,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.starProgram)||'Star link failed');
   const stars=starField(root.SolarAssets?.starData||root.SolarAssets?.stars),starData=stars instanceof Float32Array?stars:new Float32Array(stars.length*6);
   if(!(stars instanceof Float32Array))stars.forEach((star,index)=>starData.set(star,index*6));this.starCount=Math.floor(starData.length/6);
   this.starBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.starBuffer);g.bufferData(g.ARRAY_BUFFER,root.SolarVisualEffects.starWorldData(starData),g.STATIC_DRAW);
   this.starA={position:g.getAttribLocation(this.starProgram,'position'),appearance:g.getAttribLocation(this.starProgram,'appearance')};
   this.starU=Object.fromEntries(['right','down','forward','size','fov','pointScale','seconds','manualEye','featureQuiet'].map(k=>[k,g.getUniformLocation(this.starProgram,k==='featureQuiet'?'featureQuiet[0]':k)]));
   this.stats.backend='gpu';this.stats.starCount=this.starCount;this.ready=true;this.invalidate();if(this.detailRequested)this.startDetailUpgrade();
  }catch(error){
   if(this.disposed||ticket!==this.initTicket)return;
   this.stats.error=String(error.message||error);this.toSoftware();
   }
  }
 releaseGPU(){
  const g=this.gl;if(!g)return;
  if(this.texture)g.deleteTexture(this.texture);if(this.buffer)g.deleteBuffer(this.buffer);if(this.program)g.deleteProgram(this.program);
  if(this.quietTexture)g.deleteTexture(this.quietTexture);this.quietTexture=null;
  if(this.starBuffer)g.deleteBuffer(this.starBuffer);if(this.starProgram)g.deleteProgram(this.starProgram);
  this.texture=this.buffer=this.program=this.starBuffer=this.starProgram=null;this.starA=this.starU=null;
 }
 toSoftware(){
  const previous=this.gl;this.releaseGPU();this.gl=null;
  // A canvas that has acquired WebGL can never acquire a 2D context. Replace
  // ONLY that background canvas, preserving its id/classes/ARIA/CSS/size.
  let ctx=this.canvas.getContext('2d');
  if(!ctx){const replacement=this.canvas.cloneNode(false);replacement.width=this.canvas.width;replacement.height=this.canvas.height;this.canvas.replaceWith(replacement);this.canvas=replacement;ctx=replacement.getContext('2d');}
  this.ctx=ctx;this.stats.backend='compatibility';this.ready=false;this.invalidate();
  if(previous){this.abort.abort();previous.getExtension('WEBGL_lose_context')?.loseContext();}
  if(!ctx||!this.image){if(ctx){ctx.fillStyle='#010207';ctx.fillRect(0,0,this.canvas.width,this.canvas.height);}return;}
  try{
   const c=document.createElement('canvas');c.width=Math.min(2048,this.image.width);c.height=c.width/2;
   const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(this.image,0,0,c.width,c.height);this.pixels=x.getImageData(0,0,c.width,c.height);
   this.ready=true;
  }catch(error){this.stats.error=String(error.message||error);}
 }
 resize(w,h,dpr){
  w=Math.max(1,w);h=Math.max(1,h);dpr=Math.max(.1,dpr||1);
  // Prevent a 4K/5K HiDPI desktop from allocating several full-resolution sky
  // buffers; foreground planet resolution is entirely independent of this cap.
  const ratio=Math.min(dpr,1.5,Math.sqrt(8388608/(w*h)));
  const width=Math.max(1,Math.round(w*ratio)),height=Math.max(1,Math.round(h*ratio));
  if(this.w===w&&this.h===h&&this.canvas.width===width&&this.canvas.height===height)return;
  this.w=w;this.h=h;this.canvas.width=width;this.canvas.height=height;this.stats.bufferPixels=width*height;
  this.cancelSoftware();this.rayTables.clear();this.invalidate();
 }
 axes(camera){const a=camera.azimuth,e=camera.elevation,c=Math.cos(a),s=Math.sin(a),ce=Math.cos(e),se=Math.sin(e),cr=Math.cos(camera.bank||0),sr=Math.sin(camera.bank||0);return {right:[c*cr-s*se*sr,-s*cr-c*se*sr,-ce*sr],down:[-s*se*cr-c*sr,-c*se*cr+s*sr,-ce*cr],forward:[-s*ce,-c*ce,se]};}
 updateAxes(camera){
  if(camera.viewAxes||this.explicitAxes||!this.axesNow||this.axesA!==camera.azimuth||this.axesE!==camera.elevation||this.axesBank!==(camera.bank||0)){this.axesNow=camera.viewAxes||this.axes(camera);this.axesA=camera.azimuth;this.axesE=camera.elevation;this.axesBank=camera.bank||0;this.explicitAxes=!!camera.viewAxes;}
  if(!this.panAxes||this.panOffset!==this.offset||this.panSource!==this.axesNow){
   const cs=Math.cos(this.offset),sn=Math.sin(this.offset),transform=a=>{
    const x=a[0]*cs-a[1]*sn,y=a[0]*sn+a[1]*cs;return [x,y*COS30-a[2]*.5,y*.5+a[2]*COS30];
   };
   this.panAxes={right:transform(this.axesNow.right),down:transform(this.axesNow.down),forward:transform(this.axesNow.forward)};
   this.panOffset=this.offset;this.panSource=this.axesNow;
  }
 }
 captureReplayBackground(){
  if(!this.axesNow)return null;
  const copy=axes=>Object.fromEntries(Object.entries(axes).map(([key,value])=>[key,[...value]]));
  const stars=copy(this.starAxes||this.panAxes),previous=this.skyPrevious,dt=(this.skySample?.time-previous?.time)/1000;
  const spin=[0,0,0];
  if(dt>1e-4&&dt<.5)for(const key of ['right','down','forward']){
   const a=previous.axes[key],b=stars[key];
   spin[0]+=(a[1]*b[2]-a[2]*b[1])/(2*dt);spin[1]+=(a[2]*b[0]-a[0]*b[2])/(2*dt);spin[2]+=(a[0]*b[1]-a[1]*b[0])/(2*dt);
  }
  return {stars,spin,time:this.skySample?.time};
 }
 updateStarAxes(replay){
  const keys=['right','down','forward'],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  if(replay?.reveal&&replay.from&&this.starBridge!==replay.from){
   this.starBridge=replay.from;
   // The captured orientation belongs to the last rendered frame, not the
   // reset boundary between frames. Preserve that fractional frame as well;
   // dropping it briefly brakes the sky regardless of the blend duration.
   const timed=Number.isFinite(replay.from.time)&&Number.isFinite(replay.clock);
   const sampleAge=timed?Math.max(0,(replay.clock-replay.from.time)/1000):0;
   const carryOffset=timed?sampleAge-(Number.isFinite(replay.carry)?replay.carry:0):0;
   this.starRemap={from:replay.from.stars,to:this.panAxes,spin:replay.from.spin||[0,0,0],carry:0,elapsed:0,carryOffset,start:(replay.clock??performance.now())-sampleAge*1000};
  }
  if(!this.starRemap){this.starAxes=this.panAxes;return;}
  // The carry clock belongs to THIS remap, not the next T animation. Reusing
  // a new departure's negative carry used to rewind the entire sky instantly.
  const elapsed=replay?.from===this.starBridge&&Number.isFinite(replay?.carry)?replay.carry+this.starRemap.carryOffset:
   Number.isFinite(this.starRemap.start)?((replay?.clock??performance.now())-this.starRemap.start)/1000:REPLAY_MOMENTUM_SECONDS;
  // Overlap the carried warp rotation with more of the incoming opening.
  // The integrated quintic ease preserves velocity and acceleration at both
  // ends; keep the measured initial speed instead of abruptly capping it.
  const duration=REPLAY_MOMENTUM_SECONDS,t=this.starRemap.elapsed=clamp(Math.max(this.starRemap.elapsed,elapsed),0,duration),u=t/duration,carry=t-duration*u**4*(2.5-3*u+u*u);
  if(this.starSource===this.panAxes&&this.starMapping===this.starRemap&&this.starRemap.carry===carry)return;
  this.starRemap.carry=carry;
  const {from:original,to,spin}=this.starRemap,speed=Math.hypot(...spin),angle=speed*carry;
  const axis=spin.map(v=>v/(speed||1)),cs=Math.cos(angle),sn=Math.sin(angle);
  const rotate=v=>{const d=dot(axis,v),c=[axis[1]*v[2]-axis[2]*v[1],axis[2]*v[0]-axis[0]*v[2],axis[0]*v[1]-axis[1]*v[0]];return v.map((x,i)=>x*cs+c[i]*sn+axis[i]*d*(1-cs));};
  const from=Object.fromEntries(keys.map(k=>[k,rotate(original[k])]));
  const carried=Object.fromEntries(keys.map(key=>[key,[0,1,2].map(i=>keys.reduce((sum,k)=>sum+from[k][i]*dot(this.panAxes[key],to[k]),0))]));
  // The warp bridge is temporary camera motion, never a permanent rotation
  // of the catalogue. Use the existing quaternion interpolation for the full
  // sky and return to its fixed frame with zero endpoint velocity/acceleration.
  const frame=a=>({right:a.right,up:a.down.map(v=>-v),forward:a.forward});
  const weight=u*u*u*(u*(u*6-15)+10),aligned=root.SolarRingTour.orientation(frame(carried),frame(this.panAxes),weight);
  this.starAxes=t>=duration?this.panAxes:{right:aligned.right,down:aligned.up.map(v=>-v),forward:aligned.forward};
  this.starSource=this.panAxes;this.starMapping=this.starRemap;
  if(t>=duration)this.starRemap=null;
 }
 updateFeatureAxes(){
  if(!this.starRemap){this.featureAxes=this.axesNow;return;}
  if(this.featureAxesSource===this.starAxes)return;
  const cs=Math.cos(this.offset),sn=Math.sin(this.offset);
  this.featureAxes=Object.fromEntries(Object.entries(this.starAxes).map(([key,v])=>{
   const y=v[1]*COS30+v[2]*.5,z=-v[1]*.5+v[2]*COS30;
   return [key,[v[0]*cs+y*sn,-v[0]*sn+y*cs,z]];
  }));this.featureAxesSource=this.starAxes;
 }
 draw(seconds,camera,options,manualEye=null){
  if(this.disposed||this.paused)return;
  const drawCount=root.SolarVisualEffects.drawCount(this,options);
  this.setFeatureCamera(camera);this.updateAxes(camera);
  const replay=camera.replaySky;this.updateStarAxes(replay);this.updateFeatureAxes();
  const clock=replay?.clock??performance.now();
  if(!this.skySample||clock>this.skySample.time){this.skyPrevious=this.skySample;this.skySample={time:clock,axes:this.starAxes};}
  // Galaxy and stars share one persistent orientation across the hidden
  // camera reset. Warp keeps the same lens, panorama and star field.
  this.tanFov=Math.tan(clamp(camera.transitionFov??60.8,40,120)*Math.PI/360);
  // Stars retain their 60.8-degree projection throughout the jump.
  this.starTanFov=replay?Math.tan(30.4*Math.PI/180):this.tanFov;
  this.manualX=manualEye?.[0]||0;this.manualY=manualEye?.[1]||0;this.manualZ=manualEye?.[2]||0;
  this.updateSkyFeatures();this.featureQuiet=this.featureQuietZones();
  if(!this.ready||!this.w||!this.h)return;
  const drawStars=options.twinkle&&!camera.hideStars;
  const now=performance.now(),a=camera.azimuth,e=camera.elevation,pose=this.lastPose,shade=edgeShadeStrength(),starTick=drawStars?Math.floor(seconds*30):0;
  const cameraChanged=!pose||pose.axes!==camera.viewAxes||pose.a!==a||pose.e!==e||pose.w!==this.w||pose.h!==this.h||pose.shade!==shade||pose.fov!==this.tanFov||pose.drawStars!==drawStars||pose.starAxes!==this.starAxes||pose.manualX!==this.manualX||pose.manualY!==this.manualY||pose.manualZ!==this.manualZ;
  const unchanged=!cameraChanged&&pose.offset===this.offset&&pose.starTick===starTick;
  if(unchanged){this.stats.skipped++;return;}
  if(!this.gl){
   if(this.softwareA!==a||this.softwareE!==e||this.softwareFov!==this.tanFov){this.cameraMotionAt=now;this.softwareA=a;this.softwareE=e;this.softwareFov=this.tanFov;}
   const moving=now-this.cameraMotionAt<180;
   const quiet=this.featureQuiet,quietKey='fixed-sky';
   const key=[a,e,this.offset,this.w,this.h,moving,shade,this.tanFov,Object.values(this.starAxes).flat().join(','),quietKey].join(':');
   if(this.softwareDesired?.key!==key)this.softwareDesired={key,revision:(this.softwareRevision=(this.softwareRevision||0)+1),a,e,
    moving,shade,fov:this.tanFov,axes:this.starAxes,offset:this.offset,w:this.w,h:this.h,quiet,galaxy:this.fixedGalaxy,epoch:this.softwareEpoch};
   this.softwarePump();return;
  }
  // The sky sphere stays fixed; star twinkle alone needs at most 30 updates/s.
  // Actual camera movement remains at the application's full RAF rate.
  if(!cameraChanged&&now-this.lastGPU<1000/30-1){this.stats.skipped++;return;}
  const g=this.gl;if(g.isContextLost())return;
  g.viewport(0,0,this.canvas.width,this.canvas.height);g.disable(g.BLEND);g.useProgram(this.program);
  g.bindBuffer(g.ARRAY_BUFFER,this.buffer);g.enableVertexAttribArray(this.attribute);g.vertexAttribPointer(this.attribute,2,g.FLOAT,false,0,0);
  for(const k of ['right','down','forward'])g.uniform3fv(this.u[k],this.starAxes[k]);
  g.uniform2f(this.u.size,this.w,this.h);g.uniform1f(this.u.fov,this.tanFov);
  const fixedGalaxy=this.fixedGalaxy||{x:0,y:0,z:0,radius:0};g.uniform4f(this.u.fixedGalaxy,fixedGalaxy.x,fixedGalaxy.y,fixedGalaxy.z,fixedGalaxy.radius);
  const quiet=this.featureQuiet;
  g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,this.quietTexture);
  if(this.edgeShadeStrength!==shade){g.uniform1f(this.u.edgeShade,shade);this.edgeShadeStrength=shade;}
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.drawArrays(g.TRIANGLES,0,6);
  if(drawStars&&this.starProgram&&drawCount){
   g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.useProgram(this.starProgram);g.bindBuffer(g.ARRAY_BUFFER,this.starBuffer);
   g.enableVertexAttribArray(this.starA.position);g.vertexAttribPointer(this.starA.position,3,g.FLOAT,false,24,0);
   g.enableVertexAttribArray(this.starA.appearance);g.vertexAttribPointer(this.starA.appearance,3,g.FLOAT,false,24,12);
   for(const k of ['right','down','forward'])g.uniform3fv(this.starU[k],this.starAxes[k]);
   g.uniform2f(this.starU.size,this.w,this.h);g.uniform1f(this.starU.fov,this.starTanFov);
   g.uniform1f(this.starU.pointScale,this.canvas.width/this.w);g.uniform1f(this.starU.seconds,seconds);
   g.uniform3f(this.starU.manualEye,this.manualX,this.manualY,this.manualZ);
   g.uniform4fv(this.starU.featureQuiet,this.featureQuietUniforms(quiet));
   g.drawArrays(g.POINTS,0,drawCount);g.disable(g.BLEND);
  }
  this.lastPose={a,e,axes:camera.viewAxes,offset:this.offset,w:this.w,h:this.h,starTick,shade,fov:this.tanFov,drawStars,starAxes:this.starAxes,manualX:this.manualX,manualY:this.manualY,manualZ:this.manualZ};this.lastGPU=now;this.stats.frames++;
 }
 rayTable(sw,sh,aspect,shade=edgeShadeStrength(),fov=this.tanFov){
  const key=[sw,sh,aspect,fov,shade].join(':');let table=this.rayTables.get(key);if(table)return table;
  table=new Float32Array(sw*sh*4);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const sx=(x+.5)/sw*2-1,sy=(y+.5)/sh*2-1,qx=sx*aspect*fov,qy=sy*fov,inv=1/Math.hypot(qx,qy,1),i=(y*sw+x)*4;
   table[i]=qx*inv;table[i+1]=qy*inv;table[i+2]=inv;table[i+3]=1-shade*Math.min(1,Math.hypot(sx,sy)*.6)**2;
  }
  if(this.rayTables.size>=2)this.rayTables.delete(this.rayTables.keys().next().value);this.rayTables.set(key,table);return table;
 }
 softwarePump(){
  if(this.disposed||this.paused||this.softwareBusy||!this.ctx||!this.pixels||!this.softwareDesired)return;
  const request=this.softwareDesired;if(request.key===this.lastKey)return;
  const now=performance.now(),delay=Math.max(0,(request.moving?45:160)-(now-(this.lastSoftware??-Infinity)));
  if(delay>0){if(!this.softwareTimer)this.softwareTimer=setTimeout(()=>{this.softwareTimer=null;this.softwarePump();},delay);return;}
  if(this.softwareTimer){clearTimeout(this.softwareTimer);this.softwareTimer=null;}
  this.softwareBusy=true;this.lastSoftware=now;request.started=now;
  const [sw,sh]=rasterSize(request.w,request.h,request.moving),rays=this.rayTable(sw,sh,request.w/request.h,request.shade,request.fov);this.edgeShadeStrength=request.shade;
  if(!this.softwareCanvas)this.softwareCanvas=document.createElement('canvas');
  const canvas=this.softwareCanvas;
  if(canvas.width!==sw||canvas.height!==sh||!this.softwareImage){canvas.width=sw;canvas.height=sh;this.softwareImage=canvas.getContext('2d').createImageData(sw,sh);}
   const image=this.softwareImage,tex=this.pixels,a=request.axes,sample=new Float32Array(3),galaxySample=new Float32Array(3),gamma=this.gamma,galaxy=request.galaxy,legacyGalaxy=galaxy?.radius>0;
  const galaxyLongitude=Math.atan2(galaxy.y,galaxy.x),galaxyLatitude=Math.asin(clamp(galaxy.z,-1,1));
  let row=0;
  const chunk=()=>{
   this.softwareTimer=null;
   if(this.disposed||this.paused||request.epoch!==this.softwareEpoch){this.softwareBusy=false;return;}
   const start=performance.now();
   while(row<sh){
    const y=row++;
    for(let x=0;x<sw;x++){
     const i=(y*sw+x)*4,qx=rays[i],qy=rays[i+1],qz=rays[i+2];
     const px=a.right[0]*qx+a.down[0]*qy-a.forward[0]*qz,py=a.right[1]*qx+a.down[1]*qy-a.forward[1]*qz,pz=a.right[2]*qx+a.down[2]*qy-a.forward[2]*qz;
     const longitude=Math.atan2(py,px),latitude=Math.asin(clamp(pz,-1,1)),u=longitude/TAU+.5,v=.5-latitude/Math.PI;
     samplePanorama(tex,u,v,sample);
     let quietGain=1;const length=Math.hypot(px,py,pz)||1;
     for(const zone of request.quiet||[]){const distance=Math.hypot(px/length-zone.x,py/length-zone.y,pz/length-zone.z)/zone.radius,t=clamp((distance-.35)/.9,0,1);quietGain*=.6+.4*t*t*(3-2*t);}
     const longitudeDelta=Math.atan2(Math.sin(longitude-galaxyLongitude),Math.cos(longitude-galaxyLongitude)),galaxyX=longitudeDelta*Math.cos(galaxyLatitude),galaxyY=latitude-galaxyLatitude;
      const galaxyDistance=legacyGalaxy?Math.hypot(galaxyX/galaxy.radius,galaxyY/(galaxy.radius*ANDROMEDA_GALAXY.aspect)):Infinity,galaxyFade=clamp((galaxyDistance-.72)/.28,0,1),galaxyMask=legacyGalaxy?1-galaxyFade*galaxyFade*(3-2*galaxyFade):0;
      if(galaxyMask>0)samplePanorama(tex,ANDROMEDA_GALAXY.sourceU+galaxyX/(TAU*.685),ANDROMEDA_GALAXY.sourceV-galaxyY/Math.PI,galaxySample);
     for(let k=0;k<3;k++){const value=sample[k]*quietGain+(galaxyMask>0?Math.max(galaxySample[k]-1.275,0)*galaxyMask*ANDROMEDA_GALAXY.gain:0);image.data[i+k]=gamma[clamp(Math.round(value*4095/255),0,4095)]*rays[i+3];}
     image.data[i+3]=255;
    }
    if(performance.now()-start>3&&row<sh){this.softwareTimer=setTimeout(chunk,0);return;}
   }
   const latest=this.softwareDesired;
   const angle=latest?Math.abs(Math.atan2(Math.sin(latest.a-request.a),Math.cos(latest.a-request.a)))+Math.abs(latest.e-request.e):Infinity;
   if(latest&&latest.w===request.w&&latest.h===request.h&&request.revision>(this.softwareCommitted||0)&&
     (angle<1e-8||(angle<.12&&performance.now()-request.started<300))){
    canvas.getContext('2d').putImageData(image,0,0);this.ctx.drawImage(canvas,0,0,this.canvas.width,this.canvas.height);
    this.lastKey=request.key;this.softwareCommitted=request.revision;this.stats.frames++;
   }
   this.softwareBusy=false;this.softwarePump();
  };
  this.softwareTimer=setTimeout(chunk,0);
 }
 cancelSoftware(){this.softwareEpoch++;clearTimeout(this.softwareTimer);this.softwareTimer=null;this.softwareBusy=false;this.softwareDesired=null;}
 pause(){if(this.paused||this.disposed)return;this.paused=true;this.lastEffect=null;this.cancelSoftware();}
 resume(){if(this.disposed||!this.paused)return;this.paused=false;this.lastEffect=null;this.lastKey='';}
 toPanorama(world){return rotate(rotate(world,this.offset,'z'),Math.PI/6,'x');}
 fromPanorama(p){return rotate(rotate(p,-Math.PI/6,'x'),-this.offset,'z');}
 ray(x,y){const a=this.featureAxes||this.axesNow,qx=(x/this.w*2-1)*this.w/this.h*this.tanFov,qy=(y/this.h*2-1)*this.tanFov,len=Math.hypot(qx,qy,1);return {x:(a.right[0]*qx+a.down[0]*qy-a.forward[0])/len,y:(a.right[1]*qx+a.down[1]*qy-a.forward[1])/len,z:(a.right[2]*qx+a.down[2]*qy-a.forward[2])/len};}
 project(p,axes=this.starAxes||this.panAxes,fov=this.tanFov){
  // Preserve direct axes-based use by older tests/integrations.
  if(!axes){const world=this.fromPanorama(p),a=this.axesNow;if(!a)return null;const dot=v=>v[0]*world.x+v[1]*world.y+v[2]*world.z,z=dot(a.forward);if(z>=-.08)return null;return {x:(1+dot(a.right)/(-z*this.tanFov*this.w/this.h))*this.w/2,y:(1+dot(a.down)/(-z*this.tanFov))*this.h/2};}
  const dot=a=>a[0]*p.x+a[1]*p.y+a[2]*p.z,z=dot(axes.forward);if(z>=-.08)return null;
  return {x:(1+dot(axes.right)/(-z*fov*this.w/this.h))*this.w/2,y:(1+dot(axes.down)/(-z*fov))*this.h/2};
 }
 featureDirection(id){const feature=SKY_FEATURES[id];return feature?featureDirection(feature):null;}
 featureViewPoint(star){return {x:star.direction.x*FEATURE_SKY_DEPTH-(this.manualX||0),y:star.direction.y*FEATURE_SKY_DEPTH-(this.manualY||0),z:star.direction.z*FEATURE_SKY_DEPTH-(this.manualZ||0)};}
 featureCameraPose(id,anchorX=.5,anchorY=.5,bank=0){
  const feature=SKY_FEATURES[id],sum=feature?.stars.reduce((v,star)=>{const p=this.featureViewPoint(star),n=Math.hypot(p.x,p.y,p.z);return {x:v.x+p.x/n,y:v.y+p.y/n,z:v.z+p.z/n};},{x:0,y:0,z:0}),lengthSum=sum&&Math.hypot(sum.x,sum.y,sum.z),direction=sum&&{x:sum.x/lengthSum,y:sum.y/lengthSum,z:sum.z/lengthSum},aspect=this.w/Math.max(1,this.h),fov=this.tanFov;
  if(!direction||![anchorX,anchorY,aspect,fov].every(Number.isFinite)||!(aspect>0)||!(fov>0))return null;
  const sx=(anchorX*2-1)*aspect*fov,sy=(anchorY*2-1)*fov,cr=Math.cos(bank),sr=Math.sin(bank),qx=sx*cr-sy*sr,qy=sx*sr+sy*cr,length=Math.hypot(qx,qy,1),radius=Math.hypot(1,qy);
  const base=Math.asin(clamp(-direction.z*length/radius,-1,1)),phase=Math.atan(qy),center=-Math.asin(clamp(direction.z,-1,1));
  const candidates=[base-phase,Math.PI-base-phase].map(value=>(value+Math.PI)%TAU-Math.PI);
  const elevation=candidates.reduce((best,value)=>Math.abs(value-center)<Math.abs(best-center)?value:best,candidates[0]);
  const horizontal=Math.cos(elevation)-qy*Math.sin(elevation);
  return {azimuth:(Math.atan2(direction.x,direction.y)-Math.atan2(qx,horizontal)+TAU)%TAU,elevation,bank};
 }
 featureGridPose(id,camera){
  const center=this.featureCameraPose(id);if(!center)return null;
  const forward=this.axes(center).forward,direction={x:-forward[0],y:-forward[1],z:-forward[2]};
  const portrait=this.h>this.w,xs=portrait?[1/3,2/3]:[.25,.75],ys=portrait?[.25,.75]:[1/3,2/3];
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));let best=null,score=Infinity;
  // Evaluate only on a navigation command. Reuse the celestial pose solver,
  // permitting the previously approved +/-45 degree roll at polar targets.
  for(const x of xs)for(const y of ys)for(let degrees=-45;degrees<=45;degrees+=5){
   const pose=this.featureCameraPose(id,x,y,degrees*Math.PI/180),point=pose&&this.project(direction,this.axes(pose));if(!point)continue;
   const error=Math.hypot(point.x/this.w-x,point.y/this.h-y);
   const travel=delta(pose.azimuth,camera.azimuth)**2+delta(pose.elevation,camera.elevation)**2+delta(pose.bank,camera.bank||0)**2;
   const cost=(error>1e-6?1000+error*1000:0)+travel;
   if(cost<score){score=cost;best=pose;}
  }
  return best;
 }
 updateSkyFeatures(){
  const visible=!this.camera?.hideStars&&this.axesNow&&this.w&&this.h;
  if(!visible){this.featureProjectionKey=null;this.skyFeatures=[];return this.skyFeatures;}
  const axes=this.featureAxes||this.axesNow,key=[this.w,this.h,this.tanFov,this.manualX||0,this.manualY||0,this.manualZ||0,...axes.right,...axes.down,...axes.forward];
  if(this.featureProjectionKey?.every((value,i)=>value===key[i]))return this.skyFeatures;
  this.featureProjectionKey=key;
  this.skyFeatures=Object.values(SKY_FEATURES).map(feature=>({feature,points:[]}));
  const projected=new Map();
  for(const entry of this.skyFeatures){
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
   for(let i=0;i<entry.feature.stars.length;i++){
    const star=entry.feature.stars[i];
    if(!projected.has(star))projected.set(star,this.project(this.featureViewPoint(star),axes,this.tanFov));
    const point=projected.get(star);entry.points[i]=point;
    if(point){minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);}
   }
   // Conservative bounds also retain lines whose endpoints straddle the viewport.
   entry.visible=maxX>=-64&&minX<=this.w+64&&maxY>=-64&&minY<=this.h+64;
  }
  return this.skyFeatures;
 }
 featureQuietZone(padding=FEATURE_QUIET_PADDING,id=BIG_DIPPER.id){
  const feature=SKY_FEATURES[id];if(!feature)return null;
  const center=featureDirection(feature),radius=Math.max(.035,...feature.stars.map(star=>Math.hypot(star.direction.x-center.x,star.direction.y-center.y,star.direction.z-center.z)+padding));
  return Object.freeze({...center,radius});
 }
 featureQuietZones(){return this.fixedQuietZones||(this.fixedQuietZones=Object.freeze(Object.keys(SKY_FEATURES).map(id=>this.featureQuietZone(FEATURE_QUIET_PADDING,id))));}
 featureQuietUniforms(zones=this.featureQuietZones()){
  if(!this.quietUniforms)this.quietUniforms=new Float32Array(zones.flatMap(zone=>[zone.x,zone.y,zone.z,zone.radius]));return this.quietUniforms;
 }
 featureQuietMask(){
  const work=this.buildFeatureQuietMask();let step;do{step=work.next();}while(!step.done);return step.value;
 }
 *buildFeatureQuietMask(){
  if(this.quietMask)return this.quietMask;
  // Fixed sky coordinates: one 128 KiB mask replaces the per-pixel zone loop.
  // This does not change the panorama or the background-star exclusion rules.
  const width=512,height=256,pixels=new Uint8Array(width*height),zones=this.featureQuietZones().map(zone=>({...zone,inverse:1/zone.radius,outerSquared:(zone.radius*1.25)**2}));
  for(let y=0;y<height;y++){
   const latitude=Math.PI*(.5-(y+.5)/height),z=Math.sin(latitude),ring=Math.cos(latitude);
   for(let x=0;x<width;x++){
    const longitude=TAU*((x+.5)/width-.5),px=ring*Math.cos(longitude),py=ring*Math.sin(longitude);let gain=1;
    for(const zone of zones){
     const dx=px-zone.x,dy=py-zone.y,dz=z-zone.z,d2=dx*dx+dy*dy+dz*dz;if(d2>=zone.outerSquared)continue;
     const t=clamp((Math.sqrt(d2)*zone.inverse-.35)/.9,0,1);gain*=.6+.4*t*t*(3-2*t);
    }
    pixels[y*width+x]=Math.round(gain*255);
   }
   if(y%16===15)yield;
  }
  return this.quietMask={width,height,pixels};
 }
 featureHit(x,y,radius=10){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const features=this.updateSkyFeatures();
  // A named single star owns its hit area even when a larger constellation's
  // projected guide crosses it (Polaris also belongs to Ursa Minor).
  for(const entry of features)if(entry.feature.marker&&entry.points.some(point=>point&&Math.hypot(x-point.x,y-point.y)<=radius*(entry.feature.hitRadiusScale||1)))return entry.feature.id;
  for(const entry of features){
   const hitRadius=radius*(entry.feature.hitRadiusScale||1);
   if(entry.points.some(point=>point&&Math.hypot(x-point.x,y-point.y)<=hitRadius))return entry.feature.id;
   for(const [a,b] of entry.feature.edges){const start=entry.points[a],end=entry.points[b];if(start&&end&&segmentDistance(x,y,start,end)<=hitRadius)return entry.feature.id;}
  }
  return null;
 }
 setFeatureCamera(camera,now=performance.now()){
  // Start saved guides with the first opening frame, using the same trace
  // owner as the display switch. Neither arrival nor warp restarts this clock.
  if(camera.openingGuides&&!this.camera?.openingGuides){
   this.featurePinnedTransitions||(this.featurePinnedTransitions=new Map());
   for(const id of this.featurePinned||[])this.featurePinnedTransitions.set(id,{start:now,leaving:false,traceDelay:0});
  }
  this.camera=camera;
 }
 featureHoverVisual(id,now=performance.now()){
  const transition=this.featureHoverTransition?.id===id?this.featureHoverTransition:this.featureHoverExits?.get(id);if(!transition)return {opacity:this.featureHover===id?1:0,glow:.5,trace:this.featureHover===id?1:0};
  const age=Math.max(0,now-transition.start);
  if(transition.leaving){const p=now>=transition.start+FEATURE_HOVER.hoverFade?1:clamp(age/FEATURE_HOVER.hoverFade,0,1);if(p>=1)this.featureHoverExits?.delete(id);return {opacity:(transition.fromOpacity??1)*(1-p*p*(3-2*p)),glow:transition.fromGlow??.5,trace:transition.fromTrace??1};}
  if(age<FEATURE_HOVER.delay)return {opacity:0,glow:0,trace:0};
  const activeAge=age-FEATURE_HOVER.delay,p=clamp(activeAge/FEATURE_HOVER.fadeIn,0,1),opacity=p*p*(3-2*p),glow=.5+.5*Math.sin(activeAge/FEATURE_HOVER.pulse*TAU-Math.PI/2);
  return {opacity,glow,trace:clamp((activeAge-FEATURE_HOVER.traceDelay)/featureTraceDuration(id),0,1)};
 }
 featurePinnedVisual(id,now=performance.now()){
  const transition=this.featurePinnedTransitions?.get(id),active=this.isFeaturePinnedVisible(id);
  if(!transition)return {opacity:active?1:0,glow:.5,trace:active?1:0};
  const age=Math.max(0,now-transition.start);
  if(transition.leaving){const p=clamp(age/FEATURE_HOVER.fade,0,1);if(p>=1)this.featurePinnedTransitions.delete(id);return {opacity:(transition.fromOpacity??1)*(1-p*p*(3-2*p)),glow:transition.fromGlow??.5,trace:transition.fromTrace??1};}
  const p=clamp(age/FEATURE_HOVER.fadeIn,0,1),opacity=(transition.fromOpacity??0)+(1-(transition.fromOpacity??0))*p*p*(3-2*p),glow=.5+.5*Math.sin(age/FEATURE_HOVER.pulse*TAU-Math.PI/2);
  return {opacity:active?opacity:0,glow,trace:Math.max(transition.fromTrace??0,clamp((age-(transition.traceDelay??FEATURE_HOVER.traceDelay))/featureTraceDuration(id),0,1))};
 }
 featureTransientVisual(id,now=performance.now()){
  const transition=this.featureTransientTransitions?.get(id);if(!transition)return {opacity:0,glow:0,trace:0};
  const age=Math.max(0,now-transition.start),fadeAt=transition.duration;
  if(age>=fadeAt){const p=clamp((age-fadeAt)/FEATURE_HOVER.revealFade,0,1);if(p>=1)this.featureTransientTransitions.delete(id);return {opacity:1-p*p*(3-2*p),glow:transition.glow??.5,trace:1};}
  const p=clamp(age/FEATURE_HOVER.fadeIn,0,1),opacity=p*p*(3-2*p),glow=.5+.5*Math.sin(age/FEATURE_HOVER.pulse*TAU-Math.PI/2);
  transition.glow=glow;return {opacity,glow,trace:clamp((age-FEATURE_HOVER.traceDelay)/featureTraceDuration(id),0,1)};
 }
 featureVisual(id,now=performance.now()){
  const hover=this.featureHoverVisual(id,now),pinned=this.featurePinnedVisual(id,now),transient=this.featureTransientVisual(id,now);
  return [hover,pinned,transient].reduce((best,value)=>value.opacity>best.opacity?value:best,hover);
 }
 featureLineVisual(id,now=performance.now()){
  if(this.camera?.hideFeatureLines)return {opacity:0,glow:0,trace:0};
  // A saved guide owns its trace until switched off. A new hover must not
  // replace its completed path with the hover's freshly started animation.
  return this.isFeaturePinnedVisible(id)?this.featurePinnedVisual(id,now):this.featureVisual(id,now);
 }
 // Camera tracking and card selection are separate. Closing a card clears the
 // blue-white selection emphasis without leaving the constellation camera.
 featureRelationFocus(){return this.featureHover||this.featureSelected||null;}
 featureRelationTarget(id,focus=this.featureRelationFocusId){return focus&&focus===id?1:0;}
 featureRelationFactor(id,now=performance.now()){
  const transition=this.featureRelationTransitions?.get(id);if(!transition)return this.featureRelationTarget(id);
  const p=clamp((now-transition.start)/FEATURE_RELATION_FADE,0,1),smooth=p*p*(3-2*p),value=transition.from+(transition.to-transition.from)*smooth;
  if(p>=1)this.featureRelationTransitions.delete(id);return value;
 }
 syncFeatureRelationFocus(now=performance.now()){
  const next=this.featureRelationFocus();if((this.featureRelationFocusId||null)===next)return false;
  const current=new Map(Object.keys(SKY_FEATURES).map(id=>[id,this.featureRelationFactor(id,now)]));this.featureRelationFocusId=next;this.featureRelationTransitions||=new Map();
  for(const id of Object.keys(SKY_FEATURES)){const from=current.get(id),to=this.featureRelationTarget(id,next);if(Math.abs(from-to)<1e-6)this.featureRelationTransitions.delete(id);else this.featureRelationTransitions.set(id,{start:now,from,to});}
  return true;
 }
 featureRelationTransitionDuration(){return FEATURE_RELATION_FADE;}
 featureGuideColor(id,now=performance.now()){
  const ice=this.featureRelationFactor(id,now),gold=1-ice;
  return `rgb(${Math.round(FEATURE_GUIDE_GOLD[0]*gold+FEATURE_GUIDE_ICE[0]*ice)},${Math.round(FEATURE_GUIDE_GOLD[1]*gold+FEATURE_GUIDE_ICE[1]*ice)},${Math.round(FEATURE_GUIDE_GOLD[2]*gold+FEATURE_GUIDE_ICE[2]*ice)})`;
 }
 featureGuideIntensity(id,now=performance.now()){return .7+.4*this.featureRelationFactor(id,now);}
 setFeatureHover(id){
  const next=SKY_FEATURES[id]?id:null;if(this.featureHover===next)return false;
  const now=performance.now(),previous=this.featureHover;
  const outgoing=previous||this.featureHoverTransition?.id;
  if(outgoing){const visual=this.featureHoverVisual(outgoing,now);if(visual.opacity>0){this.featureHoverExits||=new Map();this.featureHoverExits.set(outgoing,{id:outgoing,start:now,leaving:true,fromOpacity:visual.opacity,fromGlow:visual.glow,fromTrace:visual.trace});}}
  this.featureHoverExits?.delete(next);
  if(next){this.featureHover=next;this.featureHoverTransition={id:next,start:now,leaving:false};}
  else{const visual=previous?this.featureHoverVisual(previous,now):null;this.featureHover=null;this.featureHoverTransition=previous&&visual?.opacity>0?{id:previous,start:now,leaving:true,fromOpacity:visual.opacity,fromGlow:visual.glow,fromTrace:visual.trace}:null;}
  this.syncFeatureRelationFocus(now);
  this.invalidate();return true;
 }
 setFeatureSelected(id){const next=SKY_FEATURES[id]?id:null;if(this.featureSelected===next)return false;this.featureSelected=next;this.syncFeatureRelationFocus();this.invalidate();return true;}
 setFeatureTracked(id){const next=SKY_FEATURES[id]?id:null;if(this.featureTracked===next)return false;this.featureTracked=next;this.syncFeatureRelationFocus();this.invalidate();return true;}
 isFeaturePinned(id){return !!SKY_FEATURES[id]&&this.featurePinned?.has(id);}
 isFeaturePinnedVisible(id){return this.featureDisplayMaster!==false&&this.isFeaturePinned(id);}
 featureDisplayPreferences(){return Array.from(this.featurePinned||[]).filter(id=>!!SKY_FEATURES[id]);}
 restoreFeatureDisplay(ids){const enabled=new Set(Array.isArray(ids)?ids:[]);for(const id of Object.keys(SKY_FEATURES))this.setFeaturePinned(id,enabled.has(id));}
 setFeatureDisplayMaster(enabled){
  const next=enabled!==false,active=this.featureDisplayMaster!==false;if(next===active)return false;
  const now=performance.now(),visuals=new Map(this.featureDisplayPreferences().map(id=>[id,this.featurePinnedVisual(id,now)]));this.featureDisplayMaster=next;
  for(const [id,visual] of visuals)this.featurePinnedTransitions.set(id,next?{start:now,leaving:false,fromOpacity:visual.opacity,fromTrace:visual.trace}:{start:now,leaving:true,fromOpacity:visual.opacity,fromGlow:visual.glow,fromTrace:visual.trace});
  this.invalidate();return true;
 }
 setFeaturePinned(id,enabled){
  if(!SKY_FEATURES[id])return false;
  this.featurePinned||(this.featurePinned=new Set());this.featurePinnedTransitions||(this.featurePinnedTransitions=new Map());const active=this.featurePinned.has(id),next=!!enabled;if(active===next)return false;
  const now=performance.now(),visual=next?this.featurePinnedVisual(id,now):this.featureLineVisual(id,now);if(next)this.featurePinned.add(id);else{
   this.featurePinned.delete(id);
   // Explicit OFF owns the fade; a first-visit/navigation reveal must not
   // keep the guide visible after the card switch has been turned off.
   this.featureTransientTransitions?.delete(id);this.featureHoverExits?.delete(id);
   if(this.featureHoverTransition?.id===id&&this.featureHoverTransition.leaving)this.featureHoverTransition=null;
  }
  this.featurePinnedTransitions.set(id,next?{start:now,leaving:false}:{start:now,leaving:true,fromOpacity:visual.opacity,fromGlow:visual.glow,fromTrace:visual.trace});this.invalidate();return true;
 }
 revealFeature(id,duration=FEATURE_HOVER.revealHold,now=performance.now()){
  if(!SKY_FEATURES[id]||!Number.isFinite(duration)||duration<=0||!Number.isFinite(now))return false;
  this.featureTransientTransitions||(this.featureTransientTransitions=new Map());this.featureTransientTransitions.set(id,{start:now,duration});this.invalidate();return true;
 }
 featureDisplayTransitionDuration(enabled){return enabled?FEATURE_HOVER.fadeIn+FEATURE_HOVER.pulse:FEATURE_HOVER.fade;}
 featureHoverTransitionDuration(){return FEATURE_HOVER.hoverFade;}
 featureRevealDuration(){return FEATURE_HOVER.revealHold+FEATURE_HOVER.revealFade;}
 featureIdlePulse(id,seed,now=performance.now(),display=this.featurePinnedVisual(id,now).opacity){
  const duration=FEATURE_PINNED_PULSE.duration*(.65+seededUnit(seed+7.31)*.9),phase=((now/duration+seededUnit(seed+19.73))%1+1)%1;
  const peakAt=FEATURE_PINNED_PULSE.minPeak+seededUnit(seed)*FEATURE_PINNED_PULSE.peakRange,progress=phase<=peakAt?phase/peakAt:(1-phase)/(1-peakAt),smooth=clamp(progress,0,1)**2*(3-2*clamp(progress,0,1));
  return {size:1+(display*2-1)*(FEATURE_PINNED_PULSE.maxScale-1)*smooth,alpha:1-.2*smooth};
 }
 featureSparkle(seed,seconds){
  const p=FEATURE_SPARKLE,offset=seededUnit(seed+3.17),period=p.period+seededUnit(seed+11.91)*p.variation*2,phase=((seconds/period+offset)%1+1)%1;
  let progress,pulse=0;if(phase<p.rise){progress=phase/p.rise;pulse=progress*progress*(3-2*progress);}else if(phase<p.rise+p.fall){progress=(phase-p.rise)/p.fall;pulse=1-progress*progress*(3-2*progress);}
  return {pulse,alpha:p.base+p.peak*pulse,angle:offset*TAU+p.rotation*Math.sin(phase*TAU)};
 }
 featureRenderOwners(entries,now){
  const cache=this.featureOwnerCache||(this.featureOwnerCache={stars:new Map(),lines:new Map(),markers:new Map(),starRecords:new Map(),lineRecords:new Map()});
  const {stars,lines,markers}=cache;stars.clear();lines.clear();markers.clear();
  for(const id of this.featureTransientTransitions?.keys()||[])this.featureTransientVisual(id,now);
  for(const id of this.featureHoverExits?.keys()||[])this.featureHoverVisual(id,now);
  const edgeKey=(feature,a,b)=>FEATURE_EDGE_KEYS.get(feature).get(a+':'+b);
  for(const entry of entries){
   if(entry.visible===false)continue;
    const id=entry.feature.id,visual=this.featureLineVisual(id,now),relation=this.featureRelationFactor(id,now);entry.lineVisual=visual;entry.lineRelation=relation;entry.lineColor=this.featureGuideColor(id,now);entry.lineIntensity=this.featureGuideIntensity(id,now);
   const rank=(this.featureTracked===id?4:0)+(this.isFeaturePinnedVisible(id)?2:0)+visual.opacity;
   for(const star of entry.feature.stars){const owner=stars.get(star);if(!owner||rank>owner.rank){let record=cache.starRecords.get(star);if(!record){record={};cache.starRecords.set(star,record);}record.entry=entry;record.rank=rank;stars.set(star,record);}if(entry.feature.marker)markers.set(star,entry.feature);}
   if(visual.opacity<=0)continue;
   const groups=FEATURE_TRACE_GROUPS.get(entry.feature),scaled=clamp(visual.trace??1,0,1)*groups.length;
    groups.forEach((group,index)=>{const progress=clamp(scaled-index,0,1);for(const [a,b] of group){const key=edgeKey(entry.feature,a,b),score=visual.opacity*progress*(1+relation),owner=lines.get(key);if(!owner||score>owner.score){let record=cache.lineRecords.get(key);if(!record){record={};cache.lineRecords.set(key,record);}record.entry=entry;record.score=score;lines.set(key,record);}}});
  }
  return {stars,lines,markers,edgeKey};
 }
 drawSkyFeatures(ctx,seconds,glow){
  this.featureSeconds=seconds;
  const entries=this.updateSkyFeatures(),now=performance.now(),starRatio=ctx.getTransform().a||1,owners=this.featureRenderOwners(entries,now);
  for(const entry of entries){
    if(entry.visible===false)continue;
    const visual=entry.lineVisual,lineOpacity=visual.opacity*entry.lineIntensity;
   if(lineOpacity>0){
    // Use the alignment guide's unblurred connector style with the shared-pair
    // palette. Alpha is inexpensive; screen-sized blur passes were costly.
     ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=lineOpacity*.34;ctx.strokeStyle=entry.lineColor;ctx.lineWidth=.65;ctx.shadowBlur=0;
    const groups=FEATURE_TRACE_GROUPS.get(entry.feature),scaled=clamp(visual.trace??1,0,1)*groups.length;
    ctx.beginPath();let segments=0;
    groups.forEach((group,index)=>{const progress=clamp(scaled-index,0,1);if(progress<=0)return;for(const [a,b] of group){if(owners.lines.get(owners.edgeKey(entry.feature,a,b))?.entry!==entry)continue;const start=entry.points[a],end=entry.points[b];if(!start||!end)continue;const segment=clipGuideSegment(start,{x:start.x+(end.x-start.x)*progress,y:start.y+(end.y-start.y)*progress},this.w,this.h);if(!segment)continue;ctx.moveTo(segment[0],segment[1]);ctx.lineTo(segment[2],segment[3]);segments++;}});
    if(segments)ctx.stroke();
    ctx.restore();
   }
    const pinned=this.featurePinnedVisual(entry.feature.id,now),displayBrightness=1+.1*pinned.opacity,trackingBrightness=(this.featureTracked===entry.feature.id?1.1:1)*displayBrightness;
    entry.feature.stars.forEach((star,index)=>{
    if(owners.stars.get(star)?.entry!==entry)return;
    const point=entry.points[index];if(!point||point.x<-12||point.x>this.w+12||point.y<-12||point.y>this.h+12)return;
     const style=star.style||entry.feature.style||BIG_DIPPER.style,idle=this.featureIdlePulse(entry.feature.id,star.motionSeed,seconds*1000,pinned.opacity),displayScale=idle.size,depthScale=root.SolarVisualEffects?.starDepthScale?.(star.motionSeed,seconds)||1,proximity=1/depthScale,size=(.46+(3.4-star.magnitude)*.045)*(1+(proximity-1)*.22)*style.sizeScale*displayScale,alpha=clamp((.82+(3.4-star.magnitude)*.10)*(1+(proximity-1)*.16)*style.lightScale,0,1)*style.pointAlpha*idle.alpha;
    // Feature-specific scale keeps the Big Dipper crisp while Polaris remains
    // 1.8 times its size with the same core, halo and sparkle treatment.
     const sparkle=this.featureSparkle(star.motionSeed,seconds),shapeScale=style.sizeScale/BIG_DIPPER.style.sizeScale*displayScale,tone=star.color||'244,248,255';
    root.SolarVisualEffects.drawTinyStar(ctx,point.x,point.y,size,alpha*sparkle.alpha*trackingBrightness,star.motionSeed,starRatio,`rgb(${tone})`);
    // A pixel-area-integrated core keeps named stars crisp above the
    // decorative points without inflating their surrounding halo.
    if(sparkle.pulse>0){
     const length=FEATURE_SPARKLE.rayLength*(.5+.5*sparkle.pulse)*shapeScale,width=FEATURE_SPARKLE.rayWidth*shapeScale;
     ctx.save();ctx.translate(point.x,point.y);ctx.rotate(sparkle.angle);ctx.globalCompositeOperation='screen';ctx.globalAlpha=FEATURE_SPARKLE.rayAlpha*sparkle.pulse*style.pointAlpha*.65*trackingBrightness*idle.alpha;
     const fade=ctx.createRadialGradient(0,0,0,0,0,length);fade.addColorStop(0,`rgba(${tone},.9)`);fade.addColorStop(.3,`rgba(${tone},.5)`);fade.addColorStop(.7,`rgba(${tone},.12)`);fade.addColorStop(1,`rgba(${tone},0)`);ctx.fillStyle=fade;
     ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(-width,-width);ctx.lineTo(0,-length);ctx.lineTo(width,-width);ctx.lineTo(length,0);ctx.lineTo(width,width);ctx.lineTo(0,length);ctx.lineTo(-width,width);ctx.closePath();ctx.fill();ctx.restore();
    }
    if(style.ambientGlow>0)glow(ctx,point.x,point.y,size*style.ambientRadiusScale,alpha*style.ambientGlow*trackingBrightness,tone);
    // Named stars always retain the former active-state luminosity. Hover,
    // display and the * shortcut control the gold guide line. Display and
    // camera tracking each add a restrained ten-percent lift; the display
    // lift follows the same fade clock as its line instead of switching.
    const activeGlow=.5+.5*sparkle.pulse,activeScale=(1+.75+activeGlow*.25)*style.activeRadiusScale;
    glow(ctx,point.x,point.y,size*activeScale,alpha*(.44+.22*activeGlow)*style.activeGlowScale*trackingBrightness,tone);
    // Hover and the explicit display switch own the circle; shortcut reveals
    // alone must not leave an unsolicited ring around the star.
    // Radius follows the visible star/halo footprint rather than a fixed pixel size.
    const marker=owners.markers.get(star),markerVisual=marker&&!this.camera?.hideFeatureLines?[this.featureHoverVisual(marker.id,now),this.featurePinnedVisual(marker.id,now)].reduce((a,b)=>a.opacity>b.opacity?a:b):null;
     if(marker?.marker?.kind==='circle'&&markerVisual?.opacity>0){
      ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=markerVisual.opacity*FEATURE_HOVER.lineAlpha*this.featureGuideIntensity(marker.id,now);ctx.strokeStyle=this.featureGuideColor(marker.id,now);ctx.globalAlpha*=.32;ctx.lineWidth=.9;
     ctx.beginPath();ctx.arc(point.x,point.y,size*activeScale*(glow.extent||1)*marker.marker.diameterScale,0,TAU);ctx.stroke();ctx.restore();
    }
    if(style.coreAlpha>0){ctx.save();ctx.globalCompositeOperation='screen';root.SolarVisualEffects.drawTinyStar(ctx,point.x,point.y,.14*shapeScale,style.coreAlpha*sparkle.alpha*trackingBrightness*idle.alpha,star.motionSeed,starRatio,`rgb(${tone})`);ctx.restore();}
   });
  }
 }
 drawStars(ctx,seconds,options,glow,occluders=[]){
  if(!this.axesNow||this.paused||this.disposed||!options.twinkle)return;
  const axes=this.starAxes||this.panAxes,fov=this.starTanFov||this.tanFov;
   const stars=root.SolarVisualEffects.starsFor(this,options),pose=this.starPose;
   const ex=this.manualX||0,ey=this.manualY||0,ez=this.manualZ||0,motionTick=ex||ey||ez?Math.floor(seconds*10):0;
   if(!pose||pose.source!==stars||pose.axes!==axes||pose.w!==this.w||pose.h!==this.h||pose.fov!==fov||pose.ex!==ex||pose.ey!==ey||pose.ez!==ez||pose.motionTick!==motionTick){
    this.visibleStars=[];
    const data=root.SolarVisualEffects.starWorldData(stars),focal=this.h/(2*fov);
    for(let i=0;i<data.length;i+=6){
      if(!root.SolarVisualEffects.starQuietVisible(data[i],data[i+1],data[i+2],data[i+5],this.featureQuietZones()))continue;
      const travel=root.SolarVisualEffects.starDepthScale(data[i+5],seconds),x=data[i]*travel-ex,y=data[i+1]*travel-ey,z=data[i+2]*travel-ez;
      const distance2=x*x+y*y+z*z,depth=-(x*axes.forward[0]+y*axes.forward[1]+z*axes.forward[2]);
      if(depth<=0||depth*depth<=.0064*distance2)continue;
      const px=this.w*.5+focal*(x*axes.right[0]+y*axes.right[1]+z*axes.right[2])/depth;
      const py=this.h*.5+focal*(x*axes.down[0]+y*axes.down[1]+z*axes.down[2])/depth;
      if(px<0||px>this.w||py<0||py>this.h)continue;
      this.visibleStars.push([px,py,data[i+3],data[i+4],data[i+5]]);
    }
    this.starPose={source:stars,axes,w:this.w,h:this.h,fov,ex,ey,ez,motionTick};this.stats.starProjections+=stars.length;
   }
   const starRatio=ctx.getTransform().a||1;
   for(const [x,y,r,brightness,phase]of this.visibleStars){if(occluders.some(p=>!p.screen.behind&&(x-p.screen.x)**2+(y-p.screen.y)**2<p.r*p.r))continue;const proximity=1/root.SolarVisualEffects.starDepthScale(phase,seconds),size=r*(1+(proximity-1)*.35),alpha=brightness*(1+(proximity-1)*.22);if(r<.55){root.SolarVisualEffects.drawTinyStar(ctx,x,y,size,alpha,phase,starRatio);continue;}const period=5+Math.abs(Math.sin(phase*.754877666))*20,primary=.5+.5*Math.sin(seconds/period*TAU+phase),secondary=.5+.5*Math.sin(seconds/(period*1.618+3)*TAU+phase*.37),irregular=primary*.68+secondary*.32;glow(ctx,x,y,size*.66,alpha*(.62+.30*irregular));}
 }
  drawGalaxies(ctx){
   const atlas=this.galaxyAtlas,axes=this.featureAxes||this.axesNow;if(!atlas||!axes||!this.w||!this.h)return;
   const cellWidth=atlas.width/2,cellHeight=atlas.height/2,focal=this.h/(2*this.tanFov);
   for(const galaxy of this.galaxies){
    const point=this.project(galaxy.direction,axes,this.tanFov);if(!point)continue;
    const size=focal*galaxy.angularSize;if(point.x<-size||point.x>this.w+size||point.y<-size||point.y>this.h+size)continue;
    const d=galaxy.direction,t=galaxy.tangent,step=.02,length=Math.hypot(d.x+t.x*step,d.y+t.y*step,d.z+t.z*step),tip=this.project({x:(d.x+t.x*step)/length,y:(d.y+t.y*step)/length,z:(d.z+t.z*step)/length},axes,this.tanFov);
    const angle=(tip?Math.atan2(tip.y-point.y,tip.x-point.x):0)+galaxy.roll,[cellX,cellY]=galaxy.cell;
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.globalCompositeOperation='source-over';ctx.globalAlpha*=galaxy.alpha;
    ctx.drawImage(atlas,cellX*cellWidth,cellY*cellHeight,cellWidth,cellHeight,-size/2,-size/2,size,size);ctx.restore();
   }
  }
 decorate(ctx,seconds,options,glow){
  if(!this.axesNow||this.paused||this.disposed)return;
   this.drawGalaxies(ctx);
  if(!this.camera?.hideStars&&!this.camera?.replaySky&&!this.gl)this.drawStars(ctx,seconds,options,glow);
  this.drawSkyFeatures(ctx,seconds,glow);
  if(!options.comets){this.comet=null;this.nextComet=Math.max(this.nextComet,seconds+15);return;}
  if(seconds<this.lastTime){this.nextComet=seconds+20;this.comet=null;}this.lastTime=seconds;
  if(!this.comet&&seconds>=this.nextComet){
   const left=this.random()<.5,sy=this.h*(.12+this.random()*.28),ey=this.h*(.20+this.random()*.32);
   const bend=(this.random()<.5?-1:1)*this.h*(.19+this.random()*.16),direction=left?1:-1,x0=left?-this.w*.08:this.w*1.08,x1=left?this.w*1.08:-this.w*.08;
   const controlY=y=>clamp(y,this.h*.04,this.h*.76),point=(x,y)=>this.toPanorama(this.ray(x,y));
   this.comet={start:point(x0,sy),control1:point(x0+direction*this.w*.36,controlY(sy+bend)),control2:point(x1-direction*this.w*.36,controlY(ey+bend)),end:point(x1,ey),time:seconds,duration:11+this.random()*7};
   this.nextComet=seconds+50+this.random()*100;
  }
  if(!this.comet)return;const k=this.comet,t=(seconds-k.time)/k.duration;if(t>=1){this.comet=null;return;}if(t<0)return;
  const head=this.project(cometPoint(k,t));if(!head)return;const life=Math.sin(t*Math.PI)**.7;
  drawCometRibbon(ctx,cometTail(k,t,p=>this.project(p)),life*.9);
  ctx.save();ctx.globalAlpha=life*.7;glow(ctx,head.x,head.y,.90,.56);ctx.restore();
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.initTicket++;this.cancelSoftware();this.abort.abort();
  const g=this.gl;this.releaseGPU();this.gl=null;if(g)g.getExtension('WEBGL_lose_context')?.loseContext();
   this.image=this.pixels=this.softwareImage=this.softwareCanvas=this.gamma=this.galaxyAtlas=this.quietMask=null;this.comet=null;this.visibleStars=[];this.rayTables.clear();this.featureProjectionKey=null;
 }
}
 Sky.cometPoint=cometPoint;Sky.cometTail=cometTail;Sky.drawCometRibbon=drawCometRibbon;Sky.samplePanorama=samplePanorama;Sky.rasterSize=rasterSize;Sky.equatorialDirection=equatorialDirection;Sky.FEATURES=SKY_FEATURES;Sky.FEATURE_RELATIONS=FEATURE_RELATIONS;Sky.ANDROMEDA_GALAXY=ANDROMEDA_GALAXY;Sky.GALAXIES=SKY_GALAXIES;Sky.BIG_DIPPER=BIG_DIPPER;Sky.POLARIS=POLARIS;root.SolarSky=Sky;
})(window);
