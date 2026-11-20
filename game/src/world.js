// Neon Bay's rules: the player on foot or in a car, traffic, pedestrians,
// police, thugs, missions and the wanted level. Everything here is pure
// simulation; rendering lives in render.js and sound in audio.js.

import {
  BULLET_LIFE,
  BULLET_SPEED,
  CAR,
  CITY,
  COP_ARREST_DISTANCE,
  COP_ARREST_SECONDS,
  COP_NEAR_DISTANCE,
  COP_SPAWN_DISTANCE,
  COP_SPEED,
  DAY_LENGTH,
  HEAT_DECAY_PER_SECOND,
  MAX_WANTED,
  MISSIONS,
  PLAYER,
  ROAD_WIDTH,
  SAVE_KEY,
  THUG_HEALTH,
  THUG_SHOT_INTERVAL,
  TRAFFIC_SPEED,
} from './config.js';
import {
  angleDiff,
  chooseRoadHeading,
  createCity,
  nearestRoadPoint,
  randomRoadPoint,
  resolveCircle,
  roadHeadings,
} from './city.js';
import { createRandom, randomPick } from './random.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_PUNCH,
  ACTION_RELOAD,
  ACTION_SHOOT,
} from './input.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CASH = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_CRASH = 64;
export const EVENT_RELOAD = 128;
export const EVENT_PUNCH = 256;
export const EVENT_SIREN = 512;

const CAR_TYPES = ['sedan', 'sedan', 'taxi', 'taxi', 'truck', 'sports'];
const TRAFFIC_COUNT = 10;
const PARKED_COUNT = 6;
const PED_COUNT = 14;
const HEALTH_PACK_COUNT = 4;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeCar(id, type, x, y, angle, driver) {
  return {
    id,
    type,
    x,
    y,
    angle,
    speed: 0,
    driver,
    color: CAR[type].color,
    cruise: TRAFFIC_SPEED * (0.85 + Math.random() * 0.3),
    arrestTimer: 0,
    stun: 0,
  };
}

export function createWorld(seed) {
  const world = {
    seed,
    city: null,
    state: null,
    rng: null,
    view: { x: 0, y: 0, w: 1280, h: 720, pw: 1280, ph: 720 },
    sirenTimer: 0,
  };

  function spawnTrafficCar(id, rng) {
    const point = randomRoadPoint(rng);
    const headings = roadHeadings(world.city, point.x, point.y);
    const angle = headings.length > 0 ? headings[Math.floor(rng() * headings.length)] : 0;
    const car = makeCar(id, randomPick(rng, CAR_TYPES), point.x, point.y, angle, 'traffic');
    car.speed = car.cruise;
    return car;
  }

  function spawnParkedCar(id, rng) {
    const point = randomRoadPoint(rng);
    const headings = roadHeadings(world.city, point.x, point.y);
    const angle = headings.length > 0 ? headings[Math.floor(rng() * headings.length)] : 0;
    // Parked along the roadside, clear of the driving lane.
    const side = rng() < 0.5 ? 1 : -1;
    const px = point.x + Math.cos(angle + Math.PI / 2) * side * (ROAD_WIDTH / 2 - 18);
    const py = point.y + Math.sin(angle + Math.PI / 2) * side * (ROAD_WIDTH / 2 - 18);
    const spot = resolveCircle(world.city, px, py, 18);
    return makeCar(id, randomPick(rng, CAR_TYPES), spot.x, spot.y, angle, 'parked');
  }

  function spawnPed(id, rng) {
    const point = randomRoadPoint(rng);
    const headings = roadHeadings(world.city, point.x, point.y);
    const angle = headings.length > 0 ? headings[Math.floor(rng() * headings.length)] : 0;
    const side = rng() < 0.5 ? 1 : -1;
    const x = point.x + Math.cos(angle + Math.PI / 2) * side * (ROAD_WIDTH / 2 - 16);
    const y = point.y + Math.sin(angle + Math.PI / 2) * side * (ROAD_WIDTH / 2 - 16);
    return {
      id,
      x,
      y,
      angle,
      speed: 42 + rng() * 30,
      flee: 0,
      fleeX: 0,
      fleeY: 0,
      color: ['#e8e8e8', '#9ecfff', '#ffb3c1', '#b5e6a2', '#ffd9a0'][Math.floor(rng() * 5)],
      down: 0,
    };
  }

  function spawnHealthPack(rng) {
    const point = randomRoadPoint(rng);
    return { kind: 'health', x: point.x, y: point.y, respawn: 0 };
  }

  function reset() {
    world.rng = createRandom(world.seed);
    const rng = world.rng;
    world.city = createCity(rng);
    const start = nearestRoadPoint(1700, 1400);
    const state = {
      money: 0,
      missionsDone: 0,
      health: PLAYER.health,
      ammo: PLAYER.pistolAmmo,
      reloadTimer: 0,
      punchTimer: 0,
      player: { x: start.x, y: start.y - 40, angle: -Math.PI / 2, inCar: null },
      cars: [],
      peds: [],
      thugs: [],
      bullets: [],
      particles: [],
      skids: [],
      pickups: [],
      mission: null,
      wantedHeat: 0,
      stars: 0,
      time: 60,
      busted: false,
      bustedTimer: 0,
      message: '',
      messageTimer: 0,
      copSpawnTimer: 0,
      nextCarId: 1,
      nextPedId: 1,
    };
    world.state = state;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar(state.nextCarId, rng));
    state.nextCarId += TRAFFIC_COUNT;
    for (let i = 0; i < PARKED_COUNT; i += 1) state.cars.push(spawnParkedCar(state.nextCarId, rng));
    state.nextCarId += PARKED_COUNT;
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPed(state.nextPedId, rng));
    state.nextPedId += PED_COUNT;
    for (let i = 0; i < HEALTH_PACK_COUNT; i += 1) state.pickups.push(spawnHealthPack(rng));
    return state;
  }

  function burst(x, y, color, count, speed) {
    const state = world.state;
    for (let i = 0; i < count; i += 1) {
      const a = world.rng() * Math.PI * 2;
      const v = speed * (0.3 + world.rng() * 0.7);
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.4 + world.rng() * 0.5,
        maxLife: 0.9,
        color,
        size: 2 + world.rng() * 3,
      });
    }
  }

  function setMessage(text, seconds) {
    world.state.message = text;
    world.state.messageTimer = seconds;
  }

  function addHeat(amount) {
    const state = world.state;
    state.wantedHeat = clamp(state.wantedHeat + amount, 0, MAX_WANTED);
    state.stars = Math.ceil(state.wantedHeat);
  }

  function cops() {
    return world.state.cars.filter((c) => c.driver === 'police');
  }

  function spawnCop() {
    const state = world.state;
    const rng = world.rng;
    const p = state.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const angle = rng() * Math.PI * 2;
      const d = COP_SPAWN_DISTANCE + rng() * 180;
      const spot = nearestRoadPoint(p.x + Math.cos(angle) * d, p.y + Math.sin(angle) * d);
      if (!spot) continue;
      if (dist(spot.x, spot.y, p.x, p.y) < 380) continue;
      const car = makeCar(state.nextCarId, 'police', spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), 'police');
      state.nextCarId += 1;
      car.speed = COP_SPEED;
      state.cars.push(car);
      return car;
    }
    return null;
  }

  function startMission(index) {
    const state = world.state;
    const rng = world.rng;
    if (index < 0 || index >= MISSIONS.length) return false;
    const def = MISSIONS[index];
    const mission = { index, name: def.name, pay: def.pay, stage: '', target: null, timer: 0, collected: 0, total: 0, carId: 0 };
    if (index === 0) {
      mission.stage = 'go';
      mission.target = randomRoadPoint(rng);
    } else if (index === 1) {
      mission.stage = 'steal';
      const point = randomRoadPoint(rng);
      const headings = roadHeadings(world.city, point.x, point.y);
      const angle = headings.length > 0 ? headings[0] : 0;
      const car = makeCar(state.nextCarId, 'sports', point.x, point.y, angle, 'parked');
      state.nextCarId += 1;
      car.color = '#e5484d';
      state.cars.push(car);
      mission.carId = car.id;
      mission.target = { x: point.x, y: point.y };
    } else if (index === 2) {
      mission.stage = 'collect';
      mission.total = 5;
      for (let i = 0; i < 5; i += 1) {
        const point = randomRoadPoint(rng);
        state.pickups.push({ kind: 'cash', x: point.x, y: point.y, respawn: 0 });
      }
      for (let i = 0; i < 3; i += 1) {
        const point = randomRoadPoint(rng);
        state.thugs.push({ x: point.x, y: point.y, health: THUG_HEALTH, shootTimer: 1 + rng() * 1.5, angle: 0 });
      }
    } else if (index === 3) {
      mission.stage = 'survive';
      mission.timer = 60;
      state.wantedHeat = 3;
      state.stars = 3;
    } else if (index === 4) {
      mission.stage = 'bank';
      mission.target = randomRoadPoint(rng);
    }
    state.mission = mission;
    setMessage(`${def.name}: ${def.hint}`, 5);
    return true;
  }

  function completeMission() {
    const state = world.state;
    const mission = state.mission;
    if (!mission) return 0;
    state.money += mission.pay;
    state.missionsDone += 1;
    state.mission = null;
    setMessage(`${mission.name} complete! +$${mission.pay}`, 4);
    return EVENT_MISSION;
  }

  function bust(reason) {
    const state = world.state;
    if (state.busted) return 0;
    state.busted = true;
    state.bustedTimer = 0;
    state.wantedHeat = 0;
    state.stars = 0;
    if (state.player.inCar !== null) {
      state.player.inCar.driver = 'parked';
      state.player.inCar.speed = 0;
    }
    state.player.inCar = null;
    setMessage(reason, 4);
    return EVENT_BUSTED;
  }

  function respawn() {
    const state = world.state;
    const spot = nearestRoadPoint(1700, 1400);
    state.player.x = spot.x;
    state.player.y = spot.y - 40;
    state.player.angle = -Math.PI / 2;
    state.player.inCar = null;
    state.health = PLAYER.health;
    state.ammo = PLAYER.pistolAmmo;
    state.reloadTimer = 0;
    state.busted = false;
    state.bustedTimer = 0;
    state.bullets = [];
    // The crew stands down; an active mission keeps its progress, except the
    // Heat mission, which restarts its 60 seconds.
    for (const car of state.cars) {
      if (car.driver === 'police') car.stun = 99;
    }
    if (state.mission && state.mission.index === 3) state.mission.timer = 60;
    setMessage('Back on the streets. Money and missions kept.', 4);
  }

  function saveGame() {
    try {
      const state = world.state;
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ money: state.money, missionsDone: state.missionsDone, health: state.health }),
      );
    } catch {
      // Storage can be off: the save then lasts this visit only.
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const state = world.state;
      if (typeof data.money === 'number') state.money = data.money;
      if (typeof data.missionsDone === 'number') state.missionsDone = Math.min(data.missionsDone, MISSIONS.length);
      if (typeof data.health === 'number') state.health = clamp(data.health, 1, PLAYER.health);
      return true;
    } catch {
      return false;
    }
  }

  function clearSave() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing to clear when storage is off.
    }
  }

  function stepPlayer(dt, input) {
    const state = world.state;
    const p = state.player;
    const move = input.move();
    const mouse = input.mouse();
    if (state.reloadTimer > 0) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        state.ammo = PLAYER.pistolAmmo;
      }
    }
    if (state.punchTimer > 0) state.punchTimer -= dt;

    // Aim: the mouse position in world coordinates, from the camera view.
    const aimWorldX = world.view.x + (mouse.x / Math.max(1, world.view.pw)) * world.view.w;
    const aimWorldY = world.view.y + (mouse.y / Math.max(1, world.view.ph)) * world.view.h;
    if (p.inCar === null && (mouse.x !== 0 || mouse.y !== 0)) {
      p.angle = Math.atan2(aimWorldY - p.y, aimWorldX - p.x);
    }

    const actions = input.takeActions();
    let events = 0;

    if (p.inCar !== null) {
      const car = p.inCar;
      const tune = CAR[car.type];
      const throttle = -move.y;
      const steering = move.x;
      if (throttle > 0) car.speed += tune.accel * dt;
      else if (throttle < 0) {
        if (car.speed > 0) car.speed -= 700 * dt;
        else car.speed -= tune.accel * 0.6 * dt;
      } else {
        car.speed -= car.speed * 0.5 * dt;
      }
      if (input.isHandbrake()) {
        car.speed -= car.speed * 2.0 * dt;
      }
      car.speed = clamp(car.speed, -tune.reverse, tune.top);
      const f = clamp(car.speed / 140, -1, 1);
      const steerRate = tune.steer * (input.isHandbrake() ? 1.45 : 1);
      car.angle += steering * steerRate * dt * f;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      const fixed = resolveCircle(world.city, nx, ny, 16);
      const hitWall = Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5;
      car.x = fixed.x;
      car.y = fixed.y;
      if (hitWall && Math.abs(car.speed) > 220) {
        car.speed *= -0.3;
        burst(car.x, car.y, '#ffb347', 10, 160);
        events |= EVENT_CRASH;
      }
      if (input.isHandbrake() && Math.abs(car.speed) > 120) {
        state.skids.push({ x: before.x, y: before.y, angle: car.angle, life: 3 });
        if (world.rng() < 0.3) burst(car.x, car.y, '#9aa0a6', 1, 40);
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (actions & ACTION_ENTER) {
        // Step out beside the car, on the road.
        const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 26, y: car.y + Math.sin(car.angle + Math.PI / 2) * 26 };
        const spot = resolveCircle(world.city, side.x, side.y, PLAYER.radius);
        p.x = spot.x;
        p.y = spot.y;
        car.driver = 'parked';
        car.speed = 0;
        p.inCar = null;
      }
      return events;
    }

    // On foot.
    const speed = input.isRun() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(move.x, move.y);
    if (len > 0) {
      const nx = p.x + (move.x / len) * speed * dt;
      const ny = p.y + (move.y / len) * speed * dt;
      const fixed = resolveCircle(world.city, nx, ny, PLAYER.radius);
      p.x = fixed.x;
      p.y = fixed.y;
    }
    if (actions & ACTION_ENTER) {
      let best = null;
      let bestD = 64;
      for (const car of state.cars) {
        if (car.driver === 'police') continue;
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      if (best !== null) {
        if (best.driver === 'traffic') {
          // Stealing a driven car: the driver flees on foot and the heat rises.
          addHeat(1);
          const ped = {
            id: state.nextPedId,
            x: best.x + 24,
            y: best.y,
            angle: world.rng() * Math.PI * 2,
            speed: 120,
            flee: 2,
            fleeX: best.x + 200,
            fleeY: best.y,
            color: '#e8e8e8',
            down: 0,
          };
          state.nextPedId += 1;
          state.peds.push(ped);
          setMessage('Car stolen! The cops are coming.', 3);
        }
        best.driver = 'player';
        best.speed = 0;
        p.inCar = best;
      }
    }
    if (actions & ACTION_PUNCH && state.punchTimer <= 0) {
      state.punchTimer = 0.45;
      events |= EVENT_PUNCH;
      for (const thug of state.thugs) {
        const d = dist(p.x, p.y, thug.x, thug.y);
        if (d < PLAYER.punchRange + 14 && Math.abs(angleDiff(p.angle, Math.atan2(thug.y - p.y, thug.x - p.x))) < 1.2) {
          thug.health -= PLAYER.punchDamage;
          burst(thug.x, thug.y, '#ff5a5a', 8, 140);
          events |= EVENT_HIT;
        }
      }
    }
    if (actions & ACTION_RELOAD && state.ammo < PLAYER.pistolAmmo && state.reloadTimer <= 0) {
      state.reloadTimer = PLAYER.reloadSeconds;
      events |= EVENT_RELOAD;
    }
    if (actions & ACTION_SHOOT && state.reloadTimer <= 0) {
      if (state.ammo > 0) {
        state.ammo -= 1;
        const a = p.angle;
        state.bullets.push({
          x: p.x + Math.cos(a) * 20,
          y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * BULLET_SPEED,
          vy: Math.sin(a) * BULLET_SPEED,
          life: BULLET_LIFE,
          from: 'player',
        });
        addHeat(0.25);
        events |= EVENT_SHOT;
      } else {
        state.reloadTimer = PLAYER.reloadSeconds;
        events |= EVENT_RELOAD;
      }
    }
    return events;
  }

  function stepTraffic(dt) {
    const state = world.state;
    for (const car of state.cars) {
      if (car.driver !== 'traffic') continue;
      // At an intersection, pick a new road heading; on a straight road, keep going.
      const options = roadHeadings(world.city, car.x, car.y);
      const currentOk = options.some((h) => Math.abs(angleDiff(h, car.angle)) < 0.1);
      if (!currentOk || options.length > 2) {
        const keep = options.filter((h) => Math.abs(angleDiff(h, car.angle)) < 0.1);
        if (keep.length > 0 && world.rng() < 0.7) {
          car.angle = keep[0];
        } else {
          car.angle = options[Math.floor(world.rng() * options.length)];
        }
      }
      // Slow for the car ahead.
      let target = car.cruise;
      for (const other of state.cars) {
        if (other === car) continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 70) {
          const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
          if (ahead > 0) target = Math.min(target, 40);
        }
      }
      car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveCircle(world.city, nx, ny, 16);
      car.x = fixed.x;
      car.y = fixed.y;
    }
  }

  function stepPolice(dt) {
    const state = world.state;
    const p = state.player;
    const want = state.stars;
    const list = cops();
    // Too many cops: the farthest ones give up first.
    if (list.length > want) {
      list.sort((a, b) => dist(b.x, b.y, p.x, p.y) - dist(a.x, a.y, p.x, p.y));
      for (let i = want; i < list.length; i += 1) {
        const index = state.cars.indexOf(list[i]);
        if (index >= 0) state.cars.splice(index, 1);
      }
    }
    state.copSpawnTimer -= dt;
    if (list.length < want && state.copSpawnTimer <= 0) {
      spawnCop();
      state.copSpawnTimer = 1.2;
    }
    let events = 0;
    for (const cop of cops()) {
      if (cop.stun > 0) {
        cop.stun -= dt;
        cop.speed = Math.max(0, cop.speed - 300 * dt);
        continue;
      }
      const d = dist(cop.x, cop.y, p.x, p.y);
      // Follow the roads toward the player; slow down close in so an arrest
      // can actually happen instead of a high-speed fly-by.
      const options = roadHeadings(world.city, cop.x, cop.y);
      const currentOk = options.some((h) => Math.abs(angleDiff(h, cop.angle)) < 0.1);
      if (!currentOk || options.length > 2) {
        cop.angle = chooseRoadHeading(world.city, cop.x, cop.y, cop.angle, p.x, p.y);
      }
      const near = d < 130;
      const target = near ? COP_SPEED * 0.45 : COP_SPEED;
      cop.speed += clamp(target - cop.speed, -400 * dt, 300 * dt);
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      const fixed = resolveCircle(world.city, nx, ny, 16);
      cop.x = fixed.x;
      cop.y = fixed.y;
      if (d < COP_ARREST_DISTANCE) {
        cop.arrestTimer += dt;
        if (cop.arrestTimer >= COP_ARREST_SECONDS) {
          events |= bust('BUSTED! The Neon Bay PD caught you.');
        }
      } else {
        cop.arrestTimer = Math.max(0, cop.arrestTimer - dt);
      }
    }
    return events;
  }

  function stepPeds(dt) {
    const state = world.state;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      let vx = 0;
      let vy = 0;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const d = Math.max(1, dist(ped.x, ped.y, ped.fleeX, ped.fleeY));
        vx = ((ped.x - ped.fleeX) / d) * 170;
        vy = ((ped.y - ped.fleeY) / d) * 170;
      } else {
        // Danger nearby: a bullet, a fast car, or gunfire makes them run.
        let threat = null;
        for (const b of state.bullets) {
          if (dist(ped.x, ped.y, b.x, b.y) < 130) {
            threat = b;
            break;
          }
        }
        if (!threat) {
          for (const car of state.cars) {
            if (Math.abs(car.speed) > 100 && dist(ped.x, ped.y, car.x, car.y) < 90) {
              threat = car;
              break;
            }
          }
        }
        if (threat) {
          ped.flee = 1.6;
          ped.fleeX = threat.x;
          ped.fleeY = threat.y;
          const td = Math.max(1, dist(ped.x, ped.y, threat.x, threat.y));
          vx = ((ped.x - threat.x) / td) * 170;
          vy = ((ped.y - threat.y) / td) * 170;
        } else {
          const options = roadHeadings(world.city, ped.x, ped.y);
          const currentOk = options.some((h) => Math.abs(angleDiff(h, ped.angle)) < 0.1);
          if (!currentOk || options.length > 2) {
            if (options.length > 0) ped.angle = options[Math.floor(world.rng() * options.length)];
          }
          vx = Math.cos(ped.angle) * ped.speed;
          vy = Math.sin(ped.angle) * ped.speed;
        }
      }
      const nx = ped.x + vx * dt;
      const ny = ped.y + vy * dt;
      const fixed = resolveCircle(world.city, nx, ny, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
  }

  function stepThugs(dt) {
    const state = world.state;
    const p = state.player;
    for (const thug of state.thugs) {
      const d = dist(thug.x, thug.y, p.x, p.y);
      thug.angle = Math.atan2(p.y - thug.y, p.x - thug.x);
      if (d > 260 && d < 520) {
        const fixed = resolveCircle(world.city, thug.x + Math.cos(thug.angle) * 62 * dt, thug.y + Math.sin(thug.angle) * 62 * dt, 12);
        thug.x = fixed.x;
        thug.y = fixed.y;
      }
      thug.shootTimer -= dt;
      if (thug.shootTimer <= 0 && d < 520 && !state.busted) {
        thug.shootTimer = THUG_SHOT_INTERVAL * (0.8 + world.rng() * 0.5);
        const a = thug.angle + (world.rng() - 0.5) * 0.22;
        state.bullets.push({
          x: thug.x + Math.cos(a) * 20,
          y: thug.y + Math.sin(a) * 20,
          vx: Math.cos(a) * BULLET_SPEED * 0.8,
          vy: Math.sin(a) * BULLET_SPEED * 0.8,
          life: BULLET_LIFE,
          from: 'thug',
        });
      }
    }
    state.thugs = state.thugs.filter((t) => t.health > 0);
  }

  function stepBullets(dt) {
    const state = world.state;
    const p = state.player;
    let events = 0;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      // A building stops the bullet.
      let blocked = false;
      for (const building of world.city.buildings) {
        if (b.x >= building.x && b.x <= building.x + building.w && b.y >= building.y && b.y <= building.y + building.h) {
          blocked = true;
          break;
        }
      }
      if (blocked || b.x < 0 || b.x > CITY.width || b.y < 0 || b.y > CITY.height) {
        b.life = 0;
        burst(b.x, b.y, '#ffd166', 4, 90);
        continue;
      }
      if (b.from === 'player') {
        for (const thug of state.thugs) {
          if (dist(b.x, b.y, thug.x, thug.y) < 16) {
            thug.health -= 1;
            b.life = 0;
            burst(thug.x, thug.y, '#ff5a5a', 8, 140);
            events |= EVENT_HIT;
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const cop of cops()) {
          if (dist(b.x, b.y, cop.x, cop.y) < 22) {
            cop.stun = 1.5;
            b.life = 0;
            burst(cop.x, cop.y, '#9ecfff', 8, 140);
            events |= EVENT_HIT;
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const ped of state.peds) {
          if (ped.down <= 0 && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.down = 4;
            b.life = 0;
            addHeat(1);
            burst(ped.x, ped.y, '#ff5a5a', 8, 120);
            events |= EVENT_HIT;
            break;
          }
        }
      } else if (p.inCar === null && dist(b.x, b.y, p.x, p.y) < 16) {
        b.life = 0;
        state.health -= 8;
        burst(p.x, p.y, '#ff5a5a', 8, 140);
        events |= EVENT_HIT;
        if (state.health <= 0) {
          state.health = 0;
          events |= bust('BUSTED! The crew gunned you down.');
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepPickups(dt) {
    const state = world.state;
    const p = state.player;
    let events = 0;
    for (const pack of state.pickups) {
      if (pack.respawn > 0) {
        pack.respawn -= dt;
        if (pack.respawn <= 0) {
          const point = randomRoadPoint(world.rng);
          pack.x = point.x;
          pack.y = point.y;
        }
        continue;
      }
      if (dist(p.x, p.y, pack.x, pack.y) > 34) continue;
      if (pack.kind === 'health') {
        if (state.health >= PLAYER.health) continue;
        state.health = Math.min(PLAYER.health, state.health + 40);
        pack.respawn = 20;
        events |= EVENT_PICKUP;
        burst(pack.x, pack.y, '#37d67a', 10, 120);
      } else if (pack.kind === 'cash') {
        pack.respawn = -1;
        state.money += 50;
        if (state.mission) state.mission.collected += 1;
        events |= EVENT_CASH;
        burst(pack.x, pack.y, '#37d67a', 12, 140);
      }
    }
    state.pickups = state.pickups.filter((pack) => pack.respawn !== -1);
    return events;
  }

  function stepMissions(dt) {
    const state = world.state;
    const mission = state.mission;
    if (!mission) return 0;
    const p = state.player;
    if (mission.index === 0) {
      if (dist(p.x, p.y, mission.target.x, mission.target.y) < 56) return completeMission();
    } else if (mission.index === 1) {
      if (p.inCar !== null && p.inCar.id === mission.carId) return completeMission();
    } else if (mission.index === 2) {
      // Point the marker at the nearest cash drop still on the street.
      let nearest = null;
      let nearestD = Infinity;
      for (const pack of state.pickups) {
        if (pack.kind !== 'cash' || pack.respawn !== 0) continue;
        const d = dist(p.x, p.y, pack.x, pack.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = pack;
        }
      }
      mission.target = nearest ? { x: nearest.x, y: nearest.y } : null;
      if (mission.collected >= mission.total) {
        state.thugs = [];
        return completeMission();
      }
    } else if (mission.index === 3) {
      state.wantedHeat = 3;
      state.stars = 3;
      mission.timer -= dt;
      if (mission.timer <= 0) {
        state.wantedHeat = 0;
        state.stars = 0;
        return completeMission();
      }
    } else if (mission.index === 4) {
      if (mission.stage === 'bank') {
        if (dist(p.x, p.y, mission.target.x, mission.target.y) < 56) {
          mission.stage = 'getaway';
          mission.target = randomRoadPoint(world.rng);
          setMessage('Got the cash! Reach the getaway marker.', 4);
        }
      } else if (dist(p.x, p.y, mission.target.x, mission.target.y) < 56) {
        return completeMission();
      }
    }
    return 0;
  }

  function stepWanted(dt) {
    const state = world.state;
    const p = state.player;
    if (state.mission && state.mission.index === 3) return;
    let copNear = false;
    for (const cop of cops()) {
      if (dist(cop.x, cop.y, p.x, p.y) < COP_NEAR_DISTANCE) {
        copNear = true;
        break;
      }
    }
    // Heat cools only while no cop is near: hiding is the way out.
    if (!copNear && state.wantedHeat > 0) {
      state.wantedHeat = Math.max(0, state.wantedHeat - HEAT_DECAY_PER_SECOND * dt);
      state.stars = Math.ceil(state.wantedHeat);
    }
  }

  function step(dt, input) {
    const state = world.state;
    if (!state) return 0;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.busted) {
      state.bustedTimer += dt;
      // A press during the first second stays queued instead of being lost,
      // so it still respawns once the gate passes.
      if (state.bustedTimer > 1) {
        const actions = input.takeActions();
        if (actions & (ACTION_CONFIRM | ACTION_SHOOT)) {
          respawn();
          saveGame();
        }
      }
      return 0;
    }
    let events = 0;
    events |= stepPlayer(dt, input);
    if (state.busted) return events;
    stepTraffic(dt);
    events |= stepPolice(dt);
    if (state.busted) return events;
    stepPeds(dt);
    stepThugs(dt);
    events |= stepBullets(dt);
    if (state.busted) return events;
    events |= stepPickups(dt);
    events |= stepMissions(dt);
    stepWanted(dt);
    // Decay particles and skid marks.
    for (const part of state.particles) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 1 - 2.4 * dt;
      part.vy *= 1 - 2.4 * dt;
      part.life -= dt;
    }
    state.particles = state.particles.filter((part) => part.life > 0);
    for (const skid of state.skids) skid.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);
    // A siren wail now and then while the heat is on.
    world.sirenTimer -= dt;
    if (state.stars > 0 && world.sirenTimer <= 0) {
      world.sirenTimer = 3.2;
      events |= EVENT_SIREN;
    }
    return events;
  }

  reset();

  return {
    state: world.state,
    get city() {
      return world.city;
    },
    reset() {
      const s = reset();
      world.state = s;
      this.state = s;
      return s;
    },
    step,
    startMission,
    completeMission,
    saveGame,
    loadGame,
    clearSave,
    setView(x, y, w, h, pw, ph) {
      world.view = { x, y, w, h, pw, ph };
    },
    /** Put the player in a fresh car of the given type on a nearby road. */
    placePlayerInCar(type) {
      const state = world.state;
      const p = state.player;
      const spot = nearestRoadPoint(p.x, p.y);
      const car = makeCar(state.nextCarId, type, spot.x, spot.y, 0, 'player');
      state.nextCarId += 1;
      state.cars.push(car);
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      return car;
    },
    setWanted(heat) {
      const state = world.state;
      state.wantedHeat = clamp(heat, 0, MAX_WANTED);
      state.stars = Math.ceil(state.wantedHeat);
    },
    dayFraction() {
      return (world.state.time % DAY_LENGTH) / DAY_LENGTH;
    },
  };
}
