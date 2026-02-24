'use strict';

// ══════════════════════════════════════════════════════════════
//  INVENTAIRE  —  touche E
//  Affiche tous les blocs du jeu ; clic = équipper dans la hotbar
// ══════════════════════════════════════════════════════════════

let inventoryOpen = false;

// Tous les blocs disponibles (y compris non-hotbar, grisés)
const ALL_BLOCKS = [
  B.GRASS, B.DIRT, B.STONE, B.WOOD, B.LEAVES,
  B.SAND, B.SNOW, B.BRICK, B.GRAVEL, B.WATER
];

// Blocs non-plaçables (affichés grisés)
const NON_PLACEABLE = new Set([B.WATER]);

// ── Création DOM ──────────────────────────────────────────────
const invOverlay = document.createElement('div');
invOverlay.id = 'inv-overlay';
document.body.appendChild(invOverlay);

invOverlay.innerHTML = `
  <div id="inv-panel">
    <div id="inv-title">INVENTAIRE</div>
    <div id="inv-grid"></div>
    <div id="inv-hint">Clic = sélectionner · E ou Échap = fermer</div>
  </div>`;

const invGrid = document.getElementById('inv-grid');

// ── Remplissage de la grille ──────────────────────────────────
function buildInventoryGrid() {
  invGrid.innerHTML = '';

  ALL_BLOCKS.forEach(btype => {
    const info = BINFO[btype] || { name: 'Eau', icon: '', fb: [48,108,200] };
    const placeable = !NON_PLACEABLE.has(btype);

    const cell = document.createElement('div');
    cell.className = 'inv-cell' + (placeable ? '' : ' inv-disabled');
    cell.title = info.name;

    const ic = document.createElement('canvas');
    ic.width = ic.height = 40;
    drawBlockIcon(ic, btype); // défini dans ui.js

    const lbl = document.createElement('div');
    lbl.className = 'inv-lbl';
    lbl.textContent = info.name.toUpperCase();

    cell.appendChild(ic);
    cell.appendChild(lbl);

    if (placeable) {
      cell.addEventListener('click', () => {
        // Mettre dans la hotbar à la position sélectionnée,
        // ou simplement changer selBlock
        const i = HOTBAR.indexOf(btype);
        if (i !== -1) {
          selectSlot(i); // défini dans ui.js
        } else {
          // Bloc pas dans la hotbar : forcer selBlock
          selBlock = btype;
        }
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

// ── Clavier ───────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (chatOpen) return;

  if ((e.code === 'KeyE') && !inventoryOpen) {
    e.preventDefault();
    openInventory();
    return;
  }
  if (inventoryOpen && (e.code === 'KeyE' || e.code === 'Escape')) {
    e.preventDefault();
    closeInventory();
  }
}, true);

// Fermer en cliquant sur le fond
invOverlay.addEventListener('click', e => {
  if (e.target === invOverlay) closeInventory();
});
