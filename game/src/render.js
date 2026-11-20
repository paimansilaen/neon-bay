// Drawing only: the world's state and the current screen in, pixels out.
// The camera follows the player; the HUD, minimap and screens are drawn in
// screen space. Flat shapes and canvas text, no images, no network.

import { CITY, FONT, MISSIONS, PALETTE, ROAD_WIDTH } from './config.js';
import { BEACH_X, WATER_X } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

/** The camera for a state: the world rectangle the canvas shows. */
export function cameraFor(state, vw, vh) {
  const w = vw;
  const h = vh;
  let x = state.player.x - w / 2;
  let y = state.player.y - h / 2;
  x = Math.max(0, Math.min(CITY.width - w, x));
  y = Math.max(0, Math.min(CITY.height - h, y));
  if (w >= CITY.width) x = (CITY.width - w) / 2;
  if (h >= CITY.height) y = (CITY.height - h) / 2;
  return { x, y, w, h };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.type === 'truck' ? 52 : 42;
  const wid = car.type === 'truck' ? 24 : 20;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 6);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, -len / 4, -wid / 2 + 3, len / 2, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = '#bfe3ff';
  ctx.fillRect(len / 4, -wid / 2 + 3, 4, wid - 6);
  if (car.driver === 'police') {
    ctx.fillStyle = '#f2f4f6';
    ctx.fillRect(-len / 2, -wid / 2, len / 3, wid);
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-6, -wid / 2 - 2, 12, 5);
    ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-6, wid / 2 - 3, 12, 5);
  }
  if (night) {
    ctx.fillStyle = 'rgba(255, 240, 170, 0.85)';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
    ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function drawWorld(state, city, cam, night, dayFraction) {
    // Ground.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkDark;
      for (const tree of park.trees) {
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Beach and water on the east edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, CITY.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(WATER_X, 0, CITY.width - WATER_X, CITY.height);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = 40; y < CITY.height; y += 130) {
      ctx.fillRect(WATER_X + 30 + ((y * 7) % 60), y, 90, 5);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const road of city.roads) ctx.fillRect(road.x, road.y, road.w, road.h);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const road of city.roads) {
      if (road.vertical) {
        for (let y = 20; y < CITY.height; y += 80) ctx.fillRect(road.x + road.w / 2 - 2, y, 4, 36);
      } else {
        for (let x = 20; x < BEACH_X; x += 80) ctx.fillRect(x, road.y + road.h / 2 - 2, 36, 4);
      }
    }
    // Sidewalk edges.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (const road of city.roads) ctx.strokeRect(road.x + 1, road.y + 1, road.w - 2, road.h - 2);
    // Buildings.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      const cols = Math.max(2, Math.floor(b.w / 46));
      const rows = Math.max(2, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), 12, 10);
        }
      }
    }
    // Skid marks.
    ctx.strokeStyle = 'rgba(10, 10, 12, 0.55)';
    ctx.lineWidth = 4;
    for (const skid of state.skids) {
      ctx.beginPath();
      ctx.moveTo(skid.x, skid.y);
      ctx.lineTo(skid.x + Math.cos(skid.angle) * 26, skid.y + Math.sin(skid.angle) * 26);
      ctx.stroke();
    }
    // Pickups.
    for (const pack of state.pickups) {
      if (pack.respawn > 0) continue;
      const pulse = 1 + Math.sin(state.time * 5) * 0.12;
      ctx.save();
      ctx.translate(pack.x, pack.y);
      ctx.scale(pulse, pulse);
      if (pack.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = PALETTE.health;
        ctx.fillRect(-3, -9, 6, 18);
        ctx.fillRect(-9, -3, 18, 6);
      } else {
        ctx.fillStyle = PALETTE.cash;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0b3d20';
        ctx.font = 'bold 15px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
    // Mission marker.
    const mission = state.mission;
    if (mission && mission.target) {
      const t = mission.target;
      const bounce = Math.sin(state.time * 4) * 6;
      ctx.save();
      ctx.translate(t.x, t.y + bounce - 18);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11, -11, 22, 22);
      ctx.restore();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cars.
    for (const car of state.cars) drawCar(ctx, car, night);
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Thugs.
    for (const thug of state.thugs) {
      ctx.fillStyle = '#c22730';
      ctx.beginPath();
      ctx.arc(thug.x, thug.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d1016';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(thug.x, thug.y);
      ctx.lineTo(thug.x + Math.cos(thug.angle) * 22, thug.y + Math.sin(thug.angle) * 22);
      ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      ctx.fillRect(thug.x - 11, thug.y - 20, 22 * (thug.health / 3), 3);
    }
    // The player.
    const p = state.player;
    if (p.inCar === null) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.playerDark;
      ctx.fillRect(6, -3, 16, 6);
      ctx.fillStyle = '#20242b';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Bullets.
    ctx.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.maxLife);
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    ctx.globalAlpha = 1;
    // Day and night tint over the world.
    const daylight = 0.5 + 0.5 * Math.cos((dayFraction - 0.25) * Math.PI * 2);
    if (daylight < 0.85) {
      ctx.fillStyle = `rgba(8, 14, 38, ${(0.85 - daylight) * 0.45})`;
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    }
    if (dayFraction > 0.42 && dayFraction < 0.58) {
      ctx.fillStyle = 'rgba(255, 120, 40, 0.07)';
      ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
    }
    return daylight;
  }

  function drawMinimap(state, city, vw, vh) {
    const mw = 230;
    const mh = 176;
    const mx = vw - mw - 14;
    const my = 14;
    const sx = mw / CITY.width;
    const sy = mh / CITY.height;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, mx, my, mw, mh, 4);
    ctx.clip();
    ctx.fillStyle = '#2a2e35';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1d6f9e';
    ctx.fillRect(mx + WATER_X * sx, my, (CITY.width - WATER_X) * sx, mh);
    ctx.strokeStyle = '#565c66';
    ctx.lineWidth = 2;
    for (const road of city.roads) {
      ctx.beginPath();
      if (road.vertical) {
        ctx.moveTo(mx + (road.x + road.w / 2) * sx, my);
        ctx.lineTo(mx + (road.x + road.w / 2) * sx, my + mh);
      } else {
        ctx.moveTo(mx, my + (road.y + road.h / 2) * sy);
        ctx.lineTo(mx + mw, my + (road.y + road.h / 2) * sy);
      }
      ctx.stroke();
    }
    if (state.mission && state.mission.target) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(mx + state.mission.target.x * sx - 4, my + state.mission.target.y * sy - 4, 8, 8);
    }
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('NEON BAY', mx, my + mh + 16);
  }

  function drawHud(state, vw) {
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 14, 14, 250, 96, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('$' + state.money.toLocaleString('en-US'), 28, 46);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Missions ${state.missionsDone}/5`, 28, 70);
    // Health bar.
    ctx.fillStyle = '#20242b';
    roundRect(ctx, 28, 80, 150, 12, 6);
    ctx.fill();
    ctx.fillStyle = state.health > 35 ? '#37d67a' : '#e5484d';
    roundRect(ctx, 28, 80, 150 * (state.health / 100), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`HP ${Math.ceil(state.health)}`, 186, 92);
    // Ammo and wanted stars, top centre.
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillStyle = state.player.inCar === null ? PALETTE.text : PALETTE.gold;
    const ammo = state.player.inCar === null ? `Ammo ${state.ammo}  [R] reload` : `${state.player.inCar.type.toUpperCase()}  [E] exit`;
    ctx.fillText(ammo, vw / 2, 40);
    ctx.font = '26px ' + FONT;
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.stars ? '★' : '☆';
    ctx.fillStyle = state.stars > 0 ? '#ffd166' : 'rgba(255, 255, 255, 0.35)';
    ctx.fillText(stars, vw / 2, 72);
    // Mission line.
    if (state.mission) {
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = PALETTE.gold;
      let line = `${state.mission.name}`;
      if (state.mission.index === 2) line += `  ${state.mission.collected}/${state.mission.total} cash`;
      if (state.mission.index === 3) line += `  ${Math.ceil(state.mission.timer)}s left`;
      ctx.fillText(line, vw / 2, 96);
    } else if (state.missionsDone < MISSIONS.length) {
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Press M to start the next mission', vw / 2, 96);
    } else {
      ctx.font = '15px ' + FONT;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('All missions complete. Neon Bay is yours.', vw / 2, 96);
    }
    // Toast message.
    if (state.messageTimer > 0 && state.message) {
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(state.message, vw / 2, 128);
    }
    ctx.restore();
  }

  function drawOffscreenArrow(state, cam) {
    const mission = state.mission;
    if (!mission || !mission.target) return;
    const t = mission.target;
    if (t.x >= cam.x && t.x <= cam.x + cam.w && t.y >= cam.y && t.y <= cam.y + cam.h) return;
    const cx = cam.x + cam.w / 2;
    const cy = cam.y + cam.h / 2;
    const angle = Math.atan2(t.y - cy, t.x - cx);
    const ax = cx + Math.cos(angle) * (Math.min(cam.w, cam.h) / 2 - 70);
    const ay = cy + Math.sin(angle) * (Math.min(cam.w, cam.h) / 2 - 70);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPanel(lines, vw, vh) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 14, 0.78)';
    ctx.fillRect(0, 0, vw, vh);
    const w = 640;
    const x = (vw - w) / 2;
    const y = Math.max(60, vh / 2 - 220);
    ctx.fillStyle = 'rgba(20, 24, 32, 0.95)';
    roundRect(ctx, x, y, w, 400, 14);
    ctx.fill();
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, 400, 14);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, i) => {
      ctx.fillStyle = line.color;
      ctx.font = line.font;
      ctx.fillText(line.text, vw / 2, y + line.y);
    });
    ctx.restore();
  }

  return {
    cameraFor,
    draw(state, city, screen, saved) {
      const { w: vw, h: vh } = resize();
      const cam = cameraFor(state, vw, vh);
      const dayFraction = (state.time % 240) / 240;
      const night = 0.5 + 0.5 * Math.cos((dayFraction - 0.25) * Math.PI * 2) < 0.45;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, vw, vh);
      ctx.clip();
      ctx.translate(-cam.x, -cam.y);
      drawWorld(state, city, cam, night, dayFraction);
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_BUSTED) {
        drawOffscreenArrow(state, cam);
        drawHud(state, vw);
        drawMinimap(state, city, vw, vh);
      }
      if (screen === SCREEN_TITLE) {
        drawPanel(
          [
            { text: 'NEON BAY', font: 'bold 64px ' + FONT, color: '#f2c94c', y: 92 },
            { text: 'An open-world crime story', font: '20px ' + FONT, color: PALETTE.text, y: 132 },
            { text: 'Jax Marlowe came to Neon Bay to deliver one package.', font: '16px ' + FONT, color: PALETTE.muted, y: 180 },
            { text: 'Mara Voss has other plans. Five jobs. One city. No way out but through.', font: '16px ' + FONT, color: PALETTE.muted, y: 206 },
            { text: 'WASD move  •  Shift run  •  E enter / exit car  •  Space handbrake', font: '15px ' + FONT, color: PALETTE.text, y: 258 },
            { text: 'Mouse aim  •  Click shoot  •  F punch  •  R reload  •  M mission  •  P pause', font: '15px ' + FONT, color: PALETTE.text, y: 284 },
            { text: saved ? `Welcome back — $${saved.money.toLocaleString('en-US')} banked, ${saved.missionsDone}/5 missions done.` : 'A fresh start in the city. No money, no crew, no heat.', font: '15px ' + FONT, color: PALETTE.gold, y: 330 },
            { text: 'Press Enter or click to start', font: 'bold 18px ' + FONT, color: '#ffffff', y: 372 },
          ],
          vw,
          vh,
        );
      } else if (screen === SCREEN_PAUSED) {
        drawPanel(
          [
            { text: 'PAUSED', font: 'bold 52px ' + FONT, color: PALETTE.text, y: 130 },
            { text: 'The city waits for no one. Except now.', font: '17px ' + FONT, color: PALETTE.muted, y: 180 },
            { text: 'Press P or Enter to keep playing', font: '17px ' + FONT, color: PALETTE.text, y: 230 },
          ],
          vw,
          vh,
        );
      } else if (screen === SCREEN_BUSTED) {
        drawPanel(
          [
            { text: 'BUSTED!', font: 'bold 60px ' + FONT, color: '#e5484d', y: 110 },
            { text: 'The Neon Bay PD caught you.', font: '19px ' + FONT, color: PALETTE.text, y: 160 },
            { text: `You keep your $${state.money.toLocaleString('en-US')} and your ${state.missionsDone}/5 missions.`, font: '16px ' + FONT, color: PALETTE.muted, y: 210 },
            { text: 'Press Enter or click to get back on the streets', font: 'bold 17px ' + FONT, color: '#ffffff', y: 260 },
          ],
          vw,
          vh,
        );
      }
      return cam;
    },
  };
}
