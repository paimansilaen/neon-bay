// Every tuning number and colour in one place. The city is a fixed 3400x2600 logical area;
// the renderer scales a 1280x720 view of it to the window, so no rule below depends on the
// screen size. Roads form a grid; everything the player can reach sits on a road.

export const FIELD = { width: 3400, height: 2600 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Vertical and horizontal road centre lines; the beach starts at BEACH_X. */
export const ROADS = {
  vertical: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  horizontal: [200, 600, 1000, 1400, 1800, 2200],
  width: 90,
  lane: 22,
};
export const BEACH_X = 3150;
export const WATER_X = 3250;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  ammoMax: 12,
  pistolDamage: 12,
  pistolRange: 620,
  punchDamage: 15,
  punchRange: 58,
  punchCooldown: 0.4,
  reloadTime: 1.1,
};

export const CAR_TYPES = {
  sedan: { name: 'Sedan', length: 64, width: 30, maxSpeed: 480, accel: 330, color: '#7d8aa0', parkedColor: '#5d7a9e' },
  taxi: { name: 'Taxi', length: 64, width: 30, maxSpeed: 460, accel: 330, color: '#f2c94c', parkedColor: '#d9a521' },
  truck: { name: 'Truck', length: 84, width: 34, maxSpeed: 380, accel: 260, color: '#8a6f4d', parkedColor: '#6f5a3c' },
  sports: { name: 'Comet GT', length: 66, width: 30, maxSpeed: 560, accel: 420, color: '#e5534b', parkedColor: '#c93a32' },
};

export const COP = {
  radius: 16,
  maxSpeed: 345,
  arriveRange: 130,
  arriveFactor: 0.45,
  arrestRange: 60,
  arrestTime: 1.2,
  spawnDistance: [520, 800],
  despawnDistance: 1700,
  ramSlow: 0.55,
};

export const THUG = { radius: 14, health: 30, speed: 150, shootRange: 420, shootInterval: 1.1, bulletSpeed: 460, damage: 8 };

/** Five missions in order: name, reward, and what completes it. */
export const MISSIONS = [
  { name: 'First Delivery', reward: 300, hint: 'Reach the drop point' },
  { name: 'Hot Wheels', reward: 500, hint: 'Steal the red Comet GT' },
  { name: 'Cash Run', reward: 700, hint: 'Collect 5 cash drops' },
  { name: 'Lose the Heat', reward: 900, hint: 'Survive 60 s at 3 stars' },
  { name: 'The Big Score', reward: 1500, hint: 'Grab the vault cash, then escape' },
];

export const WANTED = {
  max: 5,
  heatMax: 100,
  heatRiseNear: 30,
  heatDecayFar: 12,
  copNearRange: 600,
};

/** Seconds of one full day/night cycle. */
export const DAY_LENGTH = 240;

export const PALETTE = {
  backdrop: '#0d0f14',
  grass: '#1d2b1e',
  sand: '#b09a6a',
  water: '#1d4e6b',
  road: '#23262e',
  roadEdge: '#3a3f4c',
  sidewalk: '#2e323d',
  building: '#39415a',
  buildingRoof: '#4a5470',
  park: '#24402a',
  tree: '#2f6b3a',
  player: '#4fc3f7',
  playerOutline: '#0b2a3a',
  ped: '#c8b08a',
  thug: '#e5534b',
  cash: '#58d68d',
  health: '#f2f2f2',
  cop: '#2f6fd0',
  copLightRed: '#ff3b30',
  copLightBlue: '#3b82ff',
  objective: '#ffd23f',
  text: '#eef1f5',
  muted: '#8b93a3',
  panel: 'rgba(12, 14, 20, 0.78)',
  title: '#ffd23f',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-bay.save.v1';
