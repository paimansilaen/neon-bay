[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/paimansilaen/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/paimansilaen/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay — Make GTA 6

An original top-down 2D open-world crime game, built for the [gta6-01](https://make.fun/bounty/gta6-01) bounty on make.fun. No Rockstar material anywhere: the city, the characters, the cars, the story, the art and the music are all invented here.

## The story

Jax Marlowe is a courier with no way out. One bad delivery pulls him into Mara Voss's crew, and Neon Bay — 3400×2600 of streets, parks and beachfront — becomes his workplace. Five jobs stand between him and the big score.

## The jobs

1. **First Delivery** — $300. Reach the drop point.
2. **Hot Wheels** — $500. Steal the red Comet GT.
3. **Cash Run** — $700. Collect 5 cash drops while rival thugs shoot back.
4. **Lose the Heat** — $900. Survive 60 seconds at 3 wanted stars.
5. **The Big Score** — $1500. Grab the vault cash, then escape.

## The city

- A street grid with traffic and pedestrians (they flee from danger), four stealable car types (sedan, taxi, truck, sports), and a beach with water on the east edge.
- Wanted level 1–5 stars: police follow the roads to reach you, slow down to make the arrest, and your heat only cools off while no cop is near. Get caught and it's BUSTED.
- On-foot combat: pistol with mouse aim, F to punch, R to reload, health packs on the streets.
- HUD with money, missions, health and ammo, a live minimap, title / pause / BUSTED screens, a localStorage save, synthesized WebAudio sound effects and procedural music, particles, skid marks and screen shake, and a day/night cycle.
- Deterministic screenshot scenes: `?shot=start|play|chase|mission&seed=1`.

## Controls

WASD move · Shift run · E enter / exit car · Space handbrake · Mouse aim · Click shoot · F punch · R reload · M start mission · P pause

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

The game is plain static files in `game/` (ES modules, zero network requests, zero external libraries). `main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

<sub>Entered on [make.fun](https://make.fun/?ref=4gn3z50j&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
