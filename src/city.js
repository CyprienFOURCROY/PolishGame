// A tiny city: 4 blocks around a crossroads at (0,0) + 1 building closing the north street.
import * as THREE from 'three';
import { WHITE } from './props.js';

const BLOCKS = { // [minX, maxX, minZ, maxZ, height]
  NW: [-14, -4, -14, -4, 6],
  NE: [4, 14, -14, -4, 8],
  SW: [-14, -4, 4, 14, 5],
  SE: [4, 14, 4, 14, 7],
  N:  [-6, 6, -30, -22, 10],
};

export function buildCity(world) {
  const line = new THREE.LineBasicMaterial({ color: WHITE });
  const fill = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }); // see-through: never hides the hero
  for (const [minX, maxX, minZ, maxZ, h] of Object.values(BLOCKS)) {
    const geo = new THREE.BoxGeometry(maxX - minX, h, maxZ - minZ);
    const building = new THREE.Group();
    building.add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo), line));
    const hw = (maxX - minX) / 2, hd = (maxZ - minZ) / 2;
    for (let y = 2; y < h; y += 2) { // floor lines so it reads as a building
      const ring = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => new THREE.Vector3(x, y - h / 2, z));
      building.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), line));
    }
    building.position.set((minX + maxX) / 2, h / 2, (minZ + maxZ) / 2);
    world.add(building);
    world.colliders.push({ minX, maxX, minZ, maxZ });
  }
}

// Waypoints of a walk around a block, on the street, `margin` meters from its walls.
export function loopAround(name, { margin = 2, clockwise = true } = {}) {
  const [x0, x1, z0, z1] = BLOCKS[name];
  const pts = [{ x: x0 - margin, z: z0 - margin }, { x: x1 + margin, z: z0 - margin },
    { x: x1 + margin, z: z1 + margin }, { x: x0 - margin, z: z1 + margin }];
  return clockwise ? pts : pts.reverse();
}
