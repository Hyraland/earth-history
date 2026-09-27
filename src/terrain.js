// 地面：一片随地球曲率弯曲的平原。几何上只有很缓的起伏，远处地平线上是一道山脉——
// 山的高度、尖锐程度、火山和积雪随地质年代变化（见 timeline.js 的 MOUNTAIN_KEYS），按路程查表。
// 地貌细节来自启动时烘焙好的贴图（见 groundTextures.js）：每个像素只采样几次贴图，
// 再按年代查找表（岩土、植被、水、冰、沙丘、熔岩……）组合出当时的地表。
// 高度函数在 GLSL 与 JS 中各写一份（rawHeight），JS 版用于摆放展品和小人（只需要平原部分，山在远处）。

import * as THREE from 'three';

export const CURVE_R = 16000;     // 弯曲半径：越小地平线越弯
export const RANGE_Z = -2950;     // 远处山脉山脚的大致位置
const MTN_SCALE = 0.42;           // MOUNTAIN_KEYS 里的高度是相对值，乘上它才是世界单位（山在地平线附近，太高会挡住天空）
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
uniform sampler2D uMtn;     // 山脉参数查找表（按路程）：r 高度/1000  g 尖锐度  b 火山  a 积雪
uniform float uWalkLen;

// 山脊噪声：把噪声折成尖脊（1 - |2n - 1|），层层叠加，高处的脊更尖
float th_ridged(vec2 p) {
  float s = 0.0, a = 0.55, w = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(th_noise(p) * 2.0 - 1.0);
    n *= n;
    s += a * n * w;
    w = clamp(n * 1.6, 0.0, 1.0);
    p = p * 2.07 + vec2(11.3, 5.7);
    a *= 0.5;
  }
  return s;
}

vec4 th_mtnParams(float x) { return texture2D(uMtn, vec2(clamp(x / uWalkLen, 0.0, 1.0), 0.5)); }

// 山体高度（不含平原）；mask 输出"这里属于山"的程度
float th_mountain(vec2 w, vec4 m, out float mask) {
  mask = 0.0;
  if (w.y > ${(RANGE_Z + 450).toFixed(1)}) return 0.0;        // 近处的平原不用算山（山脚线最多前后摆动 300）
  float front = ${RANGE_Z.toFixed(1)} + (th_fbm(vec2(w.x / 700.0, 5.0)) - 0.5) * 600.0;   // 山脚线
  float d = front - w.y;                                   // 深入山区的距离
  mask = smoothstep(-80.0, 250.0, d);
  if (d < -150.0) return 0.0;
  float rise = smoothstep(-150.0, 900.0, d);               // 从山麓丘陵到主脊
  vec2 p = w / vec2(1100.0, 800.0);
  float ridged = th_ridged(p);
  float rounded = th_fbm(p * 0.7 + 3.0);
  float shape = mix(rounded * 1.1, ridged, m.g);
  float h = m.r * 1000.0 * rise * (0.25 + 1.05 * shape);
  // 火山锥：沿山前稀疏分布，顶上有火山口
  float cell = floor(w.x / 1500.0);
  float cx = (cell + 0.25 + 0.5 * th_hash(vec2(cell, 3.0))) * 1500.0;
  float cz = front - 300.0 - 500.0 * th_hash(vec2(cell, 7.0));
  float r = length(vec2(w.x - cx, (w.y - cz) * 1.2));
  float big = step(th_hash(vec2(cell, 11.0)), m.b);         // 火山越多的年代，越多格子里有火山
  float cone = max(0.0, 1.0 - r / 420.0);
  float crater = smoothstep(40.0, 0.0, r) * 0.25;
  h = max(h, big * 290.0 * (pow(cone, 1.4) - crater));      // 火山的高度不随山脉高低变：太古宙的山很矮，火山却很醒目
  return h;
}

// 与 JS 的 rawHeight 在平原部分保持一致
float th_height(vec2 w, out float mtnMask) {
  float H = (th_fbm(w / 500.0) - 0.5) * 10.0 + (th_noise(w / 90.0) - 0.5) * 2.0;   // 平原的缓起伏
  return H + th_mountain(w, th_mtnParams(w.x), mtnMask);
}
float th_height(vec2 w) { float m; return th_height(w, m); }

#ifdef TERRAIN_COLOR
varying vec2 vW;
varying float vH;
varying vec3 vNw;
varying float vMtn;
varying vec4 vMP;
#endif

// 只求位置（阴影深度那一遍不需要法线，省掉 4 次高度计算）
vec3 terrainPosition(vec3 pos) {
  vec2 w = vec2(pos.x + uSnap, pos.z);
  float lx = pos.x - uFrac;
  return vec3(lx, th_height(w) - (lx * lx + pos.z * pos.z) / (2.0 * uR), pos.z);
}

void terrainDisplace(vec3 pos, out vec3 outPos, out vec3 outNrm) {
  vec2 w = vec2(pos.x + uSnap, pos.z);
  float mtn;
  float h = th_height(w, mtn);
  float e = 2.0 + 0.008 * abs(pos.z);
  float hx = th_height(w + vec2(e, 0.0)) - th_height(w - vec2(e, 0.0));
  float hz = th_height(w + vec2(0.0, e)) - th_height(w - vec2(0.0, e));
  outNrm = normalize(vec3(-hx, 2.0 * e, -hz));
  float lx = pos.x - uFrac;
  float bend = (lx * lx + pos.z * pos.z) / (2.0 * uR);
  outPos = vec3(lx, h - bend, pos.z);
#ifdef TERRAIN_COLOR
  vW = w; vH = h; vNw = outNrm; vMtn = mtn; vMP = th_mtnParams(w.x);
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
uniform float uRainX;       // 雨区中心（世界 x）和半径：地面变湿、积水
uniform float uRainR;
varying vec2 vW;
varying float vH;
varying vec3 vNw;
varying float vMtn;
varying vec4 vMP;

struct Era { vec3 a; vec3 b; vec3 v; vec3 wc; vec4 p1; vec4 p2; vec4 p3; };

Era eraAt(float x) {
  float u = clamp(x / uWalkLen, 0.0, 1.0);
  Era e;
  e.a = texture2D(uEra, vec2(u, 0.5 / 7.0)).rgb;
  e.b = texture2D(uEra, vec2(u, 1.5 / 7.0)).rgb;
  e.v = texture2D(uEra, vec2(u, 2.5 / 7.0)).rgb;
  e.wc = texture2D(uEra, vec2(u, 3.5 / 7.0)).rgb;
  e.p1 = texture2D(uEra, vec2(u, 4.5 / 7.0));
  e.p2 = texture2D(uEra, vec2(u, 5.5 / 7.0));
  e.p3 = texture2D(uEra, vec2(u, 6.5 / 7.0));
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

  // 花：草地上一片片的野花（黄、白、紫、红，远看是带颜色的花海，近看是细碎的花点）；林冠上点缀开花的树
  float flowers = e.p3.x, blossom = e.p3.y;
  if (flowers + blossom > 0.001) {
    vec4 d3 = texture2D(uDet, w / 37.0 + vec2(0.21, 0.83));
    // 花丛：一团团的，中间留着绿草；花丛里是细碎的花点，不是铺满的一片
    float drift = smoothstep(0.64 - 0.26 * flowers, 0.76 - 0.22 * flowers, texture2D(uDet, w / 520.0 + vec2(0.6, 0.1)).r + 0.2 * meso);
    float speck = smoothstep(0.45, 0.68, d3.r) * smoothstep(0.2, 0.5, texture2D(uDet, w / 9.0 + vec2(0.4, 0.2)).r);
    float fl = min(1.0, flowers * 1.2) * grassCover * (1.0 - treeCover * tree) * drift * speck;
    float hue = texture2D(uDet, w / 1500.0 + vec2(0.33, 0.77)).r + (d3.a - 0.5) * 0.18;
    vec3 fc = hue < 0.46 ? vec3(0.9, 0.58, 0.04)          // 黄：毛茛、蒲公英
            : hue < 0.6 ? vec3(0.86, 0.86, 0.8)           // 白：雏菊
            : hue < 0.72 ? vec3(0.36, 0.16, 0.6)          // 紫：羽扇豆、风铃草
            : vec3(0.7, 0.06, 0.03);                      // 红：虞美人（少一些）
    col = mix(col, fc * (0.85 + 0.35 * d3.g), fl * 0.95);
    float bl = blossom * treeCover * tree * smoothstep(0.55, 0.8, d3.b) * step(0.5, fract(d1.a * 13.7));
    col = mix(col, mix(vec3(0.88, 0.5, 0.6), vec3(0.9, 0.88, 0.84), step(0.5, fract(d1.a * 5.1))), bl * 0.75);   // 木兰一类：粉、白
  }

  // 辫状河道：湿润的年代有水，干旱的年代是浅色的干河床
  float chan = max(smoothstep(0.7, 0.9, m1.b), smoothstep(0.83, 0.95, m1.a) * 0.8) * (1.0 - ice * 0.7);
  float bank = max(smoothstep(0.2, 0.7, m1.b), smoothstep(0.53, 0.83, m1.a) * 0.7) * (1.0 - ice * 0.7);
  col = mix(col, mix(col, e.v * 0.9, 0.55), bank * veg * (1.0 - chan));
  col = mix(col, e.b * 1.12, chan * 0.8);
  // 雨区：河道涨满水，低洼处积起水坑，其余地面被淋湿变深
  float rainW = 1.0 - smoothstep(uRainR * 0.5, uRainR * 1.3, abs(w.x - uRainX));
  // 河道中间是连续的水面，只在河岸边缘渐变——否则河道会变成"半湿的砾石"，和相连的水塘反光不一样
  // 有没有水只取决于年代够不够湿润，是个开关，不能"六成是水"——否则河道会比相连的水塘浅、像蒙了一层雾
  float flowing = max(smoothstep(0.08, 0.12, water + veg * 0.3), step(0.02, rainW));
  float chanWater = smoothstep(0.3, 0.6, chan) * flowing * (1.0 - lava);

  // 水：浅海、潮坪、沼泽
  float wl = mix(0.8, 0.4, water) - rainW * 0.08;
  float wn = m1.g * 0.8 + meso * 0.2;
  float hasWater = max(step(0.001, water), step(0.02, rainW));
  float wet = smoothstep(wl - 0.05, wl, wn) * hasWater;
  float wm = smoothstep(wl, wl + 0.012, wn) * hasWater;
  col = mix(col, col * 0.62, wet * (1.0 - wm));
  wetness = max(wm, chanWater);
  // 水面：颜色偏深，让天空和太阳的反光显出来；细碎的波纹制造闪光
  vec2 rt = vec2(uTime * 2.0, uTime * 1.3);
  float rip = texture2D(uDet, (w + rt) / 23.0).r + texture2D(uDet, (w - rt.yx) / 31.0 + 0.5).r;
  col *= 1.0 - 0.3 * rainW * (1.0 - wetness);
  rough = mix(rough, 0.5, rainW * 0.6);
  col = mix(col, e.wc * 0.55, wetness);
  rough = mix(rough, mix(0.11, 0.3, rainW), wetness);   // 阴雨天水面被雨点打花，没有镜面般的反光
  h = mix(h, rip * 0.4 * (1.0 + rainW * 2.0), wetness);   // 雨点打得水面更碎
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

// 山体：岩石上横着一层层的地层，缓坡上长着当时的植被，雪线以上积雪；火山多的年代岩石更黑
vec3 mountainSurface(vec2 w, float y, vec3 nrm, Era e, vec4 m, out float rough) {
  float slope = 1.0 - nrm.y;                                           // 0 平，越大越陡
  float n1 = texture2D(uDet, w / 700.0 + 0.3).r, n2 = texture2D(uDet, w / 90.0).r;
  float layer = y / 16.0 + (texture2D(uDet, vec2(w.x / 1200.0, y / 90.0)).r - 0.5) * 1.6;
  float strata = smoothstep(0.15, 0.45, slope);                          // 地层只在陡坡上露出来
  vec3 rock = mix(mix(e.a, e.b, 0.5), mix(e.a, e.b, fract(floor(layer) * 0.618 + 0.2)), strata);
  rock *= 1.0 - 0.28 * strata * (1.0 - smoothstep(0.0, 0.25, fract(layer)));
  rock = mix(rock, rock * vec3(0.55, 0.53, 0.52), m.b * 0.6);         // 火山岩
  rock *= 0.8 + 0.35 * n2;
  vec3 c = rock;
  // 植被：缓坡、树线以下
  float veg = e.p1.x * smoothstep(0.35, 0.15, slope) * smoothstep(200.0, 70.0, y + (n1 - 0.5) * 60.0);
  c = mix(c, e.v * (0.7 + 0.4 * n2), veg * 0.85);
  // 积雪：雪线随年代变化，陡坡挂不住雪
  float snowLine = mix(1200.0, 50.0, m.a) + (n1 - 0.5) * 60.0;
  float snow = smoothstep(snowLine, snowLine + 40.0, y) * smoothstep(0.75, 0.45, slope) * step(0.01, m.a);
  c = mix(c, vec3(0.9, 0.93, 0.98) * (0.92 + 0.1 * n2), snow);
  rough = mix(0.92, 0.6, snow);
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

  // 山脉
  if (vMtn > 0.001) {
    float mRough;
    vec3 mCol = mountainSurface(vW, vH, vNw, era, vMP, mRough);
    tCol = mix(tCol, mCol, vMtn);
    tRough = mix(tRough, mRough, vMtn);
    tEmi *= 1.0 - vMtn;
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
  return H;   // 山在远处（RANGE_Z 以外），展品和小猫都在平原上
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

// 山脉参数查找表：沿路程 1024 格，关键帧之间线性插值
function buildMountainLut(keys, walkLength) {
  const W = 1024, data = new Uint8Array(W * 4);
  const sorted = [...keys].sort((a, b) => a.x - b.x);
  for (let i = 0; i < W; i++) {
    const x = (i / (W - 1)) * walkLength;
    let k = 1;
    while (k < sorted.length - 1 && sorted[k].x < x) k++;
    const a = sorted[k - 1], b = sorted[k];
    const t = THREE.MathUtils.clamp((x - a.x) / Math.max(1e-6, b.x - a.x), 0, 1);
    const f = (key) => a[key] + (b[key] - a[key]) * t;
    data.set([f('height') * MTN_SCALE / 1000, f('sharp'), f('volcanic'), f('snow')].map((v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255)), i * 4);
  }
  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createTerrain({ rifts, textures, eraLut, walkLength, mountains, rain = { x: -1e9, r: 1 } }) {
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
    uMtn: { value: buildMountainLut(mountains, walkLength) },
    uRainX: { value: rain.x },
    uRainR: { value: rain.r },
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
      .replace('#include <begin_vertex>', 'vec3 transformed = terrainPosition(position);');
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
