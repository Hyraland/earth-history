"""把下载的扫描模型整理成网页用的 glb：合并焊接 → 清理碎片 → 减面 → 贴图缩小 → Draco 压缩。

用法（在 Blender 里无界面运行）：
  blender -b -P tools/process_scan.py -- inspect <scene.gltf>
  blender -b -P tools/process_scan.py -- export <scene.gltf> <out.glb> [--faces 150000] [--min-part 0.002] [--tex 2048] [--cut "<条件>"]

--min-part：焊接后面数少于总面数这个比例的"孤立碎块"会被删掉（扫描里飘着的碎片）
--weld：焊接距离（相对于模型最大尺寸，默认 2e-5）；已经处理过的模型用很小的值，只合并完全重合的顶点
--drop-material：删掉用这个材质名（前缀）的所有面，比如扫描里单独补建、没有贴图的白色部件
--cut-color：Python 条件表达式，面在贴图上的颜色（r g b，0..1）满足它就删掉，比如偏蓝灰的支架 "b > r + 0.03"
--cut：Python 条件表达式，面的中心满足它就删掉；x y z 是 glTF 坐标（Y 朝上），例如 "x < -0.5 and y < 1.2"
"""

import sys
import bpy
import bmesh


def args():
    a = sys.argv[sys.argv.index("--") + 1:]
    opts = {"faces": 150000, "min-part": 0.0, "tex": 2048, "cut": None, "cut-color": None, "drop-material": None, "weld": 2e-5}
    pos = []
    i = 0
    while i < len(a):
        if a[i].startswith("--"):
            key = a[i][2:]
            opts[key] = a[i + 1] if key in ("cut", "cut-color", "drop-material") else float(a[i + 1])
            i += 2
        else:
            pos.append(a[i])
            i += 1
    return pos, opts


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def loose_parts(obj):
    """返回每个连通块的面数（从大到小）"""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen = set()
    sizes = []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack = [f]
        seen.add(f.index)
        n = 0
        while stack:
            cur = stack.pop()
            n += 1
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
        sizes.append(n)
    bm.free()
    return sorted(sizes, reverse=True)


def inspect(path):
    meshes = load(path)
    total = 0
    for o in meshes:
        faces = len(o.data.polygons)
        total += faces
        parts = loose_parts(o)
        dims = o.dimensions
        mats = [m.name for m in o.data.materials if m]
        print(f"MESH {o.name}: faces={faces} parts={len(parts)} largest={parts[:6]} "
              f"small(<0.2%)={sum(1 for p in parts if p < faces * 0.002)} dims=({dims.x:.2f},{dims.y:.2f},{dims.z:.2f}) mats={mats}")
    imgs = [(i.name, i.size[0], i.size[1]) for i in bpy.data.images]
    print(f"TOTAL faces={total} meshes={len(meshes)} images={imgs}")


def remove_small_parts(obj, min_ratio):
    if min_ratio <= 0:
        return 0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    total = len(bm.faces)
    seen = set()
    doomed = []
    for f in bm.faces:
        if f.index in seen:
            continue
        comp = []
        stack = [f]
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for e in cur.edges:
                for nf in e.link_faces:
                    if nf.index not in seen:
                        seen.add(nf.index)
                        stack.append(nf)
        if len(comp) < total * min_ratio:
            doomed.extend(comp)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    loose_verts = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose_verts, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    return len(doomed)


def join_and_weld(meshes, weld=2e-5):
    """合并成一个网格，并焊接重合的顶点：扫描常按贴图分块，或者干脆是互不相连的三角面"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    diag = max(obj.dimensions) or 1.0
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=diag * weld)
    bm.to_mesh(obj.data)
    bm.free()
    print(f"WELD {before} -> {len(obj.data.vertices)} verts")
    return obj


def cut_faces(obj, expr):
    """删掉中心满足条件的面（条件用 glTF 坐标：Blender 的 x, -z, y 反过来就是 glTF 的 x, y, z）"""
    if not expr:
        return 0
    code = compile(expr, "<cut>", "eval")
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = []
    for f in bm.faces:
        c = mw @ f.calc_center_median()
        if eval(code, {"abs": abs}, {"x": c.x, "y": c.z, "z": -c.y}):
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    print(f"CUT {len(doomed)} faces")
    return len(doomed)


def drop_material(obj, prefix):
    if not prefix:
        return 0
    idx = [i for i, m in enumerate(obj.data.materials) if m and m.name.startswith(prefix)]
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    doomed = [f for f in bm.faces if f.material_index in idx]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    print(f"DROP material {prefix}: {len(doomed)} faces")
    return len(doomed)


def cut_by_color(obj, expr):
    """按面在颜色贴图上的平均颜色删除（取面各角的 UV 采样）"""
    if not expr:
        return 0
    code = compile(expr, "<cut-color>", "eval")
    mats = obj.data.materials
    def base_image(mat):
        if not mat or not mat.use_nodes:
            return None
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                return n.image
        return None
    images = {}
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    uv = bm.loops.layers.uv.active
    doomed = []
    for f in bm.faces:
        img = base_image(mats[f.material_index]) if f.material_index < len(mats) else None
        if img is None or uv is None:
            continue
        if img.name not in images:
            images[img.name] = (img.size[0], img.size[1], list(img.pixels))
        w, h, px = images[img.name]
        r = g = b = 0.0
        for loop in f.loops:
            u, v = loop[uv].uv
            x = min(w - 1, max(0, int((u % 1.0) * w)))
            y = min(h - 1, max(0, int((v % 1.0) * h)))
            k = (y * w + x) * 4
            r += px[k]; g += px[k + 1]; b += px[k + 2]
        n = len(f.loops)
        if eval(code, {}, {"r": r / n, "g": g / n, "b": b / n}):
            doomed.append(f)
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()
    print(f"CUT-COLOR {len(doomed)} faces")
    return len(doomed)


def export(path, out, opts):
    meshes = [join_and_weld(load(path), opts["weld"])]
    drop_material(meshes[0], opts["drop-material"])
    total = sum(len(o.data.polygons) for o in meshes)
    parts = loose_parts(meshes[0])
    print(f"PARTS after weld: {len(parts)} largest={parts[:10]} "
          f"under 0.05%={sum(1 for p in parts if p < total * 0.0005)} under 0.2%={sum(1 for p in parts if p < total * 0.002)}")
    cut_faces(meshes[0], opts["cut"])
    cut_by_color(meshes[0], opts["cut-color"])
    removed = sum(remove_small_parts(o, opts["min-part"]) for o in meshes)
    total_after = sum(len(o.data.polygons) for o in meshes)
    ratio = min(1.0, opts["faces"] / max(1, total_after))
    for o in meshes:
        if ratio < 1.0:
            m = o.modifiers.new("decimate", "DECIMATE")
            m.ratio = ratio
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    for img in bpy.data.images:
        w, h = img.size
        s = min(1.0, opts["tex"] / max(w, h, 1))
        if s < 1.0:
            img.scale(int(w * s), int(h * s))
    final = sum(len(o.data.polygons) for o in meshes)
    bpy.ops.export_scene.gltf(
        filepath=out, export_format="GLB",
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_image_format="JPEG", export_jpeg_quality=88,
    )
    print(f"EXPORTED {out}: faces {total} -> removed {removed} -> {final}")


pos, opts = args()
if pos[0] == "inspect":
    inspect(pos[1])
else:
    export(pos[1], pos[2], opts)
