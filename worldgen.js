'use strict';

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION DU MONDE
// ══════════════════════════════════════════════════════════════

/** Cache des hauteurs de terrain (mis à jour par generateWorld) */
let terrainYMap = null;

/**
 * Génère un monde complet à partir d'une graine entière.
 *
 * Algorithme :
 *  1. Heightmap via fBm + ridges de montagne + masque continental
 *  2. Normalisation → hauteurs [2, 38]
 *  3. Attribution de blocs selon l'altitude et le biome
 *  4. Placement d'arbres aléatoires
 *
 * @param {number} seed – entier 32 bits
 */
function generateWorld(seed) {
  world.fill(0);

  // Trois instances de bruit indépendantes (seeds dérivées)
  const N  = new Noise(seed);                 // bruit de base
  const N2 = new Noise(seed ^ 0xCAFEBABE);   // masque montagne
  const N3 = new Noise(seed ^ 0x12345678);   // ridges

  terrainYMap = new Int32Array(WW * WD);

  // ── 1. Heightmap brute ──────────────────────────────────────
  const hraw  = new Float32Array(WW * WD);
  let hmin = 1, hmax = 0;

  for (let z = 0; z < WD; z++) {
    for (let x = 0; x < WW; x++) {
      const nx = x / WW, nz = z / WD;

      // Masque continental : fondu vers l'océan sur les bords
      const ex   = Math.min(nx, 1 - nx) * 2.2;
      const ez   = Math.min(nz, 1 - nz) * 2.2;
      const mask = Math.pow(Math.min(ex, ez), 0.55);

      // Terrain de base (6 octaves, fréquences moyennes)
      const base = N.fbm(nx * 3.5, nz * 3.5, 6, 1.95, 0.54);

      // Ridges : fold noise → sommets nets aux croisements de zéro
      const ridgeRaw = N3.fbm(nx * 2.8 + 5, nz * 2.8 + 5, 4, 2.1, 0.52) * 2 - 1;
      const ridge    = 1 - Math.abs(ridgeRaw);

      // Masque d'intensité montagnarde
      const mtnMask = N2.fbm(nx * 1.8 + 10, nz * 1.8 + 10, 3, 2.0, 0.5);

      // Mélange : plaines + reliefs montagneux amplifiés
      const blended = base * 0.6 + Math.pow(ridge, 1.4) * mtnMask * 0.4;
      const h = blended * mask;

      hraw[x + WW * z] = h;
      if (h < hmin) hmin = h;
      if (h > hmax) hmax = h;
    }
  }

  // ── 2. Normalisation → [2, 38] ─────────────────────────────
  const hscale = 1 / (hmax - hmin);
  for (let z = 0; z < WD; z++) {
    for (let x = 0; x < WW; x++) {
      const hn = (hraw[x + WW * z] - hmin) * hscale;
      terrainYMap[x + WW * z] = Math.floor(hn * 32 + 2);
    }
  }

  // ── 3. Remplissage des blocs ────────────────────────────────
  for (let z = 0; z < WD; z++) {
    for (let x = 0; x < WW; x++) {
      const sy      = terrainYMap[x + WW * z];
      const ocean   = sy < SEA;
      const beach   = sy === SEA || sy === SEA + 1;
      const highMtn = sy > 26;
      const mtn     = sy > 22;

      for (let y = 0; y < WH; y++) {

        // Roche de base immuable
        if (y === 0) { setB(x, y, z, B.STONE); continue; }

        // Zone au-dessus du terrain
        if (y > sy) {
          if (y <= SEA) setB(x, y, z, B.WATER); // remplissage eau
          continue;
        }

        if (y === sy) {
          // Couche de surface selon biome
          if      (ocean)   setB(x, y, z, B.GRAVEL); // fond marin
          else if (beach)   setB(x, y, z, B.SAND);   // plage
          else if (highMtn) setB(x, y, z, B.SNOW);   // calotte neigeuse
          else if (mtn)     setB(x, y, z, B.STONE);  // flanc rocheux
          else              setB(x, y, z, B.GRASS);  // plaine herbue

        } else if (y >= sy - 4) {
          // Sous-couche (4 blocs sous la surface)
          if      (ocean || beach) setB(x, y, z, B.SAND);
          else if (mtn)            setB(x, y, z, B.STONE);
          else                     setB(x, y, z, B.DIRT);

        } else {
          // Tout le reste : pierre
          setB(x, y, z, B.STONE);
        }
      }
    }
  }

  // ── 4. Arbres ───────────────────────────────────────────────
  const treeNoise = new Noise(seed ^ 0x98765432);
  const TREE_COUNT = 52;

  for (let t = 0; t < TREE_COUNT; t++) {
    const tx = 3 + Math.floor(treeNoise.h(t * 3, 1) * (WW - 6));
    const tz = 3 + Math.floor(treeNoise.h(1, t * 3) * (WD - 6));
    const sy = terrainYMap[tx + WW * tz];

    // N'arborer que les plaines herbeuses
    if (sy <= SEA + 1 || sy > 21)        continue;
    if (getB(tx, sy, tz) !== B.GRASS)    continue;

    const trunkH = 4 + Math.floor(treeNoise.h(t, t * 2) * 3);

    // Tronc
    for (let y = sy + 1; y <= sy + trunkH; y++) {
      setB(tx, y, tz, B.WOOD);
    }

    // Feuillage : ellipsoïde autour du sommet
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = -1; ly <= 2; ly++) {
          const d = Math.sqrt(lx*lx + lz*lz + (ly*0.7)*(ly*0.7));
          if (d < 2.5) setB(tx + lx, sy + trunkH + ly, tz + lz, B.LEAVES);
        }
      }
    }
  }
}
