// 叠层石：一簇穹顶状的丘站在岩石台面上。
// 纹层是一层层向上凸的"锅盖"：侧面看是水平的细条带，被风化削平的顶面上则是一圈圈同心环。
// 颜色参考皮尔巴拉的太古宙叠层石：浅黄褐色白云岩和深色燧石相间。

import * as THREE from 'three';
import { placeOnGround } from './place.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 纹层着色：lam = y + r²·k 是向上凸的层面，按它画条带
function laminatedMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCurv;\nvarying vec3 vLocal;\nvarying float vCurv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position; vCurv = aCurv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vLocal;
        varying float vCurv;
        float sh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float sn(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(sh(i), sh(i + vec3(1, 0, 0)), f.x), mix(sh(i + vec3(0, 1, 0)), sh(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(sh(i + vec3(0, 0, 1)), sh(i + vec3(1, 0, 1)), f.x), mix(sh(i + vec3(0, 1, 1)), sh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float r2 = dot(vLocal.xz, vLocal.xz);
        float lam = vLocal.y + r2 * vCurv + (sn(vLocal * 0.08) - 0.5) * 3.0;
        float band = 0.5 + 0.5 * sin(lam * 2.1);
        float chert = smoothstep(0.82, 0.95, 0.5 + 0.5 * sin(lam * 0.21 + sn(vLocal * 0.03) * 3.0));
        vec3 dolo = mix(vec3(0.60, 0.50, 0.37), vec3(0.72, 0.62, 0.48), band);
        vec3 c = mix(dolo, vec3(0.22, 0.20, 0.19), chert * 0.85);
        c *= 0.9 + 0.2 * sn(vLocal * 0.6);
        diffuseColor.rgb = c;`);
  };
  return mat;
}

// 一个丘：旋转体轮廓 + 表面的疙瘩；cut 是被削平的高度比例（1 = 完整穹顶）
function dome(radius, height, cut, seed) {
  const r = rng(seed);
  const pts = [];
  const STEPS = 28;
  const top = height * cut;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const y = t * top;
    const k = y / height;
    const rr = radius * Math.pow(Math.max(0, 1 - Math.pow(k, 2.4)), 0.5) * (1 + 0.06 * Math.sin(k * 9 + seed));
    pts.push(new THREE.Vector2(Math.max(rr, 0.01), y));
  }
  if (cut < 1) pts.push(new THREE.Vector2(0.01, top));       // 削平的顶面
  const g = new THREE.LatheGeometry(pts, 72);
  const p = g.attributes.position;
  const o1 = r() * 6, o2 = r() * 6;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ang = Math.atan2(z, x);
    const bump = 1 + 0.05 * Math.sin(ang * 5 + o1 + y * 0.05) + 0.03 * Math.sin(ang * 11 + o2 - y * 0.08);
    if (y < top - 0.5) { p.setX(i, x * bump); p.setZ(i, z * bump); }
  }
  g.computeVertexNormals();
  // 纹层比丘的外形更平缓，所以侧面会露出一道道弯曲的条带
  const curv = new Float32Array(p.count).fill((0.4 * height) / (radius * radius));
  g.setAttribute('aCurv', new THREE.BufferAttribute(curv, 1));
  return g;
}

export function buildStromatolite() {
  const r = rng(7);
  const mat = laminatedMaterial();
  const group = new THREE.Group();

  // 台面：一块低矮不规则的岩石
  const base = new THREE.CylinderGeometry(215, 230, 20, 96, 1);
  const bp = base.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i);
    const ang = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.sin(ang * 3 + 1) + 0.05 * Math.sin(ang * 7 + 2);
    bp.setX(i, x * k * 1.05); bp.setZ(i, z * k * 0.8);
  }
  base.computeVertexNormals();
  const baseMesh = new THREE.Mesh(base, new THREE.MeshStandardMaterial({ color: '#6d5f4e', roughness: 0.95 }));
  baseMesh.position.y = -10;
  group.add(baseMesh);

  // 丘：大小不一，挤在一起；约一半顶部被削平
  const domes = [
    [-120, -20, 70, 95], [-10, 30, 85, 120], [110, -10, 65, 90], [40, -80, 55, 70],
    [-70, 80, 50, 65], [160, 70, 42, 55], [-170, 60, 38, 45], [80, 95, 45, 60], [-40, -95, 40, 50],
  ];
  domes.forEach(([x, z, rad, h], i) => {
    const cut = r() < 0.5 ? 0.55 + r() * 0.25 : 1;
    const m = new THREE.Mesh(dome(rad, h, cut, i * 13 + 5), mat);
    m.position.set(x, -4, z);
    m.rotation.y = r() * 6.28;
    group.add(m);
  });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return placeOnGround(group, { yaw: 0.2 });
}
