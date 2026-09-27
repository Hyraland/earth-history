// 天空：一个跟随镜头的大球。按"高于真实地平线的角度"上色，并在地平线处加一道大气辉光，
// 像从低轨道看到的地球边缘。颜色随年代变化（太古宙的橙色甲烷霾、大氧化之后的蓝天……）。

import * as THREE from 'three';

export function createSky() {
  const uniforms = {
    uHorizon: { value: new THREE.Color('#d8e3ee') },
    uZenith: { value: new THREE.Color('#7ea8d4') },
    uDip: { value: 0.1 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color('#fff1dc') },
    uCloud: { value: 0 },      // 阴天的云量（0..1）：下雨时铺满低垂的云，遮住太阳的光晕
    uTime: { value: 0 },
    uSunVis: { value: 1 },     // 日轮是否可见（夜里为 0）
    uGlow: { value: 0 },       // 夕阳：地平线上的金橙色辉光
    uGlowColor: { value: new THREE.Color('#ffa24c') },
    uStars: { value: 0 },      // 夜空：星星和银河
    uMoonDir: { value: new THREE.Vector3(0, 0.1, -1) },
    uMoon: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform float uDip;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uCloud;
      uniform float uTime;
      uniform float uSunVis, uGlow, uStars, uMoon;
      uniform vec3 uGlowColor, uMoonDir;
      varying vec3 vDir;
      float sh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float sn3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      float sf3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * sn3(p); p *= 2.1; a *= 0.5; } return s; }
      // 星星：把方向放进 3D 格子，少数格子里有一颗星，亮度按幂次分布（亮星少、暗星多），轻轻闪烁
      float starField(vec3 d, float scale, float density) {
        vec3 c = d * scale;
        vec3 id = floor(c);
        float h = sh3(id);
        if (h < 1.0 - density) return 0.0;
        vec3 j = vec3(sh3(id + 1.3), sh3(id + 2.7), sh3(id + 4.1)) - 0.5;
        float dd = length(fract(c) - 0.5 - j * 0.6);
        float b = pow((h - (1.0 - density)) / density, 2.2);
        return b * smoothstep(0.32, 0.0, dd) * (0.75 + 0.25 * sin(uTime * (1.5 + h * 4.0) + h * 60.0));
      }
      float ch(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cn(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(ch(i), ch(i + vec2(1, 0)), f.x), mix(ch(i + vec2(0, 1)), ch(i + vec2(1, 1)), f.x), f.y);
      }
      float cf(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * cn(p); p *= 2.07; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // 相对真实地平线的仰角
        float t = clamp(el / 0.2, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(t, 0.5));
        float limb = exp(-max(el, 0.0) / 0.006);              // 大气层边缘的亮带
        col += (uHorizon * 0.15 + vec3(0.05, 0.06, 0.08)) * limb;
        if (el < 0.0) col = uHorizon;
        // 云：把方向投到头顶的一个平面上取噪声，随时间缓缓飘动；越靠近地平线越扁、越密
        if (uCloud > 0.001) {
          vec2 cp = d.xz / max(d.y + uDip + 0.06, 0.02) * 0.9 + vec2(uTime * 0.012, uTime * 0.004);
          float cl = cf(cp);
          float cover = smoothstep(0.3, 0.7, cl + uCloud * 0.3) * uCloud;
          vec3 cloudCol = mix(uHorizon * 1.04, uZenith * 0.78, smoothstep(0.45, 0.85, cl));
          col = mix(col, cloudCol, cover * step(0.0, el));
        }
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 800.0) * 6.0 + pow(s, 12.0) * 0.35) * (1.0 - 0.9 * uCloud) * uSunVis;   // 日轮 + 太阳方向的暖色光晕

        // 夕阳：太阳方向的地平线上一大片金橙色，绕地平线一圈还有一道淡一些的暖色
        if (uGlow > 0.001) {
          vec2 hd = normalize(d.xz + 1e-5), hs = normalize(uSunDir.xz + 1e-5);
          float toward = pow(max(dot(hd, hs), 0.0), 3.0);
          float low = exp(-max(el, 0.0) / 0.045);
          float rim = exp(-max(el, 0.0) / 0.012);                 // 贴着地平线的一道窄窄的金线
          col += uGlowColor * uGlow * ((toward * 1.4 + 0.45) * low + (toward * 0.8 + 0.5) * rim) * step(0.0, el) * (1.0 - 0.8 * uCloud);
        }

        // 夜空：星星、斜穿天空的银河、月亮；越靠近地平线越被大气遮暗
        if (uStars > 0.001 && el > 0.0) {
          float clear = smoothstep(0.0, 0.06, el) * (1.0 - uCloud);
          vec3 mwN = normalize(vec3(0.72, 0.66, 0.2));
          float band = exp(-pow(dot(d, mwN) / 0.13, 2.0));
          float dust = smoothstep(0.45, 0.7, sf3(d * 9.0 + 3.0));
          float glow = band * (0.45 + 0.8 * sf3(d * 5.0)) * (1.0 - 0.75 * dust);
          float st = starField(d, 420.0, 0.02 + 0.03 * band) + starField(d, 230.0, 0.008) * 1.8 + starField(d, 800.0, 0.03 + 0.06 * band) * 0.7;
          vec3 starCol = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.78), sh3(floor(d * 420.0)));
          col += (starCol * st * 3.2 + vec3(0.55, 0.6, 0.8) * glow * 0.2) * uStars * clear;
          col += vec3(0.05, 0.08, 0.07) * exp(-el / 0.02) * uStars * 0.6;            // 地平线上淡淡的气辉
        }
        if (uMoon > 0.001) {
          float md = acos(clamp(dot(d, normalize(uMoonDir)), -1.0, 1.0));
          float disc = smoothstep(0.0135, 0.0115, md);
          float face = 0.85 + 0.15 * sf3(d * 300.0);                                 // 月面上的明暗
          col = mix(col, vec3(0.93, 0.94, 0.88) * face * 1.6, disc * uMoon * (1.0 - 0.9 * uCloud));
          col += vec3(0.5, 0.58, 0.75) * exp(-md / 0.05) * 0.18 * uMoon * (1.0 - uCloud); // 月晕
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
