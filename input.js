'use strict';

// ══════════════════════════════════════════════════════════════
//  GESTION DES ENTRÉES
// ══════════════════════════════════════════════════════════════

// ── État du joystick ──────────────────────────────────────────
/**
 * joyX : axe horizontal  (-1 = gauche,  +1 = droite)
 * joyY : axe vertical    (-1 = haut/avant, +1 = bas/arrière)
 *        Note : physics.js soustrait joyY pour avancer quand on pousse en haut.
 */
let joyX = 0, joyY = 0;
let joyTouchId  = null;  // identifiant du doigt sur le joystick
let lookTouchId = null;  // identifiant du doigt sur la zone de regard
let lookPX = 0, lookPY = 0;

// ── État du clavier ───────────────────────────────────────────
const keys = {};

// ── Éléments DOM ─────────────────────────────────────────────
const jbase = document.getElementById('jbase');
const jknob = document.getElementById('jknob');
const JR    = 46; // rayon du joystick en pixels

// ══════════════════════════════════════════════════════════════
//  TOUCH  –  Handler document-level unifié
//  (évite les problèmes de zone quand le doigt glisse hors de l'élément)
// ══════════════════════════════════════════════════════════════
document.addEventListener('touchstart',  onTouchStart,  { passive: false });
document.addEventListener('touchmove',   onTouchMove,   { passive: false });
document.addEventListener('touchend',    onTouchEnd,    { passive: false });
document.addEventListener('touchcancel', onTouchEnd,    { passive: false });

function onTouchStart(e) {
  e.preventDefault();

  for (const t of e.changedTouches) {
    const tx = t.clientX, ty = t.clientY;
    const W  = window.innerWidth, H = window.innerHeight;

    // Ignorer les touches sur les boutons dédiés et la hotbar
    const el = document.elementFromPoint(tx, ty);
    if (el && (
      el.id === 'abtn-break' ||
      el.id === 'abtn-place' ||
      el.id === 'abtn-jump'  ||
      el.closest?.('.slot')
    )) continue;

    // Zone joystick : 42 % gauche × 58 % bas de l'écran
    if (joyTouchId === null && tx < W * 0.42 && ty > H * 0.42) {
      joyTouchId = t.identifier;
      moveJoy(t);

    // Zone de regard : tout le reste (droite de l'écran)
    } else if (lookTouchId === null && tx > W * 0.35) {
      lookTouchId = t.identifier;
      lookPX = tx;
      lookPY = ty;
    }
  }
}

function onTouchMove(e) {
  e.preventDefault();

  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      moveJoy(t);
    }

    if (t.identifier === lookTouchId) {
      const dx = t.clientX - lookPX;
      const dy = t.clientY - lookPY;
      playerYaw   -= dx * 0.0038;
      playerPitch -= dy * 0.0038;
      playerPitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, playerPitch));
      lookPX = t.clientX;
      lookPY = t.clientY;
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();

  for (const t of e.changedTouches) {
    if (t.identifier === joyTouchId) {
      joyTouchId = null;
      joyX = 0; joyY = 0;
      jknob.style.transform = 'translate(-50%, -50%)';
    }
    if (t.identifier === lookTouchId) {
      lookTouchId = null;
    }
  }
}

/**
 * Met à jour joyX/joyY et la position visuelle du knob.
 * Déplacement clampé au rayon JR.
 */
function moveJoy(t) {
  const r  = jbase.getBoundingClientRect();
  const cx = r.left + r.width  / 2;
  const cy = r.top  + r.height / 2;
  let dx = t.clientX - cx;
  let dy = t.clientY - cy;
  const len = Math.hypot(dx, dy);
  if (len > JR) { dx = dx / len * JR; dy = dy / len * JR; }
  joyX = dx / JR;
  joyY = dy / JR; // positif = vers le bas = reculer (inversé dans physics.js)
  jknob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// ══════════════════════════════════════════════════════════════
//  BOUTONS D'ACTION TACTILES
// ══════════════════════════════════════════════════════════════
document.getElementById('abtn-break').addEventListener('touchstart', e => {
  e.preventDefault();
  doBreak(); // défini dans game.js
}, { passive: false });

document.getElementById('abtn-place').addEventListener('touchstart', e => {
  e.preventDefault();
  doPlace(); // défini dans game.js
}, { passive: false });

document.getElementById('abtn-jump').addEventListener('touchstart', e => {
  e.preventDefault();
  if (onGround) { velY = JVEL; onGround = false; }
}, { passive: false });

// ══════════════════════════════════════════════════════════════
//  CLAVIER
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  keys[e.code] = true;

  // Sélection de slot par chiffre (1–8)
  const n = parseInt(e.key);
  if (n >= 1 && n <= 8) { selectSlot(n - 1); return; } // défini dans ui.js

  // Saut
  if (e.code === 'Space') {
    e.preventDefault();
    if (onGround) { velY = JVEL; onGround = false; }
  }
});

document.addEventListener('keyup', e => {
  keys[e.code] = false;
});

// Molette : faire défiler la hotbar
document.addEventListener('wheel', e => {
  let i = HOTBAR.indexOf(selBlock); // selBlock défini dans ui.js
  i = (i + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
  selectSlot(i);
});

// ══════════════════════════════════════════════════════════════
//  SOURIS (desktop – nécessite Pointer Lock)
// ══════════════════════════════════════════════════════════════
const canvas = document.getElementById('c');

// Clic sur le canvas → demander le verrouillage du pointeur
canvas.addEventListener('click', () => {
  canvas.requestPointerLock?.();
});

// Rotation de la caméra quand le pointeur est verrouillé
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  playerYaw   -= e.movementX * 0.002;
  playerPitch -= e.movementY * 0.002;
  playerPitch  = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, playerPitch));
});

// Clic gauche = casser, clic droit = poser
canvas.addEventListener('mousedown', e => {
  if (document.pointerLockElement !== canvas) return;
  e.button === 0 ? doBreak() : doPlace();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());
