'use strict';
const U={
  TAU:Math.PI*2,
  clamp:(v,a,b)=>v<a?a:v>b?b:v,
  lerp:(a,b,t)=>a+(b-a)*t,
  rand:(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a),
  randi:(a,b)=>Math.floor(a+Math.random()*(b-a+1)),
  choice:a=>a[(Math.random()*a.length)|0],
  dist:(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1),
  dist2:(x1,y1,x2,y2)=>{const a=x2-x1,b=y2-y1;return a*a+b*b;},
  angle:(x1,y1,x2,y2)=>Math.atan2(y2-y1,x2-x1),
  easeOut:t=>1-Math.pow(1-t,3),
  easeIn:t=>t*t,
  fmtTime:s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');},
  fmtNum:n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':String(Math.floor(n)),
};
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}

const cv=document.getElementById('game');
const ctx=cv.getContext('2d');
let VW=0,VH=0,DPR=1;
function resize(){
  VW=window.innerWidth;VH=window.innerHeight;DPR=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);
  cv.style.width=VW+'px';cv.style.height=VH+'px';
  S.buildStars();
}

const Cam={
  x:0,y:0,shake:0,ox:0,oy:0,
  add(v){ if(Save.d&&Save.d.set.shake)this.shake=Math.min(this.shake+v,26); },
  update(dt,tx,ty){
    const k=1-Math.pow(0.0004,dt);
    this.x+=(tx-this.x)*k;this.y+=(ty-this.y)*k;
    this.shake*=Math.pow(0.0008,dt);
    if(this.shake<0.04)this.shake=0;
    const s=this.shake;
    this.ox=U.rand(-s,s);this.oy=U.rand(-s,s);
  },
  snap(x,y){this.x=x;this.y=y;this.ox=0;this.oy=0;this.shake=0;},
};

const S={
  cache:{},stars:[],
  glow(color,r){
    const k='g'+color+r;
    if(this.cache[k])return this.cache[k];
    const pad=6,s=Math.ceil((r+pad)*2);
    const c=document.createElement('canvas');c.width=c.height=s;
    const g=c.getContext('2d');
    const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    grd.addColorStop(0,hexA(color,.85));
    grd.addColorStop(.4,hexA(color,.3));
    grd.addColorStop(1,hexA(color,0));
    g.fillStyle=grd;g.fillRect(0,0,s,s);
    this.cache[k]=c;return c;
  },
  dot(color,r){
    const k='d'+color+r;
    if(this.cache[k])return this.cache[k];
    const pad=3,s=Math.ceil((r+pad)*2);
    const c=document.createElement('canvas');c.width=c.height=s;
    const g=c.getContext('2d');
    g.fillStyle=color;g.beginPath();g.arc(s/2,s/2,r,0,U.TAU);g.fill();
    const grd=g.createRadialGradient(s/2,s/2,r*.4,s/2,s/2,s/2);
    grd.addColorStop(0,hexA(color,.5));grd.addColorStop(1,hexA(color,0));
    g.fillStyle=grd;g.fillRect(0,0,s,s);
    this.cache[k]=c;return c;
  },
  buildStars(){
    this.stars=[];
    for(let L=0;L<3;L++){
      const size=768;
      const c=document.createElement('canvas');c.width=c.height=size;
      const g=c.getContext('2d');
      const n=70+L*45;
      for(let i=0;i<n;i++){
        const x=Math.random()*size,y=Math.random()*size;
        const r=.5+L*.45+Math.random()*.7;
        g.globalAlpha=.16+L*.14+Math.random()*.2;
        g.fillStyle=Math.random()<.12?U.choice(['#19e3ff','#ff2bd6','#9b5cff']):'#cfe0ff';
        g.beginPath();g.arc(x,y,r,0,U.TAU);g.fill();
      }
      this.stars.push({c,size});
    }
  },
  drawStars(camX,camY){
    for(let L=0;L<3;L++){
      const st=this.stars[L];
      if(!st)continue;
      const f=.12+L*.18;
      let ox=(-camX*f)%st.size;let oy=(-camY*f)%st.size;
      if(ox>0)ox-=st.size;if(oy>0)oy-=st.size;
      for(let x=ox;x<VW;x+=st.size)for(let y=oy;y<VH;y+=st.size)
        ctx.drawImage(st.c,x,y);
    }
  },
};

const Particles={
  list:[],max:420,
  spawn(o){
    if(this.list.length>=this.max)this.list.splice(0,8);
    this.list.push(Object.assign({x:0,y:0,vx:0,vy:0,life:.5,t:0,size:3,color:'#fff',drag:.9,shrink:1,glow:true},o));
  },
  burst(x,y,color,n,spd=120,life=.5,size=3){
    for(let i=0;i<n;i++){
      const a=U.rand(U.TAU),v=U.rand(.25,1)*spd;
      this.spawn({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:life*U.rand(.6,1.3),size:size*U.rand(.6,1.4),color,drag:.88});
    }
  },
  update(dt){
    for(let i=this.list.length-1;i>=0;i--){
      const p=this.list[i];p.t+=dt;
      if(p.t>=p.life){this.list[i]=this.list[this.list.length-1];this.list.pop();continue;}
      const d=Math.pow(p.drag,dt*60);
      p.vx*=d;p.vy*=d;p.x+=p.vx*dt;p.y+=p.vy*dt;
    }
  },
  draw(){
    if(!this.list.length)return;
    ctx.globalCompositeOperation='lighter';
    for(const p of this.list){
      const a=1-p.t/p.life;
      const s=p.size*(1-p.shrink*.7*(p.t/p.life));
      if(s<=0.2)continue;
      ctx.fillStyle=hexA(p.color,a*.9);
      ctx.beginPath();ctx.arc(p.x,p.y,s,0,U.TAU);ctx.fill();
    }
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  },
};

const Fx={
  list:[],rings:[],
  text(x,y,str,color='#fff',size=13,vy=-52){
    if(this.list.length>90)this.list.shift();
    this.list.push({x,y,vy,t:0,life:.75,str,color,size});
  },
  ring(x,y,r0,r1,color,life=.4,w=3){
    this.rings.push({x,y,r0,r1,color,life,t:0,w});
  },
  update(dt){
    for(let i=this.list.length-1;i>=0;i--){
      const p=this.list[i];p.t+=dt;
      if(p.t>=p.life){this.list.splice(i,1);continue;}
      p.y+=p.vy*dt;p.vy*=Math.pow(.92,dt*60);
    }
    for(let i=this.rings.length-1;i>=0;i--){
      const r=this.rings[i];r.t+=dt;
      if(r.t>=r.life)this.rings.splice(i,1);
    }
  },
  draw(){
    ctx.globalCompositeOperation='lighter';
    for(const r of this.rings){
      const k=U.easeOut(r.t/r.life);
      const rad=U.lerp(r.r0,r.r1,k);
      ctx.strokeStyle=hexA(r.color,(1-r.t/r.life)*.8);
      ctx.lineWidth=r.w*(1-k)+.5;
      ctx.beginPath();ctx.arc(r.x,r.y,Math.max(rad,0.1),0,U.TAU);ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
    ctx.textAlign='center';
    for(const p of this.list){
      const a=1-Math.pow(p.t/p.life,2);
      ctx.font='700 '+p.size+'px Rajdhani,sans-serif';
      ctx.globalAlpha=a;
      ctx.fillStyle=p.color;
      ctx.fillText(p.str,p.x,p.y);
    }
    ctx.globalAlpha=1;
  },
};

const Grid={
  cell:72,map:new Map(),
  clear(){this.map.clear();},
  insert(e){
    const k=(Math.floor(e.x/this.cell)+2048)*8192+(Math.floor(e.y/this.cell)+2048);
    let a=this.map.get(k);
    if(!a){a=[];this.map.set(k,a);}
    a.push(e);
  },
  query(x,y,r,out){
    out.length=0;
    const c=this.cell,m=r+44;
    const x0=Math.floor((x-m)/c),x1=Math.floor((x+m)/c),y0=Math.floor((y-m)/c),y1=Math.floor((y+m)/c);
    for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++){
      const a=this.map.get((cx+2048)*8192+(cy+2048));
      if(a)for(let i=0;i<a.length;i++)out.push(a[i]);
    }
    return out;
  },
};
const tmpArr=[];
const tmpArr2=[];

const Input={
  k:{},dashBuf:0,mouse:{x:0,y:0},
  joy:{id:null,ox:0,oy:0,x:0,y:0,active:false},
  lastTap:0,touchMode:false,
  init(){
    addEventListener('keydown',e=>{
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.k[e.code]=true;
      AudioSys.unlock();
      if(e.code==='Space')this.dashBuf=.18;
      if(e.code==='Escape'||e.code==='KeyP')UI.togglePause();
      if(Game.state==='levelup'){
        if(e.code==='Digit1')UI.pickCard(0);
        if(e.code==='Digit2')UI.pickCard(1);
        if(e.code==='Digit3')UI.pickCard(2);
      }
    });
    addEventListener('keyup',e=>{this.k[e.code]=false;});
    addEventListener('blur',()=>{this.k={};this.joy.active=false;});
    addEventListener('mousemove',e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY;});
    const jb=document.getElementById('joybase'),jn=document.getElementById('joynub');
    addEventListener('touchstart',e=>{
      this.touchMode=true;
      document.getElementById('btn-dash').style.display='block';
      AudioSys.unlock();
      for(const t of e.changedTouches){
        if(t.target&&t.target.closest&&t.target.closest('button,.btn,.card,.screen,.modal'))continue;
        if(this.joy.id===null){
          this.joy.id=t.identifier;this.joy.ox=t.clientX;this.joy.oy=t.clientY;this.joy.x=t.clientX;this.joy.y=t.clientY;this.joy.active=true;
          if(UI.isTouchOn())UI.showJoy(jb,jn,t.clientX,t.clientY,t.clientX,t.clientY);
        }
      }
    },{passive:true});
    addEventListener('touchmove',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===this.joy.id){
          const dx=t.clientX-this.joy.ox,dy=t.clientY-this.joy.oy;
          const d=Math.hypot(dx,dy),m=Math.min(d,58);
          const a=Math.atan2(dy,dx);
          this.joy.x=this.joy.ox+Math.cos(a)*m;this.joy.y=this.joy.oy+Math.sin(a)*m;
          if(UI.isTouchOn())UI.moveJoy(jn,this.joy.x,this.joy.y);
        }
      }
      e.preventDefault();
    },{passive:false});
    addEventListener('touchend',e=>{
      for(const t of e.changedTouches){
        if(t.identifier===this.joy.id){
          this.joy.id=null;this.joy.active=false;
          if(UI.isTouchOn())UI.hideJoy(jb,jn);
        }
      }
    });
    const bd=document.getElementById('btn-dash');
    bd.addEventListener('touchstart',e=>{e.preventDefault();this.dashBuf=.2;});
    bd.addEventListener('click',()=>{this.dashBuf=.2;});
  },
  axis(){
    let x=0,y=0;
    if(this.k.KeyW||this.k.ArrowUp)y-=1;
    if(this.k.KeyS||this.k.ArrowDown)y+=1;
    if(this.k.KeyA||this.k.ArrowLeft)x-=1;
    if(this.k.KeyD||this.k.ArrowRight)x+=1;
    if(this.joy.active){
      const dx=this.joy.x-this.joy.ox,dy=this.joy.y-this.joy.oy;
      if(Math.hypot(dx,dy)>7){x=dx/58;y=dy/58;}
    }
    const l=Math.hypot(x,y);
    if(l>1){x/=l;y/=l;}
    return {x,y,l:Math.min(l,1)};
  },
};

const Save={
  key:'voidstorm_save_v1',d:null,
  def(){
    return {gems:0,up:{},ach:{},chars:{nova:true},best:{time:0,kills:0,level:0,score:0},wins:0,runs:0,set:{mus:.7,sfx:.8,shake:true}};
  },
  load(){
    this.d=this.def();
    try{
      const raw=localStorage.getItem(this.key);
      if(raw){
        const j=JSON.parse(raw);
        for(const k of ['gems','wins','runs'])if(typeof j[k]==='number')this.d[k]=j[k];
        if(j.up)Object.assign(this.d.up,j.up);
        if(j.ach)Object.assign(this.d.ach,j.ach);
        if(j.chars)Object.assign(this.d.chars,j.chars);
        if(j.best)Object.assign(this.d.best,j.best);
        if(j.set)Object.assign(this.d.set,j.set);
      }
    }catch(e){}
  },
  w(){try{localStorage.setItem(this.key,JSON.stringify(this.d));}catch(e){}},
};
Save.load();
