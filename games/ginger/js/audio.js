window.Ginger = window.Ginger || {};
(() => {
'use strict';
// Music and sound effects are initialized after the first user gesture.
function createAudio({ getSave, persist, $, clamp }) {
let AC=null, master=null, musicG=null, sfxG=null, echoIn=null, noiseBuf=null;
let muted=!getSave().snd, musicTimer=null, mStep=0, mNext=0;
const BPM=92, SPB=60/BPM, STEPD=SPB/2;
const CHORDS=[[220,261.63,329.63],[220,261.63,329.63],[174.61,220,261.63],[174.61,220,261.63],
              [261.63,329.63,392],[261.63,329.63,392],[196,246.94,293.66],[196,246.94,293.66]];
const PENTA=[440,523.25,587.33,659.25,783.99,880]; let melIdx=2;
function initAudio(){
  if(AC) { if(AC.state==='suspended') AC.resume().catch(()=>{}); return; }
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    const comp=AC.createDynamicsCompressor(); comp.threshold.value=-16; comp.ratio.value=6; comp.connect(AC.destination);
    master=AC.createGain(); master.gain.value=muted?0:1; master.connect(comp);
    musicG=AC.createGain(); musicG.gain.value=.5; musicG.connect(master);
    sfxG=AC.createGain(); sfxG.gain.value=.9; sfxG.connect(master);
    echoIn=AC.createGain(); const dl=AC.createDelay(1); dl.delayTime.value=SPB*.75;
    const fb=AC.createGain(); fb.gain.value=.3; const wet=AC.createGain(); wet.gain.value=.22;
    echoIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicG);
    noiseBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    mNext=AC.currentTime+.1; mStep=0;
    musicTimer=setInterval(()=>{ if(!AC||AC.state!=='running')return;
      while(mNext<AC.currentTime+.28){ scheduleStep(mStep,mNext); mStep=(mStep+1)%64; mNext+=STEPD; } },90);
  }catch(e){AC=null;}
}
function tone(f,dur,type='sine',g=.15,slide=null,when=0,dest){
  if(!AC||muted)return; try{
    const t0=AC.currentTime+when, o=AC.createOscillator(), gn=AC.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t0);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t0+dur);
    gn.gain.setValueAtTime(0,t0); gn.gain.linearRampToValueAtTime(g,t0+.012);
    gn.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(gn); gn.connect(dest||sfxG); o.start(t0); o.stop(t0+dur+.03);
  }catch(e){}
}
function noise(dur,freq,g=.2,type='highpass',when=0){
  if(!AC||muted)return; try{
    const t0=AC.currentTime+when, src=AC.createBufferSource(); src.buffer=noiseBuf;
    const fl=AC.createBiquadFilter(); fl.type=type; fl.frequency.value=freq;
    const gn=AC.createGain(); gn.gain.setValueAtTime(g,t0); gn.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    src.connect(fl); fl.connect(gn); gn.connect(sfxG); src.start(t0); src.stop(t0+dur+.03);
  }catch(e){}
}
function scheduleStep(s,t){
  if(muted)return;
  try{
    const bar=Math.floor(s/8)%8, ib=s%8, ch=CHORDS[bar], barDur=STEPD*8;
    if(ib===0){ // pad
      const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=760; lp.connect(musicG);
      ch.forEach(f=>{ [-4,4].forEach(det=>{
        const o=AC.createOscillator(),g=AC.createGain(); o.type='triangle'; o.frequency.value=f; o.detune.value=det;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.028,t+.5);
        g.gain.setValueAtTime(.028,t+barDur-.6); g.gain.linearRampToValueAtTime(0,t+barDur);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t+barDur+.05); }); });
    }
    if(ib===0||ib===4){ // bass + soft kick
      const o=AC.createOscillator(),g=AC.createGain(); o.type='sine'; o.frequency.value=ch[0]/2;
      g.gain.setValueAtTime(.17,t); g.gain.exponentialRampToValueAtTime(.0001,t+.4);
      o.connect(g); g.connect(musicG); o.start(t); o.stop(t+.45);
      const k=AC.createOscillator(),kg=AC.createGain(); k.type='sine';
      k.frequency.setValueAtTime(120,t); k.frequency.exponentialRampToValueAtTime(42,t+.11);
      kg.gain.setValueAtTime(.22,t); kg.gain.exponentialRampToValueAtTime(.0001,t+.13);
      k.connect(kg); kg.connect(musicG); k.start(t); k.stop(t+.16);
    }
    if(ib%2===1){ const src=AC.createBufferSource(); src.buffer=noiseBuf;
      const hp=AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7000;
      const g=AC.createGain(); g.gain.setValueAtTime(.035,t); g.gain.exponentialRampToValueAtTime(.0001,t+.04);
      src.connect(hp); hp.connect(g); g.connect(musicG); src.start(t); src.stop(t+.06); }
    const prob=(ib%2===0?.58:.32)*(bar%4===3?.45:1);
    if(Math.random()<prob){
      melIdx=clamp(melIdx+[-2,-1,-1,0,1,1,2][Math.floor(Math.random()*7)],0,PENTA.length-1);
      const o=AC.createOscillator(),g=AC.createGain(),lp=AC.createBiquadFilter();
      o.type='triangle'; o.frequency.value=PENTA[melIdx]; lp.type='lowpass'; lp.frequency.value=2400;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(.1,t+.015); g.gain.exponentialRampToValueAtTime(.0001,t+.3);
      o.connect(lp); lp.connect(g); g.connect(musicG); g.connect(echoIn); o.start(t); o.stop(t+.35);
    }
  }catch(e){}
}
function meow(kind='happy'){
  if(!AC||muted)return; try{
    const cfg={
      happy:{d:.5,p:[480,760,820,520],f:[600,1600,1900,900],g:.2},
      mew:{d:.17,p:[680,920,860],f:[900,1800,1400],g:.09},
      hurt:{d:.5,p:[750,600,420,250],f:[1400,1100,800,520],g:.22},
      sad:{d:.85,p:[520,600,430,300,220],f:[1000,1300,900,600,450],g:.2}
    }[kind];
    const t0=AC.currentTime;
    const o=AC.createOscillator(); o.type='sawtooth';
    const bp=AC.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=2.1;
    const g=AC.createGain();
    const vib=AC.createOscillator(); vib.frequency.value=7; const vg=AC.createGain(); vg.gain.value=13;
    vib.connect(vg); vg.connect(o.frequency);
    o.frequency.setValueCurveAtTime(new Float32Array(cfg.p),t0,cfg.d);
    bp.frequency.setValueCurveAtTime(new Float32Array(cfg.f),t0,cfg.d);
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(cfg.g,t0+.045);
    g.gain.setValueAtTime(cfg.g,t0+cfg.d*.6); g.gain.linearRampToValueAtTime(.0001,t0+cfg.d);
    const o2=AC.createOscillator(); o2.type='triangle';
    o2.frequency.setValueCurveAtTime(new Float32Array(cfg.p.map(f=>f/2)),t0,cfg.d);
    const g2=AC.createGain(); g2.gain.value=.5;
    o.connect(bp); o2.connect(g2); g2.connect(bp); bp.connect(g); g.connect(sfxG);
    o.start(t0); o2.start(t0); vib.start(t0);
    o.stop(t0+cfg.d+.03); o2.stop(t0+cfg.d+.03); vib.stop(t0+cfg.d+.03);
  }catch(e){}
}
function purr(){ if(!AC||muted)return; try{
  const t0=AC.currentTime, src=AC.createBufferSource(); src.buffer=noiseBuf; src.loop=true;
  const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
  const g=AC.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(.14,t0+.08); g.gain.linearRampToValueAtTime(0,t0+.8);
  const am=AC.createOscillator(); am.frequency.value=24; const ag=AC.createGain(); ag.gain.value=.09;
  am.connect(ag); ag.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(sfxG); src.start(t0); src.stop(t0+.85); am.start(t0); am.stop(t0+.85);
}catch(e){}}
const SFX={
  click(){tone(1150,.05,'triangle',.06);},
  fish(){tone(880,.09,'sine',.14);tone(1318.5,.14,'sine',.14,null,.07);noise(.05,8000,.05,'highpass',.05);},
  allfish(){[784,988,1174.7].forEach((f,i)=>tone(f,.12,'sine',.13,null,i*.08));},
  yarn(){purr();tone(300,.12,'sine',.1,380);},
  spring(){tone(190,.2,'square',.09,620);},
  stomp(){noise(.1,600,.22,'lowpass');tone(220,.1,'sine',.16,90);},
  woof(){tone(170,.11,'square',.12,85);noise(.08,700,.1,'lowpass',.02);},
  spark(){noise(.16,3200,.14,'highpass');tone(1600,.1,'sawtooth',.05,300);},
  check(){tone(660,.12,'sine',.12);tone(990,.2,'sine',.12,null,.09);},
  thud(){noise(.06,420,.07,'lowpass');},
  bonk(){tone(300,.06,'sine',.06,180);},
  death(){[523,392,330,262].forEach((f,i)=>tone(f,.14,'triangle',.12,null,i*.12));meow('sad');},
  jingle(){[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.16,'sine',.14,null,i*.1));
    setTimeout(()=>meow('happy'),480); setTimeout(()=>meow('happy'),800);},
  star(i){tone([1568,1976,2637][i]||2637,.22,'sine',.14);},
  thunder(){noise(1.3,190,.22,'lowpass');},
  fanfare(){[523.25,659.25,783.99,1046.5,1318.5,1568].forEach((f,i)=>tone(f,.2,'sine',.13,null,i*.11));
    setTimeout(()=>meow('happy'),700);setTimeout(()=>meow('happy'),1050);setTimeout(()=>purr(),1300);}
};
function setMuted(m){
  muted=m; getSave().snd=m?0:1; persist();
  if(master&&AC) master.gain.setTargetAtTime(m?0:1,AC.currentTime,.02);
  $('icoSndOn').style.display=m?'none':'block';
  $('icoSndOff').style.display=m?'block':'none';
  $('btnSound').classList.toggle('muted',m);
}
document.addEventListener('visibilitychange',()=>{ if(!AC)return;
  if(document.hidden) AC.suspend().catch(()=>{});
  else AC.resume().then(()=>{mNext=Math.max(mNext,AC.currentTime+.06);}).catch(()=>{});
});

return { initAudio, meow, purr, SFX, setMuted, get muted() { return muted; } };
}

Object.assign(window.Ginger, { createAudio });
})();
