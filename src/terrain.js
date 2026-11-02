// Plato + vadi + göl havzası ve uzak dağ siluetleri.
// Yükseklik fonksiyonu JS'te üretilir, göl hangi bölgede görüneceğini aynı fonksiyon belirler.
// Sanat yönü: mesa dikey bir uçurumla bulut denizinden yükselir (dome değil);
// uçurumda radyal oluklar, etekte moloz yelpazesi.
import * as THREE from 'three';
import { kayaMateryali } from './kaya.js';
import { NOISE, HAVA } from './glsl.js';
import { DUNYA, GUNES } from './world.js';
import { ridged3, fbm3, smoothstep } from './proc.js';

// Plato yüzeyi: bulut denizinden yükselen mesa.
// r<232 plato, 232..330 dikey uçurum (~300 m), 330..780 moloz eteği.
export function zeminY(x, z) {
  const r = Math.hypot(x, z);
  let h = -300 * smoothstep(232, 330, r) - 40 * smoothstep(330, 780, r);

  // uçurumda radyal oluklar (dolomit kulelerindeki aşınmayla aynı dil)
  const a = Math.atan2(z, x);
  const ucBandi = smoothstep(228, 250, r) * (1 - smoothstep(296, 372, r));
  h += (ridged3(Math.cos(a) * 3.2, 5.0, Math.sin(a) * 3.2, 3) - 0.5) * 34 * ucBandi;

  // moloz yelpazesi ve etek kırıkları
  h += (ridged3(x * 0.006, 9.1, z * 0.006, 4) - 0.5) * 26 * smoothstep(320, 430, r) * (1 - smoothstep(600, 780, r));

  // plato üstü hafif engebe (düz beton değil, çıplak kaya)
  h += (fbm3(x * 0.010, 3.7, z * 0.010, 3) - 0.5) * 6.5 * (1 - smoothstep(170, 240, r));

  // göl: mesanın ön kenarında karst çukuru
  const gd = Math.hypot(x - DUNYA.golMerkez.x, z - DUNYA.golMerkez.z);
  h -= smoothstep(DUNYA.golYaricap * 1.35, 0, gd) * 62;

  // kule kaideleri biraz yükseltilir ki kuleler platoya otursun
  for (const k of DUNYA.kuleler) {
    const kd = Math.hypot(x - k.x, z - k.z);
    h += smoothstep(k.tabanR * 2.2, 0, kd) * 18;
  }
  return h;
}

export function kurArazi() {
  const grup = new THREE.Group();
  const boyut = 2600, seg = 400;
  const geo = new THREE.PlaneGeometry(boyut, boyut, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, zeminY(x, z));
  }
  geo.computeVertexNormals();
  const mat = kayaMateryali({ karCizgisi: 96, sicakYansima: 0.05 });
  const plato = new THREE.Mesh(geo, mat);
  plato.name = 'plato';
  grup.add(plato);

  // Etek: 1300 m'de biten zeminin sert kenarını kapatır; sisle ufka karışır.
  const etekGeo = new THREE.RingGeometry(1260, 6200, 160, 1);
  etekGeo.rotateX(-Math.PI / 2);
  const etekUniforms = {
    uKamera: { value: new THREE.Vector3() },
    uTaban: { value: new THREE.Color(0.050, 0.072, 0.118) },
    uZaman: { value: 0 },
    // HAVA fonksiyonu bu üç uniform'u okur; eksikse GLSL'de 0 olur ve etek SİYAH'a karışır
    // (ufukta koyu yatay şerit). Dünyanın diğer shader'larıyla aynı sis renkleri verilir.
    uUfukRenk: { value: new THREE.Color(0.135, 0.165, 0.285) },
    uSisBas: { value: DUNYA.sisBaslangic },
    uSisBit: { value: DUNYA.sisBitis }
  };
  const etekMat = new THREE.ShaderMaterial({
    uniforms: etekUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDunya;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDunya = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uKamera; uniform vec3 uTaban; uniform float uZaman;
      varying vec3 vDunya;
      ${NOISE}
      ${HAVA}
      void main() {
        float n = vnoise(vec3(vDunya.x * 0.004, 1.7, vDunya.z * 0.004));
        float n2 = vnoise(vec3(vDunya.x * 0.02, 3.1, vDunya.z * 0.02));
        vec3 renk = uTaban * (0.80 + 0.40 * n) * (0.90 + 0.20 * n2);
        renk = havaPerspektifi(renk, length(vDunya - uKamera));
        // uzak kenar yumuşak sönsün: ufukta sert bir şerit kalmasın
        float alfa = 1.0 - smoothstep(2800.0, 6000.0, length(vDunya.xz));
        gl_FragColor = vec4(renk, alfa);
      }
    `
  });
  etekMat.userData.kameraGuncelle = (kamera) => { etekUniforms.uKamera.value.copy(kamera.position); };
  const etek = new THREE.Mesh(etekGeo, etekMat);
  etek.position.y = -336;
  etek.name = 'etek';
  grup.add(etek);

  grup.add(uzakDaglar());
  return { grup, malzeme: mat, etekMalzeme: etekMat };
}

// Uzak dağ siluetleri: iki halka, ridged gürültüyle. Kar çizgisi kulelerle aynı eğilimde.
function uzakDaglar() {
  const g = new THREE.Group();

  const halka = (yaricap, tabanY, yukMax, tohum, opak) => {
    const N = 320;
    const poz = [], idx = [], uv = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const cx = Math.cos(a) * yaricap, cz = Math.sin(a) * yaricap;
      const n = ridged3(cx * 0.0009 + tohum, tohum * 3.1, cz * 0.0009, 5);
      const n2 = fbm3(cx * 0.004 + tohum, 1.0, cz * 0.004, 3);
      const h = tabanY + yukMax * (0.35 + 0.65 * n) * (0.7 + 0.6 * n2);
      poz.push(cx, tabanY, cz);          // alt
      poz.push(cx, h, cz);               // üst
      uv.push(i / N, 0.0, i / N, 1.0);
      if (i < N) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(poz, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const uniforms = {
      uKamera: { value: new THREE.Vector3() },
      uUfukRenk: { value: new THREE.Color(0.135, 0.165, 0.285) },
      uSisBas: { value: 900 },
      uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
      uKarCizgisi: { value: DUNYA.karCizgisi },
      uOpak: { value: opak }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vDunya; varying vec2 vUv;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vDunya = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp; }
      `,
      fragmentShader: NOISE + HAVA + `
        varying vec3 vDunya; varying vec2 vUv;
        uniform vec3 uKamera; uniform vec3 uGunesYon;
        uniform float uKarCizgisi; uniform float uOpak;
        void main(){
          float yuk = vDunya.y;
          vec3 dip = mix(vec3(0.050,0.078,0.140), vec3(0.085,0.125,0.215), smoothstep(-260.0, 120.0, yuk));
          float kar = smoothstep(uKarCizgisi - 20.0, uKarCizgisi + 70.0, yuk);
          // dağın güneşe bakan yüzünde alçak sıcak kenar
          vec3 dis = normalize(vec3(vDunya.x, 0.0, vDunya.z) + vec3(0.0001));
          float kenar = pow(max(0.0, dot(dis, normalize(vec3(uGunesYon.x, 0.0, uGunesYon.z)))), 2.0);
          vec3 karRenk = vec3(0.46,0.55,0.72) * (0.75 + 0.35 * kenar);
          vec3 renk = mix(dip, karRenk, kar * 0.8);
          renk += vec3(0.30,0.16,0.09) * kenar * smoothstep(-120.0, 240.0, yuk) * 0.35;
          float mesafe = length(vDunya - uKamera);
          renk = havaPerspektifi(renk, mesafe);
          gl_FragColor = vec4(renk, uOpak);
        }
      `
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    return m;
  };

  g.add(halka(3300, -280, 620, 4.2, 1.0));
  g.add(halka(2100, -280, 430, 19.7, 1.0));
  return g;
}
