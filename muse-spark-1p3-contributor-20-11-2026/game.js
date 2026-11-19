/* NULLSPACE — Survivor of the Fractured Void. Single-file engine. */
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
let W=0,H=0,DPR=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);W=window.innerWidth;H=window.innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(DPR,0,0,DPR,0,0);}
window.addEventListener('resize',resize);resize();
const TAU=Math.PI*2;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist2=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;};
const $=id=>document.getElementById(id);

/* ============ AUDIO (synth, no assets) ============ */
const AudioSys={ctx:null,muted:false,
init(){if(this.ctx)return;try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}},
resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();},
tone(f,dur,type,vol,slide){if(this.muted||!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type||'square';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);g.gain.setValueAtTime(vol||.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+dur+.02);},
noise(dur,vol,ff){if(this.muted||!this.ctx)return;const t=this.ctx.currentTime,len=this.ctx.sampleRate*dur,buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=this.ctx.createBufferSource();s.buffer=buf;const g=this.ctx.createGain();g.gain.value=vol||.15;const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=ff||1200;s.connect(f);f.connect(g);g.connect(this.ctx.destination);s.start(t);},
shoot(){this.tone(rand(700,950),.08,'square',.05,200);},
enemyDie(){this.noise(.18,.12,900);this.tone(rand(200,350),.15,'sawtooth',.07,60);},
hit(){this.tone(rand(120,180),.12,'sawtooth',.12,60);},
pickup(){this.tone(rand(900,1200),.07,'sine',.06,1800);},
levelup(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'triangle',.12),i*70));},
evo(){[220,330,440,660,880,1320].forEach((f,i)=>setTimeout(()=>this.tone(f,.3,'sawtooth',.1),i*80));},
nova(){this.noise(.8,.3,2500);this.tone(80,.8,'sine',.25,30);},
boss(){[110,98,82,65].forEach((f,i)=>setTimeout(()=>this.tone(f,.5,'sawtooth',.16),i*180));},
dash(){this.noise(.15,.1,3000);},
boom(){this.noise(.4,.25,600);this.tone(90,.4,'sine',.2,30);},
win(){[523,659,784,1046,1318,1568].forEach((f,i)=>setTimeout(()=>this.tone(f,.4,'triangle',.14),i*120));}
};

/* ============ SAVE / META ============ */
const SAVE_KEY='nullspace_save_v1';
let save={frags:0,bestTime:0,mostKills:0,glitchUnlocked:false,meta:{vit:0,mgt:0,hst:0,mag:0,lck:0,rgn:0},muted:false,shake:true,autoAim:true};
try{const s=JSON.parse(localStorage.getItem(SAVE_KEY));if(s)save=Object.assign(save,s);}catch(e){}
function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}
AudioSys.muted=!!save.muted;

/* ============ DEFINITIONS ============ */
const PASSIVES={
vit:{name:'Void Heart',icon:'❤️',max:5,desc:'+20 Max HP /lvl'},
mgt:{name:'Might',icon:'💪',max:5,desc:'+12% damage /lvl'},
hst:{name:'Overclock',icon:'⏩',max:5,desc:'-8% cooldowns /lvl'},
swf:{name:'Slipstream',icon:'🌀',max:5,desc:'+8% move & proj speed /lvl'},
mag:{name:'Magnet Core',icon:'🧲',max:5,desc:'+35% pickup radius /lvl'},
arm:{name:'Aegis Plate',icon:'🛡️',max:5,desc:'+2 armor /lvl'},
rgn:{name:'Regen Mesh',icon:'💚',max:5,desc:'+0.8 HP/s /lvl'},
lck:{name:'Fortune Glitch',icon:'🍀',max:5,desc:'+8% crit & luck /lvl'}
};
const WEAPONS={
pulse:{name:'Pulse Blaster',icon:'🔫',max:8,cat:'mgt',desc:'Auto-fires piercing bolts at nearest foe.',evo:'OBLIVION LANCE'},
blades:{name:'Orbital Blades',icon:'🌀',max:8,cat:'swf',desc:'Blades orbit you, shredding contact.',evo:'EVENT HORIZON'},
lightning:{name:'Storm Coil',icon:'⚡',max:8,cat:'hst',desc:'Zaps chains of enemies periodically.',evo:"STORM GOD'S WRATH"},
blackhole:{name:'Singularity Lobber',icon:'⚫',max:8,cat:'mag',desc:'Lobs black holes that suck & detonate.',evo:'HUNGER OF GOD'},
missiles:{name:'Homing Swarm',icon:'🚀',max:8,cat:'lck',desc:'Launches homing missiles. Boom.',evo:'RAGNAROK PROTOCOL'},
frost:{name:'Frost Nova',icon:'❄️',max:8,cat:'vit',desc:'Periodic freezing nova around you.',evo:'ABSOLUTE ZERO'},
flame:{name:'Flame Aura',icon:'🔥',max:8,cat:'arm',desc:'Burning aura melts everything close.',evo:'HELLBLOOM'},
beam:{name:'Void Beam',icon:'🔆',max:8,cat:'rgn',desc:'Sweeping beam vaporizes in facing dir.',evo:'GODSEVERER'},
shards:{name:'Ricochet Shards',icon:'💠',max:8,cat:'swf',desc:'Bouncing crystal shards. Crowd killer.',evo:'INFINITE MIRROR'},
mines:{name:'Plasma Mines',icon:'💣',max:8,cat:'mgt',desc:'Drops mines that arm & erupt.',evo:'SUPERNOVA GARDEN'}
};
const EVOS={
pulse:{name:'OBLIVION LANCE',icon:'🌠'},blades:{name:'EVENT HORIZON',icon:'🌌'},
lightning:{name:"STORM GOD'S WRATH",icon:'🌩️'},blackhole:{name:'HUNGER OF GOD',icon:'🕳️'},
missiles:{name:'RAGNAROK PROTOCOL',icon:'☄️'},frost:{name:'ABSOLUTE ZERO',icon:'🧊'},
flame:{name:'HELLBLOOM',icon:'🌺'},beam:{name:'GODSEVERER',icon:'⚔️'},
shards:{name:'INFINITE MIRROR',icon:'🪞'},mines:{name:'SUPERNOVA GARDEN',icon:'🌟'}
};
const META_DEFS=[
{id:'vit',name:'❤️ Vitality Hull',desc:'+10 Max HP /rank',max:5,cost:r=>20+r*30},
{id:'mgt',name:'💪 Might Imprint',desc:'+4% damage /rank',max:5,cost:r=>25+r*35},
{id:'hst',name:'⏩ Haste Imprint',desc:'+3% fire rate /rank',max:5,cost:r=>25+r*35},
{id:'mag',name:'🧲 Magnet Imprint',desc:'+10% pickup /rank',max:5,cost:r=>15+r*25},
{id:'lck',name:'🍀 Luck Imprint',desc:'+3% crit /rank',max:5,cost:r=>15+r*25},
{id:'rgn',name:'💚 Regen Imprint',desc:'+0.3 HP/s /rank',max:5,cost:r=>15+r*25}
];

/* ============ GAME STATE ============ */
const G={state:'menu',time:0,kills:0,level:1,xp:0,xpNeed:8,frags:0,
player:null,enemies:[],bullets:[],ebullets:[],gems:[],pickups:[],particles:[],floaters:[],mines:[],holes:[],
weapons:{},passives:{},timers:{},chars:'volt',shake:0,hitstop:0,slowmo:0,
combo:0,comboT:0,bestCombo:0,nova:0,novaMax:100,dashCD:0,dashT:0,
bossSpawned:{},bossActive:null,victoryShown:false,swarmT:20,crateT:25,riftT:40,
cam:{x:0,y:0},mouse:{x:0,y:0},keys:{},announceQ:[],streak:0,streakT:0,frozen:false};
function metaMult(id){const r=save.meta[id]||0;return r;}

/* ============ INPUT ============ */
window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();G.keys[k]=true;
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();
  if(k==='p'&&G.state==='play')pauseGame();else if(k==='p'&&G.state==='pause')resumeGame();
  if(k==='m')toggleMute();
  if(k===' '||k==='shift')tryDash();
  if(k==='e')tryNova();
  if(k==='escape'&&G.state==='play')pauseGame();
});
window.addEventListener('keyup',e=>{G.keys[e.key.toLowerCase()]=false;});
canvas.addEventListener('mousemove',e=>{G.mouse.x=e.clientX;G.mouse.y=e.clientY;});
canvas.addEventListener('mousedown',()=>{AudioSys.init();AudioSys.resume();});
/* touch */
const touch={active:false,sx:0,sy:0,dx:0,dy:0};
const stick=$('stick'),knob=$('stick-knob');
if('ontouchstart' in window){$('touch-ui').classList.remove('hidden');}
stick.addEventListener('touchstart',e=>{const t=e.touches[0],r=stick.getBoundingClientRect();touch.sx=r.left+60;touch.sy=r.top+60;touch.active=true;},{passive:true});
window.addEventListener('touchmove',e=>{if(!touch.active)return;const t=e.touches[0];touch.dx=t.clientX-touch.sx;touch.dy=t.clientY-touch.sy;const m=Math.hypot(touch.dx,touch.dy)||1,c=Math.min(m,50);knob.style.left=(35+touch.dx/m*c-25+25)+'px';knob.style.top=(35+touch.dy/m*c-25+25)+'px';},{passive:true});
window.addEventListener('touchend',()=>{touch.active=false;touch.dx=0;touch.dy=0;knob.style.left='35px';knob.style.top='35px';});
$('t-dash').addEventListener('touchstart',e=>{e.preventDefault();tryDash();});
$('t-nova').addEventListener('touchstart',e=>{e.preventDefault();tryNova();});

/* ============ HELPERS ============ */
function toast(msg){const w=$('toast-wrap'),d=document.createElement('div');d.className='toast';d.textContent=msg;w.appendChild(d);setTimeout(()=>d.remove(),3000);while(w.children.length>3)w.firstChild.remove();}
function announce(msg,color){const a=$('announce');a.textContent=msg;a.classList.remove('hidden');if(color)a.style.textShadow=`0 0 24px ${color},0 0 80px ${color}`;a.style.animation='none';void a.offsetWidth;a.style.animation='';clearTimeout(a._t);a._t=setTimeout(()=>a.classList.add('hidden'),2300);}
function floater(x,y,txt,color,size){G.floaters.push({x,y,txt,color:color||'#fff',t:0,life:.9,size:size||14});if(G.floaters.length>60)G.floaters.shift();}
function burst(x,y,color,n,spd,life,size){for(let i=0;i<n;i++){if(G.particles.length>700)return;const a=rand(0,TAU),s=rand(spd*.3,spd);G.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:rand(life*.5,life),color,size:rand(size*.5,size)});}}
function shake(p){if(save.shake)G.shake=Math.min(18,G.shake+p);}
function dmgNum(x,y,amt,crit){floater(x+rand(-8,8),y-10,Math.round(amt)+(crit?'!':''),crit?'#ffd34d':'#cfefff',crit?19:13);}

/* ============ RUN SETUP ============ */
function baseStats(ch){const m={vit:metaMult('vit'),mgt:metaMult('mgt'),hst:metaMult('hst'),mag:metaMult('mag'),lck:metaMult('lck'),rgn:metaMult('rgn')};
  const p={x:0,y:0,r:14,hp:100,maxhp:100+ m.vit*10,armor:0,speed:235,regen:0.6+m.rgn*0.3,
  dmgMul:1+m.mgt*0.04,cdr:1-m.hst*0.03,pickup:90*(1+m.mag*0.1),luck:m.lck*0.03,crit:0.05+m.lck*0.03,
  aimX:1,aimY:0,inv:0,chrono:ch==='glitch'?1:0};
  if(ch==='volt'){p.speed*=1.2;p.cdr*=0.85;p.maxhp=85+m.vit*10;p.hp=p.maxhp;}
  if(ch==='aegis'){p.maxhp+=60;p.armor+=3;p.pickup*=1.5;}
  if(ch==='glitch'){p.luck+=0.5;p.crit+=0.06;}
  Object.keys(PASSIVES).forEach(k=>{});return p;}
function startRun(ch){AudioSys.init();AudioSys.resume();
  G.state='play';G.time=0;G.kills=0;G.level=1;G.xp=0;G.xpNeed=9;G.frags=0;
  G.enemies=[];G.bullets=[];G.ebullets=[];G.gems=[];G.pickups=[];G.particles=[];G.floaters=[];G.mines=[];G.holes=[];
  G.weapons={};G.passives={};G.timers={};G.combo=0;G.bestCombo=0;G.nova=40;G.novaMax=100;G.dashCD=0;G.dashT=0;
  G.bossSpawned={};G.bossActive=null;G.victoryShown=false;G.swarmT=25;G.crateT=18;G.riftT=35;G.frozen=false;G.chars=ch;
  G.player=baseStats(ch);
  giveWeapon('pulse');
  ['menu','how','codex','meta','gameover','victory','pause'].forEach(id=>$(id).classList.add('hidden'));
  $('hud').classList.remove('hidden');$('draft').classList.add('hidden');
  announce('SURVIVE','#00f0ff');toast('Collect ◆ shards — draft upgrades each level!');
  updateBuildIcons();updateFragHUD();
}

/* ============ WEAPONS / PASSIVES ============ */
function giveWeapon(id){if(!G.weapons[id]){G.weapons[id]={lvl:1,evo:false};G.timers[id]=0;}else if(G.weapons[id].lvl<WEAPONS[id].max){G.weapons[id].lvl++;}}
function givePassive(id){G.passives[id]=(G.passives[id]||0)+1;applyPassives();}
function applyPassives(){const p=G.player,ps=G.passives;if(!p)return;
  const b=baseStats(G.chars);const keepHp=p.hp/p.maxhp;
  p.maxhp=b.maxhp+(ps.vit||0)*20;p.armor=b.armor+(ps.arm||0)*2;p.speed=b.speed*(1+(ps.swf||0)*0.08);
  p.regen=b.regen+(ps.rgn||0)*0.8;p.dmgMul=b.dmgMul*(1+(ps.mgt||0)*0.12);p.cdr=b.cdr*Math.pow(0.92,(ps.hst||0));
  p.pickup=b.pickup*(1+(ps.mag||0)*0.35);p.luck=b.luck+(ps.lck||0)*0.08;p.crit=b.crit+(ps.lck||0)*0.02;
  p.hp=clamp(p.maxhp*keepHp,1,p.maxhp);}
function cdrMult(){return G.player.cdr;}
function dmgMult(){return G.player.dmgMul;}
function isCrit(){return Math.random()<G.player.crit+G.player.luck*0.05;}
function dealDamage(e,amt,crit){amt*=(crit?2:1)*(1+G.player.luck*0.1*(crit?1:0));e.hp-=amt;dmgNum(e.x,e.y,amt,crit);return amt;}

/* ---- draft pool ---- */
function evoReady(id){const w=G.weapons[id];if(!w||w.evo||w.lvl<WEAPONS[id].max)return false;const need=WEAPONS[id].cat;if(!(G.passives[need]>0))return false;const reqLvl=G.chars==='glitch'?7:8;return w.lvl>=reqLvl;}
function draftOptions(){const opts=[];const wkeys=Object.keys(WEAPONS),pkeys=Object.keys(PASSIVES);
  // evolutions first
  for(const id of wkeys){if(evoReady(id))opts.push({kind:'evo',id});}
  for(const id of wkeys){const w=G.weapons[id];
    if(!w&&Object.keys(G.weapons).length<5)opts.push({kind:'weapon',id,new:w===undefined});
    else if(w&&!w.evo&&w.lvl<WEAPONS[id].max)opts.push({kind:'weapon',id});}
  for(const id of pkeys){const l=G.passives[id]||0;if(l<PASSIVES[id].max)opts.push({kind:'passive',id});}
  // heal / bonus fillers
  opts.push({kind:'bonus',id:'heal'},{kind:'bonus',id:'nova'},{kind:'bonus',id:'cache'});
  // weight: prefer new weapons early, evos always
  opts.sort((a,b)=>{const wv=o=>o.kind==='evo'?0:o.kind==='weapon'&&!G.weapons[o.id]?1:o.kind==='weapon'?2:3;return wv(a)-wv(b);});
  // pick 3: guarantee evo if present
  const picks=[];const evos=opts.filter(o=>o.kind==='evo');
  evos.forEach(e=>{if(picks.length<3)picks.push(e);});
  const rest=opts.filter(o=>!picks.includes(o));
  // shuffle rest
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
  for(const r of rest){if(picks.length>=3)break;if(!picks.find(p=>p.id===r.id&&p.kind===r.kind))picks.push(r);}
  return picks.slice(0,3);}
function openDraft(){G.frozen=true;G.state='draft';const cards=$('draft-cards');cards.innerHTML='';
  const opts=draftOptions();
  opts.forEach(o=>{const d=document.createElement('div');d.className='dcard'+(o.kind==='evo'?' evo-card':'');
    let icon,t,desc,tag;
    if(o.kind==='evo'){const E=EVOS[o.id];icon=E.icon;t='EVOLVE: '+E.name;desc=WEAPONS[o.id].name+' reaches its final form. Utterly broken. TAKE IT.';tag='<span class="tag evo">✦ EVOLUTION ✦</span>';}
    else if(o.kind==='weapon'){const Wd=WEAPONS[o.id];const has=G.weapons[o.id];icon=Wd.icon;t=(has?Wd.name+' Lv '+(has.lvl+1):Wd.name);desc=Wd.desc+(has?'':' <b style="color:#00f0ff">NEW!</b>')+'<br><span style="color:#ffd34d">Evolves with '+PASSIVES[Wd.cat].icon+' '+PASSIVES[Wd.cat].name+'</span>';tag=has?'<span class="tag up">UPGRADE</span>':'<span class="tag new">NEW WEAPON</span>';}
    else if(o.kind==='passive'){const P=PASSIVES[o.id];icon=P.icon;t=P.name+' Lv '+((G.passives[o.id]||0)+1);desc=P.desc;tag='<span class="tag up">PASSIVE</span>';}
    else{icon=o.id==='heal'?'💖':(o.id==='nova'?'💥':'◆');t=o.id==='heal'?'Repair +50 HP':(o.id==='nova'?'Overcharge Nova':'Fragment Cache');desc=o.id==='heal'?'Instantly heal 50 HP.':(o.id==='nova'?'Fully charge NOVA bomb.':'Gain +50 Fragments immediately.');tag='<span class="tag new">BONUS</span>';}
    d.innerHTML=`${tag}<div class="e">${icon}</div><div class="t">${t}</div><div class="d">${desc}</div>`;
    d.onclick=()=>pickDraft(o);cards.appendChild(d);});
  $('draft').classList.remove('hidden');AudioSys.levelup();}
function pickDraft(o){$('draft').classList.add('hidden');G.frozen=false;G.state='play';
  if(o.kind==='evo'){G.weapons[o.id].evo=true;AudioSys.evo();announce(EVOS[o.id].name+'!','#ffd34d');burst(G.player.x,G.player.y,'#ffd34d',60,400,1,4);shake(10);}
  else if(o.kind==='weapon')giveWeapon(o.id);
  else if(o.kind==='passive')givePassive(o.id);
  else{if(o.id==='heal')G.player.hp=Math.min(G.player.maxhp,G.player.hp+50);if(o.id==='nova')G.nova=G.novaMax;if(o.id==='cache')G.frags+=50;}
  updateBuildIcons();}
function updateBuildIcons(){const w=$('build-icons');w.innerHTML='';
  Object.keys(G.weapons).forEach(id=>{const d=document.createElement('div');d.className='bicon'+(G.weapons[id].evo?' evo':'');d.textContent=`${G.weapons[id].evo?EVOS[id].icon:WEAPONS[id].icon} ${G.weapons[id].evo?EVOS[id].name:WEAPONS[id].name+' '+G.weapons[id].lvl}`;w.appendChild(d);});}

/* ============ ENEMIES ============ */
const ETYPES={
mote:{hp:18,spd:95,r:12,dmg:10,xp:1,color:'#ff2bd6',score:1},
weaver:{hp:26,spd:110,r:12,dmg:12,xp:2,color:'#b44dff',score:1},
dasher:{hp:34,spd:80,r:13,dmg:16,xp:3,color:'#ff8a5c',score:2},
shooter:{hp:40,spd:70,r:13,dmg:12,xp:4,color:'#5cf2ff',score:2},
splitter:{hp:55,spd:65,r:16,dmg:14,xp:3,color:'#7dff6a',score:2},
bomber:{hp:30,spd:150,r:11,dmg:30,xp:3,color:'#ffd34d',score:2},
brute:{hp:220,spd:55,r:22,dmg:25,xp:10,color:'#ff3b5c',score:4},
wraith:{hp:70,spd:170,r:12,dmg:18,xp:6,color:'#9fb0ff',score:3},
};
function spawnEnemy(type,x,y,elite){const t=ETYPES[type];const scale=1+G.time/240;
  const e={type,x,y,r:t.r*(elite?1.6:1),hp:t.hp*scale*(elite?6:1),maxhp:t.hp*scale*(elite?6:1),
  spd:t.spd*rand(.9,1.1)*(elite?0.9:1),dmg:t.dmg*(1+G.time/600)*(elite?1.8:1),xp:t.xp*(elite?8:1),
  color:elite?'#ffd34d':t.color,t:rand(0,10),elite:!!elite,shootT:rand(1,2),dashT:rand(1,3),vx:0,vy:0,flash:0,slow:0};
  if(type==='splitter')e.split=(elite?4:2);
  G.enemies.push(e);return e;}
function spawnPos(){const a=rand(0,TAU),d=Math.max(W,H)*0.62;return{x:G.player.x+Math.cos(a)*d,y:G.player.y+Math.sin(a)*d};}
function spawner(dt){const t=G.time;const rate=Math.min(0.6+t/26,7.5);G._acc=(G._acc||0)+dt*rate;
  while(G._acc>1){G._acc--;const p=spawnPos();let pool=['mote','mote','weaver'];
    if(t>40)pool.push('dasher','splitter');if(t>80)pool.push('shooter','bomber');
    if(t>140)pool.push('brute','wraith','dasher');if(t>240)pool.push('brute','wraith','shooter','bomber');
    if(t>420)pool.push('brute','brute','wraith');
    const type=pool[randi(0,pool.length-1)];const elite=Math.random()<Math.min(0.02+t/900,0.12);
    spawnEnemy(type,p.x,p.y,elite);}
  // timed bosses
  const bosses=[[300,'WARDEN'],[600,'MATRIARCH'],[900,'NULLGOD']];
  bosses.forEach(([bt])=>{if(t>=bt&&!G.bossSpawned[bt]){G.bossSpawned[bt]=true;spawnBoss(bt);}});
  // swarm events
  G.swarmT-=dt;if(G.swarmT<0){G.swarmT=rand(30,50);swarmEvent();}
  G.crateT-=dt;if(G.crateT<0){G.crateT=rand(22,35);dropCrate();}
  G.riftT-=dt;if(G.riftT<0){G.riftT=rand(45,70);riftEvent();}
  // continuous boss scaling post-15min: trickle brutes
  if(t>900){G._acc2=(G._acc2||0)+dt*(0.4+(t-900)/300);while(G._acc2>1){G._acc2--;const p=spawnPos();spawnEnemy(Math.random()<0.5?'brute':'wraith',p.x,p.y,Math.random()<0.2);}}
}
function swarmEvent(){announce('⚠ VOID SWARM ⚠','#ff3b5c');AudioSys.boss();
  for(let i=0;i<24+G.time/20;i++){const a=(i/24)*TAU;spawnEnemy('mote',G.player.x+Math.cos(a)*500,G.player.y+Math.sin(a)*500,false);}}
function dropCrate(){const a=rand(0,TAU);G.pickups.push({kind:'crate',x:G.player.x+Math.cos(a)*300,y:G.player.y+Math.sin(a)*300,t:0});toast('📦 Supply crate nearby!');}
function riftEvent(){announce('VOID RIFT — GRAB SHARDS!','#00f0ff');
  for(let i=0;i<30;i++)G.gems.push({x:G.player.x+rand(-350,350),y:G.player.y+rand(-350,350),v:5,t:0,vx:0,vy:0});}
function spawnBoss(bt){AudioSys.boss();let b;
  if(bt===300){b={boss:'WARDEN',type:'brute',x:G.player.x+400,y:G.player.y,r:42,hp:3200,maxhp:3200,spd:62,dmg:30,xp:120,color:'#ff3b5c',t:0,elite:true,shootT:1,flash:0,slow:0,chargeT:3};announce('VOID WARDEN AWAKENS','#ff3b5c');}
  if(bt===600){b={boss:'MATRIARCH',type:'splitter',x:G.player.x-450,y:G.player.y,r:50,hp:7500,maxhp:7500,spd:55,dmg:35,xp:250,color:'#b44dff',t:0,elite:true,shootT:1,flash:0,slow:0,chargeT:2,split:6};announce('THE MATRIARCH HUNGERS','#b44dff');}
  if(bt===900){b={boss:'NULLGOD',type:'wraith',x:G.player.x,y:G.player.y-500,r:60,hp:15000,maxhp:15000,spd:75,dmg:45,xp:600,color:'#ffffff',t:0,elite:true,shootT:0.5,flash:0,slow:0,chargeT:2};announce('👁 THE NULL GOD 👁','#ffffff');}
  G.enemies.push(b);G.bossActive=b;$('boss-bar-wrap').classList.remove('hidden');$('boss-name').textContent=b.boss;return b;}

/* ============ COMBAT ============ */
function nearestEnemy(x,y,maxD){let best=null,bd=maxD*maxD;for(const e of G.enemies){const d=dist2({x,y},e);if(d<bd){bd=d;best=e;}}return best;}
function fireBullet(x,y,vx,vy,dmg,pierce,size,color,critC){G.bullets.push({x,y,vx,vy,dmg,pierce:pierce||1,size:size||5,color:color||'#00f0ff',t:0,life:2.2,critC:critC||0});AudioSys.shoot();}
function aimDir(){if(!save.autoAim){const dx=G.mouse.x-W/2,dy=G.mouse.y-H/2;const m=Math.hypot(dx,dy)||1;return{x:dx/m,y:dy/m};}
  const n=nearestEnemy(G.player.x,G.player.y,900);if(n){const dx=n.x-G.player.x,dy=n.y-G.player.y,m=Math.hypot(dx,dy)||1;return{x:dx/m,y:dy/m};}
  return{x:G.player.aimX,y:G.player.aimY};}
function weaponsUpdate(dt){const p=G.player;if(!p)return;const T=G.timers;
  const cd=f=>f*cdrMult();
  // PULSE
  if(G.weapons.pulse){const w=G.weapons.pulse;T.pulse=(T.pulse||0)-dt;
    if(T.pulse<=0){const evo=w.evo;T.pulse=cd(evo?0.32:0.55-0.02*w.lvl);
      const d=aimDir();const n=evo?5:2+Math.floor(w.lvl/3);const dmg=(evo?46:10+w.lvl*3.2)*dmgMult();
      for(let i=0;i<n;i++){const sp=640*(1+(G.passives.swf||0)*0.05);const off=(i-(n-1)/2)*0.05;const cx=Math.cos(off),sx=Math.sin(off);
        const b={x:p.x,y:p.y,vx:(d.x*cx-d.y*sx)*sp,vy:(d.x*sx+d.y*cx)*sp,dmg,pierce:evo?6:2+Math.floor(w.lvl/4),size:evo?7:6,color:evo?'#ffd34d':'#00f0ff',t:0,life:2.2,homing:evo?300:220,critC:0};
        G.bullets.push(b);AudioSys.shoot();}}}
  // BLADES
  if(G.weapons.blades){const w=G.weapons.blades;const evo=w.evo;const n=evo?6:2+Math.floor(w.lvl/2);const R=evo?130:95+w.lvl*4;const dmg=(evo?40:8+w.lvl*2.6)*dmgMult();
    w.ang=(w.ang||0)+dt*(evo?4.2:2.6+(G.passives.swf||0)*0.15);
    for(let i=0;i<n;i++){const a=w.ang+i/n*TAU;const bx=p.x+Math.cos(a)*R,by=p.y+Math.sin(a)*R;
      for(const e of G.enemies){if(Math.hypot(e.x-bx,e.y-by)<e.r+16){if(!e._bladeT||e._bladeT<=0){const c=isCrit();dealDamage(e,dmg,c);e.flash=0.08;e._bladeT=0;burst(bx,by,'#ff2bd6',3,200,.4,3);}e._bladeT=0.28;}}}
    for(const e of G.enemies)if(e._bladeT>0)e._bladeT-=dt;}
  // LIGHTNING
  if(G.weapons.lightning){const w=G.weapons.lightning;T.lightning=(T.lightning||0)-dt;
    if(T.lightning<=0){T.lightning=cd(w.evo?1.1:2.2-0.12*w.lvl);const chains=w.evo?14:3+w.lvl;const dmg=(w.evo?90:14+w.lvl*5)*dmgMult();
      let from={x:p.x,y:p.y};const hitSet=new Set();
      for(let c=0;c<chains;c++){let best=null,bd=420*420;for(const e of G.enemies){if(hitSet.has(e))continue;const d=dist2(from,e);if(d<bd){bd=d;best=e;}}if(!best)break;hitSet.add(best);
        G.particles.push({beam:{x1:from.x,y1:from.y,x2:best.x,y2:best.y},t:0,life:.22,color:w.evo?'#ffd34d':'#5cf2ff',size:3});
        const crt=isCrit();dealDamage(best,dmg,crt);best.slow=0.6;from=best;}AudioSys.tone(1400,.15,'sawtooth',.08,200);}}
  // BLACK HOLE
  if(G.weapons.blackhole){const w=G.weapons.blackhole;T.blackhole=(T.blackhole||0)-dt;
    if(T.blackhole<=0){T.blackhole=cd(w.evo?3.2:5-0.25*w.lvl);const tgt=nearestEnemy(p.x,p.y,800)||{x:p.x+200,y:p.y};
      G.holes.push({x:tgt.x,y:tgt.y,r:10,t:0,life:w.evo?4:2.6,dmg:(w.evo?55:16+w.lvl*4)*dmgMult(),evo:w.evo,tick:0});AudioSys.boom();}}
  // MISSILES
  if(G.weapons.missiles){const w=G.weapons.missiles;T.missiles=(T.missiles||0)-dt;
    if(T.missiles<=0){T.missiles=cd(w.evo?1.4:2.4-0.12*w.lvl);const n=w.evo?8:2+Math.floor(w.lvl/2);
      for(let i=0;i<n;i++){const a=rand(0,TAU);G.bullets.push({x:p.x,y:p.y,vx:Math.cos(a)*260,vy:Math.sin(a)*260,dmg:(w.evo?70:12+w.lvl*4)*dmgMult(),pierce:1,size:6,color:w.evo?'#ff3b5c':'#ff8a5c',t:0,life:3,homing:420,critC:0});}}}
  // FROST
  if(G.weapons.frost){const w=G.weapons.frost;T.frost=(T.frost||0)-dt;
    if(T.frost<=0){T.frost=cd(w.evo?2.4:4-0.2*w.lvl);const R=w.evo?420:200+w.lvl*18;const dmg=(w.evo?80:12+w.lvl*4)*dmgMult();
      G.particles.push({ring:{x:p.x,y:p.y,r:10,max:R},t:0,life:.5,color:w.evo?'#bff6ff':'#8ad8ff',size:4});
      for(const e of G.enemies){if(Math.hypot(e.x-p.x,e.y-p.y)<R+e.r){const c=isCrit();dealDamage(e,dmg,c);e.slow=w.evo?3:1.5;e.flash=0.1;}}
      burst(p.x,p.y,'#8ad8ff',24,320,.6,4);AudioSys.tone(600,.3,'sine',.1,150);}}
  // FLAME aura dps
  if(G.weapons.flame){const w=G.weapons.flame;const R=w.evo?240:130+w.lvl*10;const dmg=(w.evo?34:6+w.lvl*1.8)*dmgMult();
    w.tick=(w.tick||0)-dt;if(w.tick<=0){w.tick=0.4;for(const e of G.enemies){if(Math.hypot(e.x-p.x,e.y-p.y)<R){const c=isCrit();dealDamage(e,dmg,c);e.flash=0.06;if(Math.random()<0.3)burst(e.x,e.y,'#ff8a5c',2,150,.4,3);}}}}
  // BEAM
  if(G.weapons.beam){const w=G.weapons.beam;T.beam=(T.beam||0)-dt;
    if(T.beam<=0){T.beam=cd(w.evo?1.6:2.6-0.12*w.lvl);const d=aimDir();const len=w.evo?700:420+w.lvl*20;const dmg=(w.evo?120:18+w.lvl*6)*dmgMult();
      G.particles.push({beam:{x1:p.x,y1:p.y,x2:p.x+d.x*len,y2:p.y+d.y*len},t:0,life:.3,color:w.evo?'#ffd34d':'#ff2bd6',size:w.evo?8:5});
      for(const e of G.enemies){const rx=e.x-p.x,ry=e.y-p.y;const along=rx*d.x+ry*d.y;if(along>0&&along<len){const perp=Math.abs(rx*d.y-ry*d.x);if(perp<40+e.r){const c=isCrit();dealDamage(e,dmg,c);e.flash=0.1;}}}
      shake(3);AudioSys.tone(200,.3,'sawtooth',.12,900);}}
  // SHARDS ricochet
  if(G.weapons.shards){const w=G.weapons.shards;T.shards=(T.shards||0)-dt;
    if(T.shards<=0){T.shards=cd(w.evo?0.9:1.5-0.06*w.lvl);const d=aimDir();const n=w.evo?6:3;
      for(let i=0;i<n;i++){const a=Math.atan2(d.y,d.x)+rand(-0.4,0.4);const sp=520;G.bullets.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,dmg:(w.evo?38:9+w.lvl*2.8)*dmgMult(),pierce:w.evo?99:3+Math.floor(w.lvl/2),size:5,color:'#b44dff',t:0,life:2.5,ricochet:true});}}}
  // MINES
  if(G.weapons.mines){const w=G.weapons.mines;T.mines=(T.mines||0)-dt;
    if(T.mines<=0){T.mines=cd(w.evo?1.8:2.8-0.15*w.lvl);G.mines.push({x:p.x+rand(-40,40),y:p.y+rand(-40,40),t:0,arm:0.8,dmg:(w.evo?150:25+w.lvl*8)*dmgMult(),evo:w.evo});}}
  // update mines
  for(let i=G.mines.length-1;i>=0;i--){const m=G.mines[i];m.t+=dt;if(m.t>m.arm){let boom=false;for(const e of G.enemies){if(Math.hypot(e.x-m.x,e.y-m.y)<(m.evo?220:140)){boom=true;break;}}
    if(boom||m.t>8){const R=m.evo?220:140;G.particles.push({ring:{x:m.x,y:m.y,r:10,max:R},t:0,life:.4,color:'#ffd34d',size:6});burst(m.x,m.y,'#ffd34d',26,380,.6,4);shake(4);AudioSys.boom();
      for(const e of G.enemies){if(Math.hypot(e.x-m.x,e.y-m.y)<R+e.r){const c=isCrit();dealDamage(e,m.dmg,c);}}G.mines.splice(i,1);}}}
  // update holes
  for(let i=G.holes.length-1;i>=0;i--){const h=G.holes[i];h.t+=dt;h.tick-=dt;h.r=Math.min(h.evo?150:100,h.r+dt*60);
    for(const e of G.enemies){const dx=h.x-e.x,dy=h.y-e.y,d=Math.hypot(dx,dy)||1;if(d<h.r+220){e.x+=dx/d*dt*(h.evo?260:160);e.y+=dy/d*dt*(h.evo?260:160);}if(d<h.r+e.r&&h.tick<=0){const c=isCrit();dealDamage(e,h.dmg*0.4,c);}}
    if(h.tick<=0)h.tick=0.3;
    if(h.t>h.life){G.particles.push({ring:{x:h.x,y:h.y,r:10,max:h.evo?320:220},t:0,life:.45,color:'#b44dff',size:6});burst(h.x,h.y,'#b44dff',30,420,.6,4);shake(5);AudioSys.boom();
      for(const e of G.enemies){if(Math.hypot(e.x-h.x,e.y-h.y)<(h.evo?320:220)){const c=isCrit();dealDamage(e,h.dmg*2,c);}}G.holes.splice(i,1);}}
}
function tryDash(){if(G.state!=='play')return;const p=G.player;if(!p||G.dashCD>0)return;G.dashCD=G.chars==='volt'?1.4:2;G.dashT=0.22;p.inv=Math.max(p.inv,0.32);AudioSys.dash();
  let dx=0,dy=0;if(G.keys.w||G.keys.arrowup)dy-=1;if(G.keys.s||G.keys.arrowdown)dy+=1;if(G.keys.a||G.keys.arrowleft)dx-=1;if(G.keys.d||G.keys.arrowright)dx+=1;
  if(touch.active){dx=touch.dx;dy=touch.dy;}if(dx===0&&dy===0){dx=p.aimX;dy=p.aimY;}const m=Math.hypot(dx,dy)||1;p.dashX=dx/m;p.dashY=dy/m;
  burst(p.x,p.y,'#00f0ff',12,300,.4,3);}
function tryNova(){if(G.state!=='play')return;if(G.nova< G.novaMax)return;G.nova=0;const p=G.player;AudioSys.nova();shake(14);G.hitstop=0.12;
  G.particles.push({ring:{x:p.x,y:p.y,r:20,max:480},t:0,life:.6,color:'#ffd34d',size:8});
  burst(p.x,p.y,'#ffd34d',80,600,1,5);burst(p.x,p.y,'#ff2bd6',50,450,.8,4);
  for(const e of G.enemies){if(Math.hypot(e.x-p.x,e.y-p.y)<480){const c=isCrit();dealDamage(e,150*dmgMult()+(G.kills*0.05),c);e.slow=2;}}floater(p.x,p.y-30,'NOVA!','#ffd34d',26);}

/* ============ UPDATE ============ */
function killEnemy(e){G.kills++;G.combo++;G.comboT=3;G.bestCombo=Math.max(G.bestCombo,G.combo);G.nova=Math.min(G.novaMax,G.nova+2+e.xp*0.4);
  AudioSys.enemyDie();burst(e.x,e.y,e.color,e.elite?30:10,e.elite?380:260,.6,4);
  // gems
  const gv=e.xp;const n=gv>=10?3:gv>=4?2:1;
  for(let i=0;i<n;i++){if(G.gems.length>600){gainXp(Math.ceil(gv/n));}else G.gems.push({x:e.x+rand(-14,14),y:e.y+rand(-14,14),v:Math.ceil(gv/n),t:rand(0,1),vx:rand(-120,120),vy:rand(-120,120)});}
  if(e.elite||Math.random()<0.02+G.player.luck*0.02)G.pickups.push({kind:Math.random()<0.5?'heart':'magnet',x:e.x,y:e.y,t:0});
  if(e.boss){onBossDown(e);}
  if(e.split){for(let i=0;i<e.split;i++)spawnEnemy('mote',e.x+rand(-20,20),e.y+rand(-20,20),false);}
  // streak announcements
  const c=G.combo;if(c===20)announce('RAMPAGE!','#ffd34d');else if(c===50)announce('UNSTOPPABLE!','#ff2bd6');else if(c===100)announce('VOIDLIKE!','#00f0ff');else if(c===200)announce('GODLIKE!','#ffffff');
  G.frags+=e.elite?3:1;
  if(e.type==='bomber'){for(const o of G.enemies){if(o!==e&&Math.hypot(o.x-e.x,o.y-e.y)<110)o.hp-=40;}burst(e.x,e.y,'#ffd34d',20,320,.5,4);}
}
function onBossDown(b){$('boss-bar-wrap').classList.add('hidden');G.bossActive=null;AudioSys.win();shake(16);
  burst(b.x,b.y,'#ffffff',100,600,1.2,6);G.nova=G.novaMax;
  for(let i=0;i<20;i++)G.gems.push({x:b.x+rand(-80,80),y:b.y+rand(-80,80),v:10,t:0,vx:rand(-150,150),vy:rand(-150,150)});
  G.pickups.push({kind:'crate',x:b.x,y:b.y,t:0});
  if(b.boss==='WARDEN'){announce('WARDEN SLAIN!','#ffd34d');toast('The Matriarch stirs… survive to 10:00');}
  if(b.boss==='MATRIARCH'){announce('MATRIARCH SLAIN!','#ffd34d');}
  if(b.boss==='NULLGOD'){winGame();}}
function winGame(){if(G.victoryShown)return;G.victoryShown=true;AudioSys.win();announce('👑 NULL GOD SLAIN 👑','#ffd34d');
  setTimeout(()=>{if(G.state==='play'){G.state='victory';$('victory').classList.remove('hidden');G.frozen=true;}},1800);}
function gainXp(v){G.xp+=v;let guard=0;while(G.xp>=G.xpNeed&&guard++<20){G.xp-=G.xpNeed;G.level++;G.xpNeed=Math.floor(6+G.level*3+G.level*G.level*0.3);setTimeout(()=>{if(G.state==='play')openDraft();},60);AudioSys.levelup();}}
function update(dt){if(G.frozen||G.state!=='play')return;
  if(G.hitstop>0){G.hitstop-=dt;return;}
  if(G.slowmo>0){G.slowmo-=dt;dt*=0.25;}
  G.time+=dt;const p=G.player;
  // regen
  p.hp=Math.min(p.maxhp,p.hp+p.regen*dt);
  p.inv-=dt;G.dashCD-=dt;G.comboT-=dt;if(G.comboT<0)G.combo=0;
  // movement
  let dx=0,dy=0;if(G.keys.w||G.keys.arrowup)dy-=1;if(G.keys.s||G.keys.arrowdown)dy+=1;if(G.keys.a||G.keys.arrowleft)dx-=1;if(G.keys.d||G.keys.arrowright)dx+=1;
  if(touch.active&&(Math.abs(touch.dx)>6||Math.abs(touch.dy)>6)){dx=touch.dx;dy=touch.dy;}
  const m=Math.hypot(dx,dy);if(m>0){dx/=m;dy/=m;const d=aimDir();p.aimX=d.x;p.aimY=d.y;}
  if(G.dashT>0){G.dashT-=dt;p.x+=p.dashX*dt*900;p.y+=p.dashY*dt*900;burst(p.x,p.y,'#00f0ff',2,120,.3,3);}
  else{p.x+=dx*dt*p.speed;p.y+=dy*dt*p.speed;}
  if(!save.autoAim){const ax=G.mouse.x-W/2,ay=G.mouse.y-H/2,am=Math.hypot(ax,ay)||1;p.aimX=ax/am;p.aimY=ay/am;}
  else if(m>0){/* aim updated above */}else{const n=nearestEnemy(p.x,p.y,700);if(n){const nx=n.x-p.x,ny=n.y-p.y,nm=Math.hypot(nx,ny)||1;p.aimX=nx/nm;p.aimY=ny/nm;}}
  spawner(dt);weaponsUpdate(dt);
  // enemies AI
  for(let i=G.enemies.length-1;i>=0;i--){const e=G.enemies[i];e.t+=dt;e.flash-=dt;
    if(e.slow>0)e.slow-=dt;const sl=e.slow>0?0.45:1;
    const dxp=p.x-e.x,dyp=p.y-e.y,dp=Math.hypot(dxp,dyp)||1;const nx=dxp/dp,ny=dyp/dp;
    if(e.type==='dasher'){e.dashT-=dt;if(e.dashT<0){e.dashT=2.2;e.vx=nx*520;e.vy=ny*520;AudioSys.tone(300,.15,'sawtooth',.05,600);}e.vx*=0.96;e.vy*=0.96;e.x+=(nx*e.spd+e.vx)*dt*sl;e.y+=(ny*e.spd+e.vy)*dt*sl;}
    else if(e.type==='weaver'){e.x+=(nx*e.spd+Math.cos(e.t*4)*120)*dt*sl;e.y+=(ny*e.spd+Math.sin(e.t*4)*120)*dt*sl;}
    else if(e.type==='shooter'){e.shootT-=dt;if(dp>320){e.x+=nx*e.spd*dt*sl;e.y+=ny*e.spd*dt*sl;}else if(dp<220){e.x-=nx*e.spd*dt*sl;e.y-=ny*e.spd*dt*sl;}
      if(e.shootT<0){e.shootT=Math.max(0.8,2.4-G.time/400);G.ebullets.push({x:e.x,y:e.y,vx:nx*260,vy:ny*260,dmg:e.dmg*0.7,r:6,t:0});AudioSys.tone(400,.1,'square',.04,150);}}
    else if(e.type==='bomber'){e.x+=nx*e.spd*dt*sl;e.y+=ny*e.spd*dt*sl;if(dp<40){e.hp=0;burst(e.x,e.y,'#ffd34d',24,380,.6,5);AudioSys.boom();shake(5);
      if(Math.hypot(p.x-e.x,p.y-e.y)<110&&p.inv<=0){hurtPlayer(e.dmg*1.5);}killEnemy(e);G.enemies.splice(i,1);continue;}}
    else if(e.boss){e.x+=nx*e.spd*dt;e.y+=ny*e.spd*dt;e.shootT-=dt;e.chargeT-=dt;
      if(e.shootT<0){e.shootT=e.boss==='NULLGOD'?0.9:1.6;const n=e.boss==='NULLGOD'?10:6;
        for(let k=0;k<n;k++){const a=k/n*TAU+e.t;G.ebullets.push({x:e.x,y:e.y,vx:Math.cos(a)*220,vy:Math.sin(a)*220,dmg:e.dmg*0.5,r:7,t:0});}AudioSys.tone(150,.3,'sawtooth',.1,60);}
      if(e.chargeT<0){e.chargeT=4;e.vx=nx*600;e.vy=ny*600;announce(e.boss+' CHARGES!','#ff3b5c');}
      e.vx=(e.vx||0)*0.94;e.vy=(e.vy||0)*0.94;e.x+= (e.vx||0)*dt;e.y+=(e.vy||0)*dt;}
    else{e.x+=nx*e.spd*dt*sl;e.y+=ny*e.spd*dt*sl;}
    // contact damage
    if(dp<e.r+p.r){if(p.inv<=0&&G.dashT<=0){hurtPlayer(e.dmg);e.x-=nx*30;e.y-=ny*30;}else if(e.type!=='bomber'){/* push */}
    }
    if(e.hp<=0){killEnemy(e);G.enemies.splice(i,1);}}
  // bullets
  for(let i=G.bullets.length-1;i>=0;i--){const b=G.bullets[i];b.t+=dt;
    if(b.homing){const n=nearestEnemy(b.x,b.y,500);if(n){const dx=n.x-b.x,dy=n.y-b.y,dd=Math.hypot(dx,dy)||1;const sp=Math.hypot(b.vx,b.vy);const tx=b.vx+dx/dd*b.homing*dt,ty=b.vy+dy/dd*b.homing*dt;const tm=Math.hypot(tx,ty)||1;b.vx=tx/tm*Math.max(sp,380);b.vy=ty/tm*Math.max(sp,380);}}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    let dead=b.t>b.life;const pr=520;
    if(!dead&&(Math.abs(b.x-p.x)>pr+W/2||Math.abs(b.y-p.y)>pr+H/2)){/* keep flying a bit */ }
    if(!dead){for(let j=G.enemies.length-1;j>=0;j--){const e=G.enemies[j];
      if(Math.abs(e.x-b.x)>60||Math.abs(e.y-b.y)>60)continue;
      if(Math.hypot(e.x-b.x,e.y-b.y)<e.r+b.size){const c=Math.random()<0.05+G.player.crit?true:isCrit();const dd2=b.dmg*(c?2:1);e.hp-=dd2;dmgNum(e.x,e.y,dd2,c);e.flash=0.07;burst(b.x,b.y,b.color,3,180,.3,3);
        if(b.ricochet&&b.pierce>0){const n2=nearestEnemy(b.x,b.y,380);if(n2&&n2!==e){const ddx=n2.x-b.x,ddy=n2.y-b.y,ddd=Math.hypot(ddx,ddy)||1;const sp=Math.hypot(b.vx,b.vy);b.vx=ddx/ddd*sp;b.vy=ddy/ddd*sp;}}
        b.pierce--;if(b.pierce<=0){dead=true;break;}}}}
    if(dead){G.bullets.splice(i,1);}}
  // enemy bullets
  for(let i=G.ebullets.length-1;i>=0;i--){const b=G.ebullets[i];b.t+=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(b.t>4){G.ebullets.splice(i,1);continue;}
    if(Math.hypot(b.x-p.x,b.y-p.y)<p.r+b.r&&p.inv<=0&&G.dashT<=0){hurtPlayer(b.dmg);G.ebullets.splice(i,1);}}
  // gems magnet
  for(let i=G.gems.length-1;i>=0;i--){const g=G.gems[i];g.t+=dt;g.x+=(g.vx||0)*dt;g.y+=(g.vy||0)*dt;g.vx*=0.92;g.vy*=0.92;
    const dd=Math.hypot(p.x-g.x,p.y-g.y);if(dd<p.pickup){const s=700*(1-(dd/p.pickup)*0.5);g.x+=(p.x-g.x)/dd*s*dt;g.y+=(p.y-g.y)/dd*s*dt;}
    if(dd<22){gainXp(g.v);G.nova=Math.min(G.novaMax,G.nova+g.v*0.15);AudioSys.pickup();burst(g.x,g.y,'#00f0ff',2,120,.3,2);G.gems.splice(i,1);}}
  // pickups
  for(let i=G.pickups.length-1;i>=0;i--){const k=G.pickups[i];k.t+=dt;
    if(Math.hypot(p.x-k.x,p.y-k.y)<30){G.pickups.splice(i,1);
      if(k.kind==='heart'){p.hp=Math.min(p.maxhp,p.hp+25);floater(p.x,p.y-24,'+25 HP','#7dff6a',16);AudioSys.pickup();}
      else if(k.kind==='magnet'){for(const g of G.gems){g.vx+=(p.x-g.x)*2;g.vy+=(p.y-g.y)*2;}floater(p.x,p.y-24,'MAGNET!','#00f0ff',18);}
      else if(k.kind==='crate'){const r=Math.random();if(r<0.4){p.hp=Math.min(p.maxhp,p.hp+40);G.frags+=20;toast('📦 +40 HP, +20◆');}else if(r<0.7){G.nova=G.novaMax;G.frags+=15;toast('📦 NOVA charged! +15◆');}else{G.frags+=60;toast('📦 JACKPOT +60◆!');}AudioSys.levelup();}
      burst(k.x,k.y,'#ffd34d',12,260,.5,3);}}
  // particles
  for(let i=G.particles.length-1;i>=0;i--){const q=G.particles[i];q.t+=dt;if(q.t>q.life){G.particles.splice(i,1);continue;}
    if(q.vx!==undefined){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=0.96;q.vy*=0.96;}}
  for(let i=G.floaters.length-1;i>=0;i--){const f=G.floaters[i];f.t+=dt;f.y-=40*dt;if(f.t>f.life)G.floaters.splice(i,1);}
  G.shake*=Math.pow(0.001,dt);if(G.shake<0.2)G.shake=0;
  // glitch char unlock
  if(G.time>=600&&!save.glitchUnlocked){save.glitchUnlocked=true;persist();announce('👁 GLITCH UNLOCKED 👁','#ffd34d');}
  updateHUD();
}
function hurtPlayer(d){const p=G.player;const real=Math.max(1,d-p.armor);p.hp-=real;p.inv=0.5;AudioSys.hit();shake(7);G.combo=0;
  burst(p.x,p.y,'#ff3b5c',10,320,.5,4);const f=$('damage-flash');f.style.opacity=0.9;setTimeout(()=>f.style.opacity=0,120);
  floater(p.x,p.y-20,'-'+Math.round(real),'#ff3b5c',16);
  if(p.hp<=0){p.hp=0;gameOver();}}
function updateHUD(){$('timer').textContent=fmtTime(G.time);$('kills').textContent=G.kills;
  $('level-badge').textContent='LV '+G.level;
  $('xpbar').style.width=(G.xp/G.xpNeed*100)+'%';
  const p=G.player;$('hpbar').style.width=(p.hp/p.maxhp*100)+'%';$('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxhp} HP`;
  $('dashbar').style.width=(clamp(1-G.dashCD/2,0,1)*100)+'%';
  $('novabar').style.width=(G.nova/G.novaMax*100)+'%';
  $('nova-wrap').querySelector('span').textContent=G.nova>=G.novaMax?'NOVA [E] READY 💥':'NOVA CHARGING…';
  const c=$('combo');if(G.combo>=10){c.classList.remove('hidden');c.textContent=`🔥 x${G.combo} COMBO`;}else c.classList.add('hidden');
  const s=$('streak');const dps=G.weapons?Object.keys(G.weapons).length:0;
  if(G.bossActive){$('boss-bar').style.width=(clamp(G.bossActive.hp/G.bossActive.maxhp,0,1)*100)+'%';}}
function fmtTime(t){const m=Math.floor(t/60),s=Math.floor(t%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function updateFragHUD(){const f=Math.floor(G.frags);$('frag-count').textContent='◆'+(save.frags+f);}

/* ============ RENDER ============ */
let bgStars=[];for(let i=0;i<140;i++)bgStars.push({x:Math.random(),y:Math.random(),z:rand(.2,1),s:rand(1,2.5)});
function render(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#05060f';ctx.fillRect(0,0,W,H);
  if(G.state==='menu')return;
  const p=G.player;if(!p)return;
  const shx=rand(-G.shake,G.shake),shy=rand(-G.shake,G.shake);
  const camX=p.x-W/2+shx,camY=p.y-H/2+shy;
  ctx.save();ctx.translate(-camX,-camY);
  // nebula blobs (cheap)
  const t=performance.now()/1000;
  for(let i=0;i<5;i++){const nx=p.x+Math.sin(t*0.05+i*2.1)*900+i*350-700,ny=p.y+Math.cos(t*0.04+i*1.7)*900-400;
    const g=ctx.createRadialGradient(nx,ny,0,nx,ny,420);const cols=['rgba(255,43,214,0.07)','rgba(0,240,255,0.07)','rgba(120,60,255,0.08)','rgba(255,60,90,0.06)','rgba(0,255,170,0.06)'];
    g.addColorStop(0,cols[i]);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(nx-420,ny-420,840,840);}
  // grid
  ctx.strokeStyle='rgba(0,240,255,0.09)';ctx.lineWidth=1;ctx.beginPath();
  const gs=90;const x0=Math.floor(camX/gs)*gs,x1=camX+W,y0=Math.floor(camY/gs)*gs,y1=camY+H;
  for(let x=x0;x<x1;x+=gs){ctx.moveTo(x,y0);ctx.lineTo(x,y1);}for(let y=y0;y<y1;y+=gs){ctx.moveTo(x0,y);ctx.lineTo(x1,y);}ctx.stroke();
  // stars parallax
  ctx.fillStyle='#fff';for(const s of bgStars){const sx=((s.x*2000-p.x*s.z)%2000+2000)%2000+p.x-1000,sy=((s.y*2000-p.y*s.z)%2000+2000)%2000+p.y-1000;
    if(Math.abs(sx-p.x)>W/2+50||Math.abs(sy-p.y)>H/2+50)continue;ctx.globalAlpha=0.3+s.z*0.5;ctx.fillRect(sx,sy,s.s,s.s);}ctx.globalAlpha=1;
  ctx.globalCompositeOperation='lighter';
  // gems
  for(const g of G.gems){const bob=Math.sin((g.t||0)*5)*2;ctx.fillStyle=g.v>=10?'#ffd34d':g.v>=4?'#ff2bd6':'#00f0ff';
    ctx.save();ctx.translate(g.x,g.y+bob);ctx.rotate((g.t||0)*2);const s2=4+g.v*0.4;ctx.fillRect(-s2/2,-s2/2,s2,s2);ctx.restore();}
  // pickups
  for(const k of G.pickups){ctx.font='22px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(k.kind==='heart'?'💖':k.kind==='magnet'?'🧲':'📦',k.x,k.y+Math.sin(k.t*4)*3);}
  // mines
  for(const mn of G.mines){ctx.strokeStyle=mn.t>mn.arm?'#ff3b5c':'#ffd34d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mn.x,mn.y,10+Math.sin(mn.t*8)*2,0,TAU);ctx.stroke();
    ctx.fillStyle='#ffd34d';ctx.beginPath();ctx.arc(mn.x,mn.y,4,0,TAU);ctx.fill();}
  // black holes
  for(const h of G.holes){ctx.strokeStyle='#b44dff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.stroke();
    ctx.fillStyle='#000';ctx.beginPath();ctx.arc(h.x,h.y,h.r*0.55+t*2%5,0,TAU);ctx.fill();
    ctx.strokeStyle='rgba(180,77,255,0.4)';ctx.beginPath();ctx.arc(h.x,h.y,h.r+14+Math.sin(t*5)*4,0,TAU);ctx.stroke();}
  // enemies
  for(const e of G.enemies){const flash=e.flash>0;
    ctx.save();ctx.translate(e.x,e.y);
    if(e.boss){ctx.shadowColor=e.color;ctx.shadowBlur=30;}
    ctx.fillStyle=flash?'#ffffff':e.color;
    if(e.type==='brute'||e.boss){ctx.rotate(e.t*0.8);ctx.fillRect(-e.r,-e.r,e.r*2,e.r*2);ctx.rotate(-e.t*1.6);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(-e.r*0.6,-e.r*0.6,e.r*1.2,e.r*1.2);}
    else if(e.type==='shooter'){ctx.beginPath();ctx.moveTo(e.r,0);ctx.lineTo(-e.r,e.r*0.8);ctx.lineTo(-e.r*0.5,0);ctx.lineTo(-e.r,-e.r*0.8);ctx.closePath();ctx.fill();}
    else if(e.type==='bomber'){ctx.beginPath();ctx.arc(0,0,e.r*(1+Math.sin(e.t*10)*0.15),0,TAU);ctx.fill();}
    else{ctx.rotate(e.t*2);const r=e.r;ctx.beginPath();for(let k=0;k<6;k++){const a=k/6*TAU;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}
    ctx.shadowBlur=0;
    if(e.elite&&!e.boss){ctx.strokeStyle='#ffd34d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+5+Math.sin(e.t*6)*2,0,TAU);ctx.stroke();}
    if(e.boss){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,e.r+10,0,TAU);ctx.stroke();}
    ctx.restore();
    // hp mini bar for elites/bosses
    if(e.elite||e.maxhp>150){ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(e.x-20,e.y-e.r-12,40,5);
      ctx.fillStyle='#ff3b5c';ctx.fillRect(e.x-20,e.y-e.r-12,40*clamp(e.hp/e.maxhp,0,1),5);}}
  // bullets
  for(const b of G.bullets){ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(b.x,b.y,b.size,0,TAU);ctx.fill();ctx.shadowBlur=0;}
  for(const b of G.ebullets){ctx.fillStyle='#ff3b5c';ctx.shadowColor='#ff3b5c';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.shadowBlur=0;}
  // flame aura ring
  if(G.weapons.flame){const w=G.weapons.flame;const R=w.evo?240:130+w.lvl*10;
    ctx.strokeStyle=w.evo?'rgba(255,211,77,0.5)':'rgba(255,100,60,0.35)';ctx.lineWidth=w.evo?4:2;
    ctx.beginPath();ctx.arc(p.x,p.y,R+Math.sin(t*4)*5,0,TAU);ctx.stroke();}
  // frost ring passive shimmer = pickup radius
  ctx.strokeStyle='rgba(0,240,255,0.10)';ctx.beginPath();ctx.arc(p.x,p.y,p.pickup,0,TAU);ctx.stroke();
  // player
  ctx.save();ctx.translate(p.x,p.y);
  if(G.dashT>0){ctx.globalAlpha=0.5;}
  const aa=Math.atan2(p.aimY,p.aimX);ctx.rotate(aa);
  ctx.shadowColor='#00f0ff';ctx.shadowBlur=22;ctx.fillStyle=p.inv>0&&Math.floor(t*20)%2?'#ffffff':'#00f0ff';
  ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,11);ctx.lineTo(-5,0);ctx.lineTo(-10,-11);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.restore();ctx.globalAlpha=1;
  // orbital blades draw
  if(G.weapons.blades){const w=G.weapons.blades;const n=w.evo?6:2+Math.floor(w.lvl/2);const R=w.evo?130:95+w.lvl*4;
    for(let i=0;i<n;i++){const a=(w.ang||0)+i/n*TAU;const bx=p.x+Math.cos(a)*R,by=p.y+Math.sin(a)*R;
      ctx.fillStyle=w.evo?'#ffd34d':'#ff2bd6';ctx.shadowColor=w.evo?'#ffd34d':'#ff2bd6';ctx.shadowBlur=12;
      ctx.save();ctx.translate(bx,by);ctx.rotate(a*3);ctx.fillRect(-8,-3,16,6);ctx.restore();ctx.shadowBlur=0;}}
  // particles
  for(const q of G.particles){const k=1-q.t/q.life;
    if(q.beam){ctx.strokeStyle=q.color;ctx.globalAlpha=k;ctx.lineWidth=q.size;ctx.beginPath();ctx.moveTo(q.beam.x1,q.beam.y1);ctx.lineTo(q.beam.x2,q.beam.y2);ctx.stroke();ctx.globalAlpha=1;}
    else if(q.ring){const rr=q.ring.r+(q.ring.max-q.ring.r)*(q.t/q.life);ctx.strokeStyle=q.color;ctx.globalAlpha=k;ctx.lineWidth=4;ctx.beginPath();ctx.arc(q.ring.x,q.ring.y,rr,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
    else{ctx.globalAlpha=k;ctx.fillStyle=q.color;ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size);ctx.globalAlpha=1;}}
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
  // floaters (screen space)
  ctx.textAlign='center';for(const f of G.floaters){const k=1-f.t/f.life;ctx.globalAlpha=k;ctx.font=`700 ${f.size}px Rajdhani,sans-serif`;
    ctx.fillStyle=f.color;ctx.fillText(f.txt,f.x-camX,f.y-camY);}ctx.globalAlpha=1;
  // low hp pulse
  if(p.hp/p.maxhp<0.3){ctx.strokeStyle=`rgba(255,59,92,${0.3+Math.sin(t*6)*0.2})`;ctx.lineWidth=30;ctx.strokeRect(0,0,W,H);}
}

/* ============ LOOP ============ */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);let dt=(now-last)/1000;last=now;dt=Math.min(dt,0.05);
  if(G.state==='play')update(dt);render();}
requestAnimationFrame(loop);

/* ============ SCREENS / WIRING ============ */
function refreshMenu(){$('frag-count').textContent='◆'+save.frags;
  $('best-stats').textContent=`BEST: ${save.bestTime>0?fmtTime(save.bestTime):'--'} • MOST KILLS: ${save.mostKills||'--'} • FRAGMENTS: ◆${save.frags}`;
  document.querySelectorAll('.char-card').forEach(c=>{const id=c.dataset.char;
    if(id==='glitch'){c.classList.toggle('locked',!save.glitchUnlocked);if(!save.glitchUnlocked)c.querySelector('.char-desc').textContent='??? Unlock: survive 10 minutes in one run.';else c.querySelector('.char-desc').textContent='👁 +50% luck, evolutions one level early. Reality bends.';}});
  $('mute-btn').textContent=AudioSys.muted?'🔇 SOUND OFF':'🔊 SOUND ON';}
let selectedChar='volt';
document.querySelectorAll('.char-card').forEach(c=>c.onclick=()=>{const id=c.dataset.char;
  if(id==='glitch'&&!save.glitchUnlocked){toast('👁 Survive 10:00 to unlock GLITCH');return;}
  AudioSys.init();AudioSys.tone(600,.1,'sine',.08,900);
  document.querySelectorAll('.char-card').forEach(x=>x.classList.remove('selected'));c.classList.add('selected');selectedChar=id;});
$('start-btn').onclick=()=>startRun(selectedChar);
$('how-btn').onclick=()=>{$('how').classList.remove('hidden');};
$('codex-btn').onclick=()=>{buildCodex();$('codex').classList.remove('hidden');};
$('meta-btn').onclick=()=>{buildMeta();$('meta').classList.remove('hidden');};
$('mute-btn').onclick=()=>toggleMute();
document.querySelectorAll('.close-btn').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add('hidden'));
function toggleMute(){AudioSys.muted=!AudioSys.muted;save.muted=AudioSys.muted;persist();refreshMenu();const pm=$('pause-mute');if(pm)pm.textContent=AudioSys.muted?'🔇 SOUND':'🔊 SOUND';}
function pauseGame(){if(G.state!=='play')return;G.state='pause';G.frozen=true;$('pause').classList.remove('hidden');
  $('pause-stats').innerHTML=`⏱ ${fmtTime(G.time)} &nbsp;•&nbsp; ☠ ${G.kills} kills &nbsp;•&nbsp; LV ${G.level}<br><span class="dim">${Object.keys(G.weapons).length} weapons • ◆${Math.floor(G.frags)} fragments</span>`;}
function resumeGame(){$('pause').classList.add('hidden');G.frozen=false;G.state='play';last=performance.now();}
$('resume-btn').onclick=()=>resumeGame();
$('quit-btn').onclick=()=>{G.state='menu';$('pause').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');refreshMenu();};
$('pause-mute').onclick=()=>toggleMute();
$('shake-btn').onclick=e=>{save.shake=!save.shake;persist();e.target.textContent=save.shake?'📷 SHAKE: ON':'📷 SHAKE: OFF';};
$('aim-btn').onclick=e=>{save.autoAim=!save.autoAim;persist();e.target.textContent=save.autoAim?'🎯 AUTO-AIM: ON':'🎯 AUTO-AIM: OFF';};
$('shake-btn').textContent=save.shake?'📷 SHAKE: ON':'📷 SHAKE: OFF';
$('aim-btn').textContent=save.autoAim?'🎯 AUTO-AIM: ON':'🎯 AUTO-AIM: OFF';
$('retry-btn').onclick=()=>{$('gameover').classList.add('hidden');startRun(selectedChar);};
$('menu-btn').onclick=()=>{$('gameover').classList.add('hidden');G.state='menu';$('menu').classList.remove('hidden');refreshMenu();};
$('endless-btn').onclick=()=>{$('victory').classList.add('hidden');G.frozen=false;G.state='play';announce('ENDLESS VOID UNLEASHED','#ff2bd6');};
function gameOver(){if(G.state!=='play')return;G.state='over';AudioSys.boom();shake(16);
  burst(G.player.x,G.player.y,'#00f0ff',80,500,1,5);
  const earned=Math.floor(G.kills/25+G.time/60*10+G.level*2);save.frags+=earned;
  save.bestTime=Math.max(save.bestTime||0,Math.floor(G.time));save.mostKills=Math.max(save.mostKills||0,G.kills);
  if(G.time>=600)save.glitchUnlocked=true;persist();
  setTimeout(()=>{$('hud').classList.add('hidden');$('gameover').classList.remove('hidden');
    $('go-title').textContent=G.time>=900?'👁 CONSUMED BY GOD':'YOU DISSOLVED';
    $('go-stats').innerHTML=`⏱ Survived <b>${fmtTime(G.time)}</b> • LV ${G.level} • ☠ ${G.kills} kills<br><span class="dim">Best combo x${G.bestCombo} • ${Object.keys(G.weapons).length} weapons</span>`;
    $('go-frags').textContent=`+${earned} ◆ FRAGMENTS BANKED (total ◆${save.frags})`;},900);}
function buildCodex(){const g=$('codex-grid');g.innerHTML='';
  Object.keys(WEAPONS).forEach(id=>{const w=WEAPONS[id],E=EVOS[id];const d=document.createElement('div');d.className='codex-entry';
    d.innerHTML=`<b>${w.icon} ${w.name}</b> → <b>${E.icon} ${E.name}</b><br>${w.desc}<br><span class="dim">Needs: max Lv${G.chars==='glitch'?7:8} + ${PASSIVES[w.cat].icon} ${PASSIVES[w.cat].name}</span>`;g.appendChild(d);});}
function buildMeta(){const g=$('meta-grid');g.innerHTML='';$('meta-frags').textContent='◆'+save.frags;
  META_DEFS.forEach(m=>{const r=save.meta[m.id]||0;const maxed=r>=m.max;const cost=maxed?null:m.cost(r);
    const d=document.createElement('div');d.className='meta-card';
    d.innerHTML=`<b>${m.name}</b> <span class="dim">(${r}/${m.max})</span><br><span class="dim">${m.desc}</span><br>`;
    const b=document.createElement('button');b.textContent=maxed?'MAXED':`BUY — ◆${cost}`;b.disabled=maxed||save.frags<cost;
    b.onclick=()=>{if(save.frags>=cost&&r<m.max){save.frags-=cost;save.meta[m.id]=r+1;persist();AudioSys.pickup();buildMeta();refreshMenu();}};
    d.appendChild(b);g.appendChild(d);});}
refreshMenu();
