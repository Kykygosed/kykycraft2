'use strict';

// ══════════════════════════════════════════════════════════════
//  MESHES PAR CHUNK  — évite les freezes lors de casser/poser
// ══════════════════════════════════════════════════════════════

let globalMats = null;

/** Map chunkKey → { solid:Mesh|null, water:Mesh|null } */
const chunkMeshes = new Map();

/** File d'attente de reconstructions différées (Set de clés) */
const rebuildQueue  = new Set();
let   rebuildRunning = false;

// ── Boîte de sélection ────────────────────────────────────────
const selBox = new THREE.Mesh(
  new THREE.BoxGeometry(1.015, 1.015, 1.015),
  new THREE.MeshBasicMaterial({ color:0xffffff, wireframe:true, transparent:true, opacity:0.6 })
);
selBox.visible = false;
scene.add(selBox);

// ══════════════════════════════════════════════════════════════
//  Construction d'un chunk mesh
// ══════════════════════════════════════════════════════════════
function buildChunkMesh(cx, cz) {
  const key    = getChunkKey(cx, cz);
  const worldX = cx * CHUNK_SIZE;
  const worldZ = cz * CHUNK_SIZE;

  // Pré-générer les 4 voisins pour les faces de bord
  getOrGenChunk(cx-1, cz); getOrGenChunk(cx+1, cz);
  getOrGenChunk(cx, cz-1); getOrGenChunk(cx, cz+1);

  // Accumulateurs par slot matériau
  const acc  = Array.from({length:NMAT}, ()=>({pos:[],uv:[],col:[],idx:[],vi:0}));
  const wacc = {pos:[],uv:[],col:[],idx:[],vi:0};

  const chunk     = getOrGenChunk(cx, cz);
  const modsMap   = chunkMods.get(key);  // modifications joueur pour ce chunk

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let ly = 0; ly < Y_RANGE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const bi = blockIdx(lx, ly, lz);
        let b = (modsMap && modsMap.has(bi)) ? modsMap.get(bi) : chunk[bi];
        if (!b) continue;

        const wx = worldX + lx;
        const wy = ly + Y_MIN;
        const wz = worldZ + lz;
        const isWater = (b === B.WATER);

        FACES.forEach(({n:[nx,ny,nz], c, fi}) => {
          const nb = getB(wx+nx, wy+ny, wz+nz);
          if (!showFace(b, nb)) return;

          const mi = blockMat(b, fi);
          const sh = FSHADE[fi];
          const a  = isWater ? wacc : acc[mi];
          const vi = a.vi;

          // Coordonnées locales (+ offset chunk via mesh.position)
          c.forEach(([px,py,pz]) => {
            a.pos.push(lx+px, ly+py, lz+pz);
            a.col.push(sh, sh, sh);
          });
          for (let i=0;i<8;i++) a.uv.push(QUV[i]);
          a.idx.push(vi,vi+1,vi+2, vi,vi+2,vi+3);
          a.vi += 4;
        });
      }
    }
  }

  // Supprimer l'ancien mesh
  const old = chunkMeshes.get(key);
  if (old) {
    if (old.solid) { scene.remove(old.solid); old.solid.geometry.dispose(); }
    if (old.water) { scene.remove(old.water); old.water.geometry.dispose(); }
  }

  // Offset du mesh dans la scène Three.js
  const offX = worldX;
  const offY = Y_MIN;   // y local 0 = monde Y_MIN
  const offZ = worldZ;

  let solidMesh = null, waterMesh = null;

  // Mesh solide multi-matériaux
  const totalV = acc.reduce((s,a)=>s+a.vi,0);
  if (totalV > 0) {
    const tV = totalV, tI = acc.reduce((s,a)=>s+a.idx.length,0);
    const aP=new Float32Array(tV*3), aU=new Float32Array(tV*2),
          aC=new Float32Array(tV*3), aI=new Uint32Array(tI);
    const groups=[]; let vp=0,up=0,cp=0,ip=0,vOff=0,iOff=0;
    acc.forEach((a,mi)=>{
      if(!a.vi) return;
      for(let i=0;i<a.pos.length;i++) aP[vp++]=a.pos[i];
      for(let i=0;i<a.uv.length; i++) aU[up++]=a.uv[i];
      for(let i=0;i<a.col.length;i++) aC[cp++]=a.col[i];
      for(let i=0;i<a.idx.length;i++) aI[ip++]=a.idx[i]+vOff;
      groups.push({start:iOff,count:a.idx.length,materialIndex:mi});
      vOff+=a.vi; iOff+=a.idx.length;
    });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(aP,3));
    geo.setAttribute('uv',      new THREE.Float32BufferAttribute(aU,2));
    geo.setAttribute('color',   new THREE.Float32BufferAttribute(aC,3));
    geo.setIndex(new THREE.BufferAttribute(aI,1));
    groups.forEach(g=>geo.addGroup(g.start,g.count,g.materialIndex));
    solidMesh=new THREE.Mesh(geo, globalMats);
    solidMesh.position.set(offX, offY, offZ);
    scene.add(solidMesh);
  }

  // Mesh eau
  if (wacc.vi > 0) {
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(wacc.pos),3));
    geo.setAttribute('uv',      new THREE.Float32BufferAttribute(new Float32Array(wacc.uv), 2));
    geo.setAttribute('color',   new THREE.Float32BufferAttribute(new Float32Array(wacc.col),3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(wacc.idx),1));
    waterMesh=new THREE.Mesh(geo, globalMats[M.WATER]);
    waterMesh.position.set(offX, offY, offZ);
    scene.add(waterMesh);
  }

  chunkMeshes.set(key, {solid:solidMesh, water:waterMesh});
}

// ══════════════════════════════════════════════════════════════
//  Reconstruction différée (uniquement le chunk touché)
// ══════════════════════════════════════════════════════════════
function scheduleChunkRebuild(wx, wz) {
  const cx = worldToChunkCoord(wx);
  const cz = worldToChunkCoord(wz);
  const keys = [getChunkKey(cx,cz)];
  // Si sur une bordure, reconstruire le voisin aussi
  const lx = worldToLocal(wx), lz2 = worldToLocal(wz);
  if (lx === 0)              keys.push(getChunkKey(cx-1, cz));
  if (lx === CHUNK_SIZE-1)   keys.push(getChunkKey(cx+1, cz));
  if (lz2 === 0)             keys.push(getChunkKey(cx, cz-1));
  if (lz2 === CHUNK_SIZE-1)  keys.push(getChunkKey(cx, cz+1));
  keys.forEach(k => rebuildQueue.add(k));
  if (!rebuildRunning) processRebuildQueue();
}

function processRebuildQueue() {
  if (rebuildQueue.size === 0) { rebuildRunning=false; return; }
  rebuildRunning = true;
  const key = rebuildQueue.values().next().value;
  rebuildQueue.delete(key);
  const [cx,cz] = key.split(',').map(Number);
  buildChunkMesh(cx, cz);
  updateMinimapBase(); // ui.js
  // Prochaine reconstruction au prochain frame (ne bloque pas)
  requestAnimationFrame(processRebuildQueue);
}

// ══════════════════════════════════════════════════════════════
//  Gestion des chunks visibles
// ══════════════════════════════════════════════════════════════
let lastPlayerCx = null, lastPlayerCz = null;
let chunkBuildQueue = [];     // liste ordonnée de chunks à construire
let chunksBuiltThisFrame = 0;
const MAX_BUILDS_PER_FRAME = 2;

function updateVisibleChunks() {
  const pcx = worldToChunkCoord(camera.position.x);
  const pcz = worldToChunkCoord(camera.position.z);

  if (pcx === lastPlayerCx && pcz === lastPlayerCz) {
    // On n'a pas changé de chunk → juste process queue
    processChunkBuildQueue();
    return;
  }
  lastPlayerCx = pcx; lastPlayerCz = pcz;

  // Construire la liste des chunks visibles (triée par distance)
  const visible = new Set();
  const needed  = [];
  for (let dz=-RENDER_DIST; dz<=RENDER_DIST; dz++) {
    for (let dx=-RENDER_DIST; dx<=RENDER_DIST; dx++) {
      const key = getChunkKey(pcx+dx, pcz+dz);
      visible.add(key);
      if (!chunkMeshes.has(key)) needed.push({key,cx:pcx+dx,cz:pcz+dz,d:dx*dx+dz*dz});
    }
  }
  // Trier par distance (les plus proches en premier)
  needed.sort((a,b)=>a.d-b.d);
  chunkBuildQueue = needed;

  // Supprimer les chunks trop loin
  for (const [key, data] of chunkMeshes) {
    if (!visible.has(key)) {
      if (data.solid) { scene.remove(data.solid); data.solid.geometry.dispose(); }
      if (data.water) { scene.remove(data.water); data.water.geometry.dispose(); }
      chunkMeshes.delete(key);
    }
  }

  processChunkBuildQueue();
}

function processChunkBuildQueue() {
  let built = 0;
  while (chunkBuildQueue.length > 0 && built < MAX_BUILDS_PER_FRAME) {
    const {key,cx,cz} = chunkBuildQueue.shift();
    if (!chunkMeshes.has(key)) {
      buildChunkMesh(cx, cz);
      built++;
    }
  }
}
