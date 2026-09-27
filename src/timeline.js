// 地球历史时间轴：展品、地球事件、地质年代与"世界坐标 ↔ 年代"的换算。
// 年代单位统一为 Ma（百万年前）。

import { EN } from './i18n.js';

// ---- 站点：按时间顺序排列。展品之间留更长的路，事件之间留短一点 ----
// kind: 'exhibit' 展品 | 'event' 地球事件 | 'extinction' 大灭绝 | 'start' / 'end'
export const STATIONS = [
  { kind: 'start', age: 4600, name: '地球形成', desc: '岩浆海洋逐渐冷却，最早的地壳开始形成。' },
  { kind: 'exhibit', id: 'stromatolite', age: 3500, name: '叠层石', latin: 'Stromatolite',
    milestone: '最早的生命', desc: '微生物席一层层黏结沉积物形成的圆丘，是地球上最古老的生命证据之一。' },
  { kind: 'event', age: 2400, name: '大氧化事件', desc: '光合微生物释放的氧气开始在大气中累积，海水中的铁被氧化，沉淀成红黑相间的条带状铁建造。' },
  { kind: 'exhibit', id: 'grypania', age: 1870, name: '卷曲藻', latin: 'Grypania spiralis',
    milestone: '真核生物出现', desc: '肉眼可见的螺旋带状化石，可能是最早的真核藻类之一。' },
  { kind: 'event', age: 720, name: '雪球地球', desc: '冰川可能一直延伸到赤道，整颗星球几乎被冰雪覆盖，持续近亿年。' },
  { kind: 'exhibit', id: 'dickinsonia', age: 558, name: '狄更逊水母', latin: 'Dickinsonia',
    milestone: '最早的复杂动物', desc: '扁平分节的椭圆形生物。它的化石中检出了胆固醇分子，证实它是动物，而不是真的水母。' },
  { kind: 'exhibit', id: 'trilobite', age: 521, name: '三叶虫', latin: 'Trilobita',
    milestone: '寒武纪大爆发', desc: '最早拥有复杂眼睛的动物之一，在海洋中繁盛了近 3 亿年。' },
  { kind: 'extinction', age: 445, name: '奥陶纪末大灭绝', desc: '冰期来临、海平面骤降，约 85% 的海洋物种消失。' },
  { kind: 'exhibit', id: 'cooksonia', age: 430, name: '库克逊蕨', latin: 'Cooksonia',
    milestone: '植物登上陆地', desc: '只有几厘米高的分叉小茎，顶端长着孢子囊，是最早的维管植物之一。' },
  { kind: 'exhibit', id: 'tiktaalik', age: 375, name: '提塔利克鱼', latin: 'Tiktaalik roseae',
    milestone: '从水走上陆地', desc: '有脖子、有能撑起身体的鳍肢，介于鱼和四足动物之间。' },
  { kind: 'extinction', age: 372, name: '泥盆纪晚期大灭绝', desc: '海洋大范围缺氧，生物礁生态系统崩溃。' },
  { kind: 'exhibit', id: 'dunkleosteus', age: 365, name: '邓氏鱼', latin: 'Dunkleosteus terrelli',
    milestone: '有颌鱼称霸', desc: '体长约 4 米、头部覆盖厚重骨甲的盾皮鱼，泥盆纪"鱼类时代"的顶级掠食者。' },
  { kind: 'exhibit', id: 'lepidodendron', age: 310, name: '鳞木', latin: 'Lepidodendron',
    milestone: '最早的大森林', desc: '高达 30 多米的石松类大树，树皮布满菱形叶痕。石炭纪森林的遗骸变成了今天的煤层。' },
  { kind: 'exhibit', id: 'diictodon', age: 258, name: '二齿兽', latin: 'Diictodon feliceps',
    milestone: '哺乳动物的远祖支系', desc: '二叠纪晚期的小型植食性合弓类，嘴里只有一对獠牙，会挖洞生活。合弓类不是恐龙，和哺乳动物的亲缘关系反而更近。' },
  { kind: 'extinction', age: 252, name: '二叠纪末大灭绝', desc: '西伯利亚大规模火山喷发，八成以上的海洋物种灭绝，是地球史上最严重的一次。' },
  // ---- 三叠纪：大灭绝后的恢复，盘古大陆上的一场大雨，恐龙时代的前夜 ----
  // 这三站是后加的（extra，不占 DEPTHS 的循环位置）；pad 是额外拉长的路，让这一段总共正好加长 4096，
  // 和地面宏观贴图的周期一致——后面各展品脚下的河流、水域、植被都和加这三站之前一模一样
  { kind: 'exhibit', id: 'thrinaxodon', age: 250, z: -860, extra: true, name: '三尖叉齿兽', latin: 'Thrinaxodon liorhinus',
    milestone: '大灭绝的幸存者', desc: '二叠纪末大灭绝之后最早的幸存者之一，常在自己挖的洞里被发现，身体蜷成一团。它已经有分化的牙齿和能边嚼边呼吸的次生腭，是哺乳动物的近亲。这具骨架由 J. W. Kitching 于 1961 年在南非采集，现藏史密森尼国家自然历史博物馆。' },
  { kind: 'event', id: 'carnian', age: 233, pad: 208, rain: true, name: '卡尼期洪积事件',
    desc: '盘古大陆上下了一两百万年的雨。干旱的内陆变得湿润，植被和动物群大换班——雨停之后，恐龙在各个大陆上迅速扩散开来。' },
  { kind: 'exhibit', id: 'petrified', age: 220, z: -900, pad: 208, extra: true, name: '石化森林', latin: 'Agathoxylon arizonicum',
    milestone: '盘古大陆的森林', desc: '洪水冲倒的南洋杉类大树被埋进河沙和火山灰，木质被二氧化硅置换成玛瑙和碧玉。石化的树干很脆，断成一截一截；截面上是铁和锰染出的红、黄、紫色。亚利桑那州石化森林国家公园。' },
  { kind: 'extinction', age: 201, name: '三叠纪末大灭绝', desc: '中大西洋岩浆省喷发。灾难之后，恐龙崛起为陆地霸主。' },
  // 菊石放大后往远处挪（z: -1000），不挡小人的路
  { kind: 'exhibit', id: 'ammonite', age: 195, z: -1000, name: '菊石', latin: 'Asteroceras obtusum',
    milestone: '中生代的海洋', desc: '侏罗纪早期的菊石，粗壮笔直的放射肋和腹部中央的棱脊是它的特征。菊石演化快、分布广，是地质学家划分地层的"时钟"。' },
  { kind: 'exhibit', id: 'ichthyosaur', age: 182, name: '狭翼鱼龙', latin: 'Stenopterygius quadriscissus',
    milestone: '爬行动物重返海洋', desc: '德国霍尔茨马登黑色页岩中的完整骨架。鱼龙的祖先是陆地爬行动物，三叠纪初期重新回到海洋，演化出和海豚相似的流线体形。' },
  { kind: 'exhibit', id: 'trackway', age: 155, name: '蜥脚类足迹', latin: 'Parabrontopodus',
    milestone: '恐龙称霸陆地', desc: '一只巨大的蜥脚类恐龙走过潮湿的泥滩：后脚印像一个大圆盆，前脚印是小一些的马蹄形。一只兽脚类恐龙的三趾脚印从旁边斜穿而过。足迹记录的是恐龙活着时的一瞬间。' },
  // 后来插进来的展品（extra）：自己指定纵深，不占用下面 DEPTHS 的循环位置，后面各展品的纵深保持不变
  { kind: 'exhibit', id: 'stegosaurus', age: 152, z: -770, extra: true, name: '剑龙', latin: 'Stegosaurus',
    milestone: '侏罗纪的巨兽', desc: '背上两排交错的骨板、尾巴末端四根尖刺，是晚侏罗世莫里森组最有名的植食恐龙。这具骨架是丹佛自然与科学博物馆的展品。' },
  // 始祖鸟放大到 1.8 倍（纵深 -920）
  { kind: 'exhibit', id: 'archaeopteryx', age: 150, z: -920, name: '始祖鸟', latin: 'Archaeopteryx',
    milestone: '鸟类起源', desc: '有羽毛和翅膀，也有牙齿、爪子和长长的骨质尾巴。鸟类其实就是恐龙——兽脚类恐龙中活到今天的那一支；始祖鸟让我们看到恐龙正在变成鸟的样子。' },
  { kind: 'exhibit', id: 'archaefructus', age: 125, name: '辽宁古果', latin: 'Archaefructus liaoningensis',
    milestone: '开花植物出现', desc: '种子被心皮包裹，是已知最早的开花植物之一。' },
  { kind: 'exhibit', id: 'triceratops', age: 67, name: '三角龙', latin: 'Triceratops horridus',
    milestone: '恐龙时代的尾声', desc: '最后的非鸟恐龙之一，与霸王龙生活在同一时代。这具骨架由 J. B. Hatcher 于 1890 年在怀俄明州采集，现藏史密森尼国家自然历史博物馆。' },
  { kind: 'extinction', age: 66, name: '白垩纪末大灭绝', desc: '小行星撞击希克苏鲁伯，非鸟恐龙与菊石一同消失。' },
  { kind: 'exhibit', id: 'cetotherium', age: 11, name: '鲸兽', latin: 'Cetotherium riabinini',
    milestone: '海洋里的哺乳动物', desc: '中新世的小型须鲸，靠鲸须滤食。鲸的祖先是陆地上的偶蹄类，大约 5000 万年前才回到海洋。这具骨架藏于乌克兰国家自然历史博物馆。' },
  { kind: 'exhibit', id: 'lucy', age: 3.2, name: '露西', latin: 'Australopithecus afarensis',
    milestone: '直立行走', desc: '骨盆和腿骨显示她已能直立行走，而脑容量仍与黑猩猩相近。' },
  { kind: 'event', age: 2.58, name: '第四纪冰期', desc: '冰盖周期性地推进和消退，冰期与间冰期开始交替。' },
  { kind: 'exhibit', id: 'mammoth', age: 0.02, name: '猛犸象', latin: 'Mammuthus primigenius',
    milestone: '末次冰盛期', desc: '长毛象的象牙可达 4 米长。它们与早期人类共同生活在冰原上。' },
  // 后加的展品（extra）：插在猛犸象和终点之间，只让终点往后挪，前面所有展品的位置都不变
  { kind: 'exhibit', id: 'cuneiform', age: 0.0041, z: -880, extra: true, name: '楔形文字泥板', latin: 'Cuneiform tablet · Ur III',
    milestone: '文字与城市', desc: '约 5200 年前，美索不达米亚的乌鲁克和埃及几乎同时出现了文字，人类从此把自己的故事写了下来，史前变成了历史。这块泥板是一千年后乌尔第三王朝治下的大麦账目：谁在哪天从哪块田的仓库领了多少大麦。荷兰莱顿国家古物博物馆藏。' },
  { kind: 'end', age: 0, name: '现在', desc: '' },   // 结束语在结尾的星空里（main.js 的 ENDING_LINES）
];

// ---- 英文版的站点文字（按 id，没有 id 的按年代） ----
const STATION_EN = {
  4600: { name: 'Earth forms', desc: 'A magma ocean slowly cools, and the first crust begins to form.' },
  stromatolite: { name: 'Stromatolite', milestone: 'The earliest life',
    desc: 'Domes built up layer upon layer as microbial mats trapped and bound sediment — among the oldest evidence of life on Earth.' },
  2400: { name: 'Great Oxidation Event',
    desc: 'Oxygen released by photosynthetic microbes begins to accumulate in the atmosphere. Iron dissolved in seawater rusts and settles out as red-and-black banded iron formations.' },
  grypania: { name: 'Grypania', milestone: 'Complex cells appear', desc: 'A coiled ribbon visible to the naked eye — possibly one of the earliest eukaryotic algae.' },
  720: { name: 'Snowball Earth', desc: 'Glaciers may have reached all the way to the equator, locking almost the entire planet in ice for tens of millions of years.' },
  dickinsonia: { name: 'Dickinsonia', milestone: 'The first complex animals',
    desc: 'A flat, segmented, oval creature. Traces of cholesterol preserved in its fossils reveal that it was an animal.' },
  trilobite: { name: 'Trilobite', milestone: 'The Cambrian explosion',
    desc: 'Among the first animals with complex eyes, trilobites flourished in the oceans for nearly 300 million years.' },
  445: { name: 'End-Ordovician extinction', desc: 'An ice age sets in and sea levels plummet; around 85% of marine species vanish.' },
  cooksonia: { name: 'Cooksonia', milestone: 'Plants move onto land',
    desc: 'Branching stems just a few centimetres tall, tipped with spore capsules — one of the earliest vascular plants.' },
  tiktaalik: { name: 'Tiktaalik', milestone: 'From water onto land',
    desc: 'It had a neck and fins sturdy enough to prop up its body — a creature halfway between fish and four-legged animals.' },
  372: { name: 'Late Devonian extinction', desc: 'Oxygen drains from vast stretches of the ocean, and reef ecosystems collapse.' },
  dunkleosteus: { name: 'Dunkleosteus', milestone: 'Jawed fish rule the seas',
    desc: 'A four-metre placoderm whose head was clad in thick bony armour — the top predator of the Devonian "Age of Fishes".' },
  lepidodendron: { name: 'Lepidodendron', milestone: 'The first great forests',
    desc: 'Towering club-moss trees more than 30 metres tall, their bark patterned with diamond-shaped leaf scars. The remains of these Carboniferous forests became the coal we burn today.' },
  diictodon: { name: 'Diictodon', milestone: 'Early relatives of mammals',
    desc: 'A small, burrowing plant-eater from the late Permian with a single pair of tusks. It was a synapsid — not a dinosaur, but part of the wider group that also includes mammals.' },
  252: { name: 'End-Permian extinction',
    desc: 'Colossal volcanic eruptions in Siberia wipe out more than 80% of marine species — the most severe extinction in Earth\'s history.' },
  thrinaxodon: { name: 'Thrinaxodon', milestone: 'Survivor of the Great Dying',
    desc: 'One of the earliest survivors of the end-Permian extinction, often found curled up inside its own burrow. It already had specialised teeth and a secondary palate that let it breathe while chewing — a close relative of mammals. Collected in South Africa by J. W. Kitching in 1961; now at the Smithsonian\'s National Museum of Natural History.' },
  carnian: { name: 'Carnian Pluvial Episode',
    desc: 'For one to two million years, rain fell across Pangaea. The dry interior turned humid and plant and animal communities were transformed — and when the rains eased, dinosaurs spread rapidly across every continent.' },
  petrified: { name: 'Petrified Forest', milestone: 'The forests of Pangaea',
    desc: 'Great conifers toppled by floods were buried under river sand and volcanic ash, and silica slowly replaced their wood with agate and jasper. The brittle logs later cracked into rounds, their faces stained red, yellow and purple by iron and manganese. Petrified Forest National Park, Arizona.' },
  201: { name: 'End-Triassic extinction', desc: 'Vast eruptions from the Central Atlantic Magmatic Province. In the aftermath, dinosaurs rise to dominate the land.' },
  ammonite: { name: 'Ammonite', milestone: 'Mesozoic seas',
    desc: 'An Early Jurassic ammonite, recognisable by its strong, straight ribs and the keel running along its outer edge. Because ammonites evolved quickly and spread far, geologists use them as "clocks" to date rock layers.' },
  ichthyosaur: { name: 'Stenopterygius', milestone: 'Reptiles return to the sea',
    desc: 'A complete skeleton from the black shales of Holzmaden, Germany. Ichthyosaurs descended from land reptiles that returned to the sea in the Early Triassic, evolving sleek, dolphin-like bodies.' },
  trackway: { name: 'Sauropod trackway', milestone: 'Dinosaurs rule the land',
    desc: 'A giant sauropod once crossed this wet mudflat: its hind feet pressed out great round basins, its front feet smaller horseshoe shapes. A theropod\'s three-toed prints cut across at an angle. Footprints preserve a single moment in a living dinosaur\'s day.' },
  stegosaurus: { name: 'Stegosaurus', milestone: 'Giants of the Jurassic',
    desc: 'With two rows of alternating plates along its back and four spikes at the tip of its tail, it is the most famous plant-eater of the Late Jurassic Morrison Formation. This skeleton is on display at the Denver Museum of Nature & Science.' },
  archaeopteryx: { name: 'Archaeopteryx', milestone: 'The origin of birds',
    desc: 'It had feathers and wings — but also teeth, claws and a long, bony tail. Birds are dinosaurs: the one branch of theropods that survived to this day, and Archaeopteryx shows a dinosaur on its way to becoming a bird.' },
  archaefructus: { name: 'Archaefructus', milestone: 'Flowering plants appear',
    desc: 'Its seeds were enclosed in carpels, making it one of the earliest known flowering plants.' },
  triceratops: { name: 'Triceratops', milestone: 'The twilight of the dinosaurs',
    desc: 'One of the last non-avian dinosaurs, a contemporary of Tyrannosaurus. J. B. Hatcher collected this skeleton in Wyoming in 1890; it is now at the Smithsonian\'s National Museum of Natural History.' },
  66: { name: 'End-Cretaceous extinction', desc: 'An asteroid slams into Chicxulub. The non-avian dinosaurs disappear, and the ammonites with them.' },
  cetotherium: { name: 'Cetotherium', milestone: 'Mammals return to the sea',
    desc: 'A small baleen whale from the Miocene that strained its food through baleen plates. Whales descend from land-dwelling hoofed mammals that took to the water around 50 million years ago. Held at the National Museum of Natural History of Ukraine.' },
  lucy: { name: 'Lucy', milestone: 'Walking upright',
    desc: 'Her pelvis and leg bones show that she walked upright, yet her brain was still roughly the size of a chimpanzee\'s.' },
  2.58: { name: 'Quaternary ice ages', desc: 'Ice sheets begin to advance and retreat in rhythm, as glacial and interglacial periods take turns.' },
  mammoth: { name: 'Woolly mammoth', milestone: 'The Last Glacial Maximum',
    desc: 'Its tusks could grow four metres long. Mammoths roamed the frozen steppes alongside early humans.' },
  cuneiform: { name: 'Cuneiform tablet', latin: 'Ur III period · 21st century BCE', milestone: 'Writing and cities',
    desc: 'Around 5,200 years ago, writing emerged almost simultaneously at Uruk in Mesopotamia and in Egypt. Humanity began to record its own story, and prehistory became history. This tablet, written a thousand years later under the kings of Ur, is a barley account: who drew how much barley, from which field\'s store, and when. Rijksmuseum van Oudheden, Leiden.' },
  0: { name: 'Present' },
};
if (EN) STATIONS.forEach((s) => Object.assign(s, STATION_EN[s.id ?? s.age]));

// 每类站点占用的"半宽"——相邻两站的距离 = 两者半宽之和
const HALF_SPACING = { exhibit: 720, event: 400, extinction: 400, start: 260, end: 460 };

// 展品摆放的纵深（负 z 越远）和大小，循环使用，避免排成一条直线
const DEPTHS = [-840, -900, -800, -930, -870];

let x = 0;
STATIONS.forEach((s, i) => {
  if (i > 0) x += HALF_SPACING[STATIONS[i - 1].kind] + HALF_SPACING[s.kind] + (s.pad ?? 0);
  s.x = x;
});
export const WALK_LENGTH = x;

export const EXHIBITS = STATIONS.filter((s) => s.kind === 'exhibit');
let slot = 0;
EXHIBITS.forEach((e, i) => {
  e.index = i + 1;
  const depth = DEPTHS[slot % DEPTHS.length];
  if (!e.extra) slot++;
  e.z ??= depth;   // 可在站点里单独指定纵深
});

export const EXTINCTIONS = STATIONS.filter((s) => s.kind === 'extinction');

// ---- 世界坐标 x ↔ 年代（站点之间线性插值，站点之外夹紧） ----
export function ageAt(wx) {
  if (wx <= 0) return STATIONS[0].age;
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1], b = STATIONS[i];
    if (wx <= b.x) return a.age + (b.age - a.age) * ((wx - a.x) / (b.x - a.x));
  }
  return 0;
}

export function xAtAge(age) {
  if (age >= STATIONS[0].age) return 0;
  for (let i = 1; i < STATIONS.length; i++) {
    const a = STATIONS[i - 1], b = STATIONS[i];
    if (age >= b.age) return a.x + (b.x - a.x) * ((a.age - age) / (a.age - b.age));
  }
  return WALK_LENGTH;
}

// ---- 地质年代表（起始年代，Ma） ----
const EONS = [
  [4600, '冥古宙', 'Hadean'], [4000, '太古宙', 'Archean'], [2500, '元古宙', 'Proterozoic'], [538.8, '显生宙', 'Phanerozoic'],
];
const ERAS = [
  [2500, '古元古代', 'Paleoproterozoic'], [1600, '中元古代', 'Mesoproterozoic'], [1000, '新元古代', 'Neoproterozoic'],
  [538.8, '古生代', 'Paleozoic'], [251.9, '中生代', 'Mesozoic'], [66, '新生代', 'Cenozoic'],
];
const PERIODS = [
  [1000, '拉伸纪', 'Tonian'], [720, '成冰纪', 'Cryogenian'], [635, '埃迪卡拉纪', 'Ediacaran'],
  [538.8, '寒武纪', 'Cambrian'], [485.4, '奥陶纪', 'Ordovician'], [443.8, '志留纪', 'Silurian'], [419.2, '泥盆纪', 'Devonian'],
  [358.9, '石炭纪', 'Carboniferous'], [298.9, '二叠纪', 'Permian'], [251.9, '三叠纪', 'Triassic'], [201.4, '侏罗纪', 'Jurassic'],
  [145, '白垩纪', 'Cretaceous'], [66, '古近纪', 'Paleogene'], [23.03, '新近纪', 'Neogene'], [2.58, '第四纪', 'Quaternary'],
];

function pick(table, age) {
  let found = null;
  for (const [start, zh, en] of table) if (age <= start) found = EN ? en : zh;
  return found;
}

export function geoNames(age) {
  return [pick(EONS, age), pick(ERAS, age), pick(PERIODS, age)].filter(Boolean);
}

// 年代 → 读法。中文："35 亿年前" / "320 万年前" / "2 万年前"；英文："3.5 billion years ago" / "3.2 million years ago" / "20,000 years ago"。
// short：时间轴刻度上的简写（不带"前"/"years ago"）
const trim = (v, digits) => Number(v.toFixed(digits));
export function formatAge(age, { suffix = '前' } = {}) {
  if (EN) {
    const short = suffix === '';
    if (age <= 0.0005) return short ? 'Now' : 'Present';
    // 时间轴刻度用地质学的缩写：Ga = 十亿年前，Ma = 百万年前
    if (age >= 1000) return short ? `${trim(age / 1000, 2)} Ga` : `${trim(age / 1000, 2)} billion years ago`;
    if (age >= 1) { const m = age >= 100 ? Math.round(age) : trim(age, age >= 10 ? 1 : 2); return short ? `${m} Ma` : `${m} million years ago`; }
    return `${Math.round(age * 1e6).toLocaleString('en-US')}${short ? ' years' : ' years ago'}`;
  }
  if (age <= 0.0005) return '现在';
  if (age >= 100) {
    const yi = age / 100;
    return `${Number(yi.toFixed(yi >= 10 ? 1 : 2))} 亿年${suffix}`;
  }
  const wan = age * 100;
  if (wan >= 1) return `${wan >= 100 ? Math.round(wan) : Number(wan.toFixed(1))} 万年${suffix}`;
  return `${Math.round(age * 1e6).toLocaleString()} 年${suffix}`;
}

// ---- 地貌：按年代分段 ----
// a / b 岩土色，v 植被色，wc 水色（sRGB）
// veg 植被覆盖，tree 乔木比例（0 草地/苔原，1 森林），water 浅水/潮坪/沼泽，lava 熔岩，
// ice 冰雪，dunes 沙丘，cracks 龟裂，rock 层状岩床露头
// flowers 草地上的野花（中新世草原扩张之后才有，全新世最多），blossom 开花的树（白垩纪中期开花植物扩张之后）
// fields 农田（农业出现之后；这里画的是美索不达米亚的灌溉大麦田）
export const GROUND_PALETTE = [
  // 冥古宙：黑色玄武岩结壳，裂缝和熔岩湖发光
  { age: 4600, a: '#1f1917', b: '#3b2e28', lava: 1, cracks: 1, rock: 0.1 },
  // 太古宙：深色火山岩，大片浅海（富含二价铁的海水可能偏绿）
  { age: 4000, a: '#3e413c', b: '#625f53', wc: '#2f5a4c', water: 0.55, cracks: 0.45, rock: 0.35 },
  // 大氧化之后：铁被氧化，条带状铁建造的红黑岩层
  { age: 2400, a: '#6a2c1e', b: '#ad5a3c', wc: '#27566a', water: 0.3, cracks: 0.3, rock: 0.8 },
  // 雪球地球：冰原、冰裂和风蚀雪脊
  { age: 720, a: '#b4c6d2', b: '#edf2f6', ice: 1, cracks: 0.55, dunes: 0.45 },
  // 埃迪卡拉纪：潮坪、微生物席、泥裂
  { age: 635, a: '#7a705f', b: '#a8977b', v: '#5a6048', veg: 0.2, wc: '#2a5a66', water: 0.5, cracks: 0.5, rock: 0.2 },
  // 寒武纪：灰绿色页岩与浅海
  { age: 538.8, a: '#686e60', b: '#948f7a', v: '#5d6448', veg: 0.1, wc: '#245e6e', water: 0.55, cracks: 0.35, rock: 0.3 },
  // 奥陶–志留纪：浅灰石灰岩，陆地上只有苔藓状的地衣和最早的小植物
  { age: 485.4, a: '#8f8a7e', b: '#bdb6a5', v: '#6b7148', veg: 0.08, wc: '#2a6272', water: 0.4, cracks: 0.2, rock: 0.5 },
  // 泥盆纪：老红砂岩，最早的森林
  { age: 419.2, a: '#86432f', b: '#b46a4c', v: '#4b6634', veg: 0.35, tree: 0.6, wc: '#2e5560', water: 0.2, rock: 0.35 },
  // 石炭纪：成片的沼泽森林
  { age: 358.9, a: '#3e4034', b: '#5c5a48', v: '#2c4a28', veg: 0.85, tree: 0.95, wc: '#2a3a2c', water: 0.4 },
  // 二叠纪：盘古大陆内部的荒漠沙丘
  { age: 298.9, a: '#a2573a', b: '#d19262', v: '#6b6b3c', veg: 0.06, tree: 0.5, dunes: 0.85, rock: 0.3 },
  // 三叠纪：红层（像参考图里的峡谷地）
  { age: 251.9, a: '#93432e', b: '#c97a52', v: '#5e6a3a', veg: 0.12, tree: 0.6, dunes: 0.2, rock: 0.85 },
  // 侏罗纪：浅黄砂岩，针叶林与蕨类
  { age: 201.4, a: '#bd966e', b: '#e2c89f', v: '#38563a', veg: 0.45, tree: 0.85, wc: '#2b6070', water: 0.12, rock: 0.4 },
  // 白垩纪：白垩与开花植物带来的更鲜亮的绿
  { age: 145, a: '#b3ab96', b: '#e1dbc9', v: '#46703a', veg: 0.6, tree: 0.8, wc: '#2c6878', water: 0.2, rock: 0.2 },
  // 白垩纪中期：开花植物迅速扩张，林间有木兰一类的开花乔木和灌木（还没有草地，所以没有花海）
  { age: 100, a: '#b3ab96', b: '#e1dbc9', v: '#46703a', veg: 0.62, tree: 0.8, wc: '#2c6878', water: 0.2, rock: 0.2, blossom: 0.6 },
  // 古近纪：温暖湿润，森林茂密
  { age: 66, a: '#86705a', b: '#b39a78', v: '#3b6630', veg: 0.82, tree: 1, wc: '#2d5c62', water: 0.1, blossom: 0.3 },
  // 新近纪：草原扩张，第一次有了开满野花的草原
  { age: 23.03, a: '#978659', b: '#c2b07a', v: '#96994c', veg: 0.72, tree: 0.12, rock: 0.15, flowers: 0.35 },
  // 第四纪：冰盖、冻土与苔原
  { age: 2.58, a: '#8b9288', b: '#d9dfe2', v: '#6f7a5c', veg: 0.2, tree: 0.25, ice: 0.6, cracks: 0.3, flowers: 0.15 },   // 冰期草原的夏天也开花
  // 全新世：冰期结束
  { age: 0.0117, a: '#8a775a', b: '#c0a37c', v: '#627a3a', veg: 0.55, tree: 0.5, wc: '#2d5c6a', water: 0.1, rock: 0.25, flowers: 0.85, blossom: 0.2 },   // 间冰期：花海
  // 新月沃地：约 8000 年前农业扩散开来，约 5500 年前苏美尔已是一片片灌溉的大麦田，一直延续到今天
  { age: 0.008, a: '#8a775a', b: '#c0a37c', v: '#627a3a', veg: 0.55, tree: 0.5, wc: '#2d5c6a', water: 0.1, rock: 0.25, flowers: 0.85, blossom: 0.2 },
  { age: 0.0055, a: '#8a775a', b: '#c0a37c', v: '#627a3a', veg: 0.55, tree: 0.4, wc: '#2d5c6a', water: 0.1, rock: 0.15, flowers: 0.7, blossom: 0.15, fields: 0.9 },
];

// ---- 天空：按年代的关键帧（sRGB） ----
// 天空的蓝主要来自氮气的瑞利散射，与氧气无关：只要大气清澈，远古也是蓝天。
// 冥古宙原始大气浓厚多蒸汽，偏浑浊；太古宙可能有间歇的有机雾霾，蓝天偏暖偏淡；
// 大氧化之后甲烷雾霾消失，是清澈的蓝天。
// ---- 远处的山脉：随地质年代长高、变尖、积雪，又被侵蚀成圆丘，再被新的山取代 ----
// height 山高（世界单位）；sharp 0 = 被侵蚀的老山（圆），1 = 年轻的山（尖脊）；volcanic 火山锥的多少；snow 积雪（0 无，1 雪线很低）
export const MOUNTAIN_KEYS = [
  { age: 4600, height: 110, sharp: 0.2, volcanic: 1.0, snow: 0 },     // 冥古宙：地壳又热又薄，到处是火山
  { age: 3500, height: 170, sharp: 0.35, volcanic: 0.8, snow: 0 },
  { age: 2400, height: 260, sharp: 0.5, volcanic: 0.4, snow: 0 },
  { age: 1100, height: 540, sharp: 0.9, volcanic: 0.1, snow: 0.15 },  // 格林维尔造山运动：罗迪尼亚超大陆拼合
  { age: 720, height: 460, sharp: 0.75, volcanic: 0.1, snow: 1.0 },   // 雪球地球：山也被冰雪覆盖
  { age: 600, height: 330, sharp: 0.55, volcanic: 0.25, snow: 0.2 },
  { age: 520, height: 250, sharp: 0.4, volcanic: 0.1, snow: 0 },
  { age: 430, height: 480, sharp: 0.85, volcanic: 0.15, snow: 0.1 },  // 加里东造山运动
  { age: 300, height: 760, sharp: 0.95, volcanic: 0.05, snow: 0.4 },  // 盘古大陆中央山脉：喜马拉雅级
  { age: 252, height: 660, sharp: 0.8, volcanic: 0.5, snow: 0.2 },    // 西伯利亚大火成岩省
  { age: 220, height: 360, sharp: 0.3, volcanic: 0.1, snow: 0 },      // 三叠纪：大山已被磨成圆丘
  { age: 180, height: 300, sharp: 0.3, volcanic: 0.3, snow: 0 },
  { age: 150, height: 340, sharp: 0.5, volcanic: 0.65, snow: 0 },     // 侏罗纪：环太平洋的火山弧
  { age: 80, height: 540, sharp: 0.8, volcanic: 0.5, snow: 0.1 },     // 白垩纪晚期：拉拉米造山运动，落基山脉隆起
  { age: 50, height: 620, sharp: 0.9, volcanic: 0.2, snow: 0.25 },    // 印度撞上亚洲，喜马拉雅开始隆起
  { age: 10, height: 820, sharp: 1.0, volcanic: 0.1, snow: 0.5 },
  { age: 2.6, height: 860, sharp: 1.0, volcanic: 0.1, snow: 0.85 },   // 第四纪冰期
  { age: 0.02, height: 860, sharp: 1.0, volcanic: 0.1, snow: 1.0 },   // 末次冰盛期
  { age: 0.0117, height: 860, sharp: 1.0, volcanic: 0.1, snow: 0.55 },
  { age: 0, height: 860, sharp: 1.0, volcanic: 0.1, snow: 0.5 },
];

export const SKY_KEYS = [
  { age: 4600, horizon: '#b98f72', zenith: '#5d5552', haze: 1.0 },
  { age: 4000, horizon: '#d9cbb8', zenith: '#7f96ae', haze: 0.75 },
  { age: 2600, horizon: '#d4d3cc', zenith: '#6f93bf', haze: 0.6 },
  { age: 2300, horizon: '#c3d8ee', zenith: '#2f6cc0', haze: 0.35 },
  { age: 720, horizon: '#d6e6f4', zenith: '#3a7ccc', haze: 0.25 },    // 雪球地球：空气干冷，格外通透
  { age: 600, horizon: '#c2d8ee', zenith: '#2a66bd', haze: 0.3 },
  { age: 0, horizon: '#c2d8ee', zenith: '#2a66bd', haze: 0.3 },
];
// 大灭绝前后火山灰、撞击尘埃让天空暂时变暗
export const ASH_SKY = { horizon: '#a89484', zenith: '#5e5650' };
