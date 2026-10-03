// Shared look: black shapes delimited by a white line, plus the moving stars.
import * as THREE from 'three';

export const BLACK = 0x000000, WHITE = 0xffffff;

// Black filled shape with a white outline. `angle` = min angle (deg) between faces to draw an edge.
export function outlined(geometry, angle = 1) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: BLACK })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, angle), new THREE.LineBasicMaterial({ color: WHITE })));
  return g;
}

export function box([w, h, d], [x, y, z]) {
  const o = outlined(new THREE.BoxGeometry(w, h, d));
  o.position.set(x, y, z);
  return o;
}

export const sphere = (radius) => outlined(new THREE.SphereGeometry(radius, 16, 12), 15);

// Stars drifting sideways, wrapping around; same idea as the dust we had in the plane.
export function makeStars(count = 700) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[3 * i] = (Math.random() - 0.5) * 200;
    pos[3 * i + 1] = 1 + Math.random() * 45;
    pos[3 * i + 2] = (Math.random() - 0.5) * 200;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: WHITE, size: 0.25, fog: false }));
  stars.update = (dt) => {
    for (let i = 0; i < count; i++) if ((pos[3 * i] += dt * 2) > 100) pos[3 * i] = -100;
    geo.attributes.position.needsUpdate = true;
  };
  return stars;
}
