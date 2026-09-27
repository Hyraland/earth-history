// 印痕化石的石板：化石画在显卡上烘焙的颜色 + 高度贴图里，
// 再把高度读回来顶起石板表面，低角度的阳光才能在浮雕上投出影子。
// 每种化石只需提供一段 GLSL：void surface(vec2 p, out vec3 col, out float h)
//   p 是石板上的坐标（单位同场景，原点在中心，+y 指向石板远端）；h = 0.5 是石板表面。

import * as THREE from 'three';
import { bakeTexture } from '../bake.js';

// 共用的 GLSL 工具：岩石底色、线段/椭圆的距离
export const SLAB_GLSL = /* glsl */ `
uniform int uOut;
uniform vec2 uSize;
float n1(vec2 p) { return noiseP(p, vec2(4096.0)); }
float f1(vec2 p) { return fbmP(p, vec2(4096.0)); }

// 岩石：大块色斑、颗粒、细微层理；h 输出表面起伏
vec3 rock(vec2 p, vec3 a, vec3 b, out float h) {
  float big = f1(p * 0.012 + 3.0);
  float grain = f1(p * 0.35);
  float fine = n1(p * 2.2);
  float lam = 0.5 + 0.5 * sin(p.y * 0.22 + f1(p * 0.02) * 6.0);
  vec3 c = mix(a, b, smoothstep(0.3, 0.7, big * 0.7 + grain * 0.3));
  c *= 0.9 + 0.2 * fine + 0.06 * lam;
  h = 0.5 + (grain - 0.5) * 0.025 + (fine - 0.5) * 0.008 + (big - 0.5) * 0.08;   // 岩面很平，化石的浮雕才显眼
  return c;
}

// 到线段的距离，t 输出投影位置（0..1）
float sdSeg(vec2 p, vec2 a, vec2 b, out float t) {
  vec2 pa = p - a, ba = b - a;
  t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}
// 旋转椭圆的归一化距离（<1 在内部）
float ellipse(vec2 p, vec2 c, vec2 r, float ang) {
  vec2 q = p - c;
  float cs = cos(ang), sn = sin(ang);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
  return length(q / r);
}
`;

// 石板外形：边缘略微崩缺，四周有倒角
function slabGeometry(width, depth, thickness, relief, heights, hw, hh, seed, grid) {
  const N = grid, M = Math.round((N * depth) / width);
  const sample = (u, v) => {
    const x = Math.min(hw - 1, Math.max(0, u * (hw - 1)));
    const y = Math.min(hh - 1, Math.max(0, v * (hh - 1)));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(hw - 1, x0 + 1), y1 = Math.min(hh - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    const at = (i, j) => heights[(j * hw + i) * 4] / 255;
    return (at(x0, y0) * (1 - fx) + at(x1, y0) * fx) * (1 - fy) + (at(x0, y1) * (1 - fx) + at(x1, y1) * fx) * fy;
  };
  const chip = (ang) => 0.045 * (Math.sin(ang * 3 + seed) + 0.6 * Math.sin(ang * 7 + seed * 2.1) + 0.35 * Math.sin(ang * 13 + seed * 0.7));

  const top = [], uvs = [];
  for (let j = 0; j <= M; j++) {
    for (let i = 0; i <= N; i++) {
      const u = i / N, v = j / M;
      const eu = 2 * u - 1, ev = 2 * v - 1;
      const edge = Math.max(Math.abs(eu), Math.abs(ev));
      const shrink = 1 - (0.05 + chip(Math.atan2(ev, eu))) * Math.pow(edge, 8);
      const bevel = THREE.MathUtils.smoothstep(edge, 0.92, 1) * thickness * 0.25;
      top.push(eu * 0.5 * width * shrink, (sample(u, v) - 0.5) * relief - bevel, -ev * 0.5 * depth * shrink);
      uvs.push(u, v);
    }
  }
  const idx = [];
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  topGeo.setIndex(idx);
  topGeo.computeVertexNormals();

  // 侧面：沿外圈顶点向下拉出一圈
  const ring = [];
  for (let i = 0; i <= N; i++) ring.push(i);                                  // v = 0
  for (let j = 1; j <= M; j++) ring.push(j * (N + 1) + N);                    // u = 1
  for (let i = N - 1; i >= 0; i--) ring.push(M * (N + 1) + i);                // v = 1
  for (let j = M - 1; j >= 1; j--) ring.push(j * (N + 1));                    // u = 0
  const side = [];
  ring.forEach((k) => {
    const x = top[k * 3], y = top[k * 3 + 1], z = top[k * 3 + 2];
    side.push(x, y, z, x * 1.02, -thickness, z * 1.02);
  });
  const sIdx = [];
  for (let r = 0; r < ring.length; r++) {
    const a = r * 2, b = ((r + 1) % ring.length) * 2;
    sIdx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const sideGeo = new THREE.BufferGeometry();
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(side, 3));
  sideGeo.setIndex(sIdx);
  sideGeo.computeVertexNormals();
  return { topGeo, sideGeo };
}

export function buildSlab(renderer, {
  width, depth, thickness = 26, relief = 40, surface, uniforms = {}, defines = '', side = '#6f6456', res = 1024, seed = 1, grid = 320,
}) {
  const u = { ...uniforms, uOut: { value: 0 }, uSize: { value: new THREE.Vector2(width, depth) } };
  const fragment = `${defines}\n${SLAB_GLSL}\n${surface}
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  vec3 c; float h;
  surface(p, c, h);
  if (uOut == 0) gl_FragColor = vec4(c, 1.0);
  else gl_FragColor = vec4(vec3(clamp(h, 0.0, 1.0)), 1.0);
}`;
  const hw = res, hh = Math.round((res * depth) / width);
  const color = bakeTexture(renderer, { width: hw, height: hh, fragment, uniforms: u, srgb: true, wrap: THREE.ClampToEdgeWrapping });
  u.uOut.value = 1;
  const height = bakeTexture(renderer, { width: hw, height: hh, fragment, uniforms: u, wrap: THREE.ClampToEdgeWrapping });
  const px = new Uint8Array(hw * hh * 4);
  renderer.readRenderTargetPixels(height.rt, 0, 0, hw, hh, px);

  const { topGeo, sideGeo } = slabGeometry(width, depth, thickness, relief, px, hw, hh, seed, grid);
  const topMat = new THREE.MeshStandardMaterial({
    map: color.texture, bumpMap: height.texture, bumpScale: 1.5, roughness: 0.88,
  });
  const sideMat = new THREE.MeshStandardMaterial({ color: side, roughness: 0.95 });
  const slab = new THREE.Group();
  const topMesh = new THREE.Mesh(topGeo, topMat);
  const sideMesh = new THREE.Mesh(sideGeo, sideMat);
  for (const m of [topMesh, sideMesh]) { m.castShadow = true; m.receiveShadow = true; }
  slab.add(topMesh, sideMesh);
  return slab;
}
