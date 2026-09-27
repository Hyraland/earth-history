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
// delight：去掉照片扫描贴图里"拍摄时的光影"（0..1），让模型只受场景的阳光照明；roughness：覆盖粗糙度
// bleach：把贴图颜色漂向米白色（0..1），保留明暗细节
// tint：给颜色贴图乘上一个颜色（偏灰的扫描在逆光的蓝色天光下会显得发冷，乘一点暖色）
// mottle：没有颜色贴图时，用噪声在深、中、浅三种颜色之间调出化石骨骼的斑驳色（按模型自身坐标，跟着骨头走）
// credit：署名（作者、原始页面、许可证）
const CC0 = { license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' };
const BY4 = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', modified: true };
const SI = 'Smithsonian Institution';

export const SCANS = {
  // 页岩上的三叶虫印痕：身体长轴横放、头朝行走方向，岩块一半埋进地里，化石所在的层面露在水面之上
  trilobite: {
    file: 'trilobite.glb', size: 460, yaw: -1.67, tilt: 0.42, sink: 0.45, brighten: 1.9, relief: 2.5,
    credit: { ...CC0, by: SI, title: 'Poliella prima (Walcott), USNM PAL116112', url: 'https://3d.si.edu/object/3d/poliella-prima:fcec58e8-ac1f-425d-9d83-8b16ca72b60c' },
  },
  // 邓氏鱼头骨：扫描的后脑是空的，让鼻吻朝向镜头右前方
  dunkleosteus: {
    file: 'dunkleosteus.glb', size: 300, yaw: -0.75, delight: 0.5, roughness: 0.6, brighten: 1.3,
    credit: { ...BY4, by: 'MattMakesSwords - Scans', title: 'Dunkleosteus', url: 'https://sketchfab.com/3d-models/dunkleosteus-58f39882a0ee4921baeb2c3057f46041' },
  },
  // 霍尔茨马登的鱼龙石板：原本竖着展示，放倒平躺；roll 和 yaw 是在场景里对照画面找平的（扫描本身右端偏高）
  ichthyosaur: {
    file: 'ichthyosaur.glb', size: 560, orient: [-Math.PI / 2, 0, 0], tilt: 0.32, yaw: 0.004, roll: -0.044, brighten: 2.4,
    credit: { ...BY4, by: 'Carter County Museum', title: 'CCM Ichthyosaur', url: 'https://sketchfab.com/3d-models/ccm-ichthyosaur-85fe3715565545669f184761d9dbdbf8' },
  },
  archaeopteryx: {
    file: 'archaeopteryx.glb', size: 330, orient: [-Math.PI / 2, 0, 0], yaw: 0, sink: 0.3,   // 石板的边与行走方向平行
    credit: { ...CC0, by: SI, title: 'Archaeopteryx siemensii Dames, USNM PAL509743', url: 'https://3d.si.edu/object/3d/archaeopteryx:391660da-7c49-499c-91f5-88a298686c09' },
  },
  // 剑龙：扫描没有颜色贴图，用 mottle 配出和三角龙贴图一致的深红褐色（颜色取自三角龙贴图的 10% / 50% / 90% 亮度分位，
  // 再提亮约两成——三角龙的贴图里带着拍摄时的高光，看起来比这些平均值亮）；
  // 侧面朝向镜头，头朝行走方向并略微转向镜头，两排骨板和尾刺的轮廓最清楚
  stegosaurus: {
    file: 'stegosaurus.glb', size: 620, orient: [0.061, 0, 0.205], yaw: Math.PI / 2 - 0.35, sink: 0.03,   // orient：扫描本身向一侧歪了约 12°，按四只脚拟合的平面转正
    mottle: { dark: '#381304', mid: '#703c1b', light: '#c08446' },
    credit: { ...BY4, by: 'Artec 3D', title: 'Stegosaurus Skeleton（丹佛自然与科学博物馆展出骨架，Triebold Paleontology 扫描）', url: 'https://sketchfab.com/3d-models/stegosaurus-skeleton-dc6e1c748484449587b81426d41da6cb' },
  },
  triceratops: {
    // 绕身体长轴再转 -0.56：在直立（-0.3）的基础上，背部再朝远处转约 15°
    file: 'triceratops.glb', size: 810, orient: [-0.28, 0, Math.PI / 2 - 0.56], yaw: Math.PI / 2 - 0.35, sink: 0.06,   // 略微下沉，身体倾斜后各只脚都踩进地面
    credit: { ...CC0, by: SI, title: 'Triceratops horridus Marsh, 1889, USNM PAL500000', url: 'https://3d.si.edu/object/3d/triceratops-horridus-marsh-1889:d8c623be-4ebc-11ea-b77f-2e728ce88125' },
  },
  // 二齿兽头骨：真实大小只有十几厘米，放大成一座"头骨山"，吻端朝镜头右前方
  diictodon: {
    file: 'diictodon.glb', size: 300, orient: [0, 0, 0.44], yaw: -Math.PI / 4, brighten: 1.5,   // 像邓氏鱼一样，吻端 45° 朝向镜头右前方
    credit: { ...CC0, by: SI, title: 'Diictodon feliceps Owen, 1876: skull, USNM V22939', url: 'https://3d.si.edu/object/3d/diictodon:3b3add34-8d97-4a66-96fa-4e2d343db77c' },
  },
  // 三尖叉齿兽：嵌在岩块里、关节相连的骨架（真实长约 23 厘米），背面朝上，头朝行走方向，略微朝镜头翘起露出脊椎和肋骨
  thrinaxodon: {
    file: 'thrinaxodon.glb', size: 420, yaw: Math.PI / 2, tilt: 0.5, sink: 0.2, brighten: 1.4, delight: 0.5, bleach: 0.35, roughness: 0.85, tint: '#f2cfa0',
    credit: { ...CC0, by: SI, title: 'Thrinaxodon liorhinus Seeley, 1894, USNM V22812', url: 'https://3d.si.edu/object/3d/thrinaxodon-liorhinus-seeley-1894:e0ac6fea-5384-4787-9abc-cdfffec833c1' },
  },
  cetotherium: {
    file: 'cetotherium.glb', size: 945, yaw: Math.PI / 2,
    credit: { ...BY4, by: 'SchmalhausenEvolMorph', title: 'Cetotherium riabinini assembled skeleton', url: 'https://sketchfab.com/3d-models/cetotherium-riabinini-assembled-skeleton-8532da04db044d9c8417fcec43053e3a' },
  },
  // 露西：骨骼按博物馆陈列的方式平摊，头朝行走方向，半埋在地里；模型没有颜色贴图，配化石骨骼的颜色
  lucy: {
    file: 'lucy.glb', size: 600, orient: [-Math.PI / 2, 0, 0], yaw: -Math.PI / 2, color: '#d2b48a', sink: 0.3,
    credit: { ...BY4, by: 'JackalopeODDsENDs', title: '"Lucy" Australopithecus afarensis; AL 288-1（据标本照片建模）', url: 'https://sketchfab.com/3d-models/lucy-australopithecus-afarensis-al-288-1-9f6c06b0a4e54890a87486e414b8cb0d' },
  },
  mammoth: {
    file: 'mammoth.glb', size: 510, yaw: Math.PI / 2 - 0.3, color: '#9c7c5a',
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
    // 有些 Sketchfab 导出的模型是"无光照"材质（KHR_materials_unlit），只显示贴图里拍摄时的明暗；
    // 换成受光照的标准材质，模型才会被场景里的太阳照亮
    if (o.material.isMeshBasicMaterial) {
      const old = o.material;
      o.material = new THREE.MeshStandardMaterial({ map: old.map, color: old.color, roughness: 0.8, side: old.side });
      old.dispose();
    }
    const m = o.material;
    m.metalness = 0;
    if (cfg.color && !m.map) m.color.set(cfg.color);
    if (cfg.tint && m.map) m.color.set(cfg.tint);
    if (cfg.brighten) m.color.multiplyScalar(cfg.brighten);
    if (cfg.roughness !== undefined) { m.roughness = cfg.roughness; m.roughnessMap = null; }
    if ((cfg.delight || cfg.bleach) && m.map) retouch(m, cfg);
    if (cfg.mottle && !m.map) mottle(m, cfg.mottle);
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
  // 斑驳的尺度按模型大小换算：最长边上大约 40 块大斑
  model.traverse((o) => { if (o.material?.userData.mottleFreq) o.material.userData.mottleFreq.value = 40 / Math.max(size0.x, size0.y, size0.z); });
  if (cfg.base) oriented.add(displayBase(box0, cfg.base));
  return { ...placeOnGround(oriented, cfg), credit: cfg.credit };
}

// 修饰扫描贴图：
//   去光照 —— 照片扫描的颜色贴图里带着拍摄现场的明暗。用贴图低分辨率层级（mipmap）估计这种大尺度明暗，
//             再把它除掉，只留下材质本身的颜色和细节，于是模型的明暗完全由场景里的太阳和天空决定。
//   漂白   —— 把颜色换成米白色，但按原贴图的相对明暗调制，骨骼的细节还在。
function retouch(material, { delight = 0, bleach = 0 }) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDelight = { value: delight };
    shader.uniforms.uBleach = { value: bleach };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDelight;\nuniform float uBleach;')
      .replace('#include <map_fragment>', /* glsl */ `
        #ifdef USE_MAP
          vec4 texel = texture2D(map, vMapUv);
          vec3 W = vec3(0.299, 0.587, 0.114);
          float lumLow = dot(textureLod(map, vMapUv, 5.5).rgb, W);
          float lumAll = dot(textureLod(map, vec2(0.5), 20.0).rgb, W);
          vec3 rgb = texel.rgb * mix(1.0, clamp(lumAll / max(lumLow, 0.02), 0.55, 1.9), uDelight);
          float detail = clamp(dot(rgb, W) / max(lumAll, 0.02), 0.35, 1.7);
          rgb = mix(rgb, vec3(0.94, 0.87, 0.76) * detail, uBleach);
          diffuseColor *= vec4(rgb, texel.a);
        #endif`);
  };
  material.needsUpdate = true;
}

// 化石骨骼的斑驳色：两层噪声，大斑决定深浅，小斑加细碎的颗粒；在 mid 两侧往 dark / light 偏
function mottle(material, { dark, mid, light }) {
  const freq = { value: 1 };
  material.userData.mottleFreq = freq;
  material.color.set('#ffffff');
  material.roughness = 0.75;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFreq = freq;
    shader.uniforms.uDark = { value: new THREE.Color(dark) };
    shader.uniforms.uMid = { value: new THREE.Color(mid) };
    shader.uniforms.uLight = { value: new THREE.Color(light) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBone;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBone = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        varying vec3 vBone;
        uniform float uFreq;
        uniform vec3 uDark, uMid, uLight;
        float mh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float mn(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(mh(i), mh(i + vec3(1, 0, 0)), f.x), mix(mh(i + vec3(0, 1, 0)), mh(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(mh(i + vec3(0, 0, 1)), mh(i + vec3(1, 0, 1)), f.x), mix(mh(i + vec3(0, 1, 1)), mh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        {
          vec3 q = vBone * uFreq;
          float big = mn(q) * 0.55 + mn(q * 2.3 + 7.0) * 0.3 + mn(q * 5.1 + 3.0) * 0.15;
          float fine = mn(q * 23.0);
          float t = clamp((big - 0.5) * 2.4 + (fine - 0.5) * 0.5, -1.0, 1.0);
          vec3 c = t < 0.0 ? mix(uMid, uDark, -t) : mix(uMid, uLight, t);
          diffuseColor.rgb *= c;
        }`);
  };
  material.needsUpdate = true;
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
