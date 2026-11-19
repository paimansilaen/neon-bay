# NEON BAY — an open-world crime game

An original top-down open-world crime game built for the make.fun **"Make GTA 6"**
bounty (`gta6-01`). Playable in a desktop browser from static files, no network
requests, keyboard + mouse. **Every name, character, place, story beat, piece of
art and sound is original work created for this entry — nothing comes from
Rockstar Games or any commercial game.**

## Story

Jax Marlowe came to Neon Bay to drive a delivery van. One package later, Mara
Voss and her crew own his evenings. Five jobs, one city, every street yours —
on foot or behind the wheel.

## What is in the game

- **A city on foot and by car** — Neon Bay: a road grid with blocks, buildings,
  parks, parking lots and a beach on the east edge, with a day/night cycle.
- **Traffic and pedestrians** — cars drive the streets and turn at intersections;
  pedestrians walk the sidewalks and flee from speeding cars and gunfire.
- **Cars to steal** — walk up to a parked or traffic car and press **E** to get in
  (stealing a driven car raises your wanted level). Sedans, taxis, trucks and
  sports cars all drive differently. **E** again to get out.
- **Wanted level (1–5 stars) + police** — stealing, hitting pedestrians and
  shooting raise the heat; patrol cars chase, ram and try to arrest you. Hide
  long enough and the stars drop. Get caught and it's **BUSTED**.
- **Missions + story** — five missions with briefings, markers, dialogue and
  timers: *First Delivery*, *Hot Wheels* (steal a Comet GT), *Cash Run*,
  *Lose the Heat* and *The Big Score*. Press **M** to start the next one.
- **Combat** — pistol (mouse aim, click to shoot, **R** to reload) and punching
  (**F**). Rival crew members shoot back; health and ammo pickups are stashed
  around the city.
- **HUD with minimap** — cash, health, wanted stars, ammo, speed, mission
  objective with distance and timer, and a live minimap (player, traffic,
  police, mission marker).
- **Start, pause and save** — title screen with the story intro, pause with **P**,
  progress (cash, missions, position) saved to localStorage and continued
  with Enter.
- **Polish** — synthesized WebAudio sound effects and a procedural bassline
  music loop (no audio files), particles, skid marks, screen shake, day/night
  tint and street lamps.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive (W accelerate, S brake/reverse, A/D steer) |
| Mouse | Aim (click to shoot) |
| E | Enter / exit car |
| F | Punch |
| R | Reload |
| M | Start next mission |
| Shift | Run on foot |
| Space | Handbrake while driving |
| P / Esc | Pause |

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Deterministic screenshot scenes: `?shot=start|play|chase|mission&seed=1`
(see `shots.json`).

## Build

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
output directory and writes `dossier.json` via `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.
