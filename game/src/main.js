// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and busted. The save (money, missions) loads
// at boot and is written whenever a mission completes.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__game exposes the live state for automated play-tests, and window.__errors
// collects every page error so a test can demand zero of them.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_HURT, EVENT_MISSION_DONE, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MISSION, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message ?? event.error ?? 'error'));
});
const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  window.__errors.push(args.map((a) => String(a)).join(' '));
  originalConsoleError(...args);
};

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = buildCity(createRandom(seed));
const world = createWorld(createRandom(seed + 101), city);
const renderer = createRenderer(canvas);
const audio = createAudio();

let screen = SCREEN_TITLE;
window.__game = {
  state: world.state,
  get screen() { return screen; },
  world,
  city,
  seed,
};

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, city, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  world.loadSave();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.loadSave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Neon Bay. Press M to start a mission.');
  }

  function showBusted() {
    screen = SCREEN_BUSTED;
    audio.busted();
    announce('Busted. Your money and missions are kept. Press Enter to continue.');
  }

  function respawn() {
    audio.unlock();
    world.respawnAfterBust();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Back on the streets.');
  }

  function handleEvents(events) {
    if (events & EVENT_BUSTED) {
      showBusted();
      return;
    }
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      const done = world.state.missionsDone;
      announce(`Mission complete. ${done} of 5 done. $${world.state.money}.`);
    }
    if (events & EVENT_HURT) {
      audio.hurt();
      world.state.shake = 0.7;
    }
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PUNCH) audio.punch();
  }

  function step(actions, first) {
    const aimScreen = input.aim();
    const aimWorld = renderer.screenToWorld(aimScreen.x, aimScreen.y, world.state);
    const stepInput = {
      move: input.move(),
      aim: aimWorld,
      // One-shot presses land on the first step of their frame only, never twice.
      shoot: first && Boolean(actions & ACTION_SHOOT),
      punch: first && Boolean(actions & ACTION_PUNCH),
      reload: first && Boolean(actions & ACTION_RELOAD),
      enter: first && Boolean(actions & ACTION_ENTER),
      mission: first && Boolean(actions & ACTION_MISSION),
    };
    const events = world.step(STEP, stepInput);
    const car = world.state.cars.find((c) => c.id === world.state.player.inCar);
    audio.engine(car !== undefined, car ? Math.abs(car.speed) / 560 : 0);
    audio.update(STEP, world.state.wanted);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // The queue is taken exactly once per frame, here; step() receives the same press.
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_BUSTED) respawn();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(actions, first);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, city, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
