(() => {
'use strict';
const { createAudio, PRESETS, generateTrack, drawCar, DS } = window.Drift;

/* ============================================================
   NEON DRIFT — синтвейв-гонки по процедурным эстакадам
   ============================================================ */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const STEP = 1 / 120;
const CRUISE = 300, MAXV = 430, BOOSTV = 640, BRAKEV = 105;
const ACCEL = 250, BOOST_ACCEL = 560, BRAKE = 460;
const STEER = 2.3, DRIFT_STEER = 3.3, GRIP = 9, DRIFT_GRIP = 3.6;
const CAR_R = 15, BARRIER_R = 24, KMH = .45;

/* ---------------- save ---------------- */
let save = { best: {}, snd: 1, last: 'boulevard' };
try { const raw = localStorage.getItem('neondrift_v1'); if (raw) { const p = JSON.parse(raw); if (p && p.best) save = Object.assign(save, p); } } catch (e) {}
function persist() { try { localStorage.setItem('neondrift_v1', JSON.stringify(save)); } catch (e) {} }

/* ---------------- canvas ---------------- */
const cv = $('cv'), ctx = cv.getContext('2d', { alpha: false });
let DPR = 1, CW = 0, CH = 0, S = 1, VW = 0, VH = 0;
function sizeCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  CW = window.innerWidth; CH = window.innerHeight;
  cv.width = Math.round(CW * DPR); cv.height = Math.round(CH * DPR);
  S = Math.min(CH / 620, CW / 900); VW = CW / S; VH = CH / S;
}
window.addEventListener('resize', sizeCanvas);
window.addEventListener('orientationchange', sizeCanvas);
sizeCanvas();
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');

const audio = createAudio({ getSave: () => save, persist, $ });
const { initAudio, SFX, setMuted } = audio;

/* ---------------- state ---------------- */
const G = { state: 'title', trackId: 'boulevard', seed: 1, timeLeft: 0, raceTime: 0, falls: 0, hits: 0,
  driftTime: 0, meter: 0, topSpeed: 0, gates: 0, cd: 0, wasBoost: false, meterAnnounced: false };
let T = null, C = null, cam = { x: 0, y: 0 };
let particles = [], floaters = [], skids = [];
let shake = 0, hurtFlash = 0, goFlash = 0, tNow = 0, objTimer = 0, tickSec = -1;
let demoS = 0, skidT = 0, smokeT = 0;
const PRESET_ORDER = ['boulevard', 'serpentine', 'chaos'];

function newCar(p) {
  return { x: p.x, y: p.y, h: p.h, vx: 0, vy: 0, vf: 0, slip: 0, s: 0, prevS: 0, nearIdx: 0,
    drifting: false, boosting: false, braking: false, crashT: 0, inv: 0, clearing: false, clearT: 0 };
}

/* ---------------- input ---------------- */
const input = { l: false, r: false, brake: false, drift: false, boost: false };
let keyL = false, keyR = false, keyB = false, keyD = false, keyN = false;
let tL = false, tR = false, tB = false, tD = false, tN = false;
function syncInput() {
  input.l = keyL || tL; input.r = keyR || tR; input.brake = keyB || tB;
  input.drift = keyD || tD; input.boost = keyN || tN;
}
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  initAudio();
  if (e.repeat) return;
  const st = G.state;
  if ((e.code === 'Space' || e.code === 'Enter') && (st === 'title' || st === 'intro' || st === 'pause' || st === 'clear' || st === 'over')) { primaryAction(); return; }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyL = true; syncInput(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyR = true; syncInput(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { keyB = true; syncInput(); }
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keyD = true; syncInput(); }
  if (e.code === 'KeyE') { keyN = true; syncInput(); }
  if (e.code === 'KeyM') { setMuted(!audio.muted); if (!audio.muted) SFX.click(); }
  if (e.code === 'KeyR' && (st === 'play' || st === 'pause' || st === 'countdown')) { SFX.click(); retryRace(); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (st === 'play' || st === 'countdown') pauseGame(); else if (st === 'pause') resumeGame(); }
});
window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keyL = false; syncInput(); }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') { keyR = false; syncInput(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { keyB = false; syncInput(); }
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { keyD = false; syncInput(); }
  if (e.code === 'KeyE') { keyN = false; syncInput(); }
});
function bindTouch(id, set) {
  const el = $(id); const ids = new Set();
  el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); ids.add(e.pointerId); el.classList.add('press'); set(true); });
  const off = e => { ids.delete(e.pointerId); if (!ids.size) { el.classList.remove('press'); set(false); } };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindTouch('tLeft', v => { tL = v; syncInput(); });
bindTouch('tRight', v => { tR = v; syncInput(); });
bindTouch('tBrake', v => { tB = v; syncInput(); });
bindTouch('tDrift', v => { tD = v; syncInput(); });
bindTouch('tBoost', v => { tN = v; syncInput(); });
window.addEventListener('pointerdown', () => initAudio(), { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') pauseGame(); });

/* ---------------- race setup ---------------- */
function startRace(trackId, seed) {
  G.trackId = trackId; G.seed = seed;
  T = generateTrack(seed, trackId === 'random' ? null : trackId);
  G.timeLeft = T.spec.start; G.raceTime = 0; G.falls = 0; G.hits = 0; G.driftTime = 0;
  G.meter = 0; G.topSpeed = 0; G.gates = 0; G.wasBoost = false; G.meterAnnounced = false; G.cd = 3.3;
  for (const g of T.gates) g.passed = false;
  C = newCar(T.start);
  particles.length = 0; floaters.length = 0; skids.length = 0;
  shake = 0; hurtFlash = 0; goFlash = 0; tickSec = -1;
  cam.x = C.x; cam.y = C.y;
  save.last = trackId; persist();
  audio.setSpeed(.15);
  setState('countdown');
  showObjective('Ворота продлевают время. <b>Дрифт</b> заряжает нитро — жми <b>E</b>', 6);
  updateHUD();
}
function retryRace() { startRace(G.trackId, G.seed); }
function startIntro(trackId, seed) {
  const spec = trackId === 'random' ? null : PRESETS[trackId];
  const tr = generateTrack(seed, trackId === 'random' ? null : trackId);
  $('introKick').textContent = trackId === 'random' ? 'случайная трасса · seed ' + seed : 'трасса · ' + spec.diff;
  $('introName').textContent = tr.spec.name;
  $('introStory').innerHTML = tr.spec.story;
  const best = save.best[trackId];
  $('introStats').innerHTML =
    statHTML('road', Math.round(tr.total / 10) + ' м', '#00f0ff') +
    statHTML('gate', tr.gates.length + ' ворот', '#ff2bd6') +
    (best ? statHTML('clock', 'рекорд ' + fmtTime(best.t), '#ffc233') : statHTML('clock', 'рекорда нет', '#8f97bd'));
  $('introDiff').textContent = tr.spec.diff;
  $('introDiff').style.color = tr.spec.diffC;
  G.pendingTrack = trackId; G.pendingSeed = seed;
  setState('intro');
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}

/* ---------------- particles / floaters ---------------- */
function spawnP(x, y, type, vx = 0, vy = 0) {
  if (particles.length > 420) particles.shift();
  const p = { x, y, vx, vy, type, life: 1, max: 1, rot: rnd(TAU), vr: rnd(-6, 6), size: 1, col: null };
  switch (type) {
    case 'smoke': p.max = p.life = rnd(.35, .6); p.size = rnd(4, 8); p.col = 'rgba(255,120,230,'; break;
    case 'spark': p.max = p.life = rnd(.3, .6); p.size = rnd(1.5, 3); p.col = '#00f0ff'; break;
    case 'boost': p.max = p.life = rnd(.25, .5); p.size = rnd(2, 4); p.col = '#7b2bff'; break;
    case 'debris': p.max = p.life = rnd(.4, .8); p.size = rnd(2, 5); p.col = '#ffc233'; break;
    case 'confetti': p.max = p.life = rnd(1, 1.7); p.size = rnd(3, 6);
      p.col = ['#ffc233', '#ff2bd6', '#00f0ff', '#2bff88', '#7b2bff'][Math.floor(rnd(5))]; break;
    case 'ring': p.max = p.life = rnd(.4, .7); p.size = rnd(3, 5); p.col = '#2bff88'; break;
  }
  particles.push(p);
}
function burst(x, y, type, n, pow = 160) {
  for (let i = 0; i < n; i++) { const a = rnd(TAU), v = rnd(pow * .3, pow); spawnP(x, y, type, Math.cos(a) * v, Math.sin(a) * v); }
}
function addFloater(x, y, txt, col = '#fff') { floaters.push({ x, y, txt, col, life: 1 }); }
function addShake(m) { shake = Math.min(16, shake + m); }
function showObjective(html, dur) { $('objective').innerHTML = html; $('objective').classList.add('show'); objTimer = dur; }
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

/* ---------------- gameplay ---------------- */
function nearestIdx() {
  let best = C.nearIdx, bd = Infinity;
  const lo = Math.max(0, C.nearIdx - 70), hi = Math.min(T.pts.length - 1, C.nearIdx + 90);
  for (let i = lo; i <= hi; i++) {
    const p = T.pts[i], d = (p.x - C.x) * (p.x - C.x) + (p.y - C.y) * (p.y - C.y);
    if (d < bd) { bd = d; best = i; }
  }
  C.nearIdx = best; return best;
}
function respawn() {
  let g = null;
  for (let i = T.gates.length - 1; i >= 0; i--) if (T.gates[i].passed) { g = T.gates[i]; break; }
  const p = g ? T.pts[g.idx] : T.pts[0];
  C.x = p.x; C.y = p.y; C.h = p.h; C.vx = 0; C.vy = 0; C.vf = 0;
  C.nearIdx = g ? g.idx : 0; C.s = p.s; C.prevS = p.s;
  C.inv = 1.4; C.crashT = 0; C.drifting = false; C.boosting = false;
  cam.x = C.x; cam.y = C.y;
  addFloater(C.x, C.y - 50, 'ещё раз!', '#00f0ff');
}
function fallOff() {
  C.crashT = 1.05; G.falls++;
  SFX.fall(); SFX.crash(); addShake(10); hurtFlash = .4;
  burst(C.x, C.y, 'debris', 14, 220);
  addFloater(C.x, C.y - 40, 'ПАДЕНИЕ!', '#ff3355');
  audio.setDrift(false);
}
function updateCountdown(dt) {
  const prev = Math.ceil(G.cd);
  G.cd -= dt;
  const now = Math.ceil(G.cd);
  if (now < prev && now > 0) SFX.beep();
  if (G.cd <= 0) {
    setState('play'); SFX.go(); goFlash = .7; audio.engineStart();
    addFloater(C.x, C.y - 60, 'GO!', '#2bff88');
  }
}
function updatePlay(dt) {
  if (!T || !C) return;
  if (C.crashT > 0) {
    C.crashT -= dt; G.timeLeft -= dt;
    if (G.timeLeft <= 0) { G.timeLeft = 0; showOver(); return; }
    if (C.crashT <= 0) respawn();
    return;
  }
  if (C.clearing) {
    C.clearT -= dt;
    const fx = Math.cos(C.h), fy = Math.sin(C.h);
    C.vx = fx * CRUISE; C.vy = fy * CRUISE;
    C.x += C.vx * dt; C.y += C.vy * dt;
    if (Math.random() < dt * 30) burst(C.x + rnd(-60, 60), C.y + rnd(-60, 60), 'confetti', 3, 140);
    if (C.clearT <= 0) showClear();
    return;
  }
  G.timeLeft -= dt;
  if (G.timeLeft <= 0) { G.timeLeft = 0; showOver(); return; }
  G.raceTime += dt;
  const sec = Math.ceil(G.timeLeft);
  if (G.timeLeft < 6 && sec !== tickSec) { tickSec = sec; SFX.tick(); }

  const steer = (input.r ? 1 : 0) - (input.l ? 1 : 0);
  const speed = Math.hypot(C.vx, C.vy);
  C.drifting = input.drift && speed > 120;
  C.boosting = input.boost && G.meter > .02;
  C.braking = input.brake;
  /* рыскание */
  const sf = clamp(speed / 160, 0, 1) * (1 - .2 * clamp(speed / BOOSTV, 0, 1));
  C.h += steer * (C.drifting ? DRIFT_STEER : STEER) * sf * dt;
  const fx = Math.cos(C.h), fy = Math.sin(C.h), nx = -fy, ny = fx;
  let vf = C.vx * fx + C.vy * fy, vl = C.vx * nx + C.vy * ny;
  /* газ автоматический; тормоз и дрифт гасят скорость */
  const target = input.brake ? BRAKEV : (C.boosting ? BOOSTV : MAXV);
  const acc = C.boosting ? BOOST_ACCEL : (input.brake ? BRAKE : ACCEL);
  if (vf < target) vf = Math.min(target, vf + acc * dt);
  else vf = Math.max(target, vf - (input.brake ? BRAKE : 180) * dt);
  vl *= Math.exp(-(C.drifting ? DRIFT_GRIP : GRIP) * dt);
  if (C.drifting) vf *= Math.exp(-.45 * dt);
  C.vx = fx * vf + nx * vl; C.vy = fy * vf + ny * vl;
  C.x += C.vx * dt; C.y += C.vy * dt;
  C.vf = vf; C.slip = Math.atan2(vl, Math.abs(vf) + 1);
  G.topSpeed = Math.max(G.topSpeed, Math.hypot(C.vx, C.vy));
  /* дрифт заряжает нитро */
  if (C.drifting && Math.abs(C.slip) > .12) {
    G.meter = Math.min(1, G.meter + Math.abs(C.slip) * (vf / 300) * .6 * dt);
    G.driftTime += dt;
    if (G.meter >= 1 && !G.meterAnnounced) { G.meterAnnounced = true; showObjective('<b>НИТРО готово</b> — жми E (или кнопку)', 3); }
  }
  if (G.meter < .95) G.meterAnnounced = false;
  if (C.boosting) {
    G.meter = Math.max(0, G.meter - dt * .45);
    if (!G.wasBoost) { SFX.boost(); addShake(3); }
    if (Math.random() < dt * 60) spawnP(C.x - fx * 24, C.y - fy * 24, 'boost', -fx * rnd(60, 160) + rnd(-30, 30), -fy * rnd(60, 160) + rnd(-30, 30));
  }
  G.wasBoost = C.boosting;
  audio.setSpeed(clamp(Math.hypot(C.vx, C.vy) / BOOSTV, 0, 1));
  audio.setDrift(C.drifting && Math.abs(C.slip) > .15);
  /* следы и дым */
  skidT -= dt; smokeT -= dt;
  const rx = C.x - fx * 14, ry = C.y - fy * 14;
  if (C.drifting && speed > 140) {
    if (skidT <= 0) {
      skidT = .025;
      for (const side of [-1, 1]) {
        const wx = rx + nx * 9 * side, wy = ry + ny * 9 * side;
        skids.push({ x1: wx - C.vx * .025, y1: wy - C.vy * .025, x2: wx, y2: wy, life: 3.5, max: 3.5 });
        if (skids.length > 700) skids.shift();
      }
    }
    if (smokeT <= 0) { smokeT = .04; spawnP(rx + rnd(-8, 8), ry + rnd(-8, 8), 'smoke', rnd(-25, 25) - C.vx * .1, rnd(-25, 25) - C.vy * .1); }
  }
  /* позиция на трассе: боковое смещение считается по нормали ТРАССЫ,
     иначе машина боком к дороге «не видит» своего падения */
  const idx = nearestIdx(), p = T.pts[idx];
  C.prevS = C.s; C.s = p.s;
  const pnx = -Math.sin(p.h), pny = Math.cos(p.h);
  const lat = (C.x - p.x) * pnx + (C.y - p.y) * pny;
  if (Math.abs(lat) > p.w + 6 && C.inv <= 0) { fallOff(); return; }
  /* барьеры */
  if (C.inv <= 0) for (const b of T.barriers) {
    const dx = C.x - b.x, dy = C.y - b.y, d = Math.hypot(dx, dy);
    if (d < CAR_R + BARRIER_R && d > .01) {
      const ux = dx / d, uy = dy / d;
      C.x = b.x + ux * (CAR_R + BARRIER_R); C.y = b.y + uy * (CAR_R + BARRIER_R);
      const dot = C.vx * ux + C.vy * uy;
      C.vx = (C.vx - 1.7 * dot * ux) * .45; C.vy = (C.vy - 1.7 * dot * uy) * .45;
      C.inv = .6; G.hits++;
      SFX.hit(); addShake(6); hurtFlash = .25;
      burst(b.x + ux * 20, b.y + uy * 20, 'debris', 8, 180);
      addFloater(C.x, C.y - 40, 'бам!', '#ffc233');
    }
  }
  C.inv -= dt;
  /* ворота */
  for (const g of T.gates) {
    if (g.passed) continue;
    if (C.prevS < g.s && C.s >= g.s && Math.abs(lat) < g.w + 20) {
      g.passed = true; G.gates++; G.timeLeft += T.spec.bonus;
      SFX.gate(); bump('chipGates');
      burst(g.x, g.y, 'ring', 12, 170);
      addFloater(g.x, g.y - 46, '+' + T.spec.bonus + 'с', '#2bff88');
      updateHUD();
      if (G.gates === T.gates.length) showObjective('Все ворота! <b>Финиш</b> впереди →', 4);
    }
  }
  /* финиш */
  if (C.s >= T.total - 50) {
    C.clearing = true; C.clearT = 1.15;
    SFX.finish(); addShake(3);
    burst(C.x, C.y, 'confetti', 40, 260);
    addFloater(C.x, C.y - 60, 'ФИНИШ!', '#ffc233');
    const stars = 1 + (G.falls === 0 ? 1 : 0) + (G.driftTime >= 5 ? 1 : 0);
    const prev = save.best[G.trackId];
    if (!prev || G.raceTime < prev.t) save.best[G.trackId] = { t: G.raceTime, s: Math.max(stars, prev ? prev.s : 0) };
    else prev.s = Math.max(prev.s, stars);
    persist();
    audio.setDrift(false);
  }
}

/* ---------------- fx update ---------------- */
function updateFx(dt) {
  tNow += dt;
  shake *= Math.exp(-dt * 7); if (shake < .05) shake = 0;
  hurtFlash = Math.max(0, hurtFlash - dt * 1.4);
  goFlash = Math.max(0, goFlash - dt);
  if (objTimer > 0) { objTimer -= dt; if (objTimer <= 0) $('objective').classList.remove('show'); }
  /* камера */
  if (T && C && ['countdown', 'play', 'pause', 'clear', 'over'].includes(G.state)) {
    const look = clamp(C.vf * .38, 0, 170);
    const tx = C.x + Math.cos(C.h) * look, ty = C.y + Math.sin(C.h) * look;
    const k = 1 - Math.exp(-dt * 5);
    cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  }
  /* attract-режим: призрачная машина едет по трассе сама */
  if ((G.state === 'title' || G.state === 'tracks') && T) {
    demoS = ((demoS + 300 * dt) % T.total + T.total) % T.total;
    const p = T.pts[clamp(Math.floor(demoS / DS), 0, T.pts.length - 1)];
    const nx = -Math.sin(p.h), ny = Math.cos(p.h);
    const off = Math.sin(tNow * .8) * p.w * .3;
    cam.x = lerp(cam.x, p.x + nx * off, 1 - Math.exp(-dt * 3));
    cam.y = lerp(cam.y, p.y + ny * off, 1 - Math.exp(-dt * 3));
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.type === 'confetti') { p.vx *= Math.exp(-dt * 1.2); p.vy *= Math.exp(-dt * 1.2); }
    else if (p.type === 'smoke') { p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 2); p.size += dt * 14; }
    else { p.vx *= Math.exp(-dt * 3); p.vy *= Math.exp(-dt * 3); }
  }
  for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.life -= dt * .9; f.y -= 44 * dt; if (f.life <= 0) floaters.splice(i, 1); }
  for (let i = skids.length - 1; i >= 0; i--) { skids[i].life -= dt; if (skids[i].life <= 0) skids.splice(i, 1); }
  if (G.state === 'play' || G.state === 'countdown') updateHUD();
}
function updateHUD() {
  if (!T || !C) return;
  $('hudTime').textContent = G.timeLeft.toFixed(1);
  $('chipTime').classList.toggle('low', G.timeLeft < 8 && G.state === 'play');
  $('hudSpeed').textContent = Math.round(Math.hypot(C.vx, C.vy) * KMH);
  $('hudGates').textContent = G.gates + '/' + T.gates.length;
  $('boostFill').style.width = (G.meter * 100).toFixed(1) + '%';
  $('boostMeter').classList.toggle('full', G.meter >= .99);
  $('driftTag').classList.toggle('on', C.drifting && Math.abs(C.slip) > .12);
}

/* ============================================================
   RENDER
   ============================================================ */
const glowCache = {};
function makeGlow(col) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  const gr = g.createRadialGradient(48, 48, 2, 48, 48, 46); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 96, 96); glowCache[col] = c; return c;
}
let voidDots = [];
function buildVoid() {
  voidDots = [];
  for (let i = 0; i < 70; i++) voidDots.push({ x: rnd(2400), y: rnd(2400), s: rnd(1, 2.6), c: Math.random() < .5 ? '#ff2bd6' : '#00f0ff', p: rnd(TAU) });
}
buildVoid();
function drawVoid() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#160833'); g.addColorStop(.6, '#0b0520'); g.addColorStop(1, '#050310');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  /* отблеск синтвейв-солнца сверху */
  const sg = ctx.createRadialGradient(VW * .5, -VH * .25, 10, VW * .5, -VH * .25, VH * .95);
  sg.addColorStop(0, 'rgba(255,43,214,.16)'); sg.addColorStop(1, 'rgba(255,43,214,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, VH);
  /* параллакс-сетка пустоты */
  const sp = 90, ox = ((-cam.x * .25) % sp + sp) % sp, oy = ((-cam.y * .25) % sp + sp) % sp;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox - sp; x < VW + sp; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, VH); }
  for (let y = oy - sp; y < VH + sp; y += sp) { ctx.moveTo(0, y); ctx.lineTo(VW, y); }
  ctx.strokeStyle = 'rgba(0,240,255,.09)'; ctx.stroke();
  const sp4 = sp * 4, ox4 = ((-cam.x * .25) % sp4 + sp4) % sp4, oy4 = ((-cam.y * .25) % sp4 + sp4) % sp4;
  ctx.beginPath();
  for (let x = ox4 - sp4; x < VW + sp4; x += sp4) { ctx.moveTo(x, 0); ctx.lineTo(x, VH); }
  for (let y = oy4 - sp4; y < VH + sp4; y += sp4) { ctx.moveTo(0, y); ctx.lineTo(VW, y); }
  ctx.strokeStyle = 'rgba(255,43,214,.08)'; ctx.stroke();
  /* огни города внизу */
  for (const d of voidDots) {
    const sx = ((d.x - cam.x * .5) % 2400 + 2400) % 2400 - 200;
    const sy = ((d.y - cam.y * .5) % 2400 + 2400) % 2400 - 200;
    if (sx < -10 || sx > VW + 10 || sy < -10 || sy > VH + 10) continue;
    ctx.globalAlpha = .25 + .25 * Math.sin(tNow * 1.5 + d.p);
    ctx.fillStyle = d.c; ctx.fillRect(sx, sy, d.s, d.s);
  }
  ctx.globalAlpha = 1;
}
function visibleRange() {
  const top = cam.y - VH * .75 - 260, bot = cam.y + VH * .55 + 260;
  let i0 = 0, i1 = T.pts.length - 1;
  while (i0 < i1 && T.pts[i0].y > bot) i0++;
  while (i1 > i0 && T.pts[i1].y < top) i1--;
  return [Math.max(0, i0 - 2), Math.min(T.pts.length - 1, i1 + 2)];
}
function drawPillars(i0, i1) {
  for (let i = i0; i <= i1; i++) {
    if (i % 30 !== 0) continue;
    const p = T.pts[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
    /* опоры видны за кромками дороги — иначе полотно их закрывает */
    for (const side of [1, -1]) {
      const ex = p.x + nx * p.w * side + side * 5, ey = p.y + ny * p.w * side;
      const g = ctx.createLinearGradient(0, ey, 0, ey + 150);
      g.addColorStop(0, 'rgba(46,18,92,.8)'); g.addColorStop(1, 'rgba(46,18,92,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ex - 7, ey, 14, 150);
      ctx.fillStyle = 'rgba(255,43,214,.22)';
      ctx.fillRect(ex - 11, ey + 22, 22, 3);
    }
  }
}
function drawRoad(i0, i1) {
  /* полотно */
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    const p = T.pts[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
    const x = p.x + nx * p.w, y = p.y + ny * p.w;
    i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let i = i1; i >= i0; i--) {
    const p = T.pts[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
    ctx.lineTo(p.x - nx * p.w, p.y - ny * p.w);
  }
  ctx.closePath();
  ctx.fillStyle = '#0a0618'; ctx.fill();
  /* поперечные швы эстакады */
  ctx.strokeStyle = 'rgba(120,140,255,.1)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    if (i % 10 !== 0) continue;
    const p = T.pts[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
    ctx.moveTo(p.x + nx * p.w, p.y + ny * p.w); ctx.lineTo(p.x - nx * p.w, p.y - ny * p.w);
  }
  ctx.stroke();
  /* неоновые кромки */
  ctx.lineWidth = 3; ctx.strokeStyle = '#ff2bd6';
  ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 14;
  for (const side of [1, -1]) {
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const p = T.pts[i], nx = -Math.sin(p.h), ny = Math.cos(p.h);
      const x = p.x + nx * p.w * side, y = p.y + ny * p.w * side;
      i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  /* пунктир по центру */
  ctx.strokeStyle = 'rgba(0,240,255,.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = i0; i < i1; i++) {
    if (i % 6 >= 3) continue;
    const a = T.pts[i], b = T.pts[i + 1];
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
}
function drawSkids() {
  ctx.lineCap = 'round'; ctx.lineWidth = 3.5;
  for (const s of skids) {
    ctx.strokeStyle = 'rgba(30,10,50,' + (s.life / s.max * .8).toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
}
function drawGate(p, col, label) {
  const nx = -Math.sin(p.h), ny = Math.cos(p.h), w = p.w + 12;
  ctx.strokeStyle = col; ctx.lineWidth = 5;
  ctx.shadowColor = col; ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(p.x + nx * w, p.y + ny * w); ctx.lineTo(p.x - nx * w, p.y - ny * w);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = col;
  for (const side of [1, -1]) {
    ctx.beginPath(); ctx.arc(p.x + nx * w * side, p.y + ny * w * side, 5, 0, TAU); ctx.fill();
  }
  if (label) {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.h + Math.PI / 2);
    ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = col; ctx.fillText(label, 0, -12);
    ctx.restore();
  }
}
function drawGates(i0, i1) {
  const s0 = T.pts[i0].s, s1 = T.pts[i1].s;
  if (s0 <= 100) drawGate(T.pts[0], 'rgba(255,43,214,.85)', 'START');
  for (const g of T.gates) {
    if (g.s < s0 - 100 || g.s > s1 + 100) continue;
    drawGate(g, g.passed ? 'rgba(43,255,136,.45)' : '#00f0ff', g.passed ? '' : 'CHECKPOINT');
    if (!g.passed) {
      /* шевроны перед воротами */
      const j = Math.max(0, g.idx - 16), q = T.pts[j];
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,240,255,.4)';
      for (const o of [0, 14]) {
        ctx.beginPath(); ctx.moveTo(-12, 8 + o); ctx.lineTo(0, -2 + o); ctx.lineTo(12, 8 + o);
        ctx.lineTo(12, 12 + o); ctx.lineTo(0, 2 + o); ctx.lineTo(-12, 12 + o); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  if (T.finish.s >= s0 - 100 && T.finish.s <= s1 + 100) {
    drawGate(T.finish, '#ffc233', 'FINISH');
    /* шахматная лента */
    const p = T.finish, nx = -Math.sin(p.h), ny = Math.cos(p.h);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.h + Math.PI / 2);
    for (let i = -Math.floor(p.w / 12); i < Math.floor(p.w / 12); i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.75)' : 'rgba(10,6,24,.9)';
      ctx.fillRect(i * 12, 6, 12, 7);
    }
    ctx.restore();
  }
}
function drawBarriers(i0, i1) {
  const s0 = T.pts[i0].s, s1 = T.pts[i1].s;
  for (const b of T.barriers) {
    if (b.s < s0 - 80 || b.s > s1 + 80) continue;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.h + Math.PI / 2);
    ctx.fillStyle = '#1c1030';
    ctx.fillRect(-22, -13, 44, 26);
    ctx.strokeStyle = '#ffc233'; ctx.lineWidth = 2;
    ctx.shadowColor = '#ffc233'; ctx.shadowBlur = 12;
    ctx.strokeRect(-22, -13, 44, 26);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,194,51,.65)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = -18; i < 20; i += 10) { ctx.moveTo(i, 12); ctx.lineTo(i + 8, -12); }
    ctx.stroke();
    ctx.fillStyle = Math.sin(tNow * 5 + b.s) > 0 ? '#ff3355' : '#5a1220';
    ctx.beginPath(); ctx.arc(0, -13, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'smoke') {
      ctx.fillStyle = p.col + (a * .3).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    } else if (p.type === 'confetti') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * .6);
      ctx.restore(); ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
}
function drawFloaters() {
  ctx.font = '700 16px Manrope, sans-serif'; ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,4,24,.85)';
    ctx.strokeText(f.txt, f.x, f.y);
    ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
function demoCar() {
  const p = T.pts[clamp(Math.floor(demoS / DS), 0, T.pts.length - 1)];
  const nx = -Math.sin(p.h), ny = Math.cos(p.h);
  const off = Math.sin(tNow * .8) * p.w * .3;
  return { x: p.x + nx * off, y: p.y + ny * off, h: p.h + Math.cos(tNow * .8) * .12,
    drifting: Math.abs(p.curv) > .004, boosting: false, braking: false, crashT: 0, inv: 0 };
}
function render() {
  ctx.setTransform(DPR * S, 0, 0, DPR * S, 0, 0);
  const shx = (Math.random() - .5) * shake, shy = (Math.random() - .5) * shake;
  drawVoid();
  if (!T) return;
  ctx.save();
  ctx.translate(VW / 2 - cam.x + shx, VH * .6 - cam.y + shy);
  const [i0, i1] = visibleRange();
  drawPillars(i0, i1);
  drawRoad(i0, i1);
  drawSkids();
  drawGates(i0, i1);
  drawBarriers(i0, i1);
  const car = (G.state === 'title' || G.state === 'tracks') ? demoCar() : C;
  if (car) drawCar(ctx, car, tNow);
  drawParticles();
  drawFloaters();
  ctx.restore();
  /* экранные эффекты */
  if (C && C.boosting && G.state === 'play') {
    ctx.strokeStyle = 'rgba(160,240,255,.22)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = rnd(TAU), r0 = Math.min(VW, VH) * .32, r1 = r0 + rnd(40, 160);
      ctx.moveTo(VW / 2 + Math.cos(a) * r0, VH / 2 + Math.sin(a) * r0);
      ctx.lineTo(VW / 2 + Math.cos(a) * r1, VH / 2 + Math.sin(a) * r1);
    }
    ctx.stroke();
  }
  if (G.state === 'countdown') {
    const n = Math.ceil(G.cd), frac = G.cd - Math.floor(G.cd);
    ctx.save();
    ctx.translate(VW / 2, VH * .42); ctx.scale(1 + frac * .25, 1 + frac * .25);
    ctx.font = '400 96px "Russo One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#fff'; ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }
  if (goFlash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(goFlash / .7, 0, 1);
    ctx.font = '400 84px "Russo One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 30;
    ctx.fillStyle = '#2bff88'; ctx.fillText('GO!', VW / 2, VH * .42);
    ctx.restore();
  }
  if (hurtFlash > 0) { ctx.fillStyle = 'rgba(255,51,85,' + (hurtFlash * .3).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
  if (G.state === 'play' && G.timeLeft < 8) {
    const a = .25 + .2 * Math.sin(tNow * 6);
    ctx.strokeStyle = 'rgba(255,51,85,' + a.toFixed(3) + ')'; ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, VW - 6, VH - 6);
  }
}

/* ============================================================
   UI / STATE MACHINE
   ============================================================ */
const SCREENS = { title: 'scr-title', tracks: 'scr-tracks', intro: 'scr-intro', pause: 'scr-pause', clear: 'scr-clear', over: 'scr-over' };
function setState(st) {
  G.state = st; document.body.dataset.state = st;
  for (const k in SCREENS) $(SCREENS[k]).classList.toggle('on', k === st);
  if (st !== 'play') { audio.engineStop(); audio.setDrift(false); }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
function primaryAction() {
  switch (G.state) {
    case 'title': $('btnPlay').click(); break;
    case 'intro': $('btnBegin').click(); break;
    case 'pause': resumeGame(); break;
    case 'clear': $('btnNext').click(); break;
    case 'over': $('btnRetry').click(); break;
  }
}
function pauseGame() {
  if (G.state !== 'play' && G.state !== 'countdown') return;
  $('pauseStats').innerHTML =
    statHTML('clock', 'осталось ' + G.timeLeft.toFixed(1) + 'с', '#00f0ff') +
    statHTML('gate', 'ворота ' + G.gates + '/' + T.gates.length, '#ff2bd6') +
    statHTML('speed', Math.round(G.topSpeed * KMH) + ' км/ч макс', '#ffc233');
  setState('pause');
}
function resumeGame() { SFX.click(); setState(G.cd > 0 && G.raceTime === 0 ? 'countdown' : 'play'); if (G.state === 'play') audio.engineStart(); }
function statHTML(icon, txt, col) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="COL" stroke-width="2.4"/><path d="M12 6.5V12l3.6 2.4" fill="none" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
    gate: '<path d="M4 20V8l8-5 8 5v12" fill="none" stroke="COL" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 12h16" stroke="COL" stroke-width="2.4"/>',
    speed: '<path d="M4 17a9 9 0 1 1 16 0" fill="none" stroke="COL" stroke-width="2.4"/><path d="M12 13l4-4" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
    road: '<path d="M6 21L10 3M18 21L14 3" fill="none" stroke="COL" stroke-width="2.4" stroke-linecap="round"/><path d="M12 6v3M12 13v3" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>',
    star: '<path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/>',
    drift: '<path d="M4 18c4 0 5-10 9-10 3 0 4 4 7 4" fill="none" stroke="COL" stroke-width="2.4" stroke-linecap="round"/>'
  };
  return '<div class="stat"><svg viewBox="0 0 24 24" fill="' + col + '">' + paths[icon].replaceAll('COL', col) + '</svg>' + txt + '</div>';
}
function showClear() {
  const stars = 1 + (G.falls === 0 ? 1 : 0) + (G.driftTime >= 5 ? 1 : 0);
  const earned = [true, G.falls === 0, G.driftTime >= 5];
  const labels = ['финиш', 'без падений', 'дрифт-мастер'];
  const cont = $('clearStars'); cont.innerHTML = '';
  earned.forEach((e, i) => {
    const d = document.createElement('div'); d.className = 'bstar' + (e ? ' earned' : '');
    d.innerHTML = '<svg viewBox="0 0 24 24" style="animation-delay:' + (0.25 + i * .3) + 's"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/></svg><span>' + labels[i] + '</span>';
    cont.appendChild(d);
    if (e) setTimeout(() => { if (G.state === 'clear') SFX.star(i); }, (0.25 + i * .3) * 1000);
  });
  $('clearStats').innerHTML =
    statHTML('clock', fmtTime(G.raceTime), '#00f0ff') +
    statHTML('speed', Math.round(G.topSpeed * KMH) + ' км/ч', '#ffc233') +
    statHTML('drift', 'дрифт ' + G.driftTime.toFixed(1) + 'с', '#ff2bd6') +
    statHTML('gate', 'падений ' + G.falls, '#ff3355');
  const best = save.best[G.trackId];
  $('clearRecord').textContent = best ? 'рекорд трассы: ' + fmtTime(best.t) : '';
  const i = PRESET_ORDER.indexOf(G.trackId);
  $('btnNext').textContent = G.trackId === 'random' ? 'Новая случайная ▶' : (i < 2 ? 'Дальше ▶' : 'К трассам ★');
  setState('clear');
}
function showOver() {
  SFX.over();
  const pct = T ? Math.round(C.s / T.total * 100) : 0;
  $('overStats').innerHTML =
    statHTML('road', 'пройдено ' + pct + '%', '#00f0ff') +
    statHTML('gate', 'ворота ' + G.gates + '/' + T.gates.length, '#ff2bd6') +
    statHTML('speed', Math.round(G.topSpeed * KMH) + ' км/ч макс', '#ffc233');
  setState('over');
}
function showTracks() {
  const grid = $('trkGrid'); grid.innerHTML = '';
  PRESET_ORDER.forEach(id => {
    const spec = PRESETS[id], best = save.best[id];
    const len = Math.round(generateTrack(20261125, id).total / 10);
    const c = document.createElement('button'); c.className = 'trkcard';
    c.style.setProperty('--tc', spec.diffC);
    let stars = '';
    for (let s = 0; s < 3; s++) stars += '<svg viewBox="0 0 24 24" class="' + (best && s < best.s ? 'e' : '') + '"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"/></svg>';
    c.innerHTML = '<span class="diff">' + spec.diff + '</span><div class="nm">' + spec.name + '</div>' +
      '<div class="meta">' + len + ' м · ' + spec.gates + ' ворот</div>' +
      '<div class="stars">' + stars + '</div>' +
      '<div class="best">' + (best ? fmtTime(best.t) : 'рекорда нет') + '</div>';
    c.addEventListener('click', () => { SFX.click(); startIntro(id, 20261125); });
    grid.appendChild(c);
  });
  const c = document.createElement('button'); c.className = 'trkcard random';
  c.innerHTML = '<span class="diff">ГЕНЕРАТОР</span><div class="nm">СЛУЧАЙНАЯ</div>' +
    '<div class="meta">новая трасса каждый заезд</div><div class="stars"></div><div class="best">seed × удача</div>';
  c.addEventListener('click', () => { SFX.click(); startIntro('random', (Math.random() * 1e9) | 0); });
  grid.appendChild(c);
  setState('tracks');
}

/* buttons */
$('btnPlay').addEventListener('click', () => { SFX.click(); startIntro(save.last && (PRESETS[save.last] || save.last === 'random') ? save.last : 'boulevard', save.last === 'random' ? (Math.random() * 1e9) | 0 : 20261125); });
$('btnTracks').addEventListener('click', () => { SFX.click(); showTracks(); });
$('btnTrkBack').addEventListener('click', () => { SFX.click(); setState('title'); });
$('btnBegin').addEventListener('click', () => { SFX.click(); startRace(G.pendingTrack, G.pendingSeed); });
$('btnResume').addEventListener('click', resumeGame);
$('btnPauseRetry').addEventListener('click', () => { SFX.click(); retryRace(); });
$('btnPauseTracks').addEventListener('click', () => { SFX.click(); showTracks(); });
$('btnNext').addEventListener('click', () => {
  SFX.click();
  if (G.trackId === 'random') startIntro('random', (Math.random() * 1e9) | 0);
  else { const i = PRESET_ORDER.indexOf(G.trackId); if (i < 2) startIntro(PRESET_ORDER[i + 1], 20261125); else showTracks(); }
});
$('btnClearRetry').addEventListener('click', () => { SFX.click(); retryRace(); });
$('btnClearTracks').addEventListener('click', () => { SFX.click(); showTracks(); });
$('btnRetry').addEventListener('click', () => { SFX.click(); retryRace(); });
$('btnOverTracks').addEventListener('click', () => { SFX.click(); showTracks(); });
$('btnPause').addEventListener('click', () => { SFX.click(); pauseGame(); });
$('btnRestart').addEventListener('click', () => { SFX.click(); retryRace(); });
$('btnSound').addEventListener('click', () => { initAudio(); setMuted(!audio.muted); if (!audio.muted) SFX.click(); });
let resetArmed = false;
$('btnReset').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true; $('btnReset').textContent = 'точно сбросить? нажми ещё раз';
    setTimeout(() => { resetArmed = false; $('btnReset').textContent = 'сбросить рекорды'; }, 2500); return;
  }
  save = { best: {}, snd: audio.muted ? 0 : 1, last: 'boulevard' }; persist();
  resetArmed = false; $('btnReset').textContent = 'сбросить рекорды'; SFX.hit(); showTracks();
});
setMuted(audio.muted);

/* стартовая трасса для attract-режима */
T = generateTrack(20261125, 'boulevard');
cam.x = T.start.x; cam.y = T.start.y;

/* ============================================================
   MAIN LOOP
   ============================================================ */
let last = performance.now(), acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  let dt = clamp((ts - last) / 1000, 0, .05); last = ts;
  if (G.state === 'play') { acc += dt; while (acc >= STEP) { updatePlay(STEP); acc -= STEP; if (G.state !== 'play') { acc = 0; break; } } }
  else if (G.state === 'countdown') updateCountdown(dt);
  else acc = 0;
  updateFx(dt);
  render();
}
requestAnimationFrame(frame);

})();