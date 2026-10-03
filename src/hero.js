// The hero: a rolling sphere. Arrows move, Space jumps (also in mid-air).
import * as THREE from 'three';
import { sphere } from './props.js';

const R = 0.5, SPEED = 6, JUMP = 9, GRAVITY = 25, MAX_JUMPS = Infinity; // set MAX_JUMPS = 2 for a double jump

// Push a circle (x,z) out of axis-aligned boxes.
function collide(p, colliders) {
  for (const c of colliders) {
    const dx = p.x - THREE.MathUtils.clamp(p.x, c.minX, c.maxX);
    const dz = p.z - THREE.MathUtils.clamp(p.z, c.minZ, c.maxZ);
    const d = Math.hypot(dx, dz);
    if (d > 0 && d < R) { p.x += dx / d * (R - d); p.z += dz / d * (R - d); }
  }
}

export function makeHero(world, x, z) {
  const hero = new THREE.Group();
  const ball = sphere(R);
  hero.add(ball);
  hero.position.set(x, R, z);
  let vy = 0, jumps = 0;

  hero.update = (dt) => {
    const { keys, pressed } = world.input;
    const free = !world.busy; // frozen while talking
    const dx = free ? (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0) : 0;
    const dz = free ? (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0) : 0;
    const len = Math.hypot(dx, dz) || 1;
    const { yaw } = world.view; // arrows are relative to the camera
    const mx = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / len * SPEED * dt;
    const mz = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) / len * SPEED * dt;

    hero.position.x += mx;
    hero.position.z += mz;
    collide(hero.position, world.colliders);
    ball.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -mx / R); // roll
    ball.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), mz / R);

    if (free && pressed.has('Space') && jumps < MAX_JUMPS) { vy = JUMP; jumps++; }
    vy -= GRAVITY * dt;
    hero.position.y += vy * dt;
    if (hero.position.y <= R) { hero.position.y = R; vy = 0; jumps = 0; }
  };
  return hero;
}
