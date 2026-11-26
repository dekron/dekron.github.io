window.Drift = window.Drift || {};
(() => {
'use strict';
/* Саундтрек синтезируется на лету и привязан к скорости: темп, яркость
   фильтра и громкость арпеджио растут вместе с машиной. Мотор и визг
   покрышек — непрерывные слои, управляемые из игры. */
function createAudio({ getSave, persist, $ }) {
  let AC = null, master = null, musicG = null, sfxG = null, echoIn = null, noiseBuf = null;
  let muted = !getSave().snd, musicTimer = null, mStep = 0, mNext = 0;
  let speedNorm = .15;
  let engOsc = null, engOsc2 = null, engFilter = null, engGain = null;
  let scrSrc = null, scrFilter = null, scrGain = null;
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880];
  let melIdx = 2;
  const clampN = (v, a, b) => v < a ? a : v > b ? b : v;
  function stepDur() { return (60 / (104 + 46 * speedNorm)) / 2; }

  function initAudio() {
    if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6; comp.connect(AC.destination);
      master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(comp);
      musicG = AC.createGain(); musicG.gain.value = .5; musicG.connect(master);
      sfxG = AC.createGain(); sfxG.gain.value = .9; sfxG.connect(master);
      echoIn = AC.createGain(); const dl = AC.createDelay(1); dl.delayTime.value = .28;
      const fb = AC.createGain(); fb.gain.value = .32; const wet = AC.createGain(); wet.gain.value = .22;
      echoIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicG);
      noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      /* мотор: две расстроенные пилы через низкочастотный фильтр */
      engGain = AC.createGain(); engGain.gain.value = 0;
      engFilter = AC.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 420;
      engOsc = AC.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 55;
      engOsc2 = AC.createOscillator(); engOsc2.type = 'sawtooth'; engOsc2.frequency.value = 55.7;
      engOsc.connect(engFilter); engOsc2.connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
      engOsc.start(); engOsc2.start();
      /* визг покрышек: петля шума через полосовой фильтр */
      scrGain = AC.createGain(); scrGain.gain.value = 0;
      scrFilter = AC.createBiquadFilter(); scrFilter.type = 'bandpass'; scrFilter.frequency.value = 1700; scrFilter.Q.value = 1.4;
      scrSrc = AC.createBufferSource(); scrSrc.buffer = noiseBuf; scrSrc.loop = true;
      scrSrc.connect(scrFilter); scrFilter.connect(scrGain); scrGain.connect(master); scrSrc.start();
      mNext = AC.currentTime + .1; mStep = 0;
      musicTimer = setInterval(() => {
        if (!AC || AC.state !== 'running') return;
        while (mNext < AC.currentTime + .3) { scheduleStep(mStep, mNext); mStep = (mStep + 1) % 32; mNext += stepDur(); }
      }, 90);
    } catch (e) { AC = null; }
  }

  function tone(f, dur, type = 'sine', g = .15, slide = null, when = 0, dest) {
    if (!AC || muted) return;
    try {
      const t0 = AC.currentTime + when, o = AC.createOscillator(), gn = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
      gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(g, t0 + .012);
      gn.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(gn); gn.connect(dest || sfxG); o.start(t0); o.stop(t0 + dur + .03);
    } catch (e) {}
  }
  function noise(dur, freq, g = .2, type = 'highpass', when = 0, slide = null) {
    if (!AC || muted) return;
    try {
      const t0 = AC.currentTime + when, src = AC.createBufferSource(); src.buffer = noiseBuf;
      const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t0);
      if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
      const gn = AC.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      src.connect(fl); fl.connect(gn); gn.connect(sfxG); src.start(t0); src.stop(t0 + dur + .03);
    } catch (e) {}
  }

  function scheduleStep(s, t) {
    if (muted) return;
    try {
      const bar = Math.floor(s / 8) % 4, ib = s % 8, ch = CHORDS[bar], barDur = stepDur() * 8;
      const bright = 500 + 2400 * speedNorm;
      if (ib === 0) {
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.connect(musicG);
        ch.forEach(f => { [-5, 5].forEach(det => {
          const o = AC.createOscillator(), g = AC.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.026, t + .4);
          g.gain.setValueAtTime(.026, t + barDur - .5); g.gain.linearRampToValueAtTime(0, t + barDur);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + barDur + .05);
        }); });
      }
      if (ib % 2 === 0) {
        const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = ch[0] / 2 * (ib === 6 ? 2 : 1);
        lp.type = 'lowpass'; lp.frequency.value = 240 + 900 * speedNorm;
        g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.0001, t + stepDur() * 1.6);
        o.connect(lp); lp.connect(g); g.connect(musicG); o.start(t); o.stop(t + stepDur() * 1.8);
      }
      if (ib === 0 || ib === 4) {
        const k = AC.createOscillator(), kg = AC.createGain(); k.type = 'sine';
        k.frequency.setValueAtTime(130, t); k.frequency.exponentialRampToValueAtTime(42, t + .11);
        kg.gain.setValueAtTime(.24, t); kg.gain.exponentialRampToValueAtTime(.0001, t + .14);
        k.connect(kg); kg.connect(musicG); k.start(t); k.stop(t + .17);
      }
      if (ib % 2 === 1) {
        const src = AC.createBufferSource(); src.buffer = noiseBuf;
        const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
        const g = AC.createGain(); g.gain.setValueAtTime(.03 + .02 * speedNorm, t); g.gain.exponentialRampToValueAtTime(.0001, t + .04);
        src.connect(hp); hp.connect(g); g.connect(musicG); src.start(t); src.stop(t + .06);
      }
      const prob = (ib % 2 === 0 ? .5 : .3) * (.6 + .6 * speedNorm);
      if (Math.random() < prob) {
        melIdx = clampN(melIdx + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)], 0, PENTA.length - 1);
        const o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
        o.type = 'square'; o.frequency.value = PENTA[melIdx]; lp.type = 'lowpass'; lp.frequency.value = bright + 800;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 + .04 * speedNorm, t + .015);
        g.gain.exponentialRampToValueAtTime(.0001, t + .26);
        o.connect(lp); lp.connect(g); g.connect(musicG); g.connect(echoIn); o.start(t); o.stop(t + .3);
      }
    } catch (e) {}
  }

  function setSpeed(n) {
    speedNorm = clampN(n, 0, 1);
    if (!AC) return;
    try {
      const t = AC.currentTime;
      const f = 52 + 150 * speedNorm;
      engOsc.frequency.setTargetAtTime(f, t, .06);
      engOsc2.frequency.setTargetAtTime(f * 1.012, t, .06);
      engFilter.frequency.setTargetAtTime(320 + 1300 * speedNorm, t, .08);
      scrFilter.frequency.setTargetAtTime(1500 + 900 * speedNorm, t, .1);
    } catch (e) {}
  }
  function engineStart() { if (AC && engGain) engGain.gain.setTargetAtTime(muted ? 0 : .05, AC.currentTime, .15); }
  function engineStop() { if (AC && engGain) engGain.gain.setTargetAtTime(0, AC.currentTime, .1); }
  function setDrift(on) { if (AC && scrGain) scrGain.gain.setTargetAtTime(on && !muted ? .055 : 0, AC.currentTime, on ? .05 : .12); }

  const SFX = {
    click() { tone(1150, .05, 'triangle', .06); },
    beep() { tone(660, .12, 'square', .08); },
    go() { tone(880, .3, 'square', .1); tone(1320, .35, 'sine', .1, null, .05); },
    gate() { tone(784, .1, 'sine', .13); tone(1174.7, .18, 'sine', .13, null, .08); noise(.06, 8000, .04, 'highpass', .02); },
    boost() { noise(.5, 400, .16, 'bandpass', 0, 3600); tone(180, .45, 'sawtooth', .09, 760); },
    hit() { noise(.14, 900, .2, 'lowpass'); tone(220, .12, 'square', .12, 90); },
    fall() { tone(700, .7, 'sine', .12, 110); noise(.6, 1200, .08, 'lowpass', .05, 200); },
    crash() { noise(.4, 500, .22, 'lowpass', 0, 120); tone(160, .35, 'sawtooth', .12, 50); },
    tick() { tone(1200, .05, 'square', .05); },
    finish() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, .2, 'sine', .13, null, i * .1)); },
    star(i) { tone([1568, 1976, 2637][i] || 2637, .22, 'sine', .14); },
    over() { [392, 330, 262, 196].forEach((f, i) => tone(f, .22, 'triangle', .12, null, i * .16)); }
  };

  function setMuted(m) {
    muted = m; getSave().snd = m ? 0 : 1; persist();
    if (master && AC) master.gain.setTargetAtTime(m ? 0 : 1, AC.currentTime, .02);
    if (m) { engineStop(); setDrift(false); }
    $('icoSndOn').style.display = m ? 'none' : 'block';
    $('icoSndOff').style.display = m ? 'block' : 'none';
    $('btnSound').classList.toggle('muted', m);
  }
  document.addEventListener('visibilitychange', () => {
    if (!AC) return;
    if (document.hidden) AC.suspend().catch(() => {});
    else AC.resume().then(() => { mNext = Math.max(mNext, AC.currentTime + .06); }).catch(() => {});
  });

  return { initAudio, SFX, setMuted, setSpeed, engineStart, engineStop, setDrift, get muted() { return muted; } };
}

Object.assign(window.Drift, { createAudio });
})();