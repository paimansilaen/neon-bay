// Neon Bay: every tuning number and colour in one place.
// The city is 3400x2600 world units; the camera follows the player, so no
// rule below depends on the screen size.

export const CITY = { width: 3400, height: 2600 };
export const ROAD_WIDTH = 120;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'neon-bay.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  runSpeed: 285,
  health: 100,
  pistolAmmo: 12,
  reloadSeconds: 1.2,
  punchRange: 46,
  punchDamage: 1,
};

export const CAR = {
  // px/s^2 acceleration, top speed px/s, steering radians/s at full lock.
  sedan: { accel: 420, top: 430, reverse: 150, steer: 2.6, color: '#5b8dd9', name: 'Sedan' },
  taxi: { accel: 400, top: 410, reverse: 150, steer: 2.6, color: '#f2c94c', name: 'Taxi' },
  truck: { accel: 260, top: 330, reverse: 120, steer: 2.0, color: '#7d8a99', name: 'Truck' },
  sports: { accel: 620, top: 560, reverse: 170, steer: 3.1, color: '#e5484d', name: 'Comet GT' },
  police: { accel: 520, top: 500, reverse: 160, steer: 3.0, color: '#2f3542', name: 'Police' },
};

export const TRAFFIC_SPEED = 150;
export const COP_SPEED = 300;
export const COP_SPAWN_DISTANCE = 520;
export const COP_ARREST_DISTANCE = 34;
export const COP_ARREST_SECONDS = 0.8;
export const COP_NEAR_DISTANCE = 520;
export const HEAT_DECAY_PER_SECOND = 0.12;
export const MAX_WANTED = 5;

export const BULLET_SPEED = 720;
export const BULLET_LIFE = 0.9;

export const THUG_HEALTH = 3;
export const THUG_SHOT_INTERVAL = 1.9;

export const MISSIONS = [
  { name: 'First Delivery', pay: 300, hint: 'Reach the yellow marker to drop the package.' },
  { name: 'Hot Wheels', pay: 500, hint: 'Steal the red Comet GT parked on the street.' },
  { name: 'Cash Run', pay: 700, hint: 'Grab all 5 cash drops. The crew shoots back.' },
  { name: 'Lose the Heat', pay: 900, hint: 'Survive 60 seconds at 3 stars.' },
  { name: 'The Big Score', pay: 1500, hint: 'Hit the bank, then reach the getaway marker.' },
];

/** Seconds of day in one full day/night cycle. */
export const DAY_LENGTH = 240;

export const PALETTE = {
  ground: '#3a3f46',
  sidewalk: '#565c66',
  road: '#23262c',
  roadLine: '#c8b45a',
  park: '#2e6b34',
  parkDark: '#25592b',
  sand: '#d9c48a',
  water: '#1d6f9e',
  waterDeep: '#155a82',
  buildingRoof: ['#7a6a8f', '#8f6a6a', '#6a8f7a', '#6a7a8f', '#8f8a6a', '#746a8f'],
  buildingEdge: '#20242b',
  player: '#ff8c1a',
  playerDark: '#c96a00',
  ped: ['#e8e8e8', '#9ecfff', '#ffb3c1', '#b5e6a2', '#ffd9a0'],
  thug: '#c22730',
  cop: '#2f3542',
  copLight: '#ff3b30',
  copLight2: '#2f7bff',
  cash: '#37d67a',
  health: '#37d67a',
  bullet: '#ffe14d',
  text: '#f2f4f6',
  muted: '#aab2bd',
  gold: '#f2c94c',
  panel: 'rgba(12, 14, 18, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
