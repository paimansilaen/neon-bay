// NEON BAY — an original open-world crime game. All names, characters, places and
// story are invented for this entry; nothing here comes from any commercial game.
export const SAVE_KEY = 'neonbay-save-v1';
export const STEP = 1 / 60;

export const WORLD = {
  width: 3400,
  height: 2600,
  roadWidth: 72,
  block: 340, // road centre lines are this far apart
  beachX: 3180, // east of this is sand, then water
  waterX: 3300,
};

export const CAR_TYPES = {
  sedan: { name: 'Sedan', top: 150, accel: 260, brake: 420, max: 330, turn: 2.6, color: '#4a7ec2', color2: '#355c8f' },
  taxi: { name: 'Taxi', top: 165, accel: 270, brake: 430, max: 350, turn: 2.7, color: '#e8b820', color2: '#b98f0a' },
  truck: { name: 'Truck', top: 120, accel: 180, brake: 380, max: 260, turn: 1.9, color: '#7a6a55', color2: '#5d5040' },
  sports: { name: 'Sports', top: 210, accel: 360, brake: 480, max: 460, turn: 3.1, color: '#c23b4a', color2: '#8f2430' },
  cop: { name: 'Patrol', top: 180, accel: 320, brake: 500, max: 400, turn: 3.0, color: '#1c1e26', color2: '#f2f2f2' },
};

export const PLAYER = {
  walkSpeed: 190,
  runSpeed: 260,
  radius: 14,
  health: 100,
  pistolAmmo: 24,
  punchDamage: 12,
  bulletDamage: 34,
};

export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Delivery',
    reward: 300,
    timeLimit: 100,
    brief: [
      'MARA: Jax, the crew needs a courier who can actually drive.',
      'MARA: Take this package from the Dockside to the Neon Diner. Fast. No questions.',
    ],
    steps: [
      { type: 'goto', label: 'Pick up the package at the Dockside', x: 210, y: 210, radius: 70 },
      { type: 'goto', label: 'Deliver to the Neon Diner', x: 2890, y: 2130, radius: 70 },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Wheels',
    reward: 500,
    timeLimit: 120,
    brief: [
      'MARA: The crew needs a Comet GT — red, parked by the marina.',
      'MARA: Steal it and bring it to the garage on Palm Row. Cops will notice. Obviously.',
    ],
    steps: [
      { type: 'steal', label: 'Steal the red Comet GT at the marina', x: 3050, y: 700, radius: 90 },
      { type: 'deliverCar', label: 'Deliver the Comet GT to the garage', x: 760, y: 1790, radius: 80 },
    ],
  },
  {
    id: 'm3',
    title: 'Cash Run',
    reward: 700,
    timeLimit: 150,
    brief: [
      'MARA: Five cash drops are stashed around Neon Bay. Collect them all.',
      'MARA: Word is the rival Dockside crew is out tonight. Keep your pistol handy.',
    ],
    steps: [
      { type: 'collect', label: 'Collect the cash drops (0/5)', count: 5, radius: 60 },
    ],
  },
  {
    id: 'm4',
    title: 'Lose the Heat',
    reward: 900,
    timeLimit: 75,
    brief: [
      'MARA: You tripped every alarm in the district. Three stars, Jax.',
      'MARA: Survive 60 seconds, then reach the hideout under the rail bridge.',
    ],
    steps: [
      { type: 'survive', label: 'Survive the heat — stay alive 60s', seconds: 60 },
      { type: 'goto', label: 'Reach the hideout', x: 1240, y: 1240, radius: 80 },
    ],
  },
  {
    id: 'm5',
    title: 'The Big Score',
    reward: 1500,
    timeLimit: 150,
    brief: [
      'MARA: One last job. The Bay Tower vault courier is leaving at dawn.',
      'MARA: Grab the case, lose the cops, and bring it home. Then we are done.',
    ],
    steps: [
      { type: 'goto', label: 'Grab the case at Bay Tower', x: 2210, y: 890, radius: 70 },
      { type: 'goto', label: 'Bring the case to the hideout', x: 1240, y: 1240, radius: 80 },
    ],
  },
];
