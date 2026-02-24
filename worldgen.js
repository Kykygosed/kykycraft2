'use strict';

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION PROCÉDURALE PAR CHUNK
// ══════════════════════════════════════════════════════════════

let _N, _N2, _N3, _Ntree;

/** Initialise les instances de bruit depuis la seed. */
function initWorldgen(seed) {
  _N     = new Noise(seed);
  _N2    = new Noise(seed ^ 0xCAFEBABE);
  _N3    = new Noise(seed ^ 0x12345678);
  _Ntree = new Noise(seed ^ 0x98765432);
}

// ══════════════════════════════════════════════════════════════
//  HAUTEUR DE TERRAIN (reproductible par seed)
// ══════════════════════════════════════════════════════════════
function getTerrainHeight(wx, wz) {
  const nx = wx / 500, nz = wz / 500;

  // Masque continental : fondu vers l'océan sur les 400 derniers blocs
  const fadeW = WORLD_RADIUS * 0.85;
  const ex = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wx)) / (WORLD_RADIUS - fadeW)));
  const ez = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wz)) / (WORLD_RADIUS - fadeW)));
  const mask = Math.pow(Math.min(ex, ez), 0.45);

  const base    = _N.fbm(nx * 3.5, nz * 3.5, 6, 1.95, 0.54);
  const ridge   = 1 - Math.abs(_N3.fbm(nx * 2.8 + 5, nz * 2.8 + 5, 4, 2.1, 0.52) * 2 - 1);
  const mtnMask = _N2.fbm(nx * 1.8 + 10, nz * 1.8 + 10, 3, 2.0, 0.5);
  const h       = (base * 0.6 + Math.pow(ridge, 1.4) * mtnMask * 0.4) * mask;

  return Math.floor(h * 32 + 2);
}

/** Version rapide (4 octaves) pour la génération de la minimap monde. */
function getTerrainHeightFast(wx, wz) {
  const nx = wx / 500, nz = wz / 500;
  const fadeW = WORLD_RADIUS * 0.85;
  const ex = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wx)) / (WORLD_RADIUS - fadeW)));
  const ez = Math.max(0, Math.min(1, (WORLD_RADIUS - Math.abs(wz)) / (WORLD_RADIUS - fadeW)));
  const mask = Math.pow(Math.min(ex, ez), 0.45);
  return Math.floor(_N.fbm(nx * 3.5, nz * 3.5, 4, 1.95, 0.54) * mask * 32 + 2);
}

// ══════════════════════════════════════════════════════════════
//  FARLANDS (bordure du monde)
// ══════════════════════════════════════════════════════════════
function isFarlands(wx, wz) {
  return Math.abs(wx) > WORLD_RADIUS - 150 || Math.abs(wz) > WORLD_RADIUS - 150;
}

/** Retourne le type de bloc farlands à la position (wx, wy, wz). */
function farlandsBlock(wx, wy, wz) {
  // Colonnes verticales chaotiques alternant crêtes et gouffres
  const f1 = Math.sin(wx * 0.18) * Math.cos(wz * 0.18);
  const f2 = Math.cos(wx * 0.07 + wz * 0.07);
  const f3 = Math.sin(wx * 0.5  - wz * 0.3) * 0.4;
  const col = (f1 + f2 + f3) * 0.5; // -1..1

  const dist   = Math.max(Math.abs(wx), Math.abs(wz)) - (WORLD_RADIUS - 150);
  const t      = Math.min(dist / 150, 1.0);
  const colH   = Math.floor((col * 0.5 + 0.5) * 120 * t + 5); // 0..125

  if (wy === 0)          return B.STONE;
  if (wy < 0)            return B.AIR;
  if (wy <= colH)        return wy < 4 ? B.STONE : (wy < colH - 2 ? B.STONE : (wy === colH ? B.GRASS : B.DIRT));
  if (wy <= SEA && t < 1) return B.WATER;
  return B.AIR;
}

// ══════════════════════════════════════════════════════════════
//  ARBRES  (positions déterministes)
// ══════════════════════════════════════════════════════════════
function isTreePos(wx, wz) {
  return _Ntree.h(wx * 7, wz * 13) < 0.008; // ~0.8% des colonnes
}

function treeHeight(wx, wz) {
  return 4 + Math.floor(_Ntree.h(wx, wz * 2) * 3);
}

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION D'UN CHUNK
// ══════════════════════════════════════════════════════════════
/**
 * Génère un chunk 16×Y_RANGE×16.
 * @param {number} cx, cz – coordonnées du chunk
 * @returns {Uint8Array}
 */
function generateChunk(cx, cz) {
  const data   = new Uint8Array(CHUNK_SIZE * Y_RANGE * CHUNK_SIZE);
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  // ── 1. Terrain colonne par colonne ──────────────────────────
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = worldX + lx;
      const wz = worldZ + lz;

      if (isFarlands(wx, wz)) {
        // Farlands : colonnes chaotiques
        for (let ly = 0; ly < Y_RANGE; ly++) {
          const wy = ly + Y_MIN;
          data[blockIdx(lx, ly, lz)] = farlandsBlock(wx, wy, wz);
        }
        continue;
      }

      const sy     = getTerrainHeight(wx, wz);
      const ocean  = sy < SEA;
      const beach  = sy === SEA || sy === SEA + 1;
      const hiMtn  = sy > 26;
      const mtn    = sy > 22;

      for (let ly = 0; ly < Y_RANGE; ly++) {
        const wy = ly + Y_MIN;
        let b = B.AIR;

        if      (wy < 0)       b = B.AIR;   // vide sous 0 (accessible mais vide)
        else if (wy === 0)     b = B.STONE;
        else if (wy > sy)      b = (wy <= SEA) ? B.WATER : B.AIR;
        else if (wy === sy) {
          if      (ocean)  b = B.GRAVEL;
          else if (beach)  b = B.SAND;
          else if (hiMtn)  b = B.SNOW;
          else if (mtn)    b = B.STONE;
          else             b = B.GRASS;
        } else if (wy >= sy - 4) {
          b = (ocean || beach) ? B.SAND : (mtn ? B.STONE : B.DIRT);
        } else {
          b = B.STONE;
        }
        data[blockIdx(lx, ly, lz)] = b;
      }
    }
  }

  // ── 2. Arbres (on cherche dans le voisinage du chunk) ───────
  const TREE_R = 2; // rayon feuillage
  const search = CHUNK_SIZE + TREE_R + 1;

  for (let oz = -search; oz < CHUNK_SIZE + search; oz++) {
    for (let ox = -search; ox < CHUNK_SIZE + search; ox++) {
      const tx = worldX + ox;
      const tz = worldZ + oz;
      if (!isTreePos(tx, tz)) continue;
      if (isFarlands(tx, tz)) continue;
      const sy = getTerrainHeight(tx, tz);
      if (sy <= SEA + 1 || sy > 21) continue;
      // vérifier que la surface est bien de l'herbe (pas d'eau/plage/montagne)
      const trH  = treeHeight(tx, tz);

      // Tronc
      for (let dy = 1; dy <= trH; dy++) {
        const bx = tx - worldX, bz = tz - worldZ;
        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE) {
          const wy = sy + dy;
          if (wy > Y_MAX) break;
          const ly = wy - Y_MIN;
          data[blockIdx(bx, ly, bz)] = B.WOOD;
        }
      }
      // Feuillage (ellipsoïde)
      for (let lx2 = -2; lx2 <= 2; lx2++) {
        for (let lz2 = -2; lz2 <= 2; lz2++) {
          for (let ly2 = -1; ly2 <= 2; ly2++) {
            if (Math.sqrt(lx2*lx2 + lz2*lz2 + (ly2*0.7)*(ly2*0.7)) >= 2.5) continue;
            const bx = tx + lx2 - worldX;
            const bz2= tz + lz2 - worldZ;
            if (bx < 0 || bx >= CHUNK_SIZE || bz2 < 0 || bz2 >= CHUNK_SIZE) continue;
            const wy = sy + trH + ly2;
            if (wy < Y_MIN || wy > Y_MAX) continue;
            const ly3 = wy - Y_MIN;
            // Ne pas écraser le tronc
            if (data[blockIdx(bx, ly3, bz2)] === B.WOOD) continue;
            data[blockIdx(bx, ly3, bz2)] = B.LEAVES;
          }
        }
      }
    }
  }

  return data;
}
