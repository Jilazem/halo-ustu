# HALO ÜSTÜ — bulut denizinin üzerinde halka restoran

Three.js (r1xx) ile yazılmış, tek sayfalık WebGL2 sahnesi. Kuleler, halka restoran,
göl, hacimli bulut denizi ve post-process (bloom/tonemap) zinciri tarayıcıda çalışır.

## Canlı yayın

- https://jilazem.github.io/halo-ustu/

GitHub Pages üzerinden `main` dalından yayınlanır. Harici CDN yoktur; `three`
kütüphanesi `vendor/` altından yerel olarak yüklenir.

## Yerel çalıştırma

```bash
cd halo-ustu-yayin
python3 -m http.server 8899
# tarayıcı: http://127.0.0.1:8899/
```

`file://` ile açmak çalışmaz: ES modülleri ve importmap HTTP başlığı ister.

## Kontroller

| Girdi | İşlev |
|---|---|
| Sürükle (fare/dokunma) | Yörüngede döndür |
| Tekerlek / iki parmak | Yaklaş / uzaklaş |
| WASD | Hedef noktasını gez |
| Q / E | Yüksel / alçal |
| Shift | 4× hız |
| 1–9, 0 | Hazır görünümler (GENİŞ AÇI … KÖPRÜ 2) |
| V | Sinema kamerası (kapalı eğri) |

## Yapı

```
index.html            giriş, importmap, HUD
src/main.js           montaj, render döngüsü, ölçüm, window.SAHNE otomasyon kapısı
src/controls.js       orbit + görünümler + sinema + gezinme
src/{sky,terrain,towers,ring,water,clouds,post,kaya,glsl,proc,world,butce}.js
vendor/three.module.js  three.js (ES modül)
vendor/three.core.js    three.js çekirdek (three.module.js bağımlılığı)
```

## Otomasyon kapısı

Konsolda `window.SAHNE` hazır sahne nesnelerini, `bilgi()`, `olc(ms)` ve `olcCpu(n)`
ölçümlerini sunar; CDP tabanlı doğrulama betikleri bunu kullanır.

## Doğrulama (canlı yayın)

`arac/cdp_dogrula.py` gerçek Chrome'u CDP ile sürerek canlı URL'yi ölçer
(`python3 arac/cdp_dogrula.py --url https://jilazem.github.io/halo-ustu/ --outdir KANIT`).
Ham çıktı: `KANIT/cdp-dogrulama.json`, kareler: `KANIT/canli-genis.png`,
`KANIT/canli-mobil.png`, özet: `KANIT/rapor.md`.

| Ölçüm | Sonuç |
|---|---|
| HTTP | `/` 200, `src/*.js` 200, `vendor/three.module.js` 200 (658 KB) |
| WebGL | WebGL 2.0 (OpenGL ES 3.0 Chromium), 1600×900, 9/9 örnek piksel siyah değil |
| Kare hızı | 1600×900'de 60.1 fps / 16.6 ms; 390×844'te 60.2 fps |
| CPU çizim | 0.39 ms/kare, 412 çizim çağrısı, 415 170 üçgen |
| Kontroller | orbit, tekerlek, WASD, Q/E, Shift 4×, 1–9/0 görünümleri, V sinema: hepsi kamerayı değiştirdi |
| Konsol | istisna yok; yalnız `THREE.Clock` kullanımdan kaldırma uyarısı ve `favicon.ico` 404 |

Not: ölçüm macOS Chrome ile yapılmıştır; Win11 tarayıcı sınaması ayrıca gerekir.

