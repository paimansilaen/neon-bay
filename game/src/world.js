// The game's rules and state, with no drawing and no browser in it: the player on foot or in a
// car, traffic and parked cars, pedestrians, police, thugs, bullets, missions, wanted level and
// heat, pickups and particles. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sounds, announcements) without the world knowing about screens
// or sound. Missions and cars are always placed on roads, never inside buildings.
import {
  BEACH_X, CAR_TYPES, COP, DAY_LENGTH, FIELD, MISSIONS, PLAYER, ROADS, SAVE_KEY, THUG, WANTED,
} from './config.js';
import { hitsObstacle, isOnRoad, nearestIntersection, nearestRoadPoint, resolveCircle, roadPath, roadPointNear, randomRoadPoint } from './city.js';
import { pick, range } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_HURT = 4;
export const EVENT_SHOT = 8;
export const EVENT_PICKUP = 16;
export const EVENT_CASH = 32;
export const EVENT_WANTED_UP = 64;
export const EVENT_PUNCH = 128;

const SPAWN = { x: 600, y: 600 };
const TRAFFIC_COUNT = 12;
const PARKED_COUNT = 6;
const PED_COUNT = 14;

let nextCarId = 1;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment from (x1,y1) to (x2,y2) stays out of every building. */
function hasLineOfSight(city, x1, y1, x2, y2) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 40);
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (hitsObstacle(city, x, y, 4)) return false;
  }
  return true;
}

export function createWorld(random, city) {
  const state = {
    time: 0,
    money: 0,
    missionsDone: 0,
    health: PLAYER.health,
    ammo: PLAYER.ammoMax,
    reloading: false,
    reloadTimer: 0,
    punchTimer: 0,
    wanted: 0,
    heat: 0,
    shake: 0,
    lastCopHit: -10,
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, health: PLAYER.health,
      ammo: PLAYER.ammoMax, inCar: null, invuln: 0,
    },
    cars: [],
    cops: [],
    peds: [],
    thugs: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    mission: null,
  };

  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + random() * 0.4, maxLife: 0.75, color, size: 2 + random() * 3,
      });
    }
    if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
  }

  function makeTrafficCar(near) {
    const p = near ? roadPointNear(state.player.x, state.player.y, 300, 900, random) : randomRoadPoint(random);
    const onVertical = ROADS.vertical.includes(p.x) && (Math.abs(p.x - (ROADS.vertical.find((v) => Math.abs(v - p.x) < 1) ?? -1)) < 1);
    const vertical = onVertical || random() < 0.5;
    const type = pick(random, ['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    const dir = random() < 0.5 ? -1 : 1;
    const def = CAR_TYPES[type];
    let x = p.x;
    let y = p.y;
    let axis = 'v';
    let road = p.x;
    if (vertical) {
      x = p.x;
      y = range(random, 120, FIELD.height - 120);
      road = ROADS.vertical.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      x = road + (dir > 0 ? ROADS.lane : -ROADS.lane);
    } else {
      axis = 'h';
      x = range(random, 120, BEACH_X - 120);
      y = p.y;
      road = ROADS.horizontal.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
      y = road + (dir > 0 ? -ROADS.lane : ROADS.lane);
    }
    return {
      id: nextCarId, type, x, y, angle: axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: def.maxSpeed * range(random, 0.45, 0.7), maxSpeed: def.maxSpeed, accel: def.accel,
      driven: true, parked: false, axis, road, dir, turnCooldown: range(random, 1, 4),
    };
  }

  function makeParkedCar(near) {
    const p = near ? roadPointNear(state.player.x, state.player.y, 250, 600, random) : randomRoadPoint(random);
    const vertical = random() < 0.5;
    const type = pick(random, ['sedan', 'taxi', 'truck', 'sedan']);
    const def = CAR_TYPES[type];
    let x = p.x;
    let y = p.y;
    let angle = 0;
    if (vertical) {
      const road = ROADS.vertical.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
      x = road + (random() < 0.5 ? ROADS.width / 2 - 16 : -(ROADS.width / 2 - 16));
      y = range(random, 150, FIELD.height - 150);
      angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = ROADS.horizontal.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
      y = road + (random() < 0.5 ? ROADS.width / 2 - 16 : -(ROADS.width / 2 - 16));
      x = range(random, 150, BEACH_X - 150);
      angle = random() < 0.5 ? 0 : Math.PI;
    }
    return {
      id: nextCarId, type, x, y, angle, speed: 0, maxSpeed: def.maxSpeed, accel: def.accel,
      driven: false, parked: true, axis: vertical ? 'v' : 'h', road: 0, dir: 1, turnCooldown: 0,
    };
  }

  function makePed() {
    const p = randomRoadPoint(random);
    const vertical = random() < 0.5;
    const road = vertical
      ? ROADS.vertical.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a))
      : ROADS.horizontal.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
    const side = random() < 0.5 ? 1 : -1;
    return {
      x: vertical ? road + side * (ROADS.width / 2 + 10) : range(random, 120, BEACH_X - 120),
      y: vertical ? range(random, 120, FIELD.height - 120) : road + side * (ROADS.width / 2 + 10),
      angle: random() * Math.PI * 2, speed: range(random, 55, 85), mode: 'walk', timer: range(random, 2, 6),
      tx: 0, ty: 0, downTimer: 0, axis: vertical ? 'v' : 'h', road,
    };
  }

  function reset() {
    nextCarId = 1;
    state.time = 0;
    state.wanted = 0;
    state.heat = 0;
    state.shake = 0;
    state.player.x = SPAWN.x;
    state.player.y = SPAWN.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.ammo = PLAYER.ammoMax;
    state.player.inCar = null;
    state.player.invuln = 0;
    state.health = PLAYER.health;
    state.ammo = PLAYER.ammoMax;
    state.reloading = false;
    state.reloadTimer = 0;
    state.punchTimer = 0;
    state.cars = [];
    state.cops = [];
    state.peds = [];
    state.thugs = [];
    state.bullets = [];
    state.particles = [];
    state.skids = [];
    state.pickups = [];
    state.mission = null;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      nextCarId += 1;
      state.cars.push(makeTrafficCar(false));
    }
    for (let i = 0; i < PARKED_COUNT; i += 1) {
      nextCarId += 1;
      state.cars.push(makeParkedCar(false));
    }
    for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(makePed());
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') state.money = data.money;
      if (typeof data.missionsDone === 'number') state.missionsDone = Math.min(5, Math.max(0, data.missionsDone));
    } catch {
      // A corrupt save is ignored; the game starts fresh.
    }
  }

  function saveNow() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({ money: state.money, missionsDone: state.missionsDone }));
    } catch {
      // Storage can be off; the save then lasts this visit only.
    }
  }

  function clearSave() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // See above.
    }
    state.money = 0;
    state.missionsDone = 0;
  }

  function gainWanted(amount) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED.max, state.wanted + amount);
    if (state.wanted > before) state.heat = WANTED.heatMax;
    return state.wanted > before ? EVENT_WANTED_UP : 0;
  }

  function nearestCar(maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      const d = dist(car.x, car.y, state.player.x, state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function tryEnterCar() {
    if (state.player.inCar !== null) return 0;
    const car = nearestCar(78);
    if (!car) return 0;
    let events = 0;
    if (car.driven) {
      // Stealing a driven car ejects its driver and draws the law.
      car.driven = false;
      state.peds.push({
        x: car.x + 40, y: car.y + 40, angle: random() * Math.PI * 2, speed: 130,
        mode: 'flee', timer: 3, tx: car.x + 300, ty: car.y + 300, downTimer: 0, axis: 'v', road: car.road,
      });
      events |= gainWanted(1);
    }
    car.parked = false;
    car.speed = 0;
    state.player.inCar = car.id;
    return events;
  }

  function exitCar() {
    const car = state.cars.find((c) => c.id === state.player.inCar);
    if (!car) return;
    const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
    const spot = resolveCircle(city, car.x + side.x * 44, car.y + side.y * 44, PLAYER.radius);
    state.player.x = spot.x;
    state.player.y = spot.y;
    state.player.inCar = null;
    car.parked = true;
    car.speed = 0;
  }

  function startMission() {
    if (state.mission !== null || state.missionsDone >= MISSIONS.length) return false;
    const index = state.missionsDone;
    const def = MISSIONS[index];
    const mission = { index, name: def.name, reward: def.reward, hint: def.hint, objective: null, collected: 0, needed: 0, timer: 0, phase: 'go' };
    if (index === 0) {
      mission.objective = { x: 600, y: 1000, label: 'Delivery point' };
      mission.needed = 1;
    } else if (index === 1) {
      const spot = roadPointNear(state.player.x, state.player.y, 300, 550, random);
      const car = {
        id: nextCarId, type: 'sports', x: spot.x, y: spot.y,
        angle: random() < 0.5 ? 0 : Math.PI / 2, speed: 0, maxSpeed: CAR_TYPES.sports.maxSpeed,
        accel: CAR_TYPES.sports.accel, driven: false, parked: true, axis: 'v', road: spot.x, dir: 1,
        turnCooldown: 0, missionCar: true,
      };
      nextCarId += 1;
      state.cars.push(car);
      mission.objective = { x: spot.x, y: spot.y, label: 'Red Comet GT' };
      mission.needed = 1;
      mission.carId = car.id;
    } else if (index === 2) {
      mission.needed = 5;
      const drops = [];
      for (let i = 0; i < 5; i += 1) {
        const p = roadPointNear(state.player.x, state.player.y, 220, 750, random);
        if (drops.some((d) => dist(d.x, d.y, p.x, p.y) < 150)) { i -= 1; continue; }
        drops.push(p);
        state.pickups.push({ kind: 'cash', x: p.x, y: p.y, amount: 0 });
      }
      for (let i = 0; i < 3; i += 1) {
        const near = drops[i % drops.length];
        const p = roadPointNear(near.x, near.y, 60, 160, random);
        state.thugs.push({ x: p.x, y: p.y, angle: 0, hp: THUG.health, shootTimer: range(random, 0.5, 1.2) });
      }
      mission.objective = { x: drops[0].x, y: drops[0].y, label: 'Cash drop' };
    } else if (index === 3) {
      mission.timer = 60;
      mission.objective = null;
      gainWanted(3);
    } else if (index === 4) {
      const vault = roadPointNear(state.player.x, state.player.y, 420, 750, random);
      mission.objective = { x: vault.x, y: vault.y, label: 'Vault cash' };
      mission.needed = 1;
      mission.vault = vault;
    }
    state.mission = mission;
    return true;
  }

  function completeMission() {
    const mission = state.mission;
    if (!mission) return EVENT_MISSION_DONE;
    state.money += mission.reward;
    state.missionsDone += 1;
    state.mission = null;
    saveNow();
    addParticles(state.player.x, state.player.y, '#ffd23f', 24, 260);
    return EVENT_MISSION_DONE;
  }

  function failMission() {
    state.mission = null;
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (state.punchTimer > 0) state.punchTimer -= dt;
    if (state.reloading) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        state.reloading = false;
        state.ammo = PLAYER.ammoMax;
        p.ammo = state.ammo;
      }
    }
    state.health = p.health;
    state.ammo = p.ammo;

    if (p.inCar !== null) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (!car) { p.inCar = null; return 0; }
      const def = CAR_TYPES[car.type];
      const throttle = -input.move.y; // W is forward
      const steer = input.move.x;
      if (throttle > 0) car.speed += def.accel * throttle * dt;
      else if (throttle < 0) {
        if (car.speed > 8) car.speed -= 520 * dt;
        else car.speed = Math.max(-160, car.speed - 220 * dt);
      } else {
        car.speed -= car.speed * 0.7 * dt;
      }
      if (input.move.handbrake) {
        car.speed -= car.speed * 3.2 * dt;
        if (Math.abs(car.speed) > 150) {
          const bx = car.x - Math.cos(car.angle) * 20;
          const by = car.y - Math.sin(car.angle) * 20;
          state.skids.push({ x1: bx, y1: by, x2: bx + Math.cos(car.angle) * 6, y2: by + Math.sin(car.angle) * 6, life: 5 });
        }
      }
      car.speed = Math.max(-170, Math.min(def.maxSpeed, car.speed));
      const turn = 2.7 * Math.min(1, Math.abs(car.speed) / 220) * (input.move.handbrake ? 1.6 : 1);
      car.angle += steer * turn * dt * Math.sign(car.speed);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = resolveCircle(city, nx, ny, CAR_TYPES[car.type].length * 0.42);
      if (fixed.x !== nx || fixed.y !== ny) car.speed *= 0.4;
      car.x = fixed.x;
      car.y = fixed.y;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      return 0;
    }

    const len = Math.hypot(input.move.x, input.move.y) || 1;
    const speed = input.move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + (input.move.x / len) * speed * dt;
    const ny = p.y + (input.move.y / len) * speed * dt;
    const fixed = resolveCircle(city, nx, ny, PLAYER.radius);
    p.x = fixed.x;
    p.y = fixed.y;
    if (input.move.x !== 0 || input.move.y !== 0) p.angle = Math.atan2(input.move.y, input.move.x);
    else if (input.aim) p.angle = Math.atan2(input.aim.y - p.y, input.aim.x - p.x);
    return 0;
  }

  function stepShooting(dt, input) {
    let events = 0;
    const p = state.player;
    if (p.inCar !== null) return 0;
    if (input.reload && !state.reloading && state.ammo < PLAYER.ammoMax) {
      state.reloading = true;
      state.reloadTimer = PLAYER.reloadTime;
    }
    if (input.punch && state.punchTimer <= 0) {
      state.punchTimer = PLAYER.punchCooldown;
      const px = p.x + Math.cos(p.angle) * 30;
      const py = p.y + Math.sin(p.angle) * 30;
      let hit = false;
      for (const thug of state.thugs) {
        if (dist(thug.x, thug.y, px, py) < PLAYER.punchRange + THUG.radius) {
          thug.hp -= PLAYER.punchDamage;
          addParticles(thug.x, thug.y, '#ffffff', 8, 180);
          hit = true;
        }
      }
      if (hit) events |= EVENT_PUNCH;
    }
    if (input.shoot && !state.reloading && state.ammo > 0) {
      state.ammo -= 1;
      p.ammo = state.ammo;
      const aim = input.aim ?? { x: p.x + Math.cos(p.angle) * 100, y: p.y + Math.sin(p.angle) * 100 };
      const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
      p.angle = angle;
      state.bullets.push({
        x: p.x + Math.cos(angle) * 22, y: p.y + Math.sin(angle) * 22,
        vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
        friendly: true, life: PLAYER.pistolRange / 900, damage: PLAYER.pistolDamage,
      });
      addParticles(p.x + Math.cos(angle) * 24, p.y + Math.sin(angle) * 24, '#ffd23f', 4, 120);
      events |= EVENT_SHOT;
      for (const ped of state.peds) {
        if (dist(ped.x, ped.y, p.x, p.y) < 260) {
          ped.mode = 'flee';
          ped.timer = 2;
          ped.tx = ped.x + (ped.x - p.x);
          ped.ty = ped.y + (ped.y - p.y);
        }
      }
    }
    return events;
  }

  function stepTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.parked || car.id === p.inCar) continue;
      car.turnCooldown -= dt;
      // Slow for the car ahead on the same stretch.
      let ahead = Infinity;
      for (const other of state.cars) {
        if (other === car || other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
        const gap = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
        if (gap > 0 && gap < ahead) ahead = gap;
      }
      const target = ahead < 85 ? 60 : car.maxSpeed * 0.62;
      car.speed += Math.min(target - car.speed, 300 * dt);
      if (car.speed < 0) car.speed = 0;
      const before = { x: car.x, y: car.y };
      if (car.axis === 'v') car.y += car.dir * car.speed * dt;
      else car.x += car.dir * car.speed * dt;
      // Turn at an intersection sometimes.
      const nearCross = car.axis === 'v'
        ? ROADS.horizontal.find((hy) => Math.abs(car.y - hy) < 26)
        : ROADS.vertical.find((vx) => Math.abs(car.x - vx) < 26);
      if (nearCross !== undefined && car.turnCooldown <= 0 && random() < 0.3) {
        car.turnCooldown = 2;
        if (car.axis === 'v') {
          car.axis = 'h';
          car.road = nearCross;
          car.dir = random() < 0.5 ? -1 : 1;
          car.y = nearCross + (car.dir > 0 ? -ROADS.lane : ROADS.lane);
          car.angle = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.axis = 'v';
          car.road = nearCross;
          car.dir = random() < 0.5 ? -1 : 1;
          car.x = nearCross + (car.dir > 0 ? ROADS.lane : -ROADS.lane);
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      if (car.axis === 'v') car.x = car.road + (car.dir > 0 ? ROADS.lane : -ROADS.lane);
      else car.y = car.road + (car.dir > 0 ? -ROADS.lane : ROADS.lane);
      // Wrap around the far side, or respawn near the player when far away.
      if (dist(car.x, car.y, p.x, p.y) > 1900) {
        const fresh = makeTrafficCar(true);
        Object.assign(car, fresh, { id: car.id });
      } else if (car.x < 80 || car.x > BEACH_X - 40 || car.y < 80 || car.y > FIELD.height - 80) {
        car.dir *= -1;
        car.angle += Math.PI;
        car.x = Math.min(BEACH_X - 60, Math.max(100, car.x));
        car.y = Math.min(FIELD.height - 60, Math.max(100, car.y));
      }
      void before;
    }
    // Player car bumping into traffic.
    const pc = state.cars.find((c) => c.id === p.inCar);
    if (pc) {
      for (const car of state.cars) {
        if (car === pc || car.parked) continue;
        if (dist(car.x, car.y, pc.x, pc.y) < 62) {
          car.speed *= 0.5;
          pc.speed *= 0.7;
          const push = resolveCircle(city, pc.x, pc.y, 34);
          pc.x = push.x;
          pc.y = push.y;
        }
      }
    }
  }

  function stepPeds(dt) {
    const p = state.player;
    const pc = state.cars.find((c) => c.id === p.inCar);
    for (const ped of state.peds) {
      if (ped.downTimer > 0) {
        ped.downTimer -= dt;
        continue;
      }
      if (ped.mode === 'flee') {
        ped.timer -= dt;
        const d = dist(ped.tx, ped.ty, ped.x, ped.y);
        if (d > 12) {
          ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
          const nx = ped.x + Math.cos(ped.angle) * ped.speed * 1.9 * dt;
          const ny = ped.y + Math.sin(ped.angle) * ped.speed * 1.9 * dt;
          const fixed = resolveCircle(city, nx, ny, 10);
          ped.x = fixed.x;
          ped.y = fixed.y;
        }
        if (ped.timer <= 0) ped.mode = 'walk';
        continue;
      }
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.timer = range(random, 3, 7);
        // Pick a new stretch of sidewalk to walk along.
        if (random() < 0.5) {
          ped.axis = 'v';
          ped.road = pick(random, ROADS.vertical);
          ped.x = ped.road + (random() < 0.5 ? 1 : -1) * (ROADS.width / 2 + 10);
        } else {
          ped.axis = 'h';
          ped.road = pick(random, ROADS.horizontal);
          ped.y = ped.road + (random() < 0.5 ? 1 : -1) * (ROADS.width / 2 + 10);
        }
      }
      const dir = Math.sin(state.time * 0.3 + ped.x * 0.01) > 0 ? 1 : -1;
      if (ped.axis === 'v') {
        ped.y += dir * ped.speed * dt;
        ped.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        ped.y = Math.min(FIELD.height - 100, Math.max(100, ped.y));
      } else {
        ped.x += dir * ped.speed * dt;
        ped.angle = dir > 0 ? 0 : Math.PI;
        ped.x = Math.min(BEACH_X - 100, Math.max(100, ped.x));
      }
      // A car hitting a pedestrian knocks them down and draws the law.
      if (pc && dist(ped.x, ped.y, pc.x, pc.y) < 46) {
        ped.downTimer = 2.5;
        ped.mode = 'walk';
        gainWanted(1);
        addParticles(ped.x, ped.y, '#ffffff', 10, 160);
      }
    }
  }

  function stepCops(dt) {
    const p = state.player;
    const wantedCount = Math.min(state.wanted, 3);
    while (state.cops.length < wantedCount) {
      const spot = roadPointNear(p.x, p.y, COP.spawnDistance[0], COP.spawnDistance[1], random);
      state.cops.push({ x: spot.x, y: spot.y, angle: 0, speed: 0, path: [], pathTimer: 0, bust: 0 });
    }
    if (state.cops.length > wantedCount) state.cops.length = wantedCount;
    for (const cop of state.cops) {
      cop.pathTimer -= dt;
      if (cop.pathTimer <= 0) {
        cop.pathTimer = 0.6;
        cop.path = roadPath(cop.x, cop.y, p.x, p.y);
      }
      const dPlayer = dist(cop.x, cop.y, p.x, p.y);
      const arrive = dPlayer < COP.arriveRange ? COP.arriveFactor : 1;
      const speed = COP.maxSpeed * arrive;
      let target = null;
      if (cop.path.length > 0) target = cop.path[0];
      else target = { x: p.x, y: p.y };
      const dTarget = dist(cop.x, cop.y, target.x, target.y);
      if (dTarget < 26 && cop.path.length > 0) cop.path.shift();
      else {
        cop.angle = Math.atan2(target.y - cop.y, target.x - cop.x);
        cop.x += Math.cos(cop.angle) * speed * dt;
        cop.y += Math.sin(cop.angle) * speed * dt;
        const fixed = resolveCircle(city, cop.x, cop.y, 18);
        cop.x = fixed.x;
        cop.y = fixed.y;
      }
      if (dPlayer > COP.despawnDistance) {
        const spot = roadPointNear(p.x, p.y, COP.spawnDistance[0], COP.spawnDistance[1], random);
        cop.x = spot.x;
        cop.y = spot.y;
        cop.path = [];
        cop.bust = 0;
      }
      // Arrest: standing close to a cop for a moment gets you busted.
      if (dPlayer < COP.arrestRange) cop.bust += dt;
      else cop.bust = Math.max(0, cop.bust - dt * 2);
      // Ramming a driven car slows it down.
      const pc = state.cars.find((c) => c.id === p.inCar);
      if (pc && dPlayer < 78) pc.speed *= 1 - 0.55 * dt;
    }
    return state.cops.some((cop) => cop.bust >= COP.arrestTime) ? EVENT_BUSTED : 0;
  }

  function stepThugs(dt) {
    const p = state.player;
    let events = 0;
    for (const thug of state.thugs) {
      if (thug.hp <= 0) continue;
      const d = dist(thug.x, thug.y, p.x, p.y);
      thug.shootTimer -= dt;
      if (d < THUG.shootRange && thug.shootTimer <= 0 && p.inCar === null) {
        if (hasLineOfSight(city, thug.x, thug.y, p.x, p.y)) {
          thug.shootTimer = THUG.shootInterval * range(random, 0.8, 1.3);
          const angle = Math.atan2(p.y - thug.y, p.x - thug.x);
          thug.angle = angle;
          state.bullets.push({
            x: thug.x + Math.cos(angle) * 20, y: thug.y + Math.sin(angle) * 20,
            vx: Math.cos(angle) * THUG.bulletSpeed, vy: Math.sin(angle) * THUG.bulletSpeed,
            friendly: false, life: 1.4, damage: THUG.damage,
          });
        } else {
          thug.shootTimer = 0.4;
        }
      }
      if (d > 220) {
        const angle = Math.atan2(p.y - thug.y, p.x - thug.x);
        thug.angle = angle;
        const nx = thug.x + Math.cos(angle) * THUG.speed * dt;
        const ny = thug.y + Math.sin(angle) * THUG.speed * dt;
        const fixed = resolveCircle(city, nx, ny, THUG.radius);
        thug.x = fixed.x;
        thug.y = fixed.y;
      }
    }
    state.thugs = state.thugs.filter((t) => t.hp > 0);
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    const p = state.player;
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) { bullet.dead = true; continue; }
      if (hitsObstacle(city, bullet.x, bullet.y, 2)) {
        addParticles(bullet.x, bullet.y, '#c8c8c8', 3, 90);
        bullet.dead = true;
        continue;
      }
      if (bullet.friendly) {
        for (const thug of state.thugs) {
          if (thug.hp > 0 && dist(bullet.x, bullet.y, thug.x, thug.y) < THUG.radius + 4) {
            thug.hp -= bullet.damage;
            addParticles(thug.x, thug.y, '#ff6b61', 8, 170);
            bullet.dead = true;
            break;
          }
        }
        if (bullet.dead) continue;
        if (state.time - state.lastCopHit > 1) {
          for (const cop of state.cops) {
            if (dist(bullet.x, bullet.y, cop.x, cop.y) < 24) {
              state.lastCopHit = state.time;
              events |= gainWanted(1);
              addParticles(cop.x, cop.y, '#9db8ff', 8, 170);
              bullet.dead = true;
              break;
            }
          }
        }
      } else if (p.inCar === null && p.invuln <= 0 && dist(bullet.x, bullet.y, p.x, p.y) < PLAYER.radius + 4) {
        p.health -= bullet.damage;
        p.invuln = 0.5;
        state.health = p.health;
        addParticles(p.x, p.y, '#ff5a4e', 8, 170);
        events |= EVENT_HURT;
        bullet.dead = true;
        if (p.health <= 0) return EVENT_BUSTED;
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    return events;
  }

  function stepPickups(dt) {
    const p = state.player;
    let events = 0;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (dist(pickup.x, pickup.y, p.x, p.y) < 46) {
        pickup.taken = true;
        if (pickup.kind === 'cash') {
          if (state.mission && state.mission.index === 2) {
            state.mission.collected += 1;
            events |= EVENT_CASH;
            addParticles(pickup.x, pickup.y, '#58d68d', 12, 200);
          } else {
            state.money += 50;
            events |= EVENT_CASH;
          }
        } else if (pickup.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + 30);
          state.health = p.health;
          events |= EVENT_PICKUP;
        }
      }
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    return events;
  }

  function stepMission(dt) {
    const mission = state.mission;
    if (!mission) return 0;
    if (mission.index === 0) {
      if (dist(mission.objective.x, mission.objective.y, state.player.x, state.player.y) < 62) return completeMission();
    } else if (mission.index === 1) {
      const car = state.cars.find((c) => c.id === mission.carId);
      if (car && state.player.inCar === car.id) return completeMission();
    } else if (mission.index === 2) {
      const remaining = state.pickups.filter((pk) => pk.kind === 'cash');
      if (remaining.length > 0) {
        let best = remaining[0];
        let bestD = dist(best.x, best.y, state.player.x, state.player.y);
        for (const pk of remaining) {
          const d = dist(pk.x, pk.y, state.player.x, state.player.y);
          if (d < bestD) { bestD = d; best = pk; }
        }
        mission.objective = { x: best.x, y: best.y, label: `Cash drop ${mission.collected}/5` };
      }
      if (mission.collected >= mission.needed) return completeMission();
    } else if (mission.index === 3) {
      mission.timer -= dt;
      if (mission.timer <= 0) return completeMission();
    } else if (mission.index === 4) {
      if (mission.phase === 'go') {
        if (dist(mission.objective.x, mission.objective.y, state.player.x, state.player.y) < 62) {
          mission.phase = 'escape';
          mission.objective = { x: SPAWN.x, y: SPAWN.y, label: 'Escape point' };
          gainWanted(4);
        }
      } else if (dist(mission.objective.x, mission.objective.y, state.player.x, state.player.y) < 62) {
        return completeMission();
      }
    }
    return 0;
  }

  function stepWanted(dt) {
    if (state.wanted <= 0) {
      state.heat = 0;
      return;
    }
    const p = state.player;
    const copNear = state.cops.some((cop) => dist(cop.x, cop.y, p.x, p.y) < WANTED.copNearRange);
    if (copNear) state.heat = Math.min(WANTED.heatMax, state.heat + WANTED.heatRiseNear * dt);
    else state.heat -= WANTED.heatDecayFar * dt;
    if (state.heat <= 0) {
      state.wanted -= 1;
      state.heat = state.wanted > 0 ? WANTED.heatMax : 0;
    }
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 2);
    if (input.mission) startMission();
    if (input.enter) {
      if (state.player.inCar !== null) exitCar();
      else events |= tryEnterCar();
    }
    events |= stepPlayer(dt, input);
    events |= stepShooting(dt, input);
    stepTraffic(dt);
    stepPeds(dt);
    events |= stepCops(dt);
    events |= stepThugs(dt);
    events |= stepBullets(dt);
    events |= stepPickups(dt);
    events |= stepMission(dt);
    stepWanted(dt);
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const skid of state.skids) skid.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);
    if (state.player.health <= 0) return EVENT_BUSTED;
    return events;
  }

  function respawnAfterBust() {
    const car = state.cars.find((c) => c.id === state.player.inCar);
    if (car) {
      car.parked = true;
      car.speed = 0;
    }
    state.player.inCar = null;
    state.player.x = SPAWN.x;
    state.player.y = SPAWN.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.ammo = PLAYER.ammoMax;
    state.player.invuln = 1;
    state.health = PLAYER.health;
    state.ammo = PLAYER.ammoMax;
    state.reloading = false;
    state.wanted = 0;
    state.heat = 0;
    state.cops = [];
    state.thugs = [];
    state.bullets = [];
    failMission();
  }

  reset();
  return {
    state, reset, step, startMission, tryEnterCar, exitCar, loadSave, saveNow, clearSave,
    respawnAfterBust, nearestCar, gainWanted,
  };
}
