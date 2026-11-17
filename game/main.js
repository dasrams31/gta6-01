// main.js — NEON BAY: a complete open-world crime game in the spirit of GTA 6.
// Top-down 2D canvas. On foot and by car, traffic, pedestrians, a wanted system
// with NBPD police, a six-job story, combat, a HUD with minimap, saves, and
// fully synthesized sound. No network requests: every asset is code.
import { makeRng, clamp, angleDiff, dist2 } from './rng.js';
import { genCity, drawCity, resolveCircle, randomRoadPoint, isOnRoad, WORLD_W, WORLD_H } from './city.js';
import { AudioEngine } from './audio.js';
import { makeCar, makePed, spawnTraffic, spawnPeds, updateTraffic, updatePeds, updatePolice, updateBullets, updateParticles, drawCar, drawPed, CAR_COLORS } from './entities.js';
import { MISSIONS, startMission, completeMission, failMission } from './missions.js';
import { updateHUD, drawMinimap } from './hud.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SEED = params.get('seed') || 'neon-bay-1';
const SHOT = params.get('shot') || '';

export const world = {
  time: 0, gameMinutes: 9 * 60, paused: false, over: false, won: false,
  city: null, rng: null, audio: new AudioEngine(),
  cars: [], peds: [], cops: [], policeCars: [], rivals: [], bullets: [], particles: [],
  player: null, marker: null, missionIndex: 0, mission: null, missionData: null, missionState: 'idle',
  keys: {}, mouse: { x: 640, y: 360, down: false },
  cam: { x: 0, y: 0, w: 1280, h: 720 }, shake: 0, crimeCooldown: 0, wantedTimer: 0,
  stats: { carsStolen: 0, missionsDone: 0, cashEarned: 0 },
  saveGame, winGame, toast, showBanner, addShake, spawnParticles, spawnRivals, onRivalDown,
};

function makePlayer(x, y) {
  const p = {
    x, y, angle: -Math.PI / 2, speed: 0, health: 100, armor: 100, cash: 0,
    wanted: 0, inCar: false, car: null, punchCooldown: 0, shootCooldown: 0,
    addWanted(n) {
      if (world.crimeCooldown > 0 && n <= 1) return;
      this.wanted = clamp(this.wanted + n, 0, 5);
      world.crimeCooldown = 1.2; world.wantedTimer = 0;
      if (this.wanted >= 3) world.audio.setSiren(true);
    },
  };
  return p;
}

function newGame() {
  world.rng = makeRng(SEED);
  world.city = genCity(SEED);
  world.cars = []; world.peds = []; world.cops = []; world.policeCars = [];
  world.rivals = []; world.bullets = []; world.particles = [];
  world.time = 0; world.gameMinutes = 9 * 60; world.over = false; world.won = false;
  world.missionIndex = 0; world.mission = null; world.marker = null;
  world.stats = { carsStolen: 0, missionsDone: 0, cashEarned: 0 };
  world.player = makePlayer(1800, 1050);
  spawnTraffic(world, 16);
  spawnPeds(world, 26);
  // A parked car right by the spawn so the first job is quick to start.
  const parked = makeCar(1920, 1050, 0, world.rng, { driver: null, color: '#d84a4a', model: 'Sedan' });
  world.cars.push(parked);
  world.cam.x = world.player.x - 640; world.cam.y = world.player.y - 360;
}

function saveGame() {
  try {
    const p = world.player;
    localStorage.setItem('neonbay-save-v1', JSON.stringify({
      cash: p.cash, missionIndex: world.missionIndex, health: p.health,
      x: p.x, y: p.y, carsStolen: world.stats.carsStolen, missionsDone: world.stats.missionsDone,
    }));
  } catch { /* storage unavailable: game still plays */ }
}
function loadSave() {
  try { return JSON.parse(localStorage.getItem('neonbay-save-v1') || 'null'); } catch { return null; }
}
function winGame() {
  world.won = true;
  $('win-stats').innerHTML = `Cash earned: $${world.stats.cashEarned.toLocaleString()} &nbsp;·&nbsp; Cars stolen: ${world.stats.carsStolen} &nbsp;·&nbsp; Jobs done: ${world.stats.missionsDone}`;
  $('win-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  world.audio.missionDone();
}
function gameOver(busted) {
  world.over = true;
  $('go-title').textContent = busted ? 'BUSTED' : 'FLATLINED';
  $('go-text').textContent = busted
    ? 'The NBPD caught you. Mara will post bail — but the heat is on, Rio.'
    : 'Neon Bay chewed you up. Mara drags you to the Hideout to patch you up.';
  $('go-stats').innerHTML = `Cash: $${Math.floor(world.player.cash).toLocaleString()} &nbsp;·&nbsp; Jobs done: ${world.stats.missionsDone} &nbsp;·&nbsp; Cars stolen: ${world.stats.carsStolen}`;
  $('gameover-screen').classList.remove('hidden');
  $('hud').classList.add('hidden');
  world.audio.busted(); world.audio.setSiren(false); world.audio.setEngine(0, false);
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.style.opacity = '1';
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}
function showBanner(title, sub) {
  const b = $('mission-banner');
  $('banner-title').textContent = title; $('banner-sub').textContent = sub;
  b.classList.remove('hidden');
  clearTimeout(showBanner._t); showBanner._t = setTimeout(() => b.classList.add('hidden'), 4200);
}
function addShake(n) { world.shake = Math.min(14, world.shake + n); }
function spawnParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.range(0, Math.PI * 2), s = world.rng.range(40, 220);
    world.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: world.rng.range(0.3, 0.8), color });
  }
}
function spawnRivals(n, x, y, radius, boss = false) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.range(0, Math.PI * 2), r = world.rng.range(30, radius);
    const ped = makePed(x + Math.cos(a) * r, y + Math.sin(a) * r, world.rng);
    ped.rival = true; ped.color = boss && i === 0 ? '#ffd23e' : '#c22a2a';
    ped.boss = boss && i === 0; ped.speed = 120; ped.health = ped.boss ? 5 : 3;
    world.rivals.push(ped);
  }
}
function onRivalDown(ped) {
  world.rivals = world.rivals.filter((r) => r !== ped);
  if (world.missionData) world.missionData.down = (world.missionData.down || 0) + 1;
  world.player.cash += 25; world.stats.cashEarned += 25;
  toast((ped.boss ? 'Darius Vane is down! ' : 'Enforcer down! ') + '+$25');
}

// --- Input ---
const canvas = $('game'), ctx = canvas.getContext('2d');
addEventListener('keydown', (e) => {
  world.keys[e.code] = true;
  if (e.code === 'KeyE' && !e.repeat && world.player && $('title-screen').classList.contains('hidden') && !world.paused && !world.over) tryEnterCar();
  if (e.code === 'KeyM') { world.audio.muted = !world.audio.muted; world.audio.setMuted(world.audio.muted); toast(world.audio.muted ? 'Sound muted' : 'Sound on'); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { world.keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  world.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  world.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener('mousedown', (e) => { world.mouse.down = true; world.audio.init(); tryShoot(); });
addEventListener('mouseup', () => { world.mouse.down = false; });
canvas.addEventListener('click', () => world.audio.init());

function togglePause() {
  if (world.over || world.won || $('title-screen').classList.contains('hidden') === false) return;
  world.paused = !world.paused;
  $('pause-screen').classList.toggle('hidden', !world.paused);
}

// --- Player actions ---
function tryEnterCar() {
  const p = world.player;
  if (p.inCar) {
    // Exit: place the player beside the car.
    const car = p.car; car.driver = null; car.speed = 0;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40; p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.inCar = false; p.car = null; p.angle = car.angle;
    return;
  }
  let best = null, bd = 70 * 70;
  for (const car of [...world.cars, ...world.policeCars]) {
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return;
  if (best.police) { p.addWanted(2); toast('You stole a cop car! The whole NBPD is coming.'); }
  else if (best.driver === 'ped') {
    p.addWanted(1); world.stats.carsStolen++;
    const ped = makePed(best.x + 30, best.y + 30, world.rng);
    ped.fleeing = 3; world.peds.push(ped);
    toast(`You stole a ${best.model}! +1 wanted star.`);
  } else toast(`You took the ${best.model}.`);
  best.driver = 'player'; p.inCar = true; p.car = best;
  world.audio.pickup();
}
function tryPunch() {
  const p = world.player;
  if (p.inCar || p.punchCooldown > 0) return;
  p.punchCooldown = 0.4; world.audio.punch();
  for (const t of [...world.peds, ...world.cops, ...world.rivals]) {
    if (t.down) continue;
    if (dist2(p.x, p.y, t.x, t.y) < 46 * 46) {
      if (t.rival) { t.health -= 1; if (t.health <= 0) { t.down = true; t.downTimer = 9999; onRivalDown(t); } }
      else if (t.cop) { t.down = true; t.downTimer = 6; p.addWanted(2); }
      else { t.down = true; t.downTimer = 9999; p.addWanted(1); toast('You knocked out a pedestrian! +1 wanted.'); }
      spawnParticles(t.x, t.y, '#ffe9a8', 8);
      break;
    }
  }
}
function tryShoot() {
  const p = world.player;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.22; world.audio.shot();
  const ox = p.inCar && p.car ? p.car.x : p.x, oy = p.inCar && p.car ? p.car.y : p.y;
  const wx = world.cam.x + world.mouse.x, wy = world.cam.y + world.mouse.y;
  const a = Math.atan2(wy - oy, wx - ox);
  world.bullets.push({ x: ox + Math.cos(a) * 26, y: oy + Math.sin(a) * 26, angle: a, speed: 900, life: 0.9 });
  spawnParticles(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26, '#ffd23e', 3);
  world.addShake(2);
}

// --- Update ---
function updatePlayer(dt) {
  const p = world.player, k = world.keys;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  world.crimeCooldown = Math.max(0, world.crimeCooldown - dt);
  if (k['Space']) tryPunch();
  if (world.mouse.down) tryShoot();

  if (p.inCar && p.car) {
    const car = p.car;
    const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 0.7 : 0);
    const steer = (k['KeyA'] || k['ArrowLeft'] ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
    car.speed += fwd * 420 * dt;
    car.speed *= Math.pow(0.4, dt); // drag
    car.speed = clamp(car.speed, -220, car.maxSpeed);
    car.angle += steer * clamp(Math.abs(car.speed) / 260, 0, 1) * 2.6 * dt * Math.sign(car.speed || 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const r = resolveCircle(nx, ny, 22, world.city);
    if (r.hit && Math.abs(car.speed) > 200) {
      world.audio.crash(); world.addShake(7); spawnParticles(car.x, car.y, '#ffb52e', 10);
      car.health -= 12;
      if (car.health <= 0 && !car.wreckToast) { car.wreckToast = true; toast('Your car is wrecked — it can only limp now!'); }
    }
    if (car.health <= 0) car.speed = clamp(car.speed, -60, 60); // wrecked cars limp
    if (r.hit) car.speed *= 0.45;
    car.x = r.x; car.y = r.y;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    // Running over pedestrians.
    for (const ped of world.peds) {
      if (ped.down) continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 26 * 26 && Math.abs(car.speed) > 120) {
        ped.down = true; ped.downTimer = 9999; p.addWanted(1);
        world.audio.crash(); world.addShake(5); spawnParticles(ped.x, ped.y, '#ff5a5a', 12);
        toast('You hit a pedestrian! +1 wanted star.');
      }
    }
    world.audio.setEngine(Math.abs(car.speed) / car.maxSpeed, true);
  } else {
    const sprint = (k['ShiftLeft'] || k['ShiftRight']) ? 1.5 : 1;
    const sp = 230 * sprint;
    let dx = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    let dy = (k['KeyS'] || k['ArrowDown'] ? 1 : 0) - (k['KeyW'] || k['ArrowUp'] ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      p.angle = Math.atan2(dy, dx);
      const r = resolveCircle(p.x + dx * sp * dt, p.y + dy * sp * dt, 12, world.city);
      p.x = r.x; p.y = r.y;
    }
    world.audio.setEngine(0, false);
  }
  // Aim the player toward the mouse when shooting on foot.
  if (!p.inCar) {
    const wx = world.cam.x + world.mouse.x, wy = world.cam.y + world.mouse.y;
    if (world.mouse.down) p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  // Rival enforcers chase and punch the player.
  for (const r of world.rivals) {
    if (r.down) continue;
    const d = Math.sqrt(dist2(r.x, r.y, p.x, p.y));
    if (d < 500) {
      r.angle = Math.atan2(p.y - r.y, p.x - r.x);
      const res = resolveCircle(r.x + Math.cos(r.angle) * r.speed * dt, r.y + Math.sin(r.angle) * r.speed * dt, 10, world.city);
      r.x = res.x; r.y = res.y;
      if (d < 30) { p.health -= 5 * dt; world.addShake(3); }
    }
  }
  // Wanted decay: lay low and the heat cools off.
  if (p.wanted > 0) {
    world.wantedTimer += dt;
    const nearestCop = Math.min(
      ...world.policeCars.map((c) => Math.sqrt(dist2(c.x, c.y, p.x, p.y))),
      ...world.cops.map((c) => Math.sqrt(dist2(c.x, c.y, p.x, p.y))), 9999);
    if (world.wantedTimer > 14 && nearestCop > 420) {
      p.wanted--; world.wantedTimer = 0;
      if (p.wanted === 0) { world.audio.setSiren(false); toast('You lost the cops. Heat is off.'); }
    }
  }
  if (p.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
  if (p.health <= 0) gameOver(p.wanted > 0);
}

function update(dt) {
  world.time += dt * 1000;
  world.gameMinutes += dt * 0.6;
  world.audio.sirenTick(world.time);
  updatePlayer(dt);
  updateTraffic(world, dt);
  updatePeds(world, dt);
  if (world.player.wanted > 0) updatePolice(world, dt);
  else { world.policeCars = []; world.cops = world.cops.filter((c) => c.down); }
  updateBullets(world, dt);
  updateParticles(world, dt);
  // Mission progress.
  if (world.mission && world.missionState === 'active') {
    const res = world.mission.update(world, dt);
    if (res === 'done') { world.stats.missionsDone++; world.stats.cashEarned += world.mission.reward; completeMission(world); }
    else if (res === 'failed') failMission(world, 'time ran out');
  }
  // Camera follows the player with a shake.
  const tx = clamp(world.player.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(world.player.y - 360, 0, WORLD_H - 720);
  world.cam.x += (tx - world.cam.x) * Math.min(1, dt * 5);
  world.cam.y += (ty - world.cam.y) * Math.min(1, dt * 5);
  world.shake = Math.max(0, world.shake - dt * 30);
  // Autosave every 20s.
  world._saveT = (world._saveT || 0) + dt;
  if (world._saveT > 20) { world._saveT = 0; saveGame(); }
}

// --- Render ---
function draw() {
  const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
  const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0;
  const cam = { x: world.cam.x + shakeX, y: world.cam.y + shakeY, w: 1280, h: 720 };
  ctx.clearRect(0, 0, 1280, 720);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, world.city, cam, world.time);
  // Mission marker beacon + ground ring.
  if (world.marker) {
    const m = world.marker, pulse = 1 + Math.sin(world.time * 0.006) * 0.15;
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.18)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.moveTo(m.x, m.y - 78); ctx.lineTo(m.x - 12, m.y - 52); ctx.lineTo(m.x + 12, m.y - 52); ctx.closePath(); ctx.fill();
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.strokeText(m.label, m.x, m.y - 86); ctx.fillText(m.label, m.x, m.y - 86);
    if (world.mission && world.mission.id === 'bay-bank' && world.missionData && world.missionData.stage === 'hold') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(m.x - 70, m.y + 50, 140, 16);
      ctx.fillStyle = '#7dff9e'; ctx.fillRect(m.x - 68, m.y + 52, 136 * clamp(world.missionData.hold / 5, 0, 1), 12);
    }
  }
  for (const car of world.cars) drawCar(ctx, car, world.time);
  for (const car of world.policeCars) drawCar(ctx, car, world.time);
  for (const ped of world.peds) drawPed(ctx, ped, world.time);
  for (const cop of world.cops) drawPed(ctx, cop, world.time);
  for (const r of world.rivals) drawPed(ctx, r, world.time);
  // Player.
  const p = world.player;
  if (p.inCar && p.car) drawCar(ctx, p.car, world.time);
  else {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 3, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7ad9'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e'; ctx.beginPath(); ctx.arc(4, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23e'; ctx.fillRect(8, -2, 12, 4); // pistol
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText('RIO', p.x, p.y - 18);
  }
  // Bullets.
  ctx.fillStyle = '#ffe95e';
  for (const b of world.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1); ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Off-screen objective arrow.
  if (world.marker) {
    const m = world.marker;
    const sx = m.x - world.cam.x, sy = m.y - world.cam.y;
    if (sx < 60 || sx > 1220 || sy < 60 || sy > 660) {
      const cx = clamp(sx, 70, 1210), cy = clamp(sy, 70, 650);
      const a = Math.atan2(sy - 360, sx - 640);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(Math.hypot(m.x - p.x, m.y - p.y)) + 'm', cx, cy + 30);
    }
  }
}

// --- Loop ---
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!world.paused && !world.over && $('title-screen').classList.contains('hidden') && $('win-screen').classList.contains('hidden')) {
    update(dt);
    updateHUD(world);
    drawMinimap(world);
  }
  if (world.city) draw();
}
requestAnimationFrame(loop);

// --- Screens / flow ---
function startGame(fromSave) {
  const save = fromSave ? loadSave() : null;
  newGame();
  if (save) {
    world.player.cash = save.cash || 0;
    world.player.x = save.x || 1800; world.player.y = save.y || 1200;
    world.missionIndex = save.missionIndex || 0;
    world.stats.carsStolen = save.carsStolen || 0; world.stats.missionsDone = save.missionsDone || 0;
  }
  $('title-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pause-screen').classList.add('hidden');
  $('gameover-screen').classList.add('hidden');
  $('win-screen').classList.add('hidden');
  world.audio.init();
  if (world.missionIndex < MISSIONS.length) startMission(world, world.missionIndex);
  else { world.mission = null; toast('Free roam — all jobs done. The city is yours.'); }
}
$('btn-new').addEventListener('click', () => { try { localStorage.removeItem('neonbay-save-v1'); } catch {} startGame(false); });
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-how').addEventListener('click', () => $('howto').classList.toggle('hidden'));
$('btn-resume').addEventListener('click', togglePause);
$('btn-quit-title').addEventListener('click', () => { saveGame(); world.paused = false; $('pause-screen').classList.add('hidden'); $('hud').classList.add('hidden'); $('title-screen').classList.remove('hidden'); });
$('btn-retry').addEventListener('click', () => { $('gameover-screen').classList.add('hidden'); $('hud').classList.remove('hidden'); world.over = false; world.player.health = 100; world.player.wanted = 0; world.player.x = 330; world.player.y = 2250; world.audio.setSiren(false); });
$('btn-go-title').addEventListener('click', () => { saveGame(); $('gameover-screen').classList.add('hidden'); $('hud').classList.add('hidden'); $('title-screen').classList.remove('hidden'); });
$('btn-freeroam').addEventListener('click', () => { $('win-screen').classList.add('hidden'); $('hud').classList.remove('hidden'); world.won = false; });
$('btn-win-title').addEventListener('click', () => { saveGame(); $('win-screen').classList.add('hidden'); $('hud').classList.add('hidden'); $('title-screen').classList.remove('hidden'); });
if (!loadSave()) $('btn-continue').style.opacity = '0.45';

// --- Shot modes for screenshots: deterministic staged scenes ---
if (SHOT) {
  newGame();
  $('title-screen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  world.audio.muted = true;
  if (SHOT === 'start') {
    $('title-screen').classList.remove('hidden');
    $('hud').classList.add('hidden');
  } else if (SHOT === 'drive') {
    const car = world.cars.find((c) => c.model === 'Sedan') || world.cars[0];
    car.x = 1000; car.y = 1050; car.angle = 0;
    car.driver = 'player'; world.player.inCar = true; world.player.car = car;
    world.player.x = car.x; world.player.y = car.y; car.speed = 320;
    startMission(world, 0);
    world.missionState = 'active';
  } else if (SHOT === 'chase') {
    const car = world.cars[0];
    car.x = 1200; car.y = 1350; car.angle = 0;
    car.driver = 'player'; world.player.inCar = true; world.player.car = car;
    world.player.x = car.x; world.player.y = car.y; car.speed = 380;
    world.player.addWanted(3); world.audio.setSiren(true);
    startMission(world, 2); world.missionState = 'active';
    world.missionData.cooledOff = false;
  } else if (SHOT === 'mission') {
    world.player.x = 1700; world.player.y = 1050;
    startMission(world, 3); world.missionState = 'active';
    const car = makeCar(1700, 1250, 0, world.rng, { driver: null, color: '#e8c84a', model: 'Coupe' });
    world.cars.push(car);
  }
  // Let the staged scene settle before a screenshot is taken.
  world._shotSettled = false;
  setTimeout(() => { world._shotSettled = true; }, 1200);
}

// Test hook for the play-test harness.
window.__neonBay = world;
export { startGame };
