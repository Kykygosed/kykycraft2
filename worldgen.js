'use strict';

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION PROCÉDURALE PAR CHUNK  —  avec grottes & failles
// ══════════════════════════════════════════════════════════════

let _N, _N2, _N3, _Ntree, _Ncave, _Ncave2, _Nravine;

function initWorldgen(seed) {
  _N       = new Noise(seed);
  _N2      = new Noise(seed ^ 0xCAFEBABE);
  _N3      = new Noise(seed ^ 0x12345678);
  _Ntree   = new Noise(seed ^ 0x98765432);
  _Ncave   = new Noise(seed ^ 0xABCDEF01);
  _Ncave2  = new Noise(seed ^ 0x12ABCDEF);
  _Nravine = new Noise(seed ^ 0xDEAD5678);
}

// ══════════════════════════════════════════════════════════════
//  HAUTEUR DE TERRAIN
// ══════════════════════════════════════════════════════════════
function getTerrainHeight(wx, wz) {
  const nx = wx / 500, nz = wz / 500;
  const fadeW = WORLD_RADIUS * 0.85;
  const ex = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wx)) / (WORLD_RADIUS - fadeW)));
  const ez = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wz)) / (WORLD_RADIUS - fadeW)));
  const mask = Math.pow(Math.min(ex, ez), 0.45);
  const base    = _N.fbm(nx * 3.5, nz * 3.5, 6, 1.95, 0.54);
  const ridge   = 1 - Math.abs(_N3.fbm(nx * 2.8+5, nz * 2.8+5, 4, 2.1, 0.52) * 2 - 1);
  const mtnMask = _N2.fbm(nx * 1.8+10, nz * 1.8+10, 3, 2.0, 0.5);
  return Math.floor((base * 0.6 + Math.pow(ridge, 1.4) * mtnMask * 0.4) * mask * 32 + 2);
}

function getTerrainHeightFast(wx, wz) {
  const nx = wx / 500, nz = wz / 500;
  const fadeW = WORLD_RADIUS * 0.85;
  const ex = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wx)) / (WORLD_RADIUS - fadeW)));
  const ez = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wz)) / (WORLD_RADIUS - fadeW)));
  const mask = Math.pow(Math.min(ex, ez), 0.45);
  return Math.floor(_N.fbm(nx * 3.5, nz * 3.5, 4, 1.95, 0.54) * mask * 32 + 2);
}

// ══════════════════════════════════════════════════════════════
//  GROTTES  (tunnel worm via produit de ridge noise)
// ══════════════════════════════════════════════════════════════
/**
 * Retourne vrai si la position (wx, wy, wz) est une grotte.
 * La technique : produit de deux noises en ridge → tunnels ellipsoïdaux.
 */
function isCave(wx, wy, wz) {
  if (wy <= 0 || wy > 32) return false;  // pas de grottes au-dessus du sol ou en dessous du vide

  const sc = 0.055;
  // Fake 3D : deux plans décalés par Y
  const n1 = _Ncave.get(wx * sc,          wz * sc + wy * 0.11);
  const n2 = _Ncave2.get(wx * sc + wy * 0.08, wz * sc);

  // Ridge : pics aux croisements de zéro
  const r1 = 1 - Math.abs(n1 * 2 - 1);
  const r2 = 1 - Math.abs(n2 * 2 - 1);
  const val = r1 * r2;

  // Grottes plus rares près de la surface
  const surfaceFade = Math.min(1.0, (32 - wy) / 10.0);
  return val > 0.17 * (2.0 - surfaceFade);
}

// ══════════════════════════════════════════════════════════════
//  FAILLES / RAVINES
// ══════════════════════════════════════════════════════════════
/**
 * Retourne vrai si la colonne (wx, wz) à la hauteur wy est une faille.
 * Les failles sont des coupures verticales étroites et profondes.
 */
function isRavine(wx, wy, wz) {
  if (wy < 2 || wy > 22) return false;

  const rn = _Nravine.get(wx * 0.012, wz * 0.012);
  // Ridge très serré (seuil élevé → failles rares et étroites)
  const ridge = 1 - Math.abs(rn * 2 - 1);
  if (ridge < 0.88) return false;

  // Profondeur variable de la faille selon Y
  const depth = getTerrainHeight(wx, wz);
  return wy < depth - 2;
}

// ══════════════════════════════════════════════════════════════
//  FARLANDS
// ══════════════════════════════════════════════════════════════
function isFarlands(wx, wz) {
  return Math.abs(wx) > WORLD_RADIUS - 150 || Math.abs(wz) > WORLD_RADIUS - 150;
}

function farlandsBlock(wx, wy, wz) {
  const f1  = Math.sin(wx * 0.18) * Math.cos(wz * 0.18);
  const f2  = Math.cos(wx * 0.07 + wz * 0.07);
  const f3  = Math.sin(wx * 0.5  - wz * 0.3) * 0.4;
  const col = (f1 + f2 + f3) * 0.5;
  const dist = Math.max(Math.abs(wx), Math.abs(wz)) - (WORLD_RADIUS - 150);
  const t    = Math.min(dist / 150, 1.0);
  const colH = Math.floor((col * 0.5 + 0.5) * 120 * t + 5);
  if (wy === 0)   return B.STONE;
  if (wy < 0)     return B.AIR;
  if (wy <= colH) return wy < 4 ? B.STONE : (wy === colH ? B.GRASS : (wy < colH - 2 ? B.STONE : B.DIRT));
  if (wy <= SEA && t < 1) return B.WATER;
  return B.AIR;
}

// ══════════════════════════════════════════════════════════════
//  ARBRES
// ══════════════════════════════════════════════════════════════
function isTreePos(wx, wz) {
  return _Ntree.h(wx * 7, wz * 13) < 0.008;
}
function treeHeight(wx, wz) {
  return 4 + Math.floor(_Ntree.h(wx, wz * 2) * 3);
}

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION D'UN CHUNK
// ══════════════════════════════════════════════════════════════
function generateChunk(cx, cz) {
  const data   = new Uint8Array(CHUNK_SIZE * Y_RANGE * CHUNK_SIZE);
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  // ── Passe 1 : terrain de base ───────────────────────────────
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = worldX + lx, wz = worldZ + lz;

      if (isFarlands(wx, wz)) {
        for (let ly = 0; ly < Y_RANGE; ly++)
          data[blockIdx(lx, ly, lz)] = farlandsBlock(wx, ly + Y_MIN, wz);
        continue;
      }

      const sy     = getTerrainHeight(wx, wz);
      const ocean  = sy < SEA, beach = sy === SEA || sy === SEA+1;
      const hiMtn  = sy > 26,  mtn   = sy > 22;

      for (let ly = 0; ly < Y_RANGE; ly++) {
        const wy = ly + Y_MIN;
        let b = B.AIR;

        if      (wy < 0)    b = B.AIR;   // vide sous Y=0
        else if (wy === 0)  b = B.STONE;
        else if (wy > sy)   b = wy <= SEA ? B.WATER : B.AIR;
        else if (wy === sy) {
          if      (ocean)  b = B.GRAVEL;
          else if (beach)  b = B.SAND;
          else if (hiMtn)  b = B.SNOW;
          else if (mtn)    b = B.STONE;
          else             b = B.GRASS;
        } else if (wy >= sy - 4) {
          b = (ocean||beach) ? B.SAND : (mtn ? B.STONE : B.DIRT);
        } else              b = B.STONE;

        data[blockIdx(lx, ly, lz)] = b;
      }
    }
  }

  // ── Passe 2 : grottes & failles ─────────────────────────────
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = worldX + lx, wz = worldZ + lz;
      if (isFarlands(wx, wz)) continue;

      for (let ly = 0; ly < Y_RANGE; ly++) {
        const wy = ly + Y_MIN;
        const bi = blockIdx(lx, ly, lz);
        if (data[bi] === B.AIR || data[bi] === B.WATER) continue;
        if (wy === 0) continue; // ne jamais toucher la roche de base

        if (isCave(wx, wy, wz) || isRavine(wx, wy, wz)) {
          data[bi] = B.AIR;
        }
      }
    }
  }

  // ── Passe 3 : arbres ─────────────────────────────────────────
  const TREE_SEARCH = CHUNK_SIZE + 3;
  for (let oz = -TREE_SEARCH; oz < CHUNK_SIZE + TREE_SEARCH; oz++) {
    for (let ox = -TREE_SEARCH; ox < CHUNK_SIZE + TREE_SEARCH; ox++) {
      const tx = worldX + ox, tz = worldZ + oz;
      if (!isTreePos(tx, tz) || isFarlands(tx, tz)) continue;
      const sy = getTerrainHeight(tx, tz);
      if (sy <= SEA + 1 || sy > 21) continue;
      const trH = treeHeight(tx, tz);

      // Tronc
      for (let dy = 1; dy <= trH; dy++) {
        const bx = tx - worldX, bz2 = tz - worldZ;
        if (bx >= 0 && bx < CHUNK_SIZE && bz2 >= 0 && bz2 < CHUNK_SIZE) {
          const wy = sy + dy;
          if (wy > Y_MAX) break;
          const ly = wy - Y_MIN;
          if (data[blockIdx(bx,ly,bz2)] !== B.AIR) continue; // grotte peut avoir enlevé
          data[blockIdx(bx, ly, bz2)] = B.WOOD;
        }
      }
      // Feuillage
      for (let lx2=-2; lx2<=2; lx2++) for (let lz2=-2; lz2<=2; lz2++) for (let ly2=-1; ly2<=2; ly2++) {
        if (Math.sqrt(lx2*lx2+lz2*lz2+(ly2*0.7)*(ly2*0.7)) >= 2.5) continue;
        const bx = tx+lx2-worldX, bz3 = tz+lz2-worldZ;
        if (bx<0||bx>=CHUNK_SIZE||bz3<0||bz3>=CHUNK_SIZE) continue;
        const wy = sy+trH+ly2;
        if (wy<Y_MIN||wy>Y_MAX) continue;
        const li = blockIdx(bx, wy-Y_MIN, bz3);
        if (data[li] === B.WOOD) continue;
        data[li] = B.LEAVES;
      }
    }
  }

  return data;
}
