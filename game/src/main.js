// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, busted, wasted.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. Progress (cash, missions, position)
// is saved to localStorage.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HURT, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MISSION, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Exposed for headless play-testing and debugging.
window.__game = { world, state: world.state };

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  let time = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { time, hasSave: false });
    painted += 1;
    time += 1 / 60;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let time = 0;
  let saveTimer = 0;
  // One-shot world actions (interact, punch, reload, mission) are kept until a
  // simulation step actually runs, so a press on a fast frame is never lost.
  let worldPending = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      world.reset();
      save = null;
    } else {
      world.reset();
      if (save) world.applySave(save);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Neon Bay. Press M to start a mission.');
  }

  function respawn() {
    const progress = { cash: world.state.cash, missionIndex: world.state.missionIndex, storyDone: world.state.storyDone, x: 600, y: 600, health: 100, ammo: 24 };
    world.reset();
    world.applySave(progress);
    screen = SCREEN_PLAY;
    announce('Back on the streets of Neon Bay.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) audio.coin();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_MISSION_DONE) { audio.mission(); writeSave(); }
    if (events & EVENT_MISSION_FAIL) audio.fail();
    if (events & EVENT_BUSTED) {
      audio.busted();
      screen = SCREEN_BUSTED;
      writeSave();
      announce('Busted by the Neon Bay police.');
    }
    if (events & EVENT_WASTED) {
      audio.fail();
      screen = SCREEN_WASTED;
      writeSave();
      announce('Wasted. Neon Bay is not kind to the careless.');
    }
  }

  function buildWorldInput(screenActions, worldActions) {
    const dpr = window.devicePixelRatio || 1;
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x * dpr, mouse.y * dpr);
    return {
      mx: input.moveX(),
      my: input.moveY(),
      run: input.run(),
      handbrake: input.handbrake(),
      aimX: aim.x,
      aimY: aim.y,
      shooting: mouse.down,
      punch: !!(worldActions & ACTION_PUNCH),
      interact: !!(worldActions & ACTION_INTERACT),
      reload: !!(worldActions & ACTION_RELOAD),
      mission: !!(worldActions & ACTION_MISSION),
      confirm: !!(screenActions & ACTION_CONFIRM),
      pause: !!(screenActions & ACTION_PAUSE),
    };
  }

  function handleScreens(wi) {
    if (screen === SCREEN_TITLE) {
      if (wi.confirm) startGame(false);
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (wi.confirm) respawn();
      return;
    }
    if (wi.pause) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        writeSave();
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(wi) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, run: false, handbrake: false, aimX: 0, aimY: 0, shooting: false, punch: false, interact: false, reload: false, mission: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, wi, false);
    handleEvents(events);
    saveTimer += STEP;
    if (saveTimer > 15) { saveTimer = 0; writeSave(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    time += dt;
    const screenActions = input.takeActions();
    worldPending |= screenActions & (ACTION_PUNCH | ACTION_INTERACT | ACTION_RELOAD | ACTION_MISSION);
    const wi = buildWorldInput(screenActions, worldPending);
    handleScreens(wi);
    let stepped = false;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(wi);
      accumulator -= STEP;
      stepped = true;
      wi.punch = false;
      wi.interact = false;
      wi.reload = false;
      wi.mission = false;
    }
    if (stepped) worldPending = 0;
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    // Audio follows the game.
    const p = world.state.player;
    const speed01 = p.inCar ? Math.abs(p.inCar.speed) / 460 : 0;
    audio.engine(speed01, !!p.inCar && screen === SCREEN_PLAY);
    audio.siren(world.state.wanted > 0 && screen === SCREEN_PLAY);
    audio.music(STEP, screen === SCREEN_PLAY);
    renderer.draw(world.state, screen, {
      time,
      hasSave: !!save,
      hint: 'WASD move/drive • E enter car • Click shoot • F punch • R reload • M mission • P pause',
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });
  // Space/Enter/click on the title starts a fresh game; Enter continues a save.
  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_TITLE) return;
    if (event.code === 'Enter' && save) startGame(false);
    else if (event.code === 'Space') startGame(true);
  });

  announce('Neon Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
