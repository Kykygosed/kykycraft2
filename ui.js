'use strict';

// ══════════════════════════════════════════════════════════════
//  INTERFACE UTILISATEUR
// ══════════════════════════════════════════════════════════════

/** Bloc actuellement sélectionné dans la hotbar */
let selBlock = B.GRASS;

// ══════════════════════════════════════════════════════════════
//  HOTBAR
// ══════════════════════════════════════════════════════════════

/**
 * Construit ou reconstruit les slots de la hotbar.
 * Appelé une fois au démarrage (après le chargement des textures).
 */
function buildHotbar() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';

  HOTBAR.forEach((blockType, i) => {
    const info = BINFO[blockType];

    const slot = document.createElement('div');
    slot.className = 'slot' + (blockType === selBlock ? ' active' : '');
    slot.addEventListener('click', () => selectSlot(i));

    // Icône 2D du bloc
    const ic = document.createElement('canvas');
    ic.width  = 28;
    ic.height = 28;
    drawBlockIcon(ic, blockType);

    // Label court
    const lbl = document.createElement('span');
    lbl.textContent = info.name.toUpperCase().substring(0, 5);

    slot.appendChild(ic);
    slot.appendChild(lbl);
    hb.appendChild(slot);
  });
}

/**
 * Dessine l'icône isométrique d'un bloc dans un <canvas> 2D.
 * Si la texture PNG est disponible, on l'affiche à plat.
 * Sinon, on dessine un cube isométrique coloré.
 */
function drawBlockIcon(canvas, blockType) {
  const ctx  = canvas.getContext('2d');
  const S    = canvas.width;
  const info = BINFO[blockType];

  ctx.clearRect(0, 0, S, S);

  const img = texImages[info.icon]; // texImages défini dans textures.js
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, S, S);
    return;
  }

  // Cube isométrique de repli
  const [r, g, b] = info.fb;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.moveTo(S/2, 1); ctx.lineTo(S-1, S*.32); ctx.lineTo(S/2, S*.52); ctx.lineTo(1, S*.32);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = `rgb(${Math.floor(r*.65)},${Math.floor(g*.65)},${Math.floor(b*.65)})`;
  ctx.beginPath();
  ctx.moveTo(1, S*.32); ctx.lineTo(S/2, S*.52); ctx.lineTo(S/2, S-1); ctx.lineTo(1, S*.68);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = `rgb(${Math.floor(r*.82)},${Math.floor(g*.82)},${Math.floor(b*.82)})`;
  ctx.beginPath();
  ctx.moveTo(S-1, S*.32); ctx.lineTo(S/2, S*.52); ctx.lineTo(S/2, S-1); ctx.lineTo(S-1, S*.68);
  ctx.closePath(); ctx.fill();
}

/**
 * Sélectionne le slot i de la hotbar.
 * Met à jour selBlock, l'état visuel des slots et affiche un toast.
 */
function selectSlot(i) {
  selBlock = HOTBAR[i];
  document.querySelectorAll('.slot').forEach((s, j) => {
    s.classList.toggle('active', j === i);
  });
  showToast(BINFO[selBlock]?.name || '');
}

// ══════════════════════════════════════════════════════════════
//  TOAST (notification temporaire)
// ══════════════════════════════════════════════════════════════
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('on'), 1300);
}

// ══════════════════════════════════════════════════════════════
//  MINIMAP
//  Stratégie : canvas offscreen (base sans joueur) mis à jour seulement
//  quand le monde change ; la position du joueur est dessinée chaque frame.
// ══════════════════════════════════════════════════════════════
const mmCanvas = document.getElementById('mm');
mmCanvas.width  = WW;  // 1 pixel = 1 colonne de blocs
mmCanvas.height = WD;
const mmCtx = mmCanvas.getContext('2d');

/** Canvas offscreen : base de la minimap (sans le point joueur) */
const offCanvas = document.createElement('canvas');
offCanvas.width  = WW;
offCanvas.height = WD;
const offCtx = offCanvas.getContext('2d');

/**
 * Reconstruit la base de la minimap (coûteux, appelé uniquement
 * après un changement du monde ou une nouvelle génération).
 */
function updateMinimapBase() {
  const img = offCtx.createImageData(WW, WD);

  for (let z = 0; z < WD; z++) {
    for (let x = 0; x < WW; x++) {
      // Bloc de surface (le plus haut non-AIR)
      let surf = B.AIR, surfY = 0;
      for (let y = WH - 1; y >= 0; y--) {
        const b = getB(x, y, z);
        if (b) { surf = b; surfY = y; break; }
      }

      const col   = MMCOL[surf] || [80, 80, 80];
      // Ombrage basé sur l'altitude (plus clair = plus haut)
      const shade = 0.45 + 0.55 * (surfY / (WH - 1));
      const pi    = (x + z * WW) * 4;

      img.data[pi + 0] = Math.min(255, col[0] * shade);
      img.data[pi + 1] = Math.min(255, col[1] * shade);
      img.data[pi + 2] = Math.min(255, col[2] * shade);
      img.data[pi + 3] = 255;
    }
  }
  offCtx.putImageData(img, 0, 0);
}

/**
 * Dessine la minimap complète (base + point joueur + flèche de direction).
 * Appelé chaque frame.
 */
function drawMinimap() {
  // 1. Copier la base
  mmCtx.drawImage(offCanvas, 0, 0);

  const px = Math.round(camera.position.x);
  const pz = Math.round(camera.position.z);

  // 2. Point rouge = joueur
  mmCtx.fillStyle = '#ff2222';
  mmCtx.beginPath();
  mmCtx.arc(px, pz, 2, 0, Math.PI * 2);
  mmCtx.fill();

  // 3. Flèche = direction du regard
  mmCtx.strokeStyle = '#ffffff';
  mmCtx.lineWidth   = 1.5;
  mmCtx.beginPath();
  mmCtx.moveTo(px, pz);
  mmCtx.lineTo(
    px + Math.sin(-playerYaw) * 7,  // playerYaw défini dans physics.js
    pz - Math.cos(-playerYaw) * 7
  );
  mmCtx.stroke();
}

// ══════════════════════════════════════════════════════════════
//  HUD (coordonnées + graine)
// ══════════════════════════════════════════════════════════════
function updateHUD() {
  const p = camera.position;
  document.getElementById('hud').innerHTML =
    `X:${p.x.toFixed(0)}&nbsp;Y:${p.y.toFixed(0)}&nbsp;Z:${p.z.toFixed(0)}<br>` +
    `GRAINE:${currentSeed}`; // currentSeed défini dans game.js
}
