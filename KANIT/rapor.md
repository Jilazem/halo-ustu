# HALO ÜSTÜ — canlı yayın doğrulama raporu

Tarih: 2 Kasım 2026 · Profil: cd-coder
Canlı adres: https://jilazem.github.io/halo-ustu/
Depo: git@github.com:Jilazem/halo-ustu.git · HEAD: 1d8d0e3
Ölçüm tarayıcısı: Google Chrome 156.0.8078.80 (macOS), gerçek başsız-olmayan pencere + CDP.

## 1. HTTP erişimi (curl, canlı)

| Yol | Durum | Boyut |
|---|---|---|
| `/` | 200 text/html | 2 407 B |
| `/src/main.js` | 200 application/javascript | 8 760 B |
| `/src/controls.js` | 200 application/javascript | 8 139 B |
| `/src/world.js` | 200 application/javascript | 893 B |
| `/vendor/three.module.js` | 200 application/javascript | 658 900 B |
| `/favicon.ico` | 404 (sayfa çalışmasını etkilemez) | — |

Harici CDN çağrısı yok; three.js yerelden (`vendor/`) yükleniyor.

## 2. Sahne gerçekten çiziliyor mu (WebGL)

- Bağlam: WebGL 2.0 (OpenGL ES 3.0 Chromium), 1600×900.
- `readPixels` ile 9 noktadan örnek: 9/9 siyah değil (gerçek piksel üretimi var).
- Sahne durumu: 412 çizim çağrısı, 415 170 üçgen, 11 doku, 196 geometri, hacimli bulut 400×225 / 30 adım / 24 birikim.
- Kare: `KANIT/canli-genis.png` (1 613 184 B), mobil: `KANIT/canli-mobil.png` (1 182 515 B). Kareler gözle de kontrol edildi: kuleler, halka restoran/köprü, göl, bulut denizi ve HUD okunur durumda; siyah şerit/boşluk yok.

## 3. Performans

| Ölçüm | Sonuç |
|---|---|
| 1600×900 masaüstü | 60.1 fps, 16.6 ms/kare (3.01 s, 181 kare) |
| CPU çizim süresi | 0.39 ms/kare (20 örnek) — GPU'ya bağlı (vsync sınırı) |
| 390×844 mobil emülasyon | 60.2 fps, 16.6 ms/kare, dpr 1.5 |

## 4. Kontroller (her biri kamerayı gerçekten değiştirdi mi)

| Girdi | Önce (kamera) | Sonra | Sonuç |
|---|---|---|---|
| Sürükle-orbit | [-187.7, 102.7, 164.9] | [-239.0, 42.3, -28.6] | çalıştı |
| Tekerlek zoom | [-239.0, 42.3, -28.6] | [-301.0, 24.7, -36.1] | çalıştı |
| W | [-187.7, 102.7, 164.9] | [-94.3, 102.7, 82.9] | çalıştı (124.3 m) |
| A | [-187.7, 102.7, 164.9] | [-210.9, 102.7, 138.6] | çalıştı (35.1 m) |
| S | [-187.7, 102.7, 164.9] | [-214.1, 102.7, 188.1] | çalıştı (35.1 m) |
| D | [-187.7, 102.7, 164.9] | [-164.9, 102.7, 190.9] | çalıştı (34.6 m) |
| Q | [-187.7, 102.7, 164.9] | [-187.7, 136.5, 164.9] | çalıştı (33.8 m) |
| E | [-187.7, 102.7, 164.9] | [-187.7, 70.2, 164.9] | çalıştı (32.5 m) |
| Shift (1.2 s) | normal 35.0 m | shift 141.9 m | 4× hız doğrulandı |
| 1–9, 0 görünümleri | — | 10/10 kamerayı değiştirdi | HUD etiketi de 10/10 doğru |
| V sinema | [40.0, 125.3, 98.1] | [-262.8, -13.5, 287.5] | açıldı; ikinci V kapattı |

W ölçümünde tek koşuda 124.3 m (Shift hızı) görüldü; odaklı tekrar koşusunda (4 deneme, 1.0 s basılı) 27.2 / 29.4 / 29.8 / 29.8 m ölçüldü — 26 m/s nominal hızla tutarlı. Aradaki fark otomasyon tuş durumu artığı olarak değerlendirildi; canlı kullanımda W normal hızda çalışıyor.

## 5. Konsol ve hatalar

- Yakalanmamış istisna yok, `SAHNE.bilgi().hatalar` boş.
- Yalnız iki uyarı: `THREE.Clock` kullanımdan kaldırıldı (işlevsel etkisi yok) ve `/favicon.ico` 404.

## 6. Doğrulama sırasında bulunan ve düzeltilen kusur

- Belirti: 1–9/0 tuşlarıyla görünüm değişince kamera değişiyor ama HUD'daki görünüm etiketi eski adda kalıyordu.
- Kök neden: `src/controls.js` kendi içindeki `gorunumAyarla` kapanışını çağırıyor; `src/main.js`'teki HUD güncelleyen sarmalayıcı devreye girmiyordu.
- Düzeltme (commit 1d8d0e3): kare döngüsünde `SAHNE.kontrol.durum.gorunumAdi` ile etiket metni karşılaştırılıp eşitleniyor.
- Kanıt: yayın güncellendikten sonraki taze profil koşusunda 10 görünümün 10'unda HUD etiketi görünüm adıyla aynı; ayrıca 7/2/5 tuşları için etiket "UZAK — atmosfer", "HALKA YAKIN — köprü ağzı", "GÖL KIYISI" olarak doğrulandı.

## 7. Kalan riskler ve notlar

- Ölçüm macOS Chrome 156 ile yapıldı; Win11 tarayıcı/GPU sınaması ayrıca gerekir.
- 390×844'te alt HUD kontrol satırı iki satıra kırılıyor ve "Shift hız" kelime ortasından bölünüyor — kozmetik, engel değil.
- `favicon.ico` yok (404); sayfa işlevini etkilemiyor.
- `THREE.Clock` uyarısı ileride `THREE.Timer`'a geçiş gerektirir.

## 8. Yeniden üretim

```bash
cd /Volumes/EX/007-HERMES-M4-LIVE/20-HERMES/cache/scratch/halo-ustu-yayin
python3 arac/cdp_dogrula.py --url https://jilazem.github.io/halo-ustu/ --outdir "$PWD/KANIT"
```

Ham JSON: `KANIT/cdp-dogrulama.json`. HUD odaklı inceleme: `arac/hud_incele.py`.
