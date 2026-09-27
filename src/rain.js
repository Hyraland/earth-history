// 雨：一大片短短的雨丝（线段），在着色器里循环下落。
// 雨丝固定在世界里（随地面一起向左滚动），只在雨区附近出现：远远地就能看见前方的一道雨幕，走进去，再走出来。

import * as THREE from 'three';

const COUNT = 14000;
const BOX = { w: 3600, h: 760, near: -80, far: -2200 };   // 雨丝所在的范围（镜头前方）

export function createRain({ centerX, radius }) {
  const seeds = new Float32Array(COUNT * 2 * 4);
  const ends = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let e = 0; e < 2; e++) {
      seeds.set(s, (i * 2 + e) * 4);
      ends[i * 2 + e] = e;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3));   // 占位，位置在着色器里算
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));

  const uniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uAmount: { value: 0 },
    uCenter: { value: centerX },
    uRadius: { value: radius },
    uColor: { value: new THREE.Color('#c9d3dc') },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute float aEnd;
      uniform float uTime, uScroll, uCenter, uRadius;
      varying float vAlpha;
      void main() {
        const float W = ${BOX.w.toFixed(1)}, H = ${BOX.h.toFixed(1)};
        // 世界 x 固定：随滚动在一个宽 W 的窗口里循环
        float wx = aSeed.x * W;
        float lx = mod(wx - uScroll + W * 0.5, W) - W * 0.5;
        float worldX = lx + uScroll;
        float speed = 900.0 + aSeed.w * 300.0;
        float y = H - mod(aSeed.y * H + uTime * speed, H);
        float z = mix(${BOX.near.toFixed(1)}, ${BOX.far.toFixed(1)}, sqrt(aSeed.z));
        // 雨丝长度随速度，略向左斜（有风）
        vec3 p = vec3(lx, y, z);
        vec3 dir = normalize(vec3(-0.12, -1.0, 0.03));
        p += dir * aEnd * (22.0 + aSeed.w * 14.0);
        // 雨区：中心最密，边缘渐稀；每根雨丝有自己的阈值，雨稀的地方只剩一部分
        float dens = 1.0 - smoothstep(uRadius * 0.45, uRadius, abs(worldX - uCenter));
        float keep = step(aSeed.w * 0.999, dens);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vAlpha = keep * mix(1.0, 0.35, aEnd) * clamp(1.0 - (-mv.z - 400.0) / 2600.0, 0.15, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.01) discard;
        gl_FragColor = vec4(uColor, vAlpha * uAmount * 0.42);
      }`,
  });
  const mesh = new THREE.LineSegments(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  return {
    mesh,
    // amount：这一带能不能看到雨（离雨区太远时整组隐藏，省掉绘制）
    update(time, scroll, amount) {
      uniforms.uTime.value = time;
      uniforms.uScroll.value = scroll;
      uniforms.uAmount.value = amount;
      mesh.visible = amount > 0.005;
    },
  };
}
