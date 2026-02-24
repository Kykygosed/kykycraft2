'use strict';

// ══════════════════════════════════════════════════════════════
//  GESTION DES TEXTURES
// ══════════════════════════════════════════════════════════════

/**
 * texImages : nom → HTMLImageElement  (utilisé pour les icônes 2D hotbar)
 * TEX3D     : slotMatériau → THREE.Texture  (utilisé par buildMaterials)
 */
const texImages = {};
const TEX3D     = {};

/**
 * Association fichier PNG ↔ slot matériau.
 * L'eau et le gravier n'ont pas de texture PNG → couleur de repli uniquement.
 */
const TEX_FILES = [
  ['dirt',            M.DIRT   ],
  ['grass_block_top', M.GTOP   ],
  ['grass_block',     M.GSIDE  ],
  ['stone',           M.STONE  ],
  ['wood',            M.WOOD   ],
  ['leaves',          M.LEAVES ],
  ['sand',            M.SAND   ],
  ['snow',            M.SNOW   ],
  ['bricks',          M.BRICK  ],
];

/**
 * Charge toutes les textures de façon asynchrone.
 * Les erreurs de chargement sont silencieuses (fallback couleur).
 * @returns {Promise<void>}
 */
function loadTextures() {
  return new Promise(resolve => {
    let pending = TEX_FILES.length;

    TEX_FILES.forEach(([name, slot]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        texImages[name] = img;

        // Créer la texture Three.js avec filtrage nearest (pixelisé)
        const tex = new THREE.Texture(img);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.needsUpdate = true;
        TEX3D[slot] = tex;

        if (--pending === 0) resolve();
      };

      img.onerror = () => {
        // Pas de texture → on utilisera la couleur de repli
        if (--pending === 0) resolve();
      };

      img.src = name + '.png';
    });
  });
}

/**
 * Construit le tableau de matériaux Three.js (un par slot).
 * Doit être appelé après loadTextures().
 * @returns {THREE.Material[]}
 */
function buildMaterials() {
  const mats = [];

  for (let i = 0; i < NMAT; i++) {
    const tex = TEX3D[i] || null;
    const fb  = FBCOL[i] || [128, 128, 128];
    const col = new THREE.Color(fb[0]/255, fb[1]/255, fb[2]/255);

    if (i === M.WATER) {
      // Eau : semi-transparente, pas d'écriture dans le depth buffer
      mats.push(new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        vertexColors: true,
      }));

    } else if (i === M.LEAVES) {
      // Feuilles : alpha-test pour les bords transparents
      mats.push(new THREE.MeshBasicMaterial({
        map:         tex,
        color:       tex ? 0xffffff : col,
        transparent: true,
        alphaTest:   0.5,
        side:        THREE.DoubleSide,
        vertexColors: true,
      }));

    } else {
      // Blocs solides standards
      mats.push(new THREE.MeshBasicMaterial({
        map:          tex,
        color:        tex ? 0xffffff : col,
        vertexColors: true,
      }));
    }
  }

  return mats;
}
