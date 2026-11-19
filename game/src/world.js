// NEON BAY rules and state: the player on foot and by car, traffic, pedestrians,
// police and the wanted level, missions and story, combat, pickups and particles.
// No drawing and no browser in here: step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (sound, announcements, save).
import { CAR_TYPES, MISSIONS, PLAYER, STEP, WORLD } from './config.js';
import { createCity } from './city.js';

export const EVENT_SHOOT = 1;
export const EVENT_CRASH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WANTED = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_MISSION_DONE = 64;
export const EVENT_MISSION_FAIL = 128;
export const EVENT_HURT = 256;
export const EVENT_CASH = 512;
export const EVENT_PUNCH = 1024;

const TRAFFIC_COLORS = ['#4a7ec2', '#c2a44a', '#5a8a5a', '#8a5a7a', '#c27a4a', '#7a7a8a', '#3f8a8a'];
const PED_COLORS = ['#e8d44a', '#e88a4a', '#4ae8c2', '#e84a8a', '#9a6ae8', '#e8e8e8', '#6a9ae8'];

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

export function createWorld(random) {
  const city = createCity(random);

  const player = {
    x: 600, y: 600, angle: 0, health: PLAYER.health, ammo: PLAYER.pistolAmmo,
    mag: 12, reloading: 0, fireTimer: 0, inCar: null, speed: 0, hurtTimer: 0,
    aimAngle: 0, punchTimer: 0,
  };

  const cars = [];
  for (let i = 0; i < 40; i += 1) {
    cars.push({
      active: false, kind: 'traffic', type: 'sedan', x: 0, y: 0, angle: 0,
      speed: 0, cruise: 120, axis: 'x', dir: 1, road: 0, lane: 18, hp: 100,
      color: '#888888', driver: true, smoke: 0, target: false, hitFlash: 0,
    });
  }
  const peds = [];
  for (let i = 0; i < 48; i += 1) {
    peds.push({
      active: false, thug: false, x: 0, y: 0, angle: 0, speed: 50, axis: 'x',
      dir: 1, road: 0, off: 50, hp: 30, color: '#ffffff', flee: 0,
      shootTimer: 0, dead: false, fade: 0,
    });
  }
  const bullets = [];
  for (let i = 0; i < 32; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromPlayer: true });
  const pickups = [];
  for (let i = 0; i < 20; i += 1) pickups.push({ active: false, kind: 'health', x: 0, y: 0, respawn: 0, mission: false });
  const particles = [];
  for (let i = 0; i < 160; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#ffffff', size: 3 });
  const skids = [];
  for (let i = 0; i < 200; i += 1) skids.push({ active: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 });

  const state = {
    player, cars, peds, bullets, pickups, particles, skids, city,
    cash: 0, wanted: 0, lastCrime: -100, decayTimer: 0, bustProgress: 0,
    elapsed: 0, timeOfDay: 0.32, missionIndex: 0, missionActive: false,
    mission: null, stepIndex: 0, missionTimer: 0, stepState: {},
    dialogue: [], dialogueIndex: 0, dialogueTimer: 0,
    toast: '', toastTimer: 0, over: null, storyDone: false,
    shake: 0, missionTargetCar: null, dropsLeft: 0, surviveLeft: 0,
  };

  function spawnParticle(x, y, vx, vy, life, color, size) {
    for (const p of particles) {
      if (p.active) continue;
      p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.max = life; p.color = color; p.size = size;
      return;
    }
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random.next() * Math.PI * 2;
      const s = speed * (0.4 + random.next() * 0.6);
      spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + random.next() * 0.5, color, 2 + random.next() * 3);
    }
  }
  function addSkid(x1, y1, x2, y2) {
    for (const s of skids) {
      if (s.active) continue;
      s.active = true; s.x1 = x1; s.y1 = y1; s.x2 = x2; s.y2 = y2; s.life = 6;
      return;
    }
  }

  function freeCar() { for (const c of cars) if (!c.active) return c; return null; }
  function freePed() { for (const p of peds) if (!p.active) return p; return null; }
  function freeBullet() { for (const b of bullets) if (!b.active) return b; return null; }
  function freePickup() { for (const p of pickups) if (!p.active) return p; return null; }

  function spawnTrafficCar() {
    const car = freeCar();
    if (!car) return null;
    const p = city.randomRoadPoint();
    const horizontal = random.chance(0.5);
    const type = random.pick(['sedan', 'sedan', 'taxi', 'truck', 'sports']);
    car.active = true; car.kind = 'traffic'; car.type = type;
    car.x = p.x; car.y = p.y;
    car.axis = horizontal ? 'x' : 'y';
    car.dir = random.chance(0.5) ? 1 : -1;
    car.road = horizontal ? p.y : p.x;
    car.lane = (car.dir > 0 ? 1 : -1) * 18;
    car.angle = horizontal ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.cruise = 90 + random.next() * 70;
    car.speed = car.cruise;
    car.hp = 100; car.driver = true; car.target = false; car.smoke = 0; car.hitFlash = 0;
    car.color = type === 'taxi' ? CAR_TYPES.taxi.color : TRAFFIC_COLORS[random.int(0, TRAFFIC_COLORS.length - 1)];
    return car;
  }

  function spawnParkedCar(type, x, y, angle, target) {
    const car = freeCar();
    if (!car) return null;
    car.active = true; car.kind = 'parked'; car.type = type;
    car.x = x; car.y = y; car.angle = angle; car.speed = 0;
    car.hp = 100; car.driver = false; car.target = !!target; car.smoke = 0; car.hitFlash = 0;
    car.color = CAR_TYPES[type].color;
    return car;
  }

  function spawnPed(thug, x, y) {
    const ped = freePed();
    if (!ped) return null;
    const p = (x === undefined) ? city.randomSidewalkPoint() : { x, y };
    ped.active = true; ped.thug = !!thug; ped.x = p.x; ped.y = p.y;
    ped.axis = random.chance(0.5) ? 'x' : 'y';
    ped.dir = random.chance(0.5) ? 1 : -1;
    ped.road = ped.axis === 'x' ? p.y : p.x;
    ped.off = (random.chance(0.5) ? 1 : -1) * (WORLD.roadWidth / 2 + 12);
    ped.speed = thug ? 70 : 40 + random.next() * 35;
    ped.hp = thug ? 60 : 30;
    ped.color = thug ? '#c23b4a' : PED_COLORS[random.int(0, PED_COLORS.length - 1)];
    ped.flee = 0; ped.shootTimer = 1 + random.next(); ped.dead = false; ped.fade = 0;
    ped.angle = ped.axis === 'x' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    return ped;
  }

  function spawnPickup(kind, x, y, mission) {
    const pk = freePickup();
    if (!pk) return null;
    pk.active = true; pk.kind = kind; pk.x = x; pk.y = y; pk.respawn = 0; pk.mission = !!mission;
    return pk;
  }

  function addWanted(n, events) {
    if (n <= 0) return events;
    state.wanted = Math.min(5, state.wanted + n);
    state.lastCrime = state.elapsed;
    state.decayTimer = 0;
    return events | EVENT_WANTED;
  }

  function reset() {
    player.x = 600; player.y = 600; player.angle = -Math.PI / 2;
    player.health = PLAYER.health; player.ammo = PLAYER.pistolAmmo; player.mag = 12;
    player.reloading = 0; player.fireTimer = 0; player.inCar = null; player.speed = 0;
    player.hurtTimer = 0; player.aimAngle = 0; player.punchTimer = 0;
    for (const c of cars) c.active = false;
    for (const p of peds) p.active = false;
    for (const b of bullets) b.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    for (const s of skids) s.active = false;
    state.cash = 0; state.wanted = 0; state.lastCrime = -100; state.decayTimer = 0;
    state.bustProgress = 0; state.elapsed = 0; state.timeOfDay = 0.32;
    state.missionIndex = 0; state.missionActive = false; state.mission = null;
    state.stepIndex = 0; state.missionTimer = 0; state.stepState = {};
    state.dialogue = []; state.dialogueIndex = 0; state.dialogueTimer = 0;
    state.toast = ''; state.toastTimer = 0; state.over = null; state.storyDone = false;
    state.shake = 0; state.missionTargetCar = null; state.dropsLeft = 0; state.surviveLeft = 0;

    for (let i = 0; i < 14; i += 1) spawnTrafficCar();
    // Parked cars in lots and along roads.
    for (const lot of city.lots.slice(0, 6)) {
      spawnParkedCar(random.pick(['sedan', 'taxi', 'sports', 'truck']), lot.x + 30 + random.next() * (lot.w - 60), lot.y + 30 + random.next() * (lot.h - 60), random.next() * Math.PI * 2, false);
    }
    for (let i = 0; i < 6; i += 1) {
      const p = city.randomRoadPoint();
      spawnParkedCar(random.pick(['sedan', 'taxi', 'sports']), p.x + (random.chance(0.5) ? 30 : -30), p.y + (random.chance(0.5) ? 30 : -30), random.next() * Math.PI * 2, false);
    }
    for (let i = 0; i < 22; i += 1) spawnPed(false);
    // Health and ammo stashes around the city.
    for (let i = 0; i < 4; i += 1) {
      const p = city.randomSidewalkPoint();
      spawnPickup('health', p.x, p.y, false);
    }
    for (let i = 0; i < 4; i += 1) {
      const p = city.randomSidewalkPoint();
      spawnPickup('ammo', p.x, p.y, false);
    }
  }

  // ---- Missions -----------------------------------------------------------
  function currentStep() {
    if (!state.mission) return null;
    return state.mission.steps[state.stepIndex] || null;
  }

  function startMission() {
    if (state.missionActive || state.missionIndex >= MISSIONS.length) return false;
    const mission = MISSIONS[state.missionIndex];
    state.mission = mission;
    state.missionActive = true;
    state.stepIndex = 0;
    state.missionTimer = mission.timeLimit;
    state.stepState = { collected: 0 };
    state.dialogue = mission.brief.slice();
    state.dialogueIndex = 0;
    state.dialogueTimer = 5;
    state.toast = `Mission: ${mission.title}`;
    state.toastTimer = 4;
    if (mission.steps[0].type === 'survive') state.surviveLeft = mission.steps[0].seconds;
    if (mission.id === 'm2') {
      state.missionTargetCar = spawnParkedCar('sports', 3050, 700, Math.PI / 2, true);
    }
    if (mission.id === 'm3') {
      const spots = [[420, 420], [1560, 2200], [2560, 420], [900, 1100], [2300, 1800]];
      for (const [x, y] of spots) spawnPickup('cash', x, y, true);
      state.dropsLeft = 5;
      spawnPed(true, 480, 480);
      spawnPed(true, 2500, 480);
    }
    if (mission.id === 'm4') {
      state.wanted = 3;
      state.lastCrime = state.elapsed;
    }
    if (mission.id === 'm5') {
      spawnPed(true, 2150, 830);
      spawnPed(true, 2270, 950);
      spawnPed(true, 2210, 760);
    }
    return true;
  }

  function completeStep(events) {
    state.stepIndex += 1;
    if (state.stepIndex >= state.mission.steps.length) {
      const reward = state.mission.reward;
      state.cash += reward;
      state.toast = `Mission complete! +$${reward}`;
      state.toastTimer = 5;
      state.dialogue = [`MARA: Nice work, Jax. $${reward} is yours.`];
      state.dialogueIndex = 0;
      state.dialogueTimer = 5;
      state.missionActive = false;
      state.mission = null;
      state.missionIndex += 1;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyDone = true;
        state.toast = 'Story complete! Neon Bay is yours — free roam.';
        state.toastTimer = 7;
      }
      return events | EVENT_MISSION_DONE;
    }
    const step = currentStep();
    state.toast = step.label;
    state.toastTimer = 4;
    if (step.type === 'survive') state.surviveLeft = step.seconds;
    return events;
  }

  function failMission(events) {
    state.missionActive = false;
    state.mission = null;
    state.toast = 'Mission failed — press M to retry';
    state.toastTimer = 6;
    // Clean up mission props.
    for (const pk of pickups) if (pk.mission) pk.active = false;
    if (state.missionTargetCar) { state.missionTargetCar.active = false; state.missionTargetCar = null; }
    return events | EVENT_MISSION_FAIL;
  }

  // ---- Player -------------------------------------------------------------
  function updatePlayer(dt, input) {
    let events = 0;
    if (player.reloading > 0) player.reloading -= dt;
    if (player.fireTimer > 0) player.fireTimer -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    player.aimAngle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

    const car = player.inCar;
    if (car) {
      const type = CAR_TYPES[car.type];
      const throttle = -input.my;
      const steer = input.mx;
      if (throttle > 0) car.speed += type.accel * dt;
      else if (throttle < 0) car.speed -= (car.speed > 0 ? type.brake : type.accel * 0.6) * dt;
      else car.speed -= Math.sign(car.speed) * 140 * dt;
      if (input.handbrake) car.speed -= Math.sign(car.speed) * 420 * dt;
      if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
      const onRoad = city.isRoad(car.x, car.y);
      const max = type.max * (onRoad ? 1 : 0.55);
      car.speed = clamp(car.speed, -max * 0.45, max);
      const steerFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
      car.angle += steer * type.turn * steerFactor * dt * (car.speed >= 0 ? 1 : -1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(nx, 12, WORLD.waterX - 14);
      car.y = clamp(ny, 12, WORLD.height - 12);
      if (input.handbrake && Math.abs(car.speed) > 140) {
        const bx = car.x - Math.cos(car.angle) * 20;
        const by = car.y - Math.sin(car.angle) * 20;
        addSkid(bx, by, bx - Math.cos(car.angle) * 8, by - Math.sin(car.angle) * 8);
      }
      if (city.collideCircle(car, 20)) {
        if (Math.abs(car.speed) > 130) {
          car.hp -= 6;
          state.shake = Math.min(14, state.shake + 8);
          burst(car.x, car.y, '#f2c94c', 10, 160);
        }
        // Keep most of the speed so the car slides along the wall and the
        // player can steer away, instead of getting wedged in a corner.
        car.speed *= 0.85;
      }
      // Car vs traffic cars.
      for (const other of cars) {
        if (!other.active || other === car || other.kind === 'parked') continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const ux = (car.x - other.x) / d;
          const uy = (car.y - other.y) / d;
          car.x += ux * push; car.y += uy * push;
          other.x -= ux * push; other.y -= uy * push;
          if (Math.abs(car.speed - other.speed) > 120) {
            car.hp -= 4; other.hp -= 4;
            state.shake = Math.min(14, state.shake + 6);
            burst(car.x, car.y, '#f2c94c', 8, 140);
          }
          const avg = (car.speed + other.speed) / 2;
          car.speed = avg; other.speed = avg * 0.7;
        }
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      if (car.hp <= 0 && car.smoke === 0) {
        car.smoke = 1;
        state.toast = 'Your car is wrecked — get out (E)';
        state.toastTimer = 4;
      }
      if (input.interact) {
        player.inCar = null;
        if (car.target) car.kind = 'parked';
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        city.collideCircle(player, PLAYER.radius);
      }
      return events;
    }

    // On foot.
    const len = Math.hypot(input.mx, input.my);
    const speed = (input.run ? PLAYER.runSpeed : PLAYER.walkSpeed);
    if (len > 0) {
      const nx = player.x + (input.mx / len) * speed * dt;
      const ny = player.y + (input.my / len) * speed * dt;
      player.x = clamp(nx, 12, WORLD.waterX - 14);
      player.y = clamp(ny, 12, WORLD.height - 12);
      player.angle = Math.atan2(input.my, input.mx);
      city.collideCircle(player, PLAYER.radius);
    }
    player.speed = len > 0 ? speed : 0;

    // Enter a car.
    if (input.interact) {
      let best = null;
      let bestD = 70;
      for (const c of cars) {
        if (!c.active || c.kind === 'cop' || c.smoke) continue;
        const d = dist(player.x, player.y, c.x, c.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) {
        player.inCar = best;
        if (best.kind === 'traffic' && best.driver) {
          // Stealing a driven car is a crime the whole street sees.
          best.driver = false;
          events = addWanted(1, events);
          spawnPed(false, best.x + 30, best.y + 30);
        }
        best.kind = 'traffic';
        if (state.missionActive && state.missionTargetCar === best) {
          // Steal step handled in mission checks.
        }
      }
    }

    // Punch.
    if (input.punch && player.punchTimer <= 0) {
      player.punchTimer = 0.45;
      const px = player.x + Math.cos(player.aimAngle) * 34;
      const py = player.y + Math.sin(player.aimAngle) * 34;
      for (const ped of peds) {
        if (!ped.active || ped.dead) continue;
        if (dist(px, py, ped.x, ped.y) < 30) {
          ped.hp -= PLAYER.punchDamage;
          ped.x += Math.cos(player.aimAngle) * 24;
          ped.y += Math.sin(player.aimAngle) * 24;
          burst(ped.x, ped.y, '#ffffff', 6, 120);
          if (!ped.thug) events = addWanted(1, events);
          if (ped.hp <= 0) killPed(ped);
        }
      }
    }

    // Shoot.
    if (input.shooting && player.fireTimer <= 0 && player.mag > 0 && player.reloading <= 0) {
      player.fireTimer = 0.18;
      player.mag -= 1;
      const b = freeBullet();
      if (b) {
        b.active = true;
        b.x = player.x + Math.cos(player.aimAngle) * 22;
        b.y = player.y + Math.sin(player.aimAngle) * 22;
        b.vx = Math.cos(player.aimAngle) * 900;
        b.vy = Math.sin(player.aimAngle) * 900;
        b.life = 1.1;
        b.fromPlayer = true;
      }
      burst(b ? b.x : player.x, b ? b.y : player.y, '#ffd76a', 4, 90);
    }
    if (input.reload && player.mag < 12 && player.ammo > 0 && player.reloading <= 0) {
      player.reloading = 1.0;
      const take = Math.min(12 - player.mag, player.ammo);
      player.ammo -= take;
      player.mag += take;
    }
    return events;
  }

  function killPed(ped) {
    ped.dead = true;
    ped.fade = 3;
    burst(ped.x, ped.y, '#c23b4a', 12, 140);
    if (!ped.thug) {
      // Hitting a civilian is a crime the player may already have paid for.
    }
  }

  // ---- Traffic / pedestrians / police --------------------------------------
  function updateTraffic(dt) {
    for (const car of cars) {
      if (!car.active || car.kind !== 'traffic' || car === player.inCar || car.target) continue;
      // Car ahead in the same lane?
      let ahead = null;
      let aheadD = Infinity;
      for (const other of cars) {
        if (!other.active || other === car) continue;
        if (other.axis !== car.axis || Math.sign(other.dir) !== Math.sign(car.dir)) continue;
        const along = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
        const side = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
        if (along > 0 && along < aheadD && side < 40) { aheadD = along; ahead = other; }
      }
      let target = car.cruise;
      if (ahead && aheadD < 70) target = Math.max(0, ahead.speed * 0.85);
      car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
      if (car.axis === 'x') car.x += car.dir * car.speed * dt;
      else car.y += car.dir * car.speed * dt;
      // Turn at an intersection.
      const roads = car.axis === 'x' ? city.vRoads : city.hRoads;
      for (const r of roads) {
        const pos = car.axis === 'x' ? car.x : car.y;
        if (Math.abs(pos - r) < 8 && random.chance(0.004)) {
          car.axis = car.axis === 'x' ? 'y' : 'x';
          car.dir = random.chance(0.5) ? 1 : -1;
          car.road = r;
          car.lane = (car.dir > 0 ? 1 : -1) * 18;
          car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          break;
        }
      }
      if (car.axis === 'x') car.y = car.road + car.lane;
      else car.x = car.road + car.lane;
      car.x = clamp(car.x, 30, WORLD.beachX - 30);
      car.y = clamp(car.y, 30, WORLD.height - 30);
      if (car.hp <= 0) {
        car.active = false;
        burst(car.x, car.y, '#f2c94c', 16, 220);
      }
    }
    // Keep the streets busy.
    let trafficCount = 0;
    for (const c of cars) if (c.active && c.kind === 'traffic') trafficCount += 1;
    if (trafficCount < 12) spawnTrafficCar();
  }

  function updatePeds(dt) {
    let events = 0;
    for (const ped of peds) {
      if (!ped.active) continue;
      if (ped.dead) {
        ped.fade -= dt;
        if (ped.fade <= 0) ped.active = false;
        continue;
      }
      // Flee from a fast player car or gunfire.
      const pd = dist(ped.x, ped.y, player.x, player.y);
      if (pd < 110 && player.inCar && Math.abs(player.inCar.speed) > 150) ped.flee = 1.2;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.y - player.y, ped.x - player.x);
        ped.x += Math.cos(a) * 150 * dt;
        ped.y += Math.sin(a) * 150 * dt;
        ped.angle = a;
        city.collideCircle(ped, 10);
        continue;
      }
      if (ped.thug && pd < 320 && !player.inCar) {
        // Rival crew shoots at the player on foot.
        ped.shootTimer -= dt;
        ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
        if (ped.shootTimer <= 0) {
          ped.shootTimer = 1.3 + random.next() * 0.7;
          const b = freeBullet();
          if (b) {
            const a = ped.angle + (random.next() - 0.5) * 0.22;
            b.active = true; b.x = ped.x; b.y = ped.y;
            b.vx = Math.cos(a) * 620; b.vy = Math.sin(a) * 620;
            b.life = 1.0; b.fromPlayer = false;
          }
        }
        continue;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      const roads = ped.axis === 'x' ? city.vRoads : city.hRoads;
      for (const r of roads) {
        const pos = ped.axis === 'x' ? ped.x : ped.y;
        if (Math.abs(pos - r) < 6 && random.chance(0.003)) {
          ped.axis = ped.axis === 'x' ? 'y' : 'x';
          ped.dir = random.chance(0.5) ? 1 : -1;
          ped.road = r;
          ped.off = (random.chance(0.5) ? 1 : -1) * (WORLD.roadWidth / 2 + 12);
          ped.angle = ped.axis === 'x' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          break;
        }
      }
      if (ped.axis === 'x') ped.y = ped.road + ped.off;
      else ped.x = ped.road + ped.off;
      ped.x = clamp(ped.x, 20, WORLD.beachX - 20);
      ped.y = clamp(ped.y, 20, WORLD.height - 20);
      city.collideCircle(ped, 10);
      // Run over by the player's car.
      if (player.inCar && Math.abs(player.inCar.speed) > 60 && dist(ped.x, ped.y, player.x, player.y) < 26) {
        killPed(ped);
        if (!ped.thug) events = addWanted(1, events);
        state.shake = Math.min(14, state.shake + 5);
      }
    }
    let count = 0;
    for (const p of peds) if (p.active && !p.thug) count += 1;
    if (count < 18) spawnPed(false);
    return events;
  }

  function updateCops(dt, events) {
    const want = state.wanted;
    let cops = [];
    for (const c of cars) if (c.active && c.kind === 'cop') cops.push(c);
    const target = want === 0 ? 0 : Math.min(want, 5);
    while (cops.length < target) {
      const car = freeCar();
      if (!car) break;
      const a = random.next() * Math.PI * 2;
      const p = city.nearestRoadPoint(
        clamp(player.x + Math.cos(a) * 520, 100, WORLD.beachX - 100),
        clamp(player.y + Math.sin(a) * 520, 100, WORLD.height - 100),
      );
      car.active = true; car.kind = 'cop'; car.type = 'cop';
      car.x = p.x; car.y = p.y; car.axis = 'x'; car.dir = 1; car.road = p.y; car.lane = 18;
      car.angle = 0; car.speed = 200; car.cruise = 240 + want * 22;
      car.hp = 80; car.driver = true; car.target = false; car.smoke = 0; car.hitFlash = 0;
      car.color = CAR_TYPES.cop.color;
      cops.push(car);
    }
    while (cops.length > target) {
      const c = cops.pop();
      c.active = false;
    }
    for (const cop of cops) {
      const d = dist(cop.x, cop.y, player.x, player.y);
      // A cop that reaches the player brakes to a stop and makes the arrest;
      // one still closing in drives at pursuit speed. It stops inside the
      // arrest radius (64px) so the bust timer can actually run.
      const pursuitSpeed = d < 55 ? 0 : cop.cruise;
      cop.speed += clamp(pursuitSpeed - cop.speed, -420 * dt, 260 * dt);
      if (d < 250) {
        // Close in: leave the road and drive straight at the player, so a
        // suspect hiding in a lot or a park can still be caught.
        const a = Math.atan2(player.y - cop.y, player.x - cop.x);
        cop.x += Math.cos(a) * cop.speed * dt;
        cop.y += Math.sin(a) * cop.speed * dt;
        cop.angle = a;
        cop.x = clamp(cop.x, 30, WORLD.beachX - 30);
        cop.y = clamp(cop.y, 30, WORLD.height - 30);
      } else {
        const roads = cop.axis === 'x' ? city.vRoads : city.hRoads;
        let turned = false;
        for (const r of roads) {
          const pos = cop.axis === 'x' ? cop.x : cop.y;
          if (Math.abs(pos - r) < 9) {
            // Choose the axis/dir that gets closer to the player.
            const options = [];
            const cx = cop.axis === 'x' ? r : cop.x;
            const cy = cop.axis === 'x' ? cop.y : r;
            options.push({ axis: 'x', dir: 1, score: dist(cx + 60, cy, player.x, player.y) });
            options.push({ axis: 'x', dir: -1, score: dist(cx - 60, cy, player.x, player.y) });
            options.push({ axis: 'y', dir: 1, score: dist(cx, cy + 60, player.x, player.y) });
            options.push({ axis: 'y', dir: -1, score: dist(cx, cy - 60, player.x, player.y) });
            options.sort((a, b) => a.score - b.score);
            const best = options[0];
            if (best.axis !== cop.axis || best.dir !== cop.dir) {
              cop.axis = best.axis; cop.dir = best.dir; cop.road = best.axis === 'x' ? cy : cx;
              cop.lane = 0;
              turned = true;
            }
            break;
          }
        }
        if (!turned) {
          if (cop.axis === 'x') cop.x += cop.dir * cop.speed * dt;
          else cop.y += cop.dir * cop.speed * dt;
        }
        cop.angle = cop.axis === 'x' ? (cop.dir > 0 ? 0 : Math.PI) : (cop.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (cop.axis === 'x') cop.y = cop.road;
        else cop.x = cop.road;
        cop.x = clamp(cop.x, 30, WORLD.beachX - 30);
        cop.y = clamp(cop.y, 30, WORLD.height - 30);
      }
      // Ram / arrest.
      if (d < 64) {
        if (player.inCar) {
          if (Math.abs(player.inCar.speed) < 25) state.bustProgress += dt;
          else {
            player.inCar.speed *= 0.94;
            cop.speed *= 0.9;
            state.shake = Math.min(14, state.shake + 4);
          }
        } else {
          state.bustProgress += dt * 1.4;
        }
      }
      if (cop.hp <= 0) {
        cop.active = false;
        burst(cop.x, cop.y, '#f2c94c', 20, 240);
        events = addWanted(1, events);
      }
    }
    return events;
  }

  function updateBullets(dt, events) {
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height) { b.active = false; continue; }
      // Buildings stop bullets.
      let blocked = false;
      for (const bd of city.buildings) {
        if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) { blocked = true; break; }
      }
      if (blocked) { b.active = false; spawnParticle(b.x, b.y, 0, 0, 0.2, '#cccccc', 2); continue; }
      if (b.fromPlayer) {
        for (const ped of peds) {
          if (!ped.active || ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            b.active = false;
            ped.hp -= PLAYER.bulletDamage;
            burst(ped.x, ped.y, '#c23b4a', 8, 120);
            if (ped.hp <= 0) {
              killPed(ped);
              if (!ped.thug) events = addWanted(1, events);
            }
            break;
          }
        }
        if (!b.active) continue;
        for (const car of cars) {
          if (!car.active || car === player.inCar) continue;
          if (dist(b.x, b.y, car.x, car.y) < 24) {
            b.active = false;
            car.hp -= PLAYER.bulletDamage;
            car.hitFlash = 0.15;
            if (car.kind === 'cop' && car.hp <= 0) { /* handled in updateCops */ }
            if (car.kind === 'traffic' && car.hp <= 20) { car.active = false; burst(car.x, car.y, '#f2c94c', 14, 200); }
            break;
          }
        }
      } else {
        if (dist(b.x, b.y, player.x, player.y) < 16 && !player.inCar) {
          b.active = false;
          player.health -= 9;
          player.hurtTimer = 0.6;
          events |= EVENT_HURT;
          if (player.health <= 0) { player.health = 0; state.over = 'wasted'; events |= EVENT_WASTED; }
        }
      }
    }
    return events;
  }

  function updatePickups(dt, events) {
    for (const pk of pickups) {
      if (pk.active) {
        if (dist(pk.x, pk.y, player.x, player.y) < 34) {
          pk.active = false;
          pk.respawn = 25;
          if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); events |= EVENT_PICKUP; }
          else if (pk.kind === 'ammo') { player.ammo += 24; events |= EVENT_PICKUP; }
          else if (pk.kind === 'cash') {
            state.cash += 50;
            state.stepState.collected = (state.stepState.collected || 0) + 1;
            state.dropsLeft -= 1;
            events |= EVENT_CASH;
          }
        }
      } else if (pk.respawn > 0) {
        pk.respawn -= dt;
        if (pk.respawn <= 0 && !pk.mission) pk.active = true;
      }
    }
    return events;
  }

  function updateMissions(dt, events) {
    if (!state.missionActive || !state.mission) return events;
    state.missionTimer -= dt;
    if (state.missionTimer <= 0) return failMission(events);
    const step = currentStep();
    if (!step) return events;
    if (step.type === 'goto' || step.type === 'deliverCar') {
      if (step.type === 'deliverCar' && player.inCar !== state.missionTargetCar) return events;
      if (dist(player.x, player.y, step.x, step.y) < step.radius) {
        if (step.type === 'deliverCar') {
          player.inCar = null;
          player.x = step.x + 40; player.y = step.y + 40;
        }
        return completeStep(events);
      }
    } else if (step.type === 'steal') {
      if (player.inCar === state.missionTargetCar) {
        events = addWanted(1, events);
        return completeStep(events);
      }
    } else if (step.type === 'collect') {
      if ((state.stepState.collected || 0) >= step.count) return completeStep(events);
    } else if (step.type === 'survive') {
      state.surviveLeft -= dt;
      if (state.surviveLeft <= 0) {
        state.wanted = Math.max(0, state.wanted - 1);
        return completeStep(events);
      }
    }
    return events;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.timeOfDay = (state.timeOfDay + dt / 240) % 1;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.toastTimer > 0) { state.toastTimer -= dt; if (state.toastTimer <= 0) state.toast = ''; }
    if (state.dialogueTimer > 0) {
      state.dialogueTimer -= dt;
      if (state.dialogueTimer <= 0 && state.dialogueIndex < state.dialogue.length - 1) {
        state.dialogueIndex += 1;
        state.dialogueTimer = 5;
      }
    }
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    for (const s of skids) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    }
    for (const c of cars) if (c.hitFlash > 0) c.hitFlash -= dt;

    if (state.over) return events;
    if (!harmless) {
      // Wanted decay: hide long enough and the heat drops.
      if (state.wanted > 0 && state.elapsed - state.lastCrime > 12) {
        let nearestCop = Infinity;
        for (const c of cars) if (c.active && c.kind === 'cop') nearestCop = Math.min(nearestCop, dist(c.x, c.y, player.x, player.y));
        if (nearestCop > 450) {
          state.decayTimer += dt;
          if (state.decayTimer >= 8) { state.wanted -= 1; state.decayTimer = 0; }
        } else state.decayTimer = 0;
      }
      // Busted timer decays when no cop is close.
      let copNear = false;
      for (const c of cars) if (c.active && c.kind === 'cop' && dist(c.x, c.y, player.x, player.y) < 70) copNear = true;
      if (!copNear) state.bustProgress = Math.max(0, state.bustProgress - dt * 0.8);
      if (state.bustProgress > (player.inCar ? 2.5 : 1.5)) {
        state.over = 'busted';
        return events | EVENT_BUSTED;
      }
      // Slow health regen out of combat.
      if (player.hurtTimer <= 0 && player.health < PLAYER.health && !player.inCar) player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    events |= updatePlayer(dt, input);
    updateTraffic(dt);
    events |= updatePeds(dt);
    events = updateCops(dt, events);
    events = updateBullets(dt, events);
    events = updatePickups(dt, events);
    if (!harmless) {
      if (input.mission && !state.missionActive) {
        if (startMission()) events |= EVENT_PICKUP;
      }
      events = updateMissions(dt, events);
    }
    return events;
  }

  function getSave() {
    return {
      cash: state.cash,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      x: player.x, y: player.y, health: player.health, ammo: player.ammo,
    };
  }

  function applySave(save) {
    if (!save) return;
    state.cash = save.cash || 0;
    state.missionIndex = save.missionIndex || 0;
    state.storyDone = !!save.storyDone;
    player.x = save.x || 600;
    player.y = save.y || 600;
    player.health = save.health || PLAYER.health;
    player.ammo = save.ammo || PLAYER.pistolAmmo;
  }

  reset();
  return { state, city, reset, step, startMission, getSave, applySave, currentStep };
}
