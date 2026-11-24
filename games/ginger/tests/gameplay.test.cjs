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
  for (const name of ['levels.js', 'audio.js', 'cat.js']) {
    vm.runInContext(fs.readFileSync(path.join(gameRoot, 'js', name), 'utf8'), context, { filename: name });
  }
  let source = fs.readFileSync(path.join(gameRoot, 'js/game.js'), 'utf8');
  const end = source.lastIndexOf('})();');
  assert.notEqual(end, -1, 'game wrapper not found');
  // Expose the existing game state only inside this test VM.
  source = source.slice(0, end) + `
    window.testGame = {
      start(level, x, velocity = 0, groundRow = 12) {
        G.level = level; loadLevel(level); setState('play');
        P.x = x * T; P.y = groundRow * T - P.h / 2 - .01; P.vx = velocity;
        P.vy = 0; P.grounded = true; input.r = true; input.l = false;
        input.jumpHeld = false; input.jbuf = 0;
      },
      jump() { input.jumpHeld = true; input.jbuf = .13; },
      releaseJump() { input.jumpHeld = false; },
      direction(value) { input.r = value > 0; input.l = value < 0; P.vx = value * 275; },
      step() { updatePlay(STEP); },
      renderStep() { updatePlay(STEP); updateFx(STEP); renderWorld(); },
      state() { return { x: P.x / T, bottom: P.y + P.h / 2, vy: P.vy,
        grounded: P.grounded, deaths: G.deaths, clearing: P.clearing, screenY: P.y - cam.y + VH / 2, viewportHeight: VH }; }
    };\n` + source.slice(end);
  vm.runInContext(source, context, { filename: 'game.js' });
  return context.testGame;
}

function runToFinish(game, jumpAt, maxSteps = 600) {
  let jumped = false;
  for (let i = 0; i < maxSteps; i++) {
    let state = game.state();
    if (!jumped && state.grounded && state.x >= jumpAt) { game.jump(); jumped = true; }
    game.step(); state = game.state();
    if (state.deaths) return { success: false, jumped, state };
    if (state.clearing) return { success: true, jumped, state };
  }
  return { success: false, jumped, state: game.state() };
}

test('level 4: jump across the last spikes and reach the basket', () => {
  for (const jumpAt of [72.9, 73.1, 73.3]) {
    const game = createGame();
    game.start(3, 71, 275);
    const result = runToFinish(game, jumpAt);
    assert.ok(result.success, `jump at x=${jumpAt}: ${JSON.stringify(result)}`);
  }
});

test('level 2: spring reaches the platform without holding jump, then crosses the water', () => {
  for (const speed of [0, 275]) {
    const game = createGame(); game.start(1, 37.5, speed);
    let landed = false, jumped = false, crossed = false;
    for (let i = 0; i < 600; i++) {
      let p = game.state();
      if (p.grounded && p.x >= 40 && p.x < 43 && Math.abs(p.bottom - 336) < 1) landed = true;
      if (landed && !jumped && p.grounded && p.x > 42.4) { game.jump(); jumped = true; }
      game.step(); p = game.state();
      if (p.deaths) break;
      if (p.x > 47.2 && p.grounded && p.bottom > 528) { crossed = true; break; }
    }
    assert.ok(landed && jumped && crossed, `speed=${speed}: ${JSON.stringify(game.state())}`);
  }
});


test('level 6: jump across the second puddle without losing a life', () => {
  for (const jumpAt of [17.9, 18.1, 18.3]) {
    const game = createGame(); game.start(5, 16.5, 275, 11);
    let jumped = false, crossed = false;
    for (let i = 0; i < 360; i++) {
      let p = game.state();
      if (!jumped && p.grounded && p.x >= jumpAt) { game.jump(); jumped = true; }
      game.step(); p = game.state();
      if (p.deaths) break;
      if (p.x > 22.5 && p.grounded && Math.abs(p.bottom - 11 * 48) < 1) { crossed = true; break; }
    }
    assert.ok(jumped && crossed, `jump at x=${jumpAt}: ${JSON.stringify(game.state())}`);
  }
});

test('level 6: jump across the puddle after the checkpoint without losing a life', () => {
  for (const jumpAt of [64.9, 65.1, 65.3]) {
    const game = createGame(); game.start(5, 63.5, 275, 8);
    let jumped = false, crossed = false;
    for (let i = 0; i < 360; i++) {
      let p = game.state();
      if (!jumped && p.grounded && p.x >= jumpAt) { game.jump(); jumped = true; }
      game.step(); p = game.state();
      if (p.deaths) break;
      if (p.x > 68.5 && p.grounded && Math.abs(p.bottom - 8 * 48) < 1) { crossed = true; break; }
    }
    assert.ok(jumped && crossed, `jump at x=${jumpAt}: ${JSON.stringify(game.state())}`);
  }
});


test('level 7: basket cannot be collected through the floor from below', () => {
  const game = createGame(); game.start(6, 43.5, 0, 12);
  game.direction(0); game.step();
  assert.equal(game.state().clearing, false, 'basket should not activate beneath its platform');
});

test('level 7: basket activates when approached on its platform from either side', () => {
  for (const [startX, direction] of [[42, 1], [45, -1]]) {
    const game = createGame(); game.start(6, startX, direction * 275, 3); game.direction(direction);
    for (let i = 0; i < 60 && !game.state().clearing; i++) game.step();
    assert.equal(game.state().clearing, true, `approach from x=${startX}: ${JSON.stringify(game.state())}`);
  }
});

test('level 7: climb past the second platform toward the third', () => {
  const game = createGame(); game.start(6, 12, 275, 10);
  let firstJump = false, reachedSecond = false, secondJump = false, reachedThird = false;
  for (let i = 0; i < 600; i++) {
    let p = game.state();
    if (!firstJump && p.grounded && p.x >= 13.5) { game.jump(); firstJump = true; }
    if (firstJump && !reachedSecond && p.grounded && p.x >= 16 && Math.abs(p.bottom - 8 * 48) < 1) {
      reachedSecond = true; game.releaseJump();
    }
    if (reachedSecond && !secondJump && p.grounded && p.x >= 19.25) { game.jump(); secondJump = true; }
    game.step(); p = game.state();
    if (p.deaths) break;
    if (secondJump && p.grounded && p.x >= 22 && Math.abs(p.bottom - 6 * 48) < 1) { reachedThird = true; break; }
  }
  assert.ok(firstJump && reachedSecond && secondJump && reachedThird, JSON.stringify(game.state()));
});

test('all levels: basket remains reachable at platform height', () => {
  const goals = [[66, 12], [74, 12], [83, 12], [80, 12], [92, 9], [88, 10], [43, 3], [95, 11]];
  for (const [level, [goalX, groundRow]] of goals.entries()) {
    const game = createGame(); game.start(level, goalX, 0, groundRow); game.direction(0); game.step();
    assert.equal(game.state().clearing, true, `level ${level + 1}: ${JSON.stringify(game.state())}`);
  }
});


test('level 7: jumping above the map renders every frame and lands safely', () => {
  const game = createGame(); game.start(6, 35.5, 0, 2); game.direction(0); game.jump();
  let aboveMap = false, landed = false;
  for (let i = 0; i < 180; i++) {
    game.renderStep();
    const p = game.state();
    if (p.bottom < 0) {
      aboveMap = true;
      assert.ok(p.screenY >= 0 && p.screenY <= p.viewportHeight, `player left the viewport: ${JSON.stringify(p)}`);
    }
    if (aboveMap && p.grounded && Math.abs(p.bottom - 2 * 48) < 1) { landed = true; break; }
  }
  assert.ok(aboveMap && landed, `player did not complete the high jump: ${JSON.stringify(game.state())}`);
});
