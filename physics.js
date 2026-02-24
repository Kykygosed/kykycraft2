'use strict';

let velY = 0, onGround = false;
let playerYaw = 0, playerPitch = 0;

function collide(nx, ny, nz, checkY) {
  const HW   = 0.30;
  const minY = checkY ? Math.floor(ny - 1.78) : Math.floor(ny - 1.75);
  const maxY = checkY ? Math.floor(ny + 0.18) : Math.floor(ny + 0.12);
  for (let bx=Math.floor(nx-HW); bx<=Math.floor(nx+HW); bx++)
    for (let bz=Math.floor(nz-HW); bz<=Math.floor(nz+HW); bz++)
      for (let by=minY; by<=maxY; by++)
        if (isSolid(getB(bx,by,bz))) return true;
  return false;
}

function physicsStep() {
  velY += GRAV;
  const cp = camera.position;

  const fwdX = -Math.sin(playerYaw), fwdZ = -Math.cos(playerYaw);
  const rtX  =  Math.cos(playerYaw), rtZ  = -Math.sin(playerYaw);

  // joyY > 0 → doigt bas → reculer
  let mx = ( joyX * rtX  - joyY * fwdX) * SPDY;
  let mz = ( joyX * rtZ  - joyY * fwdZ) * SPDY;

  if (keys['KeyW']||keys['ArrowUp'])    { mx+=fwdX*SPDY; mz+=fwdZ*SPDY; }
  if (keys['KeyS']||keys['ArrowDown'])  { mx-=fwdX*SPDY; mz-=fwdZ*SPDY; }
  if (keys['KeyA']||keys['ArrowLeft'])  { mx-=rtX*SPDY;  mz-=rtZ*SPDY;  }
  if (keys['KeyD']||keys['ArrowRight']) { mx+=rtX*SPDY;  mz+=rtZ*SPDY;  }
  if (keys['KeyZ']) { mx+=fwdX*SPDY; mz+=fwdZ*SPDY; }
  if (keys['KeyQ']) { mx-=rtX*SPDY;  mz-=rtZ*SPDY;  }

  let nx = cp.x + mx;
  let ny = cp.y + velY;
  let nz = cp.z + mz;

  if (collide(nx, cp.y, cp.z, false)) nx = cp.x;
  if (collide(nx, cp.y, nz,   false)) nz = cp.z;
  if (collide(nx, ny,   nz,   true )) {
    onGround = velY < 0;
    velY = 0; ny = cp.y;
  } else { onGround = false; }

  // Bornes monde
  nx = Math.max(-WORLD_RADIUS+0.5, Math.min(WORLD_RADIUS-0.5, nx));
  nz = Math.max(-WORLD_RADIUS+0.5, Math.min(WORLD_RADIUS-0.5, nz));

  // Chute dans le vide → respawn
  if (ny < Y_MIN - 5) respawn();
  else camera.position.set(nx, ny, nz);
}

function respawn() {
  // Trouver la surface au point de spawn (0, 0)
  let sy = 40;
  for (let y=40; y>=0; y--) {
    if (isSolid(getB(0, y, 0))) { sy = y; break; }
  }
  // +3.5 pour être largement au-dessus de la surface et éviter collision
  camera.position.set(0.5, sy + 3.5, 0.5);
  velY = 0; playerYaw = 0; playerPitch = 0;
}
