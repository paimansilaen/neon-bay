// Keyboard and mouse input. Held keys give a move vector; one-shot presses
// (enter a car, punch, reload, start a mission, pause, confirm) are queued and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse aims the pistol and a click shoots.

export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_RELOAD = 4;
export const ACTION_MISSION = 8;
export const ACTION_PAUSE = 16;
export const ACTION_CONFIRM = 32;
export const ACTION_SHOOT = 64;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) held.add(event.code);
    else if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    else if (event.code === 'KeyM') actions |= ACTION_MISSION;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_CONFIRM;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });

  function has(codeSet) {
    for (const code of codeSet) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Move vector, each component -1, 0 or 1. On foot this is a screen direction; driving, y is throttle and x is steering. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { x, y };
    },
    /** Shift held: run on foot. */
    isRun() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Space held: handbrake while driving. */
    isHandbrake() {
      return held.has('Space');
    },
    /** The mouse position in canvas pixels, and whether the button is held. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. With a mask, takes only those flags and leaves the rest queued. */
    takeActions(mask) {
      if (mask === undefined) {
        const taken = actions;
        actions = 0;
        return taken;
      }
      const taken = actions & mask;
      actions &= ~mask;
      return taken;
    },
  };
}

/**
 * A synthetic input for scripted scenes (screenshots and tests). It answers
 * the same move/mouse/takeActions shape as createInput, driven by a function
 * that fills it in every frame.
 */
export function createScriptedInput() {
  let move = { x: 0, y: 0 };
  let run = false;
  let brake = false;
  let mouse = { x: 0, y: 0, down: false };
  let actions = 0;
  return {
    set(next) {
      move = next.move ?? move;
      run = next.run ?? run;
      brake = next.brake ?? brake;
      mouse = next.mouse ?? mouse;
      actions |= next.actions ?? 0;
    },
    move() {
      return move;
    },
    isRun() {
      return run;
    },
    isHandbrake() {
      return brake;
    },
    mouse() {
      return mouse;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
