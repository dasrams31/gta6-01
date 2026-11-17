// entities.js — everyone else in Neon Bay: traffic cars that follow the roads,
// pedestrians on the sidewalks, police that chase the player, bullets, and
// the particle bursts that make crashes and gunfire feel alive.
import { makeRng, clamp, angleDiff, dist2 } from './rng.js';
import { isOnRoad, resolveCircle, randomRoadPoint, WORLD_W, WORLD_H } from './city.js';

export const CAR_COLORS = ['#d84a4a', '#4a7ad8', '#e8c84a', '#7ad84a', '#d8d8d8', '#8a4ad8', '#e87a2a', '#2ad8c8', '#3a3a3a', '#f2f2f2'];
export const CAR_MODELS = ['Sedan', 'Coupe', 'Hatch', 'SUV', 'Taxi', 'Pickup'];

export function makeCar(x, y, angle, rng, opts = {}) {
  return {
    kind: 'car', x, y, angle, speed: 0,
    color: opts.color || rng.pick(CAR_COLORS),
    model: opts.model || rng.pick(CAR_MODELS),
    police: !!opts.police, traffic: opts.traffic !== false,
    driver: opts.driver === undefined ? 'ped' : opts.driver, // 'ped' | 'player' | null (parked)
    maxSpeed: opts.police ? 560 : rng.range(300, 380),
    w: 46, h: 22, health: 100, stuck: 0,
    targetAngle: angle, cruise: rng.range(120, 200),
  };
}
export function makePed(x, y, rng) {
  return {
    kind: 'ped', x, y, angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
    color: rng.pick(['#e88a4a', '#4a8ad8', '#8ad84a', '#d84a8a', '#e8d84a', '#7a5ad8']),
    fleeing: 0, down: false, downTimer: 0, walkPhase: rng.range(0, 6),
  };
}

export function spawnTraffic(world, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(world.city, world.rng);
    const vertical = world.city.roadXs.some((rx) => Math.abs(p.x - rx) < 30);
    const car = makeCar(p.x, p.y, vertical ? (world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (world.rng.chance(0.5) ? 0 : Math.PI), world.rng);
    world.cars.push(car);
  }
}
export function spawnPeds(world, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(world.city, world.rng);
    world.peds.push(makePed(p.x + world.rng.range(-60, 60), p.y + world.rng.range(-60, 60), world.rng));
  }
}
export function spawnPolice(world) {
  const want = Math.min(6, world.player.wanted);
  while (world.policeCars.length < want) {
    const a = world.rng.range(0, Math.PI * 2);
    const x = clamp(world.player.x + Math.cos(a) * 700, 80, WORLD_W - 80);
    const y = clamp(world.player.y + Math.sin(a) * 700, 80, WORLD_H - 80);
    const car = makeCar(x, y, a, world.rng, { police: true, color: '#1a2a4a', model: 'Interceptor', driver: 'cop' });
    car.cruise = 320;
    world.policeCars.push(car);
  }
  while (world.policeCars.length > want) world.policeCars.pop();
}

// --- Updates ---
export function updateTraffic(world, dt) {
  const { city, player } = world;
  for (const car of world.cars) {
    if (car.driver === 'player') continue;
    // Follow the road: steer toward the nearest road centre line.
    const onRoad = isOnRoad(car.x, car.y, city);
    if (!onRoad) { car.targetAngle = Math.atan2(player.y - car.y, player.x - car.x); }
    else {
      const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
      if (vertical) {
        const rx = city.roadXs.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
        car.targetAngle = car.angle > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x += clamp(rx - car.x, -60 * dt, 60 * dt);
      } else {
        const ry = city.roadYs.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
        car.targetAngle = Math.abs(car.angle) < Math.PI / 2 ? 0 : Math.PI;
        car.y += clamp(ry - car.y, -60 * dt, 60 * dt);
      }
      // Random turn at intersections.
      if (world.rng.chance(dt * 0.12)) car.targetAngle += (world.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
    }
    car.angle += clamp(angleDiff(car.angle, car.targetAngle), -2.2 * dt, 2.2 * dt);
    const targetSpeed = car.driver === 'ped' ? car.cruise : 0;
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 140 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const r = resolveCircle(nx, ny, 22, city);
    if (r.hit) { car.speed *= 0.4; car.targetAngle += Math.PI / 2; }
    car.x = r.x; car.y = r.y;
    // Keep traffic near the player: recycle far cars onto a road near the player.
    if (dist2(car.x, car.y, player.x, player.y) > 1500 * 1500) {
      const p = randomRoadPoint(city, world.rng);
      car.x = clamp(player.x + (p.x - 1800) * 0.4, 80, WORLD_W - 80);
      car.y = clamp(player.y + (p.y - 1350) * 0.4, 80, WORLD_H - 80);
      car.speed = car.cruise;
    }
  }
}
export function updatePeds(world, dt) {
  const { player } = world;
  for (const ped of world.peds) {
    if (ped.down) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.down = false; ped.fleeing = 3; }
      continue;
    }
    const dPlayer = Math.sqrt(dist2(ped.x, ped.y, player.x, player.y));
    const danger = (player.wanted >= 2 && dPlayer < 260) || (player.inCar && player.car && Math.abs(player.car.speed) > 300 && dPlayer < 200);
    if (danger) ped.fleeing = 2.5;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
      const sp = 150;
      const nx = ped.x + Math.cos(ped.angle) * sp * dt, ny = ped.y + Math.sin(ped.angle) * sp * dt;
      const r = resolveCircle(nx, ny, 10, world.city);
      ped.x = r.x; ped.y = r.y;
    } else {
      ped.walkPhase += dt * 6;
      if (world.rng.chance(dt * 0.25)) ped.angle += world.rng.range(-1.2, 1.2);
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt, ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      const r = resolveCircle(nx, ny, 10, world.city);
      if (r.hit) ped.angle += Math.PI / 2;
      ped.x = r.x; ped.y = r.y;
    }
    if (dist2(ped.x, ped.y, player.x, player.y) > 1600 * 1600) {
      const p = randomRoadPoint(world.city, world.rng);
      ped.x = clamp(player.x + (p.x - 1800) * 0.4, 80, WORLD_W - 80);
      ped.y = clamp(player.y + (p.y - 1350) * 0.4, 80, WORLD_H - 80);
    }
  }
}
export function updatePolice(world, dt) {
  const { player } = world;
  spawnPolice(world);
  for (const car of world.policeCars) {
    const target = Math.atan2(player.y - car.y, player.x - car.x);
    car.angle += clamp(angleDiff(car.angle, target), -3.2 * dt, 3.2 * dt);
    const wantSpeed = player.inCar ? 540 : 300;
    car.speed += clamp(wantSpeed - car.speed, -420 * dt, 300 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const r = resolveCircle(nx, ny, 22, world.city);
    if (r.hit) car.speed *= 0.5;
    car.x = r.x; car.y = r.y;
    // Ram the player: contact damage + bust at high wanted on foot.
    const d = Math.sqrt(dist2(car.x, car.y, player.x, player.y));
    if (d < 46) {
      if (player.inCar && player.car) { player.car.health -= 20 * dt; world.audio.crash(); world.addShake(6); }
      else { player.health -= 26 * dt; world.audio.crash(); world.addShake(8); }
      const push = Math.atan2(player.y - car.y, player.x - car.x);
      player.x += Math.cos(push) * 60 * dt; player.y += Math.sin(push) * 60 * dt;
    }
  }
  // Foot cops when the player is on foot and wanted.
  if (!player.inCar && player.wanted >= 2 && world.cops.length < player.wanted) {
    const a = world.rng.range(0, Math.PI * 2);
    world.cops.push({ x: clamp(player.x + Math.cos(a) * 500, 80, WORLD_W - 80), y: clamp(player.y + Math.sin(a) * 500, 80, WORLD_H - 80), angle: 0, speed: 165, color: '#1a2a4a', down: false, downTimer: 0, walkPhase: 0, fleeing: 0, cop: true });
  }
  for (const cop of world.cops) {
    if (cop.down) { cop.downTimer -= dt; if (cop.downTimer <= 0) cop.down = false; continue; }
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt, ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const r = resolveCircle(nx, ny, 10, world.city);
    cop.x = r.x; cop.y = r.y;
    const d = Math.sqrt(dist2(cop.x, cop.y, player.x, player.y));
    if (d < 26) { player.health -= 20 * dt; world.addShake(4); }
  }
  world.cops = world.cops.filter((c) => dist2(c.x, c.y, player.x, player.y) < 1400 * 1400);
}
export function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt; b.life -= dt;
    // Hit peds / cops / rivals.
    for (const ped of [...world.peds, ...world.cops, ...world.rivals]) {
      if (ped.down) continue;
      if (dist2(b.x, b.y, ped.x, ped.y) < 20 * 20) {
        ped.down = true; ped.downTimer = ped.cop ? 6 : 9999; b.life = 0;
        world.spawnParticles(ped.x, ped.y, '#ff5a5a', 10);
        if (ped.cop || ped.rival) world.player.addWanted(1);
        if (ped.rival) world.onRivalDown(ped);
        break;
      }
    }
    for (const car of [...world.cars, ...world.policeCars]) {
      if (car.driver === 'player') continue;
      if (Math.abs(b.x - car.x) < 24 && Math.abs(b.y - car.y) < 14 && Math.abs(angleDiff(Math.atan2(b.y - car.y, b.x - car.x), car.angle)) < 1.2) {
        car.health -= 25; b.life = 0; world.spawnParticles(b.x, b.y, '#ffb52e', 6);
        if (car.police) world.player.addWanted(1);
        break;
      }
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  // Car wrecks: traffic cars at 0 health smoke and stop (never the player's car).
  for (const car of world.cars) if (car.health <= 0 && car.driver !== 'player' && car.speed > 0) car.speed = 0;
}
export function updateParticles(world, dt) {
  for (const p of world.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  world.particles = world.particles.filter((p) => p.life > 0);
}

// --- Drawing ---
export function drawCar(ctx, car, time) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-24, -11 + 4, 48, 24);
  ctx.fillStyle = '#111'; ctx.fillRect(-20, -13, 10, 5); ctx.fillRect(-20, 8, 10, 5); ctx.fillRect(12, -13, 10, 5); ctx.fillRect(12, 8, 10, 5);
  ctx.fillStyle = car.color;
  ctx.beginPath(); ctx.roundRect(-24, -11, 48, 22, 6); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)'; ctx.fillRect(-4, -8, 12, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(14, -8, 6, 16);
  if (car.police) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText('NBPD', 0, 3);
    const on = Math.floor(time / 300) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath(); ctx.arc(-8, -9, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#2a6aff' : '#ff2a2a';
    ctx.beginPath(); ctx.arc(8, -9, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.health <= 0) { ctx.fillStyle = 'rgba(40,40,40,0.5)'; ctx.beginPath(); ctx.arc(-14, 0, 8 + Math.sin(time * 0.01) * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export function drawPed(ctx, ped, time) {
  ctx.save(); ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.color; ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(0, bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89a'; ctx.beginPath(); ctx.arc(5, bob * 0.3, 4, 0, Math.PI * 2); ctx.fill();
  if (ped.cop) { ctx.fillStyle = '#0a1a3a'; ctx.fillRect(-4, -3, 8, 6); }
  if (ped.rival) { ctx.fillStyle = '#ff2a2a'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -12); }
  ctx.restore();
}
