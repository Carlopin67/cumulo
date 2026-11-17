// Monitor del sistema — tarjeta arriba a la derecha con CPU, RAM, VRAM, almacenamiento, red y Claude.
// Los datos salen de window.CUMULO_SYSTEM.read(). Si no existe, se usan datos simulados.
// Forma de cada lectura (lo único que tendrá que dar la versión instalable):
//   { cpu:   { usage %, cores, ghz, temp °C },
//     ram:   { used GB, total GB },
//     vram:  { used GB, total GB, gpuUsage %, temp °C },
//     disk:  { used GB, total GB, read MB/s, write MB/s },
//     net:   { down MB/s, up MB/s },
//     claude:{ processes, memory GB } }
(() => {
  "use strict";

  const el = document.getElementById("monitor");
  if (!el) return;
  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const nf = d => new Intl.NumberFormat("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d });
  const f0 = nf(0), f1 = nf(1);

  // ── datos simulados ─────────────────────────────────────────
  function simulator() {
    const st = { cpu: 16, burst: 0, ram: 13.4, vram: 4.6, gpu: 8, gburst: 0, disk: 612.4, down: 1.2, up: 0.2, cmem: 1.3 };
    const drift = (v, target, pull, noise) => v + (target - v) * pull + (Math.random() - 0.5) * noise;
    return {
      read() {
        if (Math.random() < 0.07) st.burst = 35 + Math.random() * 35;     // Claude compilando, tests…
        st.burst *= 0.78;
        st.cpu = clamp(drift(st.cpu, 14, 0.25, 9) + st.burst * 0.35, 3, 99);
        if (Math.random() < 0.05) st.gburst = 30 + Math.random() * 40;
        st.gburst *= 0.8;
        st.gpu = clamp(drift(st.gpu, 7, 0.3, 6) + st.gburst * 0.4, 0, 99);
        st.cmem = clamp(drift(st.cmem, 1.35, 0.1, 0.08), 0.8, 2.4);
        st.ram = clamp(drift(st.ram, 12.8 + st.cmem, 0.08, 0.35), 6, 31.5);
        st.vram = clamp(drift(st.vram, 4.4 + st.gpu * 0.03, 0.15, 0.12), 1, 11.8);
        st.disk += Math.random() * 0.004;
        st.down = clamp(drift(st.down, 1.4, 0.2, 2.2) * (Math.random() < 0.06 ? 4 : 1), 0.02, 48);
        st.up = clamp(drift(st.up, 0.25, 0.25, 0.4), 0.01, 12);
        return {
          cpu: { usage: st.cpu, cores: 8, ghz: 3.2 + st.cpu / 100 * 1.4, temp: 41 + st.cpu * 0.38 },
          ram: { used: st.ram, total: 32 },
          vram: { used: st.vram, total: 12, gpuUsage: st.gpu, temp: 38 + st.gpu * 0.35 },
          disk: { used: st.disk, total: 1000, read: Math.max(0, st.cpu * 2.2 + (Math.random() - 0.5) * 40), write: Math.max(0, st.cpu * 0.6 + (Math.random() - 0.5) * 12) },
          net: { down: st.down, up: st.up },
          claude: { processes: 2, memory: st.cmem },
        };
      },
    };
  }
  const simulated = !window.CUMULO_SYSTEM;
  const source = window.CUMULO_SYSTEM || simulator();

  // ── filas ───────────────────────────────────────────────────
  const gb = v => v >= 1000 ? `${f1.format(v / 1000)} TB` : `${f1.format(v)} GB`;
  const mbs = v => v >= 1000 ? `${f1.format(v / 1000)} GB/s` : v >= 10 ? `${f0.format(v)} MB/s` : `${f1.format(v)} MB/s`;
  // spark: lo que dibuja la gráfica; max: escala fija (null = se ajusta a lo visto)
  const ROWS = [
    { k: "cpu", label: "CPU", pct: d => d.cpu.usage, value: d => [f0.format(d.cpu.usage), " %"],
      spark: d => d.cpu.usage, max: () => 100,
      detail: d => `${d.cpu.cores} núcleos · ${f1.format(d.cpu.ghz)} GHz · ${f0.format(d.cpu.temp)} °C` },
    { k: "ram", label: "RAM", pct: d => d.ram.used / d.ram.total * 100, value: d => [f1.format(d.ram.used), ` / ${f0.format(d.ram.total)} GB`],
      spark: d => d.ram.used / d.ram.total * 100, max: () => 100,
      detail: d => `${f1.format(d.ram.total - d.ram.used)} GB libres` },
    { k: "vram", label: "VRAM", pct: d => d.vram.used / d.vram.total * 100, value: d => [f1.format(d.vram.used), ` / ${f0.format(d.vram.total)} GB`],
      spark: d => d.vram.gpuUsage, max: () => 100,
      detail: d => `GPU ${f0.format(d.vram.gpuUsage)} % · ${f0.format(d.vram.temp)} °C` },
    { k: "disk", label: "Disco", pct: d => d.disk.used / d.disk.total * 100, value: d => [f0.format(d.disk.used), ` / ${gb(d.disk.total)}`],
      spark: d => d.disk.read + d.disk.write, max: null,
      detail: d => `lee ${mbs(d.disk.read)} · escribe ${mbs(d.disk.write)}` },
    { k: "net", label: "Red", pct: null, value: d => [mbs(d.net.down), " ↓"],
      spark: d => d.net.down, max: null,
      detail: d => `sube ${mbs(d.net.up)}` },
    { k: "claude", label: "Claude", pct: null, value: d => [f1.format(d.claude.memory), " GB"],
      spark: d => d.claude.memory, max: null,
      detail: d => `${d.claude.processes} ${d.claude.processes === 1 ? "proceso" : "procesos"}` },
  ];

  const rowsEl = document.getElementById("monRows");
  const HIST = 60;
  ROWS.forEach((r, i) => {
    const d = document.createElement("div");
    d.className = "mrow";
    d.style.setProperty("--r", i);
    d.innerHTML = `
      <div class="mtop"><span class="mlabel mono"></span><span class="mval"><b></b><small></small></span></div>
      <canvas class="spark" aria-hidden="true"></canvas>
      <p class="mdetail mono"></p>`;
    d.querySelector(".mlabel").textContent = r.label;
    r.el = d; r.b = d.querySelector("b"); r.small = d.querySelector("small");
    r.detailEl = d.querySelector(".mdetail"); r.canvas = d.querySelector("canvas");
    r.hist = []; r.level = ""; r.peak = 0;
    rowsEl.appendChild(d);
  });

  // ── plegar / desplegar (se recuerda en este navegador) ──────
  const toggle = document.getElementById("monToggle");
  let open = true;
  try { open = localStorage.getItem("cumulo-monitor") !== "0"; } catch (e) { /* sin almacenamiento */ }
  function setOpen(v) {
    open = v;
    el.classList.toggle("folded", !v);
    toggle.setAttribute("aria-expanded", String(v));
    try { localStorage.setItem("cumulo-monitor", v ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
  }
  toggle.addEventListener("click", () => setOpen(!open));
  setOpen(open);
  document.getElementById("monSub").textContent = simulated ? "simulado" : "en vivo";

  // ── colores del tema ────────────────────────────────────────
  let colors = {}, light = false;
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = { ink: cs.getPropertyValue("--ink").trim(), warn: cs.getPropertyValue("--warn").trim(), crit: cs.getPropertyValue("--crit").trim() };
    light = document.documentElement.dataset.theme === "light";
  };
  readColors();
  new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const levelOf = p => p == null ? "" : p >= 90 ? "crit" : p >= 75 ? "warn" : "";
  const colorFor = lvl => lvl === "crit" ? colors.crit : lvl === "warn" ? colors.warn : colors.ink;
  const withAlpha = (c, a) => {
    if (c.startsWith("#")) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
    return c;
  };

  // ── gráficas: área difuminada con línea luminosa ───────────
  // La historia se desliza suavemente (offset) para que no avance a saltos.
  function drawSpark(r, slide) {
    const c = r.canvas, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const hs = r.hist; if (hs.length < 3) return;
    const fixed = r.max && r.last ? r.max(r.last) : null;
    const max = fixed || Math.max(r.peak * 1.15, 1e-6);
    const pad = 6, step = (w - pad) / (HIST - 2);
    const x = i => w - pad - (hs.length - 1 - i + slide) * step; // slide 0→1 entre lecturas
    const y = v => h - 1 - clamp(v / max, 0, 1) * (h - pad - 2);
    const col = colorFor(r.level);

    // curva suave (puntos medios)
    const path = () => {
      g.beginPath(); g.moveTo(x(0), y(hs[0]));
      for (let i = 1; i < hs.length - 1; i++) {
        const xm = (x(i) + x(i + 1)) / 2, ym = (y(hs[i]) + y(hs[i + 1])) / 2;
        g.quadraticCurveTo(x(i), y(hs[i]), xm, ym);
      }
      g.lineTo(x(hs.length - 1), y(hs[hs.length - 1]));
    };

    // área: degradado vertical hacia transparente
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, withAlpha(col, light ? 0.16 : 0.22));
    grad.addColorStop(1, withAlpha(col, 0));
    path(); g.lineTo(x(hs.length - 1), h); g.lineTo(x(0), h); g.closePath();
    g.fillStyle = grad; g.fill();

    // halo de la línea y línea nítida
    g.lineJoin = "round"; g.lineCap = "round";
    path(); g.strokeStyle = withAlpha(col, light ? 0.12 : 0.22); g.lineWidth = 5; g.stroke();
    path(); g.strokeStyle = col; g.lineWidth = 1.2; g.stroke();

    // punto actual con brillo que respira
    const lx = x(hs.length - 1), ly = y(hs[hs.length - 1]);
    const t = performance.now() / 1000;
    const glow = g.createRadialGradient(lx, ly, 0, lx, ly, 9);
    glow.addColorStop(0, withAlpha(col, (light ? 0.14 : 0.4) + 0.1 * Math.sin(t * 2.4)));
    glow.addColorStop(1, withAlpha(col, 0));
    g.fillStyle = glow; g.fillRect(lx - 10, ly - 10, 20, 20);
    g.fillStyle = col; g.beginPath(); g.arc(lx, ly, 2, 0, 6.283); g.fill();
  }

  // ── lectura y animación de números ──────────────────────────
  let target = null, shown = null, lastTick = performance.now();
  const lerpSnap = (a, b, k) => {
    if (typeof b === "number") return a + (b - a) * k;
    const o = {}; for (const key in b) o[key] = lerpSnap(a[key], b[key], k); return o;
  };
  function render(d) {
    for (const r of ROWS) {
      const [big, small] = r.value(d);
      if (r.b.textContent !== big) r.b.textContent = big;
      if (r.small.textContent !== small) r.small.textContent = small;
      const det = r.detail(d);
      if (r.detailEl.textContent !== det) r.detailEl.textContent = det;
    }
  }
  function push(d) {
    for (const r of ROWS) {
      r.last = d;
      const v = r.spark(d);
      r.hist.push(v); if (r.hist.length > HIST) r.hist.shift();
      r.peak = Math.max(...r.hist);
      const lvl = r.pct ? levelOf(r.pct(d)) : "";
      if (lvl !== r.level) { r.level = lvl; r.el.dataset.level = lvl; }
    }
  }
  function tick() {
    let d;
    try { d = source.read(); } catch (e) { return; }
    target = d; lastTick = performance.now();
    if (!shown) shown = JSON.parse(JSON.stringify(d));
    push(d);
    if (RM.matches) { shown = d; render(d); }
  }

  const sessionEl = document.getElementById("session");
  let last = 0;
  function loop(now) {
    const visible = open && sessionEl && (sessionEl.classList.contains("open") || sessionEl.classList.contains("closing"));
    if (visible && target) {
      const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
      if (!RM.matches) { shown = lerpSnap(shown, target, 1 - Math.exp(-dt * 6)); render(shown); }
      const slide = RM.matches ? 0 : clamp((now - lastTick) / 1000, 0, 1);
      ROWS.forEach(r => drawSpark(r, slide));
    }
    last = now;
    requestAnimationFrame(loop);
  }

  // historia inicial para que las gráficas no empiecen vacías
  for (let i = 0; i < HIST - 1; i++) { try { push(source.read()); } catch (e) { break; } }
  tick();
  setInterval(() => { if (!document.hidden) tick(); }, 1000);
  requestAnimationFrame(loop);
})();
