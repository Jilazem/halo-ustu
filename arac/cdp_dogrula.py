#!/usr/bin/env python3
"""Gerçek Chrome + CDP ile canlı WebGL sahnesi doğrulaması.

Ne yapar: Chrome'u ayrı bir profil ve hata ayıklama portuyla başlatır, verilen URL'yi
açar, konsol hatalarını toplar, WebGL2/piksel örnekleri alır, rAF tabanlı fps ölçer,
fare/klavye girdilerini gerçek CDP olaylarıyla gönderip kamera durumunu karşılaştırır,
1600x900 ve 390x844 ekran görüntülerini kaydeder. Sonucu JSON olarak yazar.

Kullanım:
  python3 cdp_dogrula.py --url https://... --outdir /yol/KANIT [--port 9333] [--headless]
"""
import argparse, base64, json, os, shutil, subprocess, sys, time, urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def http_json(url, timeout=5):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read().decode())


class CDP:
    def __init__(self, ws_url, timeout=45):
        import websocket
        self.ws = websocket.create_connection(ws_url, timeout=timeout, max_size=64 * 1024 * 1024)
        self.id = 0
        self.konsol = []
        self.istisna = []
        self.log = []

    def cmd(self, method, params=None, timeout=45):
        self.id += 1
        mid = self.id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        bitis = time.time() + timeout
        while time.time() < bitis:
            self.ws.settimeout(max(1, bitis - time.time()))
            try:
                m = json.loads(self.ws.recv())
            except Exception as e:
                if "timed out" in str(e).lower():
                    continue
                raise
            if m.get("id") == mid:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})
            self._olay(m)
        raise TimeoutError(f"zaman aşımı: {method}")

    def _olay(self, m):
        y = m.get("method")
        p = m.get("params", {})
        if y == "Runtime.consoleAPICalled" and p.get("type") in ("error", "warning", "assert"):
            self.konsol.append(p["type"] + ": " + " ".join(
                str(a.get("value", a.get("description", ""))) for a in p.get("args", [])))
        elif y == "Runtime.exceptionThrown":
            d = p.get("exceptionDetails", {})
            self.istisna.append((d.get("exception") or {}).get("description") or d.get("text", ""))
        elif y == "Log.entryAdded":
            e = p.get("entry", {})
            if e.get("level") in ("error", "warning"):
                self.log.append(e.get("level") + ": " + str(e.get("text")) + " " + str(e.get("url", "")))

    def eval(self, expr, await_promise=False, timeout=45):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True,
                                          "awaitPromise": await_promise, "userGesture": True}, timeout)
        if "exceptionDetails" in r:
            raise RuntimeError("eval hatası: " + json.dumps(r["exceptionDetails"])[:300])
        return r.get("result", {}).get("value")

    def kapat(self):
        try:
            self.ws.close()
        except Exception:
            pass


def bekle(cdp, kosul, sure=90, adim=1.0):
    son = None
    for _ in range(int(sure / adim)):
        try:
            v = cdp.eval(kosul)
            son = v
            if v:
                return v
        except Exception as e:
            son = repr(e)
        time.sleep(adim)
    return son


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--port", default="9333")
    ap.add_argument("--headless", action="store_true")
    ap.add_argument("--profil", default=None)
    a = ap.parse_args()

    os.makedirs(a.outdir, exist_ok=True)
    profil = a.profil or os.path.join(a.outdir, "chrome-prof")
    R = {"url": a.url, "zaman": time.strftime("%Y-%m-%d %H:%M:%S"), "port": a.port,
         "headless": a.headless}

    # 1) Chrome'u başlat (port hazırsa yeniden kullan)
    chrome = None
    try:
        http_json(f"http://127.0.0.1:{a.port}/json/version", 2)
    except Exception:
        args = [CHROME, f"--remote-debugging-port={a.port}", f"--user-data-dir={profil}",
                "--no-first-run", "--no-default-browser-check", "--window-size=1600,900",
                "--window-position=40,40", "--disable-features=Translate",
                "about:blank"]
        if a.headless:
            args.insert(1, "--headless=new")
        chrome = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try:
                R["tarayici"] = http_json(f"http://127.0.0.1:{a.port}/json/version", 2)
                break
            except Exception:
                time.sleep(0.5)
    if "tarayici" not in R:
        R["tarayici"] = http_json(f"http://127.0.0.1:{a.port}/json/version", 5)

    # 2) Hedef sekme
    hedefler = [t for t in http_json(f"http://127.0.0.1:{a.port}/json/list") if t["type"] == "page"]
    if not hedefler:
        hedefler = [http_json(f"http://127.0.0.1:{a.port}/json/new?about:blank")]
    hedef = hedefler[0]
    cdp = CDP(hedef["webSocketDebuggerUrl"])

    try:
        cdp.cmd("Page.enable")
        cdp.cmd("Runtime.enable")
        cdp.cmd("Log.enable")
        cdp.cmd("Emulation.setDeviceMetricsOverride", {"width": 1600, "height": 900,
                                                       "deviceScaleFactor": 1, "mobile": False})
        cdp.cmd("Page.bringToFront")
        cdp.cmd("Page.navigate", {"url": a.url})
        hazir = bekle(cdp, "!!(window.SAHNE && window.SAHNE.hazir && window.SAHNE.bilgi().kare > 25)", 120)
        R["hazir"] = bool(hazir)
        R["bilgi"] = cdp.eval("window.SAHNE ? window.SAHNE.bilgi() : null")
        R["href"] = cdp.eval("location.href")
        R["ekran"] = cdp.eval("[innerWidth, innerHeight, devicePixelRatio, document.querySelector('#tuval').width, document.querySelector('#tuval').height]")
        R["hata_kutusu"] = cdp.eval("document.getElementById('hata').textContent")

        # 3) WebGL2 + piksel örnekleri
        R["gl"] = cdp.eval("""(() => {
          const c = document.querySelector('#tuval'); const g = c.getContext('webgl2');
          if (!g) return {gl2: false};
          const w = c.width, h = c.height, buf = new Uint8Array(4), out = [];
          for (const [x, y] of [[w>>1,h>>1],[w>>2,h>>2],[3*w>>2,h>>2],[w>>2,3*h>>2],[3*w>>2,3*h>>2],[10,10],[w-10,h-10],[10,h-10],[w-10,10]]) {
            g.readPixels(x, y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, buf);
            out.push([x, y, [buf[0], buf[1], buf[2]]]);
          }
          return {gl2: true, surum: g.getParameter(g.VERSION), renderer: g.getParameter(g.RENDERER),
                  saglayici: g.getParameter(g.UNMASKED_RENDERER_WEBGL || g.RENDERER), boyut: [w, h],
                  ornekler: out, siyahOlmayan: out.filter(p => p[2][0]+p[2][1]+p[2][2] > 6).length};
        })()""")

        # 4) fps: 3 sn ısınma sonrası 3 sn ölçüm
        cdp.eval("window.SAHNE.gorunum(0)")
        time.sleep(3)
        k0 = cdp.eval("window.SAHNE.bilgi().kare")
        R["fps"] = cdp.eval("window.SAHNE.olc(3000)", await_promise=True, timeout=60)
        k1 = cdp.eval("window.SAHNE.bilgi().kare")
        R["kare_sayaci"] = {"bas": k0, "son": k1}
        R["olcCpu"] = cdp.eval("window.SAHNE.olcCpu(20)")

        # 5) Kontroller (gerçek CDP girdileri)
        def kam():
            return cdp.eval("window.SAHNE.bilgi().kamera")
        def tus(tip, k, kod, vk):
            cdp.cmd("Input.dispatchKeyEvent", {"type": tip, "key": k, "code": kod,
                                               "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk})
        def fare(tip, x, y, **kw):
            p = {"type": tip, "x": x, "y": y}
            p.update(kw)
            cdp.cmd("Input.dispatchMouseEvent", p)

        K = {}
        cdp.eval("window.SAHNE.gorunum(0)"); time.sleep(2)
        b = kam()
        fare("mousePressed", 800, 450, button="left", buttons=1, clickCount=1)
        for i in range(1, 11):
            fare("mouseMoved", 800 + i * 20, 450 - i * 7, button="left", buttons=1)
        fare("mouseReleased", 1000, 380, button="left", buttons=0, clickCount=1)
        time.sleep(1.5); A = kam()
        K["surukle_orbit"] = {"once": b, "sonra": A, "calisti": b != A}

        b = A
        fare("mouseMoved", 800, 450, buttons=0)
        for d in (120, 120, 120):
            fare("mouseWheel", 800, 450, deltaX=0, deltaY=d); time.sleep(0.2)
        time.sleep(1.5); A = kam()
        K["tekerlek_zoom"] = {"once": b, "sonra": A, "calisti": b != A}

        import math
        for ad, k, kod, vk in [("W", "w", "KeyW", 87), ("A", "a", "KeyA", 65), ("S", "s", "KeyS", 83),
                               ("D", "d", "KeyD", 68), ("Q", "q", "KeyQ", 81), ("E", "e", "KeyE", 69)]:
            cdp.eval("window.SAHNE.gorunum(0)"); time.sleep(2)
            b = kam()
            tus("keyDown", k, kod, vk); time.sleep(1.2); tus("keyUp", k, kod, vk)
            time.sleep(0.8); A = kam()
            K["tus_" + ad] = {"once": b, "sonra": A, "calisti": b != A,
                              "yol_m": round(math.dist(b, A), 1)}

        cdp.eval("window.SAHNE.gorunum(0)"); time.sleep(2); b = kam()
        tus("keyDown", "w", "KeyW", 87); time.sleep(1.2); tus("keyUp", "w", "KeyW", 87)
        time.sleep(0.8); n1 = kam()
        cdp.eval("window.SAHNE.gorunum(0)"); time.sleep(2); b = kam()
        tus("keyDown", "Shift", "ShiftLeft", 16); tus("keyDown", "w", "KeyW", 87)
        time.sleep(1.2); tus("keyUp", "w", "KeyW", 87); tus("keyUp", "Shift", "ShiftLeft", 16)
        time.sleep(0.8); n2 = kam()
        K["shift_hiz"] = {"normal_m": round(math.dist(b, n1), 1), "shift_m": round(math.dist(b, n2), 1)}

        gl = []
        for d in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]:
            vk = 48 + (int(d) if d != "0" else 0)
            b = kam()
            tus("keyDown", d, "Digit" + d, vk); tus("keyUp", d, "Digit" + d, vk)
            time.sleep(2.0); A = kam()
            gl.append({"tus": d, "gorunum": cdp.eval("window.SAHNE.bilgi().gorunum"),
                       "kamera_degisti": b != A, "kamera": A,
                       "hud_etiketi": cdp.eval("document.getElementById('gorunumAdi').textContent")})
        K["gorunumler"] = gl

        b = kam()
        tus("keyDown", "v", "KeyV", 86); tus("keyUp", "v", "KeyV", 86)
        time.sleep(2.5); A = kam()
        s1 = cdp.eval("window.SAHNE.bilgi().sinema")
        tus("keyDown", "v", "KeyV", 86); tus("keyUp", "v", "KeyV", 86)
        time.sleep(0.8)
        K["sinema_V"] = {"acik": s1, "kamera_degisti": b != A, "once": b, "sonra": A,
                         "kapatildi": cdp.eval("window.SAHNE.bilgi().sinema")}
        R["kontroller"] = K

        # 6) Konsol / istisna
        R["konsol"] = cdp.konsol
        R["istisna"] = cdp.istisna
        R["log"] = cdp.log
        R["sahne_hatalar"] = cdp.eval("window.SAHNE.hatalar")

        # 7) 1600x900 kare
        cdp.eval("window.SAHNE.gorunum(0)"); time.sleep(3)
        d = cdp.cmd("Page.captureScreenshot", {"format": "png"})["data"]
        p = os.path.join(a.outdir, "canli-genis.png")
        open(p, "wb").write(base64.b64decode(d))
        R["kare_genis"] = {"yol": p, "bayt": os.path.getsize(p)}

        # 8) 390x844 mobil emülasyon
        cdp.cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844,
                                                       "deviceScaleFactor": 2, "mobile": True})
        cdp.cmd("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
        cdp.cmd("Page.reload", {"ignoreCache": False})
        mh = bekle(cdp, "!!(window.SAHNE && window.SAHNE.hazir && window.SAHNE.bilgi().kare > 15)", 120)
        time.sleep(3)
        R["mobil"] = {"hazir": bool(mh), "bilgi": cdp.eval("window.SAHNE ? window.SAHNE.bilgi() : null"),
                      "ekran": cdp.eval("[innerWidth, innerHeight, devicePixelRatio, document.querySelector('#tuval').width, document.querySelector('#tuval').height]")}
        d = cdp.cmd("Page.captureScreenshot", {"format": "png"})["data"]
        p = os.path.join(a.outdir, "canli-mobil.png")
        open(p, "wb").write(base64.b64decode(d))
        R["kare_mobil"] = {"yol": p, "bayt": os.path.getsize(p)}
        R["konsol_mobil"] = cdp.konsol[len(R.get("konsol", [])):]
        R["istisna_mobil"] = cdp.istisna[len(R.get("istisna", [])):]
    finally:
        cdp.kapat()
        json.dump(R, open(os.path.join(a.outdir, "cdp-dogrulama.json"), "w"), ensure_ascii=False, indent=1)
        if chrome:
            chrome.terminate()
            try:
                chrome.wait(timeout=10)
            except Exception:
                chrome.kill()
    print(json.dumps(R, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
