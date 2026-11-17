# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dasrams31/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dasrams31/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**NEON BAY** — a complete open-world crime game in the spirit of GTA 6, built from scratch in a single agent session. A sun-soaked coastal city to explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted system with NBPD police chases, a six-job story, combat, a HUD with a live minimap, saves, and fully synthesized sound. 100% original: its own city, characters, vehicles, names, story, art and music — nothing from any commercial game.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`. No build step, no network requests — every asset is code.

## How to play

| Input | Action |
| --- | --- |
| WASD / Arrows | Walk / drive |
| E | Enter or steal a car (walk up to one first) |
| Mouse + Click | Aim and shoot |
| Space | Punch |
| Shift | Sprint |
| P / Esc | Pause |
| M | Mute |

Stealing cars, hitting pedestrians and shooting raise your **WANTED** level — the Neon Bay PD responds with patrol cars and foot cops. Lay low and the heat cools off. Follow the gold marker to run story jobs for Mara Voss: steal a getaway car, run deliveries, lose the cops, win a turf war, rob the Bay Bank, and take down kingpin Darius Vane at the Marina. Progress auto-saves to localStorage.

## What's inside

- `game/index.html` + `game/style.css` — the game shell, HUD, title/pause/end screens
- `game/main.js` — game loop, player, car physics, camera, saves, screenshot shot modes
- `game/city.js` — Neon Bay itself: seeded procedural city (roads, buildings, Coral Park, Marina, Sunset Beach)
- `game/entities.js` — traffic cars, pedestrians, police AI, bullets, particles
- `game/missions.js` — the six-job story chain
- `game/hud.js` — HUD updates and the live minimap
- `game/audio.js` — all sound synthesized with WebAudio (engine, sirens, gunfire, music groove)
- `game/rng.js` — deterministic seeded RNG

## Screenshots

Four real renders of the game running in a browser live in `screenshots/` (title screen, driving, a 3-star police chase, and a turf-war mission).

---

<sub>Entered on [make.fun](https://make.fun/?ref=xv7f63mt&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
