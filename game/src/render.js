// Drawing only: the world's state and the current screen in, pixels out.
// The camera follows the player over a 3400x2600 city; a 1280x720 logical view
// is scaled to the window. Flat vector shapes, canvas text, no images.
import { CAR_TYPES, MISSIONS, PLAYER, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const VIEW_W = 1280;
const VIEW_H = 720;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MINIMAP = { x: VIEW_W - 226, y: 16, w: 210, h: 160 };

function daylightFactor(timeOfDay) {
  const sun = Math.sin(timeOfDay * Math.PI * 2);
  return Math.max(0.18, Math.min(1, 0.55 + sun * 0.45));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  let camX = 0;
  let camY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function rr(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawCity(state, time) {
    const city = state.city;
    const daylight = daylightFactor(state.timeOfDay);
    // Grass base.
    context.fillStyle = daylight > 0.6 ? '#4d7a44' : '#3a5c36';
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach + water.
    context.fillStyle = '#d9c27a';
    context.fillRect(WORLD.beachX, 0, WORLD.waterX - WORLD.beachX, WORLD.height);
    context.fillStyle = '#2a6ea8';
    context.fillRect(WORLD.waterX, 0, WORLD.width - WORLD.waterX, WORLD.height);
    context.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < WORLD.height; y += 90) {
      const wob = Math.sin(time * 1.4 + y * 0.02) * 8;
      context.fillRect(WORLD.waterX + 6 + wob, y, 26, 4);
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = daylight > 0.6 ? '#5d9448' : '#476e38';
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Parking lots.
    for (const lot of city.lots) {
      context.fillStyle = '#55585e';
      context.fillRect(lot.x, lot.y, lot.w, lot.h);
      context.strokeStyle = '#8a8d92';
      context.lineWidth = 2;
      for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 46) {
        context.beginPath();
        context.moveTo(x, lot.y + 10);
        context.lineTo(x, lot.y + 34);
        context.stroke();
      }
    }
    // Roads: asphalt + centre dashes.
    context.fillStyle = '#33363d';
    for (const x of city.vRoads) context.fillRect(x - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.height);
    for (const y of city.hRoads) context.fillRect(0, y - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    context.fillStyle = '#c9a83c';
    for (const x of city.vRoads) {
      for (let y = 20; y < WORLD.height; y += 64) context.fillRect(x - 2, y, 4, 30);
    }
    for (const y of city.hRoads) {
      for (let x = 20; x < WORLD.beachX; x += 64) context.fillRect(x, y - 2, 30, 4);
    }
    // Sidewalk edges.
    context.strokeStyle = 'rgba(220,220,210,0.35)';
    context.lineWidth = 3;
    for (const x of city.vRoads) {
      context.beginPath(); context.moveTo(x - WORLD.roadWidth / 2, 0); context.lineTo(x - WORLD.roadWidth / 2, WORLD.height); context.stroke();
      context.beginPath(); context.moveTo(x + WORLD.roadWidth / 2, 0); context.lineTo(x + WORLD.roadWidth / 2, WORLD.height); context.stroke();
    }
    for (const y of city.hRoads) {
      context.beginPath(); context.moveTo(0, y - WORLD.roadWidth / 2); context.lineTo(WORLD.beachX, y - WORLD.roadWidth / 2); context.stroke();
      context.beginPath(); context.moveTo(0, y + WORLD.roadWidth / 2); context.lineTo(WORLD.beachX, y + WORLD.roadWidth / 2); context.stroke();
    }
    // Buildings: shadow, wall, roof.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.wall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(b.x + 10, b.y + 10, Math.max(8, b.w - 26), 6);
    }
    // Trees.
    for (const t of city.trees) {
      context.fillStyle = '#2f6b2f';
      context.beginPath(); context.arc(t.x, t.y, t.r, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#4a9a4a';
      context.beginPath(); context.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); context.fill();
    }
    // Street lamps glow at night.
    if (daylight < 0.5) {
      context.fillStyle = 'rgba(255,220,120,0.5)';
      for (const lamp of city.lamps) {
        context.beginPath(); context.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2); context.fill();
      }
    }
    return daylight;
  }

  function drawCar(car, time, daylight) {
    const type = CAR_TYPES[car.type];
    const len = car.type === 'truck' ? 52 : 42;
    const wid = car.type === 'truck' ? 22 : 20;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.smoke) {
      context.fillStyle = 'rgba(60,60,60,0.6)';
      context.beginPath(); context.arc(-8 + Math.sin(time * 5) * 4, -6, 8, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = 'rgba(0,0,0,0.35)';
    rr(-len / 2 + 3, -wid / 2 + 3, len, wid, 6); context.fill();
    context.fillStyle = car.hitFlash > 0 ? '#ffffff' : car.color;
    rr(-len / 2, -wid / 2, len, wid, 6); context.fill();
    if (car.type === 'cop') {
      context.fillStyle = '#f2f2f2';
      context.fillRect(-4, -wid / 2, 8, wid);
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
      context.beginPath(); context.arc(-2, -wid / 2 + 2, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
      context.beginPath(); context.arc(6, -wid / 2 + 2, 4, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = '#1c2733';
    rr(-6, -wid / 2 + 3, 14, wid - 6, 3); context.fill();
    context.fillStyle = type.color2;
    rr(len / 2 - 10, -wid / 2 + 2, 6, wid - 4, 2); context.fill();
    if (car.target) {
      context.fillStyle = '#ffd76a';
      context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.fill();
    }
    context.restore();
    // Headlights at night.
    if (daylight < 0.5) {
      context.fillStyle = 'rgba(255,240,180,0.5)';
      context.beginPath(); context.arc(car.x + Math.cos(car.angle) * (len / 2 + 4), car.y + Math.sin(car.angle) * (len / 2 + 4), 3, 0, Math.PI * 2); context.fill();
    }
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.dead) {
      context.globalAlpha = Math.max(0, ped.fade / 3);
      context.rotate(ped.angle + Math.PI / 2);
      context.fillStyle = ped.color;
      context.beginPath(); context.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); context.fill();
      context.restore();
      return;
    }
    context.rotate(ped.angle);
    context.fillStyle = ped.color;
    context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#1c2733';
    context.beginPath(); context.arc(5, 0, 3, 0, Math.PI * 2); context.fill();
    if (ped.thug) {
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(6, 0); context.lineTo(16, 0); context.stroke();
    }
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    context.save();
    context.translate(p.x, p.y);
    if (p.inCar) {
      context.restore();
      return;
    }
    // Aim line.
    context.strokeStyle = 'rgba(255,255,255,0.35)';
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, 0); context.lineTo(Math.cos(p.aimAngle) * 34, Math.sin(p.aimAngle) * 34); context.stroke();
    context.rotate(p.angle);
    context.fillStyle = '#e8e8e8';
    context.beginPath(); context.arc(0, 0, 13, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#2a9ad8';
    context.beginPath(); context.arc(0, 0, 10, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#1c2733';
    context.beginPath(); context.arc(6, 0, 4, 0, Math.PI * 2); context.fill();
    context.restore();
    // Pistol.
    context.strokeStyle = '#222';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(p.x + Math.cos(p.aimAngle) * 10, p.y + Math.sin(p.aimAngle) * 10);
    context.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
    context.stroke();
  }

  function drawMissionMarker(state, time) {
    if (!state.missionActive || !state.mission) return;
    const step = state.mission.steps[state.stepIndex];
    if (!step || step.type === 'survive') return;
    let tx = step.x;
    let ty = step.y;
    if (step.type === 'collect') {
      // Point at the nearest remaining cash drop.
      let best = null;
      let bestD = Infinity;
      for (const pk of state.pickups) {
        if (!pk.active || pk.kind !== 'cash') continue;
        const d = Math.hypot(pk.x - state.player.x, pk.y - state.player.y);
        if (d < bestD) { bestD = d; best = pk; }
      }
      if (!best) return;
      tx = best.x; ty = best.y;
    }
    if (step.type === 'steal' && state.missionTargetCar) { tx = state.missionTargetCar.x; ty = state.missionTargetCar.y; }
    const pulse = 30 + Math.sin(time * 4) * 8;
    context.strokeStyle = '#ffd76a';
    context.lineWidth = 4;
    context.beginPath(); context.arc(tx, ty, pulse, 0, Math.PI * 2); context.stroke();
    context.fillStyle = 'rgba(255,215,106,0.25)';
    context.beginPath(); context.arc(tx, ty, pulse, 0, Math.PI * 2); context.fill();
    context.fillStyle = 'rgba(255,215,106,0.12)';
    context.fillRect(tx - 4, ty - 260, 8, 260);
  }

  function drawHud(state, screen, ui) {
    const p = state.player;
    // Cash / health / wanted / ammo, top-left.
    context.fillStyle = 'rgba(10,14,20,0.65)';
    rr(16, 16, 250, 96, 10); context.fill();
    text(`$${state.cash}`, 30, 48, 28, '#7be07b', 'left', true);
    text(`Mission ${Math.min(state.missionIndex + 1, MISSIONS.length)}/${MISSIONS.length}`, 30, 76, 16, '#eef1f5');
    context.fillStyle = '#333';
    rr(30, 86, 180, 12, 6); context.fill();
    context.fillStyle = p.health > 40 ? '#4ac25a' : '#e5534b';
    rr(30, 86, Math.max(0, 180 * (p.health / PLAYER.health)), 12, 6); context.fill();
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 30, 122, 20, state.wanted > 0 ? '#ffd76a' : '#8b93a3');
    text(p.inCar ? `Ammo ${p.mag}/${p.ammo}` : `Ammo ${p.mag}/${p.ammo}  •  ${p.inCar ? 'in car' : 'on foot'}`, 30, 142, 14, '#c9ced6');
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.inCar.speed) * 0.55);
      text(`${kmh} km/h`, VIEW_W - 260, VIEW_H - 30, 26, '#eef1f5', 'right', true);
      text(CAR_TYPES[p.inCar.type].name, VIEW_W - 260, VIEW_H - 56, 14, '#c9ced6', 'right');
    }
    // Minimap.
    const mm = MINIMAP;
    context.fillStyle = 'rgba(10,14,20,0.8)';
    rr(mm.x - 6, mm.y - 6, mm.w + 12, mm.h + 12, 8); context.fill();
    const sx = mm.w / WORLD.width;
    const sy = mm.h / WORLD.height;
    context.fillStyle = '#2a6ea8';
    context.fillRect(mm.x + WORLD.beachX * sx, mm.y, (WORLD.width - WORLD.beachX) * sx, mm.h);
    context.fillStyle = '#3d4a3d';
    context.fillRect(mm.x, mm.y, WORLD.beachX * sx, mm.h);
    context.strokeStyle = '#55585e';
    context.lineWidth = 1;
    for (const x of state.city.vRoads) {
      context.beginPath(); context.moveTo(mm.x + x * sx, mm.y); context.lineTo(mm.x + x * sx, mm.y + mm.h); context.stroke();
    }
    for (const y of state.city.hRoads) {
      context.beginPath(); context.moveTo(mm.x, mm.y + y * sy); context.lineTo(mm.x + mm.w, mm.y + y * sy); context.stroke();
    }
    for (const car of state.cars) {
      if (!car.active) continue;
      context.fillStyle = car.kind === 'cop' ? '#ff2a2a' : '#9aa0aa';
      context.fillRect(mm.x + car.x * sx - 1.5, mm.y + car.y * sy - 1.5, 3, 3);
    }
    if (state.missionActive && state.mission) {
      const step = state.mission.steps[state.stepIndex];
      if (step && step.x !== undefined) {
        context.fillStyle = '#ffd76a';
        context.beginPath(); context.arc(mm.x + step.x * sx, mm.y + step.y * sy, 5, 0, Math.PI * 2); context.fill();
      }
    }
    context.fillStyle = '#4ac25a';
    context.beginPath(); context.arc(mm.x + p.x * sx, mm.y + p.y * sy, 4, 0, Math.PI * 2); context.fill();
    text('NEON BAY', mm.x, mm.y + mm.h + 22, 12, '#c9ced6');
    // Mission objective, bottom centre.
    if (state.missionActive && state.mission) {
      const step = state.mission.steps[state.stepIndex];
      if (step) {
        let label = step.label;
        if (step.type === 'collect') label = `Collect the cash drops (${state.stepState.collected || 0}/${step.count})`;
        if (step.type === 'survive') label = `Survive the heat — ${Math.ceil(state.surviveLeft)}s left`;
        const target = step.x !== undefined ? Math.round(Math.hypot(step.x - p.x, step.y - p.y)) : 0;
        context.fillStyle = 'rgba(10,14,20,0.65)';
        const w = 560;
        rr((VIEW_W - w) / 2, VIEW_H - 118, w, 52, 10); context.fill();
        text(`${state.mission.title}  •  ${Math.max(0, Math.ceil(state.missionTimer))}s`, VIEW_W / 2, VIEW_H - 92, 16, '#ffd76a', 'center', true);
        text(target ? `${label}  —  ${target}m` : label, VIEW_W / 2, VIEW_H - 70, 16, '#eef1f5', 'center');
      }
    } else if (!state.storyDone) {
      context.fillStyle = 'rgba(10,14,20,0.6)';
      rr((VIEW_W - 460) / 2, VIEW_H - 78, 460, 34, 10); context.fill();
      text(`Press M to start mission: ${MISSIONS[state.missionIndex].title}`, VIEW_W / 2, VIEW_H - 55, 15, '#ffd76a', 'center');
    } else {
      context.fillStyle = 'rgba(10,14,20,0.6)';
      rr((VIEW_W - 460) / 2, VIEW_H - 78, 460, 34, 10); context.fill();
      text('Story complete — free roam Neon Bay', VIEW_W / 2, VIEW_H - 55, 15, '#7be07b', 'center');
    }
    // Dialogue box.
    if (state.dialogue.length > 0 && state.dialogueTimer > 0) {
      const line = state.dialogue[state.dialogueIndex];
      context.fillStyle = 'rgba(10,14,20,0.75)';
      rr(180, VIEW_H - 190, VIEW_W - 360, 56, 10); context.fill();
      text(line, VIEW_W / 2, VIEW_H - 155, 17, '#eef1f5', 'center');
    }
    // Toast.
    if (state.toastTimer > 0 && state.toast) {
      text(state.toast, VIEW_W / 2, 150, 24, '#ffd76a', 'center', true);
    }
    // Busted progress warning.
    if (state.bustProgress > 0.2) {
      text('THE POLICE ARE ARRESTING YOU — DRIVE AWAY!', VIEW_W / 2, 190, 22, '#ff5a5a', 'center', true);
    }
    if (ui && ui.hint) text(ui.hint, 16, VIEW_H - 16, 13, '#8b93a3');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 680;
    const lineH = 30;
    const height = 170 + lines.length * lineH;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(10,14,20,0.88)';
    rr(x, y, width, height, 14); context.fill();
    context.strokeStyle = accent || '#ffd76a';
    context.lineWidth = 3;
    rr(x, y, width, height, 14); context.stroke();
    text(title, VIEW_W / 2, y + 72, 46, accent || '#ffd76a', 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 122 + i * lineH, 18, '#dfe3e8', 'center');
    }
    text(prompt, VIEW_W / 2, y + height - 34, 20, '#ffd76a', 'center');
  }

  function drawWorld(state, time) {
    const p = state.player;
    camX = Math.max(0, Math.min(WORLD.width - VIEW_W, p.x - VIEW_W / 2));
    camY = Math.max(0, Math.min(WORLD.height - VIEW_H, p.y - VIEW_H / 2));
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.save();
    context.translate(-camX + shx, -camY + shy);
    const daylight = drawCity(state, time);
    // Skid marks.
    context.strokeStyle = 'rgba(20,20,20,0.5)';
    context.lineWidth = 4;
    for (const s of state.skids) {
      if (!s.active) continue;
      context.globalAlpha = Math.min(1, s.life / 6);
      context.beginPath(); context.moveTo(s.x1, s.y1); context.lineTo(s.x2, s.y2); context.stroke();
    }
    context.globalAlpha = 1;
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const pulse = 1 + Math.sin(time * 5) * 0.15;
      context.save();
      context.translate(pk.x, pk.y);
      context.scale(pulse, pulse);
      if (pk.kind === 'health') {
        context.fillStyle = '#ffffff';
        context.fillRect(-10, -10, 20, 20);
        context.fillStyle = '#e5534b';
        context.fillRect(-3, -8, 6, 16);
        context.fillRect(-8, -3, 16, 6);
      } else if (pk.kind === 'ammo') {
        context.fillStyle = '#2a2e35';
        context.fillRect(-10, -8, 20, 16);
        context.fillStyle = '#ffd76a';
        context.fillRect(-6, -5, 3, 10);
        context.fillRect(0, -5, 3, 10);
        context.fillRect(6, -5, 3, 10);
      } else {
        context.fillStyle = '#2f7a2f';
        context.beginPath(); context.arc(0, 0, 11, 0, Math.PI * 2); context.fill();
        text('$', 0, 5, 14, '#ffffff', 'center', true);
      }
      context.restore();
    }
    drawMissionMarker(state, time);
    for (const car of state.cars) if (car.active) drawCar(car, time, daylight);
    for (const ped of state.peds) if (ped.active) drawPed(ped);
    drawPlayer(state);
    // Bullets.
    context.strokeStyle = '#ffd76a';
    context.lineWidth = 3;
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      if (!pt.active) continue;
      context.globalAlpha = Math.max(0, pt.life / pt.max);
      context.fillStyle = pt.color;
      context.beginPath(); context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
    context.restore();
    // Night tint over the whole view.
    const night = 1 - daylight;
    if (night > 0.05) {
      context.fillStyle = `rgba(8,12,40,${(night * 0.42).toFixed(3)})`;
      context.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    return { camX, camY };
  }

  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const time = (ui && ui.time) || 0;
    if (screen === SCREEN_TITLE) {
      // Slow pan over the city as a backdrop.
      const px = state.player.x;
      const py = state.player.y;
      state.player.x = 1200 + Math.sin(time * 0.05) * 500;
      state.player.y = 1100 + Math.cos(time * 0.04) * 300;
      drawWorld(state, time);
      state.player.x = px;
      state.player.y = py;
      context.fillStyle = 'rgba(6,8,14,0.55)';
      context.fillRect(0, 0, VIEW_W, VIEW_H);
      text('NEON BAY', VIEW_W / 2, 150, 84, '#ffd76a', 'center', true);
      text('an open-world crime story — an original work', VIEW_W / 2, 190, 20, '#eef1f5', 'center');
      const lines = [
        'Jax Marlowe came to Neon Bay to drive a delivery van.',
        'One package later, Mara Voss and her crew own his evenings.',
        'Five jobs. One city. Every street is yours — on foot or behind the wheel.',
        '',
        'WASD / arrows — move & drive    •    E — enter / exit car    •    Mouse — aim, click — shoot',
        'F — punch    •    R — reload    •    M — start mission    •    P — pause    •    Shift — run',
      ];
      for (let i = 0; i < lines.length; i += 1) text(lines[i], VIEW_W / 2, 250 + i * 30, 18, '#dfe3e8', 'center');
      const prompt = ui && ui.hasSave ? 'Press Enter to continue your save — or Space for a new game' : 'Press Space or click to start';
      text(prompt, VIEW_W / 2, 470, 22, '#ffd76a', 'center', true);
      text('Best played in desktop Chrome. Sound on for the full Neon Bay vibe.', VIEW_W / 2, 640, 14, '#8b93a3', 'center');
      return;
    }
    drawWorld(state, time);
    drawHud(state, screen, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except right now.'], 'Press P to resume', '#4fc3f7');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Neon Bay police caught ${state.player.inCar ? 'your car' : 'you'}.`, `Cash kept: $${state.cash}   •   Missions done: ${state.missionIndex}`], 'Press Space to get back out there', '#4fc3f7');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['Neon Bay is not kind to the careless.', `Cash kept: $${state.cash}   •   Missions done: ${state.missionIndex}`], 'Press Space to try again', '#e5534b');
    }
  }

  /** Convert device-pixel screen coordinates to world coordinates (for aiming). */
  function screenToWorld(sx, sy) {
    return { x: (sx - view.x) / view.scale + camX, y: (sy - view.y) / view.scale + camY };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
