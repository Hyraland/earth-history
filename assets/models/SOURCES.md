# 模型来源

## 史密森尼学会（CC0）

以下扫描模型来自史密森尼学会 3D 数字化项目（Smithsonian 3D Digitization），均为 **CC0**（公有领域）。
史密森尼建议注明来源，下面按其建议列出。下载的是官方提供的 "Low resolution" Draco 压缩 glb，未做修改。

| 文件 | 标本 | 馆藏号 | 页面 |
|---|---|---|---|
| `trilobite.glb` | *Poliella prima* (Walcott)，寒武纪三叶虫，Mount Whyte 组 | USNM PAL116112 | https://3d.si.edu/object/3d/poliella-prima:fcec58e8-ac1f-425d-9d83-8b16ca72b60c |
| `archaeopteryx.glb` | *Archaeopteryx siemensii* Dames，晚侏罗世，德国索伦霍芬石灰岩 | USNM PAL509743 | https://3d.si.edu/object/3d/archaeopteryx:391660da-7c49-499c-91f5-88a298686c09 |
| `mammoth.glb` | *Mammuthus primigenius* (Blumbach)，更新世，阿拉斯加，完整骨架 | USNM V23792 | https://3d.si.edu/object/3d/mammoth:341c96cd-f967-4540-8ed1-d3fc56d31f12 |
| `diictodon.glb` | *Diictodon feliceps* Owen, 1876，头骨，二叠纪晚期，南非博福特群（J. W. Kitching 1961 年采集）；下载的是 Web3D 中等精度版本 | USNM V22939 | https://3d.si.edu/object/3d/diictodon:3b3add34-8d97-4a66-96fa-4e2d343db77c |
| `triceratops.glb` | *Triceratops horridus* Marsh, 1889，晚白垩世马斯特里赫特期，怀俄明州，完整骨架（J. B. Hatcher 1890 年采集） | USNM PAL500000 | https://3d.si.edu/object/3d/triceratops-horridus-marsh-1889:d8c623be-4ebc-11ea-b77f-2e728ce88125 |

Courtesy of the Smithsonian Institution, National Museum of Natural History, Department of Paleobiology.

## Sketchfab（CC BY 4.0）

以下模型按 CC BY 4.0 使用，须署名。它们都经过 `tools/process_scan.py` 修改：合并网格并焊接顶点、删除扫描碎片、
减面、缩小贴图、Draco 压缩；邓氏鱼另外切除了展台背板、支架杆和后方的扫描残片；鲸兽删除了原作者补建的白色舌骨、胸骨和腰带，以及蓝灰色的支架杆。页面上的展牌和"来源与致谢"面板都有署名。

| 文件 | 标本 | 原始模型 | 作者 |
|---|---|---|---|
| `dunkleosteus.glb` | 邓氏鱼头骨（展出标本的扫描，作者未注明是否为复制品） | [Dunkleosteus](https://sketchfab.com/3d-models/dunkleosteus-58f39882a0ee4921baeb2c3057f46041) | MattMakesSwords - Scans |
| `ichthyosaur.glb` | *Stenopterygius quadriscissus*，德国霍尔茨马登/奥姆登，早侏罗世，卡特县博物馆展品 | [CCM Ichthyosaur](https://sketchfab.com/3d-models/ccm-ichthyosaur-85fe3715565545669f184761d9dbdbf8) | Carter County Museum |
| `cetotherium.glb` | *Cetotherium riabinini*，NMNH-P 668/1，乌克兰国家自然历史博物馆，组装骨架 | [Cetotherium riabinini assembled skeleton](https://sketchfab.com/3d-models/cetotherium-riabinini-assembled-skeleton-8532da04db044d9c8417fcec43053e3a) | SchmalhausenEvolMorph |
| `stegosaurus.glb` | *Stegosaurus*，丹佛自然与科学博物馆展出骨架，Triebold Paleontology 用 Artec Space Spider 扫描；原模型没有颜色贴图，网页里按三角龙贴图的色调着色 | [Stegosaurus Skeleton](https://sketchfab.com/3d-models/stegosaurus-skeleton-dc6e1c748484449587b81426d41da6cb) | Artec 3D |
| `lucy.glb` | 露西 AL 288-1（据标本照片建模，不是扫描） | ["Lucy" Australopithecus afarensis; AL 288-1](https://sketchfab.com/3d-models/lucy-australopithecus-afarensis-al-288-1-9f6c06b0a4e54890a87486e414b8cb0d) | JackalopeODDsENDs |

许可证：https://creativecommons.org/licenses/by/4.0/

处理命令（原始下载放在不进 git 的 `assets/incoming/`）：

```bash
blender -b -P tools/process_scan.py -- export <scene.gltf> assets/models/dunkleosteus.glb --faces 200000 --min-part 0.002 --tex 4096 --cut "(x < -0.55 and y < 1.35) or (x < -0.55 and abs(z) > 0.45) or (x < -0.2 and y < 0.78) or (x < 0.0 and y < 0.6)"
blender -b -P tools/process_scan.py -- export <scene.gltf> assets/models/ichthyosaur.glb --faces 160000 --tex 4096 --min-part 0.0003
blender -b -P tools/process_scan.py -- export <scene.gltf> assets/models/cetotherium.glb --faces 220000 --tex 4096 --min-part 0.0003
# 第二遍（在上一步的结果上）：删掉白色补建部件和支架杆
blender -b -P tools/process_scan.py -- export assets/models/cetotherium.glb assets/models/cetotherium.glb --faces 999999 --tex 2048 --weld 1e-8 --min-part 0.002 --drop-material Hioid --cut-color "b > r + 0.04"
blender -b -P tools/process_scan.py -- export <scene.gltf> assets/models/stegosaurus.glb --faces 260000 --min-part 0.0003
blender -b -P tools/process_scan.py -- export <scene.gltf> assets/models/lucy.glb --faces 260000 --tex 2048 --min-part 0.0003
```
