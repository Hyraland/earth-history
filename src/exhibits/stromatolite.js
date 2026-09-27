// 叠层石：一簇穹顶状的丘站在岩石台面上。
// 纹层是一层层向上凸的"锅盖"：侧面看是细密起伏的条带，被风化削平的顶面上则是一圈圈同心环。
// 风化后硬的燧石层凸出、软的白云岩层凹进，所以纹层同时驱动颜色和表面凹凸；
// 颜色参考皮尔巴拉的太古宙叠层石：浅黄褐色白云岩、深色燧石条带，外加铁锈色的氧化斑。

import * as THREE from 'three';
import { placeOnGround } from './place.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- JS 里的 3D 噪声（用于顶点起伏）----
const fract = (x) => x - Math.floor(x);
const hash3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
           l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x, y, z) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 4; i++) { s += a * noise3(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
  return s;
}

// ---- 材质：纹层驱动颜色、凹凸和粗糙度 ----
const NOISE_GLSL = /* glsl */ `
varying vec3 vLocal;
varying float vCurv;
float sh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sh(i), sh(i + vec3(1, 0, 0)), f.x), mix(sh(i + vec3(0, 1, 0)), sh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(sh(i + vec3(0, 0, 1)), sh(i + vec3(1, 0, 1)), f.x), mix(sh(i + vec3(0, 1, 1)), sh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float sf(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * sn(p); p *= 2.03; a *= 0.5; } return s; }
`;

function laminatedMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCurv;\nvarying vec3 vLocal;\nvarying float vCurv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position; vCurv = aCurv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nfloat stroH; float stroRough;`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        float r2 = dot(vLocal.xz, vLocal.xz);
        // 纹层面：向上凸，并且有细碎的起伏（微生物席生长时的褶皱）
        float lam = vLocal.y + r2 * vCurv + (sf(vLocal * 0.06) - 0.5) * 7.0 + (sn(vLocal * 0.45) - 0.5) * 0.8;
        float fine = 0.5 + 0.5 * sin(lam * 3.1);                         // 细纹层
        float band = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(lam * 0.9 + sn(vLocal * 0.03) * 2.0));
        float chert = smoothstep(0.86, 0.96, 0.5 + 0.5 * sin(lam * 0.23 + sf(vLocal * 0.02) * 4.0));
        vec3 dolo = mix(vec3(0.54, 0.43, 0.32), vec3(0.70, 0.59, 0.45), band) * (0.9 + 0.12 * fine);
        vec3 c = mix(dolo, vec3(0.20, 0.19, 0.19), chert * 0.9);
        // 铁锈色的氧化斑
        float rust = smoothstep(0.55, 0.72, sf(vLocal * 0.018 + 5.0));
        c = mix(c, c * vec3(1.15, 0.72, 0.5), rust * 0.55);
        float grain = sn(vLocal * 2.5);
        c *= 0.85 + 0.25 * grain;
        diffuseColor.rgb = c;
        // 风化：燧石凸出、软层凹进；再叠加细颗粒
        stroH = chert * 0.6 + fine * 0.18 + band * 0.2 + grain * 0.12;
        stroRough = mix(0.92, 0.55, chert);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = stroRough;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float hx = dFdx(stroH), hy = dFdy(stroH);
          vec3 r1 = cross(dpy, normal), r2v = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2v);
          normal = normalize(abs(det) * normal - grad * 1.6);
        }`);
  };
  return mat;
}

// 一个丘：旋转体轮廓 + 多层噪声起伏；cut 是被削平的高度比例（1 = 完整穹顶）
function dome(radius, height, cut, seed) {
  const pts = [];
  const STEPS = 48;
  const top = height * cut;
  for (let i = 0; i <= STEPS; i++) {
    const y = (i / STEPS) * top;
    const k = y / height;
    const rr = radius * Math.pow(Math.max(0, 1 - Math.pow(k, 2.4)), 0.5) * (1 + 0.05 * Math.sin(k * 9 + seed));
    pts.push(new THREE.Vector2(Math.max(rr, 0.01), y));
  }
  if (cut < 1) {
    const rTop = pts[pts.length - 1].x;
    for (let i = 1; i <= 6; i++) pts.push(new THREE.Vector2(rTop * (1 - i / 6) + 0.01, top));   // 削平的顶面
  }
  const g = new THREE.LatheGeometry(pts, 110);
  const p = g.attributes.position;
  const o = seed * 3.1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const onTop = cut < 1 && y > top - 0.5;
    // 疙瘩状的表面：大起伏 + 小疙瘩；削平的顶面只保留很小的起伏
    const big = fbm3(x * 0.035 + o, y * 0.035, z * 0.035) - 0.5;
    const small = fbm3(x * 0.16 + o, y * 0.16, z * 0.16) - 0.5;
    if (onTop) {
      p.setY(i, y + small * 1.2);
    } else {
      const d = Math.hypot(x, z) || 1;
      const push = (big * 0.16 + small * 0.05) * radius;
      p.setXYZ(i, x + (x / d) * push, y + small * 2.0, z + (z / d) * push);
    }
  }
  g.computeVertexNormals();
  const curv = new Float32Array(p.count).fill((0.4 * height) / (radius * radius));
  g.setAttribute('aCurv', new THREE.BufferAttribute(curv, 1));
  return g;
}

// 岩石台面：纹层是水平的（aCurv = 0）
function platform() {
  const g = new THREE.CylinderGeometry(215, 232, 22, 160, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ang = Math.atan2(z, x);
    const k = 1 + 0.08 * Math.sin(ang * 3 + 1) + 0.05 * Math.sin(ang * 7 + 2) + (fbm3(x * 0.03, 0, z * 0.03) - 0.5) * 0.08;
    const lump = y > 0 ? (fbm3(x * 0.05, 1, z * 0.05) - 0.5) * 5 : 0;
    p.setXYZ(i, x * k * 1.05, y + lump, z * k * 0.8);
  }
  g.computeVertexNormals();
  g.setAttribute('aCurv', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  return g;
}

export function buildStromatolite() {
  const r = rng(7);
  const mat = laminatedMaterial();
  const group = new THREE.Group();

  const base = new THREE.Mesh(platform(), mat);
  base.position.y = -11;
  group.add(base);

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
