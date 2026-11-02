// Sahne bütçesi matematiği — SAF fonksiyonlar (THREE importu YOK, node'da doğrudan test edilir).
// Kaynak gözlem: flyingcarsimulator.io (X @threejs 27.10.2026) — js/scene-culling.js sabitleri
// (CULL_PER_METRE 1100, CULL_MIN 300, CULL_MAX 2000, PROXY_CELL 500) ve js/post-processing.js
// bloom tepe sınırlaması. Formüller ölçülmüş sabitlerden türetildi, uydurulmadı.

/**
 * Bir instanced prop'un (direk, tabela, çöp kutusu...) görünür kalma mesafesi.
 * Site kuralı: tipik boyutu s metre olan örnek, 1300 px viewport'ta s/d*1100 px yüksekliğinde
 * görünür; 1-2 px altına düşünce çizilmez. Bu yüzden d = s * perMetre, alt sınır cullMin
 * (gölge kaskadları ~300 m'ye ulaşır, yakında gizlemek gölgeyi koparır), üst sınır cullMax
 * (çok büyük prop her mesafede kalır).
 * @param {number} sizeM örnek boyutu (metre)
 * @param {{perMetre?:number,cullMin?:number,cullMax?:number}} [o]
 * @returns {number} metre cinsinden görünürlük mesafesi
 */
function propCullDistance(sizeM, o = {}) {
  const perMetre = o.perMetre === undefined ? 1100 : o.perMetre;
  const cullMin = o.cullMin === undefined ? 300 : o.cullMin;
  const cullMax = o.cullMax === undefined ? 2000 : o.cullMax;
  if (!(sizeM > 0)) return cullMin;           // boyut bilinmiyorsa en güvenli: yakın tut
  const d = sizeM * perMetre;
  return Math.min(cullMax, Math.max(cullMin, d));
}

/**
 * Instanced mesh örneklerini dünya XZ hücrelerine böler (chunk'lama için indeks listesi).
 * @param {ArrayLike<number>} m16 instanceMatrix dizisi (16 float/örnek)
 * @param {number} cell hücre kenarı (metre)
 * @param {number} [count] örnek sayısı (verilmezse dizi uzunluğundan türetilir)
 * @returns {Map<string, number[]>} "cx,cz" → örnek indeksleri
 */
function bucketInstances(m16, cell, count) {
  if (!(cell > 0)) throw new Error('bucketInstances: cell > 0 olmalı');
  const n = count === undefined ? Math.floor(m16.length / 16) : count;
  const cells = new Map();
  for (let i = 0; i < n; i++) {
    const x = m16[i * 16 + 12];
    const z = m16[i * 16 + 14];
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;  // bozuk matris sessizce çöp hücresi üretmesin
    const key = Math.floor(x / cell) + ',' + Math.floor(z / cell);
    let ids = cells.get(key);
    if (!ids) cells.set(key, (ids = []));
    ids.push(i);
  }
  return cells;
}

/**
 * Bloom'a giren HDR kareyi tepe-parlaklık sınırıyla ölçekler (site: exposed.mul(8/max(peak,8))).
 * Amaç: yalnız tepe ışımasını kırpmak, RGB'yi birlikte ölçekleyip neon/lamba rengini korumak;
 * tone mapper'ın highlight omzu için HDR aralığı bozulmadan kalır.
 * @param {number} peak karedeki en yüksek kanal değeri
 * @param {number} [cap] izin verilen tepe (varsayılan 8)
 * @returns {number} çarpılacak katsayı (<=1)
 */
function bloomPeakScale(peak, cap = 8) {
  if (!(peak > cap)) return 1;
  return cap / peak;
}

/**
 * Kayan pencere FPS'inden kare bütçesi aşım oranı (0 = bütçe içinde).
 * @param {number} fps ölçülen fps
 * @param {number} [target] hedef fps (60)
 */
function frameBudgetOverrun(fps, target = 60) {
  if (!(fps > 0)) return 1;
  return Math.max(0, (target / fps) - 1);
}

export { propCullDistance, bucketInstances, bloomPeakScale, frameBudgetOverrun };
