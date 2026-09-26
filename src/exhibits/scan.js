// 扫描模型展品：加载史密森尼的 CC0 化石扫描（glb，Draco 压缩），摆正、放大、放到地面上。
// 每个展品的朝向和尺寸在 SCANS 里配置；来源见 assets/models/SOURCES.md。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

// orient：把扫描摆正的旋转（模型自身坐标）；yaw：摆正后在地面上的朝向（π/2 = 头朝画面右侧，也就是行走方向）
// size：摆正后最长边的长度；tilt：朝镜头方向翘起的角度（平放的石板用）；color：没有颜色贴图时的骨骼颜色
// sink：埋进地里的比例（岩块标本只露出化石所在的层面）
// brighten：颜色贴图的提亮倍数、relief：法线贴图的凹凸加强倍数（深色页岩上的浅浮雕从远处也要看得清）
export const SCANS = {
  // 页岩上的三叶虫印痕：身体长轴横放、头朝行走方向，岩块大部分埋进地里
  trilobite: { file: 'trilobite.glb', size: 460, yaw: -1.67, tilt: 0.42, sink: 0.6, brighten: 1.9, relief: 2.5 },
  archaeopteryx: { file: 'archaeopteryx.glb', size: 330, orient: [-Math.PI / 2, 0, 0], tilt: 0.14, yaw: 0.08 },
  triceratops: { file: 'triceratops.glb', size: 360, orient: [-0.28, 0, Math.PI / 2], yaw: Math.PI / 2 - 0.35 },
  mammoth: { file: 'mammoth.glb', size: 340, yaw: Math.PI / 2 - 0.3, color: '#9c7c5a' },
};

export async function buildScan(exhibit, { renderer }) {
  const cfg = SCANS[exhibit.id];
  const gltf = await loader.loadAsync(`assets/models/${cfg.file}`);
  const model = gltf.scene;
  const aniso = renderer.capabilities.getMaxAnisotropy();
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    m.metalness = 0;
    if (cfg.color && !m.map) m.color.set(cfg.color);
    if (cfg.brighten) m.color.multiplyScalar(cfg.brighten);
    if (cfg.relief && m.normalMap) m.normalScale.multiplyScalar(cfg.relief);
    for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = aniso;
  });

  // 摆正 → 缩放 → 朝向 → 翘起，最后让最低点落地
  const oriented = new THREE.Group();
  if (cfg.orient) model.rotation.set(...cfg.orient);
  oriented.add(model);
  oriented.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(oriented, true);
  const size0 = box0.getSize(new THREE.Vector3());
  const center0 = box0.getCenter(new THREE.Vector3());
  model.position.sub(center0);                          // 以包围盒中心为原点
  oriented.scale.setScalar(cfg.size / Math.max(size0.x, size0.y, size0.z));

  const placed = new THREE.Group();
  placed.add(oriented);
  placed.rotation.set(cfg.tilt ?? 0, cfg.yaw ?? 0, 0);   // 先转朝向，再整体朝镜头（+z）翘起
  placed.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(placed, true);
  placed.position.y = -box.min.y - 2 - (box.max.y - box.min.y) * (cfg.sink ?? 0);

  const group = new THREE.Group();
  group.add(placed);
  const height = (box.max.y - box.min.y) * (1 - (cfg.sink ?? 0));
  return { object: group, labelAnchor: new THREE.Vector3(box.max.x * 0.85, Math.max(height * 0.9, 40), 0) };
}
