// 前景的小猫：视角跟随器。模型是一只静止的迈步姿势的虎斑猫（没有骨骼和动画），
// 所有动作都在顶点着色器里做——按身体部位（腿、头、尾巴）选出顶点，绕各自的关节旋转：
//   走：四条腿按猫的步态依次迈出（左后 → 左前 → 右后 → 右前），尾巴竖起、尖端弯成问号
//   跑：换成奔跑的步态（后腿一对、前腿一对先后蹬地），步幅更大，身体前后起伏，尾巴向后伸平
//   停：腿收回到身体下面站定；站一会儿就坐下（后半身放低、后腿折起、尾巴绕到身体侧面）
//   坐着：抬头望着前方；隔一阵抬起靠镜头一侧的前爪舔一舔
// 各个动作用 0..1 的权重平滑过渡，所以停下、转身、坐下、起身之间都是连贯的。阴影用同样的变形。
//
// 模型坐标（glb 原样）：长 1，头朝 +x，脚底 y = 0，近侧（+z）和远侧（-z）各两条腿。
// 下面的关节位置和每条腿的静止角度是从模型上量出来的。
// 模型：Medium poly Cat In Motion 3d Model Free，iRahulRajput，CC BY 4.0（已压缩贴图、加入动画）。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const SIZE = 6.5;   // 在小猫自身坐标里放大的倍数（外面还会乘上 WALKER.scale）

const DEFORM_GLSL = /* glsl */ `
uniform float uPhase;   // 步态相位（弧度）
uniform float uWalk;    // 迈步的幅度（0 = 站定）
uniform float uRun;     // 0 = 走，1 = 跑
uniform float uSit;     // 坐下
uniform float uLook;    // 抬头望向前方
uniform float uLick;    // 抬爪舔毛
uniform float uTime;
uniform float uCam;     // 镜头在小猫的哪一侧：+1 = 模型的 +z 一侧，-1 = -z 一侧

vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }

void catDeform(vec3 p, out vec3 q, inout vec3 n) {
  q = p;
  float front = step(0.03, p.x);
  float near = step(0.0, p.z);
  float camSide = step(0.0, p.z * uCam);
  float isLeg = step(-0.33, p.x) * step(p.x, 0.46) * smoothstep(0.34, 0.22, p.y) * (1.0 - step(0.33, p.x) * step(0.36, p.y));
  float frontLeg = isLeg * front, hindLeg = isLeg * (1.0 - front);

  // ---- 尾巴：以尾根为轴。走的时候竖起来（越靠尾尖转得越多，弯成问号），跑的时候向后伸平；
  //      坐下时贴着地面绕到镜头一侧 ----
  vec3 tb = vec3(-0.33, 0.40, 0.0);
  float tt = clamp((-0.30 - p.x) / 0.2, 0.0, 1.0);
  float tw = smoothstep(-0.30, -0.36, p.x) * step(0.12, p.y);
  float up = mix(-2.5, -1.3, uRun) * (1.0 - uSit) * tw * (0.75 + 0.25 * tt);
  vec2 tv = rot(q.xy - tb.xy, up);
  q.xy = tb.xy + tv;
  float sway = (0.18 * sin(uPhase) * uWalk + 0.12 * sin(uTime * 0.9) * (1.0 - uWalk)) * tw * tt;
  float wrap = -1.7 * uCam * uSit * tw * tt;
  vec2 tz = rot(vec2(q.x - tb.x, q.z), sway + wrap);
  q.x = tb.x + tz.x; q.z = tz.y;

  // ---- 头：以脖子为轴。坐着时微微抬头望向前方，偶尔慢慢左右看一看；舔毛时低头，一下一下地舔 ----
  vec2 nk = vec2(0.33, 0.46);
  float hw = smoothstep(0.30, 0.38, p.x) * smoothstep(0.33, 0.40, p.y);
  float lickBob = 0.12 * sin(uTime * 11.0) * uLick;
  float pitch = (0.12 * uLook - 0.45 * uLick - lickBob - 0.5 * 0.8 * uSit) * hw;   // 抵消坐下时身体的前倾，头保持平视
  vec2 hv = rot(q.xy - nk, pitch);
  q.xy = nk + hv;
  n.xy = mix(n.xy, rot(n.xy, pitch), hw);
  float yawH = 0.18 * sin(uTime * 0.37) * smoothstep(0.6, 1.0, sin(uTime * 0.13)) * uLook * (1.0 - uLick) * hw;
  vec2 hz = rot(vec2(q.x - nk.x, q.z), yawH);
  q.x = nk.x + hz.x; q.z = hz.y;

  // ---- 腿：走和跑的步态；站定时收回到身体下面 ----
  vec2 piv = mix(vec2(-0.17, 0.36), vec2(0.2, 0.36), front);
  float a0 = mix(mix(-0.27, 0.23, near), mix(0.50, -0.145, near), front);              // 模型原姿势里各腿的角度
  float offWalk = mix(mix(3.1416, 0.0, near), mix(4.7124, 1.5708, near), front);       // 走：近后 0、近前 1/4、远后 1/2、远前 3/4
  float offRun = mix(mix(0.6, 0.0, near), mix(3.8, 3.2, near), front);                 // 跑：两条后腿、两条前腿先后着地
  float psi = uPhase + mix(offWalk, offRun, uRun);
  float amp = mix(0.36, 0.62, uRun);
  float ang = (amp * sin(psi) * uWalk - a0 * 0.8) * isLeg;
  // 舔毛：镜头一侧的前腿抬到嘴边（向前上方转，并缩短，像是弯起来）
  float lk = uLick * frontLeg * camSide;
  ang = mix(ang, 2.25 + 0.08 * sin(uTime * 11.0), lk);
  vec2 lv = rot(q.xy - piv, ang);
  lv *= mix(1.0, 0.55, lk);
  q.xy = piv + lv;
  n.xy = rot(n.xy, ang);
  float swing = max(0.0, cos(psi));
  q.y += mix(0.035, 0.07, uRun) * swing * swing * uWalk * isLeg * smoothstep(0.3, 0.0, p.y) * (1.0 - lk);

  // ---- 坐下：前腿不动，身体绕肩膀向后仰（后半身放低），后腿折叠到臀部下面 ----
  float sitA = 0.5 * uSit * (1.0 - frontLeg);
  vec2 sh = vec2(0.2, 0.36);
  q.xy = sh + rot(q.xy - sh, sitA);
  n.xy = rot(n.xy, sitA);
  vec2 hip = sh + rot(vec2(-0.17, 0.36) - sh, 0.5 * uSit);
  float fold = uSit * hindLeg;
  q.y = mix(q.y, hip.y + (q.y - hip.y) * 0.3, fold);
  q.x += 0.1 * fold;
  q.y = mix(q.y, max(q.y, 0.004), uSit);          // 臀部、后腿和尾巴贴在地上，不钻进地里

  // ---- 身体起伏：走的时候每步两次轻轻起伏；跑的时候整个身体前后摇摆 ----
  float body = 1.0 - isLeg;
  q.y += (0.006 * sin(uPhase * 2.0) * (1.0 - uRun) + 0.022 * sin(uPhase) * uRun) * uWalk * body;
  vec2 rk = rot(q.xy - vec2(0.0, 0.36), 0.07 * sin(uPhase + 0.8) * uRun * uWalk * body);
  q.xy = vec2(0.0, 0.36) + rk;
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

const approach = (v, target, rate, dt) => v + (target - v) * Math.min(1, dt * rate);

export function createWalker() {
  const root = new THREE.Group();      // 放在地面上
  const body = new THREE.Group();      // 朝向
  root.add(body);
  const uniforms = {
    uPhase: { value: 0 }, uWalk: { value: 0 }, uRun: { value: 0 }, uSit: { value: 0 },
    uLook: { value: 0 }, uLick: { value: 0 }, uTime: { value: 0 }, uCam: { value: 1 },
  };

  const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
  new GLTFLoader().setDRACOLoader(draco).loadAsync('assets/models/cat.glb').then((gltf) => {
    const cat = gltf.scene;
    cat.scale.setScalar(SIZE);
    cat.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;          // 变形后包围盒会变，干脆不裁剪
      o.material.roughness = 0.9;
      o.material.metalness = 0;
      o.material.color.multiplyScalar(1.3);   // 深色的虎斑在逆光里太暗，提亮一点
      injectDeform(o.material, uniforms, true);
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      injectDeform(depth, uniforms, false);
      o.customDepthMaterial = depth;
    });
    body.add(cat);
    draco.dispose();
  });

  let phase = 0, time = 0;
  let facing = 1;          // 1 朝右，-1 朝左
  let yaw = 0;
  let still = 0;           // 停下了多久
  let nextLick = 6;        // 坐下后多久舔一次爪子
  const s = { walk: 0, run: 0, sit: 0, look: 0, lick: 0 };

  return {
    object: root,
    uniforms,      // 调试用
    update(dt, velocity) {
      time += dt;
      const speed = Math.abs(velocity);
      if (velocity > 0.5) facing = 1;
      else if (velocity < -0.5) facing = -1;
      const targetYaw = facing > 0 ? 0 : Math.PI;
      const turning = Math.abs(targetYaw - yaw) > 0.05;
      yaw = approach(yaw, targetYaw, 5, dt);
      body.rotation.y = yaw;

      const moving = speed > 0.8;
      still = moving ? 0 : still + dt;

      // 目标姿态：走 / 跑 / 站 / 坐 / 看镜头 / 舔爪
      const run = THREE.MathUtils.smoothstep(speed, 12, 30);
      const walk = moving || turning ? Math.max(Math.min(1, speed / 3), turning ? 0.7 : 0) : 0;   // 原地转身时也要迈步
      const sit = still > 1.5 ? 1 : 0;
      let lick = 0;
      if (s.sit > 0.95 && still > nextLick) {
        lick = still < nextLick + 3.2 ? 1 : 0;
        if (still > nextLick + 3.2) nextLick = still + 6 + Math.random() * 6;
      }
      if (moving) nextLick = 6;
      const look = still > 2.2 && !lick ? 1 : 0;

      s.walk = approach(s.walk, walk, 5, dt);
      s.run = approach(s.run, run, 3, dt);
      s.sit = approach(s.sit, sit, sit ? 1.6 : 7, dt);          // 坐下慢，起身快
      s.look = approach(s.look, look, 2.5, dt);
      s.lick = approach(s.lick, lick, 4, dt);

      // 步频：走的时候随速度，跑的时候固定在每秒约 2.7 步——快进时不会碎步乱舞
      const cadence = THREE.MathUtils.lerp(Math.max(Math.min(speed, 8), turning ? 5 : 0) * 1.4, 17, s.run);
      phase += cadence * dt * Math.max(s.walk, 0.001);

      const u = uniforms;
      u.uPhase.value = phase;
      u.uWalk.value = s.walk;
      u.uRun.value = s.run;
      u.uSit.value = s.sit;
      u.uLook.value = s.look;
      u.uLick.value = s.lick;
      u.uTime.value = time;
      u.uCam.value = Math.cos(yaw) >= 0 ? 1 : -1;   // 转身后镜头在模型的另一侧
    },
  };
}
