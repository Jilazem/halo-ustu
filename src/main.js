// HALO ÜSTÜ — ana montaj. Sahne, bulut, post, kontrol ve ölçüm burada birleşir.
import * as THREE from 'three';
import { kurGokyuzu } from './sky.js';
import { kurArazi } from './terrain.js';
import { kurKuleler } from './towers.js';
import { kurHalka } from './ring.js';
import { kurGol } from './water.js';
import { kurBulutlar } from './clouds.js';
import { kurPost } from './post.js';
import { kurKontroller, GORUNUMLER } from './controls.js';

const hatalar = [];
window.addEventListener('error', (e) => hatalar.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => hatalar.push('promise: ' + String(e.reason)));

const el = (id) => document.getElementById(id);
const hataKutusu = el('hata');
function hataYaz(s) {
  hatalar.push(String(s));
  hataKutusu.style.display = 'block';
  hataKutusu.textContent = hatalar.join('\n');
}

const tuval = el('tuval');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: tuval, antialias: false, alpha: false,
    powerPreference: 'high-performance', stencil: false,
    preserveDrawingBuffer: true
  });
} catch (e) {
  hataYaz('WebGL bağlamı kurulamadı: ' + e.message);
  throw e;
}
if (!renderer.capabilities.isWebGL2) hataYaz('WebGL2 yok — half-float hedefler çalışmaz.');

renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // gamma'yı final geçişte kendimiz yapıyoruz
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = true;

const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(dpr);

let G = Math.max(2, Math.floor(window.innerWidth));
let Y = Math.max(2, Math.floor(window.innerHeight));
renderer.setSize(G, Y, false);

const kamera = new THREE.PerspectiveCamera(52, G / Y, 0.5, 12000);
kamera.position.set(188, 103, 165);
kamera.lookAt(0, 110, 0);

const sahne = new THREE.Scene();

// ---- dünya ----
const gokyuzu = kurGokyuzu();
sahne.add(gokyuzu.mesh);

const arazi = kurArazi();
sahne.add(arazi.grup);

const kuleler = kurKuleler();
sahne.add(kuleler.grup);

const halka = kurHalka();
sahne.add(halka.grup);

const gol = kurGol();
sahne.add(gol.grup);

// ---- sistemler ----
const bulutlar = kurBulutlar(renderer, { genislik: G, yukseklik: Y });
const post = kurPost(renderer, { genislik: G, yukseklik: Y });
const kontroller = kurKontroller({ kamera, domEleman: tuval, halka });

// ---- ölçüm ----
const olcum = { kare: 0, sonFps: 0, sonMs: 0, gecmis: [] };
let fpsPencere = [], msPencere = [];
let sonKare = performance.now();
let isitmaKalan = 3;   // ilk kareler shader derlemesini taşır; ölçüm penceresine girmez

const saat = new THREE.Clock();
let zaman = 0;
let ilkKare = true;

function guncelleMalzemeler(t) {
  for (const m of [arazi.malzeme, arazi.etekMalzeme, ...kuleler.malzemeler]) {
    if (m.userData && m.userData.kameraGuncelle) m.userData.kameraGuncelle(kamera);
  }
  halka.guncelle(kamera, t);
  gol.guncelle(kamera, t);
  gokyuzu.mat.uniforms.uZaman.value = t;
}

// tek kare: sahne → bulut → birleştir. Çizim çağrısı/üçgen sayısı geçişler boyunca toplanır
// (renderer.info her render çağrısında sıfırlandığı için tek başına yanıltıcı).
function kareCiz(t) {
  post.sahneyiCiz(sahne, kamera);
  let cagri = renderer.info.render.calls, ucgen = renderer.info.render.triangles;
  const bulutDoku = bulutlar.ciz(kamera, post.derinlik, t);
  cagri += renderer.info.render.calls; ucgen += renderer.info.render.triangles;
  post.sonIsle(bulutDoku, t);
  cagri += renderer.info.render.calls; ucgen += renderer.info.render.triangles;
  olcum.cizim = cagri; olcum.ucgen = ucgen;
}

function dongu() {
  requestAnimationFrame(dongu);
  const simdi = performance.now();
  const dtHam = (simdi - sonKare) / 1000;
  sonKare = simdi;
  const dt = Math.min(0.1, Math.max(0.0005, dtHam));
  zaman += dt;

  kontroller.guncelle(dt, zaman);
  kamera.updateMatrixWorld();
  guncelleMalzemeler(zaman);

  // 1-3) sahne → hacimli bulut → birleştir/bloom/tonemap
  kareCiz(zaman);

  // ölçüm — ilk kareler shader derleme süresini taşır; pencere onlardan SONRA açılır.
  olcum.kare++;
  if (ilkKare || isitmaKalan > 0) {
    if (ilkKare) {
      ilkKare = false;
      el('yukleme').classList.add('kapali');
      el('hud').classList.add('acik');
      el('gorunumAdi').classList.add('acik');
      el('gorunumAdi').textContent = kontroller.durum.gorunumAdi;
    }
    isitmaKalan = Math.max(0, isitmaKalan - 1);
    fpsPencere.length = 0; msPencere.length = 0;
    return;
  }
  fpsPencere.push(1 / dt);
  msPencere.push(dtHam * 1000);
  if (fpsPencere.length > 60) { fpsPencere.shift(); msPencere.shift(); }
  const ort = fpsPencere.reduce((a, b) => a + b, 0) / fpsPencere.length;
  // ms = 1000/fps; ayrı bir dt ortalaması tutmuyoruz ki derleme kareleri sızmasın.
  const ortMs = 1000 / Math.max(1e-3, ort);
  olcum.sonFps = ort; olcum.sonMs = ortMs;
  if (olcum.kare % 12 === 0) {
    el('fps').textContent = ort.toFixed(1);
    el('ms').textContent = ortMs.toFixed(1);
    el('coz').textContent = G + '×' + Y + ' @' + dpr.toFixed(2);
  }
}

// görünüm değişince başlığı güncelle
const eskiAyarla = kontroller.gorunumAyarla;
function gorunumSec(i) {
  const ad = eskiAyarla(i);
  el('gorunumAdi').textContent = ad;
  el('gorunumAdi').classList.add('acik');
  return ad;
}
kontroller.gorunumAyarla = gorunumSec;

window.addEventListener('resize', () => {
  G = Math.max(2, Math.floor(window.innerWidth));
  Y = Math.max(2, Math.floor(window.innerHeight));
  renderer.setSize(G, Y, false);
  kamera.aspect = G / Y;
  kamera.updateProjectionMatrix();
  post.ayarla(G, Y);
  bulutlar.ayarla(G, Y);
});

// ---- CDP / otomasyon kapısı ----
window.SAHNE = {
  hazir: true,
  hatalar,
  sahne,
  kamera,
  gruplar: { gokyuzu: gokyuzu.mesh, arazi: arazi.grup, kuleler: kuleler.grup, halka: halka.grup, gol: gol.grup },
  gorunumler: GORUNUMLER,
  gorunum: (i) => gorunumSec(i),
  kalite: (s) => bulutlar.kalite(s),
  bulutDerinlik: (ac) => bulutlar.derinlikKullan(ac),
  bulutGuc: (v) => post.guc(v),
  pozlama: (v) => post.pozlama(v),
  sinema: (ac) => { kontroller.durum.sinema = !!ac; kontroller.durum.sinemaT = 0; },
  // gerçek kareler üzerinden fps ölçümü (requestAnimationFrame sayacı)
  olc(sureMs = 3000) {
    return new Promise((coz) => {
      const bas = performance.now();
      const k0 = olcum.kare;
      let gecen = 0, adet = 0;
      const adim = () => {
        const t = performance.now();
        if (t - bas >= sureMs) {
          const fps = (olcum.kare - k0) / ((t - bas) / 1000);
          coz({ fps: +fps.toFixed(2), ms: +(1000 / fps).toFixed(2), kare: olcum.kare - k0, sure: +((t - bas) / 1000).toFixed(2), cozunurluk: G + 'x' + Y, dpr, bulutCozunurluk: bulutlar.cozunurluk, bulutAdim: bulutlar.adimSayisi });
          return;
        }
        gecen = t; adet++;
        requestAnimationFrame(adim);
      };
      requestAnimationFrame(adim);
    });
  },
  // gerçek GPU maliyeti: kareyi doğrudan N kez çizip gl.finish ile senkron ölçer.
  // rAF sayacı arka planda/örtük pencerede kısılabildiği için tek başına yanıltıcı.
  olcCpu(n = 20) {
    const gl = renderer.getContext();
    const adim = () => {
      kontroller.guncelle(1 / 60, zaman);
      kamera.updateMatrixWorld();
      guncelleMalzemeler(zaman);
      kareCiz(zaman);
    };
    adim(); adim(); gl.finish();
    const bas = performance.now();
    for (let i = 0; i < n; i++) adim();
    gl.finish();
    const ms = (performance.now() - bas) / n;
    return { ms: +ms.toFixed(2), fps: +(1000 / ms).toFixed(1), n, cozunurluk: G + 'x' + Y, dpr,
             cizimCagrisi: olcum.cizim, ucgen: olcum.ucgen,
             bulutCozunurluk: bulutlar.cozunurluk, bulutAdim: bulutlar.adimSayisi };
  },
  bilgi() {
    return {
      kare: olcum.kare, fps: +olcum.sonFps.toFixed(2), ms: +olcum.sonMs.toFixed(2),
      cozunurluk: G + 'x' + Y, dpr, cizimCagrisi: olcum.cizim || 0,
      ucgen: olcum.ucgen || 0, dokular: renderer.info.memory.textures,
      geometri: renderer.info.memory.geometries,
      bulut: { cozunurluk: bulutlar.cozunurluk, adim: bulutlar.adimSayisi, birikim: bulutlar.birikimSayisi },
      gorunum: kontroller.durum.gorunumAdi, sinema: kontroller.durum.sinema,
      kamera: [kamera.position.x, kamera.position.y, kamera.position.z].map(v => +v.toFixed(1)),
      hatalar
    };
  }
};

dongu();
