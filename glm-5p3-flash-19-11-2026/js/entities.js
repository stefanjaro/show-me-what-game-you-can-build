'use strict';
const E=[],B=[],EB=[],PK=[],Zones=[],Beams=[],Ghosts=[];

const P={
  x:0,y:0,vx:0,vy:0,r:11,hp:100,maxhp:100,spd:170,pickup:70,lvl:1,xp:0,xpNext:20,
  iframe:0,dashT:0,dashCd:0,regen:0,armor:0,crit:.05,critM:2,
  dmgM:1,areaM:1,asM:1,spdM:1,projM:1,xpM:1,luck:0,dashCdM:1,revives:0,
  weapons:[],passives:{},face:0,dead:false,hurtT:0,noDmgT:0,coinsRun:0,char:null,moveL:0,moveA:0,
};
function pl(id){return P.passives[id]||0;}
function mUp(id){return Save.d.up[id]||0;}

P.setup=function(charId){
  const c=DATA.CHARS.find(c=>c.id===charId)||DATA.CHARS[0];
  this.char=c;this.weapons=[];this.passives={};
  this.lvl=1;this.xp=0;this.xpNext=20;this.dead=false;
  this.iframe=0;this.dashT=0;this.dashCd=0;this.hurtT=0;this.noDmgT=0;this.coinsRun=0;
  this.vx=0;this.vy=0;this.face=0;
  this.recalc();
  this.hp=this.maxhp;
  this.addWeapon(c.w);
};
P.recalc=function(){
  const c=this.char;
  this.maxhp=Math.round((c.hp)+mUp('m_vit')*10+pl('vitality')*20);
  this.hp=Math.min(this.hp,this.maxhp);
  this.spd=DATA.C.spdBase*c.spd*(1+pl('boots')*.08)*(1+mUp('m_swift')*.03);
  this.dmgM=(c.dmg||1)*(1+pl('might')*.12)*(1+mUp('m_might')*.04);
  this.asM=(c.as||1)*(1+pl('overdrive')*.10);
  this.areaM=(c.area||1)*(1+pl('amplifier')*.10);
  this.projM=1+pl('velocity')*.15;
  this.armor=(c.armor||0)+pl('plating');
  this.crit=.05+pl('focus')*.05;
  this.critM=2+pl('focus')*.25;
  this.regen=pl('regen')*.7;
  this.pickup=DATA.C.pickupBase*(1+pl('magnet')*.3);
  this.xpM=(1+pl('battery')*.1)*(1+mUp('m_xp')*.05);
  this.luck=mUp('m_luck')*.06;
  this.dashCdM=1-mUp('m_dash')*.12;
  this.revives=mUp('m_revive');
};
P.addWeapon=function(id){
  const def=DATA.WEAPONS[id];
  this.weapons.push({id,def,lvl:1,timer:U.rand(.1,.4),data:{ang:U.rand(U.TAU)}});
};

function clearEntities(){
  E.length=0;B.length=0;EB.length=0;PK.length=0;Zones.length=0;Beams.length=0;Ghosts.length=0;
  Particles.list.length=0;Fx.list.length=0;Fx.rings.length=0;
}

function spawnPosRing(dist){
  const a=U.rand(U.TAU);
  return {x:P.x+Math.cos(a)*dist,y:P.y+Math.sin(a)*dist};
}

function spawnEnemy(type,x,y,opts={}){
  const def=DATA.EN[type];
  const sc=Game.scale();
  const e={
    type,def,x,y,vx:0,vy:0,r:def.r,dmg:def.dmg,spd:def.spd*U.rand(.92,1.08),
    color:def.color,shape:def.shape,hp:def.hp*sc.hp,maxhp:def.hp*sc.hp,
    armor:def.armor||0,flash:0,slow:0,slowT:0,stun:0,burnDps:0,burnT:0,burnAcc:0,
    fireT:U.rand(1.5,3),t:U.rand(0,U.TAU),ohCd:0,dead:false,
    xp:def.xp,coin:def.coin,elite:false,isBoss:false,
  };
  if(opts.elite){
    e.elite=true;e.hp=e.maxhp=def.hp*9*sc.hp;e.r*=1.5;e.dmg*=1.4;
    e.xp=def.xp*4;e.spd*=.92;
  }
  if(opts.hpMult){e.hp*=opts.hpMult;e.maxhp=e.hp;}
  E.push(e);return e;
}

function spawnBoss(def,hpMult=1){
  const p=spawnPosRing(Math.max(VW,VH)*.42+140);
  const sc=Game.scale();
  const e={
    type:def.id,def,x:p.x,y:p.y,vx:0,vy:0,r:def.r,dmg:def.dmg*sc.dmg,spd:def.spd,
    color:def.color,shape:'hex',hp:def.hp*hpMult*sc.hp*1.15,maxhp:def.hp*hpMult*sc.hp*1.15,
    armor:3,flash:0,slow:0,slowT:0,stun:0,burnDps:0,burnT:0,burnAcc:0,
    t:0,ohCd:0,dead:false,xp:0,coin:0,elite:false,isBoss:true,
    patt:def.patt,pi:0,patT:2,patName:'spiral',tel:0,telA:0,aiX:0,aiY:0,fireT:0,
  };
  E.push(e);
  Game.boss=e;
  return e;
}

function nearestEnemy(maxD,excl){
  let best=null,bd=maxD*maxD;
  for(const e of E){
    if(e.dead)continue;
    if(excl&&excl.includes(e))continue;
    const d=U.dist2(P.x,P.y,e.x,e.y);
    if(d<bd){bd=d;best=e;}
  }
  return best;
}

function spawnBullet(o){
  B.push(Object.assign({x:0,y:0,vx:0,vy:0,r:4,dmg:10,pierce:0,life:1.2,t:0,dead:false,
    color:'#19e3ff',kind:'plasma',hit:[],hitStop:0},o));
}
function spawnEBullet(x,y,vx,vy,dmg,color='#ff3b5c'){
  EB.push({x,y,vx,vy,r:5,dmg,color,life:6,t:0,dead:false});
}
function spawnPickup(type,x,y,v){
  PK.push({type,x,y,vx:U.rand(-46,46),vy:U.rand(-70,-14),v:v||1,t:0,dead:false});
}
function explodeAt(x,y,r,dmg,color,friendly){
  Fx.ring(x,y,r*.2,r,color,.3,4);
  Particles.burst(x,y,color,14,r*2.2,.45,3);
  AudioSys.sfx('explode');
  Cam.add(5);
  if(friendly!==false){
    const near=Grid.query(x,y,r,tmpArr2);
    for(const e of near){
      if(e.dead)continue;
      const d=U.dist(x,y,e.x,e.y);
      if(d<r+e.r)hitEnemy(e,dmg,{a:U.angle(x,y,e.x,e.y),kb:180});
    }
  }
}

function hitEnemy(e,dmg,o={}){
  if(e.dead)return;
  let d=dmg,crit=false;
  if(!o.flat){
    d*=P.dmgM;
    if(Math.random()<P.crit){crit=true;d*=P.critM;}
  }
  const ap=(o.armorPierce||0);
  d=Math.max(1,d-Math.max(0,(e.armor||0)-ap));
  e.hp-=d;e.flash=1;
  Game.stats.dmg+=d;
  if(o.kb){
    const f=o.kb*(e.isBoss?.06:e.elite?.3:1);
    const a=o.a!==undefined?o.a:U.angle(P.x,P.y,e.x,e.y);
    e.vx+=Math.cos(a)*f;e.vy+=Math.sin(a)*f;
  }
  if(!o.silent){
    Fx.text(e.x+U.rand(-7,7),e.y-e.r-7,String(Math.round(d)),crit?'#ffd23b':'#ffffff',crit?16:11);
    if(crit)Particles.burst(e.x,e.y,'#ffd23b',3,100,.28,2);
    AudioSys.sfx('hit');
  }
  if(e.hp<=0)killEnemy(e);
}

function killEnemy(e){
  if(e.dead)return;
  e.dead=true;
  Game.onKill(e);
  const n=e.isBoss?42:e.elite?18:e.r>14?9:6;
  Particles.burst(e.x,e.y,e.color,n,e.isBoss?280:150,.55,e.isBoss?4:2.6);
  Fx.ring(e.x,e.y,e.r*.4,e.r*(e.isBoss?5:2.2),e.color,.3,2);
  if(e.isBoss){AudioSys.sfx('bossdie');Cam.add(14);Game.hitstop=Math.max(Game.hitstop,.3);}
  else AudioSys.sfx(e.elite?'bigkill':'kill');
  const gems=e.xp;
  if(gems>0){
    let rem=gems;
    while(rem>0){
      const v=rem>=10?10:rem>=5?5:1;rem-=v;
      spawnPickup('xp',e.x+U.rand(-14,14),e.y+U.rand(-14,14),v);
    }
  }
  const greed=1+mUp('m_greed')*.1;
  if(e.isBoss){
    for(let i=0;i<14;i++)spawnPickup('coin',e.x+U.rand(-40,40),e.y+U.rand(-40,40),Math.ceil(2*greed));
    spawnPickup('heart',e.x,e.y,40);
    spawnPickup('chest',e.x+30,e.y,0);
  }else if(e.elite){
    for(let i=0;i<5;i++)spawnPickup('coin',e.x+U.rand(-20,20),e.y+U.rand(-20,20),Math.ceil(1.5*greed));
    if(Math.random()<DATA.C.eliteHeart)spawnPickup('heart',e.x,e.y,20);
    spawnPickup('chest',e.x,e.y,0);
  }else{
    if(Math.random()<e.coin*greed)spawnPickup('coin',e.x,e.y,1);
    if(Math.random()<DATA.C.heartChance)spawnPickup('heart',e.x,e.y,15);
  }
  if(e.type==='splitter'){
    for(let i=0;i<3;i++){
      const a=U.rand(U.TAU);
      spawnEnemy('mini',e.x+Math.cos(a)*16,e.y+Math.sin(a)*16);
    }
  }
  if(e.def&&e.def.bomb&&!e.isBoss)Game.bomberBlast(e);
  if(e.isBoss)Game.onBossDead(e);
}

function damagePlayer(d,o={}){
  if(P.iframe>0||P.dead)return;
  if(Game.state!=='playing')return;
  d=Math.max(1,d-P.armor);
  P.hp-=d;P.iframe=DATA.C.iframes;P.hurtT=1;P.noDmgT=0;
  Game.stats.taken+=d;
  Cam.add(5+Math.min(d,24)*.28);
  UI.redFlash();
  AudioSys.sfx('hurt');
  Fx.text(P.x,P.y-20,'-'+Math.round(d),'#ff3b5c',15);
  Particles.burst(P.x,P.y,'#ff3b5c',8,140,.4,3);
  if(P.hp<=0){
    if(P.revives>0){
      P.revives--;P.hp=Math.round(P.maxhp*.5);P.iframe=2.5;
      UI.banner('SECOND WIND','THE STORM REFUSES YOU','#2bff9e');
      Fx.ring(P.x,P.y,10,220,'#2bff9e',.6,4);
      Particles.burst(P.x,P.y,'#2bff9e',30,220,.6,3);
      AudioSys.sfx('evolve');
    }else{
      P.hp=0;P.dead=true;
      Game.playerDeath();
    }
  }
}

function updatePlayer(dt){
  P.iframe=Math.max(0,P.iframe-dt);
  P.dashCd=Math.max(0,P.dashCd-dt);
  P.hurtT=Math.max(0,P.hurtT-dt*2);
  P.noDmgT+=dt;
  Input.dashBuf=Math.max(0,Input.dashBuf-dt);
  if(P.dead)return;
  const ax=Input.axis();
  if(ax.l>.2)P.face=U.angle(0,0,ax.x,ax.y);
  if(Input.dashBuf>0&&P.dashCd<=0&&ax.l>.2){
    P.dashT=DATA.C.dashDur;P.dashCd=DATA.C.dashCd*P.dashCdM;
    P.iframe=Math.max(P.iframe,P.dashT+.14);
    P.dashX=ax.x;P.dashY=ax.y;
    Input.dashBuf=0;
    AudioSys.sfx('dash');
    Fx.ring(P.x,P.y,6,46,'#7df9ff',.3,2);
    Cam.add(2.5);
  }
  if(P.dashT>0){
    P.dashT-=dt;
    P.vx=P.dashX*P.spd*DATA.C.dashMult;
    P.vy=P.dashY*P.spd*DATA.C.dashMult;
    Ghosts.push({x:P.x,y:P.y,r:P.r,life:.3,t:0,color:'#7df9ff'});
  }else{
    const k=1-Math.pow(.0002,dt);
    P.vx=U.lerp(P.vx,ax.x*P.spd,k);
    P.vy=U.lerp(P.vy,ax.y*P.spd,k);
  }
  P.x+=P.vx*dt;P.y+=P.vy*dt;
  if(P.regen>0&&P.hp<P.maxhp)P.hp=Math.min(P.maxhp,P.hp+P.regen*dt);
}

function updateEnemies(dt){
  Grid.clear();
  const px=P.x,py=P.y;
  for(const e of E){
    if(e.dead)continue;
    e.flash=Math.max(0,e.flash-dt*7);
    e.ohCd=Math.max(0,e.ohCd-dt);
    if(e.burnT>0){
      e.burnT-=dt;e.burnAcc+=e.burnDps*dt;
      if(Math.random()<dt*18)Particles.spawn({x:e.x+U.rand(-e.r,e.r),y:e.y+U.rand(-e.r,e.r),vx:U.rand(-20,20),vy:U.rand(-60,-20),life:.4,size:2,color:'#ff9e3d'});
      if(e.burnAcc>4){hitEnemy(e,e.burnAcc,{silent:true,flat:true});e.burnAcc=0;}
    }
    if(e.slowT>0){e.slowT-=dt;if(e.slowT<=0)e.slow=0;}
    if(e.stun>0){
      e.stun-=dt;
      e.vx*=Math.pow(.02,dt);e.vy*=Math.pow(.02,dt);
      e.x+=e.vx*dt;e.y+=e.vy*dt;
      Grid.insert(e);continue;
    }
    const dx=px-e.x,dy=py-e.y,d=Math.hypot(dx,dy)||1;
    const sp=e.spd*(1-e.slow);
    if(e.isBoss){
      bossAI(e,dt,dx,dy,d);
    }else if(e.def.ranged){
      let tx,ty;
      if(d>270){tx=dx/d*sp;ty=dy/d*sp;}
      else if(d<190){tx=-dx/d*sp*.8;ty=-dy/d*sp*.8;}
      else{const s=Math.sin(e.t*2.4)*sp*.7;tx=-dy/d*s;ty=dx/d*s;}
      e.vx=U.lerp(e.vx,tx,1-Math.pow(.01,dt));
      e.vy=U.lerp(e.vy,ty,1-Math.pow(.01,dt));
      e.fireT-=dt;
      if(e.fireT<=0&&d<460){
        e.fireT=U.rand(2.2,3.2);
        const a=U.angle(e.x,e.y,px,py)+U.rand(-.06,.06);
        spawnEBullet(e.x,e.y,Math.cos(a)*250,Math.sin(a)*250,e.dmg,e.color);
        AudioSys.sfx('laser');
      }
    }else if(e.def.orbit){
      e.t+=dt*1.5;
      const ox=px+Math.cos(e.t)*165,oy=py+Math.sin(e.t)*165;
      const ddx=ox-e.x,ddy=oy-e.y,dd=Math.hypot(ddx,ddy)||1;
      e.vx=U.lerp(e.vx,ddx/dd*sp,1-Math.pow(.005,dt));
      e.vy=U.lerp(e.vy,ddy/dd*sp,1-Math.pow(.005,dt));
    }else{
      const k=1-Math.pow(e.def.bomb?.002:.01,dt);
      e.vx=U.lerp(e.vx,dx/d*sp,k);
      e.vy=U.lerp(e.vy,dy/d*sp,k);
      if(e.def.bomb&&d<e.r+P.r+6){e.dead=true;Game.bomberBlast(e);Grid.insert(e);continue;}
    }
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    if(d<e.r+P.r+3&&!e.def.bomb)damagePlayer(e.dmg);
    if(e.type==='splitter')e.t+=dt;
    Grid.insert(e);
  }
  for(const e of E){
    if(e.dead||e.isBoss)continue;
    const near=Grid.query(e.x,e.y,e.r+16,tmpArr);
    for(const o of near){
      if(o===e||o.dead||o.isBoss)continue;
      const dx=e.x-o.x,dy=e.y-o.y;
      const md=(e.r+o.r)*.8,d2=dx*dx+dy*dy;
      if(d2>0.01&&d2<md*md){
        const d=Math.sqrt(d2),f=(md-d)/md*60*dt;
        e.vx+=dx/d*f*60*dt*8;e.vy+=dy/d*f*60*dt*8;
      }
    }
  }
  for(let i=E.length-1;i>=0;i--){
    const e=E[i];
    if(e.dead){E[i]=E[E.length-1];E.pop();}
  }
}

function bossAI(e,dt,dx,dy,d){
  if(e.tel>0){
    e.tel-=dt;
    e.vx*=Math.pow(.01,dt);e.vy*=Math.pow(.01,dt);
    if(e.patName==='charge'&&e.tel<=0){
      const a=U.angle(e.x,e.y,P.x,P.y);
      e.vx=Math.cos(a)*560;e.vy=Math.sin(a)*560;
      e.chT=.55;
    }
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    return;
  }
  if(e.chT>0){
    e.chT-=dt;
    if(e.chT<=0){e.vx*=.1;e.vy*=.1;}
    e.x+=e.vx*dt;e.y+=e.vy*dt;
    Particles.burst(e.x,e.y,e.color,1,40,.3,3);
    return;
  }
  e.patT-=dt;
  if(e.patT<=0){
    e.pi=(e.pi+1)%e.patt.length;
    e.patName=e.patt[e.pi];
    e.patT=e.patName==='spiral'?3.2:e.patName==='charge'?2.6:e.patName==='spawn'?3.4:e.patName==='missiles'?2.6:e.patName==='pull'?2.8:2.2;
    e.fireT=.2;
  }
  const sp=e.spd*(1-e.slow);
  if(e.patName==='charge'){
    e.vx=U.lerp(e.vx,dx/d*sp,1-Math.pow(.05,dt));
    e.vy=U.lerp(e.vy,dy/d*sp,1-Math.pow(.05,dt));
    if(e.patT<.9&&e.tel<=0){e.tel=.7;Fx.ring(e.x,e.y,e.r,e.r+50,e.color,.6,3);AudioSys.sfx('warn');}
  }else if(e.patName==='pull'){
    e.vx=U.lerp(e.vx,dx/d*sp*.6,1-Math.pow(.05,dt));
    e.vy=U.lerp(e.vy,dy/d*sp*.6,1-Math.pow(.05,dt));
    if(d<340){
      const a=U.angle(P.x,P.y,e.x,e.y);
      P.vx+=Math.cos(a)*300*dt*3;P.vy+=Math.sin(a)*300*dt*3;
      if(Math.random()<dt*20)Particles.spawn({x:e.x+U.rand(-e.r,e.r),y:e.y+U.rand(-e.r,e.r),vx:U.rand(-80,80),vy:U.rand(-80,80),life:.35,size:2.5,color:e.color});
    }
  }else{
    e.vx=U.lerp(e.vx,dx/d*sp,1-Math.pow(.05,dt));
    e.vy=U.lerp(e.vy,dy/d*sp,1-Math.pow(.05,dt));
  }
  e.fireT-=dt;
  if(e.fireT<=0){
    if(e.patName==='spiral'){
      e.fireT=.09;
      e.t+=.42;
      for(let k=0;k<3;k++){
        const a=e.t+k*U.TAU/3;
        spawnEBullet(e.x,e.y,Math.cos(a)*200,Math.sin(a)*200,e.dmg*.55,e.color);
      }
    }else if(e.patName==='ring'){
      e.fireT=.8;
      const n=14,off=U.rand(U.TAU);
      for(let k=0;k<n;k++){
        const a=off+k*U.TAU/n;
        spawnEBullet(e.x,e.y,Math.cos(a)*180,Math.sin(a)*180,e.dmg*.5,e.color);
      }
      AudioSys.sfx('thunder');
    }else if(e.patName==='missiles'){
      e.fireT=1.1;
      const a0=U.angle(e.x,e.y,P.x,P.y);
      for(let k=-2;k<=2;k++){
        const a=a0+k*.16;
        spawnEBullet(e.x,e.y,Math.cos(a)*300,Math.sin(a)*300,e.dmg*.6,'#ff9e3d');
      }
      AudioSys.sfx('missile');
    }else if(e.patName==='spawn'){
      e.fireT=1.4;
      const type=Math.random()<.5?'mini':'swift';
      for(let k=0;k<4;k++){
        const a=U.rand(U.TAU);
        spawnEnemy(type,e.x+Math.cos(a)*50,e.y+Math.sin(a)*50);
      }
      Particles.burst(e.x,e.y,e.color,10,120,.4,3);
    }
  }
  if(d<e.r+P.r+4)damagePlayer(e.dmg);
}

function updateBullets(dt){
  for(const b of B){
    if(b.dead)continue;
    b.t+=dt;
    if(b.t>=b.life){b.dead=true;continue;}
    if(b.kind==='missile'&&b.homing){
      if(b.homing.dead)b.homing=nearestEnemy(600)||b.homing;
      if(b.homing&&!b.homing.dead){
        const ta=U.angle(b.x,b.y,b.homing.x,b.homing.y);
        const ca=Math.atan2(b.vy,b.vx);
        let da=ta-ca;
        while(da>Math.PI)da-=U.TAU;while(da<-Math.PI)da+=U.TAU;
        const na=ca+U.clamp(da,-4.2*dt,4.2*dt);
        const sp=Math.min(b.maxSpd,Math.hypot(b.vx,b.vy)+420*dt);
        b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;
      }
      if(Math.random()<dt*30)Particles.spawn({x:b.x,y:b.y,vx:U.rand(-14,14),vy:U.rand(-14,14),life:.25,size:2,color:b.color,drag:.9});
    }
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    const near=Grid.query(b.x,b.y,b.r,tmpArr);
    for(const e of near){
      if(e.dead||b.hit.includes(e))continue;
      const rr=e.r+b.r;
      if(U.dist2(b.x,b.y,e.x,e.y)<rr*rr){
        b.hit.push(e);
        const a=Math.atan2(b.vy,b.vx);
        hitEnemy(e,b.dmg,{a,kb:b.kb||90,armorPierce:b.ap});
        if(b.kind==='missile'){
          explodeAt(b.x,b.y,b.aoe*P.areaM,b.dmg*.6,b.color);
          if(b.cluster){
            for(let i=0;i<b.cluster;i++){
              const aa=U.rand(U.TAU);
              spawnBullet({x:b.x,y:b.y,vx:Math.cos(aa)*220,vy:Math.sin(aa)*220,r:3,dmg:b.dmg*.35,life:.35,color:b.color,kind:'frag'});
            }
          }
          b.dead=true;
        }else if(b.kind==='prism'&&b.split>0){
          for(let i=0;i<2;i++){
            const aa=a+(i?1:-1)*.9;
            spawnBullet({x:b.x,y:b.y,vx:Math.cos(aa)*760,vy:Math.sin(aa)*760,r:4,dmg:b.dmg*.6,life:.5,color:b.color,kind:'plasma',pierce:2,split:0});
          }
          b.split=0;
        }
        if(b.pierce>0)b.pierce--;
        else{b.dead=true;break;}
      }
    }
  }
  for(let i=B.length-1;i>=0;i--){
    if(B[i].dead){B[i]=B[B.length-1];B.pop();}
  }
}

function updateEBullets(dt){
  for(const b of EB){
    if(b.dead)continue;
    b.t+=dt;
    if(b.t>=b.life){b.dead=true;continue;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    if(!P.dead&&U.dist2(b.x,b.y,P.x,P.y)<(P.r+b.r)*(P.r+b.r)){
      b.dead=true;
      damagePlayer(b.dmg);
      Particles.burst(b.x,b.y,b.color,5,100,.3,2);
    }
  }
  for(let i=EB.length-1;i>=0;i--){
    if(EB[i].dead){EB[i]=EB[EB.length-1];EB.pop();}
  }
}

function updatePickups(dt){
  const px=P.x,py=P.y;
  for(const p of PK){
    if(p.dead)continue;
    p.t+=dt;
    const fr=Math.pow(.86,dt*60);
    p.vx*=fr;p.vy*=fr;
    if(p.type==='chest'&&p.t>.5){
      const d=U.dist(p.x,p.y,px,py);
      const a=U.angle(p.x,p.y,px,py);
      p.vx=U.lerp(p.vx,Math.cos(a)*420,1-Math.pow(.01,dt));
      p.vy=U.lerp(p.vy,Math.sin(a)*420,1-Math.pow(.01,dt));
      if(d<26){p.dead=true;Game.openChest();continue;}
    }else{
      const d=U.dist(p.x,p.y,px,py);
      if(d<P.pickup&&!P.dead){
        const a=U.angle(p.x,p.y,px,py);
        const pull=90+Math.max(0,(P.pickup-d))*6;
        p.vx=U.lerp(p.vx,Math.cos(a)*pull,1-Math.pow(.05,dt));
        p.vy=U.lerp(p.vy,Math.sin(a)*pull,1-Math.pow(.05,dt));
      }
      if(d<P.r+10&&!P.dead){
        p.dead=true;
        if(p.type==='xp'){
          Game.addXp(p.v);
          AudioSys.sfx('gem',1+Math.min(Game.combo,80)*.008);
          Particles.burst(p.x,p.y,'#9b5cff',2,60,.3,2);
        }else if(p.type==='coin'){
          P.coinsRun+=p.v;
          AudioSys.sfx('coin',1+Math.min(Game.combo,60)*.01);
          Particles.burst(p.x,p.y,'#ffd23b',3,70,.3,2);
        }else if(p.type==='heart'){
          const h=Math.round(p.v);
          P.hp=Math.min(P.maxhp,P.hp+h);
          Fx.text(P.x,P.y-24,'+'+h+' HP','#2bff9e',14);
          AudioSys.sfx('heart');
          Fx.ring(P.x,P.y,8,60,'#2bff9e',.4,2);
        }
        continue;
      }
    }
    p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  for(let i=PK.length-1;i>=0;i--){
    if(PK[i].dead){PK[i]=PK[PK.length-1];PK.pop();}
  }
}

function updateZones(dt){
  for(const z of Zones){
    z.t+=dt;
    if(z.t>=z.life){z.dead=true;continue;}
    const near=Grid.query(z.x,z.y,z.r,tmpArr);
    for(const e of near){
      if(e.dead)continue;
      if(U.dist2(z.x,z.y,e.x,e.y)<z.r*z.r){
        e.burnDps=Math.max(e.burnDps,z.dps);e.burnT=Math.max(e.burnT,.6);
      }
    }
  }
  for(let i=Zones.length-1;i>=0;i--){
    if(Zones[i].dead){Zones[i]=Zones[Zones.length-1];Zones.pop();}
  }
}
function updateBeams(dt){
  for(const b of Beams){b.t+=dt;if(b.t>=b.life)b.dead=true;}
  for(let i=Beams.length-1;i>=0;i--){
    if(Beams[i].dead){Beams[i]=Beams[Beams.length-1];Beams.pop();}
  }
}
function updateGhosts(dt){
  for(const g of Ghosts){g.t+=dt;if(g.t>=g.life)g.dead=true;}
  for(let i=Ghosts.length-1;i>=0;i--){
    if(Ghosts[i].dead){Ghosts[i]=Ghosts[Ghosts.length-1];Ghosts.pop();}
  }
}
