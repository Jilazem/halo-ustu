// İki dolomit kaya kulesi: parametrik yüzey + ridged gürültü yer değiştirmesi.
// Yatay stratigrafi (dolomit katmanları), dikey oluklar ve kar çizgisi shader'da.
// Halka kotunda ve üst seyir kotunda sıcak pencere ışıkları; tepede fener.
import * as THREE from 'three';
import { kayaMateryali } from './kaya.js';
import { DUNYA } from './world.js';
import { ridged3, fbm3, smoothstep } from './proc.js';

// Kule gövdesinin verilen yükseklikte ve açıda GERÇEK yüzey yarıçapı.
// Geometri de bu fonksiyonu kullanır; köprü/bağ uçları böylece kayaya oturur.
export function kuleYaricap(k, a, y) {
  const v = (y + 24) / (k.yuk + 24);
  const ca = Math.cos(a), sa = Math.sin(a);
  let r = k.tabanR * (1.0 - 0.62 * Math.pow(Math.max(0, v), 0.85));
  r = r * (1.0 - smoothstep(0.82, 1.0, v)) + k.tepeR * smoothstep(0.82, 1.0, v);
  const basamak = Math.tanh(Math.sin(y * 0.58 + k.tohum) * 4.0) * 0.036
                + Math.tanh(Math.sin(y * 1.93 + k.tohum * 2.0) * 3.0) * 0.014;
  r *= 1.0 + basamak;
  const nx = ca * 1.9 + k.tohum, nz = sa * 1.9 + k.tohum;
  const n = ridged3(nx * 1.6, y * 0.019, nz * 1.6, 4);
  const n2 = fbm3(nx * 4.2, y * 0.055, nz * 4.2, 3);
  r *= 0.62 + 0.76 * n;
  r *= 1.0 - 0.16 * smoothstep(0.45, 0.85, n2);
  if (v > 0.90) {
    const kirik = ridged3(ca * 3.1 + k.tohum, v * 9.0, sa * 3.1 + k.tohum, 3);
    r *= 0.62 + 0.52 * kirik;
  }
  return r;
}

function kuleGeometrisi(k, ornekler) {
  const H = 150, A = 96;
  const poz = [], uv = [], idx = [];
  for (let iy = 0; iy <= H; iy++) {
    const v = iy / H;
    const y = -24 + v * (k.yuk + 24);
    for (let ia = 0; ia <= A; ia++) {
      const a = (ia / A) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);

      const r = kuleYaricap(k, a, y);
      const x = k.x + ca * r, z = k.z + sa * r;
      poz.push(x, y, z);
      uv.push(ia / A, v);
      if (ornekler && ia % 4 === 0) ornekler.push({ a, y, r, x, z, k });
      if (iy < H && ia < A) {
        const b = iy * (A + 1) + ia;
        idx.push(b, b + 1, b + A + 1, b + 1, b + A + 2, b + A + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Kule yüzeyine oturan pencere şeritleri: tek bir birleşik geometri.
function pencereler(ornekler, bantlar) {
  const poz = [], idx = [];
  let sayac = 0;
  for (const o of ornekler) {
    for (const b of bantlar) {
      if (Math.abs(o.y - b.y) > b.tol) continue;
      // her 4. açı örneğinde bir pencere; deterministik seçim
      const sec = ((o.a * 13.7) % 1.0) > b.bosluk;
      if (!sec) continue;
      const ca = Math.cos(o.a), sa = Math.sin(o.a);
      const ox = o.x + ca * 0.9, oz = o.z + sa * 0.9;
      const tx = -sa * b.gen, tz = ca * b.gen;       // teğet
      const hy = b.yuk;
      const p = (u, v) => poz.push(ox + tx * u, o.y + hy * v, oz + tz * u);
      const b0 = sayac;
      p(-1, -1); p(1, -1); p(1, 1); p(-1, 1);
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
      sayac += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function kurKuleler() {
  const grup = new THREE.Group();
  const malzemeler = [];
  const ornekler = [];

  for (const k of DUNYA.kuleler) {
    const mat = kayaMateryali({ karCizgisi: DUNYA.karCizgisi, katmanOlcek: 1.15, sicakYansima: 0.26 });
    const m = new THREE.Mesh(kuleGeometrisi(k, ornekler), mat);
    m.name = 'kule';
    grup.add(m);
    malzemeler.push(mat);
  }

  // halka kotu ve üst seyir kotu: sıcak pencere ışıkları
  const halkaKot = DUNYA.halkaY;
  const bantlar = [
    { y: halkaKot - 2, tol: 1.6, gen: 0.85, yuk: 1.5, bosluk: 0.55 },
    { y: halkaKot + 6, tol: 1.6, gen: 0.85, yuk: 1.5, bosluk: 0.72 },
    { y: DUNYA.karCizgisi + 26, tol: 1.8, gen: 0.75, yuk: 1.2, bosluk: 0.80 }
  ];
  const pgeo = pencereler(ornekler, bantlar);
  if (pgeo.attributes.position.count > 0) {
    const pmat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    pmat.color.setRGB(2.4, 1.15, 0.48);
    const pm = new THREE.Mesh(pgeo, pmat);
    pm.name = 'pencereler';
    grup.add(pm);
  }

  // tepe feneri: kule doruğunda küçük sıcak küre
  for (const k of DUNYA.kuleler) {
    const fm = new THREE.MeshBasicMaterial();
    fm.color.setRGB(3.0, 1.6, 0.7);
    const f = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), fm);
    f.position.set(k.x, k.yuk + 1.5, k.z);
    grup.add(f);
  }

  return { grup, malzemeler };
}
