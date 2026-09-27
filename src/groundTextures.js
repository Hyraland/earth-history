// 地面用的贴图：
//   细节贴图（可平铺）：斑驳、龟裂、树冠 —— 近处按 128 单位平铺，中景按 1024 单位再采样一次
//   宏观贴图（可平铺，覆盖 4096 单位）：植被分布、水域、河网、岩层露头、沙丘扰动、熔岩湖
//   年代查找表：沿行走方向的每一段地貌参数，着色器按 x 直接查表，不再逐像素循环混合

import * as THREE from 'three';
import { bakeTexture } from './bake.js';

const DETAIL = /* glsl */ `
void main() {
  vec2 p = vUv;
  float mott = fbmP(p * 8.0, vec2(8.0));                              // 斑驳、细颗粒
  vec3 cr = voronoiP(p * 14.0 + 0.37, vec2(14.0));
  float edge = clamp(cr.y * 4.0, 0.0, 1.0);                           // 龟裂：0 在裂缝上
  vec3 tr = voronoiP(p * 26.0 + 3.3, vec2(26.0));
  float crown = 1.0 - smoothstep(0.1, 0.7, tr.x);                     // 树冠
  gl_FragColor = vec4(mott, edge, crown, tr.z);
}`;

const MACRO1 = /* glsl */ `
void main() {
  vec2 p = vUv;
  float veg = fbmP(p * 20.0, vec2(20.0));
  float water = fbmP(p * 16.0 + 5.0, vec2(16.0));
  vec2 warp = vec2(fbmP(p * 4.0, vec2(4.0)), fbmP(p * 4.0 + 9.0, vec2(4.0)));
  vec2 cw = p * 5.0 + warp * 1.4;
  float r1 = 1.0 - abs(2.0 * noiseP(cw, vec2(5.0)) - 1.0);
  float r2 = 1.0 - abs(2.0 * noiseP(cw * 2.0 + 5.0, vec2(10.0)) - 1.0);
  gl_FragColor = vec4(veg, water, smoothstep(0.85, 1.0, r1), smoothstep(0.85, 1.0, r2));
}`;

const MACRO2 = /* glsl */ `
void main() {
  vec2 p = vUv;
  gl_FragColor = vec4(
    fbmP(p * 9.0 + 3.1, vec2(9.0)),      // 大块明暗
    fbmP(p * 14.0 + 11.0, vec2(14.0)),   // 岩层露头的"等高线"场
    fbmP(p * 16.0, vec2(16.0)),          // 沙丘走向的扰动
    fbmP(p * 11.0 + 5.0, vec2(11.0)));   // 熔岩湖分布
}`;

export function bakeGroundTextures(renderer) {
  return {
    detail: bakeTexture(renderer, { width: 1024, height: 1024, fragment: DETAIL }).texture,
    macro1: bakeTexture(renderer, { width: 1024, height: 1024, fragment: MACRO1 }).texture,
    macro2: bakeTexture(renderer, { width: 1024, height: 1024, fragment: MACRO2 }).texture,
  };
}

// 年代查找表：7 行 × LUT_W 列（半精度浮点，可线性插值）
//   行 0 岩土色 a · 行 1 岩土色 b · 行 2 植被色 · 行 3 水色 · 行 4 植被/乔木/水/熔岩 · 行 5 冰/沙丘/龟裂/露头 · 行 6 野花/开花的树/农田/现代农业
export const ERA_ROWS = 7;
const LUT_W = 2048;
const BLEND = 160;

export function buildEraLut(palette, walkLength) {
  const lin = (hex, fallback) => new THREE.Color(hex ?? fallback);   // sRGB → 线性
  const entries = palette.map((p) => ({
    x: p.x,
    rows: [
      [...lin(p.a).toArray(), 1],
      [...lin(p.b).toArray(), 1],
      [...lin(p.v, '#556b3a').toArray(), 1],
      [...lin(p.wc, '#1f4a5a').toArray(), 1],
      [p.veg ?? 0, p.tree ?? 0, p.water ?? 0, p.lava ?? 0],
      [p.ice ?? 0, p.dunes ?? 0, p.cracks ?? 0, p.rock ?? 0],
      [p.flowers ?? 0, p.blossom ?? 0, p.fields ?? 0, p.modern ?? 0],
    ],
  }));
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  const data = new Uint16Array(LUT_W * ERA_ROWS * 4);
  for (let i = 0; i < LUT_W; i++) {
    const x = (i / (LUT_W - 1)) * walkLength;
    const acc = entries[0].rows.map((r) => r.slice());
    for (let k = 1; k < entries.length; k++) {
      const t = smooth(entries[k].x - BLEND, entries[k].x + BLEND, x);
      if (t === 0) continue;
      for (let r = 0; r < ERA_ROWS; r++) {
        for (let c = 0; c < 4; c++) acc[r][c] += (entries[k].rows[r][c] - acc[r][c]) * t;
      }
    }
    for (let r = 0; r < ERA_ROWS; r++) {
      for (let c = 0; c < 4; c++) data[(r * LUT_W + i) * 4 + c] = THREE.DataUtils.toHalfFloat(acc[r][c]);
    }
  }
  const tex = new THREE.DataTexture(data, LUT_W, ERA_ROWS, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
