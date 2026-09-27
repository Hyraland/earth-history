// 菊石（Asteroceras obtusum）：程序化生成的完整旋壳，平放在大地上。
// 对数螺线每转一圈放大约 2 倍，只能看到 4 圈左右；侧面有粗壮笔直的放射肋，
// 腹部中央有一道棱脊，两侧各有一条浅沟。
// 壳面纹理在显卡上烘焙：部分原壳保存（带生长纹，局部有珍珠层的彩虹光泽），
// 部分外壳剥落露出内模和树枝状缝合线，肋间和脐部残留灰色围岩，还有黄铁矿斑点和细裂纹。
// 壳口断面是有厚度的壳壁，住室里填满了泥岩。

import * as THREE from 'three';
import { bakeTexture } from '../bake.js';

const TAU = Math.PI * 2;
const SHAPE = { radius: 112, turns: 4.3, expansion: 2.0, ribsPerTurn: 26 };
const SCALE = 1.5;   // 整体放大

function shellGeometry({ radius, turns, expansion, ribsPerTurn, segPerTurn = 260, segRing = 72 }) {
  const b = Math.log(expansion) / TAU;               // 每转一圈半径放大 expansion 倍
  const theta0 = 0.45 * TAU;
  const thetaMax = turns * TAU;
  const a = radius / Math.exp(b * thetaMax);
  const k = ((expansion - 1) / (expansion + 1)) * 1.06;   // 管径 / 螺线半径：相邻两圈略有包覆
  const bodyStart = thetaMax - 0.55 * TAU;               // 最后约半圈是住室，没有隔壁

  const segT = Math.ceil(((thetaMax - theta0) / TAU) * segPerTurn);
  const rows = segT + 1, cols = segRing + 1;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);

  for (let i = 0; i < rows; i++) {
    const theta = theta0 + (thetaMax - theta0) * (i / segT);
    const r = a * Math.exp(b * theta);
    const rho = k * r;
    const cx = Math.cos(theta), cz = Math.sin(theta);
    const bodyFade = 1 - THREE.MathUtils.smoothstep(theta, bodyStart, thetaMax) * 0.45;
    const rib = Math.pow(0.5 + 0.5 * Math.cos(theta * ribsPerTurn), 5) * bodyFade;
    const flare = 1 + 0.06 * THREE.MathUtils.smoothstep(theta, thetaMax - 0.12, thetaMax);   // 壳口稍微张开
    for (let j = 0; j < cols; j++) {
      let phi = (j / segRing) * TAU;                     // 0 = 腹部（外缘），π = 背部（贴着内圈）
      const cp = Math.cos(phi), sp = Math.sin(phi);
      if (phi > Math.PI) phi -= TAU;
      const ap = Math.abs(phi);
      // 肋：侧面最强，靠近腹部棱脊和背部都减弱
      const ribMask = THREE.MathUtils.smoothstep(cp, -0.55, -0.05) * (1 - 0.75 * THREE.MathUtils.smoothstep(cp, 0.72, 0.95));
      const keel = 0.1 * Math.exp(-((phi / 0.12) ** 2)) - 0.045 * Math.exp(-(((ap - 0.3) / 0.08) ** 2));
      const bump = (1 + 0.14 * rib * ribMask + keel) * flare;
      const radial = r + cp * rho * bump;
      const n = i * cols + j;
      pos[n * 3] = cx * radial;
      pos[n * 3 + 1] = sp * rho * 0.8 * bump;
      pos[n * 3 + 2] = cz * radial;
      uv[n * 2] = i / segT;
      uv[n * 2 + 1] = j / segRing;
    }
  }

  const idx = [];
  for (let i = 0; i < segT; i++) {
    for (let j = 0; j < segRing; j++) {
      const a0 = i * cols + j, a1 = a0 + 1, b0 = a0 + cols, b1 = b0 + 1;
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  const endR = a * Math.exp(b * thetaMax);
  const cap = apertureGeometry(pos, cols, segT, endR, k * endR, thetaMax, b);
  return { geometry: g, cap, theta0, thetaMax, bodyStart };
}

// 壳口断面：外圈是有厚度的壳壁，里面是填满住室的泥岩，表面略微凹陷、起伏不平。
// 直接用壳管最后一圈顶点作外轮廓，所以肋和棱脊的轮廓能严丝合缝地接上。
// 几何分两组：0 壳壁断面，1 泥岩
function apertureGeometry(pos, cols, segT, endR, rho, thetaMax, b) {
  const center = new THREE.Vector3(Math.cos(thetaMax) * endR, 0, Math.sin(thetaMax) * endR);
  const out = new THREE.Vector3(                       // 螺线在壳口处的切线，即断面朝外的方向
    b * Math.cos(thetaMax) - Math.sin(thetaMax), 0, b * Math.sin(thetaMax) + Math.cos(thetaMax)).normalize();
  const side = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0)).normalize();
  const ring = [];
  for (let j = 0; j < cols; j++) {
    const n = segT * cols + j;
    ring.push(new THREE.Vector3(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2]));
  }

  // 同心圈：f 是相对外轮廓的缩放，d 是向壳内凹进的深度
  const WALL = 0.93, RINGS = 14;
  const levels = [{ f: 1, d: 0 }, { f: WALL, d: 0.015 }];
  for (let r = 1; r <= RINGS; r++) {
    const f = WALL * (1 - r / RINGS);
    levels.push({ f, d: 0.04 + 0.05 * Math.sin((r / RINGS) * Math.PI) });
  }
  const verts = [], uvs = [];
  const tmp = new THREE.Vector3();
  levels.forEach(({ f, d }, li) => {
    for (let j = 0; j < cols; j++) {
      tmp.copy(ring[j]).sub(center).multiplyScalar(f).add(center);
      // 泥岩表面的小起伏
      const lump = li > 1 ? (Math.sin(j * 0.9 + li * 1.7) * Math.cos(li * 2.3 - j * 0.4)) * 0.018 : 0;
      tmp.addScaledVector(out, -(d + lump) * rho);
      verts.push(tmp.x, tmp.y, tmp.z);
      const rel = tmp.clone().sub(center);
      uvs.push(0.5 + rel.dot(side) / (2.4 * rho), 0.5 + rel.y / (2.4 * rho));
    }
  });
  const idxWall = [], idxRock = [];
  for (let li = 0; li < levels.length - 1; li++) {
    const target = li === 0 ? idxWall : idxRock;
    for (let j = 0; j < cols - 1; j++) {
      const a0 = li * cols + j, a1 = a0 + 1, b0 = a0 + cols, b1 = b0 + 1;
      target.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  // 保证三角形朝外（朝向切线方向），否则翻转
  const p0 = new THREE.Vector3().fromArray(verts, idxRock[0] * 3);
  const p1 = new THREE.Vector3().fromArray(verts, idxRock[1] * 3);
  const p2 = new THREE.Vector3().fromArray(verts, idxRock[2] * 3);
  const nrm = new THREE.Vector3().crossVectors(p1.clone().sub(p0), p2.clone().sub(p0));
  const flip = (list) => { for (let i = 0; i < list.length; i += 3) [list[i + 1], list[i + 2]] = [list[i + 2], list[i + 1]]; };
  if (nrm.dot(out) < 0) { flip(idxWall); flip(idxRock); }
  g.setIndex([...idxWall, ...idxRock]);
  g.addGroup(0, idxWall.length, 0);
  g.addGroup(idxWall.length, idxRock.length, 1);
  g.computeVertexNormals();
  // 泥岩面整体朝外，细节交给凹凸贴图；圆心处的三角形退化，不能用自动算出的法线
  const nAttr = g.attributes.normal;
  for (let i = cols; i < nAttr.count; i++) nAttr.setXYZ(i, out.x, out.y, out.z);
  return g;
}

// ---- 住室里的泥岩：水平层理、细颗粒、零星的壳碎片、干裂纹 ----
const MATRIX_BAKE = /* glsl */ `
uniform int uOut;          // 0 颜色  1 凹凸/粗糙度
void main() {
  vec2 p = vUv;
  float lam = fbmP(vec2(p.x * 2.0, p.y * 40.0), vec2(2.0, 40.0));
  float band = 0.5 + 0.5 * sin(p.y * 6.2831853 * 14.0 + lam * 6.0);
  float grain = fbmP(p * 64.0, vec2(64.0));
  vec3 fr = voronoiP(p * 18.0, vec2(18.0));
  float frag = (1.0 - smoothstep(0.05, 0.12, fr.x)) * step(0.85, fr.z);
  vec3 cr = voronoiP(p * 9.0 + 0.3, vec2(9.0));
  float crack = (1.0 - smoothstep(0.0, 0.018, cr.y)) * step(0.35, fbmP(p * 3.0 + 5.0, vec2(3.0)));
  vec3 c = mix(vec3(0.38, 0.33, 0.27), vec3(0.56, 0.49, 0.40), band * 0.55 + grain * 0.45);
  c = mix(c, vec3(0.74, 0.66, 0.54), frag);
  c *= 1.0 - crack * 0.5;
  float bump = 0.5 + 0.25 * grain + 0.1 * band - 0.35 * crack + 0.12 * frag;
  if (uOut == 0) gl_FragColor = vec4(c, 1.0);
  else gl_FragColor = vec4(bump, 0.9, 0.0, 1.0);
}`;

// ---- 化石壳面纹理（u 沿螺线，v 绕管一圈）----
const SHELL_BAKE = /* glsl */ `
uniform float uTheta0;
uniform float uThetaMax;
uniform float uBody;
uniform float uRibs;
uniform int uOut;          // 0 颜色  1 凹凸/粗糙度/金属度  2 珍珠层遮罩

float fbmV(vec2 p, float pv) { return fbmP(p, vec2(4096.0, pv)); }   // 只在绕管方向上循环

void main() {
  float theta = mix(uTheta0, uThetaMax, vUv.x);
  float v = vUv.y;
  float phi = v * 6.2831853;
  float cp = cos(phi);
  float turns = theta / 6.2831853;
  vec2 q = vec2(turns * 24.0, v * 12.0);
  float n2 = fbmV(q, 12.0);
  float big = fbmV(vec2(turns * 5.0, v * 4.0), 4.0);
  float rib = pow(0.5 + 0.5 * cos(theta * uRibs), 5.0);
  float ribMask = smoothstep(-0.55, -0.05, cp) * (1.0 - 0.75 * smoothstep(0.72, 0.95, cp));
  float isBody = smoothstep(uBody - 0.2, uBody + 0.2, theta);

  // 原壳保存下来的区域；其余是外壳剥落后露出的内模
  float shellKeep = smoothstep(0.46, 0.54, big + 0.12 * isBody + 0.08 * (n2 - 0.5));
  // 围岩残留：脐部接缝、部分肋间凹处、零星斑块
  float seam = smoothstep(-0.7, -0.92, cp);
  float valley = (1.0 - rib) * ribMask * smoothstep(0.56, 0.66, fbmV(q * 0.5 + 3.0, 6.0));
  float patchM = smoothstep(0.63, 0.7, fbmV(vec2(turns * 9.0, v * 6.0) + 11.0, 6.0));
  float matrixM = clamp(max(seam * (0.55 + 0.7 * n2), patchM) + valley * 0.8, 0.0, 1.0);
  // 缝合线：隔壁与壳壁相交的褶皱线，带细碎的树枝状分叉；住室里没有
  float s = theta / 6.2831853 * 12.0;
  float lobe = 0.2 * sin(phi * 4.0) + 0.08 * sin(phi * 11.0 + 1.3) + 0.04 * sin(phi * 27.0 + 0.4);
  float frill = (fbmV(vec2(s * 6.0, v * 48.0), 48.0) - 0.5) * 0.1;
  float f = fract(s + lobe + frill);
  float sd = min(f, 1.0 - f);
  float lw = max(fwidth(s) * 1.2, 0.006);
  float suture = (1.0 - smoothstep(lw * 0.6, lw * 1.5, sd)) * (1.0 - isBody);
  // 黄铁矿斑点
  vec3 py = voronoiP(vec2(turns * 60.0, v * 40.0), vec2(4096.0, 40.0));
  float pyrite = (1.0 - smoothstep(0.08, 0.2, py.x)) * step(0.82, py.z) * (1.0 - matrixM);
  // 细裂纹
  vec3 cr = voronoiP(vec2(turns * 10.0, v * 8.0), vec2(4096.0, 8.0));
  float crack = (1.0 - smoothstep(0.0, 0.035, cr.y)) * step(0.5, fbmV(vec2(turns * 3.0, v * 2.0) + 7.0, 2.0));
  // 生长纹与珍珠层
  float growth = 0.5 + 0.5 * sin(theta * uRibs * 6.0 + n2 * 2.0);
  float nacre = shellKeep * smoothstep(0.5, 0.6, fbmV(vec2(turns * 7.0, v * 5.0) + 23.0, 5.0)) * (1.0 - matrixM);

  vec3 shellCol = mix(vec3(0.34, 0.22, 0.13), vec3(0.56, 0.38, 0.22), n2) * (0.88 + 0.14 * growth);
  shellCol *= 0.85 + 0.25 * rib * ribMask;
  vec3 nacreCol = mix(vec3(0.58, 0.54, 0.50), vec3(0.76, 0.71, 0.64), n2);
  vec3 steinCol = mix(vec3(0.60, 0.49, 0.35), vec3(0.74, 0.63, 0.46), n2);
  vec3 sutCol = vec3(0.28, 0.19, 0.12);
  vec3 matrixCol = mix(vec3(0.38, 0.37, 0.35), vec3(0.55, 0.53, 0.50), fbmV(q * 3.0, 36.0));
  vec3 pyCol = vec3(0.82, 0.68, 0.32);

  vec3 c = mix(steinCol, shellCol, shellKeep);
  c = mix(c, nacreCol, nacre);
  c = mix(c, sutCol, suture * 0.85 * (1.0 - shellKeep * 0.7));
  c = mix(c, pyCol, pyrite);
  c = mix(c, matrixCol, matrixM);
  c *= 1.0 - crack * 0.5;

  float rough = mix(0.7, 0.4, shellKeep);
  rough = mix(rough, 0.2, nacre);
  rough = mix(rough, 0.3, pyrite);
  rough = mix(rough, 0.95, matrixM);
  float bump = 0.5 + 0.15 * n2 + 0.1 * shellKeep - 0.12 * suture + 0.3 * matrixM * fbmV(q * 4.0, 48.0)
             - 0.25 * crack + 0.04 * growth * shellKeep + 0.08 * pyrite;

  if (uOut == 0) gl_FragColor = vec4(c, 1.0);
  else if (uOut == 1) gl_FragColor = vec4(bump, rough, pyrite, 1.0);
  else gl_FragColor = vec4(nacre, 0.0, 0.0, 1.0);
}`;

let cache = null;   // 纹理只烘焙一次，展品卸载后再出现时直接复用

function bakeShellTextures(renderer, shape) {
  if (cache) return cache;
  const uniforms = {
    uTheta0: { value: shape.theta0 },
    uThetaMax: { value: shape.thetaMax },
    uBody: { value: shape.bodyStart },
    uRibs: { value: SHAPE.ribsPerTurn },
    uOut: { value: 0 },
  };
  const bake = (out, srgb) => {
    uniforms.uOut.value = out;
    const t = bakeTexture(renderer, {
      width: 4096, height: 512, fragment: SHELL_BAKE, uniforms, srgb, wrap: THREE.ClampToEdgeWrapping,
    }).texture;
    t.userData.keep = true;
    return t;
  };
  cache = { color: bake(0, true), masks: bake(1, false), nacre: bake(2, false) };
  const mUniforms = { uOut: { value: 0 } };
  const bakeMatrix = (out, srgb) => {
    mUniforms.uOut.value = out;
    const t = bakeTexture(renderer, { width: 512, height: 512, fragment: MATRIX_BAKE, uniforms: mUniforms, srgb }).texture;
    t.userData.keep = true;
    return t;
  };
  cache.matrixColor = bakeMatrix(0, true);
  cache.matrixMasks = bakeMatrix(1, false);
  return cache;
}

export function buildAmmonite(exhibit, { renderer }) {
  const shape = shellGeometry(SHAPE);
  const tex = bakeShellTextures(renderer, shape);

  const shellMat = new THREE.MeshPhysicalMaterial({
    map: tex.color,
    roughnessMap: tex.masks,      // g 通道
    metalnessMap: tex.masks,      // b 通道
    bumpMap: tex.masks,           // r 通道
    bumpScale: 1.5,
    roughness: 1,
    metalness: 1,
    iridescence: 1,
    iridescenceMap: tex.nacre,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [250, 700],
  });

  const shell = new THREE.Mesh(shape.geometry, shellMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  const wallMat = new THREE.MeshStandardMaterial({ color: '#c9b79a', roughness: 0.6 });   // 壳壁断面：方解石
  const rockMat = new THREE.MeshStandardMaterial({
    map: tex.matrixColor, bumpMap: tex.matrixMasks, roughnessMap: tex.matrixMasks, bumpScale: 2, roughness: 1,
  });
  const capMesh = new THREE.Mesh(shape.cap, [wallMat, rockMat]);
  capMesh.castShadow = true;
  capMesh.receiveShadow = true;

  // 平放在地上。壳口朝向画面左侧、略微背对镜头，深色的断面几乎侧对视线，不会正对观者
  const fossil = new THREE.Group();
  fossil.add(shell, capMesh);
  fossil.rotation.y = 0.04;
  fossil.scale.setScalar(SCALE);
  fossil.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fossil, true);
  fossil.position.y = -box.min.y - 2;

  const group = new THREE.Group();
  group.add(fossil);
  const height = box.max.y - box.min.y;
  return { object: group, labelAnchor: new THREE.Vector3(box.max.x * 0.8, height * 1.2, 0) };
}
