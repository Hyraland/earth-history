// 前景的小人：视角跟随器。用简单几何体拼成，侧身朝右走。

import * as THREE from 'three';

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

function limb(length, radius, material) {
  // 以顶端为枢轴的肢体
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 10), material);
  m.position.y = -length / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

export function createWalker() {
  const skin = mat('#d6a27c');
  const jacket = mat('#ece6da');
  const pants = mat('#3d4c5c');
  const boots = mat('#2e2824');
  const pack = mat('#c4562e');
  const hatMat = mat('#b88c55');

  const root = new THREE.Group();      // 放在地面上
  const body = new THREE.Group();      // 朝向 + 上下起伏
  root.add(body);

  const hips = new THREE.Group();
  hips.position.y = 2.05;
  body.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.9, 4, 12), jacket);
  chest.position.y = 0.72;
  chest.scale.set(1, 1, 0.78);
  chest.castShadow = true;
  torso.add(chest);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  torso.add(head);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), hatMat);
  brim.position.y = 1.9;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 16), hatMat);
  crown.position.y = 2.05;
  brim.castShadow = crown.castShadow = true;
  torso.add(brim, crown);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.42), pack);
  backpack.position.set(0, 0.82, -0.5);
  backpack.castShadow = true;
  torso.add(backpack);

  const legs = [-1, 1].map((side) => {
    const thigh = limb(1.05, 0.21, pants);
    thigh.position.set(side * 0.22, 0, 0);
    const shin = limb(1.0, 0.18, pants);
    shin.position.y = -1.0;
    thigh.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), boots);
    boot.position.set(0, -0.98, 0.1);
    boot.castShadow = true;
    shin.add(boot);
    hips.add(thigh);
    return { thigh, shin };
  });

  const arms = [-1, 1].map((side) => {
    const upper = limb(0.8, 0.14, jacket);
    upper.position.set(side * 0.58, 1.3, 0);
    const fore = limb(0.75, 0.12, skin);
    fore.position.y = -0.78;
    upper.add(fore);
    torso.add(upper);
    return { upper, fore };
  });

  let phase = 0;
  let facing = 1;          // 1 朝右，-1 朝左
  let yaw = Math.PI / 2;

  return {
    object: root,
    update(dt, velocity) {
      const speed = Math.abs(velocity);
      if (velocity > 0.5) facing = 1;
      else if (velocity < -0.5) facing = -1;
      const targetYaw = facing * Math.PI / 2;
      yaw += (targetYaw - yaw) * Math.min(1, dt * 8);
      body.rotation.y = yaw;

      // 步频随速度增加，但封顶，免得快进时手脚乱舞
      const cadence = Math.min(speed, 30) / 1.2;
      phase += cadence * dt;
      const moving = Math.min(1, speed / 3);
      const run = THREE.MathUtils.smoothstep(speed, 14, 40);
      const swing = (0.5 + 0.25 * run) * moving;

      legs.forEach(({ thigh, shin }, i) => {
        const p = phase + i * Math.PI;
        thigh.rotation.x = -Math.sin(p) * swing;
        shin.rotation.x = (0.08 + (0.7 + run * 0.6) * Math.max(0, Math.cos(p)) ** 2) * moving;
      });
      arms.forEach(({ upper, fore }, i) => {
        const p = phase + i * Math.PI;
        upper.rotation.x = Math.sin(p) * swing * 0.8;
        fore.rotation.x = -(0.25 + run * 0.9) * moving;
      });
      torso.rotation.x = (0.04 + run * 0.18) * moving;
      body.position.y = Math.abs(Math.cos(phase)) * 0.09 * moving;
    },
  };
}
