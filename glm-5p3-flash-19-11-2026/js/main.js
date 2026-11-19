'use strict';
let last=0,acc=0,attractT=0;

function boot(){
  Input.init();
  UI.init();
  resize();
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&Game.state==='playing')UI.togglePause();
  });
  requestAnimationFrame(ts);
}

function ts(t){
  requestAnimationFrame(ts);
  const now=t/1000;
  let dt=Math.min(.1,now-last||.016);
  last=now;
  acc+=dt;
  const step=1/60;
  let n=0;
  while(acc>=step&&n<4){
    tick(step);
    acc-=step;
    n++;
  }
  render();
  UI.updateHUD();
}

function tick(dt){
  if(Game.state==='playing'||Game.state==='dying'){
    Game.update(dt);
  }else if(Game.state==='title'||Game.state==='chars'||Game.state==='shop'||Game.state==='help'||Game.state==='over'||Game.state==='victory'){
    ambient(dt);
  }
}

function ambient(dt){
  attractT+=dt;
  Cam.x+=Math.cos(attractT*.1)*dt*30;
  Cam.y+=Math.sin(attractT*.13)*dt*30;
  Cam.update(dt,Cam.x,Cam.y);
  Particles.update(dt);
  Fx.update(dt);
  if(Math.random()<dt*6){
    Particles.spawn({
      x:U.rand(0,VW),y:U.rand(0,VH),
      vx:U.rand(-30,30),vy:U.rand(-50,-10),
      life:U.rand(1,2.4),size:U.rand(1.5,3),
      color:U.choice(['#19e3ff','#9b5cff','#ff2bd6','#3bffd9']),drag:.99,shrink:0,
    });
  }
}

function drawStarsBg(){
  const grd=ctx.createLinearGradient(0,0,0,VH);
  grd.addColorStop(0,'#060818');
  grd.addColorStop(.55,'#080a1e');
  grd.addColorStop(1,'#04050e');
  ctx.fillStyle=grd;
  ctx.fillRect(0,0,VW,VH);
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=.5;
  const nx=Cam.x*.3%1400,ny=Cam.y*.3%1400;
  const neb=(x,y,r,c,a)=>{
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,hexA(c,a));
    g.addColorStop(1,hexA(c,0));
    ctx.fillStyle=g;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  };
  neb(300-nx*.2,200-ny*.2,420,'#9b5cff',.05);
  neb(VW-400+nx*.15,VH-260+ny*.15,380,'#19e3ff',.04);
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  S.drawStars(Cam.x,Cam.y);
}

function drawGrid(){
  const s=96;
  const x0=Math.floor((Cam.x-VW/2)/s)*s,x1=Cam.x+VW/2;
  const y0=Math.floor((Cam.y-VH/2)/s)*s,y1=Cam.y+VH/2;
  ctx.strokeStyle='rgba(120,150,255,.055)';
  ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=x0;x<=x1;x+=s){ctx.moveTo(x,Cam.y-VH/2);ctx.lineTo(x,y1);}
  for(let y=y0;y<=y1;y+=s){ctx.moveTo(Cam.x-VW/2,y);ctx.lineTo(x1,y);}
  ctx.stroke();
}

function drawEnemy(e){
  const x=e.x,y=e.y,r=e.r;
  if(x<Cam.x-VW/2-60||x>Cam.x+VW/2+60||y<Cam.y-VH/2-60||y>Cam.y+VH/2+60)return;
  ctx.globalCompositeOperation='lighter';
  const g=S.glow(e.color,r*1.7);
  const gs=r*3.4;
  ctx.globalAlpha=e.isBoss?.85:e.elite?.75:.45;
  ctx.drawImage(g,x-gs/2,y-gs/2,gs,gs);
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  ctx.save();
  ctx.translate(x,y);
  const rot=e.shape==='tri'?e.t*.5:e.shape==='diamond'?e.t*.8:0;
  if(rot)ctx.rotate(rot);
  ctx.fillStyle=e.flash>0?'#ffffff':hexA(e.color,.22);
  ctx.strokeStyle=e.flash>0?'#ffffff':e.color;
  ctx.lineWidth=e.isBoss?3:2;
  ctx.beginPath();
  if(e.shape==='circle'){
    ctx.arc(0,0,r,0,U.TAU);
  }else if(e.shape==='tri'){
    ctx.moveTo(0,-r);ctx.lineTo(r*.87,r*.5);ctx.lineTo(-r*.87,r*.5);
    ctx.closePath();
  }else if(e.shape==='hex'){
    for(let i=0;i<6;i++){
      const a=i*U.TAU/6+Math.PI/6;
      const px=Math.cos(a)*r,py=Math.sin(a)*r;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();
  }else if(e.shape==='diamond'){
    ctx.moveTo(0,-r);ctx.lineTo(r*.7,0);ctx.lineTo(0,r);ctx.lineTo(-r*.7,0);
    ctx.closePath();
  }else{
    ctx.rect(-r*.85,-r*.85,r*1.7,r*1.7);
  }
  ctx.fill();ctx.stroke();
  if(e.elite||e.isBoss){
    ctx.strokeStyle='#ffd23b';
    ctx.lineWidth=2;
    ctx.globalAlpha=.7;
    ctx.beginPath();ctx.arc(0,0,r+6,e.t*2,e.t*2+4.4);ctx.stroke();
    ctx.globalAlpha=1;
  }
  if(e.slow>0&&e.burnT<=0){
    ctx.strokeStyle='rgba(125,249,255,.5)';
    ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(0,0,r+3,0,U.TAU);ctx.stroke();
  }
  ctx.restore();
  if(e.isBoss&&e.tel>0){
    ctx.strokeStyle=hexA(e.color,.6);
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(x,y,r+10+Math.sin(e.tel*20)*4,0,U.TAU);
    ctx.stroke();
  }
}

function drawPlayer(){
  if(P.dead)return;
  const blink=P.iframe>0&&P.dashT<=0&&Math.floor(P.iframe*14)%2===0;
  ctx.globalCompositeOperation='lighter';
  for(const g of Ghosts){
    const a=1-g.t/g.life;
    ctx.globalAlpha=a*.4;
    ctx.fillStyle=hexA(g.color,a*.5);
    ctx.beginPath();ctx.arc(g.x,g.y,g.r*a+2,0,U.TAU);ctx.fill();
  }
  ctx.globalAlpha=blink?.35:1;
  const glow=S.glow('#19e3ff',26);
  ctx.drawImage(glow,P.x-58,P.y-58,116,116);
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=blink?'rgba(25,227,255,.5)':'#19e3ff';
  ctx.beginPath();ctx.arc(P.x,P.y,P.r,0,U.TAU);ctx.fill();
  ctx.fillStyle='#eaffff';
  ctx.beginPath();ctx.arc(P.x,P.y,P.r*.5,0,U.TAU);ctx.fill();
  ctx.strokeStyle='rgba(25,227,255,.8)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(P.x,P.y,P.r+4,P.face+.6,P.face-.6);ctx.stroke();
  ctx.globalAlpha=1;
}

function render(){
  drawStarsBg();
  const inWorld=Game.state==='playing'||Game.state==='dying'||Game.state==='levelup'||Game.state==='paused';
  if(!inWorld){
    Particles.draw();
    Fx.draw();
    return;
  }
  ctx.save();
  ctx.translate(Math.round(VW/2-Cam.x+Cam.ox),Math.round(VH/2-Cam.y+Cam.oy));
  drawGrid();
  for(const z of Zones){
    if(z.dead)continue;
    const a=(1-z.t/z.life);
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(z.x,z.y,z.r*.3,z.x,z.y,z.r);
    g.addColorStop(0,hexA(z.color,0));
    g.addColorStop(1,hexA(z.color,.14*a));
    ctx.fillStyle=g;
    ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,U.TAU);ctx.fill();
    ctx.strokeStyle=hexA(z.color,.4*a);
    ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,U.TAU);ctx.stroke();
    ctx.globalCompositeOperation='source-over';
  }
  for(const p of PK){
    const bob=Math.sin(p.t*5)*2;
    if(p.type==='xp'){
      const g=S.glow('#9b5cff',6);
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(g,p.x-12,p.y-12+bob,24,24);
      ctx.fillStyle=p.v>=10?'#ffd23b':p.v>=5?'#19e3ff':'#9b5cff';
      ctx.beginPath();
      ctx.moveTo(p.x,p.y-5+bob);ctx.lineTo(p.x+4,p.y+bob);ctx.lineTo(p.x,p.y+5+bob);ctx.lineTo(p.x-4,p.y+bob);
      ctx.closePath();ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }else if(p.type==='coin'){
      const g=S.glow('#ffd23b',5);
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(g,p.x-10,p.y-10+bob,20,20);
      ctx.fillStyle='#ffd23b';
      ctx.beginPath();ctx.arc(p.x,p.y+bob,3.2,0,U.TAU);ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }else if(p.type==='heart'){
      const g=S.glow('#2bff9e',8);
      ctx.globalCompositeOperation='lighter';
      ctx.drawImage(g,p.x-16,p.y-16+bob,32,32);
      ctx.fillStyle='#2bff9e';
      ctx.fillRect(p.x-4,p.y-4+bob,8,8);
      ctx.globalCompositeOperation='source-over';
    }else{
      const pulse=1+Math.sin(p.t*6)*.15;
      ctx.globalCompositeOperation='lighter';
      const g=S.glow('#ffd23b',14);
      ctx.drawImage(g,p.x-32*pulse,p.y-32*pulse,64*pulse,64*pulse);
      ctx.fillStyle='#ffd23b';
      ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(p.t*1.5);
      ctx.fillRect(-8,-8,16,16);
      ctx.restore();
      ctx.fillStyle='#fff';
      ctx.fillRect(p.x-3,p.y-3+bob,6,6);
      ctx.globalCompositeOperation='source-over';
    }
  }
  for(const e of E)drawEnemy(e);
  drawPlayer();
  ctx.globalCompositeOperation='lighter';
  for(const b of EB){
    const g=S.dot(b.color,b.r);
    ctx.drawImage(g,b.x-b.r*2.4,b.y-b.r*2.4,b.r*4.8,b.r*4.8);
  }
  for(const b of B){
    if(b.kind==='missile'){
      ctx.save();
      ctx.translate(b.x,b.y);
      ctx.rotate(Math.atan2(b.vy,b.vx));
      const g=S.glow(b.color,7);
      ctx.drawImage(g,-18,-18,36,36);
      ctx.fillStyle=b.color;
      ctx.fillRect(-6,-2.5,12,5);
      ctx.fillStyle='#fff';
      ctx.fillRect(2,-1.5,5,3);
      ctx.restore();
    }else{
      const rr=b.kind==='prism'?6:b.r;
      const g=S.dot(b.color,rr);
      ctx.drawImage(g,b.x-rr*2.6,b.y-rr*2.6,rr*5.2,rr*5.2);
      ctx.fillStyle='#fff';
      ctx.fillRect(b.x-1.5,b.y-1.5,3,3);
    }
  }
  for(const bm of Beams){
    const a=1-bm.t/bm.life;
    ctx.strokeStyle=hexA(bm.color,a*.9);
    ctx.lineWidth=bm.w*a;
    ctx.lineCap='round';
    ctx.beginPath();
    if(bm.jag){
      const seg=6;
      const dx=(bm.x2-bm.x1)/seg,dy=(bm.y2-bm.y1)/seg;
      ctx.moveTo(bm.x1,bm.y1);
      for(let i=1;i<seg;i++){
        ctx.lineTo(bm.x1+dx*i+U.rand(-9,9),bm.y1+dy*i+U.rand(-9,9));
      }
      ctx.lineTo(bm.x2,bm.y2);
    }else{
      ctx.moveTo(bm.x1,bm.y1);ctx.lineTo(bm.x2,bm.y2);
    }
    ctx.stroke();
    ctx.strokeStyle=hexA('#ffffff',a*.7);
    ctx.lineWidth=Math.max(1,bm.w*a*.35);
    ctx.stroke();
  }
  for(const w of P.weapons){
    const impl=WEAPON_IMPL[w.id];
    if(impl&&impl.draw)impl.draw(w);
  }
  Particles.draw();
  Fx.draw();
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
  if(Game.state==='dying'){
    ctx.fillStyle='rgba(4,5,14,'+Math.min(.6,Game.dyingT*.4)+')';
    ctx.fillRect(0,0,VW,VH);
  }
}

boot();
