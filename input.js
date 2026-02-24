'use strict';

// ══════════════════════════════════════════════════════════════
//  GESTION DES ENTRÉES
// ══════════════════════════════════════════════════════════════

let joyX = 0, joyY = 0;
let joyTouchId  = null;
let lookTouchId = null;
let lookPX = 0, lookPY = 0;

const keys  = {};
const jbase = document.getElementById('jbase');
const jknob = document.getElementById('jknob');
const JR    = 46;

// ── Touch ─────────────────────────────────────────────────────
document.addEventListener('touchstart',  onTouchStart,  { passive:false });
document.addEventListener('touchmove',   onTouchMove,   { passive:false });
document.addEventListener('touchend',    onTouchEnd,    { passive:false });
document.addEventListener('touchcancel', onTouchEnd,    { passive:false });

function onTouchStart(e) {
  if (chatOpen || inventoryOpen) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const tx=t.clientX, ty=t.clientY, W=window.innerWidth, H=window.innerHeight;
    const el = document.elementFromPoint(tx, ty);
    if (el && (el.id==='abtn-break'||el.id==='abtn-place'||el.id==='abtn-jump'||el.closest?.('.slot'))) continue;
    if (joyTouchId===null && tx<W*0.42 && ty>H*0.42) {
      joyTouchId = t.identifier; moveJoy(t);
    } else if (lookTouchId===null && tx>W*0.35) {
      lookTouchId=t.identifier; lookPX=tx; lookPY=ty;
    }
  }
}

function onTouchMove(e) {
  if (chatOpen || inventoryOpen) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier===joyTouchId) moveJoy(t);
    if (t.identifier===lookTouchId) {
      playerYaw  -=(t.clientX-lookPX)*0.0038;
      playerPitch-=(t.clientY-lookPY)*0.0038;
      playerPitch = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, playerPitch));
      lookPX=t.clientX; lookPY=t.clientY;
    }
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier===joyTouchId) { joyTouchId=null; joyX=0; joyY=0; jknob.style.transform='translate(-50%,-50%)'; }
    if (t.identifier===lookTouchId) lookTouchId=null;
  }
}

function moveJoy(t) {
  const r=jbase.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  let dx=t.clientX-cx, dy=t.clientY-cy;
  const len=Math.hypot(dx,dy);
  if(len>JR){dx=dx/len*JR;dy=dy/len*JR;}
  joyX=dx/JR; joyY=dy/JR;
  jknob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}

// ── Boutons tactiles ──────────────────────────────────────────
document.getElementById('abtn-break').addEventListener('touchstart',e=>{e.preventDefault();if(!chatOpen&&!inventoryOpen)doBreak();},{passive:false});
document.getElementById('abtn-place').addEventListener('touchstart',e=>{e.preventDefault();if(!chatOpen&&!inventoryOpen)doPlace();},{passive:false});
document.getElementById('abtn-jump') .addEventListener('touchstart',e=>{e.preventDefault();if(!chatOpen&&!inventoryOpen&&onGround){velY=JVEL;onGround=false;}},{passive:false});

// ── Clavier (bubbling phase – après chat.js et inventory.js en capture) ──
document.addEventListener('keydown', e => {
  // Bloqué si chat ou inventaire ouverts (géré par chat.js / inventory.js en capture)
  if (chatOpen || inventoryOpen) { keys[e.code] = false; return; }

  keys[e.code] = true;

  const n = parseInt(e.key);
  if (n >= 1 && n <= 8) { selectSlot(n-1); return; }

  if (e.code === 'Space') {
    e.preventDefault();
    if (onGround) { velY=JVEL; onGround=false; }
  }
});

document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('wheel', e => {
  if (chatOpen || inventoryOpen) return;
  let i = HOTBAR.indexOf(selBlock);
  i = (i+(e.deltaY>0?1:-1)+HOTBAR.length)%HOTBAR.length;
  selectSlot(i);
});

// ── Souris desktop ────────────────────────────────────────────
const canvas = document.getElementById('c');
canvas.addEventListener('click', () => {
  if (!chatOpen && !inventoryOpen) canvas.requestPointerLock?.();
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement!==canvas) return;
  playerYaw  -=e.movementX*0.002;
  playerPitch-=e.movementY*0.002;
  playerPitch = Math.max(-Math.PI/2+0.05, Math.min(Math.PI/2-0.05, playerPitch));
});
canvas.addEventListener('mousedown', e => {
  if (document.pointerLockElement!==canvas||chatOpen||inventoryOpen) return;
  e.button===0 ? doBreak() : doPlace();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
