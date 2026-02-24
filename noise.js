'use strict';

// ══════════════════════════════════════════════════════════════
//  BRUIT DE VALEUR LISSÉ (seeded)
//
//  Usage :
//    const N = new Noise(seed);
//    const h = N.fbm(x, z, octaves, lacunarité, gain);
// ══════════════════════════════════════════════════════════════
class Noise {
  constructor(seed) {
    // XOR avec une constante pour éviter que seed=0 soit trivial
    this.seed = (seed >>> 0) ^ 0xDEADBEEF;
  }

  /**
   * Fonction de hachage 2D déterministe → [0, 1)
   * Utilise des multiplications entières (imul) pour rester dans 32 bits.
   */
  h(x, z) {
    let n = (Math.imul(x | 0, 1619) ^ Math.imul(z | 0, 31337) ^ this.seed) >>> 0;
    n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) >>> 0;
    n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) >>> 0;
    return (n >>> 0) / 0x100000000;
  }

  /** Courbe de lissage de 5e degré (smoothstep de Ken Perlin) */
  s(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Interpolation bilinéaire sur grille integer avec lissage.
   * Renvoie une valeur dans [0, 1].
   */
  get(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix,       fz = z - iz;
    return this.lerp(
      this.lerp(this.h(ix,   iz  ), this.h(ix+1, iz  ), this.s(fx)),
      this.lerp(this.h(ix,   iz+1), this.h(ix+1, iz+1), this.s(fx)),
      this.s(fz)
    );
  }

  /**
   * fBm (Fractional Brownian Motion) : accumule plusieurs octaves.
   * @param {number} x, z  – coordonnées d'entrée
   * @param {number} oct   – nombre d'octaves
   * @param {number} lac   – lacunarité (facteur de fréquence inter-octaves, ex: 2)
   * @param {number} gain  – persistance (facteur d'amplitude inter-octaves, ex: 0.5)
   * @returns {number} valeur normalisée dans [0, 1]
   */
  fbm(x, z, oct, lac, gain) {
    let value = 0, amplitude = 0.5, freq = 1, maxVal = 0;
    for (let i = 0; i < oct; i++) {
      value  += this.get(x * freq, z * freq) * amplitude;
      maxVal += amplitude;
      amplitude *= gain;
      freq      *= lac;
    }
    return value / maxVal;
  }
}
