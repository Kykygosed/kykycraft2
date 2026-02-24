'use strict';

// ══════════════════════════════════════════════════════════════
//  RAYCASTER DDA
// ══════════════════════════════════════════════════════════════
let targetBlock = null, targetFace = null;

function dda() {
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  const o   = camera.position;
  let ix=Math.floor(o.x), iy=Math.floor(o.y), iz=Math.floor(o.z);
  const sx=dir.x>=0?1:-1, sy=dir.y>=0?1:-1, sz=dir.z>=0?1:-1;
  const txD=Math.abs(dir.x)<1e-8?1e30:1/Math.abs(dir.x);
  const tyD=Math.abs(dir.y)<1e-8?1e30:1/Math.abs(dir.y);
  const tzD=Math.abs(dir.z)<1e-8?1e30:1/Math.abs(dir.z);
  let txM=dir.x>=0?(ix+1-o.x)*txD:(o.x-ix)*txD;
  let tyM=dir.y>=0?(iy+1-o.y)*tyD:(o.y-iy)*tyD;
  let tzM=dir.z>=0?(iz+1-o.z)*tzD:(o.z-iz)*tzD;
  let fn=[0,0,0], dist=0;

  for (let i=0; i<128; i++) {
    const b = getB(ix,iy,iz);
    if (b>0 && b!==B.WATER) {
      targetBlock=[ix,iy,iz]; targetFace=[...fn];
      selBox.position.set(ix+0.5,iy+0.5,iz+0.5);
      selBox.visible=true; return;
    }
    if (txM<tyM&&txM<tzM) {
      dist=txM; if(dist>REACH)break; ix+=sx; fn=[-sx,0,0]; txM+=txD;
    } else if (tyM<tzM) {
      dist=tyM; if(dist>REACH)break; iy+=sy; fn=[0,-sy,0]; tyM+=tyD;
    } else {
      dist=tzM; if(dist>REACH)break; iz+=sz; fn=[0,0,-sz]; tzM+=tzD;
    }
  }
  targetBlock=null; targetFace=null; selBox.visible=false;
}

// ══════════════════════════════════════════════════════════════
//  ACTIONS BLOCS
// ══════════════════════════════════════════════════════════════
function doBreak() {
  if (!targetBlock) return;
  const [bx,by,bz] = targetBlock;
  const btype = getB(bx, by, bz);
  setB(bx, by, bz, B.AIR);
  invalidateSurfCache(bx, bz);
  scheduleChunkRebuild(bx, bz);
  // Particules de casse
  spawnBreakParticles(bx, by, bz, btype);
}

function doPlace() {
  if (!targetBlock||!targetFace) return;
  const px=targetBlock[0]+targetFace[0];
  const py=targetBlock[1]+targetFace[1];
  const pz=targetBlock[2]+targetFace[2];
  if (py > Y_MAX) { showBuildLimit(); return; }
  if (py < Y_MIN) return;
  const cp = camera.position;
  if (Math.abs(px+0.5-cp.x)<0.45&&Math.abs(pz+0.5-cp.z)<0.45
      &&py+1>cp.y-1.8&&py<cp.y+0.25) return;
  setB(px,py,pz,selBlock);
  invalidateSurfCache(px, pz);
  scheduleChunkRebuild(px, pz);
}

// ══════════════════════════════════════════════════════════════
//  BOUCLE PRINCIPALE
// ══════════════════════════════════════════════════════════════
let lastLoopTime = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt  = Math.min((now - lastLoopTime) / 1000, 0.1); // secondes, clampé
  lastLoopTime = now;

  if (!chatOpen && !inventoryOpen) physicsStep();
  camera.rotation.set(playerPitch, playerYaw, 0, 'YXZ');
  dda();
  updateVisibleChunks();
  updateParticles(dt);
  drawMinimap();
  if (fmOpen) updateFullMapPlayer();
  updateHUD();
  renderer.render(scene, camera);
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
let currentSeed = 0;

function setProgress(pct) {
  document.getElementById('loadfill').style.width = pct+'%';
}

async function startGame() {
  const raw = document.getElementById('seed-in').value.trim();
  if (raw) {
    let s=0;
    for(let i=0;i<raw.length;i++) s=(s*31+raw.charCodeAt(i))>>>0;
    currentSeed=s;
  } else {
    currentSeed=((Math.random()*0xFFFFFF|0)*137+(Math.random()*0xFFFF|0))>>>0;
  }

  document.getElementById('start').style.display='none';
  const ld=document.getElementById('loading');
  ld.style.display='flex';

  setProgress(5);
  await loadTextures();
  setProgress(25);
  globalMats = buildMaterials();

  setProgress(35);
  initWorldgen(currentSeed);

  setProgress(40);
  for (let dz=-2;dz<=2;dz++)
    for (let dx=-2;dx<=2;dx++)
      getOrGenChunk(dx,dz);

  setProgress(60);
  generateFullMap();

  setProgress(80);
  buildHotbar();

  setProgress(90);
  // Spawn : trouver la surface
  let sy=40;
  for (let y=40;y>=0;y--) {
    if (isSolid(getB(0,y,0))) { sy=y; break; }
  }
  camera.position.set(0.5, sy+3.5, 0.5);
  velY=0;

  setProgress(100);
  setTimeout(() => {
    ld.style.display='none';
    lastLoopTime = performance.now();
    requestAnimationFrame(loop);
  }, 200);
}

document.getElementById('playbtn').addEventListener('click', startGame);
document.getElementById('seed-in').addEventListener('keydown', e => {
  if (e.key==='Enter') startGame();
});
