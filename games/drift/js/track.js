window.Drift = window.Drift || {};
(() => {
'use strict';
/* Процедурные трассы: грамматика ритма собирает фразы (повороты, шпильки,
   шиканы, мосты), а интегратор прокладывает центральную линию эстакады.
   Курс ограничен ±MAX_DEV от «вверх», поэтому y монотонно убывает и трасса
   никогда не пересекает саму себя. */

const DS = 10;                 // шаг сэмплов центральной линии, px
const MAX_DEV = 1.25;          // предел отклонения курса от «вверх», рад
const UP = -Math.PI / 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967295;
  };
}

const PRESETS = {
  boulevard: {
    id: 'boulevard', name: 'НЕОН-БУЛЬВАР', diff: 'ЛЕГКО', diffC: '#2bff88',
    half: 96, len: 7000, gates: 5, start: 30, bonus: 10, barriers: 6,
    hairpin: 0.08, chicane: 0.14, bridge: 0.07,
    story: 'Широкая эстакада над спящим городом. Плавные дуги, длинные прямые — здесь дрифт учится заряжать нитро.'
  },
  serpentine: {
    id: 'serpentine', name: 'СЕРПАНТИН', diff: 'СРЕДНЕ', diffC: '#ffc233',
    half: 86, len: 8400, gates: 6, start: 28, bonus: 10, barriers: 9,
    hairpin: 0.26, chicane: 0.28, bridge: 0.14,
    story: 'Горный серпантин в неоне: S-связки, шпильки и узкие мосты над пустотой. Тормози перед шпилькой, дрифтуй через неё.'
  },
  chaos: {
    id: 'chaos', name: 'ХАЙВЕЙ-ХАОС', diff: 'СЛОЖНО', diffC: '#ff3355',
    half: 78, len: 9800, gates: 7, start: 26, bonus: 9, barriers: 12,
    hairpin: 0.4, chicane: 0.4, bridge: 0.2,
    story: 'Ночной хайвей, который строил безумный генератор. Шиканы, двойные шпильки, мосты в полполосы — только нитро и полный контроль.'
  }
};

function randomSpec(rng) {
  const d = rng();
  const half = 78 + Math.round(d * 20);
  return {
    id: 'random', name: 'СЛУЧАЙНАЯ ТРАССА', diff: d < .33 ? 'ЛЕГКО' : d < .66 ? 'СРЕДНЕ' : 'СЛОЖНО',
    diffC: d < .33 ? '#2bff88' : d < .66 ? '#ffc233' : '#ff3355',
    half, len: 6800 + Math.round(rng() * 3200), gates: 5 + Math.floor(rng() * 3),
    start: 28, bonus: 10, barriers: 6 + Math.floor(rng() * 7),
    hairpin: .1 + d * .35, chicane: .15 + d * .3, bridge: .06 + d * .18,
    story: 'Генератор собрал эту эстакаду по грамматике ритма за миллисекунды. Такой трассы больше не будет — успей проехать.'
  };
}

/* Фразы грамматики: каждая — список сегментов {len, curv, half?}. */
function buildPhrases(rng, spec) {
  const phrases = [];
  let total = 420;
  phrases.push([{ len: 420, curv: 0 }]);
  while (total < spec.len) {
    const r = rng();
    let ph;
    if (r < spec.hairpin) {
      const dir = rng() < .5 ? -1 : 1;
      const ang = 1.7 + rng() * .8;
      const curv = dir * .0085;
      ph = [{ len: ang / .0085, curv }, { len: 220 + rng() * 180, curv: 0 }];
    } else if (r < spec.hairpin + spec.chicane) {
      const dir = rng() < .5 ? -1 : 1;
      const c = .0045 + rng() * .0025;
      ph = [];
      for (let i = 0; i < 3; i++) ph.push({ len: 150 + rng() * 70, curv: dir * c * (i % 2 ? -1 : 1) });
      ph.push({ len: 180 + rng() * 120, curv: 0 });
    } else if (r < spec.hairpin + spec.chicane + spec.bridge) {
      ph = [{ len: 380 + rng() * 260, curv: 0, half: spec.half * .62 }, { len: 180, curv: 0 }];
    } else if (r < spec.hairpin + spec.chicane + spec.bridge + .34) {
      const dir = rng() < .5 ? -1 : 1;
      const c = .0035 + rng() * .0025, l = 380 + rng() * 260;
      ph = [{ len: l, curv: dir * c }, { len: l, curv: -dir * c }, { len: 200 + rng() * 150, curv: 0 }];
    } else if (rng() < .55) {
      const dir = rng() < .5 ? -1 : 1;
      ph = [{ len: 420 + rng() * 320, curv: dir * (.0022 + rng() * .002) }];
    } else {
      ph = [{ len: 300 + rng() * 280, curv: 0 }];
    }
    phrases.push(ph);
    for (const s of ph) total += s.len;
  }
  phrases.push([{ len: 460, curv: 0 }]);
  return phrases;
}

function generateTrack(seed, presetId) {
  const rng = mulberry32(seed);
  const spec = presetId && PRESETS[presetId] ? PRESETS[presetId] : randomSpec(rng);

  /* Интеграция с ограничением курса и автокоррекцией после каждой фразы. */
  const segs = [];
  let h = UP, total = 0;
  const add = (len, curv, half) => {
    /* длина кратна шагу сэмплов, иначе интегратор выходит за предел курса */
    const real = Math.max(1, Math.round(len / DS)) * DS;
    const dev = h - UP;
    if (curv > 0) curv = Math.min(curv, Math.max(0, MAX_DEV - dev) / real);
    else if (curv < 0) curv = Math.max(curv, Math.min(0, -MAX_DEV - dev) / real);
    segs.push({ len: real, curv, half: half == null ? spec.half : half });
    h += curv * real; total += real;
  };
  for (const ph of buildPhrases(rng, spec)) {
    for (const s of ph) add(s.len, s.curv, s.half);
    const dev = h - UP;
    if (Math.abs(dev) > .7) add(Math.abs(dev) / .0035, -Math.sign(dev) * .0035);
  }

  /* Сэмплы центральной линии. */
  const pts = [];
  let x = 0, y = 0, hh = UP, s = 0;
  pts.push({ x, y, h: hh, s: 0, w: segs[0].half, curv: 0 });
  for (const seg of segs) {
    const steps = Math.max(1, Math.round(seg.len / DS));
    for (let i = 0; i < steps; i++) {
      hh += seg.curv * DS;
      x += Math.cos(hh) * DS; y += Math.sin(hh) * DS; s += DS;
      pts.push({ x, y, h: hh, s, w: seg.half, curv: seg.curv });
    }
  }
  total = pts[pts.length - 1].s;

  /* Сглаживание ширины на стыках сегментов (окно 180 px). */
  const W = 18;
  const raw = pts.map(p => p.w);
  for (let i = 0; i < pts.length; i++) {
    let sum = 0, n = 0;
    for (let k = -W; k <= W; k++) {
      const j = i + k;
      if (j >= 0 && j < pts.length) { sum += raw[j]; n++; }
    }
    pts[i].w = sum / n;
  }

  /* Ворота: равномерно по дистанции, на максимально прямых участках. */
  const gates = [];
  for (let i = 1; i <= spec.gates; i++) {
    const target = total * i / (spec.gates + 1);
    let best = Math.round(target / DS);
    for (let k = -30; k <= 30; k++) {
      const j = Math.round(target / DS) + k;
      if (j > 40 && j < pts.length - 40 && Math.abs(pts[j].curv) < Math.abs(pts[best].curv)) best = j;
    }
    const p = pts[best];
    gates.push({ i, idx: best, s: p.s, x: p.x, y: p.y, h: p.h, w: p.w, passed: false });
  }

  /* Неоновые барьеры: только на широких прямых, вдали от ворот и краёв. */
  const barriers = [];
  let tries = 0;
  while (barriers.length < spec.barriers && tries++ < 400) {
    const j = 60 + Math.floor(rng() * (pts.length - 120));
    const p = pts[j];
    if (p.w < spec.half * .9 || Math.abs(p.curv) > .002) continue;
    if (p.s < 600 || p.s > total - 500) continue;
    if (gates.some(g => Math.abs(g.s - p.s) < 280)) continue;
    if (barriers.some(b => Math.abs(b.s - p.s) < 420)) continue;
    const off = (rng() * 2 - 1) * (p.w - 46);
    const nx = -Math.sin(p.h), ny = Math.cos(p.h);
    barriers.push({ idx: j, s: p.s, x: p.x + nx * off, y: p.y + ny * off, h: p.h });
  }

  const last = pts[pts.length - 1];
  return {
    seed, spec, pts, total, gates, barriers,
    start: { x: pts[0].x, y: pts[0].y, h: pts[0].h },
    finish: { x: last.x, y: last.y, h: last.h, s: last.s }
  };
}

Object.assign(window.Drift, { DS, PRESETS, mulberry32, generateTrack });
})();