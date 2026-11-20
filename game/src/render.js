// The renderer: a canvas view of the city, the cars and people in it, the HUD, the live minimap,
// and the title, pause and BUSTED screens. The camera follows the player across the 3400x2600
// city and the view scales to the window, so no drawing depends on the screen size.

import { BEACH_X, CAR_TYPES, DAY_LENGTH, FIELD, PALETTE, ROADS, VIEW, WATER_X } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_BUSTED = 3;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function nightFactor(time) {
    const phase = (time % DAY_LENGTH) / DAY_LENGTH;
    const daylight = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
    return (1 - daylight) * 0.34;
  }

  function drawRoads() {
    const half = ROADS.width / 2;
    for (const vx of ROADS.vertical) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(vx - half - 7, 0, ROADS.width + 14, FIELD.height);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(vx - half, 0, ROADS.width, FIELD.height);
    }
    for (const hy of ROADS.horizontal) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, hy - half - 7, BEACH_X, ROADS.width + 14);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(0, hy - half, BEACH_X, ROADS.width);
    }
    // Centre dashes, along each road.
    ctx.fillStyle = PALETTE.roadEdge;
    for (const vx of ROADS.vertical) {
      for (let y = 20; y < FIELD.height; y += 70) ctx.fillRect(vx - 2, y, 4, 34);
    }
    for (const hy of ROADS.horizontal) {
      for (let x = 20; x < BEACH_X; x += 70) ctx.fillRect(x, hy - 2, 34, 4);
    }
  }

  function drawBuildings(city, night) {
    for (const b of city.buildings) {
      const shade = 0.85 + b.shade * 0.3;
      ctx.fillStyle = PALETTE.building;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = `rgba(255,255,255,${(shade - 0.85) * 0.5})`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingRoof;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      // Windows: a grid of small lit or dark panes.
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const lit = ((c * 7 + r * 13 + Math.floor(b.shade * 97)) % 5) < (night > 0.15 ? 3 : 1);
          ctx.fillStyle = lit ? 'rgba(255, 214, 110, 0.85)' : 'rgba(10, 14, 22, 0.6)';
          ctx.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 14, 12);
        }
      }
    }
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      for (const tree of park.trees) {
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.25, tree.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCarShape(x, y, angle, type, color, isPlayer) {
    const def = CAR_TYPES[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-def.length / 2 - 4, -def.width / 2 - 4, def.length + 8, def.width + 8);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-def.length / 2, -def.width / 2, def.length, def.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(12, 16, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-def.length / 2 + 12, -def.width / 2 + 5, 16, def.width - 10, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(def.length / 2 - 26, -def.width / 2 + 5, 14, def.width - 10, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 170, 0.9)';
    ctx.fillRect(def.length / 2 - 3, -def.width / 2 + 4, 3, 6);
    ctx.fillRect(def.length / 2 - 3, def.width / 2 - 10, 3, 6);
    ctx.restore();
  }

  function drawCop(cop, time) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.roundRect(-32, -15, 64, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-8, -15, 22, 30);
    ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? PALETTE.copLightRed : PALETTE.copLightBlue;
    ctx.beginPath();
    ctx.arc(-6, -8, 5, 0, Math.PI * 2);
    ctx.arc(6, -8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (cop.bust > 0.25) {
      ctx.strokeStyle = 'rgba(255, 90, 78, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 34, -Math.PI / 2, -Math.PI / 2 + (cop.bust / 1.2) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMinimap(state) {
    const mw = 170;
    const mh = 130;
    const mx = VIEW.width - mw - 14;
    const my = 14;
    const sx = mw / FIELD.width;
    const sy = mh / FIELD.height;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (const vx of ROADS.vertical) {
      ctx.beginPath();
      ctx.moveTo(mx + vx * sx, my);
      ctx.lineTo(mx + vx * sx, my + mh);
      ctx.stroke();
    }
    for (const hy of ROADS.horizontal) {
      ctx.beginPath();
      ctx.moveTo(mx, my + hy * sy);
      ctx.lineTo(mx + mw, my + hy * sy);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx + WATER_X * sx, my, mw - WATER_X * sx, mh);
    if (state.mission && state.mission.objective) {
      ctx.fillStyle = PALETTE.objective;
      const ox = mx + state.mission.objective.x * sx;
      const oy = my + state.mission.objective.y * sy;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    for (const car of state.cars) {
      ctx.fillStyle = 'rgba(200,200,200,0.7)';
      ctx.fillRect(mx + car.x * sx - 1.5, my + car.y * sy - 1.5, 3, 3);
    }
    for (const cop of state.cops) {
      ctx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? PALETTE.copLightRed : PALETTE.copLightBlue;
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  }

  function drawHud(state) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(12, 12, 250, 108);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`$${state.money}`, 24, 20);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Missions ${state.missionsDone}/5`, 24, 52);
    // Health bar.
    ctx.fillStyle = '#3a1512';
    ctx.fillRect(24, 76, 150, 12);
    ctx.fillStyle = state.player.health > 30 ? '#58d68d' : PALETTE.danger;
    ctx.fillRect(24, 76, 150 * Math.max(0, state.player.health / 100), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`HP ${Math.ceil(state.player.health)}`, 182, 75);
    // Ammo.
    ctx.fillStyle = state.reloading ? PALETTE.objective : PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(state.reloading ? 'RELOADING…' : `AMMO ${state.ammo} / 12`, 24, 96);
    // Wanted stars, top centre.
    if (state.wanted > 0) {
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.danger;
      ctx.fillText('★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted), VIEW.width / 2, 16);
      ctx.textAlign = 'left';
    }
    // Mission line, bottom left.
    if (state.mission) {
      const m = state.mission;
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(12, VIEW.height - 64, 460, 52);
      ctx.fillStyle = PALETTE.objective;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`${m.index + 1}. ${m.name} — $${m.reward}`, 24, VIEW.height - 56);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '14px system-ui, sans-serif';
      let detail = m.hint;
      if (m.index === 2) detail = `Collected ${m.collected}/${m.needed}`;
      else if (m.index === 3) detail = `Survive: ${Math.ceil(m.timer)}s left`;
      else if (m.objective) {
        const d = Math.round(Math.hypot(m.objective.x - state.player.x, m.objective.y - state.player.y));
        detail = `${m.objective.label} — ${d}m`;
      }
      ctx.fillText(detail, 24, VIEW.height - 32);
    }
    // Context hint, bottom centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    if (state.player.inCar === null) {
      const near = state.cars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 78);
      if (near) ctx.fillText('E — enter car', VIEW.width / 2, VIEW.height - 28);
      else if (!state.mission && state.missionsDone < 5) ctx.fillText('M — start mission', VIEW.width / 2, VIEW.height - 28);
    } else {
      ctx.fillText('E — exit car · Space — handbrake', VIEW.width / 2, VIEW.height - 28);
    }
    ctx.textAlign = 'left';
  }

  function drawWorld(state, city) {
    const night = nightFactor(state.time);
    // Ground.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Beach and water, east edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, FIELD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(WATER_X, 0, FIELD.width - WATER_X, FIELD.height);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let y = ((state.time * 30) % 80); y < FIELD.height; y += 80) {
      ctx.fillRect(WATER_X + 12, y, 60, 3);
    }
    drawBuildings(city, night);
    drawRoads();
    // Skid marks.
    ctx.strokeStyle = 'rgba(10,10,12,0.55)';
    ctx.lineWidth = 4;
    for (const skid of state.skids) {
      ctx.globalAlpha = Math.min(1, skid.life / 5);
      ctx.beginPath();
      ctx.moveTo(skid.x1, skid.y1);
      ctx.lineTo(skid.x2, skid.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pickups.
    for (const pk of state.pickups) {
      const pulse = 1 + Math.sin(state.time * 5 + pk.x) * 0.15;
      if (pk.kind === 'cash') {
        ctx.fillStyle = PALETTE.cash;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 13 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d2b1a';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', pk.x, pk.y + 1);
      } else {
        ctx.fillStyle = PALETTE.health;
        ctx.fillRect(pk.x - 12, pk.y - 12, 24, 24);
        ctx.fillStyle = '#d23b2e';
        ctx.fillRect(pk.x - 3, pk.y - 9, 6, 18);
        ctx.fillRect(pk.x - 9, pk.y - 3, 18, 6);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Mission objective marker.
    if (state.mission && state.mission.objective) {
      const o = state.mission.objective;
      const pulse = 1 + Math.sin(state.time * 4) * 0.2;
      ctx.strokeStyle = PALETTE.objective;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(o.x, o.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.objective;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
    }
    // Cars.
    for (const car of state.cars) {
      const def = CAR_TYPES[car.type];
      const color = car.missionCar ? '#ff2e2e' : (car.parked ? def.parkedColor : def.color);
      drawCarShape(car.x, car.y, car.angle, car.type, color, state.player.inCar === car.id);
    }
    // Police.
    for (const cop of state.cops) drawCop(cop, state.time);
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.downTimer > 0) {
        ctx.fillStyle = '#8a6f4d';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = PALETTE.ped;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Thugs.
    for (const thug of state.thugs) {
      ctx.fillStyle = PALETTE.thug;
      ctx.beginPath();
      ctx.arc(thug.x, thug.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d1512';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(thug.x, thug.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3a1512';
      ctx.fillRect(thug.x - 14, thug.y - 24, 28, 4);
      ctx.fillStyle = '#ff6b61';
      ctx.fillRect(thug.x - 14, thug.y - 24, 28 * Math.max(0, thug.hp / 30), 4);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(thug.x, thug.y);
      ctx.lineTo(thug.x + Math.cos(thug.angle) * 22, thug.y + Math.sin(thug.angle) * 22);
      ctx.stroke();
    }
    // Bullets.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Player on foot.
    const p = state.player;
    if (p.inCar === null) {
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.playerOutline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#0b2a3a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Night tint.
    if (night > 0.01) {
      ctx.fillStyle = `rgba(8, 10, 38, ${night})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawTitle(state) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(8, 10, 16, 0.88)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('NEON BAY', VIEW.width / 2, 190);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story — built for make.fun', VIEW.width / 2, 235);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Jax Marlowe, a courier with no way out, is drawn into Mara Voss’s crew.', VIEW.width / 2, 285);
    ctx.fillText('Five jobs. One city. Don’t get busted.', VIEW.width / 2, 312);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('WASD move · Shift run · E enter / exit car · Space handbrake', VIEW.width / 2, 380);
    ctx.fillText('Mouse aim · Click shoot · F punch · R reload · M start mission · P pause', VIEW.width / 2, 408);
    ctx.fillStyle = PALETTE.objective;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`$${state.money}   ·   Missions ${state.missionsDone}/5 complete`, VIEW.width / 2, 470);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px system-ui, sans-serif';
    const blink = Math.floor(state.time * 2) % 2 === 0;
    if (blink) ctx.fillText('Press Enter to start', VIEW.width / 2, 540);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, VIEW.height / 2 - 10);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('P — resume', VIEW.width / 2, VIEW.height / 2 + 32);
    ctx.textAlign = 'left';
  }

  function drawBusted(state) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(20, 4, 6, 0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const flash = Math.floor(state.time * 3) % 2 === 0;
    ctx.strokeStyle = flash ? PALETTE.copLightRed : PALETTE.copLightBlue;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 76px system-ui, sans-serif';
    ctx.fillText('BUSTED', VIEW.width / 2, VIEW.height / 2 - 20);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The Neon Bay PD has you. Your money and missions are kept.', VIEW.width / 2, VIEW.height / 2 + 30);
    ctx.font = 'bold 22px system-ui, sans-serif';
    if (Math.floor(state.time * 2) % 2 === 0) ctx.fillText('Press Enter to get back out there', VIEW.width / 2, VIEW.height / 2 + 80);
    ctx.textAlign = 'left';
  }

  return {
    draw(state, city, screen) {
      const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
      const offsetX = (canvas.width - VIEW.width * scale) / 2;
      const offsetY = (canvas.height - VIEW.height * scale) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Camera: follow the player, clamped to the city, with shake.
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
      const camX = clamp(state.player.x - VIEW.width / 2 + shakeX, 0, FIELD.width - VIEW.width);
      const camY = clamp(state.player.y - VIEW.height / 2 + shakeY, 0, FIELD.height - VIEW.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX - camX * scale, offsetY - camY * scale);
      drawWorld(state, city);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawHud(state);
      drawMinimap(state);
      if (screen === SCREEN_TITLE) drawTitle(state);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_BUSTED) drawBusted(state);
    },
    /** Convert a screen (client) point to world coordinates, for the pistol's aim. */
    screenToWorld(clientX, clientY, state) {
      const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
      const offsetX = (canvas.width - VIEW.width * scale) / 2;
      const offsetY = (canvas.height - VIEW.height * scale) / 2;
      const rect = canvas.getBoundingClientRect();
      const viewX = ((clientX - rect.left) * (canvas.width / rect.width) - offsetX) / scale;
      const viewY = ((clientY - rect.top) * (canvas.height / rect.height) - offsetY) / scale;
      const camX = clamp(state.player.x - VIEW.width / 2, 0, FIELD.width - VIEW.width);
      const camY = clamp(state.player.y - VIEW.height / 2, 0, FIELD.height - VIEW.height);
      return { x: viewX + camX, y: viewY + camY };
    },
  };
}
