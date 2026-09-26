// 展品管理：展品进入视野附近才构建（或加载模型），离开后释放。
// 新增化石时，在 BUILDERS 里登记它的 id 即可；没登记的展位显示占位巨石。

import * as THREE from 'three';
import { buildPlaceholder } from './placeholder.js';
import { SCANS } from './scan.js';
import { CURVE_R, curveDrop } from '../terrain.js';
import { formatAge } from '../timeline.js';

// 构建函数签名：(exhibit, { renderer }) => { object, labelAnchor }
const BUILDERS = {
  ammonite: (e, ctx) => import('./ammonite.js').then((m) => m.buildAmmonite(e, ctx)),
  // 石板上的印痕化石
  dickinsonia: (e, ctx) => import('./impressions.js').then((m) => m.buildDickinsonia(e, ctx)),
  grypania: (e, ctx) => import('./impressions.js').then((m) => m.buildGrypania(e, ctx)),
  cooksonia: (e, ctx) => import('./impressions.js').then((m) => m.buildCooksonia(e, ctx)),
  archaefructus: (e, ctx) => import('./impressions.js').then((m) => m.buildArchaefructus(e, ctx)),
  // 立体的程序化化石
  stromatolite: (e, ctx) => import('./stromatolite.js').then((m) => m.buildStromatolite(e, ctx)),
  lepidodendron: (e, ctx) => import('./lepidodendron.js').then((m) => m.buildLepidodendron(e, ctx)),
};
// 史密森尼扫描模型
for (const id of Object.keys(SCANS)) BUILDERS[id] = (e, ctx) => import('./scan.js').then((m) => m.buildScan(e, ctx));

const LOAD_RANGE = 1700;    // 距镜头多远开始构建
const UNLOAD_RANGE = 2000;  // 距镜头多远释放（比加载范围大一点，避免来回抖动）

const TEXTURE_SLOTS = ['map', 'roughnessMap', 'metalnessMap', 'bumpMap', 'normalMap', 'iridescenceMap', 'aoMap', 'emissiveMap'];

// 释放几何体、材质和贴图；标记了 userData.keep 的贴图是缓存，留着下次复用
function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      [].concat(o.material).forEach((m) => {
        TEXTURE_SLOTS.forEach((k) => {
          const t = m[k];
          if (!t || t.userData.keep) return;
          if (t.userData.renderTarget) t.userData.renderTarget.dispose();
          else t.dispose();
        });
        m.dispose();
      });
    }
  });
}

export class ExhibitManager {
  constructor({ scene, exhibits, labelLayer, renderer }) {
    this.scene = scene;
    this.ctx = { renderer };
    this.labelLayer = labelLayer;
    this.slots = exhibits.map((e) => ({ exhibit: e, state: 'idle', group: null, label: null, token: 0 }));
    this._v = new THREE.Vector3();
  }

  get loadedCount() {
    return this.slots.filter((s) => s.state === 'ready').length;
  }

  async load(slot) {
    slot.state = 'loading';
    const token = ++slot.token;
    const e = slot.exhibit;
    let built;
    try {
      built = BUILDERS[e.id] ? await BUILDERS[e.id](e, this.ctx) : buildPlaceholder(e);
    } catch (err) {
      console.warn(`展品 ${e.id} 构建失败，改用占位`, err);
      built = buildPlaceholder(e);
    }
    if (slot.state !== 'loading' || token !== slot.token) {   // 加载途中已被卸载
      disposeTree(built.object);
      return;
    }
    const group = new THREE.Group();
    group.add(built.object);
    this.scene.add(group);
    slot.group = group;
    slot.labelAnchor = built.labelAnchor;
    slot.label = this.makeLabel(e, built.placeholder);
    slot.state = 'ready';
  }

  unload(slot) {
    slot.token++;
    if (slot.group) {
      this.scene.remove(slot.group);
      disposeTree(slot.group);
    }
    slot.label?.remove();
    slot.group = slot.label = null;
    slot.state = 'idle';
  }

  makeLabel(e, placeholder) {
    const el = document.createElement('div');
    el.className = 'placard';
    el.innerHTML = `
      <div class="placard-card">
        <div class="placard-head"><span class="placard-idx">${String(e.index).padStart(2, '0')}</span>
          <span class="placard-name">${e.name}</span>${placeholder ? '<span class="placard-tag">模型待建</span>' : ''}</div>
        <div class="placard-latin">${e.latin}</div>
        <div class="placard-meta">${formatAge(e.age)} · ${e.milestone}</div>
        <div class="placard-desc">${e.desc}</div>
      </div>
      <div class="placard-stem"></div>`;
    this.labelLayer.appendChild(el);
    return el;
  }

  update(scroll, camera, width, height) {
    for (const slot of this.slots) {
      const e = slot.exhibit;
      const lx = e.x - scroll;
      if (slot.state === 'idle' && Math.abs(lx) < LOAD_RANGE) this.load(slot);
      else if (slot.state !== 'idle' && Math.abs(lx) > UNLOAD_RANGE) this.unload(slot);
      if (slot.state !== 'ready') continue;

      // 放在弯曲的地面上：下沉并随曲面倾斜
      slot.group.position.set(lx, e.groundH - curveDrop(lx, e.z), e.z);
      slot.group.rotation.set(Math.atan(e.z / CURVE_R), 0, -Math.atan(lx / CURVE_R));

      // 展牌：投影到屏幕，展品靠近画面中央时显示
      const v = this._v.copy(slot.labelAnchor);
      slot.group.localToWorld(v);
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * width;
      // 展牌在展品右侧；不超出屏幕，底部让开时间轴
      const sy = THREE.MathUtils.clamp((-v.y * 0.5 + 0.5) * height, 110, height - 230);
      const focus = 1 - THREE.MathUtils.smoothstep(Math.abs(v.x), 0.35, 0.75);
      slot.label.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      slot.label.style.opacity = focus.toFixed(3);
      slot.label.style.visibility = focus > 0.01 && v.z < 1 ? 'visible' : 'hidden';
    }
  }
}
