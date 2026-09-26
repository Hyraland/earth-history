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
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float el = asin(clamp(d.y, -1.0, 1.0)) + uDip;       // 相对真实地平线的仰角
        float t = clamp(el / 0.2, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(t, 0.5));
        float limb = exp(-max(el, 0.0) / 0.006);              // 大气层边缘的亮带
        col += (uHorizon * 0.15 + vec3(0.05, 0.06, 0.08)) * limb;
        if (el < 0.0) col = uHorizon;
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 800.0) * 6.0 + pow(s, 12.0) * 0.35);   // 日轮 + 太阳方向的暖色光晕
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
