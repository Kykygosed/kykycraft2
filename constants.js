'use strict';

// ══════════════════════════════════════════════════════════════
//  DIMENSIONS DU MONDE
// ══════════════════════════════════════════════════════════════
const WW   = 96;   // largeur  (X)
const WH   = 48;   // hauteur  (Y)
const WD   = 96;   // profondeur (Z)
const SEA  = 10;   // niveau de la mer
const REACH = 5.0; // portée du joueur en blocs

// ══════════════════════════════════════════════════════════════
//  TYPES DE BLOCS
// ══════════════════════════════════════════════════════════════
const B = {
  AIR:    0,
  GRASS:  1,
  DIRT:   2,
  STONE:  3,
  WOOD:   4,
  LEAVES: 5,
  SAND:   6,
  SNOW:   7,
  BRICK:  8,
  WATER:  9,
  GRAVEL: 10,
};

// Blocs disponibles dans la hotbar (pas l'eau ni le gravier)
const HOTBAR = [
  B.GRASS, B.DIRT, B.STONE, B.WOOD,
  B.LEAVES, B.SAND, B.SNOW, B.BRICK,
];

// ══════════════════════════════════════════════════════════════
//  SLOTS DE MATÉRIAUX (un slot = une texture Three.js)
// ══════════════════════════════════════════════════════════════
const M = {
  DIRT:   0,
  GTOP:   1,   // grass_block_top
  GSIDE:  2,   // grass_block (côtés)
  STONE:  3,
  WOOD:   4,
  LEAVES: 5,
  SAND:   6,
  SNOW:   7,
  BRICK:  8,
  WATER:  9,
  GRAVEL: 10,
};
const NMAT = 11; // nombre total de matériaux

// Couleurs de repli si une texture ne se charge pas [r, g, b]
const FBCOL = {
  [M.DIRT]:   [130,  88,  52],
  [M.GTOP]:   [ 88, 170,  48],
  [M.GSIDE]:  [118,  82,  50],
  [M.STONE]:  [120, 120, 120],
  [M.WOOD]:   [108,  78,  32],
  [M.LEAVES]: [ 52, 118,  32],
  [M.SAND]:   [218, 200,  88],
  [M.SNOW]:   [225, 235, 255],
  [M.BRICK]:  [172,  72,  52],
  [M.WATER]:  [ 48, 108, 200],
  [M.GRAVEL]: [148, 138, 128],
};

// ══════════════════════════════════════════════════════════════
//  MAPPING BLOC × FACE → SLOT MATÉRIAU
//  fi : 0=+y(top)  1=-y(bot)  2=+x  3=-x  4=+z  5=-z
// ══════════════════════════════════════════════════════════════
function blockMat(b, fi) {
  switch (b) {
    case B.GRASS:  return fi === 0 ? M.GTOP  : fi === 1 ? M.DIRT  : M.GSIDE;
    case B.DIRT:   return M.DIRT;
    case B.STONE:  return M.STONE;
    case B.WOOD:   return M.WOOD;
    case B.LEAVES: return M.LEAVES;
    case B.SAND:   return M.SAND;
    case B.SNOW:   return fi === 0 ? M.SNOW  : fi === 1 ? M.DIRT  : M.STONE;
    case B.BRICK:  return M.BRICK;
    case B.WATER:  return M.WATER;
    case B.GRAVEL: return M.GRAVEL;
    default:       return M.STONE;
  }
}

// Facteurs d'ombrage par face (top=clair, bas=sombre, côtés=moyen)
const FSHADE = [1.0, 0.52, 0.80, 0.80, 0.68, 0.68];

// ══════════════════════════════════════════════════════════════
//  DÉFINITIONS DES FACES (ordre : +y -y +x -x +z -z)
// ══════════════════════════════════════════════════════════════
const FACES = [
  { n: [ 0, 1, 0], c: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], fi: 0 }, // dessus
  { n: [ 0,-1, 0], c: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]], fi: 1 }, // dessous
  { n: [ 1, 0, 0], c: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], fi: 2 }, // droite
  { n: [-1, 0, 0], c: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], fi: 3 }, // gauche
  { n: [ 0, 0, 1], c: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], fi: 4 }, // avant
  { n: [ 0, 0,-1], c: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], fi: 5 }, // arrière
];

// UV de base pour chaque quad (réutilisés pour toutes les faces)
const QUV = [0,0, 1,0, 1,1, 0,1];

// ══════════════════════════════════════════════════════════════
//  INFOS D'AFFICHAGE PAR BLOC (hotbar + minimap)
// ══════════════════════════════════════════════════════════════
const BINFO = {
  [B.GRASS]:  { name: 'Herbe',  icon: 'grass_block_top', fb: [ 88,170, 48] },
  [B.DIRT]:   { name: 'Terre',  icon: 'dirt',            fb: [130, 88, 52] },
  [B.STONE]:  { name: 'Pierre', icon: 'stone',           fb: [120,120,120] },
  [B.WOOD]:   { name: 'Bois',   icon: 'wood',            fb: [108, 78, 32] },
  [B.LEAVES]: { name: 'Feuil.', icon: 'leaves',          fb: [ 52,118, 32] },
  [B.SAND]:   { name: 'Sable',  icon: 'sand',            fb: [218,200, 88] },
  [B.SNOW]:   { name: 'Neige',  icon: 'snow',            fb: [225,235,255] },
  [B.BRICK]:  { name: 'Brique', icon: 'bricks',          fb: [172, 72, 52] },
};

// Couleurs de surface pour la minimap
const MMCOL = {
  [B.GRASS]:  [ 88,168, 50],
  [B.DIRT]:   [130, 88, 52],
  [B.STONE]:  [120,120,120],
  [B.WOOD]:   [108, 78, 32],
  [B.LEAVES]: [ 52,118, 32],
  [B.SAND]:   [218,200, 88],
  [B.SNOW]:   [220,230,255],
  [B.BRICK]:  [172, 72, 52],
  [B.WATER]:  [ 48,108,200],
  [B.GRAVEL]: [148,138,128],
};

// Constantes physiques
const GRAV = -0.018;
const JVEL =  0.22;   // vitesse de saut
const SPDY =  0.09;   // vitesse de déplacement
