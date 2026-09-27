// 鳞木（Lepidodendron）：一段倒在地上的石化树干。
// 树皮上是纵向拉长的菱形叶座，沿螺旋线交错排列；每个叶座上部有一个菱形叶痕，下方一道细棱。
// 两端是参差的断口，露出深色的围岩填充。

import * as THREE from 'three';
import { bakeTexture } from '../bake.js';
import { placeOnGround } from './place.js';

const LENGTH = 440;
const RADIUS = 44;
const SCALE = 1.8;         // 整体放大
const AROUND = 26;        // 一圈的叶座数（必须是整数，贴图才能首尾相接）

// 贴图坐标：u 绕树干一圈（0..1），v 沿树干（0..1）
const BARK = /* glsl */ `
uniform int uOut;
uniform float uAround;
uniform float uAlong;     // 沿树干的叶座行数
void main() {
  vec2 g = vec2(vUv.x * uAround, vUv.y * uAlong);
  // 旋转 45° 的格子：每个格子在树皮上是一个纵向拉长的菱形
  vec2 d = vec2(g.x + g.y, g.y - g.x);
  vec2 cell = floor(d);
  vec2 f = fract(d) - 0.5;
  float border = 0.5 - max(abs(f.x), abs(f.y));             // 到叶座边缘的距离
  float cushion = smoothstep(0.02, 0.12, border);
  float groove = 1.0 - smoothstep(0.0, 0.05, border);
  // 叶座内的局部坐标：a 沿树干，c 绕树干
  float a = f.x + f.y, c = f.x - f.y;
  // 叶痕：叶座上部三分之一处的菱形，里面有两个通气痕小点
  float sd = abs(a - 0.22) * 0.55 + abs(c);
  float scar = 1.0 - smoothstep(0.13, 0.16, sd);
  float scarRim = (1.0 - smoothstep(0.0, 0.03, abs(sd - 0.15)));
  float dots = (1.0 - smoothstep(0.02, 0.035, length(vec2(a - 0.2, c - 0.045) * vec2(0.5, 1.0))))
             + (1.0 - smoothstep(0.02, 0.035, length(vec2(a - 0.2, c + 0.045) * vec2(0.5, 1.0))));
  float keel = (1.0 - smoothstep(0.0, 0.02, abs(c))) * smoothstep(0.05, -0.3, a) * cushion;   // 叶痕下方的细棱
  float grain = fbmP(vUv * vec2(64.0, 96.0), vec2(64.0, 4096.0));
  float blotch = fbmP(vUv * vec2(4.0, 6.0) + 3.0, vec2(4.0, 4096.0));
  float jitter = bk_hash(mod(cell, vec2(uAround * 2.0, 4096.0)));

  vec3 base = mix(vec3(0.34, 0.27, 0.20), vec3(0.50, 0.41, 0.31), blotch);
  vec3 col = mix(base * 0.35, base * (0.95 + 0.15 * jitter), cushion);
  col = mix(col, base * 0.62, scar);
  col = mix(col, vec3(0.12, 0.10, 0.08), scarRim * 0.8 + dots * 0.9);
  col *= 1.0 - keel * 0.4 - groove * 0.3;
  col *= 0.9 + 0.2 * grain;
  float h = 0.5 + cushion * 0.35 - groove * 0.1 - scar * 0.12 + scarRim * 0.04 - dots * 0.06 - keel * 0.08 + (grain - 0.5) * 0.05;
  if (uOut == 0) gl_FragColor = vec4(col, 1.0);
  else gl_FragColor = vec4(vec3(clamp(h, 0.0, 1.0)), 1.0);
}`;

function bakeBark(renderer) {
  const along = Math.round(LENGTH / ((2 * Math.PI * RADIUS) / AROUND) / 2.4);   // 叶座纵向约为横向的 2.4 倍
  const uniforms = { uOut: { value: 0 }, uAround: { value: AROUND }, uAlong: { value: along } };
  const opts = { width: 1024, height: 2048, fragment: BARK, uniforms };
  const color = bakeTexture(renderer, { ...opts, srgb: true });
  uniforms.uOut.value = 1;
  const height = bakeTexture(renderer, opts);
  const px = new Uint8Array(1024 * 2048 * 4);
  renderer.readRenderTargetPixels(height.rt, 0, 0, 1024, 2048, px);
  return { color: color.texture, height: height.texture, px };
}

function trunkGeometry(px) {
  const SEG_A = 220, SEG_L = 360;
  const sample = (u, v) => {
    const x = Math.round(((u % 1) + 1) % 1 * 1023), y = Math.min(2047, Math.max(0, Math.round(v * 2047)));
    return px[(y * 1024 + x) * 4] / 255;
  };
  // 断口：两端沿轴向参差不齐
  const breakAt = (ang, end) => 16 * (Math.sin(ang * 3 + end * 2) * 0.6 + Math.sin(ang * 7 + end) * 0.3 + Math.sin(ang * 13) * 0.15);
  const pos = [], uv = [];
  for (let j = 0; j <= SEG_L; j++) {
    const v = j / SEG_L;
    for (let i = 0; i <= SEG_A; i++) {
      const u = i / SEG_A;
      const ang = u * Math.PI * 2;
      const taper = 1 - 0.18 * v;                                     // 一端略细
      const endBreak = v < 0.02 ? breakAt(ang, 0) * (1 - v / 0.02) : v > 0.98 ? breakAt(ang, 1) * ((v - 0.98) / 0.02) : 0;
      const r = RADIUS * taper * (1 + (sample(u, v) - 0.5) * 0.09) * (1 + 0.03 * Math.sin(v * 9 + ang * 2));
      const x = (v - 0.5) * LENGTH + (v < 0.5 ? endBreak : -endBreak);
      pos.push(x, Math.sin(ang) * r * 0.82, Math.cos(ang) * r);   // 化石树干常被压扁
      uv.push(u, v);
    }
  }
  const idx = [];
  const row = SEG_A + 1;
  for (let j = 0; j < SEG_L; j++) {
    for (let i = 0; i < SEG_A; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  // 两端封口：用最外一圈顶点做扇形，中心略微凹进
  const caps = [];
  for (const [j, dir] of [[0, 1], [SEG_L, -1]]) {
    const ring = [];
    for (let i = 0; i <= SEG_A; i++) ring.push(new THREE.Vector3().fromArray(pos, (j * row + i) * 3));
    const center = ring.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
    center.x += dir * 6;
    const verts = [center.x, center.y, center.z];
    ring.forEach((p) => verts.push(p.x, p.y, p.z));
    const cIdx = [];
    for (let i = 1; i <= SEG_A; i++) cIdx.push(0, i, i + 1);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    cg.setIndex(cIdx);
    // 朝外
    const n = new THREE.Vector3().subVectors(ring[1], center).cross(new THREE.Vector3().subVectors(ring[2], center));
    if (n.x * -dir < 0) { for (let k = 0; k < cIdx.length; k += 3) [cIdx[k + 1], cIdx[k + 2]] = [cIdx[k + 2], cIdx[k + 1]]; cg.setIndex(cIdx); }
    cg.computeVertexNormals();
    caps.push(cg);
  }
  return { trunk: g, caps };
}

export function buildLepidodendron(exhibit, { renderer }) {
  const bark = bakeBark(renderer);
  const { trunk, caps } = trunkGeometry(bark.px);
  const mat = new THREE.MeshStandardMaterial({ map: bark.color, bumpMap: bark.height, bumpScale: 2.5, roughness: 0.95, envMapIntensity: 0.45 });
  const endMat = new THREE.MeshStandardMaterial({ color: '#3b3630', roughness: 0.95 });
  const log = new THREE.Group();
  const trunkMesh = new THREE.Mesh(trunk, mat);
  log.add(trunkMesh);
  caps.forEach((c) => log.add(new THREE.Mesh(c, endMat)));
  log.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  log.rotation.x = 0.4;          // 绕自身轴转一点，叶座的排列不那么规整
  log.scale.setScalar(SCALE);
  return placeOnGround(log, { yaw: -0.22, sink: 0.22 });
}
