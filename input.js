'use strict';
// ══════════════════════════════════════════════════════════════
//  GESTION DES ENTRÉES — SOURCE UNIQUE DE VÉRITÉ POUR LE CLAVIER
// ══════════════════════════════════════════════════════════════

let joyX = 0, joyY = 0;
let joyTouchId = null, lookTouchId = null;
let lookPX = 0, lookPY = 0;
const keys   = {};
const jbase  = document.getElementById('jbase');
const jknob  = document.getElementById('jknob');
const JR     = 46;
const canvas = document.getElementById('c');

// ── Touch ─────────────────────────────────────────────────────
document.addEventListener('touchstart', e => {
  if (chatOpen || inventoryOpen) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const tx=t.clientX,ty=t.clientY,W=window.innerWidth,H=window.innerHeight;
    const el=document.elementFromPoint(tx,ty);
    if (el&&(el.id==='abtn-break'||el.id==='abtn-place'||el.id==='abtn-jump'||el.closest?.('.slot'))) continue;
    if (joyTouchId===null&&tx<W*0.42&&ty>H*0.42) { joyTouchId=t.identifier; moveJoy(t); }
    else if (lookTouchId===null&&tx>W*0.35) { lookTouchId=t.identifier; lookPX=tx; lookPY=ty; }
  }
}, {passive:false});

document.addEventListener('touchmove', e => {
  if (chatOpen||inventoryOpen) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier===joyTouchId) moveJoy(t);
    if (t.identifier===lookTouchId) {
      playerYaw  -=(t.clientX-lookPX)*0.0038;
      playerPitch-=(t.clientY-lookPY)*0.0038;
      playerPitch=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,playerPitch));
      lookPX=t.clientX; lookPY=t.clientY;
    }
  }
}, {passive:false});

document.addEventListener('touchend', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier===joyTouchId){joyTouchId=null;joyX=0;joyY=0;jknob.style.transform='translate(-50%,-50%)';}
    if (t.identifier===lookTouchId) lookTouchId=null;
  }
}, {passive:false});
document.addEventListener('touchcancel', e => {
  joyTouchId=null; lookTouchId=null; joyX=0; joyY=0;
  jknob.style.transform='translate(-50%,-50%)';
}, {passive:false});

function moveJoy(t) {
  const r=jbase.getBoundingClientRect();
  let dx=t.clientX-r.left-r.width/2, dy=t.clientY-r.top-r.height/2;
  const len=Math.hypot(dx,dy);
  if(len>JR){dx=dx/len*JR;dy=dy/len*JR;}
  joyX=dx/JR; joyY=dy/JR;
  jknob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}

// ── Boutons tactiles ──────────────────────────────────────────
document.getElementById('abtn-break').addEventListener('touchstart',e=>{
  e.preventDefault(); if(!chatOpen&&!inventoryOpen) doBreak();
},{passive:false});
document.getElementById('abtn-place').addEventListener('touchstart',e=>{
  e.preventDefault(); if(!chatOpen&&!inventoryOpen) doPlace();
},{passive:false});
document.getElementById('abtn-jump').addEventListener('touchstart',e=>{
  e.preventDefault(); if(!chatOpen&&!inventoryOpen&&onGround){velY=JVEL;onGround=false;}
},{passive:false});

// ══════════════════════════════════════════════════════════════
//  CLAVIER — UNIQUE LISTENER SUR DOCUMENT
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {

  // ── Si l'input de chat a le focus, on ne touche à rien ──────
  // chat.js gère Enter/Escape directement sur l'input avec stopPropagation
  // Donc si on arrive ici pendant chat ouvert, c'est un autre élément
  if (chatOpen) { keys[e.code]=false; return; }

  // ── Inventaire ouvert ────────────────────────────────────────
  if (inventoryOpen) {
    if (e.code==='KeyE'||e.code==='Escape') { e.preventDefault(); closeInventory(); }
    keys[e.code]=false;
    return;
  }

  // ── Jeu normal ───────────────────────────────────────────────
  // Ouvrir chat
  if (e.code==='KeyC') { e.preventDefault(); openChat(); return; }

  // Ouvrir inventaire
  if (e.code==='KeyE') { e.preventDefault(); openInventory(); return; }

  // Carte monde
  if (e.code==='KeyM') { e.preventDefault(); toggleFullMap(); return; }

  // Slot hotbar
  const n=parseInt(e.key);
  if (n>=1&&n<=8) { selectSlot(n-1); return; }

  // Saut
  if (e.code==='Space') {
    e.preventDefault();
    if (onGround){velY=JVEL;onGround=false;}
    return;
  }

  keys[e.code]=true;
});

document.addEventListener('keyup', e => { keys[e.code]=false; });

document.addEventListener('wheel', e => {
  if (chatOpen||inventoryOpen) return;
  let i=HOTBAR.indexOf(selBlock);
  i=(i+(e.deltaY>0?1:-1)+HOTBAR.length)%HOTBAR.length;
  selectSlot(i);
});

// ── Souris (pointer lock) ─────────────────────────────────────
canvas.addEventListener('click', () => {
  if (!chatOpen&&!inventoryOpen) canvas.requestPointerLock?.();
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement!==canvas) return;
  playerYaw  -=e.movementX*0.002;
  playerPitch-=e.movementY*0.002;
  playerPitch=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,playerPitch));
});
canvas.addEventListener('mousedown', e => {
  if (document.pointerLockElement!==canvas||chatOpen||inventoryOpen) return;
  e.button===0?doBreak():doPlace();
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
