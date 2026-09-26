// 扫描模型展品：加载化石扫描（glb，Draco 压缩），摆正、放大、放到地面上。
// 每个展品的朝向、尺寸和署名在 SCANS 里配置；来源另见 assets/models/SOURCES.md。
// CC BY 的模型经过 tools/process_scan.py 清理碎片、减面和压缩，署名里注明"已修改"。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { placeOnGround } from './place.js';

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

// orient：把扫描摆正的旋转（模型自身坐标）；yaw：摆正后在地面上的朝向（π/2 = 头朝画面右侧，也就是行走方向）
// size：摆正后最长边的长度；tilt：朝镜头方向翘起的角度（平放的石板用）；color：没有颜色贴图时的骨骼颜色
// sink：埋进地里的比例（岩块标本只露出化石所在的层面）
// brighten：颜色贴图的提亮倍数、relief：法线贴图的凹凸加强倍数（深色页岩上的浅浮雕从远处也要看得清）
// base：在模型下面垫一块展示底板（颜色），散落的小骨头才有衬底
// credit：署名（作者、原始页面、许可证）
const CC0 = { license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const BY4 = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', modified: true };
const SI = 'Smithsonian Institution';

export const SCANS = {
  // 页岩上的三叶虫印痕：身体长轴横放、头朝行走方向，岩块大部分埋进地里
  trilobite: {
    file: 'trilobite.glb', size: 460, yaw: -1.67, tilt: 0.42, sink: 0.6, brighten: 1.9, relief: 2.5,
    credit: { ...CC0, by: SI, title: 'Poliella prima (Walcott), USNM PAL116112', url: 'https://3d.si.edu/object/3d/poliella-prima:fcec58e8-ac1f-425d-9d83-8b16ca72b60c' },
  },
  // 邓氏鱼头骨：扫描的后脑是空的，让鼻吻朝向镜头右前方
  dunkleosteus: {
    file: 'dunkleosteus.glb', size: 300, yaw: -0.75,
    credit: { ...BY4, by: 'MattMakesSwords - Scans', title: 'Dunkleosteus', url: 'https://sketchfab.com/3d-models/dunkleosteus-58f39882a0ee4921baeb2c3057f46041' },
  },
  // 霍尔茨马登的鱼龙石板：原本竖着展示，放倒平躺
  ichthyosaur: {
    file: 'ichthyosaur.glb', size: 560, orient: [-Math.PI / 2, 0, 0], tilt: 0.32, yaw: 0.05, brighten: 1.8,
    credit: { ...BY4, by: 'Carter County Museum', title: 'CCM Ichthyosaur', url: 'https://sketchfab.com/3d-models/ccm-ichthyosaur-85fe3715565545669f184761d9dbdbf8' },
  },
  archaeopteryx: {
    file: 'archaeopteryx.glb', size: 330, orient: [-Math.PI / 2, 0, 0], tilt: 0.14, yaw: 0.08,
    credit: { ...CC0, by: SI, title: 'Archaeopteryx siemensii Dames, USNM PAL509743', url: 'https://3d.si.edu/object/3d/archaeopteryx:391660da-7c49-499c-91f5-88a298686c09' },
  },
  triceratops: {
    file: 'triceratops.glb', size: 360, orient: [-0.28, 0, Math.PI / 2], yaw: Math.PI / 2 - 0.35,
    credit: { ...CC0, by: SI, title: 'Triceratops horridus Marsh, 1889, USNM PAL500000', url: 'https://3d.si.edu/object/3d/triceratops-horridus-marsh-1889:d8c623be-4ebc-11ea-b77f-2e728ce88125' },
  },
  // 二齿兽头骨：真实大小只有十几厘米，放大成一座"头骨山"，吻端朝镜头右前方
  diictodon: {
    file: 'diictodon.glb', size: 300, orient: [0, 0, 0.7], yaw: 0.2, brighten: 1.5,
    credit: { ...CC0, by: SI, title: 'Diictodon feliceps Owen, 1876: skull, USNM V22939', url: 'https://3d.si.edu/object/3d/diictodon:3b3add34-8d97-4a66-96fa-4e2d343db77c' },
  },
  cetotherium: {
    file: 'cetotherium.glb', size: 420, yaw: Math.PI / 2,
    credit: { ...BY4, by: 'SchmalhausenEvolMorph', title: 'Cetotherium riabinini assembled skeleton', url: 'https://sketchfab.com/3d-models/cetotherium-riabinini-assembled-skeleton-8532da04db044d9c8417fcec43053e3a' },
  },
  // 露西：骨骼按博物馆陈列的方式平摊，头朝行走方向；模型没有颜色贴图，配化石骨骼的颜色
  lucy: {
    file: 'lucy.glb', size: 470, orient: [-Math.PI / 2, 0, 0], yaw: -Math.PI / 2, tilt: 0.3, color: '#d2b48a', base: '#4a4038',
    credit: { ...BY4, by: 'JackalopeODDsENDs', title: '"Lucy" Australopithecus afarensis; AL 288-1（据标本照片建模）', url: 'https://sketchfab.com/3d-models/lucy-australopithecus-afarensis-al-288-1-9f6c06b0a4e54890a87486e414b8cb0d' },
  },
  mammoth: {
    file: 'mammoth.glb', size: 340, yaw: Math.PI / 2 - 0.3, color: '#9c7c5a',
    credit: { ...CC0, by: SI, title: 'Mammuthus primigenius (Blumbach), USNM V23792', url: 'https://3d.si.edu/object/3d/mammoth:341c96cd-f967-4540-8ed1-d3fc56d31f12' },
  },
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

  // 摆正 → 缩放，再交给 placeOnGround 转朝向、翘起、落地
  const oriented = new THREE.Group();
  if (cfg.orient) model.rotation.set(...cfg.orient);
  oriented.add(model);
  oriented.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(oriented, true);
  const size0 = box0.getSize(new THREE.Vector3());
  const center0 = box0.getCenter(new THREE.Vector3());
  model.position.sub(center0);                          // 以包围盒中心为原点
  oriented.scale.setScalar(cfg.size / Math.max(size0.x, size0.y, size0.z));
  if (cfg.base) oriented.add(displayBase(box0, cfg.base));
  return { ...placeOnGround(oriented, cfg), credit: cfg.credit };
}

// 展示底板：比模型的平面范围大一圈的薄板，贴在模型底下（在模型自身的坐标里，缩放前）
function displayBase(box, color) {
  const size = box.getSize(new THREE.Vector3());
  const w = size.x * 1.12, d = size.z * 1.08, t = Math.max(w, d) * 0.012;
  const geo = new THREE.BoxGeometry(w, t, d);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
  mesh.position.y = -size.y / 2 - t / 2;       // 模型已经以包围盒中心为原点
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
