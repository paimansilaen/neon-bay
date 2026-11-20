// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what a short game really looks like and the same seed always gives the same frame.
// The start scene clears the save first, so the title always shows a fresh game ($0, 0/5).
import { STEP } from './config.js';
import { roadPath, roadPointNear } from './city.js';
import { createRandom } from './random.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 12;
const CHASE_SECONDS = 10;
const MISSION_SECONDS = 12;

function emptyInput() {
  return {
    move: { x: 0, y: 0, run: false, handbrake: false },
    aim: null, shoot: false, punch: false, reload: false, enter: false, mission: false,
  };
}

/** On-foot autopilot: Manhattan movement toward (tx, ty), staying on the roads. */
function walkToward(world, tx, ty) {
  const input = emptyInput();
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  input.move.run = true;
  if (Math.abs(dx) > 30 && Math.abs(dx) >= Math.abs(dy)) input.move.x = Math.sign(dx);
  else if (Math.abs(dy) > 30) input.move.y = Math.sign(dy);
  else if (Math.abs(dx) > 30) input.move.x = Math.sign(dx);
  return input;
}

/** Driving autopilot: follow the road graph toward a far road point, turning at intersections. */
function driveToward(world, target) {
  const input = emptyInput();
  const p = world.state.player;
  const path = roadPath(p.x, p.y, target.x, target.y);
  const waypoint = path.length > 0 ? path[0] : target;
  const desired = Math.atan2(waypoint.y - p.y, waypoint.x - p.x);
  let diff = desired - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.move.x = Math.max(-1, Math.min(1, diff * 2.5));
  input.move.y = -1;
  return input;
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other name is start) and
 * return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  // One fixed seed per scene, so the same shot always stages the same frame.
  const random = createRandom(name === 'chase' ? 7 : name === 'mission' ? 11 : 3);
  if (name === 'play') {
    world.reset();
    const target = roadPointNear(state.player.x, state.player.y, 500, 900, random);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) world.step(STEP, walkToward(world, target.x, target.y));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    world.reset();
    // Put the player in a parked car on the road, then draw two stars of heat.
    const parked = state.cars.find((c) => c.parked && (c.type === 'sports' || c.type === 'sedan')) ?? state.cars.find((c) => c.parked);
    if (parked) {
      state.player.x = parked.x + 50;
      state.player.y = parked.y;
      world.step(STEP, { ...emptyInput(), enter: true });
    }
    world.gainWanted(2);
    const target = roadPointNear(state.player.x, state.player.y, 700, 1200, random);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) world.step(STEP, driveToward(world, target));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    world.reset();
    // Stage the third mission directly: Cash Run, with one drop already collected.
    state.missionsDone = 2;
    world.startMission();
    const drops = state.pickups.filter((pk) => pk.kind === 'cash');
    if (drops.length > 0) {
      state.player.x = drops[0].x + 30;
      state.player.y = drops[0].y;
      for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, emptyInput());
    }
    const remaining = state.pickups.filter((pk) => pk.kind === 'cash');
    const target = remaining.length > 0 ? remaining[0] : { x: 600, y: 1000 };
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) world.step(STEP, walkToward(world, target.x, target.y));
    return { screen: SCREEN_PLAY };
  }
  // Start: a fresh game, always — the save is cleared so no stale money leaks into the title.
  world.clearSave();
  world.reset();
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, emptyInput());
  return { screen: SCREEN_TITLE };
}
