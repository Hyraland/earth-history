// 石化森林（亚利桑那州石化森林国家公园，晚三叠世钦尔组，Agathoxylon arizonicum）：
// 南洋杉类大树被洪水冲倒、埋进火山灰和河沙里，木质被二氧化硅一点点置换成玛瑙和碧玉。
// 石化的树干很脆，出露后沿横向裂开，断成一截截像切开的香肠——截面上是铁和锰染出的红、橙、黄、紫，
// 裂缝里充填着白色石英；外表风化成灰褐色，还保留着木纹。
//
// 几根原木断成数截，略微错开；一截滚到前面竖着立起来，从上往下看能看到完整的截面。
// 所有花纹都按"原木自身坐标"（aLog：沿树干、截面上的两个方向）计算，所以相邻两截的断面花纹能对上。

import * as THREE from 'three';

const SCALE = 1.0;

// ---- JS 噪声（用于树干轮廓的起伏）----
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

// ---- 着色器公共部分 ----
const COMMON_GLSL = /* glsl */ `
varying vec3 vLog;
varying float vRad;
float ph(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float pn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ph(i), ph(i + vec3(1, 0, 0)), f.x), mix(ph(i + vec3(0, 1, 0)), ph(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ph(i + vec3(0, 0, 1)), ph(i + vec3(1, 0, 1)), f.x), mix(ph(i + vec3(0, 1, 1)), ph(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float pf(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * pn(p); p *= 2.03; a *= 0.5; } return s; }
float pH; float pRough;
`;

// 断面：碧玉的颜色场 + 隐约的年轮 + 放射状的石英脉 + 外圈深色的皮
const END_GLSL = /* glsl */ `
  vec3 q = vLog;
  float ang = atan(q.z, q.y);
  float rn = vRad;
  float warp = pf(vec3(q.yz * 0.035, q.x * 0.004));
  float field = pf(vec3(q.yz * 0.045 + warp * 1.8, q.x * 0.01 + 3.0)) + (pn(vec3(q.x * 0.004, 1.0, 1.0)) - 0.5) * 0.3;   // 每截的主色调略有不同
  float rings = 0.5 + 0.5 * sin(rn * 46.0 + warp * 9.0);
  vec3 red = vec3(0.74, 0.24, 0.13), orange = vec3(0.90, 0.52, 0.22), yellow = vec3(0.95, 0.80, 0.46);
  vec3 purple = vec3(0.58, 0.34, 0.50), cream = vec3(0.96, 0.93, 0.87), black = vec3(0.22, 0.17, 0.16);
  vec3 c = mix(red, orange, smoothstep(0.38, 0.5, field));
  c = mix(c, yellow, smoothstep(0.56, 0.68, field));
  c = mix(c, purple, smoothstep(0.6, 0.75, pf(vec3(q.yz * 0.03 + 7.0, q.x * 0.008))) * 0.85);
  c *= 0.86 + 0.2 * rings;
  // 木心：常是白色或透明的石英，偶尔有空洞里的紫水晶
  float pith = 1.0 - smoothstep(0.04, 0.1, rn + (warp - 0.5) * 0.08);
  c = mix(c, cream, pith * 0.9);
  // 放射状裂缝：大多被白色石英填满，少数是深色的
  float crackAng = abs(sin(ang * 4.0 + pn(vec3(q.yz * 0.02, q.x * 0.01)) * 6.0));
  float crack = (1.0 - smoothstep(0.0, 0.035, crackAng)) * smoothstep(0.15, 0.3, rn);
  float dark = step(0.62, pn(vec3(ang * 2.0, q.x * 0.02, 1.0)));
  c = mix(c, mix(cream, black, dark), crack);
  // 同心的环形裂缝
  float ringCrack = (1.0 - smoothstep(0.0, 0.012, abs(rn - 0.62 - (warp - 0.5) * 0.12))) * step(0.45, pn(vec3(ang * 3.0, 2.0, q.x * 0.01)));
  c = mix(c, cream, ringCrack * 0.8);
  // 外皮：深灰褐色的一圈
  float rind = smoothstep(0.88, 0.95, rn + (pn(vec3(ang * 5.0, q.x * 0.05, 0.0)) - 0.5) * 0.05);
  c = mix(c, vec3(0.46, 0.40, 0.36), rind);
  float grain = pn(q * 1.3);
  c *= 0.9 + 0.2 * grain;
  diffuseColor.rgb = pow(c, vec3(2.2));   // 上面的颜色按 sRGB 写，换成线性
  pH = -crack * 0.6 - ringCrack * 0.3 + grain * 0.15 - rind * 0.2;
  pRough = mix(0.42, 0.22, max(crack * (1.0 - dark), pith)) + rind * 0.4;
`;

// 侧面：风化的灰褐色外表，顺着树干的木纹和纵向裂缝，透出斑块状的红色和紫色
const SIDE_GLSL = /* glsl */ `
  vec3 q = vLog;
  float ang = atan(q.z, q.y);
  float fiber = pn(vec3(q.x * 0.018, ang * 9.0, 0.0)) * 0.6 + pn(vec3(q.x * 0.06, ang * 30.0, 5.0)) * 0.4;
  float blotch = pf(vec3(q.x * 0.008, ang * 1.2, 3.0));
  vec3 base = mix(vec3(0.44, 0.38, 0.34), vec3(0.62, 0.54, 0.46), fiber);
  vec3 c = mix(base, vec3(0.62, 0.30, 0.20), smoothstep(0.48, 0.66, blotch) * 0.85);
  c = mix(c, vec3(0.42, 0.30, 0.34), smoothstep(0.58, 0.74, pf(vec3(q.x * 0.01 + 4.0, ang * 1.5, 1.0))) * 0.7);
  // 纵向裂缝
  float split = 1.0 - smoothstep(0.0, 0.04, abs(sin(ang * 5.0 + pn(vec3(q.x * 0.01, 0.0, 2.0)) * 5.0)));
  c *= 1.0 - split * 0.55;
  // 荒漠漆：深色的斑
  c *= 1.0 - smoothstep(0.58, 0.8, pf(vec3(q.x * 0.02, ang * 3.0, 9.0))) * 0.35;
  float grain = pn(q * 1.1);
  c *= 0.88 + 0.22 * grain;
  diffuseColor.rgb = pow(c, vec3(2.2));
  pH = fiber * 0.5 - split * 0.8 + grain * 0.2;
  pRough = 0.8;
`;

function petrifiedMaterial(name, body) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, envMapIntensity: 0.35 });
  // three.js 按 onBeforeCompile 的源码缓存着色器程序；两种材质的函数源码相同，只是 body 不同，要各给一个键
  mat.customProgramCacheKey = () => `petrified-${name}`;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aLog;\nattribute float aRad;\nvarying vec3 vLog;\nvarying float vRad;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLog = aLog; vRad = aRad;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${body}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pRough;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
        {
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float hx = dFdx(pH), hy = dFdy(pH);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - grad * 2.0);
        }`);
  };
  return mat;
}

// ---- 一根原木的几何：半径沿树干和绕树干起伏，截面略扁 ----
function makeLog(radius, length, seed) {
  const rAt = (ang, x) => {
    const k = 1 - 0.14 * (x / length);                                // 一端略细
    const n = noise3(Math.cos(ang) * 1.3 + seed, Math.sin(ang) * 1.3, x / 90);
    const n2 = noise3(Math.cos(ang) * 4 + seed * 2, Math.sin(ang) * 4, x / 30);
    return radius * k * (1 + (n - 0.5) * 0.16 + (n2 - 0.5) * 0.05);
  };
  const toLog = (ang, x, r) => [x, Math.sin(ang) * r * 0.9, Math.cos(ang) * r];   // 截面略扁（被压过）
  // 断口：一个略微倾斜的平面，加一点粗糙起伏
  const makeBreak = (xb) => {
    const phi = hash3(xb, seed, 1) * Math.PI * 2, tilt = (hash3(xb, seed, 2) - 0.5) * 0.3;
    return (ang, rn) => xb + tilt * radius * Math.cos(ang - phi) * rn + (noise3(Math.cos(ang) * 3 * rn, Math.sin(ang) * 3 * rn, xb) - 0.5) * 4;
  };

  // 一截：从断口 a 到断口 b
  function segment(xa, xb) {
    const A = 96, L = Math.max(8, Math.round((xb - xa) / 6)), RN = 10;
    const breakA = makeBreak(xa), breakB = makeBreak(xb);

    // 侧面
    const pos = [], log = [], rad = [], idx = [];
    for (let j = 0; j <= L; j++) {
      for (let i = 0; i <= A; i++) {
        const ang = (i / A) * Math.PI * 2;
        const x = THREE.MathUtils.lerp(breakA(ang, 1), breakB(ang, 1), j / L);
        const p = toLog(ang, x, rAt(ang, x));
        pos.push(...p); log.push(...p); rad.push(1);
      }
    }
    for (let j = 0; j < L; j++) {
      for (let i = 0; i < A; i++) {
        const a = j * (A + 1) + i, b = a + 1, c = a + A + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const side = new THREE.BufferGeometry();
    side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    side.setAttribute('aLog', new THREE.Float32BufferAttribute(log, 3));
    side.setAttribute('aRad', new THREE.Float32BufferAttribute(rad, 1));
    side.setIndex(idx);
    side.computeVertexNormals();

    // 两个断面：同心的几圈顶点，断口的平面上有细小起伏
    const ends = [breakA, breakB].map((brk, e) => {
      const p2 = [], l2 = [], r2 = [], i2 = [];
      for (let k = 0; k <= RN; k++) {
        const rn = k / RN;
        for (let i = 0; i <= A; i++) {
          const ang = (i / A) * Math.PI * 2;
          const x = brk(ang, rn);
          const p = toLog(ang, x, rAt(ang, x) * rn);
          p2.push(...p); l2.push(...p); r2.push(rn);
        }
      }
      for (let k = 0; k < RN; k++) {
        for (let i = 0; i < A; i++) {
          const a = k * (A + 1) + i, b = a + 1, c = a + A + 1, d = c + 1;
          if (e === 0) i2.push(a, c, b, b, c, d); else i2.push(a, b, c, b, d, c);   // 断面朝外：起点一端朝 -x，终点一端朝 +x
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      g.setAttribute('aLog', new THREE.Float32BufferAttribute(l2, 3));
      g.setAttribute('aRad', new THREE.Float32BufferAttribute(r2, 1));
      g.setIndex(i2);
      g.computeVertexNormals();
      return g;
    });
    // 截面中心（用来摆放）
    return { side, ends, center: new THREE.Vector3((xa + xb) / 2, 0, 0) };
  }
  return { segment };
}

export function buildPetrified() {
  const sideMat = petrifiedMaterial('side', SIDE_GLSL);
  const endMat = petrifiedMaterial('end', END_GLSL);
  const root = new THREE.Group();

  // 一截木头：以截面中心为原点放进一个组，方便单独摆放
  const piece = (log, xa, xb) => {
    const s = log.segment(xa, xb);
    const g = new THREE.Group();
    const inner = new THREE.Group();
    inner.position.copy(s.center).negate();
    inner.add(new THREE.Mesh(s.side, sideMat));
    s.ends.forEach((geo) => inner.add(new THREE.Mesh(geo, endMat)));
    g.add(inner);
    return g;
  };

  // 原木 A：最粗最长，斜躺着，断成六截，截与截之间拉开一点缝，露出断面
  const A = { r: 42, len: 620, breaks: [0, 96, 200, 285, 400, 505, 620] };
  const logA = makeLog(A.r, A.len, 1.7);
  const YAW_A = 0.62;
  const dirA = new THREE.Vector3(Math.cos(YAW_A), 0, -Math.sin(YAW_A));   // 右端朝远处，斜着躺，截与截之间的断面才露得出来
  let along = -A.len / 2;
  for (let k = 0; k < A.breaks.length - 1; k++) {
    const xa = A.breaks[k], xb = A.breaks[k + 1];
    const p = piece(logA, xa, xb);
    const gap = k * 22;                                                 // 越往后缝越大
    const mid = along + (xb - xa) / 2 + gap;
    p.position.copy(dirA).multiplyScalar(mid).add(new THREE.Vector3(Math.sin(k * 2.1) * 4, A.r * 0.8, Math.cos(k * 1.7) * 6));
    p.rotation.set(0, YAW_A + Math.sin(k * 3.3) * 0.07, 0);
    p.children[0].rotation.x = Math.sin(k * 5.1) * 0.25;               // 每截绕自身轴滚了一点
    root.add(p);
    along += xb - xa;
  }

  // 原木 B：细一些，在后面
  const B = { r: 30, len: 420, breaks: [0, 120, 215, 330, 420] };
  const logB = makeLog(B.r, B.len, 4.3);
  const dirB = new THREE.Vector3(Math.cos(-0.3), 0, -Math.sin(-0.3));
  along = -B.len / 2;
  for (let k = 0; k < B.breaks.length - 1; k++) {
    const xa = B.breaks[k], xb = B.breaks[k + 1];
    const p = piece(logB, xa, xb);
    const mid = along + (xb - xa) / 2 + k * 18;
    p.position.copy(dirB).multiplyScalar(mid).add(new THREE.Vector3(80, B.r * 0.8, -190));
    p.rotation.set(0, -0.3 + Math.sin(k * 2.7) * 0.06, 0);
    p.children[0].rotation.x = Math.sin(k * 4.3) * 0.3;
    root.add(p);
    along += xb - xa;
  }

  // 滚到前面的两截：竖着立起来，顶面略朝镜头——彩色的断面迎着天光，从上往下正好看见完整的截面
  const logC = makeLog(50, 200, 7.9);
  const stand = piece(logC, 0, 55);
  stand.rotation.set(0.28, 0.6, Math.PI / 2);                           // 先立起来（绕 z），再朝镜头歪一点（绕 x）
  stand.position.set(-330, 20, 110);
  root.add(stand);
  const stand2 = piece(logC, 55, 95);
  stand2.rotation.set(0.35, -0.4, Math.PI / 2);
  stand2.position.set(300, 12, 140);
  root.add(stand2);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.scale.setScalar(SCALE);

  const group = new THREE.Group();
  group.add(root);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group, true);
  root.position.y = -2;                                                 // 木头底部略微陷进土里
  return { object: group, labelAnchor: new THREE.Vector3(box.max.x * 0.85, Math.max(box.max.y * 0.9, 40), 0) };
}
