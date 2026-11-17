// Monitor del sistema — columna de la sesión con CPU, RAM, VRAM, disco, red y Claude; debajo, los límites de uso y la ventana de contexto.
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
  let saved = null;
  try { saved = localStorage.getItem("cumulo-monitor"); } catch (e) { /* sin almacenamiento */ }
  open = saved ? saved !== "0" : !matchMedia("(max-width: 760px)").matches; // en el móvil empieza plegado
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
    colors = { bg: cs.getPropertyValue("--bg").trim(), ink: cs.getPropertyValue("--ink").trim(), warn: cs.getPropertyValue("--warn").trim(), crit: cs.getPropertyValue("--crit").trim() };
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

  // ── límites de uso de Claude (ventana de 5 h y semanal) ─────
  // Datos de window.CUMULO_LIMITS.read() si existe; si no, simulados. Forma:
  //   { session: { used 0–1, start ms, end ms, history: [[ms, used], …] },
  //     weekly:  { used 0–1, start ms, end ms, history: [[ms, used], …] } }
  function limitsSimulator() {
    const H = 3600e3, D = 24 * H, now0 = Date.now();
    const mk = (start, end, used, steps) => {
      const hist = []; let u = 0;
      const span = now0 - start;
      for (let i = 0; i <= steps; i++) {
        const t = start + span * i / steps;
        if (i) u += Math.random() < 0.55 ? Math.random() * (used / steps) * 2.2 : 0; // tramos de trabajo y pausas
        hist.push([t, u]);
      }
      const k = used / (u || 1); hist.forEach(p => { p[1] *= k; });
      return { start, end, used, history: hist };
    };
    // la ventana de 5 h empezó hace 2 h 46 min; la semana, el lunes a las 9:00
    const sStart = now0 - (2 * H + 46 * 60e3);
    const monday = new Date(now0); monday.setHours(9, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    if (monday.getTime() > now0) monday.setDate(monday.getDate() - 7);
    const st = { session: mk(sStart, sStart + 5 * H, 0.42, 40), weekly: mk(monday.getTime(), monday.getTime() + 7 * D, 0.17, 60) };
    return {
      read() {
        const now = Date.now();
        for (const k of ["session", "weekly"]) {
          const l = st[k];
          if (Math.random() < 0.25) l.used = Math.min(1, l.used + Math.random() * (k === "session" ? 0.004 : 0.0012));
          const lastP = l.history[l.history.length - 1];
          if (now - lastP[0] > (l.end - l.start) / 80) l.history.push([now, l.used]); else lastP[1] = l.used;
        }
        return st;
      },
    };
  }
  const limitsSource = window.CUMULO_LIMITS || limitsSimulator();
  const limitsEl = document.getElementById("monLimits");
  document.getElementById("limSub").textContent = window.CUMULO_LIMITS ? "" : "simulado";
  // Diseño «órbitas»: cada límite es una órbita.
  // El arco es lo gastado (se ilumina hacia su punta, como un cometa); la bolita hueca es el tiempo
  // que ha pasado de la ventana. Si la punta adelanta a la bolita, se gasta más rápido de lo que pasa
  // el tiempo. Puntos: uno por día en la semanal (7) y uno por hora en la de 5 h (5).
  const LIMITS = [
    { k: "weekly", label: "Semanal", ring: 1, ticks: 7 },
    { k: "session", label: "5 horas", ring: 0.6, ticks: 5 },
  ];
  limitsEl.innerHTML = `
    <div class="orbits">
      <canvas class="orbit-cv" aria-hidden="true"></canvas>
      <div class="orbit-info"></div>
    </div>
    <p class="orbit-key"><span class="k-arc"></span>gastado <span class="k-dot"></span>tiempo <span class="k-tick"></span>día / hora</p>`;
  const orbitCv = limitsEl.querySelector(".orbit-cv"), info = limitsEl.querySelector(".orbit-info");
  LIMITS.forEach(L => {
    const d = document.createElement("div"); d.className = "oi";
    d.innerHTML = `<p class="oi-top"><span class="oi-mark ${L.ring === 1 ? "outer" : "inner"}"></span><span class="oi-name"></span><b></b></p>
      <p class="oi-sub"></p><p class="oi-proj"></p>`;
    d.querySelector(".oi-name").textContent = L.label;
    L.el = d; L.b = d.querySelector("b"); L.reset = d.querySelector(".oi-sub"); L.proj = d.querySelector(".oi-proj");
    L.shown = 0; L.shownT = 0;
    info.appendChild(d);
  });

  const dur = ms => {
    const m = Math.max(0, Math.round(ms / 60e3)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d} d ${h} h` : h ? `${h} h ${mm} min` : `${mm} min`;
  };
  let limits = null;
  function readLimits() {
    try { limits = limitsSource.read(); } catch (e) { return; }
    const now = Date.now();
    for (const L of LIMITS) {
      const l = limits[L.k]; if (!l) continue;
      const pct = l.used * 100;
      L.elapsed = clamp((now - l.start) / (l.end - l.start), 0, 1);
      L.b.textContent = `${f0.format(pct)} %`;
      L.projected = Math.min(1.5, l.used / Math.max(L.elapsed, 0.02));
      L.reset.textContent = `reinicia en ${dur(l.end - now)}`;
      L.proj.textContent = L.projected >= 1 ? "a este ritmo: al límite" : `a este ritmo: ~${f0.format(L.projected * 100)} %`;
      const lvl = levelOf(Math.max(pct, L.projected >= 1 ? 75 : 0));
      if (lvl !== L.level) { L.level = lvl; L.el.dataset.level = lvl; }
    }
  }

  let lastOrbit = 0;
  function drawOrbits(now) {
    if (!limits) return;
    const c = orbitCv, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const dt = Math.min(0.1, (now - lastOrbit) / 1000 || 0.016); lastOrbit = now;
    const k = RM.matches ? 1 : 1 - Math.exp(-dt * 3);
    const t = now / 1000, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14; // margen para que el brillo no se corte
    const TOP = -Math.PI / 2, TAU = Math.PI * 2;
    const ink = a => withAlpha(colors.ink, a);

    for (const L of LIMITS) {
      const l = limits[L.k]; if (!l) continue;
      const r = R * L.ring;
      L.shown += (l.used - L.shown) * k;          // el arco crece suave al abrir
      L.shownT += ((L.elapsed || 0) - L.shownT) * k;
      const col = colorFor(L.level || "");

      // órbita y un punto por día (semanal) o por hora (5 h); el de arriba es el reinicio
      g.strokeStyle = ink(light ? 0.13 : 0.16); g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      for (let i = 0; i < L.ticks; i++) {
        const a = TOP + i / L.ticks * TAU, done = L.shown >= i / L.ticks;
        g.fillStyle = ink(done ? (light ? 0.55 : 0.6) : (light ? 0.28 : 0.3));
        g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, i === 0 ? 1.6 : 1.3, 0, TAU); g.fill();
      }

      // arco gastado: una cinta continua que se afila desde el inicio y se ilumina hacia la punta,
      // como la cola de un cometa; acaba redondeada y en un brillo suave (sin cortes ni bolita)
      const a1 = TOP + clamp(L.shown, 0, 1) * TAU;
      if (L.shown > 0.002) {
        const span = a1 - TOP, frac = clamp(L.shown, 0.001, 1);
        const N = Math.max(12, Math.ceil(span / TAU * 120));
        const ribbon = (w0, w1, lo, hi) => {
          let fill = withAlpha(col, hi);
          if (g.createConicGradient) {
            fill = g.createConicGradient(TOP, cx, cy);
            fill.addColorStop(0, withAlpha(col, lo)); fill.addColorStop(frac, withAlpha(col, hi));
            fill.addColorStop(Math.min(1, frac + 0.02), withAlpha(col, hi)); fill.addColorStop(1, withAlpha(col, lo));
          }
          const hw = f => (w0 + (w1 - w0) * f * f) / 2;
          g.beginPath();
          for (let k = 0; k <= N; k++) {
            const a = TOP + span * k / N, rr = r + hw(k / N);
            k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          const ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r;
          g.arc(ex, ey, hw(1), a1, a1 + Math.PI, false); // punta redondeada
          for (let k = N; k >= 0; k--) {
            const a = TOP + span * k / N, rr = r - hw(k / N);
            g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
          }
          g.closePath(); g.fillStyle = fill; g.fill();
        };
        ribbon(0.5, 9, 0, light ? 0.13 : 0.2);                       // halo
        ribbon(0.3, 2.4, light ? 0.12 : 0.08, light ? 0.95 : 1);     // línea

        // haz de luz en la punta: brillo difuso que nace de la línea, sin bolita
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + L.ring * 2);
        const hx = cx + Math.cos(a1) * r, hy = cy + Math.sin(a1) * r;
        const glowR = 11 + pulse * 2;
        const hg = g.createRadialGradient(hx, hy, 0, hx, hy, glowR);
        hg.addColorStop(0, withAlpha(col, light ? 0.2 : 0.5));
        hg.addColorStop(0.3, withAlpha(col, light ? 0.07 : 0.2));
        hg.addColorStop(1, withAlpha(col, 0));
        g.fillStyle = hg; g.beginPath(); g.arc(hx, hy, glowR, 0, TAU); g.fill();
        if (!light) {                                // núcleo de luz casi blanco, muy pequeño y difuso
          const core = g.createRadialGradient(hx, hy, 0, hx, hy, 3.2);
          core.addColorStop(0, `rgba(255,255,255,${0.75 + pulse * 0.2})`); core.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = core; g.beginPath(); g.arc(hx, hy, 3.2, 0, TAU); g.fill();
        }
      }

      // planeta (bolita hueca): tiempo pasado de la ventana
      const ap = TOP + clamp(L.shownT, 0, 1) * TAU;
      const px = cx + Math.cos(ap) * r, py = cy + Math.sin(ap) * r;
      const glow = g.createRadialGradient(px, py, 0, px, py, 10);
      glow.addColorStop(0, ink((light ? 0.16 : 0.35) + 0.08 * Math.sin(t * 2 + L.ring * 3))); glow.addColorStop(1, ink(0));
      g.fillStyle = glow; g.fillRect(px - 11, py - 11, 22, 22);
      g.fillStyle = withAlpha(colors.bg, 1); g.beginPath(); g.arc(px, py, 4.2, 0, TAU); g.fill();
      g.strokeStyle = colors.ink; g.lineWidth = 1.4; g.beginPath(); g.arc(px, py, 3.2, 0, TAU); g.stroke();
    }
  }

  // ── ventana de contexto de la sesión abierta ────────────────
  // Como `/context` de Claude Code: 100 casillas (1 % = 10k tokens cada una) repartidas por categorías.
  // Simulado a partir de la sesión; la versión instalable lo leerá de la sesión real.
  // Desde app.js: window.cumuloMonitor.setSession(sesión | null) y .addMessage(caracteres, imágenes).
  const CTX_TOTAL = 1000000, CTX_RESERVE = 45000; // ventana de 1M de tokens; reserva antes de autocompactar
  const CTX_CATS = [
    { k: "system", label: "Sistema", a: 0.3 },
    { k: "tools", label: "Herramientas", a: 0.45 },
    { k: "mcp", label: "MCP", a: 0.6 },
    { k: "memory", label: "Memoria", a: 0.78 },
    { k: "messages", label: "Mensajes", a: 1, accent: true },
  ];
  const ctxEl = document.getElementById("monContext");
  ctxEl.innerHTML = `
    <p class="ctx-sum"><b class="ctx-used"></b><span class="ctx-of"> / 1M</span><span class="ctx-pct"></span></p>
    <div class="ctx-grid" aria-hidden="true">${Array.from({ length: 100 }, () => "<i></i>").join("")}</div>
    <ul class="ctx-legend">${CTX_CATS.map(c => `<li data-k="${c.k}"><span class="sw"></span><span class="nm">${c.label}</span><span class="tk"></span></li>`).join("")}
      <li data-k="free"><span class="sw"></span><span class="nm">Libre</span><span class="tk"></span></li>
      <li data-k="reserve"><span class="sw"></span><span class="nm">Reserva</span><span class="tk"></span></li>
    </ul>
    <p class="ctx-note"></p>`;
  const cells = [...ctxEl.querySelectorAll(".ctx-grid i")];
  const kfmt = n => n >= 1e6 ? `${f1.format(n / 1e6)}M` : n >= 1000 ? `${f1.format(n / 1000)}k` : f0.format(n);
  let ctx = null;

  function renderContext(fresh) {
    if (!ctx) return;
    const used = CTX_CATS.reduce((a, c) => a + ctx[c.k], 0);
    const free = Math.max(0, CTX_TOTAL - CTX_RESERVE - used);
    ctxEl.querySelector(".ctx-used").textContent = kfmt(used);
    ctxEl.querySelector(".ctx-pct").textContent = ` · ${f0.format(used / CTX_TOTAL * 100)} %`;
    CTX_CATS.forEach(c => { ctxEl.querySelector(`[data-k="${c.k}"] .tk`).textContent = kfmt(ctx[c.k]); });
    ctxEl.querySelector('[data-k="free"] .tk').textContent = kfmt(free);
    ctxEl.querySelector('[data-k="reserve"] .tk').textContent = kfmt(CTX_RESERVE);
    const leftPct = free / CTX_TOTAL * 100;
    const note = ctxEl.querySelector(".ctx-note");
    note.textContent = free > 0 ? `quedan ${kfmt(free)} antes de compactar` : "se compactará en la próxima respuesta";
    ctxEl.dataset.level = leftPct < 5 ? "crit" : leftPct < 15 ? "warn" : "";

    // casillas: cada categoría ocupa las que le tocan (mínimo una si tiene algo), luego libre y reserva al final
    const counts = CTX_CATS.map(c => ctx[c.k] > 0 ? Math.max(1, Math.round(ctx[c.k] / CTX_TOTAL * 100)) : 0);
    const reserveN = Math.round(CTX_RESERVE / CTX_TOTAL * 100);
    let i = 0;
    CTX_CATS.forEach((c, ci) => {
      for (let n = 0; n < counts[ci] && i < 100 - reserveN; n++, i++) {
        const el = cells[i], was = el.dataset.k;
        el.dataset.k = c.k; el.style.setProperty("--a", c.a);
        if (!fresh && was !== c.k) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
      }
    });
    for (; i < 100 - reserveN; i++) {
      const el = cells[i], was = el.dataset.k;
      el.dataset.k = "free"; el.style.removeProperty("--a");
      if (!fresh && was && was !== "free") { el.classList.remove("pop", "drain"); void el.offsetWidth; el.classList.add("drain"); el.style.setProperty("--d", `${(i % 20) * 12}ms`); }
    }
    const btn = document.getElementById("ctxCompact");
    // solo tiene sentido si hay al menos 15k de mensajes nuevos desde la última compactación
    if (btn && !btn.classList.contains("busy")) btn.disabled = ctx.messages - (ctx.compactedAt || 0) < 15000;
    for (; i < 100; i++) { cells[i].dataset.k = "reserve"; cells[i].style.removeProperty("--a"); }
    if (fresh) {
      ctxEl.classList.remove("enter"); void ctxEl.offsetWidth; ctxEl.classList.add("enter");
      cells.forEach((el, n) => el.style.setProperty("--d", `${n * 6}ms`));
    }
  }

  window.cumuloMonitor = {
    setSession(s) {
      const msgs = s ? s.messages : 0;
      const seed = s ? s.id.charCodeAt(0) + s.id.charCodeAt(1) : 7;
      ctx = {
        system: 3100, tools: 11600, mcp: 2400 + (seed % 5) * 900, memory: 1200 + (seed % 7) * 260,
        messages: Math.min(700000, msgs * 4200 + (seed % 11) * 1800), // sesiones largas llenan bastante más
      };
      renderContext(true);
    },
    // compactar: los mensajes se sustituyen por un resumen (~7 % de lo que ocupaban)
    compact() {
      if (!ctx) return null;
      const before = ctx.messages, after = Math.max(3000, Math.round(before * 0.07));
      ctx.messages = after; ctx.compactedAt = after;
      renderContext(false);
      return { before: kfmt(before), after: kfmt(after), freed: kfmt(before - after) };
    },
    addMessage(chars, images) {
      if (!ctx) return;
      ctx.messages = Math.min(CTX_TOTAL - CTX_RESERVE - 19000, ctx.messages + Math.round(chars / 3.6) + (images || 0) * 1600 + 120);
      renderContext(false);
    },
  };
  window.cumuloMonitor.setSession(null);

  const sessionEl = document.getElementById("session");
  let last = 0;
  function loop(now) {
    const inSession = sessionEl && (sessionEl.classList.contains("open") || sessionEl.classList.contains("closing"));
    if (inSession) drawOrbits(now);
    const visible = open && inSession;
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
  tick(); readLimits();
  setInterval(() => { if (!document.hidden) { tick(); readLimits(); } }, 1000);
  requestAnimationFrame(loop);
})();
