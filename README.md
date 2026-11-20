[![Make GTA 6](https://make.fun/badges/paimansilaen/neon-bay/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badges/paimansilaen/neon-bay/rank.svg)](https://make.fun/leaderboard/gta6-01)
[![Reward](https://make.fun/badges/paimansilaen/neon-bay/reward.svg)](https://make.fun/leaderboard/gta6-01)

# Neon Bay — Make GTA 6

An original top-down 2D open-world crime game for the [gta6-01 bounty](https://make.fun/bounty/gta6-01). Nothing here comes from Rockstar Games: the city, the characters, the vehicles, the story, the art, the sound and the music are all invented for this entry.

## The story

Jax Marlowe came to Neon Bay to deliver one package. Mara Voss, who runs the crew that owns the docks, has other plans. Five jobs stand between Jax and a way out:

1. **First Delivery** — $300. Reach the marker and drop the package.
2. **Hot Wheels** — $500. Steal the red Comet GT parked on the street.
3. **Cash Run** — $700. Grab all 5 cash drops while rival thugs shoot back.
4. **Lose the Heat** — $900. Survive 60 seconds at 3 wanted stars.
5. **The Big Score** — $1500. Hit the bank, then reach the getaway marker.

## The city

Neon Bay is 3400×2600 units of street grid, buildings, sidewalks, parks, and a beach with water on the east edge. The sun rises and sets on a four-minute day/night cycle. Traffic drives the roads, pedestrians walk the sidewalks and flee from danger, and the Neon Bay PD chases you down the streets when the heat is on.

## Systems

- **Driving** — four stealable car types (sedan, taxi, truck, sports) with acceleration, steering, handbrake drifts and skid marks. Stealing a driven car raises your wanted level.
- **Wanted 1–5 stars** — police chase, ram and arrest. Heat cools only while no cop is near, so hiding is the way out.
- **Combat** — pistol with mouse aim, F to punch, R to reload, health packs on the streets.
- **HUD and minimap** — money, missions, health, ammo, wanted stars, and a live minimap with the mission marker and police dots.
- **Save** — money, missions and health persist in localStorage between visits.
- **Sound** — synthesized WebAudio effects and a procedural music loop. No audio files.

## Controls

WASD move · Shift run · E enter / exit car · Space handbrake · Mouse aim · Click shoot · F punch · R reload · M start mission · P pause · Enter confirm

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Deterministic screenshots: `?shot=start|play|chase|mission&seed=1`.

## Files

- `game/index.html` — the page
- `game/src/config.js` — tuning numbers and colours
- `game/src/random.js` — seeded random
- `game/src/city.js` — the map: roads, buildings, parks, beach
- `game/src/input.js` — keyboard and mouse
- `game/src/world.js` — the rules: cars, police, missions, wanted
- `game/src/render.js` — the camera, the city, the HUD, the minimap
- `game/src/audio.js` — synthesized sound and music
- `game/src/shots.js` — the deterministic screenshot scenes
- `game/src/main.js` — boot, loop, screens, save
- `main.ts` — hands the game in (copies `game/` and `screenshots/`, verifies the copy, writes the dossier)
- `serve.ts` — local static server on port 8080
- `shots.json` — the four screenshot scenes
