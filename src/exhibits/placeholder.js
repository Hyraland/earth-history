// 占位展品：一块风化的巨石。真正的化石模型做好之前，用它标出展位。

import * as THREE from 'three';

function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function buildPlaceholder(exhibit) {
  const rand = seeded(exhibit.index * 17 + 3);
  const geo = new THREE.SphereGeometry(1, 72, 48);
  const p = geo.attributes.position;
  const f1 = 1.5 + rand() * 1.5, f2 = 3 + rand() * 3, o1 = rand() * 6, o2 = rand() * 6;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = 1 + 0.12 * Math.sin(v.x * f1 + o1) * Math.cos(v.z * f1 + o2)
                + 0.05 * Math.sin(v.y * f2 + v.x * f2 + o2);
    v.multiplyScalar(n);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.3;   // 底部压平，像埋进地里
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const size = 60 + rand() * 25;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9c9082').offsetHSL(0, 0, (rand() - 0.5) * 0.08),
    roughness: 0.95,
  }));
  mesh.scale.set(size * (1 + rand() * 0.4), size * (0.7 + rand() * 0.3), size);
  mesh.rotation.y = rand() * Math.PI;
  mesh.position.y = size * 0.1;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  return { object: group, labelAnchor: new THREE.Vector3(size * 1.1, size * 0.7, 0), placeholder: true };
}
