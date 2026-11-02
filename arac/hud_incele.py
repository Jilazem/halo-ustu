#!/usr/bin/env python3
"""HUD etiketi ve kontrol sözlüğü için odaklı CDP incelemesi."""
import json, os, subprocess, sys, time
sys.path.insert(0, "/Volumes/EX/007-HERMES-M4-LIVE/20-HERMES/cache/scratch/halo-ustu-yayin/arac")
from cdp_dogrula import CDP, http_json, CHROME, bekle

K = "/Volumes/EX/007-HERMES-M4-LIVE/20-HERMES/cache/scratch/halo-ustu-yayin/KANIT"
profil = K + "/chrome-prof-hud"
ch = subprocess.Popen([CHROME, "--remote-debugging-port=9334", f"--user-data-dir={profil}",
                       "--no-first-run", "--no-default-browser-check", "--window-size=1600,900",
                       "--window-position=40,40", "about:blank"],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        http_json("http://127.0.0.1:9334/json/version", 2); break
    except Exception:
        time.sleep(0.5)
hedef = [t for t in http_json("http://127.0.0.1:9334/json/list") if t["type"] == "page"][0]
c = CDP(hedef["webSocketDebuggerUrl"])
out = {}
try:
    c.cmd("Page.enable"); c.cmd("Runtime.enable")
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    c.cmd("Page.navigate", {"url": "https://jilazem.github.io/halo-ustu/"})
    bekle(c, "!!(window.SAHNE && window.SAHNE.hazir && window.SAHNE.bilgi().kare > 25)", 120)
    out["scripts"] = c.eval("[...document.scripts].map(s => s.src)")
    out["main_icerik_var"] = c.eval("fetch('src/main.js').then(r => r.text()).then(t => t.includes('gEtiket'))")
    time.sleep(1)
    out["main_icerik_var"] = c.eval("fetch('src/main.js').then(r=>r.text()).then(t=>t.includes('gEtiket'))", await_promise=True)
    out["kontrol_anahtar"] = c.eval("window.SAHNE.kontrol ? Object.keys(window.SAHNE.kontrol) : null")
    out["durum_anahtar"] = c.eval("window.SAHNE.kontrol ? Object.keys(window.SAHNE.kontrol.durum) : null")
    out["once"] = {"hud": c.eval("document.getElementById('gorunumAdi').textContent"),
                   "bilgi": c.eval("window.SAHNE.bilgi().gorunum"),
                   "durum": c.eval("window.SAHNE.kontrol ? window.SAHNE.kontrol.durum.gorunumAdi : window.SAHNE.bilgi().gorunum")}
    for d in ["7", "2", "5"]:
        vk = 48 + int(d)
        c.cmd("Input.dispatchKeyEvent", {"type": "keyDown", "key": d, "code": "Digit" + d,
                                         "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk})
        c.cmd("Input.dispatchKeyEvent", {"type": "keyUp", "key": d, "code": "Digit" + d,
                                         "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk})
        time.sleep(2.0)
        out["tus_" + d] = {"hud": c.eval("document.getElementById('gorunumAdi').textContent"),
                           "bilgi": c.eval("window.SAHNE.bilgi().gorunum"),
                           "durum": c.eval("window.SAHNE.kontrol ? window.SAHNE.kontrol.durum.gorunumAdi : window.SAHNE.bilgi().gorunum")}
    out["hud_eleman"] = c.eval("(() => {const e = document.getElementById('gorunumAdi'); return e ? {id: e.id, cls: e.className, html: e.outerHTML.slice(0,200)} : null})()")
finally:
    c.kapat(); ch.terminate()
print(json.dumps(out, ensure_ascii=False, indent=1))
