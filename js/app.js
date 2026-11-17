// Cúmulo — lanzador de sesiones de Claude como cúmulo de estrellas.
// Lee los datos de window.CUMULO_DATA (data/sessions.js). Todo lo demás se calcula aquí.
(() => {
  "use strict";

  const SESSIONS = ((window.CUMULO_DATA && window.CUMULO_DATA.sessions) || []).map(s => ({ ...s }));
  const byId = new Map(SESSIONS.map(s => [s.id, s]));

  // Colores por proyecto. Oscuro: temperaturas de estrellas reales. Claro: tintas de atlas impreso.
  const PAL_DARK = ["#9fbaff", "#ffd29a", "#cddaff", "#ffae78", "#efeaff", "#ffe2bd", "#8fa9f2", "#ffc08a"];
  const PAL_LIGHT = ["#3d6bff", "#ff9a2e", "#6f8cff", "#ff6a3a", "#8a6cff", "#ffb23e", "#2f7dff", "#ff7f45"];

  const FONT_DISPLAY = "'Martian Mono', ui-monospace, monospace";
  const FONT_MONO = "'Martian Mono', ui-monospace, monospace";

  // ── utilidades ──────────────────────────────────────────────
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const folderName = p => (p.split(/[\\/]/).filter(Boolean).pop() || p);
  const fmtDate = d => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  const ago = d => {
    const days = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (days <= 0) return "hoy"; if (days === 1) return "ayer";
    if (days < 30) return `hace ${days} días`;
    const m = Math.floor(days / 30); return m === 1 ? "hace un mes" : `hace ${m} meses`;
  };
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = typeof c === "string" ? hexToRgb(c) : c; return `rgba(${r},${g},${b},${a})`; };

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);
  const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  const RM = matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => RM.matches;

  // ── disposición del cúmulo ──────────────────────────────────
  const projects = new Map();
  SESSIONS.forEach(s => {
    if (!projects.has(s.project)) projects.set(s.project, { path: s.project, name: s.projectName || folderName(s.project), sessions: [] });
    projects.get(s.project).sessions.push(s);
  });
  const projList = [...projects.values()].sort((a, b) => b.sessions.length - a.sessions.length);
  const GA = Math.PI * (3 - Math.sqrt(5)); // ángulo áureo

  projList.forEach((p, i) => {
    const r = i === 0 ? 0 : 250 * Math.sqrt(i);
    const a = i * GA + 0.7;
    p.x = Math.cos(a) * r; p.y = Math.sin(a) * r * 0.78;
    p.cd = PAL_DARK[i % PAL_DARK.length]; p.cl = PAL_LIGHT[i % PAL_LIGHT.length];
    p.la = 0;
    p.sessions.sort((a, b) => new Date(a.started) - new Date(b.started));
    const R = rng(hash(p.path));
    let maxR = 0;
    p.sessions.forEach((s, k) => {
      const rr = 30 * Math.sqrt(k + 0.4) + R() * 16;
      const aa = k * GA + R() * 0.9;
      s.x = p.x + Math.cos(aa) * rr; s.y = p.y + Math.sin(aa) * rr;
      s.proj = p;
      const lm = Math.log2(1 + (s.messages || 1));
      s.size = 1.3 + lm * 0.5;
      s.spike = clamp((lm - 4.3) / 2.2, 0, 1); // las sesiones largas tienen picos de difracción
      s.twinkle = R() * Math.PI * 2;
      s.pulsePhase = R() * 4;
      maxR = Math.max(maxR, rr);
    });
    p.radius = maxR + 20;
  });

  const now0 = Date.now();
  [...SESSIONS].sort((a, b) => new Date(a.started) - new Date(b.started)).forEach((s, i, arr) => {
    s.delay = 0.35 + (arr.length > 1 ? i / (arr.length - 1) : 0) * 1.5; // nacen en orden de fecha
  });
  SESSIONS.forEach(s => {
    const age = Math.max(0, (now0 - new Date(s.lastActive || s.started)) / 86400000);
    s.glow = 0.45 + 0.55 * Math.exp(-age / 12); // más reciente = más brillante
    s.live = age < 3;                           // activa estos días: late
    s.dim = 0; s.foc = 0; s.la = 0;
  });

  // ── hilos ────────────────────────────────────────────────────
  const links = [];
  const linkKey = (a, b) => a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
  const seen = new Set();
  const addLink = (a, b, kind) => {
    const k = linkKey(a, b); if (a === b || seen.has(k)) return; seen.add(k);
    const R = rng(hash(k));
    links.push({ a, b, kind, bend: (R() - 0.5) * 0.5, phase: R() * 10, hl: 0, dim: 0 });
  };
  projList.forEach(p => p.sessions.forEach((s, k) => { if (k > 0) addLink(p.sessions[k - 1], s, "chain"); }));
  SESSIONS.forEach(s => (s.related || []).forEach(id => { const t = byId.get(id); if (t) addLink(s, t, "related"); }));
  SESSIONS.forEach(s => s.links = links.filter(l => l.a === s || l.b === s));

  // ── tema ─────────────────────────────────────────────────────
  const THEMES = {
    dark: {
      bg: [0, 0, 0], dust: [220, 225, 240], dustA: 1, ink: [236, 232, 222], muted: [141, 139, 134],
      grid: 0.028, blend: "lighter", relatedLink: "#e8e4da", key: "cd",
    },
    light: {
      bg: [255, 255, 255], dust: [60, 66, 90], dustA: 0.45, ink: [20, 20, 26], muted: [112, 112, 120],
      grid: 0.045, blend: "multiply", relatedLink: "#4a4650", key: "cl",
    },
  };
  const root = document.documentElement;
  let theme = root.dataset.theme === "light" ? "light" : "dark";
  let th = THEMES[theme];
  const colorOf = p => p[th.key];
  const themeBtn = document.getElementById("themeToggle");

  function applyTheme(t) {
    theme = t; th = THEMES[t]; root.dataset.theme = t;
    themeBtn.setAttribute("aria-label", t === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  }
  applyTheme(theme);

  let savedTheme = null;
  try { savedTheme = localStorage.getItem("cumulo-theme"); } catch (e) { /* sin almacenamiento */ }
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
    if (!savedTheme) switchTheme(e.matches ? "light" : "dark");
  });

  function switchTheme(next, origin) {
    if (next === theme) return;
    const run = () => { applyTheme(next); draw(performance.now(), 0); };
    if (!document.startViewTransition || reduced()) { run(); return; }
    const [x, y] = origin || [W / 2, H / 2];
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
    const vt = document.startViewTransition(run);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 820, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }
  themeBtn.addEventListener("click", () => {
    const next = theme === "dark" ? "light" : "dark";
    savedTheme = next;
    try { localStorage.setItem("cumulo-theme", next); } catch (e) { /* sin almacenamiento */ }
    const b = themeBtn.getBoundingClientRect();
    switchTheme(next, [b.left + b.width / 2, b.top + b.height / 2]);
  });

  // ── canvas ───────────────────────────────────────────────────
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // polvo de estrellas lejanas
  const bgR = rng(7);
  const dust = Array.from({ length: 750 }, () => ({
    x: bgR() * 4000, y: bgR() * 4000, r: bgR() < 0.93 ? 0.35 + bgR() * 0.5 : 0.9 + bgR() * 0.7,
    a: 0.12 + bgR() * 0.5, d: 0.04 + bgR() * 0.25, tw: bgR() * 6.28, sp: 0.4 + bgR() * 1.4,
  }));

  // ── sprites de estrella (pre-renderizados por color) ─────────
  const spriteCache = new Map();
  function cached(key, size, paint) {
    if (spriteCache.has(key)) return spriteCache.get(key);
    const c = document.createElement("canvas"); c.width = c.height = size;
    paint(c.getContext("2d"), size / 2);
    spriteCache.set(key, c); return c;
  }
  // corona: brillo amplio y suave, con un anillo cromático muy tenue (como en óptica real)
  const halo = (color, light) => cached("h" + color + light, 256, (g, m) => {
    const gr = g.createRadialGradient(m, m, 0, m, m, m);
    if (light) {
      gr.addColorStop(0, rgba(color, .85)); gr.addColorStop(.06, rgba(color, .5)); gr.addColorStop(.18, rgba(color, .16));
      gr.addColorStop(.42, rgba(color, .05)); gr.addColorStop(1, rgba(color, 0));
    } else {
      gr.addColorStop(0, rgba(color, .75)); gr.addColorStop(.06, rgba(color, .42)); gr.addColorStop(.18, rgba(color, .12));
      gr.addColorStop(.42, rgba(color, .035)); gr.addColorStop(1, rgba(color, 0));
    }
    g.fillStyle = gr; g.fillRect(0, 0, m * 2, m * 2);
    {
      g.strokeStyle = rgba(color, .05); g.lineWidth = 3;
      g.beginPath(); g.arc(m, m, m * .3, 0, 6.283); g.stroke();
    }
  });
  // picos de difracción: seis largos y dos cortos horizontales, todos con la misma orientación
  const spikes = (color, light) => cached("s" + color + light, 512, (g, m) => {
    const ray = (ang, len, w, a) => {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const gr = g.createLinearGradient(m, m, m + dx * len, m + dy * len);
      gr.addColorStop(0, rgba(color, a)); gr.addColorStop(.35, rgba(color, a * .35)); gr.addColorStop(1, rgba(color, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(m - dy * w, m + dx * w); g.lineTo(m + dx * len, m + dy * len); g.lineTo(m + dy * w, m - dx * w);
      g.closePath(); g.fill();
    };
    for (let k = 0; k < 6; k++) ray(-Math.PI / 2 + k * Math.PI / 3, m, 3.2, .9);
    ray(0, m * .42, 2, .55); ray(Math.PI, m * .42, 2, .55);
    if (light) return;
    const core = g.createRadialGradient(m, m, 0, m, m, m * .1);
    core.addColorStop(0, "rgba(255,255,255,.6)"); core.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = core; g.fillRect(0, 0, m * 2, m * 2);
  });
  // núcleo: blanco incandescente con borde del color de la estrella
  // en claro: punto blanco rodeado de un anillo saturado, para que siga leyéndose como luz sobre blanco
  const core = (color, light) => cached("c" + color + light, 64, (g, m) => {
    const gr = g.createRadialGradient(m, m, 0, m, m, m);
    if (light) {
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.16, "rgba(255,255,255,1)");
      gr.addColorStop(.3, rgba(color, 1)); gr.addColorStop(.55, rgba(color, .45)); gr.addColorStop(1, rgba(color, 0));
    } else {
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.22, "rgba(255,252,246,.95)");
      gr.addColorStop(.45, rgba(color, .55)); gr.addColorStop(1, rgba(color, 0));
    }
    g.fillStyle = gr; g.fillRect(0, 0, m * 2, m * 2);
  });

  // ── cámara ───────────────────────────────────────────────────
  const cam = { x: 0, y: 0, z: 1 };
  const ZMIN = 0.15, ZMAX = 6;
  let tween = null, zoomGoal = null, inertia = null;
  const toScreen = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];
  const panelW = () => (document.body.classList.contains("panel-open") && W > 760 ? 360 : 0);

  function stopMotion() { tween = null; zoomGoal = null; inertia = null; }

  // vuelo con curva suave; si el salto es largo, se aleja un poco a mitad de camino
  function flyTo(x, y, z, opts = {}) {
    z = clamp(z ?? cam.z, ZMIN, ZMAX);
    // en el móvil el inspector es una hoja inferior: la estrella se coloca en la parte visible de arriba
    const sheet = document.body.classList.contains("panel-open") && W <= 760 ? Math.min(H * 0.7, 560) : 0;
    const tx = x + (opts.noPanel ? 0 : panelW() / 2 / z), ty = y + (opts.noPanel ? 0 : sheet / 2 / z);
    stopMotion();
    if (reduced()) { cam.x = tx; cam.y = ty; cam.z = z; return; }
    const dist = Math.hypot(tx - cam.x, ty - cam.y) * Math.min(cam.z, z);
    tween = {
      t0: performance.now(), from: { ...cam }, to: { x: tx, y: ty, z },
      dur: opts.dur ?? clamp(650 + dist * 0.45, 750, 1500),
      dip: opts.noDip ? 0 : clamp(dist / (Math.min(W, H) * 1.6), 0, 0.4),
      ease: opts.ease || easeInOutCubic,
    };
  }
  function bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    SESSIONS.forEach(s => { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); });
    if (!SESSIONS.length) { x0 = y0 = -100; x1 = y1 = 100; }
    const pw = panelW();
    const z = clamp(Math.min((W - pw - 180) / (x1 - x0 + 120), (H - 180) / (y1 - y0 + 120)), 0.2, 2.2);
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z };
  }
  function fitAll() { const b = bounds(); flyTo(b.x, b.y, b.z); }
  // zoom anclado al cursor, suavizado
  function zoomAt(factor, sx, sy) {
    tween = null; inertia = null;
    const base = zoomGoal ? zoomGoal.z : cam.z;
    const [wx, wy] = toWorld(sx, sy);
    zoomGoal = { z: clamp(base * factor, ZMIN, ZMAX), wx, wy, sx, sy };
    if (reduced()) { applyZoom(1); zoomGoal = null; }
  }
  function applyZoom(k) {
    const g = zoomGoal;
    cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(g.z), k));
    cam.x = g.wx - (g.sx - W / 2) / cam.z; cam.y = g.wy - (g.sy - H / 2) / cam.z;
    if (Math.abs(Math.log(cam.z / g.z)) < 1e-4) zoomGoal = null;
  }
  function updateCamera(now, dt) {
    if (tween) {
      const p = clamp((now - tween.t0) / tween.dur, 0, 1), e = tween.ease(p);
      const f = tween.from, to = tween.to;
      cam.x = lerp(f.x, to.x, e); cam.y = lerp(f.y, to.y, e);
      cam.z = Math.exp(lerp(Math.log(f.z), Math.log(to.z), e)) * (1 - tween.dip * Math.sin(Math.PI * e));
      if (p >= 1) tween = null;
    } else if (zoomGoal) {
      applyZoom(1 - Math.exp(-dt * 14));
    } else if (inertia) {
      cam.x += inertia.vx * dt; cam.y += inertia.vy * dt;
      const f = Math.exp(-dt * 5); inertia.vx *= f; inertia.vy *= f;
      if (Math.hypot(inertia.vx, inertia.vy) * cam.z < 4) inertia = null;
    }
  }

  // ── estado ───────────────────────────────────────────────────
  let hovered = null, selected = null, hoverProject = null, query = "";
  let ring = { s: null, a: 0, t0: 0 };
  const matches = s => !query || (s.title + " " + (s.firstPrompt || "") + " " + s.proj.name).toLowerCase().includes(query);

  function ctrl(l) {
    const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
    const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
    return [mx - dy * l.bend, my + dx * l.bend];
  }
  function bez(l, t) {
    const [cx, cy] = ctrl(l), u = 1 - t;
    return [u * u * l.a.x + 2 * u * t * cx + t * t * l.b.x, u * u * l.a.y + 2 * u * t * cy + t * t * l.b.y];
  }

  let introT0 = null;
  const birth = s => reduced() || introT0 === null ? 1 : clamp((tNow - introT0 - s.delay) / 0.9, 0, 1);
  let tNow = 0;

  // ── dibujo ───────────────────────────────────────────────────
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    updateCamera(now, dt);
    draw(now, dt);
    requestAnimationFrame(frame);
  }

  function draw(now, dt) {
    const t = now / 1000; tNow = t;
    if (introT0 === null) introT0 = t;
    const k = reduced() ? 1 : 1 - Math.exp(-dt * 11);
    const light = theme === "light";

    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(th.bg, 1); ctx.fillRect(0, 0, W, H);

    // retícula celeste (círculos y meridianos alrededor del centro del cúmulo)
    ctx.strokeStyle = rgba(th.ink, th.grid); ctx.lineWidth = 0.6;
    const [ox, oy] = toScreen(0, 0);
    for (let r = 320; r <= 2240; r += 320) { ctx.beginPath(); ctx.arc(ox, oy, r * cam.z, 0, 6.283); ctx.stroke(); }
    ctx.beginPath();
    for (let a = 0; a < 12; a++) {
      const an = a * Math.PI / 6;
      ctx.moveTo(ox + Math.cos(an) * 320 * cam.z, oy + Math.sin(an) * 320 * cam.z);
      ctx.lineTo(ox + Math.cos(an) * 2240 * cam.z, oy + Math.sin(an) * 2240 * cam.z);
    }
    ctx.stroke();

    // polvo con paralaje
    for (const b of dust) {
      const sx = ((b.x - cam.x * b.d * cam.z) % W + W) % W;
      const sy = ((b.y - cam.y * b.d * cam.z) % H + H) % H;
      const a = b.a * th.dustA * (0.7 + 0.3 * Math.sin(t * b.sp + b.tw));
      ctx.fillStyle = rgba(th.dust, a);
      ctx.fillRect(sx, sy, b.r * 1.3, b.r * 1.3);
    }

    const focus = selected || hovered;
    const lit = focus ? new Set(focus.links.flatMap(l => [l.a, l.b])) : null;

    // estados animados
    for (const s of SESSIONS) {
      const dimT = (query && !matches(s)) || (lit && !lit.has(s)) || (hoverProject && s.proj !== hoverProject) ? 1 : 0;
      s.dim += (dimT - s.dim) * k;
      s.foc += ((s === focus ? 1 : 0) - s.foc) * k;
      s.la += ((s === hovered || s === selected ? 1 : 0) - s.la) * (reduced() ? 1 : 1 - Math.exp(-dt * 14));
    }

    // hilos
    ctx.lineCap = "round";
    for (const l of links) {
      const on = focus && (l.a === focus || l.b === focus);
      const projOn = hoverProject && l.a.proj === hoverProject && l.b.proj === hoverProject;
      const dimT = (query && !(matches(l.a) && matches(l.b))) || (focus && !on && !projOn) || (hoverProject && !projOn) ? 1 : 0;
      l.hl += ((on || projOn ? 1 : 0) - l.hl) * k;
      l.dim += (dimT - l.dim) * k;

      const grow = reduced() || introT0 === null ? 1 : easeInOutCubic(clamp((t - introT0 - Math.max(l.a.delay, l.b.delay) - 0.35) / 0.9, 0, 1));
      if (grow <= 0) continue;

      const base = l.kind === "chain" ? (light ? 0.32 : 0.2) : (light ? 0.26 : 0.15);
      const alpha = lerp(lerp(base, base * 0.25, l.dim), light ? 0.85 : 0.7, l.hl);
      const color = l.kind === "chain" ? colorOf(l.a.proj) : th.relatedLink;
      const [ax, ay] = toScreen(l.a.x, l.a.y);
      const [cx0, cy0] = ctrl(l), [cx, cy] = toScreen(cx0, cy0);
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = lerp(0.7, 1.2, l.hl);
      ctx.setLineDash(l.kind === "related" ? [1.5, 5] : []);
      ctx.beginPath(); ctx.moveTo(ax, ay);
      if (grow >= 1) {
        const [bx, by] = toScreen(l.b.x, l.b.y);
        ctx.quadraticCurveTo(cx, cy, bx, by);
      } else { // trazo parcial (De Casteljau) mientras el hilo se teje
        const [ex, ey] = toScreen(...bez(l, grow));
        ctx.quadraticCurveTo(lerp(ax, cx, grow), lerp(ay, cy, grow), ex, ey);
      }
      ctx.stroke();

      // pulso de luz que recorre el hilo
      const cyc = (t * 0.12 + l.phase) % 4;
      if (cyc < 1 && grow >= 1 && l.dim < 0.9) {
        const [px, py] = toScreen(...bez(l, cyc));
        const pa = Math.sin(cyc * Math.PI) * lerp(0.45, 0.95, l.hl) * (1 - l.dim);
        ctx.fillStyle = rgba(color, pa);
        ctx.beginPath(); ctx.arc(px, py, lerp(1.1, 1.7, l.hl), 0, 6.283); ctx.fill();
      }
    }
    ctx.setLineDash([]);

    // nombres de proyectos
    const labelZ = clamp((cam.z - 0.35) * 1.6, 0, 0.6);
    const labelIntro = reduced() ? 1 : easeOutCubic(clamp((t - introT0 - 1.4) / 1, 0, 1));
    ctx.font = `500 9px ${FONT_MONO}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
    ctx.textAlign = "center";
    for (const p of projList) {
      const target = hoverProject === p ? 1 : (hoverProject || (focus && focus.proj !== p) ? labelZ * 0.35 : labelZ);
      p.la += (target - p.la) * k;
      const a = p.la * labelIntro;
      if (a < 0.01) continue;
      const [sx, sy] = toScreen(p.x, p.y - p.radius);
      ctx.fillStyle = rgba(th.ink, a * (light ? 0.9 : 0.85));
      ctx.fillText(p.name.toUpperCase(), sx, sy - 8 + (1 - labelIntro) * 6);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    // estrellas (sesiones)
    const zs = Math.pow(cam.z, 0.55);
    for (const s of SESSIONS) {
      const [sx, sy] = toScreen(s.x, s.y);
      if (sx < -140 || sy < -140 || sx > W + 140 || sy > H + 140) continue;
      const b = birth(s);
      if (b <= 0) continue;
      const scint = 0.88 + 0.12 * Math.sin(t * 1.3 + s.twinkle) * Math.sin(t * 0.71 + s.twinkle * 2);
      const a = s.glow * lerp(1, 0.18, s.dim) * easeOutCubic(b);
      const R = s.size * zs * easeOutBack(b) * (1 + 0.3 * s.foc);
      const color = colorOf(s.proj);

      drawStar(s, sx, sy, R, a, scint, color, t, light);

      // destello de nacimiento
      if (b < 1 && !reduced()) {
        ctx.globalCompositeOperation = th.blend;
        ctx.strokeStyle = rgba(light ? th.ink : color, (1 - b) * 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, R * (1.5 + 9 * easeOutCubic(b)), 0, 6.283); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // retícula de selección: entra cerrándose sobre la estrella, sale abriéndose
    if (selected && ring.s !== selected) ring = { s: selected, a: ring.s && ring.a > 0.2 ? 0.2 : 0, t0: t };
    ring.a += ((selected && ring.s === selected ? 1 : 0) - ring.a) * (reduced() ? 1 : 1 - Math.exp(-dt * 9));
    if (ring.s && ring.a > 0.01) {
      const s = ring.s;
      const [sx, sy] = toScreen(s.x, s.y);
      const base = s.size * zs * 4 + 10;
      const rr = base + (1 - ring.a) * 26 + Math.sin(t * 2) * 1;
      const rot = reduced() ? 0 : t * 0.25;
      ctx.strokeStyle = rgba(th.ink, 0.6 * ring.a); ctx.lineWidth = 0.9;
      for (let q = 0; q < 4; q++) { // cuatro arcos con huecos, como un visor
        const a0 = rot + q * Math.PI / 2 + 0.22, a1 = a0 + Math.PI / 2 - 0.44;
        ctx.beginPath(); ctx.arc(sx, sy, rr, a0, a1); ctx.stroke();
      }
      ctx.beginPath();
      for (let q = 0; q < 4; q++) {
        const an = rot + q * Math.PI / 2;
        ctx.moveTo(sx + Math.cos(an) * (rr - 3), sy + Math.sin(an) * (rr - 3));
        ctx.lineTo(sx + Math.cos(an) * (rr + 5), sy + Math.sin(an) * (rr + 5));
      }
      ctx.stroke();
    }

    // etiquetas (aparecen deslizándose)
    for (const s of SESSIONS) {
      if (s.la < 0.01) continue;
      const [sx, sy] = toScreen(s.x, s.y);
      const off = s.size * zs * 4 + 16 + (1 - s.la) * -8;
      ctx.textAlign = "left";
      ctx.font = `500 14px ${FONT_DISPLAY}`;
      if ("fontStretch" in ctx) ctx.fontStretch = "ultra-condensed";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "-0.6px";
      ctx.fillStyle = rgba(th.ink, 0.96 * s.la);
      ctx.fillText(s.title, sx + off, sy + 1);
      if ("fontStretch" in ctx) ctx.fontStretch = "normal";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.font = `400 9.5px ${FONT_MONO}`;
      ctx.fillStyle = rgba(th.muted, 0.95 * s.la);
      ctx.fillText(`${s.proj.name} · ${ago(s.lastActive)} · ${s.messages} mensajes`, sx + off, sy + 17);
    }
  }

  // Estrella fotografiada: corona, picos de difracción y núcleo incandescente.
  // En oscuro la luz se suma ("lighter"); en claro se tiñe sobre el blanco ("multiply").
  function drawStar(s, sx, sy, R, a, scint, color, t, light) {
    ctx.globalCompositeOperation = th.blend;
    const g = R * 11;
    ctx.globalAlpha = a * scint;
    ctx.drawImage(halo(color, light), sx - g, sy - g, g * 2, g * 2);

    const sp = clamp(s.spike + s.foc * 0.7, 0, 1.4);
    if (sp > 0.02) {
      const L = R * (5 + 9 * sp) * (0.92 + 0.08 * scint);
      ctx.globalAlpha = a * Math.min(1, sp) * (light ? 0.7 : 0.85);
      ctx.drawImage(spikes(color, light), sx - L, sy - L, L * 2, L * 2);
    }

    if (s.live && !reduced()) { // las sesiones de estos días laten
      const ph = ((t + s.pulsePhase) % 3.2) / 3.2;
      ctx.globalAlpha = a * (1 - ph) * (light ? 0.5 : 0.35);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, R * (1.4 + ph * 5), 0, 6.283); ctx.stroke();
    }

    ctx.globalCompositeOperation = light ? "source-over" : "lighter";
    const c = Math.max(2.4, R * 1.5);
    ctx.globalAlpha = Math.min(1, a + 0.25);
    ctx.drawImage(core(color, light), sx - c, sy - c, c * 2, c * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // ── interacción ──────────────────────────────────────────────
  function pick(sx, sy) {
    let best = null, bd = Infinity;
    const zs = Math.pow(cam.z, 0.55);
    for (const s of SESSIONS) {
      const [x, y] = toScreen(s.x, s.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d < Math.max(12, s.size * zs * 3) && d < bd) { best = s; bd = d; }
    }
    return best;
  }

  let drag = null;
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
  });
  canvas.addEventListener("pointermove", e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true; stopMotion(); canvas.classList.add("dragging"); hideHint();
        drag.x = e.clientX; drag.y = e.clientY; drag.cx = cam.x; drag.cy = cam.y;
      }
      if (drag.moved) {
        cam.x = drag.cx - (e.clientX - drag.x) / cam.z; cam.y = drag.cy - (e.clientY - drag.y) / cam.z;
        const n = performance.now(), ddt = Math.max(1, n - drag.lt) / 1000;
        const vx = -(e.clientX - drag.lx) / cam.z / ddt, vy = -(e.clientY - drag.ly) / cam.z / ddt;
        drag.vx = lerp(drag.vx, vx, 0.35); drag.vy = lerp(drag.vy, vy, 0.35);
        drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = n;
      }
      return;
    }
    hovered = pick(e.clientX, e.clientY);
    canvas.classList.toggle("pointing", !!hovered);
    statusHover(hovered);
  });
  canvas.addEventListener("pointerup", e => {
    canvas.classList.remove("dragging");
    if (drag && !drag.moved) {
      const s = pick(e.clientX, e.clientY);
      if (s) select(s); else closePanel();
    } else if (drag && drag.moved && !reduced() && performance.now() - drag.lt < 80) {
      inertia = { vx: drag.vx, vy: drag.vy };
    }
    drag = null;
  });
  canvas.addEventListener("pointerleave", () => { if (!drag) { hovered = null; statusHover(null); } });
  canvas.addEventListener("wheel", e => {
    e.preventDefault(); hideHint();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
  }, { passive: false });

  const viewCenter = () => [(W - panelW()) / 2, H / 2];
  document.getElementById("zoomIn").onclick = () => zoomAt(1.5, ...viewCenter());
  document.getElementById("zoomOut").onclick = () => zoomAt(1 / 1.5, ...viewCenter());
  document.getElementById("zoomFit").onclick = () => fitAll();

  // barra de estado: lo que hay bajo el cursor, nivel de zoom y hora
  const hint = document.getElementById("hint"), hintDefault = hint.textContent;
  let hintShown = null;
  function hideHint() {}
  function statusHover(s) {
    if (s === hintShown) return; hintShown = s;
    hint.textContent = s ? `${s.title} — ${s.proj.name} · ${s.messages} mensajes · ${ago(s.lastActive)}` : hintDefault;
    hint.classList.toggle("on", !!s);
  }
  const zoomEl = document.getElementById("zoomLevel"), clockEl = document.getElementById("clock");
  let zoomShown = -1;
  setInterval(() => {
    const z = Math.round(cam.z * 100);
    if (z !== zoomShown) { zoomShown = z; zoomEl.textContent = `${z} %`; }
  }, 120);
  const tickClock = () => { clockEl.textContent = new Intl.DateTimeFormat("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date()); };
  tickClock(); setInterval(tickClock, 15000);

  // búsqueda
  const search = document.getElementById("search");
  const searchCount = document.getElementById("searchCount");
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    const found = SESSIONS.filter(matches);
    searchCount.textContent = query ? `${found.length}/${SESSIONS.length}` : "";
    searchCount.classList.toggle("on", !!query);
    if (query && found.length === 1) flyTo(found[0].x, found[0].y, Math.max(cam.z, 1.6));
  });
  search.addEventListener("keydown", e => {
    if (e.key === "Enter") { const f = SESSIONS.filter(matches); if (f[0]) select(f[0]); search.blur(); }
  });
  function clearSearch() {
    search.value = ""; query = ""; searchCount.textContent = ""; searchCount.classList.remove("on"); search.blur();
  }

  const dotHTML = p => `<span class="dot" style="--cd:${p.cd};--cl:${p.cl}"></span>`;

  // leyenda
  const legend = document.getElementById("legend");
  projList.forEach(p => {
    const b = document.createElement("button");
    b.innerHTML = `${dotHTML(p)}<span></span><span class="n">${p.sessions.length}</span>`;
    b.children[1].textContent = p.name;
    b.onmouseenter = () => { hoverProject = p; };
    b.onmouseleave = () => { hoverProject = null; };
    b.onfocus = b.onmouseenter; b.onblur = b.onmouseleave;
    b.onclick = () => { closePanel(); flyTo(p.x, p.y, clamp(Math.min(W, H) / (p.radius * 3.2), 0.6, 3)); };
    legend.appendChild(b);
  });
  document.getElementById("stats").textContent = `${SESSIONS.length} sesiones · ${projList.length} proyectos · ${links.length} hilos`;

  // panel de sesión
  const $ = id => document.getElementById(id);
  const panel = $("panel"), inner = panel.querySelector(".panel-inner");
  [...inner.children].forEach((c, i) => c.style.setProperty("--i", i));

  function fillPanel(s) {
    $("pProject").innerHTML = dotHTML(s.proj) + "<span></span>";
    $("pProject").lastChild.textContent = s.proj.name;
    $("pTitle").textContent = s.title;
    $("pPrompt").textContent = s.firstPrompt || "";
    $("pStarted").textContent = fmtDate(s.started);
    $("pLast").textContent = ago(s.lastActive);
    $("pMsgs").textContent = s.messages;
    $("pId").textContent = s.id; $("pId").title = s.id;
    const ul = $("pLinks"); ul.innerHTML = "";
    s.links.forEach(l => {
      const o = l.a === s ? l.b : l.a;
      const li = document.createElement("li"), b = document.createElement("button");
      b.innerHTML = `${dotHTML(o.proj)}<span class="t"></span><span class="k">${l.kind === "chain" ? "mismo proyecto" : "relacionada"}</span>`;
      b.children[1].textContent = o.title;
      b.onmouseenter = () => { hovered = o; };
      b.onmouseleave = () => { hovered = null; };
      b.onclick = () => select(o);
      li.appendChild(b); ul.appendChild(li);
    });
  }

  let swapTimer = 0;
  function select(s) {
    if (s === selected) { flyTo(s.x, s.y, Math.max(cam.z, 1.5)); return; }
    const wasOpen = panel.classList.contains("open");
    selected = s; hovered = null;
    clearTimeout(swapTimer);
    if (wasOpen && !reduced()) {
      inner.classList.add("out");
      swapTimer = setTimeout(() => { fillPanel(s); inner.classList.remove("out"); }, 170);
    } else fillPanel(s);
    panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("panel-open");
    flyTo(s.x, s.y, Math.max(tween ? tween.to.z : cam.z, 1.5));
  }
  function closePanel() {
    if (!selected) return;
    selected = null;
    panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("panel-open");
  }
  $("panelClose").onclick = closePanel;

  const resumeCmd = s => `cd "${s.project}" && claude --resume ${s.id}`;
  function swapLabel(btn, text, back) {
    const span = btn.querySelector("span");
    btn.classList.add("swapping");
    setTimeout(() => { span.textContent = text; btn.classList.remove("swapping"); }, reduced() ? 0 : 140);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.add("swapping");
      setTimeout(() => { span.textContent = back; btn.classList.remove("swapping"); }, reduced() ? 0 : 140);
    }, 1600);
  }
  async function copy(btn, text) {
    try { await navigator.clipboard.writeText(text); swapLabel(btn, "Copiada", "Copiar orden"); }
    catch { swapLabel(btn, "No se pudo copiar", "Copiar orden"); }
  }
  $("pCopy").onclick = () => selected && copy($("pCopy"), resumeCmd(selected));

  // ── sesión a pantalla completa (simulada) ────────────────────
  // En la versión instalable, aquí se abrirá la terminal real con la sesión.
  // La sesión se muestra en bloques (un bloque por orden o por mensaje) y abajo hay un
  // compositor con adjuntos de imagen y un botón que se convierte en «parar» mientras Claude responde.
  const sessionEl = $("session"), sLog = $("sLog"), sScroll = $("sScroll"), sInput = $("sInput"), sForm = $("sForm");
  const sMain = sessionEl.querySelector(".s-main"), sFile = $("sFile"), sAttach = $("sAttach"), sSend = $("sSend");
  let current = null, camBefore = null, clipAnim = null;
  let run = 0;            // se incrementa para cancelar lo que se esté escribiendo
  let streaming = null;   // { stop() } mientras Claude responde
  let attachments = [];   // { file, url }

  const wait = ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms));
  const clock = () => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  const scrollDown = () => { sScroll.scrollTop = sScroll.scrollHeight; };

  function block({ prompt, cmd, time = clock(), imgs = [] }) {
    const b = document.createElement("div"); b.className = "block";
    const head = document.createElement("div"); head.className = "b-head";
    const c = document.createElement("div"); c.className = "b-cmd";
    const p = document.createElement("span"); p.className = "p"; p.textContent = cmd ? "$" : "›";
    c.append(p, document.createTextNode(prompt || ""));
    const tm = document.createElement("span"); tm.className = "b-time"; tm.textContent = time;
    head.append(c, tm); b.append(head);
    if (imgs.length) {
      const box = document.createElement("div"); box.className = "b-imgs";
      imgs.forEach(a => { const im = document.createElement("img"); im.src = a.url; im.alt = a.file.name; box.append(im); });
      b.append(box);
    }
    const out = document.createElement("div"); out.className = "b-out"; b.append(out);
    sLog.append(b); scrollDown();
    return { el: b, out, cmdText: c };
  }
  function outLine(out, text, cls) {
    const span = document.createElement("span"); if (cls) span.className = cls;
    span.textContent = text + "\n"; out.append(span); scrollDown(); return span;
  }
  async function typeInto(node, text, id) {
    if (reduced()) { node.textContent += text; return; }
    for (const ch of text) { if (id !== run) return; node.textContent += ch; scrollDown(); await new Promise(r => setTimeout(r, 6 + Math.random() * 12)); }
  }

  // respuesta simulada que llega palabra a palabra y se puede parar
  const REPLIES = [
    "Entendido. Primero reviso los archivos del proyecto para ver dónde encaja el cambio y luego te propongo los pasos antes de tocar nada.",
    "He mirado la estructura actual. Hay dos sitios donde conviene hacerlo: en la lógica de datos y en la vista. Empiezo por los datos, que es lo que menos riesgo tiene.",
    "Hecho el primer paso. Antes de seguir, ¿prefieres que lo deje en una rama aparte para que puedas probarlo tranquilo?",
  ];
  let replyN = 0;
  function respond(b, imgs) {
    b.el.classList.add("running");
    const id = ++run;
    const thinking = outLine(b.out, "", "thinking");
    thinking.innerHTML = `<span class="spin">✻</span> Pensando…\n`;
    let stopped = false;
    const text = (imgs.length ? `Veo ${imgs.length === 1 ? "la imagen que has adjuntado" : `las ${imgs.length} imágenes que has adjuntado`}. ` : "")
      + REPLIES[replyN++ % REPLIES.length] + "\n(Simulación: aquí respondería Claude de verdad.)";
    const finish = how => {
      if (streaming && streaming.id !== id) return;
      streaming = null; setBusy(false); b.el.classList.remove("running");
      const c = b.out.querySelector(".caret"); if (c) c.remove();
      if (how === "stop") outLine(b.out, "\n■ Respuesta detenida", "stopped");
      sInput.focus({ preventScroll: true });
    };
    streaming = { id, stop() { stopped = true; run++; thinking.remove(); finish("stop"); } };
    setBusy(true);
    (async () => {
      await wait(700 + Math.random() * 500);
      if (stopped || id !== run) return;
      thinking.remove();
      const span = document.createElement("span"); b.out.append(span);
      const caret = document.createElement("span"); caret.className = "caret"; b.out.append(caret);
      for (const word of text.split(/(\s+)/)) {
        if (stopped || id !== run) return;
        span.textContent += word; scrollDown();
        await wait(word.trim() ? 35 + Math.random() * 70 : 0);
      }
      if (window.cumuloMonitor) window.cumuloMonitor.addMessage(text.length, 0);
      finish("done");
    })();
  }
  function setBusy(v) {
    sForm.classList.toggle("busy", v);
    sSend.setAttribute("aria-label", v ? "Parar respuesta" : "Enviar");
    sSend.title = v ? "Parar respuesta (Esc)" : "Enviar (Enter)";
    updateSend();
  }
  function updateSend() { sSend.disabled = !streaming && !sInput.value.trim() && !attachments.length; }

  // adjuntos: botón (en el móvil abre cámara o galería), pegar y arrastrar
  function addFiles(files) {
    [...files].filter(f => f.type.startsWith("image/")).forEach(file => {
      const a = { file, url: URL.createObjectURL(file) };
      attachments.push(a);
      const el = document.createElement("div"); el.className = "att";
      el.innerHTML = `<img alt=""><button type="button" aria-label="Quitar imagen"><svg class="ico" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
      el.querySelector("img").src = a.url; el.querySelector("img").alt = file.name;
      el.querySelector("button").onclick = () => {
        attachments = attachments.filter(x => x !== a); el.remove();
        sAttach.hidden = !attachments.length; updateSend(); sInput.focus({ preventScroll: true });
      };
      sAttach.append(el);
    });
    sAttach.hidden = !attachments.length; updateSend();
  }
  sFile.addEventListener("change", () => { addFiles(sFile.files); sFile.value = ""; sInput.focus({ preventScroll: true }); });
  sInput.addEventListener("paste", e => {
    const files = [...(e.clipboardData ? e.clipboardData.files : [])];
    if (files.some(f => f.type.startsWith("image/"))) { e.preventDefault(); addFiles(files); }
  });
  let dragDepth = 0;
  sMain.addEventListener("dragenter", e => { if ([...e.dataTransfer.types].includes("Files")) { dragDepth++; sMain.classList.add("dragover"); } });
  sMain.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; sMain.classList.remove("dragover"); } });
  sMain.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  sMain.addEventListener("drop", e => { e.preventDefault(); dragDepth = 0; sMain.classList.remove("dragover"); addFiles(e.dataTransfer.files); });

  // el cuadro crece con el texto
  function autosize() { sInput.style.height = "auto"; sInput.style.height = Math.min(sInput.scrollHeight, 172) + "px"; }
  sInput.addEventListener("input", () => { autosize(); updateSend(); });
  sInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); sForm.requestSubmit(); }
  });
  sForm.addEventListener("submit", e => {
    e.preventDefault();
    if (streaming) { streaming.stop(); return; }
    const text = sInput.value.trim();
    if (!text && !attachments.length) return;
    const imgs = attachments; attachments = [];
    sAttach.innerHTML = ""; sAttach.hidden = true;
    sInput.value = ""; autosize();
    const b = block({ prompt: text || (imgs.length === 1 ? "(imagen)" : `(${imgs.length} imágenes)`), imgs });
    if (window.cumuloMonitor) window.cumuloMonitor.addMessage(text.length, imgs.length);
    respond(b, imgs);
  });
  sScroll.addEventListener("click", () => { if (!String(window.getSelection())) sInput.focus({ preventScroll: true }); });

  async function intro(s, proj, id) {
    const b = block({ cmd: true, prompt: s ? `claude --resume ${s.id}` : "claude", time: clock() });
    await wait(450); if (id !== run) return;
    if (s) {
      outLine(b.out, `Reanudando «${s.title}» · ${s.messages} mensajes · última vez ${ago(s.lastActive)}`, "d");
      await wait(250); if (id !== run) return;
      const prev = block({ prompt: s.firstPrompt || "", time: fmtDate(s.started) });
      outLine(prev.out, `… ${Math.max(0, s.messages - 1)} mensajes anteriores`, "d");
    } else {
      outLine(b.out, "Nueva sesión. Al terminar aparecerá como una estrella nueva en el cúmulo.", "d");
    }
    outLine(b.out, "(Simulación: en la versión instalable aquí se abre Claude de verdad.)", "d");
  }

  function openSession(s, origin) {
    if (window.cumuloMonitor) window.cumuloMonitor.setSession(s);
    const proj = s ? s.proj : ((selected && selected.proj) || hoverProject || projList[0]);
    current = { s, proj };
    $("sProject").innerHTML = proj ? dotHTML(proj) : "";
    $("sTitle").textContent = s ? s.title : "Nueva sesión";
    $("sMeta").textContent = proj ? proj.path : "";
    $("sId").textContent = s ? s.id : "sin guardar todavía";
    if (streaming) streaming.stop();
    sLog.innerHTML = ""; sInput.value = ""; autosize();
    attachments = []; sAttach.innerHTML = ""; sAttach.hidden = true; updateSend();

    // la cámara se zambulle en la estrella mientras se abre la vista
    camBefore = { x: cam.x, y: cam.y, z: cam.z };
    if (s) flyTo(s.x, s.y, Math.min(ZMAX, Math.max(cam.z, 1.5) * 2.4), { dur: 900, noPanel: true, noDip: true });

    sessionEl.classList.remove("closing");
    sessionEl.classList.add("open"); sessionEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("session-open");
    const [x, y] = origin || [W / 2, H / 2];
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
    if (clipAnim) clipAnim.cancel();
    if (!reduced()) {
      clipAnim = sessionEl.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(.65,0,.35,1)" }
      );
    }
    const id = ++run;
    setTimeout(() => { if (id === run) { intro(s, proj, id); if (!matchMedia("(pointer: coarse)").matches) sInput.focus({ preventScroll: true }); } }, reduced() ? 0 : 420);
  }

  function closeSession() {
    if (!sessionEl.classList.contains("open")) return;
    if (streaming) streaming.stop();
    run++;
    const s = current && current.s;
    let [x, y] = s ? toScreen(s.x, s.y) : [W / 2, H / 2];
    if (!s) { const b = $("newSession").getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; }
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y));
    sessionEl.classList.remove("open"); sessionEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("session-open");
    if (camBefore && s) flyTo(camBefore.x, camBefore.y, camBefore.z, { dur: 850, noPanel: true, noDip: true, ease: easeOutQuart });
    if (clipAnim) clipAnim.cancel();
    if (reduced()) return;
    sessionEl.classList.add("closing");
    clipAnim = sessionEl.animate(
      { clipPath: [`circle(${r}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`] },
      { duration: 560, easing: "cubic-bezier(.65,0,.35,1)", delay: 40 }
    );
    clipAnim.onfinish = () => { sessionEl.classList.remove("closing"); clipAnim = null; };
    const back = s ? $("pResume") : $("newSession");
    setTimeout(() => back.focus({ preventScroll: true }), 300);
  }

  $("sBack").onclick = closeSession;
  $("sCopy").onclick = () => {
    if (!current) return;
    copy($("sCopy"), current.s ? resumeCmd(current.s) : `cd "${current.proj ? current.proj.path : "."}" && claude`);
  };
  $("pResume").onclick = () => {
    if (!selected) return;
    const [x, y] = toScreen(selected.x, selected.y);
    openSession(selected, [x, y]);
  };
  $("newSession").onclick = () => {
    const b = $("newSession").getBoundingClientRect();
    openSession(null, [b.left + b.width / 2, b.top + b.height / 2]);
  };

  // teclado (como en Claude Code: Esc para una respuesta en curso; si no hay ninguna, vuelve al cúmulo)
  window.addEventListener("keydown", e => {
    const inSession = sessionEl.classList.contains("open");
    if (e.key === "Escape") {
      if (inSession) { if (streaming) streaming.stop(); else closeSession(); }
      else if (document.activeElement === search) clearSearch();
      else closePanel();
    } else if (e.key === "/" && !inSession && document.activeElement !== search) {
      e.preventDefault(); search.focus();
    } else if (e.key === "Enter" && !inSession && selected && e.target === document.body) {
      $("pResume").click();
    }
  });

  window.addEventListener("resize", resize);
  resize();

  // entrada: empieza lejos y se acerca mientras nacen las estrellas
  const b0 = bounds();
  cam.x = b0.x; cam.y = b0.y; cam.z = b0.z * (reduced() ? 1 : 0.5);
  flyTo(b0.x, b0.y, b0.z, { dur: 2600, ease: easeOutQuart, noDip: true });
  requestAnimationFrame(frame);
})();
