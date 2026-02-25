'use strict';

// ══════════════════════════════════════════════════════════════
//  INTERFACE UTILISATEUR
// ══════════════════════════════════════════════════════════════

let selBlock = B.GRASS;

// ── Limite de construction ────────────────────────────────────
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
  HOTBAR.forEach((btype, i) => {
    const info = BINFO[btype] || { name:'?', icon:'', fb:[128,128,128] };
    const slot = document.createElement('div');
    slot.className = 'slot' + (btype === selBlock ? ' active' : '');
    slot.addEventListener('click', () => selectSlot(i));
    const ic = document.createElement('canvas');
    ic.width = ic.height = 28;
    drawBlockIcon(ic, btype);
    const lbl = document.createElement('span');
    lbl.textContent = info.name.toUpperCase().substring(0, 5);
    slot.appendChild(ic); slot.appendChild(lbl);
    hb.appendChild(slot);
  });
}

// Dessin d'icône — sécurisé pour les blocs sans entrée BINFO
function drawBlockIcon(canvas, btype) {
  try {
    const ctx = canvas.getContext('2d');
    const S   = canvas.width;
    ctx.clearRect(0, 0, S, S);
    const info = BINFO[btype] || null;
    const icon = info ? info.icon : '';
    const fb   = info ? info.fb : (FBCOL[blockMat(btype,0)] || [128,128,128]);
    const img  = icon ? texImages[icon] : null;
    if (img) { ctx.imageSmoothingEnabled=false; ctx.drawImage(img,0,0,S,S); return; }
    const [r,g,b] = fb;
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.beginPath();ctx.moveTo(S/2,1);ctx.lineTo(S-1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(1,S*.32);ctx.closePath();ctx.fill();
    ctx.fillStyle=`rgb(${r*.65|0},${g*.65|0},${b*.65|0})`;
    ctx.beginPath();ctx.moveTo(1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(S/2,S-1);ctx.lineTo(1,S*.68);ctx.closePath();ctx.fill();
    ctx.fillStyle=`rgb(${r*.82|0},${g*.82|0},${b*.82|0})`;
    ctx.beginPath();ctx.moveTo(S-1,S*.32);ctx.lineTo(S/2,S*.52);ctx.lineTo(S/2,S-1);ctx.lineTo(S-1,S*.68);ctx.closePath();ctx.fill();
  } catch(e) {}
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
//  MINIMAP — vue locale ±10 blocs
// ══════════════════════════════════════════════════════════════
const MM_RADIUS = 10;
const MM_SIZE   = 128;
const MM_SCALE  = MM_SIZE / (MM_RADIUS * 2);

const mmCanvas = document.getElementById('mm');
mmCanvas.width = mmCanvas.height = MM_SIZE;
const mmCtx = mmCanvas.getContext('2d');

const surfCache = new Map();

function getSurfColor(wx, wz) {
  const key = `${wx},${wz}`;
  if (surfCache.has(key)) return surfCache.get(key);
  let surf = B.AIR, surfY = 0;
  for (let wy = 45; wy >= 0; wy--) {
    const b = getB(wx, wy, wz);
    if (b && b !== B.AIR) { surf = b; surfY = wy; break; }
  }
  if (surf === B.AIR && getB(wx, SEA, wz) === B.WATER) { surf = B.WATER; surfY = SEA; }
  const col   = MMCOL[surf] || [80,80,80];
  const shade = 0.45 + 0.55 * Math.max(0, surfY) / 38;
  const result = [Math.min(255,col[0]*shade)|0, Math.min(255,col[1]*shade)|0, Math.min(255,col[2]*shade)|0];
  surfCache.set(key, result);
  return result;
}

function drawMinimap() {
  const px = Math.round(camera.position.x);
  const pz = Math.round(camera.position.z);
  const img = mmCtx.createImageData(MM_SIZE, MM_SIZE);
  for (let dz=-MM_RADIUS; dz<MM_RADIUS; dz++) {
    for (let dx=-MM_RADIUS; dx<MM_RADIUS; dx++) {
      const col = getSurfColor(px+dx, pz+dz);
      const sx0=Math.round((dx+MM_RADIUS)*MM_SCALE);
      const sz0=Math.round((dz+MM_RADIUS)*MM_SCALE);
      const sw =Math.round((dx+MM_RADIUS+1)*MM_SCALE)-sx0;
      const sh =Math.round((dz+MM_RADIUS+1)*MM_SCALE)-sz0;
      for (let py2=sz0;py2<sz0+sh&&py2<MM_SIZE;py2++)
        for (let px2=sx0;px2<sx0+sw&&px2<MM_SIZE;px2++) {
          const pi=(px2+py2*MM_SIZE)*4;
          img.data[pi]=col[0];img.data[pi+1]=col[1];img.data[pi+2]=col[2];img.data[pi+3]=255;
        }
    }
  }
  mmCtx.putImageData(img, 0, 0);
  const cx=MM_SIZE/2, cz=MM_SIZE/2;
  mmCtx.fillStyle='#ff2222';
  mmCtx.beginPath();mmCtx.arc(cx,cz,3.5,0,Math.PI*2);mmCtx.fill();
  mmCtx.strokeStyle='#fff';mmCtx.lineWidth=2;
  mmCtx.beginPath();mmCtx.moveTo(cx,cz);
  mmCtx.lineTo(cx+Math.sin(-playerYaw)*13,cz-Math.cos(-playerYaw)*13);
  mmCtx.stroke();
}

function invalidateSurfCache(wx, wz) { surfCache.delete(`${wx},${wz}`); }
function updateMinimapBase() { surfCache.clear(); }

// ══════════════════════════════════════════════════════════════
//  CARTE MONDE ENTIÈRE — M ou clic minimap
//  NOTE : z-index très élevé + transform:translateZ(0) pour
//  passer au-dessus du canvas WebGL sur Safari.
// ══════════════════════════════════════════════════════════════
const FM_SIZE = 512;

// Overlay avec styles inline forcés (contourne les bugs Safari WebGL overlay)
const fmOverlay = document.createElement('div');
fmOverlay.id = 'fmoverlay';
fmOverlay.style.cssText =
  'position:fixed;top:0;left:0;width:100%;height:100%;' +
  'background:rgba(0,0,0,0.82);display:none;' +
  'align-items:center;justify-content:center;flex-direction:column;' +
  'z-index:9000;transform:translateZ(0);';
document.body.appendChild(fmOverlay);

// Inner container
const fmInner = document.createElement('div');
fmInner.id = 'fminner';
fmInner.style.cssText =
  'position:relative;overflow:hidden;' +
  'width:min(90vw,90vh);height:min(90vw,90vh);' +
  'background:#000;border:3px solid rgba(255,255,255,0.4);' +
  'cursor:grab;user-select:none;-webkit-user-select:none;';
fmOverlay.appendChild(fmInner);

// Canvas carte
const fmCanvas = document.createElement('canvas');
fmCanvas.width = fmCanvas.height = FM_SIZE;
fmCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;image-rendering:pixelated;transform-origin:center;';
fmInner.appendChild(fmCanvas);

// Canvas overlay joueur (séparé pour ne pas redessiner la carte entière)
const fmDot = document.createElement('canvas');
fmDot.width = fmDot.height = FM_SIZE;
fmDot.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;transform-origin:center;';
fmInner.appendChild(fmDot);

// Bouton fermer
const fmClose = document.createElement('div');
fmClose.id = 'fmclose';
fmClose.textContent = '✕  FERMER (M)';
fmInner.appendChild(fmClose);

// Hint
const fmHintEl = document.createElement('div');
fmHintEl.id = 'fmhint';
fmHintEl.textContent = 'Molette = zoom · Glisser = déplacer';
fmOverlay.appendChild(fmHintEl);

const fmCtx    = fmCanvas.getContext('2d');
const fmDotCtx = fmDot.getContext('2d');
let fmOpen = false;
let fmScale=1, fmOffX=0, fmOffY=0;
let fmDrag=false, fmDragSX, fmDragSY, fmDragOX, fmDragOY;
let fmPinchDist=null;

function generateFullMap() {
  const bpp = (WORLD_RADIUS*2)/FM_SIZE;
  const img = fmCtx.createImageData(FM_SIZE,FM_SIZE);
  for (let pz=0;pz<FM_SIZE;pz++) for (let px=0;px<FM_SIZE;px++) {
    const wx=Math.round((px-FM_SIZE/2)*bpp);
    const wz=Math.round((pz-FM_SIZE/2)*bpp);
    const h=getTerrainHeightFast(wx,wz);
    let block;
    if (Math.abs(wx)>WORLD_RADIUS-150||Math.abs(wz)>WORLD_RADIUS-150) block=B.STONE;
    else if (h<SEA) block=B.WATER; else if (h<=SEA+1) block=B.SAND;
    else if (h>26) block=B.SNOW;  else if (h>22) block=B.STONE;
    else block=B.GRASS;
    const col=MMCOL[block]||[80,80,80];
    const shade=0.4+0.6*Math.max(0,Math.min(h,38))/38;
    const pi=(px+pz*FM_SIZE)*4;
    img.data[pi]=Math.min(255,col[0]*shade)|0;
    img.data[pi+1]=Math.min(255,col[1]*shade)|0;
    img.data[pi+2]=Math.min(255,col[2]*shade)|0;
    img.data[pi+3]=255;
  }
  fmCtx.putImageData(img,0,0);
}

function updateFullMapPlayer() {
  if (!fmOpen) return;
  fmDotCtx.clearRect(0,0,FM_SIZE,FM_SIZE);
  const bpp=(WORLD_RADIUS*2)/FM_SIZE;
  const ppx=FM_SIZE/2+camera.position.x/bpp;
  const ppz=FM_SIZE/2+camera.position.z/bpp;
  fmDotCtx.fillStyle='#ff3333';
  fmDotCtx.beginPath();fmDotCtx.arc(ppx,ppz,5,0,Math.PI*2);fmDotCtx.fill();
  fmDotCtx.strokeStyle='#fff';fmDotCtx.lineWidth=2;
  fmDotCtx.beginPath();fmDotCtx.moveTo(ppx,ppz);
  fmDotCtx.lineTo(ppx+Math.sin(-playerYaw)*12,ppz-Math.cos(-playerYaw)*12);
  fmDotCtx.stroke();
}

function applyFmTransform() {
  const t=`translate(${fmOffX}px,${fmOffY}px) scale(${fmScale})`;
  fmCanvas.style.transform=t; fmDot.style.transform=t;
}

function toggleFullMap() {
  fmOpen=!fmOpen;
  fmOverlay.style.display=fmOpen?'flex':'none';
  if (fmOpen) { fmScale=1;fmOffX=0;fmOffY=0; applyFmTransform(); updateFullMapPlayer(); }
}

// Zoom molette
fmOverlay.addEventListener('wheel',e=>{
  e.preventDefault();
  fmScale=Math.max(0.5,Math.min(10,fmScale*(e.deltaY>0?0.85:1.18)));
  applyFmTransform();
},{passive:false});

// Pinch iPad
fmOverlay.addEventListener('touchstart',e=>{
  if (e.touches.length===2) fmPinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  else if (e.touches.length===1){fmDrag=true;fmDragSX=e.touches[0].clientX;fmDragSY=e.touches[0].clientY;fmDragOX=fmOffX;fmDragOY=fmOffY;}
},{passive:true});
fmOverlay.addEventListener('touchmove',e=>{
  e.preventDefault();
  if (e.touches.length===2&&fmPinchDist){const nd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);fmScale=Math.max(0.5,Math.min(10,fmScale*(nd/fmPinchDist)));fmPinchDist=nd;applyFmTransform();}
  else if (e.touches.length===1&&fmDrag){fmOffX=fmDragOX+(e.touches[0].clientX-fmDragSX);fmOffY=fmDragOY+(e.touches[0].clientY-fmDragSY);applyFmTransform();}
},{passive:false});
fmOverlay.addEventListener('touchend',()=>{fmDrag=false;fmPinchDist=null;},{passive:true});

// Drag souris
fmInner.addEventListener('mousedown',e=>{if(e.target===fmClose)return;fmDrag=true;fmDragSX=e.clientX;fmDragSY=e.clientY;fmDragOX=fmOffX;fmDragOY=fmOffY;fmInner.style.cursor='grabbing';});
window.addEventListener('mousemove',e=>{if(!fmDrag||!fmOpen)return;fmOffX=fmDragOX+(e.clientX-fmDragSX);fmOffY=fmDragOY+(e.clientY-fmDragSY);applyFmTransform();});
window.addEventListener('mouseup',()=>{fmDrag=false;if(fmInner)fmInner.style.cursor='grab';});

// Fermer
fmClose.addEventListener('click',()=>toggleFullMap());
fmOverlay.addEventListener('click',e=>{if(e.target===fmOverlay)toggleFullMap();});

document.getElementById('mm').addEventListener('click',()=>toggleFullMap());

// ── HUD ──────────────────────────────────────────────────────
function updateHUD() {
  const p=camera.position;
  document.getElementById('hud').innerHTML=
    `X:${p.x.toFixed(0)}&nbsp;Y:${p.y.toFixed(0)}&nbsp;Z:${p.z.toFixed(0)}<br>GRAINE:${currentSeed}`;
}
