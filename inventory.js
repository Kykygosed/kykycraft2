'use strict';
// ══════════════════════════════════════════════════════════════
//  INVENTAIRE — aucun listener clavier ici, tout dans input.js
// ══════════════════════════════════════════════════════════════

let inventoryOpen = false;

const ALL_BLOCKS = [
  B.GRASS, B.DIRT, B.STONE, B.WOOD, B.LEAVES,
  B.SAND, B.SNOW, B.BRICK, B.GRAVEL, B.WATER
];
const NON_PLACEABLE = new Set([B.WATER]);

// ── Création overlay ──────────────────────────────────────────
const invOverlay = document.createElement('div');
invOverlay.style.cssText =
  'position:fixed;top:0;left:0;width:100%;height:100%;' +
  'background:rgba(0,0,0,0.75);display:none;' +
  'align-items:center;justify-content:center;z-index:300;';
document.body.appendChild(invOverlay);

const invPanel = document.createElement('div');
invPanel.style.cssText =
  'background:rgba(28,28,28,0.97);padding:20px 18px;' +
  'border:3px solid rgba(255,255,255,0.25);' +
  'max-width:480px;width:min(92vw,480px);';
invOverlay.appendChild(invPanel);

const invTitle = document.createElement('div');
invTitle.textContent = 'INVENTAIRE';
invTitle.style.cssText =
  'font-family:"Press Start 2P",monospace;font-size:12px;color:#fff;' +
  'text-shadow:2px 2px 0 #000;text-align:center;margin-bottom:16px;letter-spacing:2px;';
invPanel.appendChild(invTitle);

const invGrid = document.createElement('div');
invGrid.style.cssText =
  'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:14px;';
invPanel.appendChild(invGrid);

const invHint = document.createElement('div');
invHint.textContent = 'Clic = sélectionner  ·  E ou Échap = fermer';
invHint.style.cssText =
  'font-family:"Press Start 2P",monospace;font-size:5px;' +
  'color:rgba(255,255,255,0.4);text-align:center;';
invPanel.appendChild(invHint);

// ── Grille ────────────────────────────────────────────────────
function buildInventoryGrid() {
  invGrid.innerHTML = '';
  ALL_BLOCKS.forEach(btype => {
    const info = BINFO[btype] || { name:'?', icon:'', fb:[80,80,80] };
    const placeable = !NON_PLACEABLE.has(btype);

    const cell = document.createElement('div');
    cell.title = info.name;
    cell.style.cssText =
      'display:flex;flex-direction:column;align-items:center;padding:8px 4px 5px;' +
      'background:rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.18);' +
      (placeable ? 'cursor:pointer;' : 'opacity:0.35;cursor:not-allowed;');

    const ic = document.createElement('canvas');
    ic.width = ic.height = 40;
    ic.style.imageRendering = 'pixelated';
    drawBlockIcon(ic, btype);

    const lbl = document.createElement('div');
    lbl.textContent = info.name.toUpperCase();
    lbl.style.cssText =
      'font-family:"Press Start 2P",monospace;font-size:4px;' +
      'color:#ccc;text-shadow:1px 1px 0 #000;margin-top:4px;text-align:center;';

    cell.appendChild(ic);
    cell.appendChild(lbl);

    if (placeable) {
      cell.addEventListener('mouseover', () => cell.style.background = 'rgba(255,255,255,0.18)');
      cell.addEventListener('mouseout',  () => cell.style.background = 'rgba(0,0,0,0.4)');
      cell.addEventListener('click', () => {
        const i = HOTBAR.indexOf(btype);
        if (i !== -1) selectSlot(i);
        else { selBlock = btype; showToast(info.name); }
        closeInventory();
      });
    }
    invGrid.appendChild(cell);
  });
}

// ── Open / Close ──────────────────────────────────────────────
function openInventory() {
  inventoryOpen = true;
  buildInventoryGrid();
  invOverlay.style.display = 'flex';
}
function closeInventory() {
  inventoryOpen = false;
  invOverlay.style.display = 'none';
}

// Clic fond
invOverlay.addEventListener('click', e => {
  if (e.target === invOverlay) closeInventory();
});
