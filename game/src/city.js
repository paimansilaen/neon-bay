// The city of Neon Bay: a road grid, blocks with buildings, a park, and a beach.
// All geometry is derived from the seed, so the same seed builds the same city.
import { WORLD } from './config.js';

const ROOF_COLORS = ['#5a6b7a', '#6b5a7a', '#7a6b5a', '#4f6b5a', '#715a4f', '#5f6b8a'];
const WALL_COLORS = ['#3d4a58', '#4a3d58', '#584a3d', '#3d584a', '#54403a', '#414e66'];

export function createCity(random) {
  const vRoads = [];
  for (let x = 170; x <= 2890; x += WORLD.block) vRoads.push(x);
  const hRoads = [];
  for (let y = 130; y <= 2510; y += WORLD.block) hRoads.push(y);

  const buildings = [];
  const trees = [];
  const parks = [];
  const lots = []; // parking lots: {x, y, w, h}

  // One block in each row/col band becomes a park or a lot; the rest get buildings.
  for (let i = 0; i < vRoads.length - 1; i += 1) {
    for (let j = 0; j < hRoads.length - 1; j += 1) {
      const bx = vRoads[i] + WORLD.roadWidth / 2 + 14;
      const by = hRoads[j] + WORLD.roadWidth / 2 + 14;
      const bw = WORLD.block - WORLD.roadWidth - 28;
      const bh = WORLD.block - WORLD.roadWidth - 28;
      const roll = random.next();
      if (roll < 0.12) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        const n = 6 + random.int(0, 6);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: bx + 20 + random.next() * (bw - 40), y: by + 20 + random.next() * (bh - 40), r: 12 + random.next() * 10 });
        }
        continue;
      }
      if (roll < 0.2) {
        lots.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      // 1-3 buildings per block.
      const count = random.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = 60 + random.next() * Math.min(120, bw - 70);
        const h = 60 + random.next() * Math.min(120, bh - 70);
        const x = bx + random.next() * Math.max(1, bw - w);
        const y = by + random.next() * Math.max(1, bh - h);
        const candidate = { x, y, w, h, height: 10 + random.next() * 26, roof: ROOF_COLORS[random.int(0, ROOF_COLORS.length - 1)], wall: WALL_COLORS[random.int(0, WALL_COLORS.length - 1)] };
        let clash = false;
        for (const other of buildings) {
          if (candidate.x < other.x + other.w + 8 && candidate.x + candidate.w + 8 > other.x && candidate.y < other.y + other.h + 8 && candidate.y + candidate.h + 8 > other.y) { clash = true; break; }
        }
        if (!clash) buildings.push(candidate);
      }
    }
  }

  // Street lamps along roads.
  const lamps = [];
  for (const x of vRoads) for (const y of hRoads) lamps.push({ x: x + WORLD.roadWidth / 2 - 6, y: y - WORLD.roadWidth / 2 + 6 });

  function isRoad(x, y) {
    if (x < 0 || y < 0 || x > WORLD.width || y > WORLD.height) return false;
    for (const rx of vRoads) if (Math.abs(x - rx) <= WORLD.roadWidth / 2) return true;
    for (const ry of hRoads) if (Math.abs(y - ry) <= WORLD.roadWidth / 2) return true;
    return false;
  }

  function isWater(x, y) { return x >= WORLD.waterX; }
  function isSand(x, y) { return x >= WORLD.beachX && x < WORLD.waterX; }

  // Push a circle out of every building it overlaps; returns true if it hit one.
  function collideCircle(p, r) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.y = cy + (dy / d) * r;
        } else {
          p.y = b.y - r;
        }
      }
    }
    return hit;
  }

  function randomRoadPoint() {
    if (random.chance(0.5)) {
      const x = vRoads[random.int(0, vRoads.length - 1)];
      return { x, y: 60 + random.next() * (WORLD.height - 120) };
    }
    const y = hRoads[random.int(0, hRoads.length - 1)];
    return { x: 60 + random.next() * (WORLD.width - 260), y };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    const off = WORLD.roadWidth / 2 + 14;
    if (random.chance(0.5)) p.x = Math.max(20, Math.min(WORLD.beachX - 20, p.x + (random.chance(0.5) ? off : -off)));
    else p.y = Math.max(20, Math.min(WORLD.height - 20, p.y + (random.chance(0.5) ? off : -off)));
    return p;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of vRoads) for (const ry of hRoads) {
      const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
      if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
    }
    return best;
  }

  return {
    vRoads, hRoads, buildings, trees, parks, lots, lamps,
    isRoad, isWater, isSand, collideCircle, randomRoadPoint, randomSidewalkPoint, nearestRoadPoint,
  };
}
