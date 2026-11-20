// Neon Bay's map: a street grid, the blocks between the streets, parks, and the
// beach and water on the east edge. Everything the game places (mission
// markers, parked cars, health packs) goes on a road, never inside a building.
//
// Roads are axis-aligned rectangles. A point is on a road when it lies inside
// any of them. Buildings fill the blocks between roads, inset from the edges,
// so every building sits clear of the road it faces.

import { CITY, ROAD_WIDTH } from './config.js';
import { randomInt, randomPick } from './random.js';

/** Centres of the north-south avenues. */
export const AVENUES = [200, 700, 1200, 1700, 2200, 2700, 3100];
/** Centres of the east-west streets. */
export const STREETS = [200, 600, 1000, 1400, 1800, 2200];
/** The sand starts here; the water starts 100 units further east. */
export const BEACH_X = 3200;
export const WATER_X = 3300;

/**
 * Build the city once from a seeded random: road rectangles, buildings and
 * parks. The layout is fixed by the seed, so every session sees the same city.
 */
export function createCity(random) {
  const roads = [];
  for (const x of AVENUES) roads.push({ x: x - ROAD_WIDTH / 2, y: 0, w: ROAD_WIDTH, h: CITY.height, vertical: true });
  for (const y of STREETS) roads.push({ x: 0, y: y - ROAD_WIDTH / 2, w: CITY.width, h: ROAD_WIDTH, vertical: false });

  const buildings = [];
  const parks = [];
  // Blocks run between neighbouring road centrelines. The last column before
  // the beach is a narrow strip, so it stays open ground.
  const colEdges = [0, ...AVENUES, BEACH_X];
  const rowEdges = [0, ...STREETS, CITY.height];
  for (let c = 0; c < colEdges.length - 1; c += 1) {
    for (let r = 0; r < rowEdges.length - 1; r += 1) {
      const x0 = colEdges[c] + ROAD_WIDTH / 2 + 12;
      const x1 = colEdges[c + 1] - ROAD_WIDTH / 2 - 12;
      const y0 = rowEdges[r] + ROAD_WIDTH / 2 + 12;
      const y1 = rowEdges[r + 1] - ROAD_WIDTH / 2 - 12;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // A few blocks are parks instead of buildings.
      if (random() < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] });
        const park = parks[parks.length - 1];
        const treeCount = Math.floor((park.w * park.h) / 26000);
        for (let i = 0; i < treeCount; i += 1) {
          park.trees.push({ x: x0 + 20 + random() * (park.w - 40), y: y0 + 20 + random() * (park.h - 40) });
        }
        continue;
      }
      // One or two buildings per block, each inset from the block edges.
      const count = random() < 0.55 ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        let bx;
        let by;
        let bw;
        let bh;
        if (count === 1) {
          bw = (x1 - x0) * (0.55 + random() * 0.3);
          bh = (y1 - y0) * (0.55 + random() * 0.3);
          bx = x0 + (x1 - x0 - bw) / 2;
          by = y0 + (y1 - y0 - bh) / 2;
        } else if (i === 0) {
          bw = (x1 - x0) * 0.42;
          bh = (y1 - y0) * (0.6 + random() * 0.25);
          bx = x0 + 6;
          by = y0 + (y1 - y0 - bh) / 2;
        } else {
          bw = (x1 - x0) * 0.42;
          bh = (y1 - y0) * (0.6 + random() * 0.25);
          bx = x1 - bw - 6;
          by = y0 + (y1 - y0 - bh) / 2;
        }
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          color: randomPick(random, ['#7a6a8f', '#8f6a6a', '#6a8f7a', '#6a7a8f', '#8f8a6a', '#746a8f']),
          windows: randomInt(random, 2, 5),
        });
      }
    }
  }

  return { roads, buildings, parks };
}

/** Whether a point lies on any road. */
export function isRoad(city, x, y) {
  for (const road of city.roads) {
    if (x >= road.x && x <= road.x + road.w && y >= road.y && y <= road.y + road.h) return true;
  }
  return false;
}

/** Whether a point is in the water (east edge). */
export function isWater(x, y) {
  return x >= WATER_X && y >= 0 && y <= CITY.height;
}

/** Whether a point is on the sand (walkable, but no roads or buildings there). */
export function isSand(x, y) {
  return x >= BEACH_X && x < WATER_X;
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

/**
 * Push a circle out of every building, the water and the city edge. Returns
 * the corrected position. Roads never block movement; only solid things do.
 */
export function resolveCircle(city, x, y, r) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    if (!circleHitsRect(px, py, r, b)) continue;
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    let dx = px - cx;
    let dy = py - cy;
    if (dx === 0 && dy === 0) {
      // Centre inside the building: push out through the nearest side.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = b.x - r;
      else if (m === right) px = b.x + b.w + r;
      else if (m === top) py = b.y - r;
      else py = b.y + b.h + r;
      continue;
    }
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    px = cx + dx * r;
    py = cy + dy * r;
  }
  // The water is solid; the sand is not.
  if (px >= WATER_X - r) px = WATER_X - r;
  if (px < r) px = r;
  if (px > CITY.width - r) px = CITY.width - r;
  if (py < r) py = r;
  if (py > CITY.height - r) py = CITY.height - r;
  return { x: px, y: py };
}

/** A random point on a road centreline (avenue or street). */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const x = randomPick(random, AVENUES);
    return { x, y: 80 + random() * (CITY.height - 160) };
  }
  const y = randomPick(random, STREETS);
  return { x: 80 + random() * (BEACH_X - 160), y };
}

/** The nearest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) {
      bestD = d;
      best = { x: ax, y: Math.max(80, Math.min(CITY.height - 80, y)) };
    }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) {
      bestD = d;
      best = { x: Math.max(80, Math.min(BEACH_X - 80, x)), y: sy };
    }
  }
  return best;
}

/**
 * The headings (radians, 0 = east, -PI/2 = north) that keep a driver on a
 * road from (x, y): a heading counts when the point 46 units ahead is on a
 * road. Used by traffic and police so they never cut through buildings.
 */
export function roadHeadings(city, x, y) {
  const out = [];
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const d of dirs) {
    if (isRoad(city, x + Math.cos(d) * 46, y + Math.sin(d) * 46)) out.push(d);
  }
  return out;
}

/**
 * Pick a road heading from (x, y) that turns toward (tx, ty). At an
 * intersection this chooses the road leading closest to the target; on a
 * straight road it keeps the current heading. Falls back to the heading
 * toward the target when no road heading exists.
 */
export function chooseRoadHeading(city, x, y, heading, tx, ty) {
  const options = roadHeadings(city, x, y);
  if (options.length === 0) return Math.atan2(ty - y, tx - x);
  let best = options[0];
  let bestScore = -Infinity;
  for (const d of options) {
    // Prefer the road that points at the target, with a small bonus for
    // keeping the current heading so cars do not jitter at intersections.
    const dot = Math.cos(d) * (tx - x) + Math.sin(d) * (ty - y);
    const keep = Math.cos(d - heading);
    const score = dot + keep * 60;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** The smallest signed turn from heading `from` to heading `to`. */
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
