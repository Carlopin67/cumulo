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
  const ROWS = [
    { k: "cpu", label: "CPU", pct: d => d.cpu.usage, value: d => [f0.format(d.cpu.usage), "%"],
      spark: d => d.cpu.usage, max: () => 100,
      detail: d => `${d.cpu.cores} núcleos · ${f1.format(d.cpu.ghz)} GHz · ${f0.format(d.cpu.temp)} °C` },
    { k: "ram", label: "RAM", pct: d => d.ram.used / d.ram.total * 100, value: d => [f1.format(d.ram.used), ` / ${f0.format(d.ram.total)} GB`],
      spark: d => d.ram.used, max: d => d.ram.total,
      detail: d => `${f1.format(d.ram.total - d.ram.used)} GB libres` },
    { k: "vram", label: "VRAM", pct: d => d.vram.used / d.vram.total * 100, value: d => [f1.format(d.vram.used), ` / ${f0.format(d.vram.total)} GB`],
      spark: d => d.vram.gpuUsage, max: () => 100,
      detail: d => `GPU ${f0.format(d.vram.gpuUsage)} % · ${f0.format(d.vram.temp)} °C` },
    { k: "disk", label: "Almacenamiento", pct: d => d.disk.used / d.disk.total * 100, value: d => [f0.format(d.disk.used), ` / ${gb(d.disk.total)}`],
      spark: d => d.disk.read + d.disk.write, max: null,
      detail: d => `Lectura ${mbs(d.disk.read)} · escritura ${mbs(d.disk.write)}` },
    { k: "net", label: "Red", extra: true, pct: null, value: d => [`↓ ${mbs(d.net.down)}`, ""],
      spark: d => d.net.down, max: null,
      detail: d => `↑ ${mbs(d.net.up)}` },
    { k: "claude", label: "Claude Code", extra: true, pct: null, value: d => [f1.format(d.claude.memory), " GB"],
      spark: d => d.claude.memory, max: null,
      detail: d => `${d.claude.processes} ${d.claude.processes === 1 ? "proceso" : "procesos"} en marcha` },
  ];

  const rowsEl = document.getElementById("monRows");
  const HIST = 48;
  ROWS.forEach(r => {
    const d = document.createElement("div");
    d.className = "mrow" + (r.extra ? " extra" : "");
    d.innerHTML = `
      <div class="mrow-in">
        <div class="mtop"><span class="mlabel mono"></span><span class="mval"><b></b><small></small></span></div>
        ${r.pct ? `<div class="mbar"><i></i></div>` : ""}
        <div class="mmore"><div class="mmore-in"><canvas class="spark" aria-hidden="true"></canvas><p class="mdetail mono"></p></div></div>
      </div>`;
    d.querySelector(".mlabel").textContent = r.label;
    r.el = d; r.b = d.querySelector("b"); r.small = d.querySelector("small");
    r.bar = d.querySelector(".mbar i"); r.barWrap = d.querySelector(".mbar");
    r.detailEl = d.querySelector(".mdetail"); r.canvas = d.querySelector("canvas");
    r.hist = []; r.shown = null; r.level = "";
    rowsEl.appendChild(d);
  });

  // ── abrir / cerrar (se recuerda en este navegador) ─────────
  const toggle = document.getElementById("monToggle");
  let expanded = false;
  try { expanded = localStorage.getItem("cumulo-monitor") === "1"; } catch (e) { /* sin almacenamiento */ }
  function setExpanded(v) {
    expanded = v;
    el.classList.toggle("expanded", v);
    toggle.setAttribute("aria-expanded", String(v));
    try { localStorage.setItem("cumulo-monitor", v ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
    if (v) drawSparks();
  }
  toggle.addEventListener("click", () => setExpanded(!expanded));
  setExpanded(expanded);
  document.getElementById("monSub").textContent = simulated ? "simulado" : "en vivo";

  // ── colores del tema para las gráficas ──────────────────────
  let colors = {};
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = { ink: cs.getPropertyValue("--ink").trim(), line: cs.getPropertyValue("--line").trim(),
      warn: cs.getPropertyValue("--warn").trim(), crit: cs.getPropertyValue("--crit").trim() };
  };
  readColors();
  new MutationObserver(() => { readColors(); drawSparks(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const levelOf = p => p == null ? "" : p >= 90 ? "crit" : p >= 75 ? "warn" : "";
  const colorFor = lvl => lvl === "crit" ? colors.crit : lvl === "warn" ? colors.warn : colors.ink;

  function drawSpark(r) {
    const c = r.canvas, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const hs = r.hist; if (hs.length < 2) return;
    const max = (r.max && r.max(r.last)) || Math.max(...hs) * 1.25 || 1;
    const x = i => (i + HIST - hs.length) / (HIST - 1) * (w - 4) + 1;
    const y = v => h - 2 - clamp(v / max, 0, 1) * (h - 5);
    const col = colorFor(r.level);
    // líneas guía muy tenues
    g.strokeStyle = colors.line; g.lineWidth = 1;
    g.beginPath(); for (const q of [0.5, 1]) { const yy = Math.round(h - 2 - q * (h - 5)) + 0.5; g.moveTo(0, yy); g.lineTo(w, yy); } g.stroke();
    // área
    const grad = g.createLinearGradient(0, 0, 0, h);
    g.globalAlpha = 1;
    grad.addColorStop(0, col); grad.addColorStop(1, "transparent");
    g.beginPath(); g.moveTo(x(0), h);
    hs.forEach((v, i) => g.lineTo(x(i), y(v)));
    g.lineTo(x(hs.length - 1), h); g.closePath();
    g.globalAlpha = 0.14; g.fillStyle = grad; g.fill(); g.globalAlpha = 1;
    // línea y punto final
    g.beginPath(); hs.forEach((v, i) => i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)));
    g.strokeStyle = col; g.lineWidth = 1.2; g.lineJoin = "round"; g.stroke();
    const lx = x(hs.length - 1), ly = y(hs[hs.length - 1]);
    g.fillStyle = col; g.beginPath(); g.arc(lx, ly, 2.2, 0, 6.283); g.fill();
  }
  function drawSparks() { if (expanded) ROWS.forEach(drawSpark); }

  // ── lectura y animación de los números ─────────────────────
  let target = null, shown = null;
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
      if (r.bar) r.bar.style.transform = `scaleX(${clamp(r.pct(d), 0, 100) / 100})`;
    }
  }

  function tick() {
    let d;
    try { d = source.read(); } catch (e) { return; }
    target = d;
    if (!shown) shown = JSON.parse(JSON.stringify(d));
    for (const r of ROWS) {
      r.last = d;
      r.hist.push(r.spark(d)); if (r.hist.length > HIST) r.hist.shift();
      const lvl = r.pct ? levelOf(r.pct(d)) : "";
      if (lvl !== r.level) { r.level = lvl; r.el.dataset.level = lvl; }
    }
    if (RM.matches) { shown = d; render(d); }
    drawSparks();
  }

  let last = 0;
  function loop(now) {
    if (target && shown && !RM.matches) {
      const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
      shown = lerpSnap(shown, target, 1 - Math.exp(-dt * 6));
      render(shown);
    }
    last = now;
    requestAnimationFrame(loop);
  }

  // historia inicial para que las gráficas no empiecen vacías
  for (let i = 0; i < HIST - 1; i++) {
    const d = source.read();
    ROWS.forEach(r => { r.hist.push(r.spark(d)); r.last = d; });
  }
  tick();
  setInterval(() => { if (!document.hidden) tick(); }, 1000);
  requestAnimationFrame(loop);
})();
