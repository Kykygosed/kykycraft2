'use strict';
// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION DU MONDE PAR CHUNK
//  Grottes souterraines + entrées en surface + failles
// ══════════════════════════════════════════════════════════════

let _N, _N2, _N3, _Ntree, _Ncave, _Ncave2, _Nravine;

function initWorldgen(seed) {
  _N       = new Noise(seed);
  _N2      = new Noise(seed ^ 0xCAFEBABE);
  _N3      = new Noise(seed ^ 0x12345678);
  _Ntree   = new Noise(seed ^ 0x98765432);
  _Ncave   = new Noise(seed ^ 0xABCDEF01);
  _Ncave2  = new Noise(seed ^ 0x12ABCDEF);
  _Nravine = new Noise(seed ^ 0xDEAD5678);
}

// ══════════════════════════════════════════════════════════════
//  HAUTEUR DE SURFACE
// ══════════════════════════════════════════════════════════════
function getTerrainHeight(wx, wz) {
  const nx=wx/500, nz=wz/500;
  const fadeW=WORLD_RADIUS*0.85;
  const ex=Math.max(0,Math.min(1,(WORLD_RADIUS-Math.abs(wx))/(WORLD_RADIUS-fadeW)));
  const ez=Math.max(0,Math.min(1,(WORLD_RADIUS-Math.abs(wz))/(WORLD_RADIUS-fadeW)));
  const mask=Math.pow(Math.min(ex,ez),0.45);
  const base  =_N.fbm(nx*3.5,nz*3.5,6,1.95,0.54);
  const ridge =1-Math.abs(_N3.fbm(nx*2.8+5,nz*2.8+5,4,2.1,0.52)*2-1);
  const mtn   =_N2.fbm(nx*1.8+10,nz*1.8+10,3,2.0,0.5);
  return Math.floor((base*0.6+Math.pow(ridge,1.4)*mtn*0.4)*mask*32+2);
}

function getTerrainHeightFast(wx, wz) {
  const nx=wx/500, nz=wz/500;
  const fadeW=WORLD_RADIUS*0.85;
  const ex=Math.max(0,Math.min(1,(WORLD_RADIUS-Math.abs(wx))/(WORLD_RADIUS-fadeW)));
  const ez=Math.max(0,Math.min(1,(WORLD_RADIUS-Math.abs(wz))/(WORLD_RADIUS-fadeW)));
  const mask=Math.pow(Math.min(ex,ez),0.45);
  return Math.floor(_N.fbm(nx*3.5,nz*3.5,4,1.95,0.54)*mask*32+2);
}

// ══════════════════════════════════════════════════════════════
//  GROTTES  — bruit 3D fake (produit ridge)
//  Uniquement sous la surface  +  entrées en surface
// ══════════════════════════════════════════════════════════════

/**
 * Valeur brute de densité souterraine [0..1].
 * > CAVE_THRESH = vide (grotte).
 */
const CAVE_THRESH = 0.22;

function caveValue(wx, wy, wz) {
  const sc = 0.048;
  // Plan XZ + variation Y
  const n1 = _Ncave.get(wx*sc,          wz*sc + wy*0.10);
  const n2 = _Ncave2.get(wx*sc + wy*0.07, wz*sc);
  const r1 = 1-Math.abs(n1*2-1); // ridge 0..1
  const r2 = 1-Math.abs(n2*2-1);
  return r1*r2; // tunnel là où les deux valeurs sont proches de 0.5
}

function isCave(wx, wy, wz, surfY) {
  // Pas de grotte au-dessus du sol, ni dans les 3 premiers blocs de surface
  if (wy >= surfY-2) return false;
  // Pas de grotte trop profonde sous Y=0 (vide intentionnel)
  if (wy < 1)        return false;
  // Plus de grottes près de la surface (fade progressif)
  const depthBelow = surfY - wy;
  const fade = Math.min(1.0, depthBelow / 6.0); // fade sur 6 blocs
  return caveValue(wx, wy, wz) > CAVE_THRESH / fade;
}

// ══════════════════════════════════════════════════════════════
//  ENTRÉES DE GROTTE en surface  (collines creuses)
// ══════════════════════════════════════════════════════════════
/**
 * Retourne true si cette colonne de surface doit avoir
 * une entrée de grotte (trou dans la pente).
 */
function hasCaveEntrance(wx, wz, surfY) {
  if (surfY < SEA+2 || surfY > 25) return false; // pas sous l'eau ni trop haut
  // Entrées rares (~2% des colonnes profondes)
  const v = _Ncave.h(wx*3+7, wz*3+11);
  if (v > 0.018) return false;
  // Seulement si il y a une grotte juste dessous
  return isCave(wx, surfY-3, wz, surfY);
}

// ══════════════════════════════════════════════════════════════
//  FAILLES  — coupures verticales étroites
// ══════════════════════════════════════════════════════════════
function isRavine(wx, wy, wz, surfY) {
  if (wy < 1 || wy >= surfY) return false;
  const rn  = _Nravine.get(wx*0.012, wz*0.012);
  const ridge = 1-Math.abs(rn*2-1);
  if (ridge < 0.90) return false; // très étroit
  // Profondeur variable : plus larges vers le fond
  const relDepth = (surfY-wy)/Math.max(1, surfY);
  return wy < surfY*0.6;
}

// ══════════════════════════════════════════════════════════════
//  FARLANDS
// ══════════════════════════════════════════════════════════════
function isFarlands(wx, wz) {
  return Math.abs(wx)>WORLD_RADIUS-150||Math.abs(wz)>WORLD_RADIUS-150;
}
function farlandsBlock(wx, wy, wz) {
  const f1=Math.sin(wx*0.18)*Math.cos(wz*0.18);
  const f2=Math.cos(wx*0.07+wz*0.07);
  const f3=Math.sin(wx*0.5-wz*0.3)*0.4;
  const col=(f1+f2+f3)*0.5;
  const dist=Math.max(Math.abs(wx),Math.abs(wz))-(WORLD_RADIUS-150);
  const t=Math.min(dist/150,1.0);
  const colH=Math.floor((col*0.5+0.5)*120*t+5);
  if(wy===0)  return B.STONE;
  if(wy<0)    return B.AIR;
  if(wy<=colH)return wy<4?B.STONE:(wy===colH?B.GRASS:(wy<colH-2?B.STONE:B.DIRT));
  if(wy<=SEA&&t<1) return B.WATER;
  return B.AIR;
}

// ══════════════════════════════════════════════════════════════
//  ARBRES
// ══════════════════════════════════════════════════════════════
function isTreePos(wx,wz){ return _Ntree.h(wx*7,wz*13)<0.008; }
function treeHeight(wx,wz){ return 4+Math.floor(_Ntree.h(wx,wz*2)*3); }

// ══════════════════════════════════════════════════════════════
//  GÉNÉRATION D'UN CHUNK
// ══════════════════════════════════════════════════════════════
function generateChunk(cx, cz) {
  const data   = new Uint8Array(CHUNK_SIZE * Y_RANGE * CHUNK_SIZE);
  const worldX = cx*CHUNK_SIZE, worldZ = cz*CHUNK_SIZE;

  // ── Passe 1 : terrain de base (colonne par colonne) ──────────
  const surfMap = new Int32Array(CHUNK_SIZE*CHUNK_SIZE);

  for (let lz=0;lz<CHUNK_SIZE;lz++) for (let lx=0;lx<CHUNK_SIZE;lx++) {
    const wx=worldX+lx, wz=worldZ+lz;

    if (isFarlands(wx,wz)) {
      for (let ly=0;ly<Y_RANGE;ly++)
        data[blockIdx(lx,ly,lz)]=farlandsBlock(wx,ly+Y_MIN,wz);
      surfMap[lx+lz*CHUNK_SIZE]=30; // valeur neutre
      continue;
    }

    const sy=getTerrainHeight(wx,wz);
    surfMap[lx+lz*CHUNK_SIZE]=sy;
    const ocean=sy<SEA, beach=sy<=SEA+1, hiMtn=sy>26, mtn=sy>22;
    const entranceCave=hasCaveEntrance(wx,wz,sy);

    for (let ly=0;ly<Y_RANGE;ly++) {
      const wy=ly+Y_MIN;
      let b=B.AIR;

      if      (wy<0)    b=B.AIR;
      else if (wy===0)  b=B.STONE;
      else if (wy>sy)   b=(wy<=SEA?B.WATER:B.AIR);
      else if (wy===sy) {
        // Entrée de grotte : trou à la surface
        if (entranceCave) { b=B.AIR; continue; }
        if      (ocean)  b=B.GRAVEL;
        else if (beach)  b=B.SAND;
        else if (hiMtn)  b=B.SNOW;
        else if (mtn)    b=B.STONE;
        else             b=B.GRASS;
      } else if (wy>=sy-4) {
        b=(ocean||beach)?B.SAND:(mtn?B.STONE:B.DIRT);
      } else {
        b=B.STONE;
      }
      data[blockIdx(lx,ly,lz)]=b;
    }
  }

  // ── Passe 2 : creuser grottes & failles ──────────────────────
  for (let lz=0;lz<CHUNK_SIZE;lz++) for (let lx=0;lx<CHUNK_SIZE;lx++) {
    const wx=worldX+lx, wz=worldZ+lz;
    if (isFarlands(wx,wz)) continue;
    const sy=surfMap[lx+lz*CHUNK_SIZE];

    for (let ly=0;ly<Y_RANGE;ly++) {
      const wy=ly+Y_MIN;
      const bi=blockIdx(lx,ly,lz);
      if (!data[bi]||data[bi]===B.WATER) continue;
      if (wy===0) continue; // bedrock intouchable

      if (isCave(wx,wy,wz,sy)||isRavine(wx,wy,wz,sy))
        data[bi]=B.AIR;
    }
  }

  // ── Passe 3 : arbres ─────────────────────────────────────────
  const TSEARCH=CHUNK_SIZE+3;
  for (let oz=-TSEARCH;oz<CHUNK_SIZE+TSEARCH;oz++) for (let ox=-TSEARCH;ox<CHUNK_SIZE+TSEARCH;ox++) {
    const tx=worldX+ox, tz=worldZ+oz;
    if (!isTreePos(tx,tz)||isFarlands(tx,tz)) continue;
    const sy=getTerrainHeight(tx,tz);
    if (sy<=SEA+1||sy>21) continue;
    const trH=treeHeight(tx,tz);
    // Tronc
    for (let dy=1;dy<=trH;dy++) {
      const bx=tx-worldX, bz2=tz-worldZ;
      if (bx<0||bx>=CHUNK_SIZE||bz2<0||bz2>=CHUNK_SIZE) continue;
      const wy=sy+dy; if(wy>Y_MAX) break;
      const li=blockIdx(bx,wy-Y_MIN,bz2);
      if (data[li]===B.AIR) data[li]=B.WOOD;
    }
    // Feuillage
    for (let lx2=-2;lx2<=2;lx2++) for (let lz2=-2;lz2<=2;lz2++) for (let ly2=-1;ly2<=2;ly2++) {
      if (Math.sqrt(lx2*lx2+lz2*lz2+(ly2*0.7)*(ly2*0.7))>=2.5) continue;
      const bx=tx+lx2-worldX, bz3=tz+lz2-worldZ;
      if (bx<0||bx>=CHUNK_SIZE||bz3<0||bz3>=CHUNK_SIZE) continue;
      const wy=sy+trH+ly2; if(wy<Y_MIN||wy>Y_MAX) continue;
      const li=blockIdx(bx,wy-Y_MIN,bz3);
      if (data[li]!==B.WOOD) data[li]=B.LEAVES;
    }
  }

  return data;
}
