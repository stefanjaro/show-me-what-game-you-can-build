'use strict';
const Game={
  state:'title',time:0,kills:0,combo:0,comboT:0,maxCombo:0,
  boss:null,bossIdx:0,bossTimer:0,warnT:0,endless:false,endlessMult:1,
  spawnAcc:0,tlIdx:0,levelQueue:0,
  slowmo:0,hitstop:0,ts:1,dyingT:0,
  stats:{dmg:0,taken:0},
  weapDirty:true,heartT:0,achT:0,

  scale(){
    const t=this.time;
    const hp=(1+t/60*.34+Math.pow(t/70,2)*.022)*this.endlessMult;
    const dmg=(1+t/300*.5)*this.endlessMult;
    return {hp,dmg};
  },
  reset(charId){
    clearEntities();
    P.setup(charId);
    Cam.snap(P.x,P.y);
    this.state='playing';this.time=0;this.kills=0;this.combo=0;this.comboT=0;this.maxCombo=0;
    this.boss=null;this.bossIdx=0;this.warnT=0;this.endless=false;this.endlessMult=1;
    this.spawnAcc=0;this.tlIdx=0;this.levelQueue=0;
    this.slowmo=0;this.hitstop=0;this.ts=1;this.dyingT=0;
    this.stats={dmg:0,taken:0};
    this.weapDirty=true;
    AudioSys.setTier(0);
    AudioSys.startMusic();
    UI.showHUD(true);
    UI.banner('SURVIVE','THE SWARM IS COMING','#19e3ff');
    UI.weapRefresh();
  },

  update(dtRaw){
    if(this.hitstop>0){
      this.hitstop-=dtRaw;
      return;
    }
    let dt=dtRaw;
    if(this.slowmo>0){this.slowmo-=dtRaw;dt*=.25;}
    this.ts=dt/dtRaw||1;
    if(this.state==='playing'||this.state==='dying'){
      this.time+=dt;
      this.director(dt);
      updatePlayer(dt);
      updateWeapons(dt);
      updateEnemies(dt);
      updateBullets(dt);
      updateEBullets(dt);
      updatePickups(dt);
      updateZones(dt);
      updateBeams(dt);
      updateGhosts(dt);
      Particles.update(dt);
      Fx.update(dt);
      Cam.update(dt,P.x,P.y);
      if(this.comboT>0){
        this.comboT-=dt;
        if(this.comboT<=0)this.combo=0;
      }
      this.musicTier();
      this.achT-=dt;
      if(this.achT<=0){this.achT=.5;this.checkAch();}
      if(this.heartT>0){this.heartT-=dt;}
      else if(P.hp<P.maxhp*.3&&!P.dead){
        this.heartT=.9;AudioSys.sfx('heartbeat');
      }
      if(P.dead){
        this.dyingT+=dt;
        if(this.dyingT>1.6)this.endRun(true);
      }
      if(this.warnT>0){
        this.warnT-=dt;
        if(this.warnT<=0)this.spawnBossNow();
      }
      UI.redLow(P.hp/P.maxhp);
    }else{
      Particles.update(dt);
      Fx.update(dt);
    }
  },

  musicTier(){
    let t=0;
    if(this.boss)t=3;
    else if(this.time>560||E.length>110)t=2;
    else if(this.time>110||E.length>45)t=1;
    AudioSys.setTier(t);
  },

  director(dt){
    while(this.tlIdx<DATA.TL.length&&this.time>=DATA.TL[this.tlIdx].t){
      const ev=DATA.TL[this.tlIdx];
      UI.banner(ev.txt,ev.ev?'ELITE PACKAGE DETECTED':'',ev.c);
      if(ev.ev)this.doEvent(ev.ev);
      this.tlIdx++;
    }
    if(!this.endless){
      const bTimes=[300,600,900];
      const bDef=DATA.BOSS[this.bossIdx];
      if(bDef&&this.bossIdx<3&&this.time>=bTimes[this.bossIdx]-3&&this.warnT<=0&&!this.boss){
        this.warnT=3;
        UI.banner('!! WARNING !!',bDef.name+' INBOUND','#ff3b5c',true);
        AudioSys.sfx('warn');
      }
    }else{
      this.endlessT-=dt;
      if(this.endlessT<=0&&!this.boss){
        this.endlessT=150;
        this.warnT=3;
        const bDef=DATA.BOSS[this.bossIdx%DATA.BOSS.length];
        UI.banner('!! WARNING !!',bDef.name+' INBOUND','#ff3b5c',true);
        AudioSys.sfx('warn');
      }
    }
    const cap=Math.min(235,48+this.time*.85);
    if(E.length>=cap)return;
    const rate=Math.min(13,1+this.time/62+(this.endless?3:0));
    this.spawnAcc+=rate*dt;
    while(this.spawnAcc>=1){
      this.spawnAcc-=1;
      this.spawnOne();
    }
    const eliteC=this.time>300?(.011+this.time/52000):0;
    if(eliteC>0&&Math.random()<eliteC*dt*10){
      const p=spawnPosRing(Math.max(VW,VH)*.42+90);
      spawnEnemy(this.pickType(),p.x,p.y,{elite:true});
    }
  },

  pickType(){
    const t=this.time;
    const w=[['chaser',10]];
    if(t>40)w.push(['swift',6]);
    if(t>90)w.push(['splitter',4.5]);
    if(t>120)w.push(['tank',2.6]);
    if(t>150)w.push(['shooter',3.2]);
    if(t>210)w.push(['bomber',2.8]);
    if(t>480)w.push(['orbiter',3]);
    let tot=0;for(const x of w)tot+=x[1];
    let r=Math.random()*tot;
    for(const x of w){r-=x[1];if(r<=0)return x[0];}
    return 'chaser';
  },

  spawnOne(){
    const p=spawnPosRing(Math.max(VW,VH)*.42+90);
    spawnEnemy(this.pickType(),p.x,p.y);
  },

  doEvent(name){
    const p=spawnPosRing(Math.max(VW,VH)*.42+80);
    if(name==='swiftRing'){
      for(let i=0;i<14;i++){
        const a=i/14*U.TAU;
        spawnEnemy('swift',P.x+Math.cos(a)*520,P.y+Math.sin(a)*520);
      }
    }else if(name==='bomberPack'){
      for(let i=0;i<9;i++){
        const a=i/9*U.TAU;
        spawnEnemy('bomber',P.x+Math.cos(a)*480,P.y+Math.sin(a)*480);
      }
    }else if(name==='tankWall'){
      for(let i=0;i<10;i++)
        spawnEnemy('tank',p.x+U.rand(-200,200),p.y+U.rand(-140,140));
    }else if(name==='orbiterStorm'){
      for(let i=0;i<12;i++){
        const a=i/12*U.TAU;
        spawnEnemy('orbiter',P.x+Math.cos(a)*460,P.y+Math.sin(a)*460);
      }
    }else if(name==='voidSurge'){
      for(let i=0;i<24;i++){
        const a=i/24*U.TAU;
        spawnEnemy(U.choice(['chaser','splitter','shooter','tank']),P.x+Math.cos(a)*540,P.y+Math.sin(a)*540);
      }
    }
  },

  spawnBossNow(){
    const sc=this.scale();
    let def,mult;
    if(this.endless){
      def=DATA.BOSS[this.bossIdx%DATA.BOSS.length];
      mult=Math.pow(1.9,Math.floor(this.bossIdx/3)+1);
    }else{
      def=DATA.BOSS[this.bossIdx];
      mult=1;
    }
    spawnBoss(def,mult);
    UI.banner(def.name,'A TITAN OF THE VOID APPROACHES',def.color);
    AudioSys.sfx('warn');
    AudioSys.sfx('thunder');
  },

  onBossDead(e){
    this.boss=null;
    this.bossIdx++;
    UI.hideBoss();
    this.unlock('boss');
    if(!this.endless&&this.bossIdx>=3&&this.time>=860){
      this.victory();
    }else{
      UI.banner('BOSS SLAIN','THE VOID TREMBLES','#ffd23b');
      this.endlessT=150;
    }
  },

  onKill(e){
    this.kills++;
    this.combo++;this.comboT=DATA.C.comboTime;
    if(this.combo>this.maxCombo)this.maxCombo=this.combo;
    if(this.combo%10===0&&this.combo>0){
      UI.comboPop(this.combo);
      if(this.combo===50)this.unlock('combo50');
    }
    if(this.kills===1)this.unlock('blood');
    if(this.kills===100)this.unlock('k100');
    if(this.kills===1000)this.unlock('k1000');
  },

  bomberBlast(e){
    explodeAt(e.x,e.y,64,0,'#ffb300');
    if(U.dist(e.x,e.y,P.x,P.y)<64+P.r&&!P.dead)damagePlayer(20);
    Particles.burst(e.x,e.y,'#ffb300',18,220,.5,3.5);
  },

  addXp(v){
    if(P.dead)return;
    v*=P.xpM*(1+Math.min(this.combo,120)*.0025);
    P.xp+=v;
    let leveled=false;
    while(P.xp>=P.xpNext){
      P.xp-=P.xpNext;
      P.lvl++;
      P.xpNext=Math.round(10+P.lvl*7+P.lvl*P.lvl*.5);
      this.levelQueue++;
      leveled=true;
      if(P.lvl===15)this.unlock('lv15');
    }
    if(leveled&&this.state==='playing'){
      this.slowmo=.45;
      UI.flashGold();
      Fx.ring(P.x,P.y,10,150,'#ffd23b',.5,3);
      AudioSys.sfx('levelup');
      AudioSys.duck();
      this.openLevelUp();
    }
  },

  evoReady(w){
    return w.lvl>=8&&w.def.evo&&!P.weapons.some(x=>x.id===w.def.evo.id);
  },

  genChoices(){
    const pool=[];
    const luckW=ri=>1+P.luck*ri*1.4;
    for(const w of P.weapons){
      if(w.lvl<8){
        const ri=Math.min(2,Math.floor((w.lvl-1)/3));
        pool.push({kind:'wup',r:ri,id:w.id,wi:w,title:w.def.name+' LV '+(w.lvl+1),
          desc:'Upgrade: '+this.upgradeHint(w),color:w.def.color,icon:w.def.icon});
      }
      if(this.evoReady(w)){
        const e=w.def.evo,ed=DATA.WEAPONS[e.id];
        pool.push({kind:'evo',r:3,id:e.id,title:ed.name,
          desc:'EVOLUTION! '+w.def.name+' fuses with its core and transcends.',color:ed.color,icon:ed.icon,wi:w});
      }
    }
    if(P.weapons.length<4){
      for(const id in DATA.WEAPONS){
        const d=DATA.WEAPONS[id];
        if(d.isEvo)continue;
        if(P.weapons.some(w=>w.id===id))continue;
        pool.push({kind:'wnew',r:1,id,title:d.name,desc:d.desc,color:d.color,icon:d.icon});
      }
    }
    for(const id in DATA.PASSIVES){
      const d=DATA.PASSIVES[id];
      const lvl=pl(id);
      const owned=id in P.passives;
      if(owned&&lvl>=d.max)continue;
      if(!owned&&Object.keys(P.passives).length>=4)continue;
      const ri=lvl>=3?2:lvl>=1?1:0;
      pool.push({kind:owned?'pup':'pnew',r:ri,id,title:d.name+(owned?' LV '+(lvl+1):''),
        desc:d.desc,color:d.color,icon:owned?'+':'✧',lvl,owned});
    }
    if(!pool.length){
      return [
        {kind:'heal',r:0,title:'REPAIR NANITES',desc:'Restore 40 HP instantly.',color:'#2bff9e',icon:'✚'},
        {kind:'greed',r:1,title:'Void Cache',desc:'Gain 40 gems immediately.',color:'#ffd23b',icon:'◆'},
        {kind:'fury',r:2,title:'BERSERKER SURGE',desc:'+5% damage for the rest of this run.',color:'#ff5c8a',icon:'⚔'},
      ];
    }
    const picks=[];
    const arr=pool.slice();
    for(let i=0;i<3&&arr.length;i++){
      let tot=0;
      for(const c of arr)tot+=DATA.RARITY[c.r].w*luckW(c.r);
      let r=Math.random()*tot,best=arr[0],acc=0;
      for(let j=0;j<arr.length;j++){
        acc+=DATA.RARITY[arr[j].r].w*luckW(arr[j].r);
        if(acc>=r){best=arr[j];break;}
      }
      picks.push(best);
      arr.splice(arr.indexOf(best),1);
    }
    return picks;
  },

  upgradeHint(w){
    const hints={
      plasma:l=>l===3||l===6||l===8?'+1 bolt':l===4||l===8?'+1 pierce':'+damage & fire rate',
      prism:l=>'+damage & velocity',
      orbit:l=>l%2===0?'+1 shard':'+damage & size',
      grinder:l=>'+damage',
      nova:l=>'+damage & radius',
      supernova:l=>'+damage & radius',
      rail:l=>'+damage & beam width',
      singularity:l=>'+damage & pull force',
      missile:l=>l===3||l===5||l===7?'+1 rocket':'+damage',
      hive:l=>l===5?'+1 rocket':'+damage',
      chain:l=>'+damage & more chains',
      stormcore:l=>'+damage',
      frost:l=>'+radius, slow & dps',
      absolutezero:l=>'+dps',
      cinder:l=>'+damage & range',
      dragonfire:l=>'+damage & range',
    };
    return (hints[w.id]||(()=>'Improved stats'))(w.lvl);
  },

  openLevelUp(){
    this.state='levelup';
    this.choices=this.genChoices();
    UI.showLevelUp(this.choices,i=>this.chooseCard(i));
  },
  chooseCard(i){
    const c=this.choices[i];
    if(!c)return;
    AudioSys.sfx('choose');
    this.levelQueue=Math.max(0,this.levelQueue-1);
    if(c.kind==='wup'){
      c.wi.lvl++;
    }else if(c.kind==='wnew'){
      P.addWeapon(c.id);
    }else if(c.kind==='pup'){
      P.passives[c.id]=(P.passives[c.id]||0)+1;
      P.recalc();
    }else if(c.kind==='pnew'){
      P.passives[c.id]=1;
      P.recalc();
    }else if(c.kind==='evo'){
      const w=c.wi;
      const evoId=w.def.evo.id;
      const idx=P.weapons.indexOf(w);
      const def=DATA.WEAPONS[evoId];
      P.weapons[idx]={id:evoId,def,lvl:w.lvl,timer:.2,data:{ang:U.rand(U.TAU),ft:0}};
      this.unlock('evo');
      UI.banner('EVOLUTION!',def.name+' FORGED',def.color);
      AudioSys.sfx('evolve');
      Particles.burst(P.x,P.y,def.color,40,300,.8,4);
      Fx.ring(P.x,P.y,10,260,def.color,.7,4);
      Cam.add(8);
    }else if(c.kind==='heal'){
      P.hp=Math.min(P.maxhp,P.hp+40);
    }else if(c.kind==='greed'){
      P.coinsRun+=40;
    }else if(c.kind==='fury'){
      P.dmgM*=1.05;
    }
    this.weapDirty=true;
    this.state='playing';
    UI.hideLevelUp();
    if(this.levelQueue>0){
      this.slowmo=.3;
      setTimeout(()=>{if(this.state==='playing')this.openLevelUp();},60);
    }
  },

  openChest(){
    const greed=1+mUp('m_greed')*.1;
    const g=Math.round(U.randi(8,16)*greed);
    P.coinsRun+=g;
    this.levelQueue+=U.randi(1,2);
    UI.flashGold();
    UI.toast('TREASURE CACHE! +'+g+' gems','gold');
    AudioSys.sfx('chest');
    Particles.burst(P.x,P.y,'#ffd23b',24,220,.6,3);
    if(this.state==='playing')this.openLevelUp();
  },

  checkAch(){
    if(P.noDmgT>=60&&this.time>60)this.unlock('clean');
    if(Save.d.gems+P.coinsRun>=500)this.unlock('rich');
  },
  unlock(id){
    if(Save.d.ach[id])return;
    Save.d.ach[id]=true;
    const a=DATA.ACH.find(a=>a.id===id);
    if(a){UI.toast('ACHIEVEMENT — '+a.n,'ach');AudioSys.sfx('chest');}
    Save.w();
  },

  playerDeath(){
    this.state='dying';
    this.slowmo=1.2;
    Cam.add(16);
    AudioSys.sfx('bigkill');
    Particles.burst(P.x,P.y,'#19e3ff',50,320,.9,4);
    Particles.burst(P.x,P.y,'#ffffff',20,200,.7,3);
    Fx.ring(P.x,P.y,10,300,'#19e3ff',.8,4);
  },

  runGems(){
    const base=P.coinsRun+Math.floor(this.kills/10)+Math.floor(this.time/4);
    return Math.round(base*(1+mUp('m_greed')*.1));
  },

  endRun(died){
    if(this.state==='over')return;
    this.state='over';
    const gems=this.runGems();
    Save.d.gems+=gems;
    Save.d.runs++;
    const score=Math.floor(this.time*10+this.kills*2+P.lvl*50);
    const nb={time:this.time>this.best('time'),kills:this.kills>Save.d.best.kills,level:P.lvl>Save.d.best.level,score:score>Save.d.best.score};
    Save.d.best.time=Math.max(Save.d.best.time,this.time);
    Save.d.best.kills=Math.max(Save.d.best.kills,this.kills);
    Save.d.best.level=Math.max(Save.d.best.level,P.lvl);
    Save.d.best.score=Math.max(Save.d.best.score,score);
    Save.w();
    AudioSys.stopMusic();
    AudioSys.sfx('defeat');
    UI.showGameOver(gems,nb,died);
  },
  best(k){return k==='time'?Save.d.best.time:0;},

  victory(){
    if(this.state!=='playing')return;
    this.state='victory';
    this.unlock('win');
    Save.d.wins++;
    const gems=this.runGems();
    Save.d.gems+=gems;
    const score=Math.floor(this.time*10+this.kills*2+P.lvl*50+5000);
    const nb={time:this.time>Save.d.best.time,kills:this.kills>Save.d.best.kills,level:P.lvl>Save.d.best.level,score:score>Save.d.best.score};
    Save.d.best.time=Math.max(Save.d.best.time,this.time);
    Save.d.best.kills=Math.max(Save.d.best.kills,this.kills);
    Save.d.best.level=Math.max(Save.d.best.level,P.lvl);
    Save.d.best.score=Math.max(Save.d.best.score,score);
    Save.w();
    AudioSys.stopMusic();
    AudioSys.sfx('victory');
    UI.showVictory(gems,nb);
    for(let i=0;i<5;i++){
      setTimeout(()=>{
        Particles.burst(P.x+U.rand(-200,200),P.y+U.rand(-160,160),U.choice(['#ffd23b','#19e3ff','#ff2bd6','#2bff9e']),24,260,.8,3.5);
        AudioSys.sfx('explode');
      },i*350);
    }
  },

  continueEndless(){
    this.state='playing';
    this.endless=true;
    this.endlessMult=this.endlessMult*1.35+0.15;
    this.endlessT=40;
    AudioSys.startMusic();
    UI.showHUD(true);
    UI.banner('ENDLESS MODE','THE STORM NEVER ENDS','#c04bff');
  },

  quitToTitle(){
    if(this.state==='playing'||this.state==='dying')this.endRun(false);
    this.state='title';
    AudioSys.stopMusic();
    UI.showHUD(false);
    UI.showScreen('title');
  },
};
