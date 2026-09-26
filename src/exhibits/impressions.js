// 石板上的化石：狄更逊水母、卷曲藻、库克逊蕨、辽宁古果、提塔利克鱼，以及蜥脚类足迹。
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

// ---------------------------------------------------------------- 提塔利克鱼
// 参照 NUFV 108 等标本：扁平的三角形头部，眼眶长在头顶；头骨由一块块骨板拼成；
// 肩带后面是肉质的胸鳍，里面有肱骨、桡骨、尺骨，末端是鳍条；身体覆盖菱形鳞片，尾部有鳍条。
const TIKTAALIK = /* glsl */ `
uniform vec2 uSpine[SPINE];
// 沿脊柱的坐标：t 从吻端 0 到尾端 1，s 是到脊柱的有符号距离
void spineCoord(vec2 p, out float t, out float s) {
  float best = 1e9;
  t = 0.0; s = 0.0;
  for (int i = 0; i < SPINE - 1; i++) {
    vec2 a = uSpine[i], b = uSpine[i + 1], ba = b - a;
    float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 d = p - (a + ba * h);
    float dist = length(d);
    if (dist < best) {
      best = dist;
      t = (float(i) + h) / float(SPINE - 1);
      s = sign(ba.x * d.y - ba.y * d.x) * dist;
    }
  }
}
float halfWidth(float t) {
  float head = 6.0 + 40.0 * pow(clamp(t / 0.17, 0.0, 1.0), 0.6);           // 三角形的扁头
  float trunk = mix(46.0, 30.0, smoothstep(0.17, 0.62, t));
  float tail = mix(30.0, 4.0, smoothstep(0.62, 1.0, t));
  return t < 0.17 ? head : (t < 0.62 ? trunk : tail);
}
// 肉鳍：沿鳍轴有一串骨头，末端散开成鳍条
void lobeFin(vec2 p, vec2 base, float ang, float len, float wid, inout float m, inout float bone, inout float rays) {
  vec2 q = p - base;
  float cs = cos(ang), sn = sin(ang);
  q = vec2(cs * q.x + sn * q.y, -sn * q.x + cs * q.y);               // x 沿鳍轴
  float fx = q.x / len;
  float e = length(vec2((q.x - len * 0.5) / (len * 0.5), q.y / wid));
  float inFin = (1.0 - smoothstep(0.9, 1.05, e)) * step(0.0, q.x);
  m = max(m, inFin);
  float axis = (1.0 - smoothstep(wid * 0.18, wid * 0.3, abs(q.y))) * step(fx, 0.62);
  float joints = smoothstep(0.02, 0.05, abs(fract(fx * 3.4) - 0.5) );   // 骨头之间的关节
  bone = max(bone, inFin * axis * joints);
  float fan = q.y / (q.x + len * 0.15);
  rays = max(rays, inFin * smoothstep(0.5, 0.75, fx) * (1.0 - smoothstep(0.1, 0.3, abs(fract(fan * 9.0) - 0.5))));
}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.50, 0.30, 0.22), vec3(0.62, 0.41, 0.31), h);      // 弗拉姆组的红褐色粉砂岩
  float t, s;
  spineCoord(p, t, s);
  float w = halfWidth(t);
  float body = (1.0 - smoothstep(w - 2.0, w + 1.0, abs(s))) * step(t, 0.999);
  float dome = sqrt(max(0.0, 1.0 - (s / max(w, 1.0)) * (s / max(w, 1.0))));
  float u = t * uLen;

  // 尾鳍：尾部上下两侧的鳍条
  float finW = w + 16.0 * smoothstep(0.72, 0.88, t) * (1.0 - smoothstep(0.97, 1.0, t));
  float tailFin = (1.0 - smoothstep(finW - 2.0, finW, abs(s))) * (1.0 - body) * step(0.72, t);
  float tailRays = tailFin * (1.0 - smoothstep(0.15, 0.35, abs(fract(u * 0.35) - 0.5)));

  // 头骨：骨板缝线、头顶的眼眶、鼻孔
  float head = body * (1.0 - smoothstep(0.17, 0.2, t));
  vec3 plates = voronoiP(vec2(u, s) / 11.0 + 3.0, vec2(4096.0));
  float suture = head * (1.0 - smoothstep(0.0, 0.07, plates.y));
  vec2 eye = vec2(u - uLen * 0.1, abs(s) - w * 0.4);
  float orbit = head * (1.0 - smoothstep(0.85, 1.05, length(eye / vec2(7.5, 5.5))));
  float nostril = head * (1.0 - smoothstep(0.7, 1.0, length(vec2(u - uLen * 0.028, abs(s) - w * 0.45) / 2.2)));

  // 鳞片：身体上斜向交错的菱形
  float k1 = fract(u / 7.0 + s / 11.0), k2 = fract(u / 7.0 - s / 11.0);
  float scaleEdge = body * step(0.19, t) * (1.0 - smoothstep(0.0, 0.07, min(min(k1, 1.0 - k1), min(k2, 1.0 - k2))));

  // 胸鳍和腹鳍（左右各一）
  float fin = 0.0, finBone = 0.0, finRays = 0.0;
  lobeFin(p, uPect[0], uPectAng[0], 62.0, 15.0, fin, finBone, finRays);
  lobeFin(p, uPect[1], uPectAng[1], 62.0, 15.0, fin, finBone, finRays);
  lobeFin(p, uPelv[0], uPelvAng[0], 34.0, 9.0, fin, finBone, finRays);
  lobeFin(p, uPelv[1], uPelvAng[1], 34.0, 9.0, fin, finBone, finRays);
  fin *= 1.0 - body;

  vec3 boneCol = vec3(0.17, 0.14, 0.12) * (0.85 + 0.3 * n1(p * 0.9));
  vec3 c = col;
  c = mix(c, boneCol, max(body, fin * 0.9) * 0.92);
  c = mix(c, boneCol * 0.9, (tailFin) * 0.75);
  c = mix(c, boneCol * 1.35, finBone * 0.8);
  c *= 1.0 - (suture * 0.45 + scaleEdge * 0.35 + finRays * 0.3 + tailRays * 0.3);
  c = mix(c, vec3(0.10, 0.08, 0.07), orbit * 0.85 + nostril * 0.8);
  col = c;
  h += body * (0.10 * dome + 0.03) + fin * 0.05 + finBone * 0.03 + tailFin * 0.03
     - suture * 0.02 - orbit * 0.08 - nostril * 0.04 - scaleEdge * 0.015 - finRays * 0.01;
}`;

export function buildTiktaalik(exhibit, { renderer }) {
  // 脊柱：头朝右（行走方向），身体微微弯成 S 形
  const N = 18, L = 380;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push(new THREE.Vector2(175 - L * t, 30 * Math.sin(t * Math.PI * 1.4 + 0.4) - 12));
  }
  const at = (t) => {
    const f = t * (N - 1), i = Math.min(N - 2, Math.floor(f)), k = f - i;
    return pts[i].clone().lerp(pts[i + 1], k);
  };
  const dirAt = (t) => at(Math.min(1, t + 0.01)).sub(at(Math.max(0, t - 0.01))).normalize();
  // 鳍的根部在身体两侧，鳍轴向后外方张开
  const finPair = (t, w, spread) => {
    const c = at(t), d = dirAt(t), n = new THREE.Vector2(-d.y, d.x);
    const back = Math.atan2(d.y, d.x);                              // 朝尾部的方向
    return {
      base: [c.clone().addScaledVector(n, -w), c.clone().addScaledVector(n, w)],
      ang: [back - spread, back + spread],
    };
  };
  const pect = finPair(0.22, 42, 0.75);
  const pelv = finPair(0.58, 30, 0.6);
  const slab = buildSlab(renderer, {
    width: 460, depth: 340, relief: 40, seed: 19, side: '#6d5244',
    surface: TIKTAALIK, defines: `#define SPINE ${N}\nuniform float uLen;\nuniform vec2 uPect[2];\nuniform float uPectAng[2];\nuniform vec2 uPelv[2];\nuniform float uPelvAng[2];`,
    uniforms: {
      uSpine: { value: pts }, uLen: { value: L },
      uPect: { value: pect.base }, uPectAng: { value: pect.ang },
      uPelv: { value: pelv.base }, uPelvAng: { value: pelv.ang },
    },
  });
  return placeOnGround(slab, { yaw: 0.04, tilt: 0.16 });
}

// ---------------------------------------------------------------- 蜥脚类足迹
// 一只蜥脚类走过潮湿的泥滩：后脚印是一个大圆盆（前缘略宽，外侧有爪痕，周围挤出一圈泥缘），
// 前脚印是马蹄形，落在后脚印的前外侧；左右脚印紧靠中线，是侏罗纪常见的"窄轨"行迹（Parabrontopodus 型）。
// 一只大型兽脚类的三趾脚印斜着穿过岩面。岩面上有泥滩的波痕。
const TRACKWAY = /* glsl */ `
uniform vec4 uPes[PES];      // x, y, 朝向, 左右（-1/1）
uniform vec4 uManus[PES];
uniform vec4 uThero[THERO];
vec2 toLocal(vec2 p, vec4 s) {
  vec2 q = p - s.xy;
  float c = cos(s.z), sn = sin(s.z);
  return vec2(c * q.x + sn * q.y, -sn * q.x + c * q.y);             // x 朝前，y 朝左
}
// 返回凹陷深度（0..1），rim 输出挤出的泥缘
float pesPrint(vec2 q, float side, out float rim) {
  vec2 r = vec2(29.0, 23.0 + 3.5 * clamp(q.x / 29.0, -1.0, 1.0));
  float e = length(q / r);
  float d = 1.0 - smoothstep(0.72, 1.0, e);
  // 爪痕：前外侧三道短短的凹痕
  for (int i = 0; i < 3; i++) {
    float a = 0.35 + 0.35 * float(i);
    vec2 dir = vec2(cos(a), side * -sin(a));
    float t;
    float dist = sdSeg(q, dir * 24.0, dir * 30.0, t);
    d = max(d, (1.0 - smoothstep(1.2, 2.6, dist)) * 0.5);
  }
  rim = smoothstep(0.95, 1.08, e) * (1.0 - smoothstep(1.1, 1.45, e));
  return d;
}
float manusPrint(vec2 q, out float rim) {
  vec2 c = q / vec2(14.0, 20.0);
  float rr = length(c);
  float band = 1.0 - smoothstep(0.28, 0.42, abs(rr - 0.72));         // 马蹄形的一圈
  float open = smoothstep(-0.45, 0.05, c.x);                          // 后方开口
  float d = max(band * open, (1.0 - smoothstep(0.55, 0.8, rr)) * 0.45);
  rim = smoothstep(1.0, 1.15, rr) * (1.0 - smoothstep(1.15, 1.5, rr));
  return d;
}
float theroPrint(vec2 q, out float rim) {
  float d = 0.0;
  rim = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = (float(i) - 1.0) * 0.42;
    float len = i == 1 ? 34.0 : 26.0;
    vec2 dir = vec2(cos(a), sin(a));
    float t;
    float dist = sdSeg(q, vec2(0.0), dir * len, t);
    float w = mix(6.5, 2.0, t);
    d = max(d, 1.0 - smoothstep(w * 0.75, w, dist));
    rim = max(rim, (1.0 - smoothstep(w, w + 5.0, dist)) * smoothstep(w * 0.9, w * 1.1, dist));
  }
  float heel = 1.0 - smoothstep(0.8, 1.0, length((q + vec2(3.0, 0.0)) / vec2(10.0, 8.0)));
  return max(d, heel);
}
void surface(vec2 p, out vec3 col, out float h) {
  col = rock(p, vec3(0.55, 0.46, 0.36), vec3(0.69, 0.59, 0.46), h);  // 土黄色的泥质粉砂岩
  // 泥滩波痕
  float rip = 0.5 + 0.5 * sin(dot(p, vec2(0.28, 0.12)) + f1(p * 0.01) * 6.0);
  h += (rip - 0.5) * 0.02;
  col *= 0.96 + 0.08 * rip;

  float depth = 0.0, rim = 0.0, rr;
  for (int i = 0; i < PES; i++) {
    depth = max(depth, pesPrint(toLocal(p, uPes[i]), uPes[i].w, rr) * 0.9);
    rim = max(rim, rr);
    depth = max(depth, manusPrint(toLocal(p, uManus[i]), rr) * 0.62);
    rim = max(rim, rr * 0.7);
  }
  for (int i = 0; i < THERO; i++) {
    depth = max(depth, theroPrint(toLocal(p, uThero[i]), rr) * 0.55);
    rim = max(rim, rr * 0.6);
  }
  h += rim * 0.05 * (1.0 - depth) - depth * 0.26;
  // 脚印里的泥更潮湿、颜色更深，最深处积了一点水
  col = mix(col, col * vec3(0.72, 0.72, 0.74), smoothstep(0.1, 0.6, depth));
  col = mix(col, vec3(0.22, 0.25, 0.27), smoothstep(0.8, 0.95, depth) * 0.6);
  col *= 1.0 + rim * 0.06;
}`;

export function buildTrackway(exhibit, { renderer }) {
  const r = rng(53);
  // 蜥脚类：沿一条缓缓弯曲的路线向右（行走方向）走
  const pes = [], manus = [];
  const route = (x) => -25 + 18 * Math.sin(x / 240);
  for (let i = 0, x = -300; x <= 300; i++, x += 72) {
    const y = route(x), ang = Math.atan2(route(x + 1) - y, 1);
    const side = i % 2 ? 1 : -1;                                        // 1 = 左脚
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const px = x + nx * side * 20, py = y + ny * side * 20;
    pes.push(new THREE.Vector4(px, py, ang + side * 0.12 + (r() - 0.5) * 0.08, side));
    manus.push(new THREE.Vector4(px + Math.cos(ang) * 36 + nx * side * 12, py + Math.sin(ang) * 36 + ny * side * 12, ang + side * 0.3, side));
  }
  // 兽脚类：斜穿过岩面
  const thero = [];
  const a0 = -0.62, dx = Math.cos(a0), dy = Math.sin(a0);
  for (let i = 0; i < 8; i++) {
    const t = -260 + i * 72, side = i % 2 ? 1 : -1;
    thero.push(new THREE.Vector4(-40 + dx * t - dy * side * 9, 20 + dy * t + dx * side * 9, a0 + side * 0.08, side));
  }
  const slab = buildSlab(renderer, {
    width: 720, depth: 380, relief: 40, thickness: 14, seed: 37, side: '#6e5f4c',
    surface: TRACKWAY, defines: `#define PES ${pes.length}\n#define THERO ${thero.length}`,
    uniforms: { uPes: { value: pes }, uManus: { value: manus }, uThero: { value: thero } },
  });
  return placeOnGround(slab, { yaw: 0.02, tilt: 0.1, sink: 0.45 });   // 大半埋进地里，像地表露出的一层岩面
}
