// Hacimli bulut denizi: gerçek raymarch (çeyrek çözünürlük + temporal jitter + birikim).
// Billboard yok; kamera dönerken paralaks fiziksel olarak oluşur.
// Sanat yönü: mavi saatte bulut denizi IŞIK KAYNAĞIDIR — üst yüzeyler gümüş-şeftali,
// iç kısım koyu; halkanın altında sıcak bir göl, güneş azimutunda alçak sıcak bant.
import * as THREE from 'three';
import { NOISE, TAM_EKRAN_VERT } from './glsl.js';
import { DUNYA, GUNES } from './world.js';

export function kurBulutlar(renderer, { genislik, yukseklik }) {
  let olcek = 0.25;
  let adim = 30;

  const hedef = (o) => {
    const w = Math.max(64, Math.floor(genislik * o));
    const h = Math.max(64, Math.floor(yukseklik * o));
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping
    });
  };

  let rtA = hedef(olcek);
  let rtB = hedef(olcek);

  const uniforms = {
    tDerinlik: { value: null },
    tOnceki: { value: null },
    uTersProj: { value: new THREE.Matrix4() },
    uKameraMat: { value: new THREE.Matrix4() },
    uKamera: { value: new THREE.Vector3() },
    uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
    uZaman: { value: 0 },
    uJitter: { value: 0 },
    uKaristir: { value: 1 },
    uAdim: { value: adim },
    uYogunluk: { value: 1.0 },
    uBulutAlt: { value: DUNYA.bulutAlt },
    uBulutUst: { value: DUNYA.bulutUst },
    uSicakKoy: { value: 1.0 },
    uDerinlikKullan: { value: 1.0 },
    // uzak/taban kenarı ufka karışsın diye mesafe tabanlı sis sönümü
    uSisRenk: { value: new THREE.Vector3(0.135, 0.165, 0.285) },
    uSisBas: { value: DUNYA.sisBaslangic },
    uSisKat: { value: 0.0013 }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false, depthWrite: false,
    vertexShader: TAM_EKRAN_VERT,
    fragmentShader: NOISE + `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDerinlik;
      uniform sampler2D tOnceki;
      uniform mat4 uTersProj;
      uniform mat4 uKameraMat;
      uniform vec3 uKamera;
      uniform vec3 uGunesYon;
      uniform float uZaman;
      uniform float uJitter;
      uniform float uKaristir;
      uniform float uAdim;
      uniform float uYogunluk;
      uniform float uBulutAlt;
      uniform float uBulutUst;
      uniform float uSicakKoy;
      uniform float uDerinlikKullan;
      uniform vec3 uSisRenk;
      uniform float uSisBas;
      uniform float uSisKat;

      // yerel deniz yüzeyi kotu (kümelerin tepe profili)
      float denizTepe(vec3 pw){
        return uBulutUst - 78.0 * fbm3(vec3(pw.x * 0.0042, 2.0, pw.z * 0.0042));
      }

      float yogunluk(vec3 p){
        if (p.y < uBulutAlt || p.y > uBulutUst) return 0.0;
        // alan çarpıtma: kümeleri karnabahar biçimine sokar
        vec3 q = p * 0.0030;
        float w1 = fbm3(q * 1.35 + vec3(uZaman * 0.006, 0.0, uZaman * 0.0035));
        float w2 = fbm3(q * 1.35 + vec3(5.2, 1.3, uZaman * 0.0045));
        vec3 pw = p + vec3(w1 - 0.5, 0.0, w2 - 0.5) * 240.0;
        float sekil = fbm3(pw * 0.0024);
        float kapsam = smoothstep(0.40, 0.56, sekil);
        float tepe = denizTepe(pw);
        float kat = smoothstep(uBulutAlt, uBulutAlt + 55.0, p.y) * (1.0 - smoothstep(tepe - 58.0, tepe, p.y));
        float det = fbm3(p * 0.0115 + vec3(0.0, uZaman * 0.010, 0.0));
        float yog = kapsam * kat * (0.55 + 1.45 * det);
        yog *= 1.0 - smoothstep(4200.0, 7000.0, length(p.xz));
        return clamp(yog, 0.0, 1.0) * uYogunluk;
      }

      // gölge için ucuz yoğunluk (detay katmanı atlanır)
      float yogunlukHizli(vec3 p){
        if (p.y < uBulutAlt || p.y > uBulutUst) return 0.0;
        vec3 q = p * 0.0030;
        float w1 = fbm3(q * 1.35 + vec3(uZaman * 0.006, 0.0, uZaman * 0.0035));
        float w2 = fbm3(q * 1.35 + vec3(5.2, 1.3, uZaman * 0.0045));
        vec3 pw = p + vec3(w1 - 0.5, 0.0, w2 - 0.5) * 240.0;
        float sekil = fbm3(pw * 0.0024);
        float kapsam = smoothstep(0.40, 0.56, sekil);
        float tepe = denizTepe(pw);
        float kat = smoothstep(uBulutAlt, uBulutAlt + 55.0, p.y) * (1.0 - smoothstep(tepe - 58.0, tepe, p.y));
        return clamp(kapsam * kat, 0.0, 1.0) * uYogunluk;
      }

      vec3 bulutIsik(vec3 p, vec3 rd){
        vec3 q = p * 0.0030;
        float w1 = fbm3(q * 1.35 + vec3(uZaman * 0.006, 0.0, uZaman * 0.0035));
        float w2 = fbm3(q * 1.35 + vec3(5.2, 1.3, uZaman * 0.0045));
        vec3 pw = p + vec3(w1 - 0.5, 0.0, w2 - 0.5) * 240.0;
        float tepe = denizTepe(pw);

        // yüzeye yakınlık: deniz tepeleri gümüş, iç kısım koyu
        float derin = clamp((tepe - p.y) / 140.0, 0.0, 1.0);
        float yuzey = 1.0 - smoothstep(0.02, 0.75, derin);

        // güneş yönünde iki örnekle ucuz self-shadow (kıvrımların içi karanlık kalır)
        float g1 = yogunlukHizli(p + uGunesYon * 70.0);
        float g2 = yogunlukHizli(p + uGunesYon * 210.0);
        float golge = exp(-(g1 * 2.0 + g2 * 1.0));

        vec3 ustRenk = vec3(0.88, 0.90, 0.97);
        vec3 dipRenk = vec3(0.030, 0.045, 0.080);
        vec3 renk = mix(dipRenk, ustRenk, yuzey);
        renk *= 0.62 + 0.62 * golge;

        // ufuktaki son sıcak ışık: güneş azimutuna bakan uzak yüzeyler
        vec3 yatay = normalize(vec3(p.x - uKamera.x, 0.0, p.z - uKamera.z) + vec3(0.0001));
        float azimut = max(0.0, dot(yatay, normalize(vec3(uGunesYon.x, 0.0, uGunesYon.z))));
        float faz = pow(max(0.0, dot(rd, uGunesYon)), 3.0);
        float mesafe = length(p - uKamera);
        float ufuk = smoothstep(400.0, 2600.0, mesafe);
        renk += vec3(1.00, 0.50, 0.26) * yuzey * golge * azimut * (0.20 + 0.80 * faz) * (0.30 + 0.70 * ufuk) * 1.70;

        // halkanın altındaki sıcak göl: deniz yüzeyinde turuncu bir leke
        float altGol = exp(-pow((p.y - (uBulutUst - 32.0)) / 58.0, 2.0)) * smoothstep(300.0, 40.0, length(p.xz));
        renk += vec3(1.00, 0.54, 0.24) * altGol * yuzey * 0.95 * uSicakKoy;

        // soğuk karşı dolgu (denizin gölgeli kıvrımları)
        renk += vec3(0.10, 0.14, 0.24) * (1.0 - yuzey) * 0.55;

        // ufka doğru atmosferik sıcak-soğuk geçiş
        renk = mix(renk, vec3(0.34, 0.30, 0.36), smoothstep(1500.0, 4200.0, mesafe) * 0.38);
        return renk;
      }

      void main(){
        vec2 uv = vUv;

        // sahne derinliği → bu pikselde bulutun gidebileceği en uzak mesafe
        float dz = texture2D(tDerinlik, uv).x;
        vec4 vp = uTersProj * vec4(uv * 2.0 - 1.0, dz * 2.0 - 1.0, 1.0);
        vp /= vp.w;
        float sahneMesafe = uDerinlikKullan > 0.5 ? length(vp.xyz) : 1e6;
        vec4 vp1 = uTersProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vp1 /= vp1.w;
        vec3 rdV = normalize(vp1.xyz);
        vec3 rd = normalize((uKameraMat * vec4(rdV, 0.0)).xyz);

        float t0, t1;
        if (abs(rd.y) < 1e-4) {
          if (uKamera.y < uBulutAlt || uKamera.y > uBulutUst) { t1 = 0.0; t0 = 1.0; }
          else { t0 = 0.0; t1 = 2600.0; }
        } else {
          float ta = (uBulutAlt - uKamera.y) / rd.y;
          float tb = (uBulutUst - uKamera.y) / rd.y;
          t0 = max(0.0, min(ta, tb));
          t1 = max(ta, tb);
        }
        t1 = min(t1, min(sahneMesafe, 4200.0));
        if (t1 <= t0 + 0.5) {
          vec4 eski = texture2D(tOnceki, uv);
          gl_FragColor = mix(vec4(0.0), eski, 1.0 - uKaristir);
          return;
        }

        float j = fract(hash13(vec3(gl_FragCoord.xy, uZaman * 7.13)) + uJitter);
        vec3 toplam = vec3(0.0);
        float T = 1.0;
        int n = int(uAdim);
        for (int i = 0; i < 48; i++){
          if (i >= n) break;
          float u = (clamp(float(i) + j, 0.0, 1.0)) / float(n);
          float t = t0 + (t1 - t0) * pow(u, 1.5);
          vec3 p = uKamera + rd * t;
          float yog = yogunluk(p);
          if (yog > 0.003) {
            float dt = max(1.0, (t1 - t0) * 1.5 * pow(max(u, 0.002), 0.5) / float(n));
            float a = 1.0 - exp(-yog * dt * 0.042);
            vec3 c = bulutIsik(p, rd);
            // uzak kenar: sis rengine sönüm + saydamlaşma; şerit ufka yumuşak geçer
            float sisF = clamp(1.0 - exp(-max(0.0, t - uSisBas) * uSisKat), 0.0, 1.0);
            c = mix(c, uSisRenk, sisF);
            a *= 1.0 - 0.90 * sisF;
            toplam += T * a * c;
            T *= (1.0 - a);
            if (T < 0.012) break;
          }
        }

        vec4 yeni = vec4(toplam, 1.0 - T);
        vec4 eski = texture2D(tOnceki, uv);
        gl_FragColor = mix(yeni, eski, 1.0 - uKaristir);
      }
    `
  });

  const sahne = new THREE.Scene();
  const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  sahne.add(quad);

  let birikim = 0;
  let sonKamera = null;

  function ayarla(yeniGenislik, yeniYukseklik) {
    genislik = yeniGenislik; yukseklik = yeniYukseklik;
    rtA.setSize(Math.max(64, Math.floor(genislik * olcek)), Math.max(64, Math.floor(yukseklik * olcek)));
    rtB.setSize(Math.max(64, Math.floor(genislik * olcek)), Math.max(64, Math.floor(yukseklik * olcek)));
    birikim = 0;
  }

  function kalite(seviye) {
    if (seviye === 'yuksek') { olcek = 0.5; adim = 48; }
    else if (seviye === 'orta') { olcek = 0.40; adim = 40; }
    else { olcek = 0.25; adim = 28; }
    uniforms.uAdim.value = adim;
    ayarla(genislik, yukseklik);
  }

  // Bulutları çizer; doku sonucu .doku olarak döner (çeyrek çözünürlük, birikimli)
  function ciz(kamera3, derinlikDoku, zaman) {
    uniforms.tDerinlik.value = derinlikDoku;
    uniforms.uTersProj.value.copy(kamera3.projectionMatrixInverse);
    uniforms.uKameraMat.value.copy(kamera3.matrixWorld);
    uniforms.uKamera.value.copy(kamera3.position);
    uniforms.uZaman.value = zaman;

    const degisti = !sonKamera ||
      sonKamera.poz.distanceToSquared(kamera3.position) > 0.0004 ||
      sonKamera.yon.angleTo(kamera3.quaternion) > 0.0004 ||
      sonKamera.fov !== kamera3.fov;
    if (degisti) { birikim = 0; }
    sonKamera = { poz: kamera3.position.clone(), yon: kamera3.quaternion.clone(), fov: kamera3.fov };

    birikim = Math.min(birikim + 1, 24);
    uniforms.uKaristir.value = 1 / birikim;
    uniforms.uJitter.value = (birikim % 8) * 0.125;
    uniforms.tOnceki.value = rtA.texture;

    renderer.setRenderTarget(rtB);
    renderer.render(sahne, kamera);
    renderer.setRenderTarget(null);

    // ping-pong
    const gecici = rtA; rtA = rtB; rtB = gecici;
    return rtA.texture;
  }

  return {
    ciz, ayarla, kalite, uniforms,
    derinlikKullan: (ac) => { uniforms.uDerinlikKullan.value = ac ? 1 : 0; },
    get doku() { return rtA.texture; },
    get cozunurluk() { return [rtA.width, rtA.height]; },
    get adimSayisi() { return adim; },
    get birikimSayisi() { return birikim; }
  };
}
