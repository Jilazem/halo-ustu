// Dolomit kaya malzemesi — kuleler ve plato aynı iklim kuralını paylaşır:
// kar = yükseklik eşiği + eğim kapısı + gürültüyle kırılmış sınır.
// Sanat yönü: mavi saatte kaya KOYU siluettir; ışığı bulut denizi ve halka verir.
// Bu yüzden gövde soğuk ve düşük parlaklıkta, kenarlar halka/güneş kaynaklı sıcak.
import * as THREE from 'three';
import { NOISE, HAVA } from './glsl.js';
import { DUNYA, GUNES } from './world.js';

export function kayaMateryali(sec = {}) {
  const uniforms = {
    uKamera: { value: new THREE.Vector3() },
    uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
    uUfukRenk: { value: new THREE.Color(0.135, 0.165, 0.285) },
    uSisBas: { value: DUNYA.sisBaslangic },
    uSisBit: { value: DUNYA.sisBitis },
    uKarCizgisi: { value: sec.karCizgisi !== undefined ? sec.karCizgisi : DUNYA.karCizgisi },
    uKarEgim: { value: DUNYA.karEgimSinir },
    uKatmanOlcek: { value: sec.katmanOlcek || 1.0 },
    uKoyu: { value: sec.koyu !== undefined ? sec.koyu : 0.42 },
    uSicakYansima: { value: sec.sicakYansima !== undefined ? sec.sicakYansima : 0.34 },
    uHalkaY: { value: DUNYA.halkaY }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vDunya;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDunya = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: NOISE + HAVA + `
      varying vec3 vDunya;
      varying vec3 vNormal;
      varying vec2 vUv;
      uniform vec3 uKamera;
      uniform vec3 uGunesYon;
      uniform float uKarCizgisi;
      uniform float uKarEgim;
      uniform float uKatmanOlcek;
      uniform float uKoyu;
      uniform float uSicakYansima;
      uniform float uHalkaY;

      void main(){
        vec3 wp = vDunya;
        vec3 n = normalize(vNormal);
        vec3 bakis = normalize(uKamera - wp);
        float yuk = wp.y;

        // --- dolomit gövdesi: soğuk gri, yatay stratigrafi bantları ---
        float k = uKatmanOlcek;
        float bant = fbm3(vec3(wp.x * 0.075 * k, wp.y * 0.34 * k, wp.z * 0.075 * k));
        float ince = vnoise(vec3(wp.x * 0.55, wp.y * 1.7, wp.z * 0.55));
        float kirik = vnoise(vec3(wp.x * 0.21, wp.y * 0.62, wp.z * 0.21));
        float strat = 0.5 + 0.5 * sin(wp.y * 0.42 * k + bant * 11.0 + kirik * 5.0);

        vec3 kayaKoyu = vec3(uKoyu * 0.50, uKoyu * 0.56, uKoyu * 0.74);
        vec3 kayaAcik = vec3(uKoyu * 1.35, uKoyu * 1.40, uKoyu * 1.58);
        vec3 kaya = mix(kayaKoyu, kayaAcik, bant * 0.74 + strat * 0.20);
        kaya *= 0.72 + 0.46 * ince;

        // dikey erozyon olukları: dolomitte yatay tabaka değil, düşey kanal okunur
        float az = atan(wp.z, wp.x);
        float oluk = 0.5 + 0.5 * sin(az * 26.0 + vnoise(vec3(wp.x * 0.22, wp.y * 0.035, wp.z * 0.22)) * 9.0);
        kaya *= 0.80 + 0.34 * oluk;

        // oyuk/çatlak gölgelemesi (ucuz AO)
        float oyuk = smoothstep(0.40, 0.80, fbm3(vec3(wp.x * 0.14, wp.y * 0.14, wp.z * 0.14)));
        kaya *= mix(1.0, 0.52, oyuk * 0.85);

        // --- ışık: soğuk gökyüzü + alçak güneş kenarı + halka sıcak yansıması ---
        vec3 isik = vec3(0.085, 0.125, 0.215) * (0.28 + 0.72 * max(0.0, n.y)) * 1.75;
        // gökyüzünün üstten gelen soğuk dolgusu
        isik += vec3(0.10, 0.14, 0.24) * pow(max(0.0, n.y), 1.4) * 1.05;

        // güneş ufkun altında: yalnız azimuta bakan dikey yüzlerde ince sıcak kenar
        vec3 gunesYatay = normalize(vec3(uGunesYon.x, 0.0, uGunesYon.z));
        float gunesKenar = pow(max(0.0, dot(normalize(vec3(n.x, 0.0, n.z) + vec3(0.0001)), gunesYatay)), 2.2);
        isik += vec3(1.0, 0.50, 0.22) * gunesKenar * 0.62;

        // halka: yalnızca halka kotu çevresinde ve merkeze bakan yüzlerde sıcak ışık
        float halkaKot = smoothstep(150.0, 30.0, abs(yuk - uHalkaY));
        float merkezBakis = max(0.0, dot(n, normalize(vec3(-wp.x, 26.0, -wp.z) + vec3(0.0001))));
        isik += vec3(1.0, 0.56, 0.24) * uSicakYansima * halkaKot * (0.25 + 0.75 * merkezBakis);

        // siluet kenarı: bulut denizine karşı soğuk ince çizgi (uzaklıkla azalan)
        float fres = pow(1.0 - max(0.0, dot(n, bakis)), 3.5);
        isik += vec3(0.42, 0.58, 0.86) * fres * 0.13 * smoothstep(1200.0, 120.0, length(wp - uKamera));

        vec3 renk = kaya * isik;

        // --- kar: yükseklik eşiği (gürültüyle kırılır) + eğim kapısı ---
        float esik = uKarCizgisi + 24.0 * (vnoise(vec3(wp.x * 0.018, 3.0, wp.z * 0.018)) - 0.5);
        float karYuk = smoothstep(esik - 9.0, esik + 18.0, yuk);
        float karEgim = smoothstep(uKarEgim, uKarEgim + 0.24, n.y);
        float kar = karYuk * karEgim;
        // zirve kırağısı: kule tepesinde dikey yüzlerde bile ince kar örtüsü okunsun
        float zirve = smoothstep(uKarCizgisi + 4.0, uKarCizgisi + 44.0, yuk);
        float kira = zirve * (0.55 + 0.45 * karEgim) * (0.45 + 0.55 * vnoise(vec3(wp.x * 0.11, wp.y * 0.05, wp.z * 0.11)));
        kar = max(kar, kira * 1.15);
        kar *= 0.70 + 0.55 * vnoise(vec3(wp.x * 0.09, wp.y * 0.09, wp.z * 0.09));
        kar *= 0.55 + 0.45 * smoothstep(0.0, 0.8, dot(n, bakis) * -1.0 + 0.9); // karşı yüzler daha parlak

        vec3 karRenk = vec3(0.60, 0.68, 0.84) * (isik * 1.55 + vec3(0.10, 0.12, 0.18));
        renk = mix(renk, karRenk, clamp(kar, 0.0, 1.0));

        // çok yakın yüzeylerde ince tanecik
        renk *= 0.94 + 0.12 * vnoise(vec3(wp.x * 3.1, wp.y * 3.1, wp.z * 3.1));

        float mesafe = length(wp - uKamera);
        renk = havaPerspektifi(renk, mesafe);
        gl_FragColor = vec4(renk, 1.0);
      }
    `
  });

  mat.userData.kameraGuncelle = (kamera) => {
    uniforms.uKamera.value.copy(kamera.position);
  };
  return mat;
}
