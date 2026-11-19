'use strict';
const UI={
  el:{},selChar:'nova',lvlCb:null,
  init(){
    const g=id=>document.getElementById(id);
    this.el={
      hud:g('hud'),xpfill:g('xpfill'),timer:g('hud-timer'),level:g('hud-level'),
      kills:g('hud-kills'),gems:g('hud-gems'),combo:g('hud-combo'),
      bossbar:g('bossbar'),bossname:g('bossname'),bossfill:g('bossfill'),
      hpfill:g('hpfill'),hptext:g('hptext'),weapicons:g('weapicons'),dashfill:g('dashfill'),
      banner:g('banner'),toasts:g('toasts'),fxRed:g('fx-red'),fxFlash:g('fx-flash'),
      title:g('screen-title'),chars:g('screen-chars'),shop:g('screen-shop'),help:g('screen-help'),
      lvl:g('modal-levelup'),cards:g('cards'),pause:g('modal-pause'),
      over:g('screen-over'),win:g('screen-win'),
      titleMenu:g('title-menu'),titleStats:g('title-stats'),
    };
    g('btn-pause').addEventListener('click',()=>this.togglePause());
    this.buildTitle();
    this.buildHelp();
    this.showScreen('title');
  },
  isTouchOn(){return Input.touchMode;},
  showJoy(jb,jn,x,y){jb.style.display=jn.style.display='block';jb.style.left=x+'px';jb.style.top=y+'px';jn.style.left=x+'px';jn.style.top=y+'px';},
  moveJoy(jn,x,y){jn.style.left=x+'px';jn.style.top=y+'px';},
  hideJoy(jb,jn){jb.style.display=jn.style.display='none';},
  showScreen(name){
    for(const s of ['title','chars','shop','help'])this.el[s].classList.add('hidden');
    this.el.over.classList.add('hidden');
    this.el.win.classList.add('hidden');
    if(name==='title'){
      this.el.title.classList.remove('hidden');
      this.buildTitle();
    }
    else if(name==='chars'){this.buildChars();this.el.chars.classList.remove('hidden');}
    else if(name==='shop'){this.buildShop();this.el.shop.classList.remove('hidden');}
    else if(name==='help')this.el.help.classList.remove('hidden');
    else if(name==='over')this.el.over.classList.remove('hidden');
    else if(name==='win')this.el.win.classList.remove('hidden');
  },
  showHUD(on){
    this.el.hud.classList.toggle('hidden',!on);
    this.el.combo.style.opacity=0;
    this.hideBoss();
  },
  buildTitle(){
    const m=this.el.titleMenu;
    m.innerHTML='';
    const mk=(txt,cls,fn)=>{
      const b=document.createElement('button');
      b.className='btn '+cls;b.textContent=txt;
      b.addEventListener('click',()=>{AudioSys.unlock();AudioSys.sfx('ui');fn();});
      m.appendChild(b);
    };
    mk('DEPLOY','primary',()=>{this.selChar='nova';this.showScreen('chars');});
    mk('PILOTS','',()=>this.showScreen('chars'));
    mk('BLACK MARKET','',()=>this.showScreen('shop'));
    mk('INTEL','',()=>this.showScreen('help'));
    const s=this.el.titleStats;
    s.innerHTML='<span>BEST TIME <b>'+U.fmtTime(Save.d.best.time)+'</b></span>'+
      '<span>BEST KILLS <b>'+U.fmtNum(Save.d.best.kills)+'</b></span>'+
      '<span>GEMS <b>'+U.fmtNum(Save.d.gems)+'</b></span>'+
      '<span>STORMS MASTERED <b>'+Save.d.wins+'</b></span>';
  },
  buildChars(){
    const sc=this.el.chars;
    sc.innerHTML='';
    const title=document.createElement('div');
    title.className='ptitle';title.textContent='CHOOSE YOUR PILOT';
    sc.appendChild(title);
    const grid=document.createElement('div');grid.className='chargrid';
    for(const c of DATA.CHARS){
      const unlocked=this.unlockedChar(c);
      const card=document.createElement('div');
      card.className='charcard'+(unlocked?'':' lock')+(this.selChar===c.id?' sel':'');
      card.style.setProperty('--c',c.color);
      card.innerHTML=
        '<div class="nm">'+c.name+'</div>'+
        '<div class="wp">STARTS WITH: '+DATA.WEAPONS[c.w].name+'</div>'+
        '<div class="ds">'+c.desc+'</div>'+
        '<div class="st">HP '+c.hp+(c.armor?' · ARMOR '+c.armor:'')+' · SPD '+Math.round(c.spd*100)+'%'+(c.dmg!==1?' · DMG '+Math.round(c.dmg*100)+'%':'')+'</div>'+
        (unlocked?'':'<div class="ul">LOCKED — '+c.unlock.label+'</div>');
      if(unlocked)card.addEventListener('click',()=>{
        this.selChar=c.id;AudioSys.sfx('ui');this.buildChars();
      });
      grid.appendChild(card);
    }
    sc.appendChild(grid);
    const menu=document.createElement('div');menu.className='menu';
    const launch=document.createElement('button');
    launch.className='btn primary';launch.textContent='LAUNCH RUN';
    launch.addEventListener('click',()=>{AudioSys.unlock();Game.reset(this.selChar);});
    const back=document.createElement('button');
    back.className='btn small';back.textContent='BACK';
    back.addEventListener('click',()=>this.showScreen('title'));
    menu.appendChild(launch);menu.appendChild(back);
    sc.appendChild(menu);
  },
  unlockedChar(c){
    if(!c.unlock)return true;
    if(Save.d.chars[c.id])return true;
    if(c.unlock.t==='boss')return Save.d.ach['boss'];
    if(c.unlock.t==='level')return Save.d.best.level>=c.unlock.v;
    if(c.unlock.t==='time')return Save.d.best.time>=c.unlock.v;
    return false;
  },
  buildShop(){
    const sc=this.el.shop;
    sc.innerHTML='';
    const title=document.createElement('div');
    title.className='ptitle';title.textContent='BLACK MARKET — PERMANENT UPGRADES';
    sc.appendChild(title);
    const bal=document.createElement('div');
    bal.className='statline';
    bal.innerHTML='<span>GEMS <b>'+U.fmtNum(Save.d.gems)+'</b></span>';
    sc.appendChild(bal);
    const grid=document.createElement('div');grid.className='shopgrid';
    for(const it of DATA.SHOP){
      const lvl=mUp(it.id);
      const cost=it.cost(lvl);
      const row=document.createElement('div');row.className='shoprow';
      let pips='<div class="pipsm">';
      for(let i=0;i<it.max;i++)pips+='<span class="'+(i<lvl?'on':'')+'"></span>';
      pips+='</div>';
      row.innerHTML='<div class="info"><div class="nm">'+it.name+'</div><div class="ds">'+it.desc+'</div>'+pips+'</div>';
      const btn=document.createElement('button');
      btn.className='btn small gold';
      btn.textContent=lvl>=it.max?'MAXED':'◆ '+cost;
      btn.disabled=lvl>=it.max||Save.d.gems<cost;
      btn.addEventListener('click',()=>{
        if(Save.d.gems<cost||lvl>=it.max)return;
        Save.d.gems-=cost;
        Save.d.up[it.id]=lvl+1;
        Save.w();
        AudioSys.sfx('buy');
        this.buildShop();
      });
      row.appendChild(btn);
      grid.appendChild(row);
    }
    sc.appendChild(grid);
    const back=document.createElement('button');
    back.className='btn small';back.textContent='BACK';
    back.addEventListener('click',()=>this.showScreen('title'));
    sc.appendChild(back);
  },
  buildHelp(){
    const sc=this.el.help;
    sc.innerHTML='';
    const p=document.createElement('div');p.className='panel help-sec';
    p.innerHTML=
      '<h3>MOVEMENT</h3><p><kbd>W A S D</kbd> or <kbd>ARROWS</kbd> to move. Weapons fire automatically at the nearest enemy. On touch screens, drag anywhere to steer.</p>'+
      '<h3>DASH</h3><p><kbd>SPACE</kbd> to dash with brief invincibility. Dash THROUGH packs, not away from them.</p>'+
      '<h3>LEVEL UP</h3><p>Collect XP gems. Each level grants a choice of upgrade. Weapons cap at LV 8.</p>'+
      '<h3>EVOLUTIONS</h3><p>Max a weapon to LV 8 while owning its paired passive, then choose the EVOLUTION card:</p>'+
      '<div class="evo-t">'+
      '<span class="a">PLASMA BOLT</span><span class="arr">+ FOCUS =</span><span>PRISM LANCE</span>'+
      '<span class="a">ORBIT BLADES</span><span class="arr">+ OVERDRIVE =</span><span>GRINDER HALO</span>'+
      '<span class="a">NOVA PULSE</span><span class="arr">+ AMPLIFIER =</span><span>SUPERNOVA</span>'+
      '<span class="a">RAILGUN</span><span class="arr">+ CAPACITOR =</span><span>SINGULARITY RAIL</span>'+
      '<span class="a">SWARM MISSILES</span><span class="arr">+ VELOCITY =</span><span>HIVE MATRIX</span>'+
      '<span class="a">CHAIN LIGHTNING</span><span class="arr">+ BATTERY =</span><span>STORM CORE</span>'+
      '<span class="a">FROST AURA</span><span class="arr">+ PLATING =</span><span>ABSOLUTE ZERO</span>'+
      '<span class="a">CINDER WAVE</span><span class="arr">+ MIGHT =</span><span>DRAGONFIRE</span>'+
      '</div>'+
      '<h3>THE HORDE</h3><ul><li>Gold-glowing ELITES drop Treasure Caches — jackpot loot.</li><li>BOMBERS detonate. SPLITTERS multiply. SHOOTERS keep distance.</li><li>Every 5 minutes a BOSS arrives. Survive 15 minutes and kill the third boss to MASTER THE STORM — then endure Endless mode.</li><li>Gems you bank buy permanent upgrades in the BLACK MARKET.</li></ul>';
    sc.appendChild(p);
    const back=document.createElement('button');
    back.className='btn small';back.textContent='BACK';
    back.addEventListener('click',()=>this.showScreen('title'));
    sc.appendChild(back);
  },

  showLevelUp(cards,cb){
    this.lvlCb=cb;
    const c=this.el.cards;
    c.innerHTML='';
    cards.forEach((card,i)=>{
      const d=document.createElement('div');
      d.className='card';
      d.style.setProperty('--c',DATA.RARITY[card.r].c);
      let pips='';
      if(card.kind==='wup'&&card.wi){
        pips='<div class="pips">';
        for(let k=1;k<=8;k++)pips+='<span class="pip'+(k<=card.wi.lvl+1?' on':'')+'"></span>';
        pips+='</div>';
      }else if(card.kind==='pup'){
        pips='<div class="pips">';
        const mx=DATA.PASSIVES[card.id].max,lvl=card.lvl;
        for(let k=1;k<=mx;k++)pips+='<span class="pip'+(k<=lvl+1?' on':'')+'"></span>';
        pips+='</div>';
      }else if(card.kind==='evo'){
        pips='<div class="pips"><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span><span class="pip on"></span></div>';
      }
      d.innerHTML=
        '<div class="key">'+(i+1)+'</div>'+
        '<div class="rar">'+DATA.RARITY[card.r].n+'</div>'+
        '<div class="nm">'+card.icon+' '+card.title+'</div>'+
        '<div class="ds">'+card.desc+'</div>'+
        pips;
      d.addEventListener('click',()=>this.pickCard(i));
      c.appendChild(d);
    });
    this.el.lvl.classList.remove('hidden');
  },
  pickCard(i){
    if(this.el.lvl.classList.contains('hidden')||!this.lvlCb)return;
    const cb=this.lvlCb;this.lvlCb=null;
    cb(i);
  },
  hideLevelUp(){this.el.lvl.classList.add('hidden');},

  togglePause(){
    if(Game.state==='playing'){
      Game.state='paused';
      this.showPause();
    }else if(Game.state==='paused'){
      this.hidePause();
      Game.state='playing';
    }
  },
  showPause(){
    const p=this.el.pause;
    p.innerHTML='<div class="panel"><div class="ptitle">PAUSED</div>'+
      '<label class="row">MUSIC <input type="range" id="set-mus" min="0" max="1" step="0.05" value="'+Save.d.set.mus+'"></label>'+
      '<label class="row">SFX <input type="range" id="set-sfx" min="0" max="1" step="0.05" value="'+Save.d.set.sfx+'"></label>'+
      '<label class="row">SCREEN SHAKE <input type="checkbox" id="set-shake" '+(Save.d.set.shake?'checked':'')+' style="accent-color:var(--cyan);width:18px;height:18px"></label>'+
      '<div class="menu" style="margin-top:14px">'+
      '<button class="btn primary" id="p-resume">RESUME</button>'+
      '<button class="btn" id="p-retry">RESTART RUN</button>'+
      '<button class="btn danger" id="p-quit">ABANDON RUN</button>'+
      '</div></div>';
    p.querySelector('#set-mus').addEventListener('input',e=>{Save.d.set.mus=+e.target.value;AudioSys.setVolumes();Save.w();});
    p.querySelector('#set-sfx').addEventListener('input',e=>{Save.d.set.sfx=+e.target.value;AudioSys.setVolumes();Save.w();});
    p.querySelector('#set-shake').addEventListener('change',e=>{Save.d.set.shake=e.target.checked;Save.w();});
    p.querySelector('#p-resume').addEventListener('click',()=>this.togglePause());
    p.querySelector('#p-retry').addEventListener('click',()=>{this.hidePause();Game.reset(P.char.id);});
    p.querySelector('#p-quit').addEventListener('click',()=>{this.hidePause();Game.quitToTitle();});
    p.classList.remove('hidden');
  },
  hidePause(){this.el.pause.classList.add('hidden');},

  showGameOver(gems,nb,died){
    this.showHUD(false);
    const sc=this.el.over;
    const tip=U.choice(DATA.TIPS);
    sc.innerHTML='<div class="bigtitle lose">'+(died?'CONSUMED BY THE SWARM':'RUN ABANDONED')+'</div>'+
      (nb.score?'<div class="newbest">NEW BEST SCORE</div>':'')+
      '<div class="stats-grid">'+
      '<div>SURVIVED<b>'+U.fmtTime(Game.time)+'</b></div>'+
      '<div>LEVEL<b>'+P.lvl+'</b></div>'+
      '<div>KILLS<b>'+U.fmtNum(Game.kills)+'</b></div>'+
      '<div>MAX COMBO<b>'+Game.maxCombo+'</b></div>'+
      '<div>DAMAGE DEALT<b>'+U.fmtNum(Game.stats.dmg)+'</b></div>'+
      '<div>GEMS EARNED<b class="gold">+'+gems+'</b></div>'+
      '</div>'+
      '<div class="hintline">BANK: '+U.fmtNum(Save.d.gems)+' GEMS — SPEND THEM IN THE BLACK MARKET</div>'+
      '<div class="hintline" style="color:#6d82a8">TIP: '+tip+'</div>'+
      '<div class="menu"><button class="btn primary" id="o-retry">RUN IT BACK</button>'+
      '<button class="btn" id="o-chars">SWITCH PILOT</button>'+
      '<button class="btn small" id="o-menu">MAIN MENU</button></div>';
    sc.querySelector('#o-retry').addEventListener('click',()=>Game.reset(P.char.id));
    sc.querySelector('#o-chars').addEventListener('click',()=>{Game.state='title';this.showScreen('chars');});
    sc.querySelector('#o-menu').addEventListener('click',()=>{Game.state='title';this.showScreen('title');});
    this.showScreen('over');
  },

  showVictory(gems,nb){
    this.showHUD(false);
    const sc=this.el.win;
    sc.innerHTML='<div class="bigtitle win">STORM MASTERED</div>'+
      '<div class="hintline" style="color:#ffd23b">15 MINUTES. THREE TITANS. ONE SURVIVOR. YOU.</div>'+
      (nb.score?'<div class="newbest">NEW BEST SCORE</div>':'')+
      '<div class="stats-grid">'+
      '<div>SURVIVED<b>'+U.fmtTime(Game.time)+'</b></div>'+
      '<div>LEVEL<b>'+P.lvl+'</b></div>'+
      '<div>KILLS<b>'+U.fmtNum(Game.kills)+'</b></div>'+
      '<div>MAX COMBO<b>'+Game.maxCombo+'</b></div>'+
      '<div>GEMS EARNED<b class="gold">+'+gems+'</b></div>'+
      '<div>DAMAGE DEALT<b>'+U.fmtNum(Game.stats.dmg)+'</b></div>'+
      '</div>'+
      '<div class="menu"><button class="btn gold" id="w-endless">CONTINUE — ENDLESS MODE</button>'+
      '<button class="btn primary" id="w-retry">NEW RUN</button>'+
      '<button class="btn small" id="w-menu">MAIN MENU</button></div>';
    sc.querySelector('#w-endless').addEventListener('click',()=>Game.continueEndless());
    sc.querySelector('#w-retry').addEventListener('click',()=>Game.reset(P.char.id));
    sc.querySelector('#w-menu').addEventListener('click',()=>{Game.state='title';this.showScreen('title');});
    this.showScreen('win');
  },

  banner(t1,t2,color,warn){
    const b=this.el.banner;
    b.querySelector('.b1').textContent=t1;
    b.querySelector('.b1').style.color=color||'#fff';
    b.querySelector('.b2').textContent=t2||'';
    b.classList.add('show');
    b.classList.toggle('warn',!!warn);
    clearTimeout(this._bt);
    this._bt=setTimeout(()=>b.classList.remove('show'),warn?2600:2200);
  },
  toast(txt,cls){
    const t=document.createElement('div');
    t.className='toast '+(cls||'');
    t.textContent=txt;
    this.el.toasts.appendChild(t);
    AudioSys.sfx('toast');
    setTimeout(()=>t.classList.add('out'),2600);
    setTimeout(()=>t.remove(),3100);
  },
  comboPop(n){
    const c=this.el.combo;
    c.textContent='x'+n+' COMBO';
    c.style.opacity=1;
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
    clearTimeout(this._ct);
    this._ct=setTimeout(()=>{c.style.opacity=0;},1400);
  },
  redFlash(){
    this._redLock=true;
    this.el.fxRed.style.opacity=.9;
    clearTimeout(this._rt);
    this._rt=setTimeout(()=>{this.el.fxRed.style.opacity=0;this._redLock=false;},130);
  },
  redLow(frac){
    if(this._redLock)return;
    this.el.fxRed.style.opacity=frac<.3?(.35+(.3-frac)*1.4):0;
  },
  flashGold(){
    this.el.fxFlash.style.opacity=1;
    clearTimeout(this._ft);
    this._ft=setTimeout(()=>this.el.fxFlash.style.opacity=0,160);
  },
  weapRefresh(){
    const w=this.el.weapicons;
    w.innerHTML='';
    for(const wp of P.weapons){
      const d=document.createElement('div');
      d.className='wicon'+(wp.def.isEvo?' evo':'');
      d.style.color=wp.def.color;
      d.style.borderColor=wp.def.color;
      d.innerHTML=wp.def.icon+'<span class="lv">'+(wp.def.isEvo?'MAX':wp.lvl)+'</span>';
      w.appendChild(d);
    }
    Game.weapDirty=false;
  },

  updateHUD(){
    if(this.el.hud.classList.contains('hidden'))return;
    this.el.timer.textContent=U.fmtTime(Game.time);
    this.el.level.textContent='LV '+P.lvl;
    this.el.kills.textContent='KILLS '+U.fmtNum(Game.kills);
    this.el.gems.textContent='◆ '+P.coinsRun;
    const xf=U.clamp(P.xp/P.xpNext,0,1);
    this.el.xpfill.style.width=(xf*100)+'%';
    const hf=U.clamp(P.hp/P.maxhp,0,1);
    this.el.hpfill.style.width=(hf*100)+'%';
    this.el.hpfill.classList.toggle('low',hf<.35);
    this.el.hptext.textContent=Math.ceil(Math.max(0,P.hp))+'/'+P.maxhp;
    const dc=1-U.clamp(P.dashCd/(DATA.C.dashCd*P.dashCdM),0,1);
    this.el.dashfill.style.width=(dc*100)+'%';
    if(Game.weapDirty)this.weapRefresh();
    if(Game.boss&&!this.el.bossbar.classList.contains('hidden')){
      this.el.bossfill.style.width=(U.clamp(Game.boss.hp/Game.boss.maxhp,0,1)*100)+'%';
    }else if(Game.boss){
      this.el.bossname.textContent=Game.boss.def.name;
      this.el.bossbar.classList.remove('hidden');
    }
  },
  hideBoss(){this.el.bossbar.classList.add('hidden');},
};
