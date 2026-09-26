// 在显卡上把程序化图案"烘焙"成贴图：启动时画一次，之后每帧只需要采样。
// 贴图带 mipmap 和各向异性过滤，远处不会闪烁。

import * as THREE from 'three';

// 可平铺（周期性）的噪声：格点坐标对周期取模，所以贴图左右、上下能无缝衔接
export const TILE_NOISE_GLSL = /* glsl */ `
float bk_hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 bk_hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float noiseP(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = bk_hash(mod(i, period));
  float b = bk_hash(mod(i + vec2(1.0, 0.0), period));
  float c = bk_hash(mod(i + vec2(0.0, 1.0), period));
  float d = bk_hash(mod(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbmP(vec2 p, vec2 period) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    s += a * noiseP(p, period);
    p *= 2.0; period *= 2.0;
    a *= 0.5;
  }
  return s;
}
// x 到最近点的距离，y 近似到单元边界的距离，z 单元随机值
vec3 voronoiP(vec2 p, vec2 period) {
  vec2 n = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 c = mod(n + g, period);
      vec2 r = g + bk_hash2(c) - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = bk_hash(c + 7.0); }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec3(sqrt(d1), sqrt(d2) - sqrt(d1), id);
}
`;

const quad = new THREE.PlaneGeometry(2, 2);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 把一个片元着色器画进 width×height 的贴图。着色器里可用 vUv（0..1）。
export function bakeTexture(renderer, { width, height, fragment, uniforms = {}, srgb = false, wrap = THREE.RepeatWrapping }) {
  const rt = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  });
  const tex = rt.texture;
  tex.wrapS = wrap;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `varying vec2 vUv;\n${TILE_NOISE_GLSL}\n${fragment}`,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(quad, material));

  const prev = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.toneMapping = prevTone;
  material.dispose();
  return { texture: tex, rt, dispose: () => rt.dispose() };
}
