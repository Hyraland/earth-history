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
      varying vec3 vDir;
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
        col += uSunColor * (pow(s, 800.0) * 6.0 + pow(s, 12.0) * 0.35) * (1.0 - 0.9 * uCloud);   // 日轮 + 太阳方向的暖色光晕
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
