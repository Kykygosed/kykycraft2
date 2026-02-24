'use strict';

// ══════════════════════════════════════════════════════════════
//  PARTICULES DE CASSE DE BLOC
//  Quand un bloc est cassé, 10 petits morceaux tombent,
//  disparaissent un par un sur 2 secondes.
// ══════════════════════════════════════════════════════════════

const activeParticles = [];   // { mesh, vx, vy, vz, life, maxLife }
const PARTICLE_GEO   = new THREE.BoxGeometry(0.16, 0.16, 0.16);

/** Crée un matériau de particule avec un snippet de la texture du bloc. */
function makeParticleMat(blockType) {
  const info = BINFO[blockType];
  const img  = info ? texImages[info.icon] : null;

  const c   = document.createElement('canvas');
  c.width   = c.height = 8;
  const ctx = c.getContext('2d');

  if (img) {
    // Sous-région aléatoire 8×8 dans la texture 16×16
    const ox = (Math.random() < 0.5 ? 0 : 8);
    const oz = (Math.random() < 0.5 ? 0 : 8);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, ox, oz, 8, 8, 0, 0, 8, 8);
  } else {
    // Fallback couleur
    const slot   = blockMat(blockType, 0);
    const [r,g,b] = FBCOL[slot] || [128,128,128];
    // Légère variation de teinte
    const v = 0.85 + Math.random() * 0.3;
    ctx.fillStyle = `rgb(${Math.min(255,r*v)|0},${Math.min(255,g*v)|0},${Math.min(255,b*v)|0})`;
    ctx.fillRect(0, 0, 8, 8);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;

  return new THREE.MeshBasicMaterial({ map: tex, transparent: true });
}

/**
 * Fait exploser un bloc en 10 particules.
 * @param {number} wx, wy, wz   coordonnées monde du bloc cassé
 * @param {number} blockType    type du bloc
 */
function spawnBreakParticles(wx, wy, wz, blockType) {
  const cx = wx + 0.5, cy = wy + 0.5, cz = wz + 0.5;

  for (let i = 0; i < 10; i++) {
    const mat  = makeParticleMat(blockType);
    const mesh = new THREE.Mesh(PARTICLE_GEO, mat);

    // Position aléatoire dans le bloc
    mesh.position.set(
      cx + (Math.random() - 0.5) * 0.8,
      cy + (Math.random() - 0.5) * 0.8,
      cz + (Math.random() - 0.5) * 0.8
    );
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    // Vitesse initiale explosive
    const speed = 0.04 + Math.random() * 0.06;
    const angle = Math.random() * Math.PI * 2;
    const vxz   = Math.random() * speed;

    const p = {
      mesh,
      vx:   Math.cos(angle) * vxz,
      vy:   0.06 + Math.random() * 0.06,   // toujours vers le haut au départ
      vz:   Math.sin(angle) * vxz,
      life: 1.8 + Math.random() * 0.4,     // durée de vie légèrement variable
      maxLife: 0, // rempli juste après
    };
    p.maxLife = p.life;

    scene.add(mesh);
    activeParticles.push(p);
  }
}

/**
 * Met à jour toutes les particules actives.
 * À appeler chaque frame depuis game.js avec dt en secondes.
 */
function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];

    // Physique
    p.vy -= 0.012;        // gravité
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.vx *= 0.92;         // friction air
    p.vz *= 0.92;

    // Rotation continue
    p.mesh.rotation.x += 0.05;
    p.mesh.rotation.y += 0.07;

    // Fade out progressif
    p.life -= dt;
    const t = Math.max(0, p.life / p.maxLife);
    p.mesh.material.opacity = t;

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry; // pas besoin de dispose PARTICLE_GEO (partagé)
      p.mesh.material.dispose();
      if (p.mesh.material.map) p.mesh.material.map.dispose();
      activeParticles.splice(i, 1);
    }
  }
}
