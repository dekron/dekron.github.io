// Run the real game update loop with a minimal browser stub; no game physics is reimplemented here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameRoot = path.join(__dirname, '..');

function createGame() {
  const gradient = { addColorStop() {} };
  const canvas = new Proxy({}, { get(target, key) {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'setTransform') return (...a) => { target.__transform = a; };
    if (!(key in target)) target[key] = () => {};
    return target[key];
  }});
  function element() {
    return { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} },
      dataset: {}, addEventListener() {}, appendChild() {}, getContext: () => canvas,
      focus() {}, blur() {}, textContent: '', innerHTML: '' };
  }
  const elements = new Map();
  const document = { body: element(), hidden: false, addEventListener() {}, createElement: () => element(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, activeElement: null };
  const storage = new Map();
  const context = { document, console, Math, Float32Array, Set, performance: { now: () => 0 },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {},
    matchMedia: () => ({ matches: false }), requestAnimationFrame() {}, setTimeout() {}, setInterval() {} };
  context.window = context;
  vm.createContext(context);
  for (const name of ['track.js', 'audio.js', 'car.js']) {
    vm.runInContext(fs.readFileSync(path.join(gameRoot, 'js', name), 'utf8'), context, { filename: name });
  }
  let source = fs.readFileSync(path.join(gameRoot, 'js', 'game.js'), 'utf8');
  const end = source.lastIndexOf('})();');
  assert.notEqual(end, -1, 'game wrapper not found');
  // Expose the existing game state only inside this test VM.
  source = source.slice(0, end) + `
    window.testGame = {
      load(trackId, seed) { startRace(trackId, seed); G.cd = 0; setState('play'); },
      inputs(o) { Object.assign(input, o); },
      step() { updatePlay(STEP); },
      renderStep() { updatePlay(STEP); updateFx(STEP); render(); },
      track() { return T; },
      place(idx, lat = 0) {
        const p = T.pts[idx], nx = -Math.sin(p.h), ny = Math.cos(p.h);
        C.x = p.x + nx * lat; C.y = p.y + ny * lat; C.h = p.h;
        C.nearIdx = idx; C.s = p.s; C.prevS = p.s; C.inv = 0; C.crashT = 0;
      },
      setSpeed(v) { C.vx = Math.cos(C.h) * v; C.vy = Math.sin(C.h) * v; },
      setHeading(h) { C.h = h; },
      transform() { return ctx.__transform; },
      setTime(t) { G.timeLeft = t; },
      setMeter(m) { G.meter = m; },
      state() { return { x: C.x, y: C.y, h: C.h, speed: Math.hypot(C.vx, C.vy), s: C.s,
        meter: G.meter, timeLeft: G.timeLeft, falls: G.falls, hits: G.hits, gates: G.gates,
        drifting: C.drifting, boosting: C.boosting, clearing: C.clearing, crashT: C.crashT,
        state: G.state, driftTime: G.driftTime, slip: C.slip, inv: C.inv }; }
    };\n` + source.slice(end);
  vm.runInContext(source, context, { filename: 'game.js' });
  return context.testGame;
}

/* ---------------- track generator ---------------- */

test('track: same seed gives identical track, different seed gives different track', () => {
  const game = createGame();
  game.load('serpentine', 777);
  const a = JSON.stringify(game.track().pts);
  game.load('serpentine', 777);
  const b = JSON.stringify(game.track().pts);
  game.load('serpentine', 778);
  const c = JSON.stringify(game.track().pts);
  assert.equal(a, b, 'same seed must reproduce the track');
  assert.notEqual(a, c, 'different seed must change the track');
});

test('track: every preset and 20 random seeds produce a valid elevated road', () => {
  const game = createGame();
  const cases = [['boulevard', 1], ['serpentine', 2], ['chaos', 3]];
  for (let i = 0; i < 20; i++) cases.push(['random', 1000 + i * 37]);
  for (const [id, seed] of cases) {
    game.load(id, seed);
    const T = game.track();
    assert.ok(T.total > 4000, `${id}/${seed}: track too short (${T.total})`);
    assert.equal(T.gates.length, T.spec.gates, `${id}/${seed}: gate count`);
    let prevS = -1;
    for (const g of T.gates) {
      assert.ok(g.s > prevS && g.s < T.total, `${id}/${seed}: gate order`);
      assert.ok(g.w > 40, `${id}/${seed}: gate on narrow road`);
      prevS = g.s;
    }
    for (let i = 1; i < T.pts.length; i++) {
      assert.ok(T.pts[i].y < T.pts[i - 1].y, `${id}/${seed}: y must decrease monotonically (no self-crossing) at ${i}`);
      assert.ok(Math.abs(T.pts[i].h + Math.PI / 2) <= 1.25 + 1e-9, `${id}/${seed}: heading left the safe cone at ${i}`);
    }
    for (const b of T.barriers) {
      const p = T.pts[b.idx];
      const lat = Math.abs((b.x - p.x) * -Math.sin(p.h) + (b.y - p.y) * Math.cos(p.h));
      assert.ok(lat < p.w - 20, `${id}/${seed}: barrier blocks the whole road`);
    }
  }
});

test('track: 20 procedural tracks generate well under 2 seconds', () => {
  const game = createGame();
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) game.load('random', 500 + i);
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, `20 tracks took ${ms} ms`);
});

/* ---------------- car physics ---------------- */

test('car: auto-throttle accelerates from standstill and steering turns the car', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(5);
  for (let i = 0; i < 120; i++) game.step();
  const s1 = game.state();
  assert.ok(s1.speed > 200, `auto-throttle did not accelerate: ${JSON.stringify(s1)}`);
  const h0 = s1.h;
  game.inputs({ r: true });
  for (let i = 0; i < 30; i++) game.step();
  const s2 = game.state();
  assert.ok(s2.h > h0 + .2, `steering right must increase heading: ${h0} -> ${s2.h}`);
  assert.equal(s2.falls, 0, 'car fell off during a normal maneuver');
});

test('drift: holding drift through a turn builds slip and charges nitro', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(20);
  game.setSpeed(380);
  game.inputs({ drift: true, r: true });
  for (let i = 0; i < 40; i++) game.step();
  const s = game.state();
  assert.ok(s.drifting, 'drift must be active at speed');
  assert.ok(Math.abs(s.slip) > .1, `no slip angle while drifting: ${JSON.stringify(s)}`);
  assert.ok(s.meter > .05, `drift did not charge nitro: ${JSON.stringify(s)}`);
  assert.ok(s.driftTime > .2, 'drift time not counted');
  assert.equal(s.falls, 0);
});

test('drift: grip driving without drift key never charges nitro', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(20);
  game.setSpeed(380);
  game.inputs({ r: true });
  for (let i = 0; i < 40; i++) game.step();
  const s = game.state();
  assert.equal(s.meter, 0, 'nitro must only charge while drifting');
  assert.ok(Math.abs(s.slip) < .35, `grip driving slides too much: ${JSON.stringify(s)}`);
});

test('boost: nitro raises the speed ceiling and drains the meter', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(5);
  game.setSpeed(430);
  game.setMeter(1);
  game.inputs({ boost: true });
  for (let i = 0; i < 60; i++) game.step();
  const s = game.state();
  assert.ok(s.boosting, 'boost must be active with a full meter');
  assert.ok(s.speed > 550, `boost did not raise speed: ${JSON.stringify(s)}`);
  assert.ok(s.meter < 1, 'boost must drain the meter');
  assert.equal(s.falls, 0);
});

test('edge: leaving the road causes a fall and respawn at the start', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(100, 200);
  game.step();
  const s1 = game.state();
  assert.ok(s1.crashT > 0, 'off-road must trigger a fall');
  assert.equal(s1.falls, 1);
  for (let i = 0; i < 140; i++) game.step();
  const s2 = game.state();
  assert.equal(s2.crashT, 0, 'car must respawn after the fall animation');
  assert.ok(s2.s < 60, `respawn must return to the start: ${JSON.stringify(s2)}`);
  assert.ok(s2.inv > 0, 'respawn must grant brief invulnerability');
});

test('edge: car sideways to the road still registers the fall', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(100);
  game.setHeading(game.state().h + Math.PI / 2);
  game.setSpeed(400);
  for (let i = 0; i < 60; i++) game.step();
  const s = game.state();
  assert.ok(s.falls >= 1, `sideways car must fall off the road: ${JSON.stringify(s)}`);
});

test('edge: respawn happens at the last passed checkpoint', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  const g = game.track().gates[1];
  game.place(g.idx - 4);
  game.setSpeed(400);
  for (let i = 0; i < 30; i++) game.step();
  assert.equal(game.state().gates, 1, 'the second gate must be passed');
  game.place(g.idx + 10, 250);
  game.step();
  for (let i = 0; i < 140; i++) game.step();
  const s = game.state();
  assert.ok(Math.abs(s.s - g.s) < 30, `respawn must use the last checkpoint: ${JSON.stringify(s)}`);
});

test('gates: passing a checkpoint adds its time bonus', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  const g = game.track().gates[0];
  game.place(g.idx - 4);
  game.setSpeed(400);
  const before = game.state().timeLeft;
  for (let i = 0; i < 30; i++) game.step();
  const s = game.state();
  assert.equal(s.gates, 1, 'gate must be counted');
  assert.ok(s.timeLeft > before - 1 + game.track().spec.bonus - .5,
    `bonus must extend the timer: ${before} -> ${s.timeLeft}`);
});

test('barrier: hitting a neon block bounces and slows the car', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  const T = game.track();
  assert.ok(T.barriers.length > 0, 'boulevard must have barriers');
  const b = T.barriers[0], p = T.pts[b.idx];
  const lat = (b.x - p.x) * -Math.sin(p.h) + (b.y - p.y) * Math.cos(p.h);
  game.place(b.idx - 5, lat);
  game.setSpeed(400);
  for (let i = 0; i < 20; i++) game.step();
  const s = game.state();
  assert.ok(s.hits >= 1, `barrier must register a hit: ${JSON.stringify(s)}`);
  assert.ok(s.speed < 300, `barrier must slow the car: ${JSON.stringify(s)}`);
});

test('finish: crossing the line starts the clear sequence', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  const T = game.track();
  game.place(T.pts.length - 8);
  game.setSpeed(300);
  for (let i = 0; i < 30; i++) game.step();
  const s = game.state();
  assert.ok(s.clearing, 'finish must start the clear sequence');
  assert.equal(s.state, 'play');
});

test('timer: running out of time ends the race', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(5);
  game.setTime(.05);
  for (let i = 0; i < 10; i++) game.step();
  assert.equal(game.state().state, 'over');
});

test('render: world is drawn at viewport scale, not raw canvas pixels', () => {
  const game = createGame();
  game.load('boulevard', 20261125);
  game.place(5);
  game.renderStep();
  const tr = game.transform();
  const expect = Math.min(720 / 620, 1280 / 900);
  assert.ok(tr, 'setTransform must be called every frame');
  assert.ok(Math.abs(tr[0] - expect) < 1e-9 && Math.abs(tr[3] - expect) < 1e-9,
    `world scale must match the viewport: ${JSON.stringify(tr)}`);
});

test('render: play frames render without errors while drifting', () => {
  const game = createGame();
  game.load('chaos', 99);
  game.place(5);
  game.setSpeed(380);
  game.inputs({ drift: true, r: true });
  for (let i = 0; i < 30; i++) game.renderStep();
  assert.ok(game.state().meter > 0);
});