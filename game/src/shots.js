// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// road-following autopilot that drives the grid toward the current objective (with
// a reverse-out when it gets wedged), so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

function blankInput() {
  return { mx: 0, my: 0, run: false, handbrake: false, aimX: 0, aimY: 0, shooting: false, punch: false, interact: false, reload: false, mission: false };
}

function nearestRoad(roads, value) {
  let best = roads[0];
  for (const r of roads) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
  return best;
}

/** Waypoints along the road grid from `from` to `to`: join a road, cross the
 *  grid to the roads nearest the target, then the target itself. */
function planRoute(from, to, city) {
  const vxFrom = nearestRoad(city.vRoads, from.x);
  const hyFrom = nearestRoad(city.hRoads, from.y);
  const vxTo = nearestRoad(city.vRoads, to.x);
  const hyTo = nearestRoad(city.hRoads, to.y);
  const onVertical = Math.abs(from.x - vxFrom) < Math.abs(from.y - hyFrom);
  const route = [];
  if (onVertical) route.push({ x: vxFrom, y: from.y });
  else route.push({ x: from.x, y: hyFrom });
  route.push({ x: vxTo, y: route[0].y });
  route.push({ x: vxTo, y: hyTo });
  route.push({ x: to.x, y: to.y });
  return route;
}

function makeDriver(state) {
  let route = null;
  let routeIndex = 0;
  let routeTarget = null;
  let stuckTimer = 0;
  let reverseTimer = 0;
  return function drive(target) {
    const input = blankInput();
    const p = state.player;
    // Re-plan when the objective moves.
    if (!routeTarget || Math.hypot(routeTarget.x - target.x, routeTarget.y - target.y) > 60) {
      route = planRoute({ x: p.x, y: p.y }, target, state.city);
      routeIndex = 0;
      routeTarget = { x: target.x, y: target.y };
    }
    const wp = route[Math.min(routeIndex, route.length - 1)];
    const d = Math.hypot(wp.x - p.x, wp.y - p.y);
    if (d < 46 && routeIndex < route.length - 1) routeIndex += 1;
    if (p.inCar) {
      const car = p.inCar;
      const speed = Math.abs(car.speed);
      if (reverseTimer > 0) {
        reverseTimer -= STEP;
        input.my = 0.7;
        input.mx = -clamp(wrapAngle(Math.atan2(wp.y - car.y, wp.x - car.x) - car.angle) * 2, -1, 1);
        return input;
      }
      if (speed < 12) {
        stuckTimer += STEP;
        if (stuckTimer > 1.6) { stuckTimer = 0; reverseTimer = 0.9; }
      } else stuckTimer = 0;
      const diff = wrapAngle(Math.atan2(wp.y - car.y, wp.x - car.x) - car.angle);
      input.mx = clamp(diff * 2.5, -1, 1);
      // Ease off the throttle into sharp turns instead of ploughing through them.
      input.my = Math.abs(diff) > 2.4 ? 0.6 : Math.abs(diff) > 1.0 ? 0 : -1;
      input.aimX = wp.x;
      input.aimY = wp.y;
    } else {
      if (d > 12) {
        input.mx = (wp.x - p.x) / d;
        input.my = (wp.y - p.y) / d;
        input.run = true;
      }
      input.aimX = wp.x;
      input.aimY = wp.y;
    }
    return input;
  };
}

function putPlayerInCar(world, type) {
  const state = world.state;
  for (const car of state.cars) {
    if (!car.active || car.kind !== 'parked') continue;
    if (type && car.type !== type) continue;
    state.player.inCar = car;
    car.kind = 'traffic';
    state.player.x = car.x;
    state.player.y = car.y;
    return car;
  }
  return null;
}

/** Stage a car mid-drive on a straight road so the shot catches it at speed.
 *  The player's position is synced too: the autopilot plans its route from
 *  where the player is, so a stale player position would send it cross-country. */
function placeCarAtSpeed(state, car, x, y, angle, speed) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a live city. play: driving to the first mission objective.
 * chase: three-star police chase. mission: mission briefing with marker on screen.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'play' || name === 'mission') {
    world.startMission();
    const car = putPlayerInCar(world, name === 'mission' ? 'sedan' : null);
    const drive = makeDriver(state);
    if (name === 'play') {
      // Stage the car mid-drive on the north road, heading for the Dockside
      // pickup at speed, and run just long enough to settle the frame.
      if (car) placeCarAtSpeed(state, car, 900, 130, Math.PI, 260);
      for (let i = 0; i < 2 / STEP; i += 1) {
        const cur = world.currentStep();
        const target = cur && cur.x !== undefined ? { x: cur.x, y: cur.y } : { x: 1500, y: 1500 };
        world.step(STEP, drive(target), false);
        if (state.over) break;
      }
      return { screen: SCREEN_PLAY };
    }
    const seconds = 7;
    for (let i = 0; i < seconds / STEP; i += 1) {
      const cur = world.currentStep();
      const target = cur && cur.x !== undefined ? { x: cur.x, y: cur.y } : { x: 1500, y: 1500 };
      world.step(STEP, drive(target), false);
      if (state.over) break;
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    const car = putPlayerInCar(world, 'sports');
    state.wanted = 3;
    state.lastCrime = 0;
    const drive = makeDriver(state);
    // Stage the sports car mid-flight east on Palm Row with the cops behind it.
    if (car) placeCarAtSpeed(state, car, 700, 1150, 0, 320);
    const target = { x: 2500, y: 2000 };
    // Let the patrol cars spawn, then line them up behind the player instead
    // of leaving one in its path.
    world.step(STEP, drive(target), false);
    let i = 0;
    for (const c of state.cars) {
      if (!c.active || c.kind !== 'cop') continue;
      c.x = car.x - 260 - i * 70;
      c.y = 1150;
      c.angle = 0;
      c.speed = 300;
      c.axis = 'x'; c.dir = 1; c.road = 1150; c.lane = 0;
      i += 1;
    }
    // Clear all other cars from the chase: the traffic spawner refills the
    // streets every step, so this runs after every step of the shot.
    const clearOtherCars = () => {
      for (const c of state.cars) {
        if (c.active && (c.kind === 'traffic' || c.kind === 'parked') && c !== car) c.active = false;
      }
    };
    clearOtherCars();
    for (let s = 0; s < 2.5 / STEP; s += 1) {
      world.step(STEP, drive(target), false);
      clearOtherCars();
      if (state.over) break;
    }
    return { screen: state.over === 'busted' ? SCREEN_BUSTED : SCREEN_PLAY };
  }
  // start (default): a live city behind the title.
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, blankInput(), true);
  return { screen: SCREEN_TITLE };
}
