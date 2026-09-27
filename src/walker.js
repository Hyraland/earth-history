// 前景的小猫：视角跟随器。模型是一只静止的迈步姿势的虎斑猫（没有骨骼和动画），
// 走路的动作在顶点着色器里做：四条腿各自绕肩、髋摆动，按猫的步态依次迈出（左后 → 左前 → 右后 → 右前），
// 迈出的那条腿抬起一点；身体随步子轻轻起伏，尾巴左右摆。阴影用同样的变形，所以影子也会走路。
//
// 模型坐标（glb 原样）：长 1，头朝 +x，脚底 y = 0，近侧（+z）和远侧（-z）各两条腿。
// 下面的支点和每条腿的静止角度是从模型上量出来的。
// 模型：Medium poly Cat In Motion 3d Model Free，iRahulRajput，CC BY 4.0（已压缩贴图、加入走路动画）。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const SIZE = 6.5;   // 在小猫自身坐标里放大的倍数（外面还会乘上 WALKER.scale）

const DEFORM_GLSL = /* glsl */ `
uniform float uPhase;   // 步态相位（弧度）
uniform float uAmp;     // 0 = 站着不动（保持模型原来的姿势），1 = 正常走路
void catDeform(vec3 p, out vec3 q, inout vec3 n) {
  q = p;
  // ---- 腿：x > 0.03 是前腿，-0.33 < x < 0.03 是后腿（再往后是尾巴）；z > 0 是近侧 ----
  float front = step(0.03, p.x);
  float near = step(0.0, p.z);
  float isLeg = step(-0.33, p.x) * step(p.x, 0.46) * smoothstep(0.34, 0.22, p.y);
  vec2 piv = mix(vec2(-0.17, 0.36), vec2(0.2, 0.36), front);
  // 模型静止姿势里每条腿的角度（向前为正）：远前 0.50、近前 -0.15、远后 -0.27、近后 0.23
  float a0 = mix(mix(-0.27, 0.23, near), mix(0.50, -0.145, near), front);
  // 步态：近后 0、近前 1/4、远后 1/2、远前 3/4 个周期
  float off = mix(mix(3.1416, 0.0, near), mix(4.7124, 1.5708, near), front);
  float psi = uPhase + off;
  float ang = (0.36 * sin(psi) - a0 * 0.8) * uAmp * isLeg;
  float c = cos(ang), s = sin(ang);
  vec2 d = p.xy - piv;
  q.xy = piv + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  n.xy = vec2(c * n.x - s * n.y, s * n.x + c * n.y);
  // 向前迈的那条腿抬起来
  float swing = max(0.0, cos(psi));
  q.y += 0.035 * swing * swing * uAmp * isLeg * smoothstep(0.3, 0.0, p.y);
  // ---- 尾巴：绕尾根左右摆 ----
  float tw = smoothstep(-0.3, -0.5, p.x) * step(0.12, p.y);
  float ta = 0.22 * sin(uPhase) * tw * uAmp;
  float ct = cos(ta), st = sin(ta);
  vec2 dt = vec2(q.x + 0.3, q.z);
  q.xz = vec2(-0.3, 0.0) + vec2(ct * dt.x - st * dt.y, st * dt.x + ct * dt.y);
  // ---- 身体随步子起伏（每个周期两次） ----
  q.y += 0.006 * sin(uPhase * 2.0) * uAmp * (1.0 - isLeg);
}
`;

function injectDeform(material, uniforms, withNormals) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${DEFORM_GLSL}`);
    if (withNormals) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);\nvec3 catPos;\ncatDeform(position, catPos, objectNormal);')
        .replace('#include <begin_vertex>', 'vec3 transformed = catPos;');
    } else {
      shader.vertexShader = shader.vertexShader
        .replace('#include <begin_vertex>', 'vec3 catN = vec3(0.0, 1.0, 0.0);\nvec3 transformed;\ncatDeform(position, transformed, catN);');
    }
  };
  material.customProgramCacheKey = () => `cat-${withNormals}`;
}

export function createWalker() {
  const root = new THREE.Group();      // 放在地面上
  const body = new THREE.Group();      // 朝向
  root.add(body);
  const uniforms = { uPhase: { value: 0 }, uAmp: { value: 0 } };

  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  new GLTFLoader().setDRACOLoader(draco).loadAsync('assets/models/cat.glb').then((gltf) => {
    const cat = gltf.scene;
    cat.scale.setScalar(SIZE);
    cat.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;          // 变形后包围盒会变，干脆不裁剪
      o.material.roughness = 0.9;
      o.material.color.multiplyScalar(1.3);   // 深色的虎斑在逆光里太暗，提亮一点
      o.material.metalness = 0;
      injectDeform(o.material, uniforms, true);
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      injectDeform(depth, uniforms, false);
      o.customDepthMaterial = depth;
    });
    body.add(cat);
    draco.dispose();
  });

  let phase = 0;
  let facing = 1;          // 1 朝右，-1 朝左
  let yaw = 0;

  return {
    object: root,
    update(dt, velocity) {
      const speed = Math.abs(velocity);
      if (velocity > 0.5) facing = 1;
      else if (velocity < -0.5) facing = -1;
      const targetYaw = facing > 0 ? 0 : Math.PI;
      yaw += (targetYaw - yaw) * Math.min(1, dt * 8);
      body.rotation.y = yaw;

      // 步频随速度增加，但封顶，免得快进时腿乱舞
      phase += Math.min(speed, 30) * 1.4 * dt;
      uniforms.uPhase.value = phase;
      uniforms.uAmp.value = Math.min(1, speed / 3);
    },
  };
}
