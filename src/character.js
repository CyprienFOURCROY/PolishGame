// A talking NPC: sphere with eyes and a mouth. Set .talking = true to move the mouth.
// Set .path (waypoints) + .speed to make it walk in a loop; it stops and faces .target when that is within LOOK_RANGE.
import * as THREE from 'three';
import { sphere, box, outlined, WHITE } from './props.js';

const R = 0.6;
const LOOK_RANGE = 5; // meters: closer than this, the character stops and looks at you

// The distinct object that makes each role recognizable (positions relative to the sphere's center).
const at = (o, x, y, z) => (o.position.set(x, y, z), o);
const ACCESSORIES = {
  cane:      () => { const g = new THREE.Group();   // old lady
                     g.add(at(outlined(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), 30), 0.8, -0.1, 0));
                     g.add(at(box([0.2, 0.05, 0.05], [0, 0, 0]), 0.72, 0.42, 0)); return g; },
  cup:       () => at(outlined(new THREE.CylinderGeometry(0.13, 0.1, 0.2, 12), 30), 0.3, -0.2, 0.75), // homeless
  bun:       () => at(outlined(new THREE.SphereGeometry(0.2, 10, 8), 30), 0, 0.68, -0.1),             // young woman
  briefcase: () => at(box([0.55, 0.38, 0.12], [0, 0, 0]), 0.85, -0.4, 0),                              // businessman
  headband:  () => { const t = outlined(new THREE.TorusGeometry(0.56, 0.04, 6, 20), 40);              // jogger
                     t.rotation.x = Math.PI / 2; return at(t, 0, 0.3, 0); },
};

export function makeCharacter(accessory) {
  const npc = new THREE.Group();
  npc.add(sphere(R));
  if (ACCESSORIES[accessory]) npc.add(ACCESSORIES[accessory]());

  const white = new THREE.MeshBasicMaterial({ color: WHITE });
  for (const x of [-0.2, 0.2]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), white);
    eye.position.set(x, 0.15, R - 0.04);
    npc.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.04), white);
  mouth.position.set(0, -0.2, R - 0.02);
  npc.add(mouth);

  npc.position.y = R;
  npc.talking = false;
  npc.target = null;
  npc.path = null;
  npc.speed = 1.5;
  let t = 0, next = 0;
  npc.update = (dt) => {
    t += dt;
    mouth.scale.y = npc.talking ? 1 + 3 * Math.abs(Math.sin(t * 14)) : 1;

    const p = npc.position;
    let heading = null, moving = false;
    const dx = npc.target ? npc.target.position.x - p.x : 0, dz = npc.target ? npc.target.position.z - p.z : 0;
    if (npc.target && Math.hypot(dx, dz) < LOOK_RANGE) {
      heading = Math.atan2(dx, dz);                        // you are close: stop and look at you
    } else if (npc.path) {
      const wp = npc.path[next];
      const d = Math.hypot(wp.x - p.x, wp.z - p.z);
      if (d < 0.2) next = (next + 1) % npc.path.length;    // reached a corner: go to the next one
      else {
        const step = Math.min(d, npc.speed * dt);
        p.x += (wp.x - p.x) / d * step;
        p.z += (wp.z - p.z) / d * step;
        heading = Math.atan2(wp.x - p.x, wp.z - p.z);
        moving = true;
      }
    }
    if (heading !== null) { // turn smoothly along the shortest way
      const diff = THREE.MathUtils.euclideanModulo(heading - npc.rotation.y + Math.PI, 2 * Math.PI) - Math.PI;
      npc.rotation.y += diff * Math.min(1, 8 * dt);
    }
    p.y = R + (moving ? Math.abs(Math.sin(t * 9)) * 0.1 : 0); // little hops while walking
  };
  return npc;
}
