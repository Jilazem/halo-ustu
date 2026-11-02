// Paylaşılan GLSL parçaları. Hepsi prosedürel — harici doku yok.
export const NOISE = `
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i + vec3(0.0,0.0,0.0)), hash13(i + vec3(1.0,0.0,0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0,1.0,0.0)), hash13(i + vec3(1.0,1.0,0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0,0.0,1.0)), hash13(i + vec3(1.0,0.0,1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0,1.0,1.0)), hash13(i + vec3(1.0,1.0,1.0)), f.x);
  float e = mix(a, b, f.y);
  float g = mix(c, d, f.y);
  return mix(e, g, f.z);
}
float fbm3(vec3 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
float ridged3(vec3 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++){
    float n = vnoise(p);
    n = 1.0 - abs(n * 2.0 - 1.0);
    s += a * n * n;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`;

// Hava perspektifi: mesafeyle ufuk rengine karışma (sis). Tüm dünya shader'ları kullanır.
export const HAVA = `
uniform vec3 uUfukRenk;
uniform float uSisBas;
uniform float uSisBit;
vec3 havaPerspektifi(vec3 renk, float mesafe){
  float t = 1.0 - exp(-max(0.0, mesafe - uSisBas) * 0.00042);
  return mix(renk, uUfukRenk, clamp(t, 0.0, 1.0));
}
`;

// Gökyüzü renk fonksiyonu — gökyüzü, göl ve atmosfer aynı fonksiyonu kullanır.
export const GOKYUZU_FN = `
uniform vec3 uGunesYon;
vec3 gokyuzuRenk(vec3 dir){
  float h = clamp(dir.y, -1.0, 1.0);
  float hh = max(h, 0.0);
  vec3 zenit = vec3(0.022, 0.048, 0.115);
  vec3 orta  = vec3(0.052, 0.125, 0.265);
  vec3 ufuk  = vec3(0.190, 0.230, 0.350);
  vec3 c = mix(ufuk, orta, smoothstep(0.0, 0.30, hh));
  c = mix(c, zenit, smoothstep(0.30, 0.95, hh));
  // ufuk ardında güneş: alçak açıda sıcak hale
  float sd = max(0.0, dot(dir, uGunesYon));
  float alcal = 1.0 - smoothstep(0.0, 0.50, hh);
  c += vec3(0.95, 0.42, 0.16) * pow(sd, 4.0) * alcal * 0.95;
  c += vec3(1.00, 0.62, 0.28) * pow(sd, 30.0) * alcal * 1.60;
  c += vec3(0.55, 0.28, 0.16) * pow(sd, 1.6) * 0.16;
  // ufuk bandı (atmosfer kalınlığı)
  c += vec3(0.10, 0.09, 0.13) * exp(-abs(h) * 26.0);
  return c;
}
`;

export const TAM_EKRAN_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
