// The city of Neon Bay: a road grid, the buildings and parks between the roads, the beach and
// the water on the east edge, and the helpers that keep everything on the roads — a point on the
// nearest road, a random road point, collision with buildings and water, and a road-graph path
// (breadth-first search over the intersections) so police follow streets, never cut through
// buildings.
import { BEACH_X, FIELD, ROADS, WATER_X } from './config.js';
import { pick, range } from './random.js';

const BLOCK_MARGIN = 16;
const PARK_CHANCE = 0.16;

/** True when (x, y) lies on a road (centre line ± half width). */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2;
  for (const vx of ROADS.vertical) if (Math.abs(x - vx) <= half) return true;
  for (const hy of ROADS.horizontal) if (Math.abs(y - hy) <= half) return true;
  return false;
}

/** The nearest point on the road network to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of ROADS.vertical) {
    const px = vx;
    const py = Math.min(FIELD.height - 60, Math.max(60, y));
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) { bestD = d; best = { x: px, y: py }; }
  }
  for (const hy of ROADS.horizontal) {
    const px = Math.min(BEACH_X - 60, Math.max(60, x));
    const py = hy;
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) { bestD = d; best = { x: px, y: py }; }
  }
  return best;
}

/** A random point on a road centre line. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, ROADS.vertical), y: range(random, 120, FIELD.height - 120) };
  }
  return { x: range(random, 120, BEACH_X - 120), y: pick(random, ROADS.horizontal) };
}

/** A road point between minD and maxD from (x, y), or the closest one found. */
export function roadPointNear(x, y, minD, maxD, random) {
  let fallback = nearestRoadPoint(x, y);
  for (let tries = 0; tries < 14; tries += 1) {
    const p = randomRoadPoint(random);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= minD && d <= maxD) return p;
    if (Math.abs(d - minD) < Math.abs(Math.hypot(fallback.x - x, fallback.y - y) - minD)) fallback = p;
  }
  return fallback;
}

/** All intersections, as {x, y} points on the grid. */
export function intersections() {
  const points = [];
  for (const vx of ROADS.vertical) {
    for (const hy of ROADS.horizontal) points.push({ x: vx, y: hy });
  }
  return points;
}

/** The intersection nearest to (x, y). */
export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of ROADS.vertical) {
    for (const hy of ROADS.horizontal) {
      const d = Math.hypot(vx - x, hy - y);
      if (d < bestD) { bestD = d; best = { x: vx, y: hy }; }
    }
  }
  return best;
}

function nodeKey(x, y) {
  return `${x},${y}`;
}

/**
 * The road-graph path from (fromX, fromY) to (toX, toY): a list of intersection waypoints,
 * axis-aligned along the roads, found by breadth-first search. Empty when already there.
 */
export function roadPath(fromX, fromY, toX, toY) {
  const start = nearestIntersection(fromX, fromY);
  const goal = nearestIntersection(toX, toY);
  if (start.x === goal.x && start.y === goal.y) return [];
  const queue = [start];
  const cameFrom = new Map([[nodeKey(start.x, start.y), null]]);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node.x === goal.x && node.y === goal.y) break;
    const neighbours = [];
    const vi = ROADS.vertical.indexOf(node.x);
    const hi = ROADS.horizontal.indexOf(node.y);
    if (hi > 0) neighbours.push({ x: node.x, y: ROADS.horizontal[hi - 1] });
    if (hi < ROADS.horizontal.length - 1) neighbours.push({ x: node.x, y: ROADS.horizontal[hi + 1] });
    if (vi > 0) neighbours.push({ x: ROADS.vertical[vi - 1], y: node.y });
    if (vi < ROADS.vertical.length - 1) neighbours.push({ x: ROADS.vertical[vi + 1], y: node.y });
    for (const next of neighbours) {
      const key = nodeKey(next.x, next.y);
      if (!cameFrom.has(key)) {
        cameFrom.set(key, node);
        queue.push(next);
      }
    }
  }
  const path = [];
  let node = goal;
  let guard = 0;
  while (node !== null && guard < 64) {
    path.unshift({ x: node.x, y: node.y });
    node = cameFrom.get(nodeKey(node.x, node.y)) ?? null;
    guard += 1;
  }
  if (path.length > 0 && path[0].x === start.x && path[0].y === start.y) path.shift();
  return path;
}

/** Build the static city: buildings and parks in the blocks between roads. */
export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const half = ROADS.width / 2;
  for (let vi = 0; vi < ROADS.vertical.length; vi += 1) {
    const x0 = ROADS.vertical[vi] + half + BLOCK_MARGIN;
    const x1 = vi + 1 < ROADS.vertical.length ? ROADS.vertical[vi + 1] - half - BLOCK_MARGIN : BEACH_X - BLOCK_MARGIN;
    if (x1 - x0 < 90) continue;
    for (let hi = 0; hi < ROADS.horizontal.length; hi += 1) {
      const y0 = ROADS.horizontal[hi] + half + BLOCK_MARGIN;
      const y1 = hi + 1 < ROADS.horizontal.length ? ROADS.horizontal[hi + 1] - half - BLOCK_MARGIN : FIELD.height - BLOCK_MARGIN;
      if (y1 - y0 < 90) continue;
      if (random() < PARK_CHANCE) {
        const trees = [];
        const count = 3 + Math.floor(random() * 4);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: 12 + random() * 10 });
        }
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees });
        continue;
      }
      const split = random();
      if (split < 0.45) {
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, shade: random() });
      } else if (split < 0.8) {
        const midX = x0 + (x1 - x0) * (0.42 + random() * 0.16);
        buildings.push({ x: x0, y: y0, w: midX - x0 - 10, h: y1 - y0, shade: random() });
        buildings.push({ x: midX + 10, y: y0, w: x1 - midX - 10, h: y1 - y0, shade: random() });
      } else {
        const midX = x0 + (x1 - x0) * (0.42 + random() * 0.16);
        const midY = y0 + (y1 - y0) * (0.42 + random() * 0.16);
        buildings.push({ x: x0, y: y0, w: midX - x0 - 10, h: midY - y0 - 10, shade: random() });
        buildings.push({ x: midX + 10, y: y0, w: x1 - midX - 10, h: midY - y0 - 10, shade: random() });
        buildings.push({ x: x0, y: midY + 10, w: midX - x0 - 10, h: y1 - midY - 10, shade: random() });
        buildings.push({ x: midX + 10, y: midY + 10, w: x1 - midX - 10, h: y1 - midY - 10, shade: random() });
      }
    }
  }
  return { buildings, parks };
}

/** Push a circle (x, y, r) out of every building and out of the water; returns the fixed point. */
export function resolveCircle(city, x, y, r) {
  let px = Math.min(FIELD.width - r, Math.max(r, x));
  let py = Math.min(FIELD.height - r, Math.max(r, y));
  if (px > WATER_X - r) px = WATER_X - r;
  for (const b of city.buildings) {
    const nearestX = Math.min(b.x + b.w, Math.max(b.x, px));
    const nearestY = Math.min(b.y + b.h, Math.max(b.y, py));
    const dx = px - nearestX;
    const dy = py - nearestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      // Centre inside the building: push out along the shortest side.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = b.x - r;
      else if (m === right) px = b.x + b.w + r;
      else if (m === top) py = b.y - r;
      else py = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      px = nearestX + (dx / d) * r;
      py = nearestY + (dy / d) * r;
    }
  }
  return { x: px, y: py };
}

/** True when a circle at (x, y, r) overlaps a building or the water. */
export function hitsObstacle(city, x, y, r) {
  if (x > WATER_X - r) return true;
  for (const b of city.buildings) {
    const nearestX = Math.min(b.x + b.w, Math.max(b.x, x));
    const nearestY = Math.min(b.y + b.h, Math.max(b.y, y));
    if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < r * r) return true;
  }
  return false;
}
