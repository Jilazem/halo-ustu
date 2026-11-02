// Mavi saat gökyüzü: gradyan + ufuk ardında güneş halesi + yüksek ince bulut + yıldızlar + hilal.
// Tamamen prosedürel; hiçbir HDR/doku dosyası yok.
import * as THREE from 'three';
import { NOISE, GOKYUZU_FN } from './glsl.js';
import { GUNES } from './world.js';

export function kurGokyuzu() {
  const geo = new THREE.SphereGeometry(7000, 72, 44);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uGunesYon: { value: new THREE.Vector3(GUNES.x, GUNES.y, GUNES.z) },
      uZaman: { value: 0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: NOISE + GOKYUZU_FN + `
      varying vec3 vDir;
      uniform float uZaman;
      void main(){
        vec3 dir = normalize(vDir);
        vec3 c = gokyuzuRenk(dir);
        vec3 gunesYatay = normalize(vec3(uGunesYon.x, 0.0, uGunesYon.z));

        // batmış güneşin ufuk ardındaki halesi: alçak, geniş, sıcak
        float azimut = max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z) + vec3(0.0001)), gunesYatay));
        float yukari = exp(-pow(max(0.0, dir.y) * 7.0, 2.0));
        c += vec3(1.00, 0.52, 0.26) * pow(azimut, 8.0) * yukari * 0.75;
        c += vec3(0.55, 0.32, 0.24) * pow(azimut, 2.0) * yukari * 0.20;

        // yüksek ince bulut şeritleri (prosedürel fbm, dünyada paralaks yok)
        float yuk = smoothstep(0.03, 0.55, dir.y);
        vec2 pl = dir.xz / max(0.10, abs(dir.y) + 0.18);
        float serit = fbm3(vec3(pl * 0.42, uZaman * 0.004));
        float ince = smoothstep(0.54, 0.88, serit) * yuk * 0.45;
        vec3 seritRenk = mix(vec3(0.14, 0.17, 0.27), vec3(0.68, 0.44, 0.34),
                             pow(max(0.0, dot(dir, uGunesYon)), 3.0));
        c = mix(c, seritRenk, ince);

        // yıldızlar: mavi saatte üst gökyüzünde soluk, ufka yakın söner
        float yildiz = step(0.9972, hash13(dir * 460.0)) * smoothstep(0.10, 0.55, dir.y);
        c += vec3(0.82, 0.88, 1.0) * yildiz * 0.75;
        float yildiz2 = step(0.99955, hash13(dir * 190.0)) * smoothstep(0.05, 0.40, dir.y);
        c += vec3(1.0, 0.95, 0.88) * yildiz2 * 1.10;

        // hilal: güneşten uzakta, yüksek gökyüzünde ince bir dilim
        vec3 ayYon = normalize(vec3(-0.25, 0.22, -0.94));
        float ayMesafe = length(dir - ayYon);
        float ayDisk = smoothstep(0.0155, 0.0135, ayMesafe);
        // dilim: ikinci bir daireyle oyulur
        vec3 oyma = normalize(ayYon + vec3(0.010, 0.006, 0.0));
        float oymaDisk = smoothstep(0.0155, 0.0135, length(dir - oyma));
        float hilal = clamp(ayDisk - oymaDisk, 0.0, 1.0);
        c += vec3(1.0, 0.96, 0.86) * hilal * 1.35;
        c += vec3(0.40, 0.48, 0.66) * pow(max(0.0, dot(dir, ayYon)), 90.0) * 0.20;

        // ufkun altı: atmosfer sisi (boşluk görünmesin)
        c = mix(c, vec3(0.075, 0.100, 0.175), 1.0 - smoothstep(-0.12, 0.02, dir.y));
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return { mesh, mat };
}
