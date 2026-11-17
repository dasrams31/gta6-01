// hud.js — the Neon Bay HUD: cash, health, wanted stars, clock, speed and the
// live minimap that shows roads, the player, police, rivals and the mission marker.
import { WORLD_W, WORLD_H } from './city.js';

const $ = (id) => document.getElementById(id);

export function updateHUD(world) {
  const p = world.player;
  $('cash').textContent = '$' + Math.floor(p.cash).toLocaleString('en-US');
  $('healthfill').style.width = Math.max(0, p.health) + '%';
  $('armorfill').style.width = Math.max(0, p.armor) + '%';
  $('ammo').textContent = p.inCar ? (p.car ? p.car.model.toUpperCase() + ' · ' + Math.round(Math.abs(p.car.speed) * 0.09) + ' MPH' : '') : 'PISTOL · ∞ AMMO';
  const mins = Math.floor(world.gameMinutes) % (24 * 60);
  $('clock').textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  const stars = $('wanted');
  let html = '';
  for (let i = 0; i < 5; i++) html += `<span class="star${i < p.wanted ? '' : ' off'}">★</span>`;
  stars.innerHTML = html;
  stars.classList.toggle('hot', p.wanted > 0);
  $('speed').textContent = p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 0.09) + ' mph' : 'ON FOOT';
  const obj = world.mission;
  $('obj-title').textContent = obj ? obj.title : 'NEON BAY — FREE ROAM';
  $('obj-text').textContent = obj ? obj.objective : 'Explore the city. Steal cars, cause chaos, or visit Mara at the Hideout to start the next job.';
  $('vignette').style.opacity = p.health < 35 ? String((35 - p.health) / 35) : '0';
}

export function drawMinimap(world) {
  const c = $('minimap'), ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.fillStyle = '#2a4a3a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8d28a'; ctx.fillRect(0, 2400 * sy, W, (WORLD_H - 2400) * sy);
  ctx.fillStyle = '#2a7ab8'; ctx.fillRect(0, 2560 * sy, W, (WORLD_H - 2560) * sy);
  ctx.fillStyle = '#33363e';
  for (const rx of world.city.roadXs) ctx.fillRect(rx * sx - 2, 0, 4, H);
  for (const ry of world.city.roadYs) ctx.fillRect(0, ry * sy - 2, W, 4);
  ctx.fillStyle = '#4a9a5a'; ctx.fillRect(164 * sx, 164 * sy, 560 * sx, 560 * sy);
  // Marker.
  if (world.marker) {
    const pulse = 4 + Math.sin(world.time * 0.008) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(world.marker.x * sx, world.marker.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(world.marker.x * sx, world.marker.y * sy, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Police (blue), rivals (red), player (white arrow).
  ctx.fillStyle = '#3a8aff';
  for (const car of world.policeCars) { ctx.beginPath(); ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff2a2a';
  for (const r of world.rivals) if (!r.down) { ctx.beginPath(); ctx.arc(r.x * sx, r.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  const p = world.player;
  ctx.save(); ctx.translate(p.x * sx, p.y * sy); ctx.rotate(p.angle);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
