// 石板上的印痕化石：狄更逊水母、卷曲藻、库克逊蕨、辽宁古果。
// 形态参考真实标本：
//   狄更逊水母 —— 椭圆形、左右两排节片沿中线错开半节（滑移对称），保存在砂岩层面上的浅浮雕
//   卷曲藻     —— 约 1 mm 宽的带状体盘成 2～3 圈松散的螺旋，黑色碳质薄膜，保存在赤铁质泥岩里
//   库克逊蕨   —— 几厘米高的细茎，二歧分叉 2～3 次，每个枝顶有一个肾形孢子囊
//   辽宁古果   —— 细长的主轴和侧枝，下部是细裂的叶，上部枝条上螺旋着生一串串小荚果（心皮）

import * as THREE from 'three';
import { buildSlab } from './slab.js';
import { placeOnGround } from './place.js';

// 可重复的伪随机数
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---------------------------------------------------------------- 狄更逊水母
const DICKINSONIA = /* glsl */ `
uniform vec4 uSpec[2];     // 中心 xy、体长、朝向
float dickinsonia(vec2 p, vec4 s, out float groove, out float inside) {
  vec2 q = p - s.xy;
  float cs = cos(s.w), sn = sin(s.w);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);
  float a = s.z * 0.5, b = s.z * 0.38;
  float e = length(q / vec2(a, b));
  inside = 1.0 - smoothstep(0.96, 1.02, e);
  float yn = q.y / b;
  // 节片从中线伸向边缘，向后弯；左右两侧错开半节
  float xs = q.x / a + 0.22 * yn * yn;
  float seg = (xs * 0.5 + 0.5) * 22.0 + (yn < 0.0 ? 0.5 : 0.0);
  float f = fract(seg);
  float segGroove = (1.0 - smoothstep(0.02, 0.22, min(f, 1.0 - f))) * smoothstep(0.04, 0.12, abs(yn)) * smoothstep(1.0, 0.85, e);
  float mid = 1.0 - smoothstep(0.0, 0.035, abs(yn));
  groove = max(segGroove, mid * smoothstep(-0.9, -0.7, q.x / a)) * inside;
  return inside * sqrt(max(0.0, 1.0 - e * e));
}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.60, 0.46, 0.33), vec3(0.80, 0.68, 0.52), h);      // 埃迪卡拉石英砂岩
  float stain = smoothstep(0.55, 0.75, f1(p * 0.02 + 7.0));
  col = mix(col, col * vec3(0.86, 0.62, 0.46), stain * 0.6);              // 铁质浸染
  for (int i = 0; i < 2; i++) {
    float g, inside;
    float d = dickinsonia(p, uSpec[i], g, inside);
    h += d * 0.14 - g * 0.07;
    col = mix(col, col * vec3(0.92, 0.8, 0.72), inside * 0.4);
    col *= 1.0 - g * 0.22;
  }
}`;

export function buildDickinsonia(exhibit, { renderer }) {
  const slab = buildSlab(renderer, {
    width: 440, depth: 330, relief: 42, seed: 3, side: '#8a6f55',
    surface: DICKINSONIA,
    uniforms: { uSpec: { value: [new THREE.Vector4(-40, 15, 250, 0.12), new THREE.Vector4(130, -85, 90, -0.7)] } },
  });
  return placeOnGround(slab, { yaw: -0.08, tilt: 0.12 });
}

// ---------------------------------------------------------------- 卷曲藻
const GRYPANIA = /* glsl */ `
uniform vec4 uCoil[COILS];  // 中心 xy、直径、起始角
float coilDist(vec2 p, vec4 s) {
  vec2 q = p - s.xy;
  float r = length(q);
  float th0 = mod(atan(q.y, q.x) + s.w, 6.2831853);
  float turns = 2.4;
  float r0 = s.z * 0.07, k = (s.z * 0.43 - r0) / (turns * 6.2831853);   // 最外圈半径约为直径的一半
  float best = 1e9;
  for (int n = 0; n < 4; n++) {
    float th = th0 + 6.2831853 * float(n);
    if (th <= turns * 6.2831853) best = min(best, abs(r - (r0 + k * th)));
  }
  return best;
}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.28, 0.12, 0.09), vec3(0.42, 0.20, 0.15), h);      // 赤铁质泥岩
  float band = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(p.y * 0.08 + f1(p * 0.01) * 5.0));
  col = mix(col, col * vec3(1.15, 0.9, 0.9), band * 0.35);                // 铁质条带
  for (int i = 0; i < COILS; i++) {
    float w = uCoil[i].z * 0.028;
    float d = coilDist(p, uCoil[i]);
    float rib = 1.0 - smoothstep(w * 0.55, w * 0.8, d);
    h += rib * 0.05;
    col = mix(col, vec3(0.10, 0.08, 0.08) * (0.9 + 0.2 * n1(p * 1.5)), rib * 0.9);
  }
}`;

export function buildGrypania(exhibit, { renderer }) {
  const r = rng(17);
  const coils = [];
  const spots = [[-120, 35, 150], [75, -40, 165], [155, 95, 85], [-150, -105, 80], [-15, 120, 70], [30, 30, 55]];
  for (const [x, y, s] of spots) coils.push(new THREE.Vector4(x, y, s, r() * 6.28));
  const slab = buildSlab(renderer, {
    width: 440, depth: 330, relief: 30, seed: 5, side: '#4d3029',
    surface: GRYPANIA, defines: `#define COILS ${coils.length}`,
    uniforms: { uCoil: { value: coils } },
  });
  return placeOnGround(slab, { yaw: 0.05, tilt: 0.12 });
}

// ---------------------------------------------------------------- 植物：线段 + 椭圆
// 线段 uSeg[i] = (ax, ay, bx, by)，uSegW[i] = (起点宽, 终点宽)；椭圆 uBlob[i] = (x, y, rx, ry)，uBlobA[i] = 角度
const STROKES = /* glsl */ `
uniform vec4 uSeg[SEGS];
uniform vec2 uSegW[SEGS];
uniform vec4 uBlob[BLOBS];
uniform float uBlobA[BLOBS];
float plantMask(vec2 p) {
  float m = 0.0;
  for (int i = 0; i < SEGS; i++) {
    float t;
    float d = sdSeg(p, uSeg[i].xy, uSeg[i].zw, t);
    float w = mix(uSegW[i].x, uSegW[i].y, t) * 0.5;
    m = max(m, 1.0 - smoothstep(w * 0.8, w * 1.15, d));
  }
  for (int i = 0; i < BLOBS; i++) {
    float e = ellipse(p, uBlob[i].xy, uBlob[i].zw, uBlobA[i]);
    m = max(m, 1.0 - smoothstep(0.85, 1.05, e));
  }
  return m;
}`;

function strokesUniforms(segs, blobs) {
  const pad = (arr, n, fill) => { while (arr.length < n) arr.push(fill()); return arr; };
  return {
    defines: `#define SEGS ${Math.max(1, segs.length)}\n#define BLOBS ${Math.max(1, blobs.length)}`,
    uniforms: {
      uSeg: { value: pad(segs.map((s) => new THREE.Vector4(s.a[0], s.a[1], s.b[0], s.b[1])), 1, () => new THREE.Vector4(9e4, 9e4, 9e4, 9e4)) },
      uSegW: { value: pad(segs.map((s) => new THREE.Vector2(s.w0, s.w1)), 1, () => new THREE.Vector2(0, 0)) },
      uBlob: { value: pad(blobs.map((b) => new THREE.Vector4(b.x, b.y, b.rx, b.ry)), 1, () => new THREE.Vector4(9e4, 9e4, 1, 1)) },
      uBlobA: { value: pad(blobs.map((b) => b.ang), 1, () => 0) },
    },
  };
}

// 一段略微弯曲的枝条，拆成几小段线段
function branch(segs, x, y, ang, len, w0, w1, bend, pieces = 4) {
  let cx = x, cy = y, a = ang;
  for (let i = 0; i < pieces; i++) {
    const l = len / pieces;
    const nx = cx + Math.cos(a) * l, ny = cy + Math.sin(a) * l;
    const t0 = i / pieces, t1 = (i + 1) / pieces;
    segs.push({ a: [cx, cy], b: [nx, ny], w0: w0 + (w1 - w0) * t0, w1: w0 + (w1 - w0) * t1 });
    cx = nx; cy = ny; a += bend / pieces;
  }
  return { x: cx, y: cy, ang: a };
}

// ---------------------------------------------------------------- 库克逊蕨
const COOKSONIA = /* glsl */ `
${STROKES}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.42, 0.44, 0.39), vec3(0.58, 0.58, 0.51), h);      // 灰绿色粉砂岩
  float m = plantMask(p);
  h += m * 0.05;
  col = mix(col, vec3(0.16, 0.12, 0.09) * (0.85 + 0.3 * n1(p * 0.8)), m * 0.92);
}`;

function cooksoniaPlants() {
  const r = rng(29);
  const segs = [], blobs = [];
  const grow = (x, y, ang, len, w, depth) => {
    const tip = branch(segs, x, y, ang, len, w, w * 0.92, (r() - 0.5) * 0.25, 3);
    if (depth === 0) {
      // 枝顶的肾形孢子囊：比茎宽，横向扁
      blobs.push({ x: tip.x + Math.cos(tip.ang) * w * 1.3, y: tip.y + Math.sin(tip.ang) * w * 1.3, rx: w * 1.4, ry: w * 2.4, ang: tip.ang });
      return;
    }
    const spread = 0.28 + r() * 0.2;
    grow(tip.x, tip.y, tip.ang + spread, len * (0.7 + r() * 0.15), w * 0.9, depth - 1);
    grow(tip.x, tip.y, tip.ang - spread, len * (0.7 + r() * 0.15), w * 0.9, depth - 1);
  };
  const plants = [[-150, -130, 1.45, 90, 5.5, 2], [-60, -140, 1.62, 110, 6, 3], [40, -135, 1.5, 80, 5, 2],
    [120, -125, 1.7, 95, 5.5, 2], [175, -70, 1.9, 60, 4.5, 1], [-190, 20, 0.2, 55, 4.5, 1]];
  for (const [x, y, a, l, w, d] of plants) grow(x, y, a, l, w, d);
  return { segs, blobs };
}

export function buildCooksonia(exhibit, { renderer }) {
  const { segs, blobs } = cooksoniaPlants();
  const { defines, uniforms } = strokesUniforms(segs, blobs);
  const slab = buildSlab(renderer, {
    width: 440, depth: 330, relief: 30, seed: 7, side: '#555a4d', surface: COOKSONIA, defines, uniforms,
  });
  return placeOnGround(slab, { yaw: 0.1, tilt: 0.14 });
}

// ---------------------------------------------------------------- 辽宁古果
const ARCHAEFRUCTUS = /* glsl */ `
${STROKES}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.76, 0.70, 0.56), vec3(0.88, 0.84, 0.72), h);      // 义县组的浅色湖相页岩
  float lam = smoothstep(0.4, 0.6, 0.5 + 0.5 * sin(p.y * 0.5 + f1(p * 0.015) * 4.0));
  col *= 0.95 + 0.07 * lam;                                               // 纹层
  float m = plantMask(p);
  h += m * 0.04;
  col = mix(col, vec3(0.30, 0.19, 0.10) * (0.8 + 0.4 * n1(p * 0.6)), m * 0.9);
}`;

function archaefructusPlant() {
  const r = rng(41);
  const segs = [], blobs = [];
  // 细裂的叶：叶柄上反复二叉，裂片细如丝
  const leaf = (x, y, ang, len, w, depth) => {
    const tip = branch(segs, x, y, ang, len, w, w * 0.8, (r() - 0.5) * 0.3, 2);
    if (depth === 0) return;
    const s = 0.35 + r() * 0.25;
    leaf(tip.x, tip.y, tip.ang + s, len * 0.72, w * 0.8, depth - 1);
    leaf(tip.x, tip.y, tip.ang - s, len * 0.72, w * 0.8, depth - 1);
  };
  // 生殖枝：上部螺旋着生一串荚果（心皮），下面一段是成对的雄蕊
  const fertile = (x, y, ang, len, w) => {
    const n = 10;
    let cx = x, cy = y, a = ang;
    for (let i = 0; i < n; i++) {
      const l = len / n;
      const nx = cx + Math.cos(a) * l, ny = cy + Math.sin(a) * l;
      segs.push({ a: [cx, cy], b: [nx, ny], w0: w, w1: w * 0.95 });
      const t = i / n;
      if (t > 0.35) {
        const side = i % 2 ? 1 : -1;
        const pa = a + side * (0.55 + r() * 0.2);
        const pl = 9 + r() * 3;
        blobs.push({ x: nx + Math.cos(pa) * pl, y: ny + Math.sin(pa) * pl, rx: pl, ry: pl * 0.34, ang: pa });
      } else if (t > 0.15) {
        const side = i % 2 ? 1 : -1;
        const pa = a + side * 0.9;
        segs.push({ a: [nx, ny], b: [nx + Math.cos(pa) * 7, ny + Math.sin(pa) * 7], w0: 1.2, w1: 1.0 });
      }
      cx = nx; cy = ny; a += (r() - 0.5) * 0.12;
    }
  };
  // 主轴：从左下向右上弯
  let cur = { x: -190, y: -120, ang: 0.75 };
  for (let k = 0; k < 5; k++) {
    const next = branch(segs, cur.x, cur.y, cur.ang, 70, 5 - k * 0.6, 4.4 - k * 0.6, -0.12, 3);
    if (k < 2) {
      leaf(next.x, next.y, next.ang + 1.0, 32, 2.2, 3);
      leaf(next.x, next.y, next.ang - 1.1, 30, 2.2, 3);
    } else {
      const side = k % 2 ? 1 : -1;
      fertile(next.x, next.y, next.ang + side * 0.6, 120 - k * 10, 2.4);
    }
    cur = next;
  }
  fertile(cur.x, cur.y, cur.ang, 110, 2.6);
  return { segs, blobs };
}

export function buildArchaefructus(exhibit, { renderer }) {
  const { segs, blobs } = archaefructusPlant();
  const { defines, uniforms } = strokesUniforms(segs, blobs);
  const slab = buildSlab(renderer, {
    width: 440, depth: 330, relief: 26, seed: 11, side: '#a89a7c', surface: ARCHAEFRUCTUS, defines, uniforms,
  });
  return placeOnGround(slab, { yaw: -0.05, tilt: 0.14 });
}
