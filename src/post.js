// Post-process: bulutları sahneyle birleştir, bloom, filmik tonemap, grain, vinyet.
// Tüm geçişler kendi GLSL'imiz; EffectComposer kullanılmıyor.
import * as THREE from 'three';
import { TAM_EKRAN_VERT } from './glsl.js';

function rt(w, h, derinlikli) {
  const o = {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping
  };
  if (derinlikli) {
    const d = new THREE.DepthTexture(w, h);
    d.type = THREE.UnsignedIntType;
    d.minFilter = THREE.NearestFilter;
    d.magFilter = THREE.NearestFilter;
    o.depthTexture = d;
    o.depthBuffer = true;
  }
  return new THREE.WebGLRenderTarget(w, h, o);
}

export function kurPost(renderer, { genislik, yukseklik }) {
  let W = genislik, H = yukseklik;

  const sahneRT = rt(W, H, true);
  const birlestik = rt(W, H, false);

  const yari = () => [Math.max(1, Math.floor(W / 2)), Math.max(1, Math.floor(H / 2))];
  const ceyrek = () => [Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4))];
  const sekizde = () => [Math.max(1, Math.floor(W / 8)), Math.max(1, Math.floor(H / 8))];

  let b0 = rt(...yari(), false), b0t = rt(...yari(), false);
  let b1 = rt(...ceyrek(), false), b1t = rt(...ceyrek(), false);
  let b2 = rt(...sekizde(), false), b2t = rt(...sekizde(), false);

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);

  const gecis = (mat, hedef) => {
    quad.material = mat;
    renderer.setRenderTarget(hedef);
    renderer.render(quadScene, quadCam);
  };

  // 1) sahne + bulut birleştirme
  const birlestirMat = new THREE.ShaderMaterial({
    uniforms: {
      tSahne: { value: null },
      tBulut: { value: null },
      uBulutGuc: { value: 1.0 }
    },
    depthTest: false, depthWrite: false,
    vertexShader: TAM_EKRAN_VERT,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tSahne;
      uniform sampler2D tBulut;
      uniform float uBulutGuc;
      void main(){
        vec3 sahne = texture2D(tSahne, vUv).rgb;
        vec4 bulut = texture2D(tBulut, vUv);
        // premultiplied bulut rengi
        vec3 renk = sahne * (1.0 - clamp(bulut.a, 0.0, 1.0) * uBulutGuc) + bulut.rgb * uBulutGuc;
        gl_FragColor = vec4(renk, 1.0);
      }
    `
  });

  // 2) parlaklık eşiği
  const parlakMat = new THREE.ShaderMaterial({
    uniforms: {
      tKaynak: { value: null },
      uEsik: { value: 1.05 },
      uYumusak: { value: 0.75 }
    },
    depthTest: false, depthWrite: false,
    vertexShader: TAM_EKRAN_VERT,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tKaynak;
      uniform float uEsik, uYumusak;
      void main(){
        vec3 c = texture2D(tKaynak, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float t = smoothstep(uEsik, uEsik + uYumusak, l);
        gl_FragColor = vec4(c * t, 1.0);
      }
    `
  });

  // 3) ayrık gaussian blur
  const blurMat = new THREE.ShaderMaterial({
    uniforms: {
      tKaynak: { value: null },
      uYon: { value: new THREE.Vector2(1, 0) },
      uAdim: { value: 1.0 }
    },
    depthTest: false, depthWrite: false,
    vertexShader: TAM_EKRAN_VERT,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tKaynak;
      uniform vec2 uYon;
      uniform float uAdim;
      void main(){
        vec3 s = vec3(0.0);
        float agirlik[5];
        agirlik[0] = 0.2270270270;
        agirlik[1] = 0.1945945946;
        agirlik[2] = 0.1216216216;
        agirlik[3] = 0.0540540541;
        agirlik[4] = 0.0162162162;
        s += texture2D(tKaynak, vUv).rgb * agirlik[0];
        for (int i = 1; i < 5; i++){
          vec2 o = uYon * uAdim * float(i);
          s += texture2D(tKaynak, vUv + o).rgb * agirlik[i];
          s += texture2D(tKaynak, vUv - o).rgb * agirlik[i];
        }
        gl_FragColor = vec4(s, 1.0);
      }
    `
  });

  // 4) final: tonemap + grain + vinyet
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tBirlestik: { value: null },
      tBloom0: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      uZaman: { value: 0 },
      uPozlama: { value: 1.0 },
      uBloom: { value: 0.85 },
      uCozunurluk: { value: new THREE.Vector2(W, H) }
    },
    depthTest: false, depthWrite: false,
    vertexShader: TAM_EKRAN_VERT,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tBirlestik, tBloom0, tBloom1, tBloom2;
      uniform float uZaman, uPozlama, uBloom;
      uniform vec2 uCozunurluk;

      vec3 hable(vec3 x){
        const float A = 0.15, B = 0.50, C = 0.10, D = 0.20, E = 0.02, F = 0.30;
        return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
      }
      float h13(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      void main(){
        vec3 c = texture2D(tBirlestik, vUv).rgb;
        vec3 b = texture2D(tBloom0, vUv).rgb * 0.55
               + texture2D(tBloom1, vUv).rgb * 0.75
               + texture2D(tBloom2, vUv).rgb * 1.00;
        c += b * uBloom;

        // filmik omuz + toe
        vec3 m = hable(c * uPozlama) / hable(vec3(11.2));
        // hafif S eğrisi (kontrast)
        m = clamp(m, 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m) * 0.35 + m * 0.65;
        // gamma
        m = pow(m, vec3(1.0 / 2.2));

        // grain (kareye bağlı, 24 Hz)
        float g = h13(vec3(vUv * uCozunurluk, floor(uZaman * 24.0)));
        m += (g - 0.5) * 0.030 * (1.0 - dot(m, vec3(0.333)));

        // vinyet
        float v = smoothstep(1.15, 0.28, length(vUv - 0.5) * 1.35);
        m *= mix(0.62, 1.0, v);

        gl_FragColor = vec4(clamp(m, 0.0, 1.0), 1.0);
      }
    `
  });

  function ayarla(w, h) {
    W = w; H = h;
    sahneRT.setSize(W, H);
    birlestik.setSize(W, H);
    b0.setSize(...yari()); b0t.setSize(...yari());
    b1.setSize(...ceyrek()); b1t.setSize(...ceyrek());
    b2.setSize(...sekizde()); b2t.setSize(...sekizde());
    finalMat.uniforms.uCozunurluk.value.set(W, H);
  }

  function sahneyiCiz(sahne, kamera) {
    renderer.setRenderTarget(sahneRT);
    renderer.clear();
    renderer.render(sahne, kamera);
  }

  function sonIsle(bulutDoku, zaman) {
    // birleştirme
    birlestirMat.uniforms.tSahne.value = sahneRT.texture;
    birlestirMat.uniforms.tBulut.value = bulutDoku;
    gecis(birlestirMat, birlestik);

    // bloom zinciri
    parlakMat.uniforms.tKaynak.value = birlestik.texture;
    gecis(parlakMat, b0);

    blurMat.uniforms.tKaynak.value = b0.texture;
    blurMat.uniforms.uYon.value.set(1, 0);
    blurMat.uniforms.uAdim.value = 1.0;
    gecis(blurMat, b0t);
    blurMat.uniforms.tKaynak.value = b0t.texture;
    blurMat.uniforms.uYon.value.set(0, 1);
    gecis(blurMat, b0);

    blurMat.uniforms.tKaynak.value = b0.texture;
    blurMat.uniforms.uYon.value.set(1, 0);
    blurMat.uniforms.uAdim.value = 1.6;
    gecis(blurMat, b1);
    blurMat.uniforms.tKaynak.value = b1.texture;
    blurMat.uniforms.uYon.value.set(0, 1);
    blurMat.uniforms.uAdim.value = 1.6;
    gecis(blurMat, b1t);

    blurMat.uniforms.tKaynak.value = b1t.texture;
    blurMat.uniforms.uYon.value.set(1, 0);
    blurMat.uniforms.uAdim.value = 2.4;
    gecis(blurMat, b2);
    blurMat.uniforms.tKaynak.value = b2.texture;
    blurMat.uniforms.uYon.value.set(0, 1);
    blurMat.uniforms.uAdim.value = 2.4;
    gecis(blurMat, b2t);

    finalMat.uniforms.tBirlestik.value = birlestik.texture;
    finalMat.uniforms.tBloom0.value = b0.texture;
    finalMat.uniforms.tBloom1.value = b1t.texture;
    finalMat.uniforms.tBloom2.value = b2t.texture;
    finalMat.uniforms.uZaman.value = zaman;
    gecis(finalMat, null);
  }

  return { kare: (s, k, b, z) => { sahneyiCiz(s, k); sonIsle(b, z); }, sahneyiCiz, sonIsle, ayarla, sahneRT,
    guc: (v) => { birlestirMat.uniforms.uBulutGuc.value = v; },
    pozlama: (v) => { finalMat.uniforms.uPozlama.value = v; },
    get derinlik() { return sahneRT.depthTexture; } };
}
