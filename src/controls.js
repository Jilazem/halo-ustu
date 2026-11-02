// Orbit + görünüm ön ayarları (1-9, 0) + sinema yolu (V) + serbest gezinme (WASD/Shift/Q-E) + dokunma.
import * as THREE from 'three';

export const GORUNUMLER = [
  { ad: 'GENIS ACI — bulut denizi', hedef: [0, 110, 0], yaricap: 250, theta: -0.85, phi: 1.60, fov: 52 },
  { ad: 'HALKA YAKIN — köprü ağzı', hedef: [0, 112, 0], yaricap: 120, theta: -1.20, phi: 1.58, fov: 55 },
  { ad: 'BULUT DENIZI — alçak açı', hedef: [0, -90, 0], yaricap: 620, theta: 0.55, phi: 1.55, fov: 58 },
  { ad: 'KULE DİBİ — yukarı bakış', hedef: [-60, 150, -4], yaricap: 150, theta: -0.30, phi: 1.75, fov: 62 },
  { ad: 'GÖL KIYISI', hedef: [0, 60, 30], yaricap: 240, theta: 0.0, phi: 1.74, fov: 52 },
  { ad: 'ÇATI — halka üstü', hedef: [0, 119, 0], yaricap: 90, theta: -0.90, phi: 1.25, fov: 52 },
  { ad: 'UZAK — atmosfer', hedef: [0, 60, 0], yaricap: 900, theta: -0.35, phi: 1.42, fov: 40 },
  { ad: 'ALT — halka altı', hedef: [0, 96, 0], yaricap: 175, theta: -0.15, phi: 1.95, fov: 58 },
  { ad: 'KULE 2 — kar hattı', hedef: [70, 150, 6], yaricap: 190, theta: 1.10, phi: 1.34, fov: 54 },
  { ad: 'KÖPRÜ 2', hedef: [40, 112, 4], yaricap: 95, theta: 0.0, phi: 1.43, fov: 52 }
];

export function kurKontroller({ kamera, domEleman, halka }) {
  const durum = {
    hedef: new THREE.Vector3(0, 110, 0),
    theta: -0.85, phi: 1.60, yaricap: 250,
    hTheta: -0.85, hPhi: 1.60, hYaricap: 250, hHedef: new THREE.Vector3(0, 110, 0),
    sinema: false, sinemaT: 0, gorunumAdi: GORUNUMLER[0].ad
  };

  // sinema yolu: bulut denizinin üstünden halkaya tırmanan kapalı eğri
  const yol = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-340, -40, 300),
    new THREE.Vector3(-150, 40, 230),
    new THREE.Vector3(60, 120, 170),
    new THREE.Vector3(250, 150, 20),
    new THREE.Vector3(180, 60, -220),
    new THREE.Vector3(-40, -70, -380),
    new THREE.Vector3(-280, -20, -180),
    new THREE.Vector3(-380, 40, 60)
  ], true, 'catmullrom', 0.5);

  const hedefNoktalari = [
    new THREE.Vector3(0, 100, 0),
    new THREE.Vector3(0, 115, 0),
    new THREE.Vector3(0, 105, -60),
    new THREE.Vector3(0, 112, 0),
    new THREE.Vector3(0, -20, 120),
    new THREE.Vector3(0, 90, 0),
    new THREE.Vector3(0, 120, 0),
    new THREE.Vector3(0, 108, 0)
  ];
  const hedefEgri = new THREE.CatmullRomCurve3(hedefNoktalari, true, 'catmullrom', 0.5);

  function gorunumAyarla(i) {
    const g = GORUNUMLER[Math.max(0, Math.min(GORUNUMLER.length - 1, i))];
    durum.sinema = false;
    durum.hHedef.set(g.hedef[0], g.hedef[1], g.hedef[2]);
    durum.hTheta = g.theta; durum.hPhi = g.phi; durum.hYaricap = g.yaricap;
    durum.gorunumAdi = g.ad;
    if (g.fov) { kamera.fov = g.fov; kamera.updateProjectionMatrix(); }
    return g.ad;
  }

  // --- dokunma/fare: tek işaret = döndür, iki işaret = yakınlaştır ---
  const isaretler = new Map();
  let surukle = false, sonX = 0, sonY = 0;
  let kilitMesafe = 0, kilitYaricap = 0;

  domEleman.addEventListener('pointerdown', (e) => {
    isaretler.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { domEleman.setPointerCapture?.(e.pointerId); } catch (err) { /* sentetik olaylarda aktif işaretçi yok */ }
    if (isaretler.size === 1) {
      surukle = true; sonX = e.clientX; sonY = e.clientY;
    } else {
      surukle = false;
      const p = [...isaretler.values()];
      kilitMesafe = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      kilitYaricap = durum.hYaricap;
    }
  });
  domEleman.addEventListener('pointerup', (e) => {
    isaretler.delete(e.pointerId);
    surukle = isaretler.size === 1;
    if (surukle) { const p = [...isaretler.values()][0]; sonX = p.x; sonY = p.y; }
  });
  domEleman.addEventListener('pointercancel', (e) => {
    isaretler.delete(e.pointerId);
    surukle = isaretler.size === 1;
  });
  domEleman.addEventListener('pointermove', (e) => {
    if (!isaretler.has(e.pointerId)) return;
    isaretler.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isaretler.size >= 2) {
      const p = [...isaretler.values()];
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (kilitMesafe > 4 && d > 4) {
        durum.sinema = false;
        durum.hYaricap = Math.max(45, Math.min(1400, kilitYaricap * (kilitMesafe / d)));
      }
      return;
    }
    if (!surukle) return;
    const dx = e.clientX - sonX, dy = e.clientY - sonY;
    sonX = e.clientX; sonY = e.clientY;
    durum.sinema = false;
    durum.hTheta -= dx * 0.0042;
    durum.hPhi = Math.max(0.18, Math.min(3.05, durum.hPhi - dy * 0.0035));
  });
  domEleman.addEventListener('wheel', (e) => {
    e.preventDefault();
    durum.sinema = false;
    durum.hYaricap = Math.max(45, Math.min(1400, durum.hYaricap * (1 + Math.sign(e.deltaY) * 0.08)));
  }, { passive: false });

  // --- klavye: görünüm + sinema + serbest gezinme ---
  const tuslar = new Set();
  const GEZINME_HIZ = 26; // m/s (Shift ile 4x)
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k >= '1' && k <= '9') { gorunumAyarla(parseInt(k, 10) - 1); return; }
    if (k === '0') { gorunumAyarla(9); return; }
    if (k === 'v' || k === 'V') { durum.sinema = !durum.sinema; durum.sinemaT = 0; return; }
    const kk = k.toLowerCase();
    if ('wasdqer'.includes(kk) || k === 'Shift' || k === 'ArrowUp' || k === 'ArrowDown'
        || k === 'ArrowLeft' || k === 'ArrowRight') {
      tuslar.add(kk === 'shift' ? 'shift' : kk);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const kk = e.key.toLowerCase();
    tuslar.delete(kk === 'shift' ? 'shift' : kk);
  });
  window.addEventListener('blur', () => tuslar.clear());

  function guncelle(dt, zaman) {
    if (durum.sinema) {
      durum.sinemaT = (durum.sinemaT + dt / 62) % 1;
      const t = durum.sinemaT;
      const p = yol.getPointAt(t);
      const h = hedefEgri.getPointAt(t);
      kamera.position.lerp(p, 1 - Math.pow(0.001, dt));
      durum.hedef.lerp(h, 1 - Math.pow(0.001, dt));
      durum.hHedef.copy(durum.hedef);
      durum.hTheta = Math.atan2(kamera.position.x - durum.hedef.x, kamera.position.z - durum.hedef.z);
      durum.hPhi = Math.acos(Math.max(-1, Math.min(1, (kamera.position.y - durum.hedef.y) / Math.max(1, kamera.position.distanceTo(durum.hedef)))));
      durum.hYaricap = kamera.position.distanceTo(durum.hedef);
      kamera.lookAt(durum.hedef);
      return;
    }

    // serbest gezinme: bakış yönünde ilerle, yana kay, Q/E ile yüksel/alçal
    let ileri = 0, yan = 0, dusey = 0;
    if (tuslar.has('w') || tuslar.has('arrowup')) ileri += 1;
    if (tuslar.has('s') || tuslar.has('arrowdown')) ileri -= 1;
    if (tuslar.has('d') || tuslar.has('arrowright')) yan += 1;
    if (tuslar.has('a') || tuslar.has('arrowleft')) yan -= 1;
    if (tuslar.has('q')) dusey += 1;
    if (tuslar.has('e')) dusey -= 1;
    if (ileri || yan || dusey) {
      const f = new THREE.Vector3().subVectors(durum.hedef, kamera.position);
      f.y = 0;
      if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
      f.normalize();
      const sag = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
      const hiz = GEZINME_HIZ * (tuslar.has('shift') ? 4 : 1) * dt;
      durum.hHedef.addScaledVector(f, ileri * hiz).addScaledVector(sag, yan * hiz);
      durum.hHedef.y = Math.max(-400, Math.min(600, durum.hHedef.y + dusey * hiz));
      durum.hHedef.x = Math.max(-2000, Math.min(2000, durum.hHedef.x));
      durum.hHedef.z = Math.max(-2000, Math.min(2000, durum.hHedef.z));
      durum.sinema = false;
    }

    const k = 1 - Math.pow(0.0025, dt);
    durum.theta += (durum.hTheta - durum.theta) * k;
    durum.phi += (durum.hPhi - durum.phi) * k;
    durum.yaricap += (durum.hYaricap - durum.yaricap) * k;
    durum.hedef.lerp(durum.hHedef, k);

    const sp = Math.sin(durum.phi);
    kamera.position.set(
      durum.hedef.x + durum.yaricap * sp * Math.sin(durum.theta),
      durum.hedef.y + durum.yaricap * Math.cos(durum.phi),
      durum.hedef.z + durum.yaricap * sp * Math.cos(durum.theta)
    );
    kamera.lookAt(durum.hedef);
  }

  return { guncelle, gorunumAyarla, durum, GORUNUMLER };
}
