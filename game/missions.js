// missions.js — the Neon Bay story: six jobs from Mara Voss that take Rio from
// wheelman to the king of the city. Each mission sets an objective marker, checks
// its own completion, and pays cash on completion.
import { clamp } from './rng.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'JOB 1 — FIRST WHEELS',
    briefing: 'Mara: "Welcome home, Rio. The Kings took your car. Take one back — any car on the street. Then bring it to the Hideout."',
    objective: 'Steal a car (walk up to one and press E), then drive to the gold marker at the Hideout.',
    reward: 150,
    setup(world) {
      world.marker = { x: 330, y: 2250, label: 'HIDEOUT' };
      world.missionData = { stoleCar: false };
    },
    update(world) {
      if (!world.missionData.stoleCar && world.player.inCar) {
        world.missionData.stoleCar = true;
        world.toast('Car stolen! Now drive to the Hideout.');
      }
      if (world.missionData.stoleCar && world.player.inCar) {
        const d = Math.hypot(world.player.x - 330, world.player.y - 2250);
        if (d < 90) return 'done';
      }
      return 'active';
    },
  },
  {
    id: 'delivery-run', title: 'JOB 2 — DELIVERY RUN',
    briefing: 'Mara: "Three drops, one hot engine. The Strip, the Marina, the Old Docks — 150 seconds. Don\'t keep the clients waiting."',
    objective: 'Drive to all 3 drop points before the timer runs out.',
    reward: 300,
    setup(world) {
      world.missionData = { drops: [{ x: 1800, y: 1050, done: false }, { x: 3150, y: 2100, done: false }, { x: 450, y: 2100, done: false }], timer: 150 };
      world.marker = { ...world.missionData.drops[0], label: 'DROP 1/3' };
    },
    update(world, dt) {
      const m = world.missionData;
      m.timer -= dt;
      if (m.timer <= 0) return 'failed';
      const next = m.drops.find((d) => !d.done);
      if (!next) return 'done';
      world.marker = { ...next, label: `DROP ${m.drops.indexOf(next) + 1}/3` };
      const d = Math.hypot(world.player.x - next.x, world.player.y - next.y);
      if (d < 80) {
        next.done = true;
        world.player.cash += 50;
        world.toast(`Drop delivered! +$50 (${m.drops.filter((x) => x.done).length}/3)`);
        world.audio.pickup();
      }
      return 'active';
    },
  },
  {
    id: 'getaway', title: 'JOB 3 — THE GETAWAY',
    briefing: 'Mara: "The NBPD is onto the drops. You\'ve got heat — lose the cops, then slip back to the Hideout. Stay calm, drive clean."',
    objective: 'Lose your wanted level (stay out of sight), then reach the Hideout.',
    reward: 350,
    setup(world) {
      world.player.addWanted(3);
      world.marker = { x: 330, y: 2250, label: 'HIDEOUT' };
      world.missionData = { cooledOff: false };
    },
    update(world) {
      if (!world.missionData.cooledOff && world.player.wanted === 0) {
        world.missionData.cooledOff = true;
        world.toast('Heat is off! Get to the Hideout.');
      }
      if (world.missionData.cooledOff) {
        const d = Math.hypot(world.player.x - 330, world.player.y - 2250);
        if (d < 90) return 'done';
      }
      return 'active';
    },
  },
  {
    id: 'turf-war', title: 'JOB 4 — TURF WAR',
    briefing: 'Mara: "The Coral Kings are muscling the Strip. Three of their enforcers are shaking down shops on the Neon Strip. Remind them whose streets these are."',
    objective: 'Take down 3 Coral Kings enforcers on the Neon Strip (punch with Space or shoot with the mouse).',
    reward: 450,
    setup(world) {
      world.marker = { x: 1800, y: 1050, label: 'NEON STRIP' };
      world.missionData = { down: 0, need: 3 };
      world.spawnRivals(3, 1800, 1050, 220);
    },
    update(world) {
      if (world.missionData.down >= world.missionData.need) return 'done';
      return 'active';
    },
  },
  {
    id: 'bay-bank', title: 'JOB 5 — THE BAY BANK JOB',
    briefing: 'Mara: "Big one, Rio. Bay Bank, noon rush. Get inside, hold the vault for 5 seconds, then run — the whole NBPD will be on you. Hideout after."',
    objective: 'Reach Bay Bank, hold E at the vault for 5s, then escape to the Hideout with the cash.',
    reward: 900,
    setup(world) {
      world.marker = { x: 1350, y: 1350, label: 'BAY BANK' };
      world.missionData = { stage: 'go', hold: 0 };
    },
    update(world, dt) {
      const m = world.missionData;
      if (m.stage === 'go') {
        const d = Math.hypot(world.player.x - 1350, world.player.y - 1350);
        if (d < 110 && !world.player.inCar) { m.stage = 'hold'; world.toast('Hold E at the vault!'); }
      } else if (m.stage === 'hold') {
        const d = Math.hypot(world.player.x - 1350, world.player.y - 1350);
        if (d > 130 || world.player.inCar) { m.hold = 0; m.stage = 'go'; world.toast('You left the vault!'); }
        else if (world.keys['KeyE']) {
          m.hold += dt;
          if (m.hold >= 5) {
            m.stage = 'escape';
            world.player.cash += 400; world.player.addWanted(3);
            world.marker = { x: 330, y: 2250, label: 'HIDEOUT' };
            world.toast('Vault cracked! +$400 — RUN to the Hideout!');
            world.audio.missionDone();
          }
        } else m.hold = Math.max(0, m.hold - dt * 2);
      } else if (m.stage === 'escape') {
        const d = Math.hypot(world.player.x - 330, world.player.y - 2250);
        if (d < 90) return 'done';
      }
      return 'active';
    },
  },
  {
    id: 'king-of-the-bay', title: 'JOB 6 — KING OF NEON BAY',
    briefing: 'Mara: "Last one. Kingpin Darius Vane is at the Marina with his whole crew. End it, Rio — and the Bay is ours."',
    objective: 'Defeat Darius Vane and his 4 enforcers at the Marina.',
    reward: 1500,
    setup(world) {
      world.marker = { x: 3150, y: 2100, label: 'MARINA' };
      world.missionData = { down: 0, need: 5 };
      world.spawnRivals(5, 3150, 2100, 260, true);
    },
    update(world) {
      if (world.missionData.down >= world.missionData.need) return 'done';
      return 'active';
    },
  },
];

export function startMission(world, index) {
  const m = MISSIONS[index];
  world.missionIndex = index;
  world.mission = m;
  world.missionState = 'active';
  m.setup(world);
  world.showBanner(m.title, m.briefing);
  world.audio.missionDone();
}
export function completeMission(world) {
  const m = world.mission;
  world.player.cash += m.reward;
  world.player.armor = 100;
  world.toast(`Job complete! +$${m.reward} — armor restored.`);
  world.audio.missionDone();
  world.missionIndex++;
  world.mission = null; world.marker = null; world.missionState = 'done';
  world.saveGame();
  if (world.missionIndex >= MISSIONS.length) {
    world.winGame();
  } else {
    setTimeout(() => startMission(world, world.missionIndex), 2500);
  }
}
export function failMission(world, reason) {
  world.toast(`Job failed: ${reason}. Try again — Mara is waiting.`);
  world.audio.busted();
  world.missionState = 'failed';
  setTimeout(() => startMission(world, world.missionIndex), 2500);
}
