'use strict';
const AudioSys=(()=>{
  let ac=null,master=null,musG=null,sfxG=null,delayN=null,delG=null,noiseBuf=null;
  let disabled=false;
  const M={on:false,step:0,bar:0,next:0,tier:0,bpm:112,timer:null};
  const nf=m=>440*Math.pow(2,(m-69)/12);
  const CH=[[45,57,60,64],[41,53,57,60],[36,48,52,55],[43,55,59,62]];

  function init(){
    if(ac||disabled)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC){disabled=true;return;}
      ac=new AC();
      master=ac.createGain();master.gain.value=.9;
      const comp=ac.createDynamicsCompressor();
      comp.threshold.value=-18;comp.ratio.value=6;
      master.connect(comp);comp.connect(ac.destination);
      musG=ac.createGain();musG.connect(master);
      sfxG=ac.createGain();sfxG.connect(master);
      delayN=ac.createDelay(1);delayN.delayTime.value=.27;
      delG=ac.createGain();delG.gain.value=.34;
      const delWet=ac.createGain();delWet.gain.value=.25;
      delayN.connect(delG);delG.connect(delayN);delayN.connect(delWet);delWet.connect(master);
      noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);
      const d=noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      setVolumes();
    }catch(e){disabled=true;}
  }
  function setVolumes(){
    if(!ac)return;
    musG.gain.value=(Save.d.set.mus||0)*.5;
    sfxG.gain.value=(Save.d.set.sfx===undefined?.8:Save.d.set.sfx)*.6;
  }
  function unlock(){
    init();
    if(ac&&ac.state==='suspended')ac.resume();
  }
  function noise(t,dur,type,freq,vol,q=1){
    const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
    const g=ac.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(sfxG);
    s.start(t);s.stop(t+dur+.02);
    return f;
  }
  function tone(t,dur,type,f0,f1,vol,dest){
    const o=ac.createOscillator();o.type=type;
    o.frequency.setValueAtTime(Math.max(20,f0),t);
    if(f1)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    const g=ac.createGain();
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(dest||sfxG);
    o.start(t);o.stop(t+dur+.02);
    return o;
  }
  function sfx(name,pitch=1){
    if(!ac||ac.state!=='running')return;
    const t=ac.currentTime;
    switch(name){
      case 'shoot':tone(t,.08,'triangle',760*pitch,420*pitch,.1);break;
      case 'laser':{tone(t,.16,'sawtooth',1400,180,.14);noise(t,.1,'highpass',2500,.06);}break;
      case 'missile':{tone(t,.2,'sawtooth',300,90,.1);noise(t,.22,'bandpass',900,.08,2);}break;
      case 'chain':{tone(t,.09,'square',1500*pitch,240,.08);noise(t,.05,'highpass',3000,.05);}break;
      case 'nova':{tone(t,.3,'sine',220,58,.24);noise(t,.25,'lowpass',500,.14);}break;
      case 'rail':{tone(t,.22,'sawtooth',180,900,.12);tone(t,.22,'sawtooth',185,920,.12);noise(t,.18,'highpass',1500,.1);}break;
      case 'cinder':noise(t,.24,'bandpass',700,.07,1.4);break;
      case 'frost':{tone(t,.14,'sine',1800,2400,.05);tone(t,.14,'sine',2400,3200,.04);}break;
      case 'hit':noise(t,.05,'highpass',900,.09);break;
      case 'kill':{tone(t,.13,'square',330,52,.16);noise(t,.08,'lowpass',1400,.1);}break;
      case 'bigkill':{tone(t,.3,'square',220,38,.24);noise(t,.3,'lowpass',900,.2);tone(t,.3,'sine',120,30,.2);}break;
      case 'explode':{noise(t,.45,'lowpass',420,.3);tone(t,.4,'sine',150,32,.28);}break;
      case 'hurt':{tone(t,.18,'sawtooth',230,85,.2);noise(t,.16,'lowpass',1100,.14);}break;
      case 'dash':{const f=noise(t,.16,'bandpass',600,.12,2);f.frequency.setValueAtTime(600,t);f.frequency.exponentialRampToValueAtTime(4200,t+.14);}break;
      case 'gem':{const f=880*pitch;tone(t,.1,'sine',f,f,.09);tone(t+.06,.14,'sine',f*1.5,f*1.5,.07);}break;
      case 'coin':{tone(t,.07,'square',900*pitch,900*pitch,.07);tone(t+.07,.12,'square',1350*pitch,1350*pitch,.07);}break;
      case 'heart':{tone(t,.2,'triangle',520,520,.1);tone(t+.09,.28,'triangle',660,660,.1);tone(t+.18,.32,'triangle',780,780,.1);}break;
      case 'chest':{[523,659,784,1046].forEach((f,i)=>tone(t+i*.09,.22,'triangle',f,f,.11));}break;
      case 'levelup':{[392,523,659,784].forEach((f,i)=>tone(t+i*.08,.24,'triangle',f,f,.12));}break;
      case 'choose':tone(t,.1,'triangle',700,980,.1);break;
      case 'evolve':{[261,329,392,523,659].forEach((f,i)=>tone(t+i*.07,.4,'triangle',f,f,.12));noise(t+.2,.5,'highpass',3000,.07);}break;
      case 'warn':{tone(t,.3,'sawtooth',110,110,.16);tone(t+.35,.3,'sawtooth',98,98,.16);}break;
      case 'bossdie':{noise(t,.8,'lowpass',600,.35);tone(t,.7,'sine',180,28,.3);tone(t+.1,.6,'square',140,30,.2);}break;
      case 'freeze':{tone(t,.3,'sine',2600,900,.09);noise(t,.2,'highpass',5000,.06);}break;
      case 'thunder':{noise(t,.3,'highpass',800,.18);tone(t,.2,'sawtooth',90,40,.2);}break;
      case 'victory':{[523,659,784,1046,784,1046,1318].forEach((f,i)=>tone(t+i*.13,.3,'triangle',f,f,.12));}break;
      case 'defeat':{[392,330,262,196].forEach((f,i)=>tone(t+i*.22,.4,'sawtooth',f,f*.98,.11));}break;
      case 'heartbeat':{tone(t,.1,'sine',80,50,.2);tone(t+.16,.12,'sine',70,45,.16);}break;
      case 'buy':{tone(t,.08,'square',660,660,.09);tone(t+.09,.14,'square',990,990,.09);}break;
      case 'toast':tone(t,.12,'sine',880,1180,.07);break;
      case 'ui':tone(t,.05,'triangle',500,600,.06);break;
    }
  }

  function kick(t,v){
    const o=ac.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(38,t+.11);
    const g=ac.createGain();
    g.gain.setValueAtTime(v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.2);
    o.connect(g);g.connect(musG);o.start(t);o.stop(t+.24);
  }
  function hat(t,v){
    const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=7400;
    const g=ac.createGain();
    g.gain.setValueAtTime(v,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.045);
    s.connect(f);f.connect(g);g.connect(musG);s.start(t);s.stop(t+.07);
  }
  function snare(t){
    const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;
    const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1900;f.Q.value=.8;
    const g=ac.createGain();
    g.gain.setValueAtTime(.3,t);
    g.gain.exponentialRampToValueAtTime(.0001,t+.14);
    s.connect(f);f.connect(g);g.connect(musG);s.start(t);s.stop(t+.18);
    tone(t,.07,'triangle',210,160,.14,musG);
  }
  function bassN(t,m,d,v){
    for(let i=0;i<2;i++){
      const o=ac.createOscillator();o.type='sawtooth';
      o.frequency.value=nf(m);o.detune.value=i?6:-6;
      const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=420;
      const g=ac.createGain();
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(v,t+.008);
      g.gain.setValueAtTime(v,t+d*.7);
      g.gain.exponentialRampToValueAtTime(.0001,t+d);
      o.connect(f);f.connect(g);g.connect(musG);o.start(t);o.stop(t+d+.02);
    }
  }
  function leadN(t,m,d,v,type){
    const o=ac.createOscillator();o.type=type||'square';
    o.frequency.value=nf(m);
    const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=2400;
    const g=ac.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(v,t+.01);
    g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(f);f.connect(g);g.connect(musG);
    const send=ac.createGain();send.gain.value=.5;
    g.connect(send);send.connect(delayN);
    o.start(t);o.stop(t+d+.05);
  }
  function padC(t,notes,d){
    for(const m of notes){
      const o=ac.createOscillator();o.type='triangle';
      o.frequency.value=nf(m);o.detune.value=U.rand(-8,8);
      const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=820;
      const g=ac.createGain();
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(.05,t+.3);
      g.gain.setValueAtTime(.05,t+d-.25);
      g.gain.linearRampToValueAtTime(0,t+d);
      o.connect(f);f.connect(g);g.connect(musG);o.start(t);o.stop(t+d+.05);
    }
  }
  function scheduleStep(step,t){
    const ch=CH[M.bar%4],T=M.tier;
    if(T===0){
      if(step===0){kick(t,.55);padC(t,ch,60/M.bpm*4);}
      if(step===8)kick(t,.3);
    }else{
      if(step%4===0)kick(t,T===1?.6:.72);
      if(T>=2&&(step===14||step===15))kick(t,.4);
      if(step%4===2)hat(t,.12);
      if(T>=2&&step%2===0)hat(t,step%4===2?.12:.05);
      if(T>=2&&(step===4||step===12))snare(t);
      if(step%2===0)bassN(t,ch[0]+(step%8===6?12:0),60/M.bpm/4*1.7,T===1?.2:.26);
      padC(t,ch,60/M.bpm*4);
      if(T>=2){
        const arp=[ch[1]+12,ch[2]+12,ch[3]+12,ch[2]+12];
        if(step%2===1)leadN(t,arp[(step>>1)%4],60/M.bpm/4*1.4,.055,'square');
      }
      if(T>=3){
        if(step===0||step===3||step===6||step===10)leadN(t,ch[(step%3)]+24,60/M.bpm/4*1.8,.07,'sawtooth');
        if(step===7||step===13)hat(t,.14);
      }
    }
  }
  function startMusic(){
    init();
    if(!ac||M.on)return;
    M.on=true;M.step=0;M.bar=0;
    M.next=ac.currentTime+.06;
    if(M.timer)clearInterval(M.timer);
    M.timer=setInterval(()=>{
      if(!ac||!M.on)return;
      while(M.next<ac.currentTime+.14){
        scheduleStep(M.step,M.next);
        M.step++;
        if(M.step%16===0)M.bar++;
        M.next+=60/M.bpm/4;
      }
    },30);
  }
  function stopMusic(){
    M.on=false;
    if(M.timer){clearInterval(M.timer);M.timer=null;}
  }
  function setTier(t){
    const nb=t===3?120:t===2?116:t===1?114:112;
    if(t!==M.tier){M.tier=t;M.bpm=nb;}
  }
  function duck(){
    if(!ac||!musG)return;
    const v=(Save.d.set.mus||0)*.5;
    musG.gain.cancelScheduledValues(ac.currentTime);
    musG.gain.setTargetAtTime(v*.25,ac.currentTime,.03);
    musG.gain.setTargetAtTime(v,ac.currentTime+.5,.4);
  }
  return {unlock,sfx,startMusic,stopMusic,setTier,duck,setVolumes,get ready(){return !!ac&&!disabled;},get tier(){return M.tier;}};
})();
