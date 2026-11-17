// city.js — Neon Bay itself: a sun-soaked coastal city generated from a seed.
// Roads on a grid, city blocks full of buildings, a park, a marina district and a
// beach with the ocean along the south edge. All art is drawn procedurally.
import { makeRng, clamp } from './rng.js';

export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const ROAD_W = 96;
export const ROAD_SPACING = 300;

const ROOF_COLORS = ['#c96f4a', '#4a7a96', '#8a6fb8', '#5d8a5a', '#b8a05a', '#96555f', '#4a6b8a', '#a85f7a', '#6b8a4a', '#7a6a9a'];
const WALL_COLORS = ['#e8d5b5', '#d8c8b8', '#c8d8e8', '#e8c8c8', '#d8e0c8', '#c8b8a8', '#b8c8d8', '#e0d8c0'];

export function genCity(seed) {
  const rng = makeRng(seed);
  const roadXs = [], roadYs = [];
  for (let x = 150; x < WORLD_W - 100; x += ROAD_SPACING) roadXs.push(x);
  for (let y = 150; y < WORLD_H - 100; y += ROAD_SPACING) roadYs.push(y);

  const buildings = [];
  const trees = [];
  const isRoadX = (x) => roadXs.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 24);
  const isRoadY = (y) => roadYs.some((ry) => Math.abs(y - ry) < ROAD_W / 2 + 24);

  // City blocks between roads; the south strip (y > 2400) is beach, top-left is a park.
  for (let bx = 0; bx < roadXs.length - 1; bx++) {
    for (let by = 0; by < roadYs.length - 1; by++) {
      const x0 = roadXs[bx] + ROAD_W / 2 + 14, x1 = roadXs[bx + 1] - ROAD_W / 2 - 14;
      const y0 = roadYs[by] + ROAD_W / 2 + 14, y1 = roadYs[by + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (cy > 2380) continue; // beach strip
      if (bx <= 1 && by <= 1) { // Coral Park
        for (let i = 0; i < 9; i++) trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        continue;
      }
      if (bx >= 9 && by >= 6) { // Marina district: fewer, taller towers
        const w = rng.range(70, 110), h = rng.range(70, 110);
        buildings.push(makeBuilding(cx - w / 2, cy - h / 2, w, h, rng, true));
        continue;
      }
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const w = rng.range(52, 96), h = rng.range(52, 96);
        const x = rng.range(x0 + 6, x1 - w - 6), y = rng.range(y0 + 6, y1 - h - 6);
        if (buildings.some((b) => rectsOverlap(b, { x, y, w, h }, 10))) continue;
        buildings.push(makeBuilding(x, y, w, h, rng, false));
      }
      if (rng.chance(0.6)) trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), r: rng.range(8, 13) });
    }
  }
  // Landmark towers along the bayfront avenue.
  const landmarks = [
    { x: 1650, y: 1950, w: 150, h: 110, name: 'BAY TOWER', tall: true },
    { x: 1950, y: 1950, w: 120, h: 100, name: 'CORAL PLAZA', tall: true },
  ];
  for (const lm of landmarks) {
    buildings.push({ ...lm, roof: '#3a5a8a', wall: '#d8e8f8', windows: 6, tall: true, landmark: true });
  }
  // Beach palms.
  for (let i = 0; i < 26; i++) trees.push({ x: rng.range(60, WORLD_W - 60), y: rng.range(2440, 2580), r: rng.range(9, 14), palm: true });

  return {
    seed, roadXs, roadYs, buildings, trees,
    beachY: 2400, waterY: 2560,
    // Named places the HUD, missions and minimap use.
    places: [
      { name: 'Coral Park', x: 300, y: 300 },
      { name: 'Bay Tower', x: 1725, y: 2005 },
      { name: 'Marina', x: 3150, y: 2100 },
      { name: 'Neon Strip', x: 1800, y: 1050 },
      { name: 'Old Docks', x: 450, y: 2100 },
      { name: 'Sunset Beach', x: 1800, y: 2520 },
      { name: 'Hideout', x: 330, y: 2250 },
      { name: 'Bay Bank', x: 1350, y: 1350 },
    ],
  };
}

function makeBuilding(x, y, w, h, rng, tall) {
  return {
    x, y, w, h, tall,
    roof: rng.pick(ROOF_COLORS), wall: rng.pick(WALL_COLORS),
    windows: rng.int(2, 5),
  };
}
function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

export function isOnRoad(x, y, city) {
  return city.roadXs.some((rx) => Math.abs(x - rx) < ROAD_W / 2) ||
    city.roadYs.some((ry) => Math.abs(y - ry) < ROAD_W / 2);
}
// Push a circle out of buildings; returns corrected position and whether it hit.
export function resolveCircle(x, y, r, city) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; y = cy + (dy / d) * r; }
      else { // dead centre: push out along the smallest penetration axis
        const pl = x - (b.x - r), pr = (b.x + b.w + r) - x, pt = y - (b.y - r), pb = (b.y + b.h + r) - y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x: clamp(x, 30, WORLD_W - 30), y: clamp(y, 30, WORLD_H - 30), hit };
}
export function randomRoadPoint(city, rng) {
  const vertical = rng.chance(0.5);
  if (vertical) return { x: rng.pick(city.roadXs) + rng.range(-20, 20), y: rng.range(200, WORLD_H - 400) };
  return { x: rng.range(200, WORLD_W - 200), y: rng.pick(city.roadYs) + rng.range(-20, 20) };
}
export function nearestRoadPoint(x, y, city) {
  let best = null, bd = Infinity;
  for (const rx of city.roadXs) for (const ry of city.roadYs) {
    const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
    if (d < bd) { bd = d; best = { x: rx, y: ry }; }
  }
  return best;
}

// ---- Drawing ----
export function drawCity(ctx, city, cam, time) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  // Ground: grassy city, sand beach, ocean.
  ctx.fillStyle = '#3f7d54'; ctx.fillRect(vx, vy, vw, vh);
  // Beach + ocean.
  ctx.fillStyle = '#e8d28a'; ctx.fillRect(Math.max(vx, 0), Math.max(vy, city.beachY), Math.min(vw, WORLD_W - Math.max(vx, 0)), Math.max(0, Math.min(vy + vh, city.waterY) - Math.max(vy, city.beachY)));
  const wave = Math.sin(time * 0.0012) * 6;
  ctx.fillStyle = '#2a7ab8';
  ctx.fillRect(Math.max(vx, 0), Math.max(vy, city.waterY + wave), Math.min(vw, WORLD_W), Math.max(0, vy + vh - Math.max(vy, city.waterY + wave)));
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD_W; x += 90) {
    if (x < vx - 100 || x > vx + vw + 100) continue;
    ctx.fillRect(x, city.waterY + wave + Math.sin(x * 0.01 + time * 0.002) * 4, 46, 3);
  }
  // Park.
  ctx.fillStyle = '#4a9a5a'; ctx.fillRect(164, 164, 560, 560);
  ctx.fillStyle = '#7ec8e8'; ctx.beginPath(); ctx.ellipse(440, 440, 90, 60, 0, 0, Math.PI * 2); ctx.fill();
  // Roads.
  ctx.fillStyle = '#33363e';
  for (const rx of city.roadXs) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of city.roadYs) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = '#e8d44a';
  for (const rx of city.roadXs) for (let y = 0; y < WORLD_H; y += 56) ctx.fillRect(rx - 2, y, 4, 28);
  for (const ry of city.roadYs) for (let x = 0; x < WORLD_W; x += 56) ctx.fillRect(x, ry - 2, 28, 4);
  // Sidewalk edges.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 4;
  for (const rx of city.roadXs) { ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2, 0); ctx.lineTo(rx - ROAD_W / 2, WORLD_H); ctx.moveTo(rx + ROAD_W / 2, 0); ctx.lineTo(rx + ROAD_W / 2, WORLD_H); ctx.stroke(); }
  for (const ry of city.roadYs) { ctx.beginPath(); ctx.moveTo(0, ry - ROAD_W / 2); ctx.lineTo(WORLD_W, ry - ROAD_W / 2); ctx.moveTo(0, ry + ROAD_W / 2); ctx.lineTo(WORLD_W, ry + ROAD_W / 2); ctx.stroke(); }
  // Buildings.
  for (const b of city.buildings) {
    if (b.x > vx + vw || b.x + b.w < vx || b.y > vy + vh || b.y + b.h < vy) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,200,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (((i * 7 + j * 13 + b.w) % 5) !== 0) ctx.fillRect(b.x + 9 + i * 24, b.y + 9 + j * 24, 10, 12);
    }
    if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(b.x + b.w / 2 - 3, b.y - 16, 6, 16); ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 18, 4, 0, Math.PI * 2); ctx.fill(); }
    if (b.landmark) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5); }
  }
  // Trees / palms.
  for (const t of city.trees) {
    if (t.x < vx - 30 || t.x > vx + vw + 30 || t.y < vy - 30 || t.y > vy + vh + 30) continue;
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(t.x - 2, t.y - 2, 4, 5);
    ctx.fillStyle = t.palm ? '#2a9a5a' : '#2f7a3a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // City border.
  ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
}
