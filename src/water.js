// Vadi gölü: sahte yansıma (gökyüzü fonksiyonu + kıyı ışıkları), fresnel, dalga normali.
// Kıyıda köy ışıkları: küçük emissive küreler + suya düşen YUMUŞAK ışık huzmeleri.
// Huzmeler artık billboard dikdörtgen değil: çapraz iki düzlem + kenar/gürültü/mesafe
// sönümlü shader; böylece yakın planda keskin blok görünmez.
import * as THREE from 'three';
import { NOISE, HAVA, GOKYUZU_FN } from './glsl.js';
import { DUNYA, GUNES } from './world.js';


function jsHash(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function kurGol() {
  const grup = new THREE.Group();
  const merkez = new THREE.Vector3(DUNYA.golMerkez.x, DUNYA.golY, DUNYA.golMerkez.z);

  // su düzlemi (havza içinde)
  const geo = new THREE.CircleGeometry(DUNYA.golYaricap * 0.97, 96);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uKamera: { value: new THREE.Vector3() },
    uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
    uZaman: { value: 0 },
    uUfukRenk: { value: new THREE.Color(0.135, 0.165, 0.285) },
    uSisBas: { value: DUNYA.sisBaslangic },
    uSisBit: { value: DUNYA.sisBitis }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vDunya;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vDunya = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: NOISE + HAVA + GOKYUZU_FN + `
      varying vec3 vDunya;
      uniform vec3 uKamera;
      uniform float uZaman;
      void main(){
        vec3 wp = vDunya;
        vec3 rd = normalize(wp - uKamera);
        float d1 = fbm3(vec3(wp.x * 0.045, uZaman * 0.05, wp.z * 0.045));
        float d2 = fbm3(vec3(wp.z * 0.06, uZaman * 0.05, wp.x * 0.06));
        vec3 n = normalize(vec3((d1 - 0.5) * 0.22, 1.0, (d2 - 0.5) * 0.22));
        vec3 R = reflect(rd, n);
        R.y = abs(R.y) * 0.92 + 0.04;
        vec3 yansima = gokyuzuRenk(normalize(R));
        float fres = pow(1.0 - max(0.0, dot(-rd, n)), 4.0);
        vec3 su = vec3(0.010, 0.022, 0.045) + yansima * (0.42 + 0.58 * fres);
        // hilal ışığının suda ince gümüş yolu
        float ayYol = pow(fres, 1.6) * smoothstep(0.55, 1.0, fres);
        su += vec3(0.40, 0.48, 0.68) * ayYol * 0.55;
        // kıyı ışıklarının suya vuran sıcak noktaları
        float isik = smoothstep(0.74, 0.96, vnoise(vec3(wp.x * 0.075, 3.0, wp.z * 0.075)));
        su += vec3(1.0, 0.52, 0.20) * isik * (0.28 + 0.65 * fres);
        su = havaPerspektifi(su, length(wp - uKamera));
        gl_FragColor = vec4(su, 1.0);
      }
    `
  });

  const su = new THREE.Mesh(geo, mat);
  su.position.copy(merkez);
  su.name = 'gol';
  grup.add(su);

  // kıyı köyü: emissive noktalar + suya düşen yumuşak huzmeler
  const lambaGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lambaMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.55, 0.62) });

  const huzmeUniforms = {
    uKamera: { value: new THREE.Vector3() },
    uZaman: { value: 0 }
  };
  const huzmeMat = new THREE.ShaderMaterial({
    uniforms: huzmeUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vDunya;
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vDunya = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: NOISE + `
      varying vec2 vUv; varying vec3 vDunya;
      uniform vec3 uKamera; uniform float uZaman;
      void main(){
        float u = vUv.x * 2.0 - 1.0;
        float v = vUv.y;                                  // 0 = alt uç, 1 = su yüzeyi
        // yatay: kenarlara doğru hızla sönen gövde (dikdörtgen kenar yok)
        float yatay = pow(max(0.0, 1.0 - abs(u)), 2.8);
        // dikey: su yüzeyinde parlak, aşağıda dağılan
        float dusey = smoothstep(0.0, 0.30, v) * (1.0 - smoothstep(0.55, 1.0, v));
        // gürültü: huzme içinde kırılma ve ince damar
        float kirilma = 0.35 + 0.65 * fbm3(vec3(v * 2.2, u * 1.3, uZaman * 0.10));
        float ince = 0.72 + 0.28 * vnoise(vec3(v * 8.0, u * 2.2, uZaman * 0.22));
        // mesafe sönümü: yakın planda blok gibi görünmesin
        float uzak = 1.0 - smoothstep(70.0, 340.0, length(vDunya - uKamera));
        // çok yakın planda da sönsün: kamera huzmenin içine girince blok duvar olmasın
        float yakin = smoothstep(6.0, 55.0, length(vDunya - uKamera));
        float alfa = yatay * dusey * kirilma * ince * uzak * yakin * 0.42;
        vec3 renk = mix(vec3(1.0, 0.38, 0.14), vec3(1.0, 0.70, 0.40), v);
        gl_FragColor = vec4(renk * alfa, alfa);
      }
    `
  });

  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + jsHash(i, 1, 2) * 0.12;
    const rr = DUNYA.golYaricap * (0.94 + 0.07 * jsHash(i, 3, 4));
    const x = merkez.x + Math.cos(a) * rr;
    const z = merkez.z + Math.sin(a) * rr;
    const y = DUNYA.golY + 1.2 + jsHash(i, 5, 6) * 2.4;
    const m = new THREE.Mesh(lambaGeo, lambaMat);
    m.position.set(x, y, z);
    m.scale.setScalar(0.55 + jsHash(i, 7, 8) * 0.9);
    grup.add(m);

    // suya düşen huzme: çapraz iki düzlem (hacim hissi), boy/en değişken
    const h = 15 + jsHash(i, 9, 10) * 16;
    const en = 0.9 + jsHash(i, 11, 12) * 1.3;
    const g = new THREE.PlaneGeometry(en, h);
    const donus = jsHash(i, 13, 14) * Math.PI;
    for (const aci of [0, Math.PI / 2]) {
      const s = new THREE.Mesh(g, huzmeMat);
      s.position.set(x, DUNYA.golY - 0.6 - h * 0.5, z);
      s.rotation.y = donus + aci;
      grup.add(s);
    }
  }

  function guncelle(kamera, zaman) {
    uniforms.uKamera.value.copy(kamera.position);
    uniforms.uZaman.value = zaman;
    huzmeUniforms.uKamera.value.copy(kamera.position);
    huzmeUniforms.uZaman.value = zaman;
  }

  return { grup, guncelle, malzeme: mat };
}
