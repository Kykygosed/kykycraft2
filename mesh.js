'use strict';

// ══════════════════════════════════════════════════════════════
//  CONSTRUCTION DU MESH VOXEL
// ══════════════════════════════════════════════════════════════

/** Matériaux actifs (remplis par buildMaterials() au démarrage) */
let globalMats = null;

/** Meshes courants (reconstruits à chaque modification du monde) */
let solidMesh = null;
let waterMesh = null;

/** Timer de reconstruction différée */
let rebuildTimer = null;

// ── Boîte de sélection (contour blanc autour du bloc visé) ────
const selBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.015, 1.015, 1.015),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  })
);
selBox.visible = false;
scene.add(selBox);

// ══════════════════════════════════════════════════════════════
//  buildMesh()  –  parcourt le monde entier et génère la géométrie
// ══════════════════════════════════════════════════════════════
/**
 * Stratégie : un groupe de géométrie par slot matériau (multi-material mesh).
 * L'eau est traitée dans un mesh séparé pour le tri de transparence.
 *
 * Pour chaque bloc non-AIR, on examine ses 6 voisins ; si la face est
 * visible (showFace), on ajoute un quad dans l'accumulateur du bon slot.
 */
function buildMesh() {

  // Accumulateurs par slot matériau (blocs solides + feuilles)
  const acc = Array.from({ length: NMAT }, () => ({
    pos: [], uv: [], col: [], idx: [], vi: 0,
  }));

  // Accumulateur séparé pour l'eau
  const wacc = { pos: [], uv: [], col: [], idx: [], vi: 0 };

  // ── Itération sur tous les voxels ──
  for (let z = 0; z < WD; z++) {
    for (let y = 0; y < WH; y++) {
      for (let x = 0; x < WW; x++) {
        const b = world[idx(x, y, z)];
        if (!b) continue;

        const isWater = (b === B.WATER);

        FACES.forEach(({ n: [nx, ny, nz], c, fi }) => {
          const nb = getB(x + nx, y + ny, z + nz);
          if (!showFace(b, nb)) return;

          const mi = blockMat(b, fi);
          const sh = FSHADE[fi];          // facteur d'ombrage
          const a  = isWater ? wacc : acc[mi];
          const vi = a.vi;

          // 4 sommets du quad
          c.forEach(([cx, cy, cz]) => {
            a.pos.push(x + cx, y + cy, z + cz);
            a.col.push(sh, sh, sh);       // couleur vertex (modulée par la texture)
          });
          // UVs standards
          for (let i = 0; i < 8; i++) a.uv.push(QUV[i]);
          // Deux triangles
          a.idx.push(vi, vi+1, vi+2,  vi, vi+2, vi+3);
          a.vi += 4;
        });
      }
    }
  }

  // ── Ancien mesh solide → on le retire ──
  if (solidMesh) {
    scene.remove(solidMesh);
    solidMesh.geometry.dispose();
  }

  // ── Construction du mesh solide multi-matériaux ──
  {
    // Calcul de la taille totale
    const totalV = acc.reduce((s, a) => s + a.vi,          0);
    const totalI = acc.reduce((s, a) => s + a.idx.length,  0);

    if (totalV > 0) {
      const aPos = new Float32Array(totalV * 3);
      const aUV  = new Float32Array(totalV * 2);
      const aCol = new Float32Array(totalV * 3);
      const aIdx = new Uint32Array(totalI);
      const groups = [];

      let vp = 0, up = 0, cp = 0, ip = 0;
      let vOffset = 0, iOffset = 0;

      acc.forEach((a, mi) => {
        if (a.vi === 0) return;

        for (let i = 0; i < a.pos.length; i++) aPos[vp++] = a.pos[i];
        for (let i = 0; i < a.uv.length;  i++) aUV [up++] = a.uv[i];
        for (let i = 0; i < a.col.length; i++) aCol[cp++] = a.col[i];
        for (let i = 0; i < a.idx.length; i++) aIdx[ip++] = a.idx[i] + vOffset;

        groups.push({ start: iOffset, count: a.idx.length, materialIndex: mi });
        vOffset += a.vi;
        iOffset += a.idx.length;
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(aUV,  2));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(aCol, 3));
      geo.setIndex(new THREE.BufferAttribute(aIdx, 1));
      groups.forEach(g => geo.addGroup(g.start, g.count, g.materialIndex));

      solidMesh = new THREE.Mesh(geo, globalMats);
      scene.add(solidMesh);
    }
  }

  // ── Ancien mesh eau → on le retire ──
  if (waterMesh) {
    scene.remove(waterMesh);
    waterMesh.geometry.dispose();
  }

  // ── Construction du mesh eau ──
  if (wacc.vi > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(wacc.pos), 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(new Float32Array(wacc.uv),  2));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(new Float32Array(wacc.col), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(wacc.idx), 1));

    waterMesh = new THREE.Mesh(geo, globalMats[M.WATER]);
    scene.add(waterMesh);
  }
}

// ══════════════════════════════════════════════════════════════
//  scheduleBuild()  –  reconstruction différée (évite les rebuilds en rafale)
// ══════════════════════════════════════════════════════════════
/**
 * Déclenche une reconstruction du mesh 80 ms après le dernier appel.
 * Met aussi à jour la minimap.
 */
function scheduleBuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    buildMesh();
    updateMinimapBase(); // défini dans ui.js
  }, 80);
}
