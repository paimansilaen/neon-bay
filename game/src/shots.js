// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createScriptedInput } from './input.js';
import { angleDiff, chooseRoadHeading, nearestRoadPoint, randomRoadPoint } from './city.js';
import { SCREEN_PLAY, SCREEN_TITLE, cameraFor } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 12;
const MISSION_SECONDS = 16;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Step the world for `seconds`, re-aiming the camera and the autopilot each frame. */
function runSteps(world, input, seconds, steer) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    const cam = cameraFor(state, 1280, 720);
    world.setView(cam.x, cam.y, cam.w, cam.h, 1280, 720);
    if (steer) steer(input, world);
    world.step(STEP, input);
    if (world.state.busted) break;
  }
}

function idleInput() {
  return createScriptedInput();
}

/** Walk the player toward road points, one after another. */
function walkAutopilot(rng) {
  let target = null;
  return (input, world) => {
    const state = world.state;
    const p = state.player;
    if (p.inCar !== null) return;
    if (!target || Math.hypot(target.x - p.x, target.y - p.y) < 50) {
      target = randomRoadPoint(rng);
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    input.set({
      move: { x: dx / len, y: dy / len },
      run: false,
      mouse: { x: 640, y: 360, down: false },
    });
  };
}

/** Drive along the roads toward a far target, re-picking it when reached. */
function driveAutopilot(rng) {
  let target = null;
  return (input, world) => {
    const state = world.state;
    const p = state.player;
    if (p.inCar === null) return;
    const car = p.inCar;
    if (!target || Math.hypot(target.x - car.x, target.y - car.y) < 260) {
      target = randomRoadPoint(rng);
    }
    const want = chooseRoadHeading(world.city, car.x, car.y, car.angle, target.x, target.y);
    const steer = clamp(angleDiff(car.angle, want) * 2.2, -1, 1);
    input.set({
      move: { x: steer, y: -1 },
      brake: Math.abs(angleDiff(car.angle, want)) > 1.1,
      mouse: { x: 640, y: 360, down: false },
    });
  };
}

/**
 * Set `world` to the named scene (start, play, chase or mission; any other
 * name is start) and return the screen to draw over it.
 */
export function stageShot(name, world, seed) {
  world.reset();
  const rng = createRandom(seed ^ 0x9e3779b9);
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    runSteps(world, idleInput(), START_SECONDS, null);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    runSteps(world, createScriptedInput(), PLAY_SECONDS, walkAutopilot(rng));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    world.placePlayerInCar('sedan');
    world.setWanted(2);
    runSteps(world, createScriptedInput(), CHASE_SECONDS, driveAutopilot(rng));
    return { screen: SCREEN_PLAY };
  }
  // Mission: Cash Run, mid-job. The player starts beside the nearest cash
  // drop so the frame shows the job, the thugs and the money.
  world.startMission(2);
  const state = world.state;
  const cash = state.pickups.find((pack) => pack.kind === 'cash');
  if (cash) {
    const spot = nearestRoadPoint(cash.x, cash.y);
    state.player.x = spot.x;
    state.player.y = spot.y + 30;
  }
  runSteps(world, createScriptedInput(), MISSION_SECONDS, walkAutopilot(rng));
  return { screen: SCREEN_PLAY };
}
