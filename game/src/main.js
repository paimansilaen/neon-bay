// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and busted.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot. The start shot always
// shows a fresh game: it clears the save first, so a stale save never leaks
// into the title screen.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH, EVENT_RELOAD, EVENT_SHOT, EVENT_SIREN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MISSION,
  ACTION_PAUSE,
  ACTION_SHOOT,
  createInput,
  createScriptedInput,
} from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, cameraFor } from './render.js';
import { stageShot } from './shots.js';
import { sfx, startMusic, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

// A handle for headless tests: the world, the renderer and (once the game
// runs) the live input. Not part of the game itself.
window.__neon = { world, renderer, input: null, seed };

function runShot(name) {
  if (name === 'start') world.clearSave();
  const scene = stageShot(name, world, seed);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  window.__neon.input = input;
  const idle = createScriptedInput();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // The save, if one exists, lands on the fresh world: money, missions and
  // health carry over between visits.
  const hadSave = world.loadGame();
  const saved = hadSave ? { money: world.state.money, missionsDone: world.state.missionsDone } : null;

  // Screen readers (and anyone watching the page's text) hear the screen
  // changes and the mission results.
  function announce(message) {
    status.textContent = message;
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) sfx.shoot();
    if (events & EVENT_HIT) sfx.hit();
    if (events & EVENT_PICKUP) sfx.pickup();
    if (events & EVENT_CASH) sfx.cash();
    if (events & EVENT_PUNCH) sfx.punch();
    if (events & EVENT_RELOAD) sfx.reload();
    if (events & EVENT_CRASH) sfx.hit();
    if (events & EVENT_SIREN) sfx.siren();
    if (events & EVENT_MISSION) {
      sfx.mission();
      world.saveGame();
      announce(`Mission complete. $${world.state.money} banked, ${world.state.missionsDone} of 5 missions done.`);
    }
    if (events & EVENT_BUSTED) {
      sfx.busted();
      world.saveGame();
      screen = SCREEN_BUSTED;
      announce('Busted. Your money and missions are kept.');
    }
  }

  function startGame() {
    screen = SCREEN_PLAY;
    unlockAudio();
    startMusic();
    announce('Playing. Press M to start a mission, E to enter a car.');
  }

  function viewport() {
    return { w: canvas.clientWidth || 1280, h: canvas.clientHeight || 720 };
  }

  function updateView() {
    const { w, h } = viewport();
    const cam = cameraFor(world.state, w, h);
    world.setView(cam.x, cam.y, cam.w, cam.h, w, h);
  }

  function handleScreenActions() {
    let mask = ACTION_PAUSE | ACTION_MISSION;
    if (screen === SCREEN_TITLE) mask |= ACTION_CONFIRM | ACTION_SHOOT;
    else if (screen === SCREEN_PAUSED) mask |= ACTION_CONFIRM;
    const actions = input.takeActions(mask);
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_MISSION && screen === SCREEN_PLAY && !world.state.mission && world.state.missionsDone < 5) {
      world.startMission(world.state.missionsDone);
    }
    if (actions & (ACTION_CONFIRM | ACTION_SHOOT) && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    updateView();
    const events = world.step(STEP, input);
    handleEvents(events);
    if (screen === SCREEN_BUSTED && !world.state.busted) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleScreenActions();
    if (screen === SCREEN_TITLE) {
      updateView();
      while (accumulator >= STEP) {
        world.step(STEP, idle);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY || screen === SCREEN_BUSTED) {
      while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_BUSTED)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world.city, screen, saved);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
