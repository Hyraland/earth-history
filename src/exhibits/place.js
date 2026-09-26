// 把展品放到地面上：朝向（yaw）→ 朝镜头翘起（tilt）→ 最低点落地，可按比例埋进地里（sink）。
// 返回展品对象和展牌锚点（展品右上方）。

import * as THREE from 'three';

export function placeOnGround(object, { yaw = 0, tilt = 0, sink = 0 } = {}) {
  const placed = new THREE.Group();
  placed.add(object);
  placed.rotation.set(tilt, yaw, 0);   // 先转朝向，再整体朝镜头（+z）翘起
  placed.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(placed, true);
  const fullHeight = box.max.y - box.min.y;
  placed.position.y = -box.min.y - 2 - fullHeight * sink;

  const group = new THREE.Group();
  group.add(placed);
  const height = fullHeight * (1 - sink);
  return { object: group, labelAnchor: new THREE.Vector3(box.max.x * 0.85, Math.max(height * 0.9, 40), 0) };
}
