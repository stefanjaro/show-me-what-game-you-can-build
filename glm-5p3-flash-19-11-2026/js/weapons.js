'use strict';
function weaponStats(w){
  return w.def.stats(w.lvl);
}

const WEAPON_IMPL={
  plasma:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(780);
        const base=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        for(let i=0;i<st.n;i++){
          const a=base+(i-(st.n-1)/2)*.14;
          spawnBullet({x:P.x,y:P.y,vx:Math.cos(a)*st.spd*P.projM,vy:Math.sin(a)*st.spd*P.projM,
            r:4,dmg:st.dmg,pierce:st.pierce,life:1.5,color:w.def.color,kind:'plasma'});
        }
        Particles.spawn({x:P.x+Math.cos(base)*16,y:P.y+Math.sin(base)*16,vx:Math.cos(base)*80,vy:Math.sin(base)*80,life:.15,size:3,color:w.def.color});
        AudioSys.sfx('shoot',U.rand(.94,1.06));
      }
    },
  },
  prism:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(900);
        const base=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        for(let i=0;i<st.n;i++){
          const a=base+(i-(st.n-1)/2)*.22;
          spawnBullet({x:P.x,y:P.y,vx:Math.cos(a)*st.spd*P.projM,vy:Math.sin(a)*st.spd*P.projM,
            r:5,dmg:st.dmg,pierce:st.pierce,life:1.2,color:w.def.color,kind:'prism',split:st.split,ap:2,kb:120});
        }
        AudioSys.sfx('laser');
        Cam.add(1.5);
      }
    },
  },
  orbit:{
    update(w,dt){
      const st=weaponStats(w);
      w.data.ang+=st.rot*dt;
      const n=st.n,rad=st.r*P.areaM;
      for(let i=0;i<n;i++){
        const a=w.data.ang+i*U.TAU/n;
        const sx=P.x+Math.cos(a)*rad,sy=P.y+Math.sin(a)*rad;
        const near=Grid.query(sx,sy,10,tmpArr);
        for(const e of near){
          if(e.dead||e.ohCd>0)continue;
          const rr=e.r+9;
          if(U.dist2(sx,sy,e.x,e.y)<rr*rr){
            e.ohCd=.32;
            hitEnemy(e,st.dmg,{a,kb:150});
          }
        }
      }
    },
    draw(w){
      const st=weaponStats(w),n=st.n,rad=st.r*P.areaM;
      ctx.globalCompositeOperation='lighter';
      for(let i=0;i<n;i++){
        const a=w.data.ang+i*U.TAU/n;
        const sx=P.x+Math.cos(a)*rad,sy=P.y+Math.sin(a)*rad;
        ctx.save();ctx.translate(sx,sy);ctx.rotate(w.data.ang*2);
        const g=S.glow(w.def.color,9);
        ctx.drawImage(g,-16,-16,32,32);
        ctx.fillStyle=hexA(w.def.color,.9);
        ctx.beginPath();
        ctx.moveTo(0,-9);ctx.lineTo(6,0);ctx.lineTo(0,9);ctx.lineTo(-6,0);
        ctx.closePath();ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation='source-over';
    },
  },
  grinder:{
    update(w,dt){
      const st=weaponStats(w);
      w.data.ang+=st.rot*dt;
      const n=st.n,rad=st.r*P.areaM;
      for(let i=0;i<n;i++){
        const a=w.data.ang+i*U.TAU/n;
        const sx=P.x+Math.cos(a)*rad,sy=P.y+Math.sin(a)*rad;
        const near=Grid.query(sx,sy,14,tmpArr);
        for(const e of near){
          if(e.dead||e.ohCd>0)continue;
          const rr=e.r+12;
          if(U.dist2(sx,sy,e.x,e.y)<rr*rr){
            e.ohCd=.26;
            hitEnemy(e,st.dmg,{a,kb:220,armorPierce:1});
          }
        }
      }
    },
    draw(w){
      const st=weaponStats(w),n=st.n,rad=st.r*P.areaM;
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=hexA(w.def.color,.25);
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(P.x,P.y,rad,0,U.TAU);ctx.stroke();
      for(let i=0;i<n;i++){
        const a=w.data.ang+i*U.TAU/n;
        const sx=P.x+Math.cos(a)*rad,sy=P.y+Math.sin(a)*rad;
        ctx.save();ctx.translate(sx,sy);ctx.rotate(w.data.ang*3);
        const g=S.glow(w.def.color,14);
        ctx.drawImage(g,-26,-26,52,52);
        ctx.fillStyle=hexA(w.def.color,.95);
        ctx.beginPath();
        ctx.moveTo(0,-13);ctx.lineTo(9,0);ctx.lineTo(0,13);ctx.lineTo(-9,0);
        ctx.closePath();ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation='source-over';
    },
  },
  nova:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const r=st.r*P.areaM;
        Fx.ring(P.x,P.y,r*.3,r,w.def.color,.35,4);
        Fx.ring(P.x,P.y,r*.15,r*.7,w.def.color,.28,2);
        const near=Grid.query(P.x,P.y,r,tmpArr);
        for(const e of near){
          if(e.dead)continue;
          if(U.dist2(P.x,P.y,e.x,e.y)<r*r)
            hitEnemy(e,st.dmg,{a:U.angle(P.x,P.y,e.x,e.y),kb:st.kb});
        }
        Particles.burst(P.x,P.y,w.def.color,10,r*1.6,.4,2.5);
        AudioSys.sfx('nova');
        Cam.add(3);
      }
    },
  },
  supernova:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const r=st.r*P.areaM;
        Fx.ring(P.x,P.y,r*.3,r,w.def.color,.4,5);
        Fx.ring(P.x,P.y,r*.1,r*.55,'#ffd23b',.3,3);
        Zones.push({x:P.x,y:P.y,r:r*.8,life:2.4,t:0,dps:st.burn,color:w.def.color,dead:false});
        const near=Grid.query(P.x,P.y,r,tmpArr);
        for(const e of near){
          if(e.dead)continue;
          if(U.dist2(P.x,P.y,e.x,e.y)<r*r){
            hitEnemy(e,st.dmg,{a:U.angle(P.x,P.y,e.x,e.y),kb:st.kb,armorPierce:1});
            e.burnDps=Math.max(e.burnDps,6);e.burnT=Math.max(e.burnT,2);
          }
        }
        Particles.burst(P.x,P.y,w.def.color,18,r*1.8,.5,3);
        Particles.burst(P.x,P.y,'#ffd23b',10,r*1.2,.4,2.5);
        AudioSys.sfx('nova');
        Cam.add(5);
      }
    },
  },
  rail:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(940);
        const a=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        const len=960,x2=P.x+Math.cos(a)*len,y2=P.y+Math.sin(a)*len;
        Beams.push({x1:P.x,y1:P.y,x2,y2,w:st.w*P.areaM,life:.22,t:0,color:w.def.color,dead:false});
        for(const e of E){
          if(e.dead)continue;
          const t=U.clamp(((e.x-P.x)*(x2-P.x)+(e.y-P.y)*(y2-P.y))/(len*len),0,1);
          const lx=P.x+(x2-P.x)*t,ly=P.y+(y2-P.y)*t;
          if(U.dist2(e.x,e.y,lx,ly)<(e.r+st.w*P.areaM)*(e.r+st.w*P.areaM))
            hitEnemy(e,st.dmg,{a,kb:60,armorPierce:2});
        }
        Particles.burst(P.x+Math.cos(a)*20,P.y+Math.sin(a)*20,w.def.color,8,160,.3,2.5);
        AudioSys.sfx('rail');
        Cam.add(4);
      }
    },
  },
  singularity:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(940);
        const a=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        const len=1000,x2=P.x+Math.cos(a)*len,y2=P.y+Math.sin(a)*len;
        Beams.push({x1:P.x,y1:P.y,x2,y2,w:st.w*P.areaM,life:.26,t:0,color:w.def.color,dead:false});
        for(const e of E){
          if(e.dead)continue;
          const t=U.clamp(((e.x-P.x)*(x2-P.x)+(e.y-P.y)*(y2-P.y))/(len*len),0,1);
          const lx=P.x+(x2-P.x)*t,ly=P.y+(y2-P.y)*t;
          const dl=U.dist(e.x,e.y,lx,ly);
          if(dl<(e.r+st.w*P.areaM))
            hitEnemy(e,st.dmg,{a,kb:60,armorPierce:9});
          else if(dl<st.pull*P.areaM&&e.r<30){
            const pa=U.angle(e.x,e.y,lx,ly);
            const f=Math.min(1,(st.pull*P.areaM-dl)/st.pull*P.areaM)*300;
            e.vx+=Math.cos(pa)*f;e.vy+=Math.sin(pa)*f;
          }
        }
        Particles.burst(P.x+Math.cos(a)*20,P.y+Math.sin(a)*20,w.def.color,10,180,.32,3);
        Particles.burst((P.x+x2)/2,(P.y+y2)/2,'#c04bff',8,120,.4,2.5);
        AudioSys.sfx('rail');
        AudioSys.sfx('explode');
        Cam.add(6);
      }
    },
  },
  missile:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        for(let i=0;i<st.n;i++){
          const a=U.rand(U.TAU);
          const tgt=nearestEnemy(680,[].concat(B.filter(b=>b.kind==='missile'&&!b.dead).map(b=>b.homing)));
          spawnBullet({x:P.x,y:P.y,vx:Math.cos(a)*120,vy:Math.sin(a)*120,
            r:4.5,dmg:st.dmg,life:2.6,color:w.def.color,kind:'missile',
            homing:tgt||nearestEnemy(680),maxSpd:st.spd*P.projM,aoe:st.aoe,cluster:0,kb:60});
        }
        AudioSys.sfx('missile');
      }
    },
  },
  hive:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        for(let i=0;i<st.n;i++){
          const a=U.rand(U.TAU);
          spawnBullet({x:P.x,y:P.y,vx:Math.cos(a)*140,vy:Math.sin(a)*140,
            r:5,dmg:st.dmg,life:2.8,color:w.def.color,kind:'missile',
            homing:nearestEnemy(700),maxSpd:st.spd*P.projM,aoe:st.aoe,cluster:st.cluster,kb:80});
        }
        AudioSys.sfx('missile');
        AudioSys.sfx('missile',1.3);
      }
    },
  },
  chain:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const first=Math.random()<.5?nearestEnemy(360):U.choice(Grid.query(P.x,P.y,340,tmpArr).filter(e=>!e.dead))||nearestEnemy(360);
        if(!first)return;
        let cur=first;const hitL=[cur];
        let fx=P.x,fy=P.y;
        for(let i=0;i<st.chains&&cur;i++){
          Beams.push({x1:fx,y1:fy,x2:cur.x,y2:cur.y,w:2.5,life:.16,t:0,color:w.def.color,dead:false,jag:true});
          hitEnemy(cur,st.dmg,{kb:20});
          if(st.stun){cur.stun=Math.max(cur.stun,st.stun);Particles.burst(cur.x,cur.y,'#ffe066',3,80,.25,2);}
          fx=cur.x;fy=cur.y;
          cur=nearestEnemy(st.jump,hitL);
          if(cur)hitL.push(cur);
        }
        AudioSys.sfx('chain',U.rand(.9,1.15));
      }
    },
  },
  stormcore:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const first=Math.random()<.5?nearestEnemy(400):U.choice(Grid.query(P.x,P.y,380,tmpArr).filter(e=>!e.dead))||nearestEnemy(400);
        if(!first)return;
        let cur=first;const hitL=[cur];
        let fx=P.x,fy=P.y;
        for(let i=0;i<st.chains&&cur;i++){
          Beams.push({x1:fx,y1:fy,x2:cur.x,y2:cur.y,w:3.5,life:.18,t:0,color:'#ffe066',dead:false,jag:true});
          hitEnemy(cur,st.dmg,{kb:30,armorPierce:1});
          cur.stun=Math.max(cur.stun,st.stun);
          Particles.burst(cur.x,cur.y,'#ffe066',4,90,.28,2);
          fx=cur.x;fy=cur.y;
          cur=nearestEnemy(st.jump,hitL);
          if(cur)hitL.push(cur);
        }
        AudioSys.sfx('thunder');
      }
    },
  },
  frost:{
    update(w,dt){
      const st=weaponStats(w);
      const r=st.r*P.areaM;
      const near=Grid.query(P.x,P.y,r,tmpArr);
      for(const e of near){
        if(e.dead)continue;
        if(U.dist2(P.x,P.y,e.x,e.y)<r*r){
          e.slow=Math.max(e.slow,Math.min(.85,st.slow));
          e.slowT=Math.max(e.slowT,.3);
          e.frostAcc=(e.frostAcc||0)+st.dps*dt;
          if(e.frostAcc>5){hitEnemy(e,e.frostAcc,{silent:true,flat:true,armorPierce:1});e.frostAcc=0;}
        }
      }
      if(Math.random()<dt*4)Particles.spawn({x:P.x+U.rand(-r,r),y:P.y+U.rand(-r,r),vx:0,vy:U.rand(-16,-4),life:.8,size:1.6,color:'#7df9ff',drag:.99});
    },
    draw(w){
      const st=weaponStats(w),r=st.r*P.areaM;
      ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(P.x,P.y,r*.3,P.x,P.y,r);
      g.addColorStop(0,'rgba(125,249,255,0)');
      g.addColorStop(.8,'rgba(125,249,255,.05)');
      g.addColorStop(1,'rgba(125,249,255,.12)');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(P.x,P.y,r,0,U.TAU);ctx.fill();
      ctx.strokeStyle='rgba(125,249,255,.25)';
      ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(P.x,P.y,r,0,U.TAU);ctx.stroke();
      ctx.globalCompositeOperation='source-over';
    },
  },
  absolutezero:{
    update(w,dt){
      const st=weaponStats(w);
      const r=st.r*P.areaM;
      const near=Grid.query(P.x,P.y,r,tmpArr);
      for(const e of near){
        if(e.dead)continue;
        if(U.dist2(P.x,P.y,e.x,e.y)<r*r){
          e.slow=Math.max(e.slow,st.slow);
          e.slowT=Math.max(e.slowT,.35);
          e.frostAcc=(e.frostAcc||0)+st.dps*dt;
          if(e.frostAcc>6){hitEnemy(e,e.frostAcc,{silent:true,flat:true,armorPierce:2});e.frostAcc=0;}
        }
      }
      w.data.ft=(w.data.ft||0)+dt;
      if(w.data.ft>=st.freezeT){
        w.data.ft=0;
        const fr=st.freezeR*P.areaM;
        Fx.ring(P.x,P.y,fr*.4,fr,'#bfefff',.5,3);
        AudioSys.sfx('freeze');
        for(const e of near){
          if(e.dead)continue;
          if(U.dist2(P.x,P.y,e.x,e.y)<fr*fr){
            e.stun=Math.max(e.stun,1);
            hitEnemy(e,st.dps*2,{silent:true,flat:true,armorPierce:2});
            Particles.burst(e.x,e.y,'#bfefff',4,60,.4,2);
          }
        }
      }
      if(Math.random()<dt*5)Particles.spawn({x:P.x+U.rand(-r,r),y:P.y+U.rand(-r,r),vx:0,vy:U.rand(-16,-4),life:.8,size:1.8,color:'#bfefff',drag:.99});
    },
    draw(w){
      const st=weaponStats(w),r=st.r*P.areaM;
      ctx.globalCompositeOperation='lighter';
      const g=ctx.createRadialGradient(P.x,P.y,r*.25,P.x,P.y,r);
      g.addColorStop(0,'rgba(191,239,255,0)');
      g.addColorStop(.75,'rgba(191,239,255,.06)');
      g.addColorStop(1,'rgba(125,249,255,.16)');
      ctx.fillStyle=g;
      ctx.beginPath();ctx.arc(P.x,P.y,r,0,U.TAU);ctx.fill();
      ctx.strokeStyle='rgba(191,239,255,.3)';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(P.x,P.y,r,0,U.TAU);ctx.stroke();
      ctx.globalCompositeOperation='source-over';
    },
  },
  cinder:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(st.range+100);
        const base=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        const range=st.range*P.areaM,cone=st.cone*P.areaM;
        const near=Grid.query(P.x,P.y,range,tmpArr);
        for(const e of near){
          if(e.dead)continue;
          const d=U.dist(P.x,P.y,e.x,e.y);
          if(d>range+e.r)continue;
          let da=U.angle(P.x,P.y,e.x,e.y)-base;
          while(da>Math.PI)da-=U.TAU;while(da<-Math.PI)da+=U.TAU;
          if(Math.abs(da)<cone/2){
            hitEnemy(e,st.dmg,{a:base,kb:30});
            e.burnDps=Math.max(e.burnDps,st.burn);e.burnT=Math.max(e.burnT,2);
          }
        }
        for(let i=0;i<10;i++){
          const a=base+U.rand(-cone/2,cone/2);
          const sp=U.rand(.4,1)*range;
          Particles.spawn({x:P.x,y:P.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.32,size:U.rand(2.5,4.5),color:U.choice(['#ff9e3d','#ff6b3d','#ffd23b']),drag:.9});
        }
        AudioSys.sfx('cinder');
      }
    },
  },
  dragonfire:{
    update(w,dt){
      const st=weaponStats(w);
      w.timer-=dt*P.asM*(1+pl('capacitor')*.08);
      if(w.timer<=0){
        w.timer=st.cd;
        const tgt=nearestEnemy(st.range+100);
        const base=tgt?U.angle(P.x,P.y,tgt.x,tgt.y):P.face;
        const range=st.range*P.areaM,cone=st.cone;
        const near=Grid.query(P.x,P.y,range,tmpArr);
        const burned=[];
        for(const e of near){
          if(e.dead)continue;
          const d=U.dist(P.x,P.y,e.x,e.y);
          if(d>range+e.r)continue;
          let da=U.angle(P.x,P.y,e.x,e.y)-base;
          while(da>Math.PI)da-=U.TAU;while(da<-Math.PI)da+=U.TAU;
          if(Math.abs(da)<cone/2){
            hitEnemy(e,st.dmg,{a:base,kb:40,armorPierce:1});
            e.burnDps=Math.max(e.burnDps,st.burn);e.burnT=Math.max(e.burnT,2.5);
            burned.push(e);
          }
        }
        if(st.spread&&burned.length){
          for(const e of burned){
            const near2=Grid.query(e.x,e.y,90,tmpArr);
            for(const o of near2){
              if(o.dead||burned.includes(o))continue;
              if(U.dist2(e.x,e.y,o.x,o.y)<90*90){
                o.burnDps=Math.max(o.burnDps,st.burn*.8);o.burnT=Math.max(o.burnT,2);
              }
            }
          }
        }
        for(let i=0;i<14;i++){
          const a=base+U.rand(-cone/2,cone/2);
          const sp=U.rand(.4,1)*range;
          Particles.spawn({x:P.x,y:P.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.34,size:U.rand(3,5.5),color:U.choice(['#ff6b3d','#ff9e3d','#ffd23b','#ff3b5c']),drag:.9});
        }
        AudioSys.sfx('cinder');
        AudioSys.sfx('cinder',.8);
      }
    },
  },
};

function updateWeapons(dt){
  for(const w of P.weapons){
    const impl=WEAPON_IMPL[w.id];
    if(impl)impl.update(w,dt);
  }
}
