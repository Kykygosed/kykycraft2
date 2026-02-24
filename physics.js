'use strict';

// ══════════════════════════════════════════════════════════════
//  PHYSIQUE DU JOUEUR
// ══════════════════════════════════════════════════════════════

/** Vitesse verticale courante (affectée par la gravité et le saut) */
let velY = 0;

/** Vrai si le joueur repose sur un bloc solide */
let onGround = false;

/** Orientation de la caméra (modifiée par input.js) */
let playerYaw   = 0;
let playerPitch = 0;

// ══════════════════════════════════════════════════════════════
//  Détection de collision AABB
// ══════════════════════════════════════════════════════════════
/**
 * Teste si le joueur (boîte englobante) entrerait dans un bloc solide
 * pour la position (nx, ny, nz).
 *
 * La capsule joueur est approximée par une boîte :
 *   largeur  : ±0.30 en X et Z
 *   hauteur  : −1.78 (pieds) à +0.18 (tête) par rapport à l'œil (ny)
 *
 * @param {boolean} checkY  vrai pour tester l'axe vertical
 */
function collide(nx, ny, nz, checkY) {
  const HW   = 0.30; // demi-largeur horizontale
  const minY = checkY ? Math.floor(ny - 1.78) : Math.floor(ny - 1.75);
  const maxY = checkY ? Math.floor(ny + 0.18) : Math.floor(ny + 0.12);

  for (let bx = Math.floor(nx - HW); bx <= Math.floor(nx + HW); bx++) {
    for (let bz = Math.floor(nz - HW); bz <= Math.floor(nz + HW); bz++) {
      for (let by = minY; by <= maxY; by++) {
        if (isSolid(getB(bx, by, bz))) return true;
      }
    }
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
//  physicsStep()  –  appelée chaque frame
// ══════════════════════════════════════════════════════════════
function physicsStep() {
  velY += GRAV;

  const cp = camera.position;

  // Vecteurs directionnels issus de la caméra (plan horizontal uniquement)
  const fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
  const rtX  =  Math.cos(playerYaw), rtZ  = -Math.sin(playerYaw);

  // ── Calcul du déplacement horizontal ──────────────────────
  // joyY > 0  →  doigt vers le bas  →  reculer  → on soustrait
  let mx = ( joyX * rtX  - joyY * fwdX) * SPDY;
  let mz = ( joyX * rtZ  - joyY * fwdZ) * SPDY;

  // Clavier (WASD + ZQSD + flèches)
  if (keys['KeyW'] || keys['ArrowUp'])    { mx += fwdX * SPDY; mz += fwdZ * SPDY; }
  if (keys['KeyS'] || keys['ArrowDown'])  { mx -= fwdX * SPDY; mz -= fwdZ * SPDY; }
  if (keys['KeyA'] || keys['ArrowLeft'])  { mx -= rtX  * SPDY; mz -= rtZ  * SPDY; }
  if (keys['KeyD'] || keys['ArrowRight']) { mx += rtX  * SPDY; mz += rtZ  * SPDY; }
  if (keys['KeyZ']) { mx += fwdX * SPDY; mz += fwdZ * SPDY; } // AZERTY avancer
  if (keys['KeyQ']) { mx -= rtX  * SPDY; mz -= rtZ  * SPDY; } // AZERTY gauche

  // ── Résolution des collisions par axe séparé ─────────────
  let nx = cp.x + mx;
  let ny = cp.y + velY;
  let nz = cp.z + mz;

  if (collide(nx, cp.y, cp.z, false)) nx = cp.x; // bloquer X
  if (collide(nx, cp.y, nz,   false)) nz = cp.z; // bloquer Z
  if (collide(nx, ny,   nz,   true )) {           // bloquer Y
    onGround = velY < 0;
    velY = 0;
    ny = cp.y;
  } else {
    onGround = false;
  }

  // Clamper aux bords du monde
  nx = Math.max(0.5, Math.min(WW - 0.5, nx));
  nz = Math.max(0.5, Math.min(WD - 0.5, nz));

  // Respawn si tombé hors du monde
  if (ny < -8) {
    respawn();
  } else {
    camera.position.set(nx, ny, nz);
  }
}

// ══════════════════════════════════════════════════════════════
//  respawn()  –  repositionne le joueur au-dessus du centre du monde
// ══════════════════════════════════════════════════════════════
function respawn() {
  const cx = Math.floor(WW / 2);
  const cz = Math.floor(WD / 2);
  let sy = WH - 1;
  while (sy > 0 && !isSolid(getB(cx, sy, cz))) sy--;
  camera.position.set(cx + 0.5, sy + 2.1, cz + 0.5);
  velY = 0;
  playerYaw   = 0;
  playerPitch = 0;
}
