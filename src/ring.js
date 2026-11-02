// Beton halka restoran: açık teras + cam korkuluk + iç kanopi + V payandalar + 2 köprü.
// Tüm ölçüler metre; halka çapı world.js'te 110 m olarak sabitlendi.
import * as THREE from 'three';
import { NOISE, HAVA } from './glsl.js';
import { DUNYA, GUNES } from './world.js';
import { kuleYaricap } from './towers.js';

// ---------- beton malzemesi ----------
function betonMateryali(sec = {}) {
  const uniforms = {
    uKamera: { value: new THREE.Vector3() },
    uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
    uUfukRenk: { value: new THREE.Color(0.135, 0.165, 0.285) },
    uSisBas: { value: DUNYA.sisBaslangic },
    uSisBit: { value: DUNYA.sisBitis },
    uAltIsik: { value: sec.altIsik !== undefined ? sec.altIsik : 0.30 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vDunya; varying vec3 vNormal;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vDunya = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: NOISE + HAVA + `
      varying vec3 vDunya; varying vec3 vNormal;
      uniform vec3 uKamera; uniform vec3 uGunesYon; uniform float uAltIsik;
      void main(){
        vec3 wp = vDunya; vec3 n = normalize(vNormal);
        float mott = fbm3(vec3(wp.x*0.30, wp.y*0.30, wp.z*0.30));
        float ince = vnoise(vec3(wp.x*2.4, wp.y*2.4, wp.z*2.4));
        vec3 beton = mix(vec3(0.185,0.180,0.172), vec3(0.355,0.340,0.320), mott);
        beton *= 0.90 + 0.20*ince;
        float leke = smoothstep(0.52, 0.86, fbm3(vec3(wp.x*0.07, wp.y*0.45, wp.z*0.07)));
        beton *= 1.0 - 0.28*leke;
        float kali = smoothstep(0.35, 0.65, abs(fract(wp.y*0.62)-0.5)*2.0);
        beton *= 0.94 + 0.10*kali;

        vec3 isik = vec3(0.24,0.33,0.50) * (0.42 + 0.58*max(0.0,n.y));
        isik += vec3(1.0,0.54,0.25) * pow(max(0.0,dot(n,uGunesYon)), 2.0) * 0.26;
        float alt = smoothstep(126.0, 106.0, wp.y);
        isik += vec3(1.0,0.60,0.30) * alt * uAltIsik;

        vec3 renk = beton * isik;
        renk = havaPerspektifi(renk, length(wp - uKamera));
        gl_FragColor = vec4(renk, 1.0);
      }
    `
  });
  mat.userData.kameraGuncelle = (k) => uniforms.uKamera.value.copy(k.position);
  return mat;
}

// ---------- cam korkuluk ----------
function camMateryali() {
  const uniforms = {
    uKamera: { value: new THREE.Vector3() },
    uZaman: { value: 0 },
    uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vDunya; varying vec3 vNormal;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vDunya = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: NOISE + `
      varying vec3 vDunya; varying vec3 vNormal;
      uniform vec3 uKamera; uniform float uZaman;
      void main(){
        vec3 rd = normalize(vDunya - uKamera);
        float fres = pow(1.0 - abs(dot(rd, normalize(vNormal))), 3.0);
        // cam arkasındaki sıcak iç mekân hafifçe görünür
        vec3 ic = vec3(1.00,0.58,0.26) * 0.22;
        vec3 renk = ic + vec3(0.16,0.24,0.42) * fres * 1.6;
        float alfa = clamp(0.10 + 0.42*fres, 0.0, 0.52);
        gl_FragColor = vec4(renk, alfa);
      }
    `
  });
  mat.userData.kameraGuncelle = (k) => { uniforms.uKamera.value.copy(k.position); };
  return mat;
}

function seritMateryali(r, g, b) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
}

function cubuk(A, B, yariCap, mat) {
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(yariCap, yariCap, len, 10, 1);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

export function kurHalka() {
  const grup = new THREE.Group();
  const beton = betonMateryali({ altIsik: 0.34 });
  const betonParlak = betonMateryali({ altIsik: 0.22 });
  const cam = camMateryali();
  const malzemeler = [beton, betonParlak, cam];

  const Y = DUNYA.halkaY;
  const Ro = DUNYA.halkaDisYaricap;
  const Ri = DUNYA.halkaIcYaricap;
  const kal = DUNYA.halkaKalinlik;

  // döşeme (üst) — açık teras zemini
  const ustGeo = new THREE.RingGeometry(Ri, Ro, 200, 1);
  ustGeo.rotateX(-Math.PI / 2);
  const ust = new THREE.Mesh(ustGeo, betonParlak);
  ust.position.y = Y;
  grup.add(ust);

  // döşeme (alt)
  const altGeo = new THREE.RingGeometry(Ri, Ro, 200, 1);
  altGeo.rotateX(-Math.PI / 2);
  const alt = new THREE.Mesh(altGeo, beton);
  alt.position.y = Y - kal;
  grup.add(alt);

  // dış ve iç yan duvarlar (döşeme kalınlığı)
  const disYan = new THREE.Mesh(new THREE.CylinderGeometry(Ro, Ro, kal, 200, 1, true), beton);
  disYan.position.y = Y - kal / 2;
  grup.add(disYan);
  const icYan = new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, kal, 200, 1, true), beton);
  icYan.position.y = Y - kal / 2;
  grup.add(icYan);

  // dış cam korkuluk (1.15 m) — teras dışarıdan görünür kalsın
  const camH = 1.15;
  const camMesh = new THREE.Mesh(new THREE.CylinderGeometry(Ro - 0.35, Ro - 0.35, camH, 200, 1, true), cam);
  camMesh.position.y = Y + 0.06 + camH / 2;
  camMesh.renderOrder = 6;
  grup.add(camMesh);
  // korkuluk üst korkuluğu + dikmeler
  const korkuluk = new THREE.Mesh(new THREE.TorusGeometry(Ro - 0.35, 0.055, 6, 220), beton);
  korkuluk.rotation.x = Math.PI / 2;
  korkuluk.position.y = Y + 0.06 + camH + 0.05;
  grup.add(korkuluk);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, camH, 0.07), beton);
    p.position.set(Math.cos(a) * (Ro - 0.35), Y + 0.06 + camH / 2, Math.sin(a) * (Ro - 0.35));
    p.rotation.y = -a;
    grup.add(p);
  }

  // iç çekirdek (mutfak/servis) — sağlam beton
  const cekirdek = new THREE.Mesh(new THREE.CylinderGeometry(Ri - 0.3, Ri - 0.3, 4.2, 120, 1, true), beton);
  cekirdek.position.y = Y + 2.1;
  grup.add(cekirdek);

  // iç kanopi: sadece iç şeridin üstünde, terasın dış 9 m'si açık kalır
  const kanopiGeo = new THREE.RingGeometry(Ri - 1.0, Ri + 5.2, 180, 1);
  kanopiGeo.rotateX(-Math.PI / 2);
  const kanopi = new THREE.Mesh(kanopiGeo, beton);
  kanopi.position.y = Y + 5.35;
  grup.add(kanopi);
  // kanopi altı sıcak aydınlatma şeridi
  const kanopiIsik = new THREE.Mesh(new THREE.TorusGeometry(Ri + 4.9, 0.07, 6, 200), seritMateryali(3.0, 1.55, 0.62));
  kanopiIsik.rotation.x = Math.PI / 2;
  kanopiIsik.position.y = Y + 5.22;
  grup.add(kanopiIsik);
  // kanopi kolonları
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.05;
    const kol = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.35, 8), beton);
    kol.position.set(Math.cos(a) * (Ri + 5.0), Y + 2.67, Math.sin(a) * (Ri + 5.0));
    grup.add(kol);
  }

  // teras zemin ışıkları
  const seritSicak = seritMateryali(3.4, 1.75, 0.70);
  const seritSoguk = seritMateryali(1.5, 2.1, 3.0);
  const s1 = new THREE.Mesh(new THREE.TorusGeometry(Ro - 1.15, 0.06, 6, 220), seritSicak);
  s1.rotation.x = Math.PI / 2; s1.position.y = Y + 0.03; grup.add(s1);
  const s2 = new THREE.Mesh(new THREE.TorusGeometry(Ri + 0.55, 0.05, 6, 160), seritSicak);
  s2.rotation.x = Math.PI / 2; s2.position.y = Y + 0.03; grup.add(s2);
  const s3 = new THREE.Mesh(new THREE.TorusGeometry(Ro + 0.55, 0.06, 6, 220), seritSoguk);
  s3.rotation.x = Math.PI / 2; s3.position.y = Y + 5.5; grup.add(s3);

  // masa + lamba kümeleri (teras boyunca 3 sıra)
  const masaGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.06, 10);
  const ayakGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.72, 6);
  const lambaGeo = new THREE.SphereGeometry(0.20, 6, 5);
  const lambaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.60, 0.62) });
  const masaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.30, 0.29, 0.27) });
  const sandalyeGeo = new THREE.BoxGeometry(0.42, 0.44, 0.42);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + 0.07;
    const r = Ri + 4.0 + (i % 3) * 3.4;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const masa = new THREE.Mesh(masaGeo, masaMat);
    masa.position.set(x, Y + 0.75, z);
    grup.add(masa);
    const ayak = new THREE.Mesh(ayakGeo, masaMat);
    ayak.position.set(x, Y + 0.37, z);
    grup.add(ayak);
    const lamba = new THREE.Mesh(lambaGeo, lambaMat);
    lamba.position.set(x, Y + 0.92, z);
    grup.add(lamba);
    // iki sandalye (masanın iç/dış yanı)
    for (const yon of [-1, 1]) {
      const s = new THREE.Mesh(sandalyeGeo, masaMat);
      s.position.set(x + Math.cos(a) * 0.95 * yon, Y + 0.22, z + Math.sin(a) * 0.95 * yon);
      s.rotation.y = -a;
      grup.add(s);
    }
  }

  // V payandalar (alt taşıyıcı): 14 adet, dış ve iç kenardan ortada birleşir
  const merkezY = Y - 18.5;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.11;
    const hub = new THREE.Vector3(Math.cos(a) * 27.5, merkezY, Math.sin(a) * 27.5);
    const disUc = new THREE.Vector3(Math.cos(a) * (Ro - 1.4), Y - kal, Math.sin(a) * (Ro - 1.4));
    const icUc = new THREE.Vector3(Math.cos(a) * (Ri + 1.0), Y - kal, Math.sin(a) * (Ri + 1.0));
    grup.add(cubuk(disUc, hub, 0.52, beton));
    grup.add(cubuk(icUc, hub, 0.44, beton));
    const icAlt = new THREE.Vector3(Math.cos(a) * (Ri - 2.0), Y - 2.0, Math.sin(a) * (Ri - 2.0));
    grup.add(cubuk(hub, icAlt, 0.30, beton));
  }
  const gerilimHalkasi = new THREE.Mesh(new THREE.TorusGeometry(27.5, 0.34, 8, 160), beton);
  gerilimHalkasi.rotation.x = Math.PI / 2;
  gerilimHalkasi.position.y = merkezY;
  grup.add(gerilimHalkasi);
  // alt halka sıcak ışığı: uçurumun üstünde turuncu bir iz
  const altSerit = new THREE.Mesh(new THREE.TorusGeometry(27.5, 0.10, 6, 160), seritSicak);
  altSerit.rotation.x = Math.PI / 2;
  altSerit.position.y = merkezY - 0.42;
  grup.add(altSerit);

  // ---- köprüler: iki kuleden halkaya ----
  // Köprü ucu kule gövdesinin GERÇEK yüzey kotundan başlar (analitik yarıçap),
  // 1.2 m kaya içine gömülür; halka tarafı dış duvara 1.2 m biner.
  const halat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.24, 0.25, 0.28) });
  const kopruler = [];
  for (const k of DUNYA.kuleler) {
    const dir = new THREE.Vector3(k.x, 0, k.z).normalize();
    const aYuzey = Math.atan2(-dir.z, -dir.x);
    const yuzeyY = Y - 0.9;
    const rYuzey = kuleYaricap(k, aYuzey, yuzeyY);
    const A = new THREE.Vector3(
      k.x + Math.cos(aYuzey) * (rYuzey - 1.2), yuzeyY,
      k.z + Math.sin(aYuzey) * (rYuzey - 1.2));
    const B = new THREE.Vector3(dir.x * (Ro + 1.2), yuzeyY, dir.z * (Ro + 1.2));
    const uzunluk = A.distanceTo(B);
    const orta = A.clone().add(B).multiplyScalar(0.5);

    const kopru = new THREE.Group();
    const govde = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, uzunluk), beton);
    govde.position.copy(orta);
    govde.lookAt(B);
    kopru.add(govde);

    for (const yan of [-1, 1]) {
      const kiris = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, uzunluk), beton);
      kiris.position.copy(orta).add(new THREE.Vector3(dir.z * 2.15 * yan, 0.55, -dir.x * 2.15 * yan));
      kiris.lookAt(B);
      kopru.add(kiris);
    }
    const altKir = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, uzunluk * 0.9), beton);
    altKir.position.copy(orta).add(new THREE.Vector3(0, -1.1, 0));
    altKir.lookAt(B);
    kopru.add(altKir);

    // köprü ışığı: döşemeye gömülü sıcak şerit
    const serit = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, uzunluk * 0.96), seritSicak);
    serit.position.copy(orta).add(new THREE.Vector3(0, 0.56, 0));
    serit.lookAt(B);
    kopru.add(serit);

    // kaya içine oturan ayak: köprünün kuleye girişi
    const ayak = new THREE.Mesh(new THREE.BoxGeometry(6.2, 3.4, 3.2), beton);
    ayak.position.copy(A).addScaledVector(dir, -0.6);
    ayak.lookAt(B);
    kopru.add(ayak);

    grup.add(kopru);

    // ---- görünür taşıyıcı bağ: kule duvarından halka altına V payanda + üst askı ----
    const halkaUc = new THREE.Vector3(dir.x * (Ro - 0.7), Y - kal - 0.8, dir.z * (Ro - 0.7));
    for (const sap of [-0.085, 0.085]) {
      const aAlt = aYuzey + sap;
      const rAlt = kuleYaricap(k, aAlt, Y - 16);
      const pAlt = new THREE.Vector3(
        k.x + Math.cos(aAlt) * (rAlt - 1.0), Y - 16,
        k.z + Math.sin(aAlt) * (rAlt - 1.0));
      grup.add(cubuk(pAlt, halkaUc, 0.44, beton));
      const ayakAlt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), beton);
      ayakAlt.position.copy(pAlt);
      grup.add(ayakAlt);
    }
    const rUst = kuleYaricap(k, aYuzey, Y + 9);
    const pUst = new THREE.Vector3(
      k.x + Math.cos(aYuzey) * (rUst - 1.0), Y + 9,
      k.z + Math.sin(aYuzey) * (rUst - 1.0));
    for (const f of [0.34, 0.68]) {
      const hedefNokta = A.clone().lerp(B, f).add(new THREE.Vector3(0, 0.45, 0));
      grup.add(cubuk(pUst, hedefNokta, 0.085, halat));
    }

    kopruler.push({ A: A.clone(), B: B.clone(), uzunluk, rYuzey });
  }

  function guncelle(kamera, zaman) {
    for (const m of malzemeler) {
      if (m.userData.kameraGuncelle) m.userData.kameraGuncelle(kamera);
      if (m.userData.zaman) m.userData.zaman(zaman);
    }
  }

  return { grup, guncelle, malzemeler, kopruler };
}
