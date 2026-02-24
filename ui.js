'use strict';

// ══════════════════════════════════════════════════════════════
//  INTERFACE UTILISATEUR
// ══════════════════════════════════════════════════════════════

let selBlock = B.GRASS;

// ── Build limit ───────────────────────────────────────────────
const buildLimitEl = document.createElement('div');
buildLimitEl.id = 'buildmsg';
buildLimitEl.textContent = 'Impossible de construire au-dessus de la limite de construction';
document.body.appendChild(buildLimitEl);
let buildLimitTimer = null;

function showBuildLimit() {
  buildLimitEl.classList.add('on');
  clearTimeout(buildLimitTimer);
  buildLimitTimer = setTimeout(() => buildLimitEl.classList.remove('on'), 5000);
}

// ══════════════════════════════════════════════════════════════
//  HOTBAR
// ══════════════════════════════════════════════════════════════
function buildHotbar() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';
  HOTBAR.forEach((blockType, i) => {
    const info = BINFO[blockType];
    const slot = document.createElement('div');
    slot.className = 'slot' + (blockType === selBlock ? ' active' : '');
    slot.addEventListener('click', () => selectSlot(i));
    const ic = document.createElement('canvas');
    ic.width = 28; ic.height = 28;
    drawBlockIcon(ic, blockType);
    const lbl = document.createElement('span');
    lbl.textContent = info.name.toUpperCase().substring(0, 5);
    slot.appendChild(ic); slot.appendChild(lbl);
    hb.appendChild(slot);
  });
}

function drawBlockIcon(canvas, blockType) {
  const ctx = canvas.getContext('2d'), S = canvas.width;
  const info = BINFO[blockType];
  ctx.clearRect(0,0,S,S);
  const img = texImages[info.icon];
  if (img) { ctx.imageSmoothingEnabled=false; ctx.drawImage(img,0,0,S,S); return; }
  const [r,g,b] = info.fb;
  ctx.fillStyle=`rgb(${r},${g},${b})`;
  ctx.beginPath();ctx.moveTo(S/2,1);ctx.lineTo(S-1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(1,S*.32);ctx.closePath();ctx.fill();
  ctx.fillStyle=`rgb(${Math.floor(r*.65)},${Math.floor(g*.65)},${Math.floor(b*.65)})`;
  ctx.beginPath();ctx.moveTo(1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(S/2,S-1);ctx.lineTo(1,S*.68);ctx.closePath();ctx.fill();
  ctx.fillStyle=`rgb(${Math.floor(r*.82)},${Math.floor(g*.82)},${Math.floor(b*.82)})`;
  ctx.beginPath();ctx.moveTo(S-1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(S/2,S-1);ctx.lineTo(S-1,S*.68);ctx.closePath();ctx.fill();
}

function selectSlot(i) {
  selBlock = HOTBAR[i];
  document.querySelectorAll('.slot').forEach((s,j) => s.classList.toggle('active', j===i));
  showToast(BINFO[selBlock]?.name || '');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(window._tt);
  window._tt = setTimeout(() => el.classList.remove('on'), 1300);
}

// ══════════════════════════════════════════════════════════════
//  MINIMAP — vue zoomée 10 blocs de rayon
// ══════════════════════════════════════════════════════════════
const MM_RADIUS = 10;          // blocs autour du joueur
const MM_SIZE   = 128;         // pixels canvas
const MM_SCALE  = MM_SIZE / (MM_RADIUS * 2); // px/bloc ≈ 6.4

const mmCanvas = document.getElementById('mm');
mmCanvas.width = mmCanvas.height = MM_SIZE;
const mmCtx = mmCanvas.getContext('2d');
let mmDirty = true;

/** Cache de couleur de surface : "wx,wz" → [r,g,b,shade] */
const surfCache = new Map();

function getSurfColor(wx, wz) {
  const key = `${wx},${wz}`;
  if (surfCache.has(key)) return surfCache.get(key);
  let surf = B.AIR, surfY = 0;
  for (let wy = 45; wy >= 0; wy--) {
    const b = getB(wx, wy, wz);
    if (b && b !== B.AIR) { surf = b; surfY = wy; break; }
  }
  if (surf === B.AIR) {
    // Check water
    if (getB(wx, SEA, wz) === B.WATER) { surf = B.WATER; surfY = SEA; }
  }
  const col   = MMCOL[surf] || [80,80,80];
  const shade = 0.45 + 0.55 * Math.max(0, surfY) / 38;
  const result = [Math.min(255,col[0]*shade), Math.min(255,col[1]*shade), Math.min(255,col[2]*shade)];
  surfCache.set(key, result);
  return result;
}

function drawMinimap() {
  const px = Math.round(camera.position.x);
  const pz = Math.round(camera.position.z);

  const img = mmCtx.createImageData(MM_SIZE, MM_SIZE);
  for (let dz = -MM_RADIUS; dz < MM_RADIUS; dz++) {
    for (let dx = -MM_RADIUS; dx < MM_RADIUS; dx++) {
      const col = getSurfColor(px + dx, pz + dz);
      const sx0 = Math.round((dx + MM_RADIUS) * MM_SCALE);
      const sz0 = Math.round((dz + MM_RADIUS) * MM_SCALE);
      const sw  = Math.round((dx + MM_RADIUS + 1) * MM_SCALE) - sx0;
      const sh  = Math.round((dz + MM_RADIUS + 1) * MM_SCALE) - sz0;
      for (let py2=sz0; py2<sz0+sh && py2<MM_SIZE; py2++) {
        for (let px2=sx0; px2<sx0+sw && px2<MM_SIZE; px2++) {
          const pi=(px2+py2*MM_SIZE)*4;
          img.data[pi]=col[0]; img.data[pi+1]=col[1]; img.data[pi+2]=col[2]; img.data[pi+3]=255;
        }
      }
    }
  }
  mmCtx.putImageData(img, 0, 0);

  // Point joueur + flèche
  const cx2 = MM_SIZE/2, cz2 = MM_SIZE/2;
  mmCtx.fillStyle='#ff2222';
  mmCtx.beginPath(); mmCtx.arc(cx2,cz2,3.5,0,Math.PI*2); mmCtx.fill();
  mmCtx.strokeStyle='#fff'; mmCtx.lineWidth=2;
  mmCtx.beginPath();
  mmCtx.moveTo(cx2, cz2);
  mmCtx.lineTo(cx2+Math.sin(-playerYaw)*13, cz2-Math.cos(-playerYaw)*13);
  mmCtx.stroke();
}

/** Invalide le cache de surface pour un bloc modifié */
function invalidateSurfCache(wx, wz) {
  const key = `${wx},${wz}`;
  surfCache.delete(key);
}

// ══════════════════════════════════════════════════════════════
//  MINIMAP PLEINE (overlay cliquable / touche M)
// ══════════════════════════════════════════════════════════════
const FM_SIZE = 512;  // résolution de l'image monde (1px = ~9.8 blocs)

// Créer l'overlay dynamiquement
const fmOverlay = document.createElement('div');
fmOverlay.id = 'fmoverlay';
fmOverlay.innerHTML = `
  <div id="fminner">
    <canvas id="fmcanvas" width="${FM_SIZE}" height="${FM_SIZE}"></canvas>
    <div id="fmclose">✕  FERMER (M)</div>
    <div id="fmhint">Molette = zoom · Glisser = déplacer</div>
  </div>`;
document.body.appendChild(fmOverlay);

const fmCanvas = document.getElementById('fmcanvas');
const fmCtx    = fmCanvas.getContext('2d');
const fmInner  = document.getElementById('fminner');
let fmOpen  = false;
let fmScale = 1, fmOffX = 0, fmOffY = 0;
let fmDragActive = false, fmDragSX, fmDragSY, fmDragOX, fmDragOY;
let fmPlayerDot = null; // canvas overlay pour le point joueur

// Nœud canvas pour le point joueur sur la fullmap
fmPlayerDot = document.createElement('canvas');
fmPlayerDot.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
fmPlayerDot.width = FM_SIZE; fmPlayerDot.height = FM_SIZE;
document.getElementById('fminner').insertBefore(fmPlayerDot, fmCanvas.nextSibling);

/** Génère l'image de la carte monde entière depuis le heightmap. */
function generateFullMap() {
  const worldSize = WORLD_RADIUS * 2; // 5000
  const bpp = worldSize / FM_SIZE;    // blocs par pixel ≈ 9.77
  const img = fmCtx.createImageData(FM_SIZE, FM_SIZE);

  for (let pz = 0; pz < FM_SIZE; pz++) {
    for (let px = 0; px < FM_SIZE; px++) {
      const wx = Math.round((px - FM_SIZE/2) * bpp);
      const wz = Math.round((pz - FM_SIZE/2) * bpp);
      const h  = getTerrainHeightFast(wx, wz);
      let block;
      if (Math.abs(wx) > WORLD_RADIUS - 150 || Math.abs(wz) > WORLD_RADIUS - 150)
        block = B.STONE; // farlands
      else if (h < SEA)       block = B.WATER;
      else if (h <= SEA+1)    block = B.SAND;
      else if (h > 26)        block = B.SNOW;
      else if (h > 22)        block = B.STONE;
      else                    block = B.GRASS;
      const col   = MMCOL[block] || [80,80,80];
      const shade = 0.4 + 0.6 * Math.max(0, Math.min(h, 38)) / 38;
      const pi = (px + pz * FM_SIZE) * 4;
      img.data[pi]   = Math.min(255, col[0]*shade);
      img.data[pi+1] = Math.min(255, col[1]*shade);
      img.data[pi+2] = Math.min(255, col[2]*shade);
      img.data[pi+3] = 255;
    }
  }
  fmCtx.putImageData(img, 0, 0);
}

/** Dessine le point joueur sur l'overlay de la fullmap. */
function updateFullMapPlayer() {
  if (!fmOpen) return;
  const ctx2 = fmPlayerDot.getContext('2d');
  ctx2.clearRect(0, 0, FM_SIZE, FM_SIZE);
  const worldSize = WORLD_RADIUS * 2;
  const bpp = worldSize / FM_SIZE;
  const ppx = FM_SIZE/2 + camera.position.x / bpp;
  const ppz = FM_SIZE/2 + camera.position.z / bpp;
  ctx2.fillStyle = '#ff2222';
  ctx2.beginPath(); ctx2.arc(ppx, ppz, 4, 0, Math.PI*2); ctx2.fill();
  ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2;
  ctx2.beginPath();
  ctx2.moveTo(ppx, ppz);
  ctx2.lineTo(ppx + Math.sin(-playerYaw)*10, ppz - Math.cos(-playerYaw)*10);
  ctx2.stroke();
}

function applyFmTransform() {
  const c = fmInner.querySelector('#fmcanvas');
  const t = `translate(${fmOffX}px,${fmOffY}px) scale(${fmScale})`;
  fmCanvas.style.transform = t;
  fmPlayerDot.style.transform = t;
}

function toggleFullMap() {
  fmOpen = !fmOpen;
  fmOverlay.style.display = fmOpen ? 'flex' : 'none';
  if (fmOpen) updateFullMapPlayer();
}

// Zoom à la molette
fmOverlay.addEventListener('wheel', e => {
  e.preventDefault();
  const delta  = e.deltaY > 0 ? 0.85 : 1.18;
  fmScale = Math.max(0.5, Math.min(10, fmScale * delta));
  applyFmTransform();
}, {passive:false});

// Zoom pinch (iPad)
let fmPinchDist = null;
fmOverlay.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    fmPinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  } else if (e.touches.length === 1) {
    fmDragActive = true;
    fmDragSX = e.touches[0].clientX; fmDragSY = e.touches[0].clientY;
    fmDragOX = fmOffX;               fmDragOY = fmOffY;
  }
}, {passive:true});
fmOverlay.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 2 && fmPinchDist) {
    const newDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    fmScale = Math.max(0.5, Math.min(10, fmScale * (newDist / fmPinchDist)));
    fmPinchDist = newDist;
    applyFmTransform();
  } else if (e.touches.length === 1 && fmDragActive) {
    fmOffX = fmDragOX + (e.touches[0].clientX - fmDragSX);
    fmOffY = fmDragOY + (e.touches[0].clientY - fmDragSY);
    applyFmTransform();
  }
}, {passive:false});
fmOverlay.addEventListener('touchend', () => { fmDragActive=false; fmPinchDist=null; }, {passive:true});

// Drag souris
fmOverlay.addEventListener('mousedown', e => {
  if (e.target === document.getElementById('fmclose')) return;
  fmDragActive=true; fmDragSX=e.clientX; fmDragSY=e.clientY;
  fmDragOX=fmOffX; fmDragOY=fmOffY;
});
window.addEventListener('mousemove', e => {
  if (!fmDragActive) return;
  fmOffX = fmDragOX+(e.clientX-fmDragSX);
  fmOffY = fmDragOY+(e.clientY-fmDragSY);
  applyFmTransform();
});
window.addEventListener('mouseup', () => fmDragActive=false);

// Fermer
document.getElementById('fmclose').addEventListener('click', () => toggleFullMap());
document.addEventListener('keydown', e => { if (e.code==='KeyM') toggleFullMap(); });
mmCanvas.addEventListener('click', () => { toggleFullMap(); });

// Clic sur la fullmap → fermer aussi si on clique hors de la carte
fmOverlay.addEventListener('click', e => {
  if (e.target === fmOverlay) toggleFullMap();
});

// ══════════════════════════════════════════════════════════════
//  HUD + MINIMAP BASE (compatibilité avec mesh.js)
// ══════════════════════════════════════════════════════════════
/** Appelé par mesh.js après un rebuild → invalide la surface cache */
function updateMinimapBase() {
  surfCache.clear();
}

function updateHUD() {
  const p = camera.position;
  document.getElementById('hud').innerHTML =
    `X:${p.x.toFixed(0)}&nbsp;Y:${p.y.toFixed(0)}&nbsp;Z:${p.z.toFixed(0)}<br>` +
    `GRAINE:${currentSeed}`;
}
