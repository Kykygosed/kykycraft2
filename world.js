'use strict';

// ══════════════════════════════════════════════════════════════
//  DONNÉES DU MONDE
// ══════════════════════════════════════════════════════════════

/** Tableau principal des voxels (index plat 3D) */
const world = new Uint8Array(WW * WH * WD);

/** Convertit des coordonnées 3D en index dans le tableau */
function idx(x, y, z) {
  return x + WW * (y + WH * z);
}

/**
 * Lit le type de bloc aux coordonnées données.
 * Retourne STONE en dessous du monde, AIR en dehors.
 */
function getB(x, y, z) {
  if (x < 0 || x >= WW || y < 0 || y >= WH || z < 0 || z >= WD) {
    return y < 0 ? B.STONE : B.AIR;
  }
  return world[idx(x, y, z)];
}

/** Écrit un type de bloc aux coordonnées données. */
function setB(x, y, z, type) {
  if (x < 0 || x >= WW || y < 0 || y >= WH || z < 0 || z >= WD) return;
  world[idx(x, y, z)] = type;
}

// ══════════════════════════════════════════════════════════════
//  HELPERS DE CLASSIFICATION
// ══════════════════════════════════════════════════════════════

/** Vrai si le bloc est solide (collision physique) */
function isSolid(b) {
  return b > 0 && b !== B.WATER && b !== B.LEAVES;
}

/** Vrai si le bloc est complètement opaque */
function isOpaque(b) {
  return b > 0 && b !== B.WATER && b !== B.LEAVES && b !== B.AIR;
}

/**
 * Détermine si la face entre b et son voisin nb doit être dessinée.
 * Règles :
 *   – Voisin AIR            → toujours visible
 *   – Même type             → cachée (ex: eau contre eau)
 *   – Bloc = eau            → visible seulement contre l'air
 *   – Voisin eau ou feuille → visible (transparence partielle)
 *   – Sinon (solide)        → cachée
 */
function showFace(b, nb) {
  if (nb === B.AIR)    return true;
  if (nb === b)        return false;          // même bloc (ex: eau/eau)
  if (b  === B.WATER)  return nb === B.AIR;   // l'eau ne montre que sa surface
  if (nb === B.WATER || nb === B.LEAVES) return true;
  return false; // voisin solide opaque
}
