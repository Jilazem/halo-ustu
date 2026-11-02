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
