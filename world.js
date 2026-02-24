'use strict';

// ══════════════════════════════════════════════════════════════
//  STOCKAGE DU MONDE PAR CHUNKS
//  Coordonnées monde : x∈[-2500,2500], y∈[-100,255], z∈[-2500,2500]
//  Chunks : 16×Y_RANGE×16 blocs
// ══════════════════════════════════════════════════════════════

const generatedChunks = new Map(); // chunkKey → Uint8Array
const chunkMods       = new Map(); // chunkKey → Map<blockIdx, blockType>

// ── Helpers clés ─────────────────────────────────────────────
function getChunkKey(cx, cz)      { return `${cx},${cz}`; }
function worldToChunkCoord(w)     { return Math.floor(w / CHUNK_SIZE); }
function worldToLocal(w)          { return ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE; }
function blockIdx(lx, ly, lz)     { return lx + CHUNK_SIZE * (ly + Y_RANGE * lz); }

// ── Génération/cache chunk ────────────────────────────────────
function getOrGenChunk(cx, cz) {
  const key = getChunkKey(cx, cz);
  let chunk = generatedChunks.get(key);
  if (!chunk) {
    chunk = generateChunk(cx, cz);   // worldgen.js
    generatedChunks.set(key, chunk);
  }
  return chunk;
}

// ── Accesseurs monde ─────────────────────────────────────────
function getB(wx, wy, wz) {
  if (wy < Y_MIN || wy > Y_MAX) return B.AIR;
  const cx  = worldToChunkCoord(wx);
  const cz  = worldToChunkCoord(wz);
  const key = getChunkKey(cx, cz);
  const lx  = worldToLocal(wx);
  const lz  = worldToLocal(wz);
  const ly  = wy - Y_MIN;
  const bi  = blockIdx(lx, ly, lz);

  const mods = chunkMods.get(key);
  if (mods && mods.has(bi)) return mods.get(bi);

  const chunk = generatedChunks.get(key);
  if (!chunk) {
    // Génération lazy (uniquement pour la visibilité des faces)
    const c = generateChunk(cx, cz);
    generatedChunks.set(key, c);
    return c[bi];
  }
  return chunk[bi];
}

function setB(wx, wy, wz, type) {
  if (wy < Y_MIN || wy > Y_MAX) return;
  const cx  = worldToChunkCoord(wx);
  const cz  = worldToChunkCoord(wz);
  const key = getChunkKey(cx, cz);
  const lx  = worldToLocal(wx);
  const lz  = worldToLocal(wz);
  const ly  = wy - Y_MIN;
  const bi  = blockIdx(lx, ly, lz);

  if (!chunkMods.has(key)) chunkMods.set(key, new Map());
  chunkMods.get(key).set(bi, type);
}

// ── Helpers de classification ─────────────────────────────────
function isSolid(b)   { return b > 0 && b !== B.WATER && b !== B.LEAVES; }
function isOpaque(b)  { return b > 0 && b !== B.WATER && b !== B.LEAVES && b !== B.AIR; }

function showFace(b, nb) {
  if (nb === B.AIR)                    return true;
  if (nb === b)                        return false;
  if (b  === B.WATER)                  return nb === B.AIR;
  if (nb === B.WATER || nb === B.LEAVES) return true;
  return false;
}
