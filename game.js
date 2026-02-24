'use strict';

// ══════════════════════════════════════════════════════════════
//  RAYCASTER DDA (Digital Differential Analyzer)
//  Traverse le monde voxel le long du rayon caméra et
//  retourne le premier bloc solide non-eau dans la portée.
// ══════════════════════════════════════════════════════════════

/** Bloc actuellement visé [x, y, z] ou null */
let targetBlock = null;

/** Normale de la face visée [nx, ny, nz] ou null */
let targetFace  = null;

function dda() {
  // Direction = axe -Z local transformé en espace monde
  const dir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(camera.quaternion)
    .normalize();

  const o  = camera.position;
  let ix   = Math.floor(o.x), iy = Math.floor(o.y), iz = Math.floor(o.z);
  const sx = dir.x >= 0 ? 1 : -1;
  const sy = dir.y >= 0 ? 1 : -1;
  const sz = dir.z >= 0 ? 1 : -1;

  // Distance à la prochaine frontière de cellule, par axe
  const txD = Math.abs(dir.x) < 1e-8 ? 1e30 : 1 / Math.abs(dir.x);
  const tyD = Math.abs(dir.y) < 1e-8 ? 1e30 : 1 / Math.abs(dir.y);
  const tzD = Math.abs(dir.z) < 1e-8 ? 1e30 : 1 / Math.abs(dir.z);

  let txM = dir.x >= 0 ? (ix + 1 - o.x) * txD : (o.x - ix) * txD;
  let tyM = dir.y >= 0 ? (iy + 1 - o.y) * tyD : (o.y - iy) * tyD;
  let tzM = dir.z >= 0 ? (iz + 1 - o.z) * tzD : (o.z - iz) * tzD;

  let fn = [0, 0, 0]; // normale de la dernière face traversée
  let dist = 0;

  for (let i = 0; i < 128; i++) {
    const b = getB(ix, iy, iz);

    // Premier bloc non-AIR et non-eau rencontré
    if (b > 0 && b !== B.WATER) {
      targetBlock = [ix, iy, iz];
      targetFace  = [...fn];
      selBox.position.set(ix + 0.5, iy + 0.5, iz + 0.5);
      selBox.visible = true;
      return;
    }

    // Avancer vers la frontière la plus proche
    if (txM < tyM && txM < tzM) {
      dist = txM; if (dist > REACH) break;
      ix += sx; fn = [-sx, 0, 0]; txM += txD;
    } else if (tyM < tzM) {
      dist = tyM; if (dist > REACH) break;
      iy += sy; fn = [0, -sy, 0]; tyM += tyD;
    } else {
      dist = tzM; if (dist > REACH) break;
      iz += sz; fn = [0, 0, -sz]; tzM += tzD;
    }
  }

  targetBlock = null;
  targetFace  = null;
  selBox.visible = false;
}

// ══════════════════════════════════════════════════════════════
//  ACTIONS SUR LES BLOCS
// ══════════════════════════════════════════════════════════════

/** Casse le bloc visé */
function doBreak() {
  if (!targetBlock) return;
  setB(...targetBlock, B.AIR);
  scheduleBuild();
}

/**
 * Pose le bloc sélectionné sur la face visée.
 * Vérifie que le placement ne chevauche pas le joueur.
 */
function doPlace() {
  if (!targetBlock || !targetFace) return;

  const px = targetBlock[0] + targetFace[0];
  const py = targetBlock[1] + targetFace[1];
  const pz = targetBlock[2] + targetFace[2];

  // Hors des limites du monde
  if (px < 0 || px >= WW || py < 0 || py >= WH || pz < 0 || pz >= WD) return;

  // Éviter de se murer vivant : vérifier le chevauchement avec le joueur
  const cp = camera.position;
  const ox = Math.abs(px + 0.5 - cp.x);
  const oz = Math.abs(pz + 0.5 - cp.z);
  if (ox < 0.45 && oz < 0.45 && py + 1 > cp.y - 1.8 && py < cp.y + 0.25) return;

  setB(px, py, pz, selBlock); // selBlock défini dans ui.js
  scheduleBuild();
}

// ══════════════════════════════════════════════════════════════
//  BOUCLE PRINCIPALE
// ══════════════════════════════════════════════════════════════
function loop() {
  requestAnimationFrame(loop);

  physicsStep();                                        // déplacer le joueur
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ'); // orienter la caméra
  dda();                                                // raycasting
  drawMinimap();                                        // minimap
  updateHUD();                                          // coordonnées
  renderer.render(scene, camera);                       // rendu 3D
}

// ══════════════════════════════════════════════════════════════
//  INITIALISATION
// ══════════════════════════════════════════════════════════════

/** Graine utilisée pour la génération (affichée dans le HUD) */
let currentSeed = 0;

/** Met à jour la barre de progression du chargement */
function setProgress(pct) {
  document.getElementById('loadfill').style.width = pct + '%';
}

/**
 * Point d'entrée principal : lit la graine, génère le monde,
 * charge les textures, construit les meshes, démarre la boucle.
 */
async function startGame() {
  // ── Calcul de la graine ──
  const raw = document.getElementById('seed-in').value.trim();
  if (raw) {
    // Hash djb2-like sur la chaîne saisie
    let s = 0;
    for (let i = 0; i < raw.length; i++) s = (s * 31 + raw.charCodeAt(i)) >>> 0;
    currentSeed = s;
  } else {
    // Graine aléatoire
    currentSeed = ((Math.random() * 0xFFFFFF | 0) * 137 + (Math.random() * 0xFFFF | 0)) >>> 0;
  }

  // ── Afficher l'écran de chargement ──
  document.getElementById('start').style.display = 'none';
  const ld = document.getElementById('loading');
  ld.style.display = 'flex';

  setProgress(10);
  await loadTextures();                // textures.js

  setProgress(35);
  globalMats = buildMaterials();       // textures.js → mesh.js utilise globalMats

  setProgress(50);
  generateWorld(currentSeed);          // worldgen.js

  setProgress(75);
  buildMesh();                         // mesh.js

  setProgress(88);
  buildHotbar();                       // ui.js
  updateMinimapBase();                 // ui.js

  setProgress(100);

  // ── Spawn du joueur au-dessus du centre ──
  const cx = Math.floor(WW / 2), cz = Math.floor(WD / 2);
  let sy = WH - 1;
  while (sy > 0 && !isSolid(getB(cx, sy, cz))) sy--;
  camera.position.set(cx + 0.5, sy + 2.2, cz + 0.5);
  velY = 0;

  // ── Cacher le loader et démarrer ──
  setTimeout(() => {
    ld.style.display = 'none';
    requestAnimationFrame(loop);
  }, 200);
}

// ── Écouter le bouton Jouer et la touche Entrée ──
document.getElementById('playbtn').addEventListener('click', startGame);
document.getElementById('seed-in').addEventListener('keydown', e => {
  if (e.key === 'Enter') startGame();
});
