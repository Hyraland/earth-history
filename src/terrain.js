// 地面：一片随地球曲率弯曲的平原。几何上只有很缓的起伏，外加远处地平线上的一道断层崖。
// 地貌细节来自启动时烘焙好的贴图（见 groundTextures.js）：每个像素只采样几次贴图，
// 再按年代查找表（岩土、植被、水、冰、沙丘、熔岩……）组合出当时的地表。
// 高度函数在 GLSL 与 JS 中各写一份（rawHeight），JS 版用于摆放展品和小人。

import * as THREE from 'three';

export const CURVE_R = 16000;     // 弯曲半径：越小地平线越弯
export const SCARP_Z = -2900;     // 远处断层崖的位置
export const SCARP_H = 150;       // 断层崖高度
const GRID_STEP = 10;             // x 方向网格间距；滚动按它对齐，避免地形"游动"
const HALF_W = 3200;
const NEAR_Z = -300;
const FAR_Z = -4200;
const ROWS = 240;

// ------------------------------------------------------------------ 顶点：高度与曲率
const NOISE_GLSL = /* glsl */ `
float th_hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float th_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = th_hash(i);
  float b = th_hash(i + vec2(1.0, 0.0));
  float c = th_hash(i + vec2(0.0, 1.0));
  float d = th_hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float th_fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * th_noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
`;

const HEIGHT_GLSL = /* glsl */ `
uniform float uSnap;
uniform float uFrac;
uniform float uR;

// 与 JS 的 rawHeight 保持一致
float th_height(vec2 w) {
  float H = (th_fbm(w / 500.0) - 0.5) * 10.0 + (th_noise(w / 90.0) - 0.5) * 2.0;   // 平原的缓起伏
  float line = ${SCARP_Z.toFixed(1)} + (th_fbm(vec2(w.x / 500.0, 5.0)) - 0.5) * 700.0;
  float up = smoothstep(line + 20.0, line - 20.0, w.y);                           // 断层崖
  float top = ${SCARP_H.toFixed(1)} + (th_noise(vec2(w.x / 220.0, 9.0)) - 0.5) * 80.0;
  return H + up * top;
}

#ifdef TERRAIN_COLOR
varying vec2 vW;
varying float vH;
varying vec3 vNw;
#endif

void terrainDisplace(vec3 pos, out vec3 outPos, out vec3 outNrm) {
  vec2 w = vec2(pos.x + uSnap, pos.z);
  float h = th_height(w);
  float e = 2.0 + 0.008 * abs(pos.z);
  float hx = th_height(w + vec2(e, 0.0)) - th_height(w - vec2(e, 0.0));
  float hz = th_height(w + vec2(0.0, e)) - th_height(w - vec2(0.0, e));
  outNrm = normalize(vec3(-hx, 2.0 * e, -hz));
  float lx = pos.x - uFrac;
  float bend = (lx * lx + pos.z * pos.z) / (2.0 * uR);
  outPos = vec3(lx, h - bend, pos.z);
#ifdef TERRAIN_COLOR
  vW = w; vH = h; vNw = outNrm;
#endif
}
`;

// ------------------------------------------------------------------ 片元：地表
const COLOR_GLSL = /* glsl */ `
uniform sampler2D uDet;     // 细节（可平铺）：r 斑驳  g 龟裂距离  b 树冠  a 树的随机值
uniform sampler2D uMac1;    // 宏观：r 植被分布  g 水域  b 主河道  a 支流
uniform sampler2D uMac2;    // 宏观：r 大块明暗  g 岩层露头场  b 沙丘扰动  a 熔岩湖
uniform sampler2D uEra;     // 年代查找表
uniform float uWalkLen;
uniform float uRifts[RIFT_COUNT];
uniform float uTime;
uniform vec3 uSkyHorizon;
varying vec2 vW;
varying float vH;
varying vec3 vNw;

struct Era { vec3 a; vec3 b; vec3 v; vec3 wc; vec4 p1; vec4 p2; };

Era eraAt(float x) {
  float u = clamp(x / uWalkLen, 0.0, 1.0);
  Era e;
  e.a = texture2D(uEra, vec2(u, 0.5 / 6.0)).rgb;
  e.b = texture2D(uEra, vec2(u, 1.5 / 6.0)).rgb;
  e.v = texture2D(uEra, vec2(u, 2.5 / 6.0)).rgb;
  e.wc = texture2D(uEra, vec2(u, 3.5 / 6.0)).rgb;
  e.p1 = texture2D(uEra, vec2(u, 4.5 / 6.0));
  e.p2 = texture2D(uEra, vec2(u, 5.5 / 6.0));
  return e;
}

// wetness 输出水面比例，用于加强反光
void groundSurface(vec2 w, Era e, out vec3 col, out float h, out float rough, out vec3 emi, out float wetness) {
  float veg = e.p1.x, tree = e.p1.y, water = e.p1.z, lava = e.p1.w;
  float ice = e.p2.x, dunes = e.p2.y, cracks = e.p2.z, rock = e.p2.w;
  emi = vec3(0.0);
  rough = 0.95;

  vec4 d1 = texture2D(uDet, w / 128.0);
  vec4 d2 = texture2D(uDet, w / 1024.0 + vec2(0.37, 0.61));
  vec4 m1 = texture2D(uMac1, w / 4096.0);
  vec4 m2 = texture2D(uMac2, w / 4096.0 + vec2(0.5, 0.25));
  float macro = m2.r, meso = d2.r, micro = d1.r - 0.5;

  // 基底
  col = mix(e.a, e.b, smoothstep(0.25, 0.75, macro * 0.55 + meso * 0.45));
  col *= 0.9 + 0.45 * micro;
  h = meso * 1.2 + micro * 0.5;

  // 层状岩床露头：被侵蚀的水平岩层从高处看像一圈圈等高线
  float field = m2.g * 9.0 + meso * 0.6;
  float ring = fract(field);
  float step1 = smoothstep(0.0, 0.12, ring);
  float outcrop = rock * smoothstep(0.42, 0.6, macro);
  vec3 bandCol = mix(e.a, e.b, fract(floor(field) * 0.618)) * (0.78 + 0.3 * step1);
  col = mix(col, bandCol * (0.92 + 0.3 * micro), outcrop);
  h += outcrop * (floor(field) + step1) * 2.2;

  // 沙丘：大的沙脊 + 细沙纹
  float dir = dot(w, vec2(0.8, 0.6)) + m2.b * 160.0;
  float crest = pow(0.5 + 0.5 * sin(dir * 0.09), 3.0);
  float rippleFade = 1.0 - smoothstep(0.6, 1.6, fwidth(dir * 1.3));
  float ripple = (0.5 + 0.5 * sin(dir * 1.3 + meso * 8.0)) * rippleFade;
  float dune = dunes * smoothstep(0.3, 0.6, macro + 0.2);
  h += dune * (crest * 6.0 + ripple * 0.15);
  col = mix(col, col * (0.88 + 0.28 * crest), dune);

  // 龟裂：泥裂、熔岩结壳、冰面裂板
  float crackLine = 1.0 - smoothstep(0.0, 0.22, d1.g);
  float ck = cracks * smoothstep(0.3, 0.5, meso + 0.1);
  col = mix(col, col * (0.86 + 0.28 * d1.r), ck * 0.7);
  col = mix(col, col * 0.3, crackLine * ck);
  h -= crackLine * ck * 0.8;

  // 熔岩：缓慢流动的熔岩湖，上面漂着黑色结壳；裂缝里透出红光
  vec2 fl = vec2(uTime * 0.9, uTime * 0.35);
  float flow = texture2D(uDet, (w + fl) / 300.0).r;
  float flow2 = texture2D(uDet, (w - fl * 0.6) / 170.0 + 0.3).r;
  float crust = smoothstep(0.5, 0.66, texture2D(uDet, (w + fl * 0.4) / 420.0 + 0.7).r + flow2 * 0.25 - 0.1);
  float heat = smoothstep(0.35, 0.7, mix(flow, flow2, 0.5));
  float pool = smoothstep(0.6, 0.63, m2.a) * lava;
  col = mix(col, vec3(0.025, 0.02, 0.02) + 0.05 * crust, pool);
  vec3 hot = mix(vec3(0.9, 0.1, 0.01), vec3(1.0, 0.4, 0.07), heat);
  emi += vec3(1.0, 0.18, 0.02) * lava * crackLine * ck * 1.2;
  emi += hot * pool * (1.0 - crust) * (0.7 + 1.6 * heat * heat);        // 只有最热的流线超过泛光阈值
  h += pool * crust * 0.8;

  // 冰
  float iceM = ice * smoothstep(0.2, 0.5, macro + 0.25 * meso + ice * 0.35);
  vec3 iceCol = mix(vec3(0.74, 0.82, 0.88), vec3(0.94, 0.96, 0.98), smoothstep(0.3, 0.7, meso));
  col = mix(col, iceCol * (0.96 + 0.15 * micro) * (1.0 - crackLine * ck * 0.25), iceM);
  rough = mix(rough, 0.4, iceM);

  // 植被：成片分布，林缘逐渐稀疏成一棵棵树；草地是细密的纹理
  float vt = mix(0.8, 0.2, veg);
  float vn = m1.r * 0.7 + meso * 0.3;
  float hasVeg = step(0.001, veg);
  float density = smoothstep(vt - 0.14, vt + 0.1, vn) * hasVeg;
  float present = smoothstep(d1.a - 0.12, d1.a + 0.12, density);
  float crown = d1.b;
  vec3 canopy = e.v * (0.5 + 0.7 * crown) * (0.8 + 0.4 * fract(d1.a * 7.3));
  float treeCover = present * smoothstep(0.0, 0.3, crown);
  vec3 grass = e.v * (0.85 + 0.3 * meso + 0.3 * micro);
  float grassCover = smoothstep(vt - 0.18, vt + 0.05, vn) * hasVeg;
  col = mix(col, grass, grassCover * (1.0 - tree) * 0.9);
  col = mix(col, canopy, treeCover * tree);
  h += treeCover * tree * crown * 3.0;

  // 辫状河道：湿润的年代有水，干旱的年代是浅色的干河床
  float chan = max(smoothstep(0.7, 0.9, m1.b), smoothstep(0.83, 0.95, m1.a) * 0.8) * (1.0 - ice * 0.7);
  float bank = max(smoothstep(0.2, 0.7, m1.b), smoothstep(0.53, 0.83, m1.a) * 0.7) * (1.0 - ice * 0.7);
  col = mix(col, mix(col, e.v * 0.9, 0.55), bank * veg * (1.0 - chan));
  col = mix(col, e.b * 1.12, chan * 0.8);
  float chanWater = chan * smoothstep(0.05, 0.3, water + veg * 0.3) * (1.0 - lava);

  // 水：浅海、潮坪、沼泽
  float wl = mix(0.8, 0.4, water);
  float wn = m1.g * 0.8 + meso * 0.2;
  float hasWater = step(0.001, water);
  float wet = smoothstep(wl - 0.05, wl, wn) * hasWater;
  float wm = smoothstep(wl, wl + 0.012, wn) * hasWater;
  col = mix(col, col * 0.62, wet * (1.0 - wm));
  wetness = max(wm, chanWater);
  // 水面：颜色偏深，让天空和太阳的反光显出来；细碎的波纹制造闪光
  vec2 rt = vec2(uTime * 2.0, uTime * 1.3);
  float rip = texture2D(uDet, (w + rt) / 23.0).r + texture2D(uDet, (w - rt.yx) / 31.0 + 0.5).r;
  col = mix(col, e.wc * 0.55, wetness);
  rough = mix(rough, 0.11, wetness);
  h = mix(h, rip * 0.4, wetness);
  emi *= 1.0 - wm;

  // 大灭绝：焦黑的灰烬带
  float scorch = 0.0;
  for (int i = 0; i < RIFT_COUNT; i++) {
    float d = abs(w.x - uRifts[i] + (texture2D(uMac2, vec2(w.y / 4096.0, float(i) * 0.21)).b - 0.5) * 360.0);
    scorch = max(scorch, 1.0 - smoothstep(60.0, 260.0, d));
  }
  col = mix(col, vec3(0.07, 0.06, 0.055) * (0.8 + 0.5 * meso), scorch * 0.8);
  rough = mix(rough, 0.95, scorch * 0.8);
}

// 断层崖面：越往下越古老的岩层，大灭绝在岩层中留下黑色的界线
vec3 scarpFace(vec2 w, float y) {
  float layer = y / 10.0 + (texture2D(uDet, vec2(w.x / 900.0, y / 60.0)).r - 0.5) * 1.2;
  float sx = w.x - (${SCARP_H.toFixed(1)} + 40.0 - y) * 60.0;
  Era le = eraAt(sx);
  vec3 c = mix(le.a, le.b, fract(floor(layer) * 0.618 + 0.2)) * (0.8 + 0.3 * smoothstep(0.0, 0.2, fract(layer)));
  c *= 0.85 + 0.3 * texture2D(uDet, vec2(w.x / 60.0, y / 12.0)).r;
  for (int i = 0; i < RIFT_COUNT; i++) {
    c = mix(c, vec3(0.05, 0.045, 0.04), 1.0 - smoothstep(20.0, 90.0, abs(sx - uRifts[i])));
  }
  return c;
}
`;

const FRAGMENT_MAIN = /* glsl */ `
  float wig = texture2D(uMac2, vW / 4096.0 + 0.13).b;
  Era era = eraAt(vW.x + (wig - 0.5) * 300.0);
  vec3 tCol; float tH; float tRough; vec3 tEmi; float tWet;
  groundSurface(vW, era, tCol, tH, tRough, tEmi, tWet);

  // 由逐像素高度求世界空间梯度，扰动法线（凹凸细节）
  vec2 dwx = dFdx(vW), dwy = dFdy(vW);
  vec2 dh = vec2(dFdx(tH), dFdy(tH));
  float det = dwx.x * dwy.y - dwx.y * dwy.x;
  vec2 grad = abs(det) > 1e-8 ? vec2(dwy.y * dh.x - dwx.y * dh.y, -dwy.x * dh.x + dwx.x * dh.y) / det : vec2(0.0);
  grad = clamp(grad, -2.5, 2.5) * vNw.y;
  vec3 tNrmW = normalize(vNw + vec3(-grad.x, 0.0, -grad.y));

  // 崖面
  float face = smoothstep(0.8, 0.5, vNw.y) * smoothstep(4.0, 12.0, vH);
  if (face > 0.0) {
    tCol = mix(tCol, scarpFace(vW, vH), face);
    tRough = mix(tRough, 0.95, face);
    tEmi *= 1.0 - face;
  }
  diffuseColor.rgb = tCol;
`;

// ------------------------------------------------------------------ JS 镜像
const fract = (x) => x - Math.floor(x);
function hash(px, py) {
  let x = fract(px * 0.1031), y = fract(py * 0.1031), z = fract(px * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}
function noise(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const ab = a + (b - a) * ux, cd = c + (d - c) * ux;
  return ab + (cd - ab) * uy;
}
function fbm(px, py) {
  let s = 0, a = 0.5;
  for (let i = 0; i < 5; i++) {
    s += a * noise(px, py);
    px = px * 2.03 + 17.1; py = py * 2.03 + 9.2;
    a *= 0.5;
  }
  return s;
}
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function rawHeight(wx, wz) {
  const H = (fbm(wx / 500, wz / 500) - 0.5) * 10 + (noise(wx / 90, wz / 90) - 0.5) * 2;
  const line = SCARP_Z + (fbm(wx / 500, 5) - 0.5) * 700;
  const up = smoothstep(line + 20, line - 20, wz);
  const top = SCARP_H + (noise(wx / 220, 9) - 0.5) * 80;
  return H + up * top;
}

// 曲率：本地坐标 (x, z) 处地面相对镜头下沉多少
export const curveDrop = (lx, lz) => (lx * lx + lz * lz) / (2 * CURVE_R);

// ------------------------------------------------------------------ 网格与材质
function buildGrid() {
  const cols = Math.round((HALF_W * 2) / GRID_STEP) + 1;
  const pos = new Float32Array(cols * ROWS * 3);
  let k = 0;
  for (let j = 0; j < ROWS; j++) {
    const t = j / (ROWS - 1);
    const z = NEAR_Z + (FAR_Z - NEAR_Z) * Math.pow(t, 1.6);   // 近密远疏
    for (let i = 0; i < cols; i++) {
      pos[k++] = -HALF_W + i * GRID_STEP;
      pos[k++] = 0;
      pos[k++] = z;
    }
  }
  const idx = new Uint32Array((cols - 1) * (ROWS - 1) * 6);
  k = 0;
  for (let j = 0; j < ROWS - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c;
      idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function createTerrain({ rifts, textures, eraLut, walkLength }) {
  const uniforms = {
    uSnap: { value: 0 },
    uFrac: { value: 0 },
    uR: { value: CURVE_R },
    uTime: { value: 0 },
    uSkyHorizon: { value: new THREE.Color('#cfe0f0') },
    uRifts: { value: rifts.slice() },
    uDet: { value: textures.detail },
    uMac1: { value: textures.macro1 },
    uMac2: { value: textures.macro2 },
    uEra: { value: eraLut },
    uWalkLen: { value: walkLength },
  };
  const defines = { RIFT_COUNT: rifts.length };

  const material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  material.defines = { ...defines, TERRAIN_COLOR: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\n${HEIGHT_GLSL}`)
      .replace('#include <beginnormal_vertex>',
        'vec3 tPos; vec3 tNrm; terrainDisplace(position, tPos, tNrm);\nvec3 objectNormal = tNrm;')
      .replace('#include <begin_vertex>', 'vec3 transformed = tPos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COLOR_GLSL}`)
      .replace('#include <color_fragment>', FRAGMENT_MAIN)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNrmW, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmi;');
  };

  // 阴影深度材质也要做同样的位移，断层崖才能投下影子
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.defines = { ...defines };
  depth.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\n${HEIGHT_GLSL}`)
      .replace('#include <begin_vertex>',
        'vec3 tPos; vec3 tNrm; terrainDisplace(position, tPos, tNrm);\nvec3 transformed = tPos;');
  };

  const mesh = new THREE.Mesh(buildGrid(), material);
  mesh.customDepthMaterial = depth;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  return {
    mesh,
    uniforms,
    update(scroll, time) {
      const snap = Math.floor(scroll / GRID_STEP) * GRID_STEP;
      uniforms.uSnap.value = snap;
      uniforms.uFrac.value = scroll - snap;
      uniforms.uTime.value = time;
    },
  };
}
