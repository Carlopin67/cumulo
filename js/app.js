// Cúmulo — lanzador de sesiones de Claude como cúmulo de estrellas.
// Lee los datos de window.CUMULO_DATA (data/sessions.js). Todo lo demás se calcula aquí.
(() => {
  "use strict";

  const DATA = window.CUMULO_DATA || {};

  // Colores por proyecto. Oscuro: temperaturas de estrellas reales. Claro: tintas de atlas impreso.
  const PAL_DARK = ["#9fbaff", "#ffd29a", "#cddaff", "#ffae78", "#efeaff", "#ffe2bd", "#8fa9f2", "#ffc08a"];
  const PAL_LIGHT = ["#3d6bff", "#ff9a2e", "#6f8cff", "#ff6a3a", "#8a6cff", "#ffb23e", "#2f7dff", "#ff7f45"];
  // El plano Ask usa otra gama (verdes de nebulosa y violetas) para no confundirse con las sesiones.
  const ASK_DARK = ["#8ff0d6", "#c9b6ff", "#9fdcff", "#f3b3e6", "#b8f59a", "#a7c4ff"];
  const ASK_LIGHT = ["#0fa888", "#7c4dff", "#1590d6", "#d23aa6", "#4f9e1c", "#3f63e8"];

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

  // ── disposición: dos planos, uno por modo ───────────────────
  // «code»: sesiones de Claude Code (primer plano). «ask»: chats del modo Ask (detrás).
  const GA = Math.PI * (3 - Math.sqrt(5)); // ángulo áureo
  const now0 = Date.now();
  const DAY = 86400000;

  function buildPlane(kind, list, pal, rot) {
    const sessions = list.map(s => ({ ...s }));
    const projects = new Map();
    sessions.forEach(s => {
      const key = s.project || "Sin proyecto";
      if (!projects.has(key)) projects.set(key, { path: key, name: s.projectName || folderName(key), sessions: [] });
      projects.get(key).sessions.push(s);
    });
    const projList = [...projects.values()].sort((a, b) => b.sessions.length - a.sessions.length);
    const plane = { kind, sessions, projList, links: [], cam: null, depth: kind === "code" ? 0 : 1 };
    // radio de cada cúmulo según cuántas estrellas tiene (para colocarlos sin que se pisen)
    projList.forEach(p => { p.radius = 46 * Math.sqrt(p.sessions.length + 0.4) + 24; });
    const placed = [];
    projList.forEach((p, i) => {
      // espiral áurea: se aleja hasta encontrar un hueco donde no toque a los ya colocados
      const a = i * GA + rot;
      let r = i === 0 ? 0 : 60 + 30 * Math.sqrt(i);
      for (let tries = 0; tries < 400; tries++) {
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.78;
        if (placed.every(o => Math.hypot(o.x - x, o.y - y) > o.radius + p.radius + 6)) { p.x = x; p.y = y; break; }
        r += 6;
      }
      placed.push(p);
      p.cd = pal[0][i % pal[0].length]; p.cl = pal[1][i % pal[1].length];
      p.la = 0; p.plane = plane;
      p.sessions.sort((a, b) => new Date(a.started) - new Date(b.started));
      const R = rng(hash(kind + p.path));
      let maxR = 0;
      p.sessions.forEach((s, k) => {
        const rr = 46 * Math.sqrt(k + 0.4) + R() * 20;
        const aa = k * GA + R() * 0.9;
        s.x = p.x + Math.cos(aa) * rr; s.y = p.y + Math.sin(aa) * rr;
        s.proj = p; s.plane = plane;
        // actividad: cuanto más reciente, más brilla, más grande y más titila; las viejas quedan como polvo
        const age = Math.max(0, (now0 - new Date(s.lastActive || s.started)) / DAY);
        s.age = age;
        s.rec = Math.exp(-age / 9);
        const lm = Math.log2(1 + (s.messages || 1));
        s.size = (1.3 + lm * 0.5) * (0.72 + 0.4 * s.rec);
        s.spike = kind === "ask" ? 0 : clamp((lm - 4.3) / 2.2, 0, 1) * (0.35 + 0.65 * s.rec);
        s.glow = 0.28 + 0.72 * s.rec;
        s.twAmp = 0.03 + 0.3 * Math.exp(-age / 4); // titileo: casi quieto si es vieja, vivo si es de estos días
        s.twSp = 0.7 + 1.6 * Math.exp(-age / 4);
        s.live = age < 3;                           // activa estos días: late
        s.twinkle = R() * Math.PI * 2;
        s.pulsePhase = R() * 4;
        s.dim = 0; s.foc = 0; s.la = 0;
        maxR = Math.max(maxR, rr);
      });
      p.radius = maxR + 20;
    });
    // hilos del proyecto: cada estrella se une a la más cercana de las anteriores (constelación, no maraña)
    plane.chain = [];
    projList.forEach(p => p.sessions.forEach((s, k) => {
      if (!k) return;
      let best = null, bd = Infinity;
      for (let j = 0; j < k; j++) { const o = p.sessions[j], d = Math.hypot(o.x - s.x, o.y - s.y); if (d < bd) { bd = d; best = o; } }
      plane.chain.push([best, s]);
    }));
    [...sessions].sort((a, b) => new Date(a.started) - new Date(b.started)).forEach((s, i, arr) => {
      s.delay = (kind === "ask" ? 0.9 : 0.35) + (arr.length > 1 ? i / (arr.length - 1) : 0) * 1.5; // nacen en orden de fecha
    });
    return plane;
  }
  const PLANES = {
    code: buildPlane("code", DATA.sessions || [], [PAL_DARK, PAL_LIGHT], 0.7),
    ask: buildPlane("ask", DATA.chats || [], [ASK_DARK, ASK_LIGHT], 2.3),
  };
  const ALL = [...PLANES.code.sessions, ...PLANES.ask.sessions];
  const byId = new Map(ALL.map(s => [s.id, s]));

  // ── hilos ────────────────────────────────────────────────────
  // dentro de un plano: cadena por proyecto y relaciones; entre planos: hilos que cruzan la profundidad
  const crossLinks = [];
  const linkKey = (a, b) => a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
  const seen = new Set();
  const addLink = (a, b, kind) => {
    const k = linkKey(a, b); if (a === b || seen.has(k)) return; seen.add(k);
    const R = rng(hash(k));
    const l = { a, b, kind, bend: (R() - 0.5) * 0.5, phase: R() * 10, hl: 0, dim: 0 };
    if (a.plane === b.plane) a.plane.links.push(l); else { l.kind = "cross"; crossLinks.push(l); }
  };
  Object.values(PLANES).forEach(P => P.chain.forEach(([a, b]) => addLink(a, b, "chain")));
  ALL.forEach(s => (s.related || []).forEach(id => { const t = byId.get(id); if (t) addLink(s, t, "related"); }));
  ALL.forEach(s => s.links = [...s.plane.links, ...crossLinks].filter(l => l.a === s || l.b === s));

  // plano activo: todo lo interactivo (búsqueda, leyenda, selección…) trabaja sobre él
  let P = PLANES.code, SESSIONS = P.sessions, projList = P.projList, links = P.links;
  const other = () => (P === PLANES.code ? PLANES.ask : PLANES.code);

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
  let ctx = canvas.getContext("2d");
  const mainCtx = ctx;
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
  let V = cam; // vista con la que se proyecta lo que se dibuja (la cámara, o la del plano de detrás)
  const toScreen = (x, y) => [(x - V.x) * V.z + W / 2, (y - V.y) * V.z + H / 2];
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
  function bounds(plane = P) {
    const list = plane.sessions;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(s => { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); });
    plane.projList.forEach(p => { y0 = Math.min(y0, p.y - p.radius - 14); }); // deja sitio a los nombres de arriba
    if (!list.length) { x0 = y0 = -100; x1 = y1 = 100; }
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
  // Cada plano se dibuja con su propia vista. El de detrás va a un lienzo aparte que se
  // compone desenfocado, más pequeño y más apagado (profundidad de campo).
  const off = document.createElement("canvas"), offCtx = off.getContext("2d");
  const depthScale = d => lerp(1, 0.7, d);
  const depthBlur = d => d * 3.2;
  const depthAlpha = d => lerp(1, theme === "light" ? 0.78 : 0.8, d);
  const drift = { x: 0, y: 0 }, lastCam = { x: 0, y: 0, z: 1 }; // paralaje del polvo, continuo al cambiar de plano
  let shift = null; // transición entre planos en curso

  // vista del plano de detrás: su propia cámara, con paralaje (se mueve menos que la de delante)
  function viewOf(plane) {
    if (plane === P) return cam;
    const c = plane.cam, a = P.anchor || cam;
    const f = 0.3 * cam.z / c.z;
    return { x: c.x + (cam.x - a.x) * f, y: c.y + (cam.y - a.y) * f, z: c.z * Math.pow(cam.z / a.z, 0.3) };
  }
  // posición en pantalla de un punto de cualquier plano, con su escala de profundidad
  function project(plane, x, y) {
    const v = viewOf(plane), k = depthScale(plane.depth);
    return [W / 2 + (x - v.x) * v.z * k, H / 2 + (y - v.y) * v.z * k];
  }

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

    // cambio de plano: el de delante retrocede y se desenfoca, el de detrás avanza y se enfoca
    let sw = 0;
    if (shift) {
      const p = clamp((now - shift.t0) / shift.dur, 0, 1), e = easeInOutCubic(p);
      shift.from.depth = lerp(shift.a0, 1, e); shift.to.depth = lerp(shift.b0, 0, e);
      sw = Math.sin(Math.PI * p);
      if (p >= 1) shift = null;
    }

    ctx = mainCtx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(th.bg, 1); ctx.fillRect(0, 0, W, H);

    // polvo con paralaje; durante el cambio de plano se abre hacia los bordes, como al avanzar
    drift.x += (cam.x - lastCam.x) * cam.z; drift.y += (cam.y - lastCam.y) * cam.z;
    lastCam.x = cam.x; lastCam.y = cam.y; lastCam.z = cam.z;
    // al entrar o salir de una sesión, el polvo se estira en estelas desde la estrella
    const dv = diveWarp();
    const wcx = dv ? dv.x : W / 2, wcy = dv ? dv.y : H / 2;
    const warp = Math.max(sw * 0.6, dv ? dv.k : 0);
    for (const b of dust) {
      let sx = ((b.x - drift.x * b.d) % W + W) % W;
      let sy = ((b.y - drift.y * b.d) % H + H) % H;
      const a = b.a * th.dustA * (0.7 + 0.3 * Math.sin(t * b.sp + b.tw));
      if (warp > 0.01) {
        const w = 1 + warp * (dv ? 0.35 + b.d * 2.6 : b.d);
        const ex = wcx + (sx - wcx) * w, ey = wcy + (sy - wcy) * w;
        if (dv) { // estela: del punto a su posición estirada, más larga y brillante cuanto más cerca del borde
          const far = Math.min(1, Math.hypot(ex - wcx, ey - wcy) / (Math.hypot(W, H) / 2));
          ctx.strokeStyle = rgba(th.dust, Math.min(0.85, a * (1.1 + warp * 0.6) * (0.35 + far)));
          ctx.lineWidth = b.r * (1 + warp * 0.35);
          ctx.beginPath(); ctx.moveTo(lerp(sx, ex, 0.08), lerp(sy, ey, 0.08)); ctx.lineTo(ex, ey); ctx.stroke();
          continue;
        }
        sx = ex; sy = ey;
      }
      ctx.fillStyle = rgba(th.dust, a);
      ctx.fillRect(sx, sy, b.r * 1.3, b.r * 1.3);
    }

    const [back, front] = [PLANES.code, PLANES.ask].sort((a, b) => b.depth - a.depth);
    renderPlane(back, t, dt, k, light);
    drawCross(t, k, light);
    renderPlane(front, t, dt, k, light);
    ctx = mainCtx; V = cam;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawDive(now, light);
  }

  // ── salto a una estrella (entrar / salir de una sesión) ───────
  // Al entrar, el brillo de la estrella crece hasta llenar la pantalla y la sesión surge de esa luz.
  // Al salir, la luz se condensa de vuelta en la estrella, que late una vez al recibirla.
  let dive = null; // { s, t0, dur, dir: 1 entrar | -1 salir }
  let labelHidden = null; // etiqueta que está viajando (no se dibuja en el lienzo)
  function diveProgress(now = performance.now()) {
    if (!dive) return null;
    const p = (now - dive.t0) / dive.dur;
    if (p >= 1) { dive = null; return null; }
    return Math.max(0, p);
  }
  // el salto se centra en la pantalla: el foco va de la estrella al centro mientras la cámara llega
  function diveCenter(p) {
    const [x, y] = toScreen(dive.s.x, dive.s.y);
    const c = dive.dir > 0 ? easeOutCubic(clamp(p * 1.6, 0, 1)) : 1 - easeInOutCubic(clamp(p * 1.3, 0, 1));
    return [lerp(x, W / 2, c), lerp(y, H / 2, c)];
  }
  function diveWarp() {
    const p = diveProgress(); if (p === null) return null;
    const [x, y] = diveCenter(p);
    const k = dive.dir > 0 ? Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.1)), 0.8) * 1.8 : Math.sin(Math.PI * p) * 0.9;
    return { x, y, k };
  }
  function drawDive(now, light) {
    const p = diveProgress(now); if (p === null) return;
    const s = dive.s, color = colorOf(s.proj);
    const [x, y] = diveCenter(p);
    const far = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.15;
    let r, a;
    if (dive.dir > 0) {
      r = lerp(10, far, Math.pow(easeInOutCubic(p), 1.35));
      a = p < 0.55 ? easeOutCubic(p / 0.55) : 1;
    } else {
      r = lerp(far * 0.7, 6, easeOutCubic(p));
      a = p < 0.15 ? p / 0.15 : 1 - easeInOutCubic((p - 0.15) / 0.85);
    }
    ctx.globalCompositeOperation = light ? "multiply" : "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (light) {
      g.addColorStop(0, rgba(color, 0.9 * a)); g.addColorStop(0.18, rgba(color, 0.55 * a)); g.addColorStop(0.5, rgba(color, 0.18 * a)); g.addColorStop(1, rgba(color, 0));
    } else {
      g.addColorStop(0, `rgba(255,252,246,${0.95 * a})`); g.addColorStop(0.12, rgba(color, 0.7 * a));
      g.addColorStop(0.45, rgba(color, 0.18 * a)); g.addColorStop(1, rgba(color, 0));
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    // al volver, la estrella late al recibir la luz
    if (dive.dir < 0 && p > 0.6) {
      const q = (p - 0.6) / 0.4, R = s.size * Math.pow(cam.z, 0.55);
      const [x, y] = toScreen(s.x, s.y);
      ctx.strokeStyle = rgba(light ? th.ink : color, (1 - q) * 0.7); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, R * (2 + 12 * easeOutCubic(q)), 0, 6.283); ctx.stroke();
    }
  }

  function renderPlane(plane, t, dt, k, light) {
    const d = plane.depth, sc = depthScale(d);
    const soft = d > 0.015;
    V = viewOf(plane);
    if (soft) {
      if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
      ctx = offCtx;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.setTransform(sc, 0, 0, sc, W / 2 * (1 - sc), H / 2 * (1 - sc));
    } else {
      ctx = mainCtx;
      ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * W / 2 * (1 - sc), DPR * H / 2 * (1 - sc));
    }
    drawPlane(plane, d, sc, t, dt, k, light);
    if (soft) {
      ctx = mainCtx;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = `blur(${depthBlur(d).toFixed(2)}px) saturate(${lerp(1, 0.85, d).toFixed(2)})`;
      ctx.globalAlpha = depthAlpha(d);
      ctx.drawImage(off, 0, 0, W, H);
      ctx.filter = "none"; ctx.globalAlpha = 1;
    }
  }

  function drawPlane(plane, d, sc, t, dt, k, light) {
    const active = plane === P;
    const near = 1 - d; // 1 delante, 0 detrás
    const list = plane.sessions;
    const focus = active ? (selected || hovered) : null;
    const hp = active ? hoverProject : null;
    const q = active ? query : "";
    const lit = focus ? new Set(focus.links.flatMap(l => [l.a, l.b])) : null;
    // lo que el plano tiene visible (en coordenadas antes de la escala de profundidad)
    const mx = (W / 2 + 140) / sc, my = (H / 2 + 140) / sc;
    const x0 = W / 2 - mx, x1 = W / 2 + mx, y0 = H / 2 - my, y1 = H / 2 + my;

    // retícula celeste: solo la del plano que está delante
    if (near > 0.02) {
      ctx.strokeStyle = rgba(th.ink, th.grid * near * near); ctx.lineWidth = 0.6;
      const [ox, oy] = toScreen(0, 0);
      for (let r = 320; r <= 2240; r += 320) { ctx.beginPath(); ctx.arc(ox, oy, r * V.z, 0, 6.283); ctx.stroke(); }
      ctx.beginPath();
      for (let a = 0; a < 12; a++) {
        const an = a * Math.PI / 6;
        ctx.moveTo(ox + Math.cos(an) * 320 * V.z, oy + Math.sin(an) * 320 * V.z);
        ctx.lineTo(ox + Math.cos(an) * 2240 * V.z, oy + Math.sin(an) * 2240 * V.z);
      }
      ctx.stroke();
    }

    // estados animados
    const kk = reduced() ? 1 : 1 - Math.exp(-dt * 14);
    for (const s of list) {
      const dimT = (q && !matches(s)) || (lit && !lit.has(s)) || (hp && s.proj !== hp) ? 1 : 0;
      s.dim += (dimT - s.dim) * k;
      s.foc += ((s === focus || (!active && lit0 && lit0.has(s)) ? 1 : 0) - s.foc) * k;
      s.la += ((active && (s === hovered || s === selected) ? 1 : 0) - s.la) * kk;
    }

    // hilos
    ctx.lineCap = "round";
    for (const l of plane.links) {
      const on = focus && (l.a === focus || l.b === focus);
      const projOn = hp && l.a.proj === hp && l.b.proj === hp;
      const dimT = (q && !(matches(l.a) && matches(l.b))) || (focus && !on && !projOn) || (hp && !projOn) ? 1 : 0;
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
    const labelZ = clamp((V.z - 0.35) * 1.6, 0, 0.6);
    const labelIntro = reduced() ? 1 : easeOutCubic(clamp((t - introT0 - 1.4) / 1, 0, 1));
    ctx.font = `500 9px ${FONT_MONO}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = "1.6px";
    ctx.textAlign = "center";
    for (const p of plane.projList) {
      const target = hp === p ? 1 : (hp || (focus && focus.proj !== p) ? labelZ * 0.35 : labelZ);
      p.la += (target - p.la) * k;
      const a = p.la * labelIntro * near * near;
      if (a < 0.01) continue;
      const [sx, sy] = toScreen(p.x, p.y - p.radius);
      ctx.fillStyle = rgba(th.ink, a * (light ? 0.9 : 0.85));
      ctx.fillText(p.name.toUpperCase(), sx, sy - 8 + (1 - labelIntro) * 6);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

    // estrellas
    const zs = Math.pow(V.z, 0.55);
    const still = reduced();
    for (const s of list) {
      const [sx, sy] = toScreen(s.x, s.y);
      if (sx < x0 || sy < y0 || sx > x1 || sy > y1) continue;
      const b = birth(s);
      if (b <= 0) continue;
      // titileo según la actividad: las de estos días centellean, las viejas casi no se mueven
      const tw = still ? 0 : Math.sin(t * 1.3 * s.twSp + s.twinkle) * Math.sin(t * 0.71 * s.twSp + s.twinkle * 2);
      const scint = 1 - s.twAmp * 0.5 + s.twAmp * 0.5 * tw;
      // en el plano de atrás se compensa el desenfoque: hasta las viejas aportan luz al cúmulo
      const a = Math.min(1, s.glow * lerp(1, 1.7, d)) * lerp(1, 0.18, s.dim) * easeOutCubic(b);
      const R = s.size * zs * easeOutBack(b) * (1 + 0.3 * s.foc) * lerp(1, 1.25, d);
      const color = colorOf(s.proj);

      drawStar(s, sx, sy, R, a, scint, color, t, light);

      // destello de nacimiento
      if (b < 1 && !still && near > 0.5) {
        ctx.globalCompositeOperation = th.blend;
        ctx.strokeStyle = rgba(light ? th.ink : color, (1 - b) * 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, R * (1.5 + 9 * easeOutCubic(b)), 0, 6.283); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (!active) return;

    // retícula de selección: entra cerrándose sobre la estrella, sale abriéndose
    if (selected && ring.s !== selected) ring = { s: selected, a: ring.s && ring.a > 0.2 ? 0.2 : 0, t0: t };
    ring.a += ((selected && ring.s === selected ? 1 : 0) - ring.a) * (reduced() ? 1 : 1 - Math.exp(-dt * 9));
    if (ring.s && ring.a > 0.01 && ring.s.plane === plane) {
      const s = ring.s;
      const [sx, sy] = toScreen(s.x, s.y);
      const base = s.size * zs * 4 + 10;
      const rr = base + (1 - ring.a) * 26 + Math.sin(t * 2) * 1;
      const rot = reduced() ? 0 : t * 0.25;
      ctx.strokeStyle = rgba(th.ink, 0.6 * ring.a * near); ctx.lineWidth = 0.9;
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
    for (const s of list) {
      if (s.la < 0.01 || s === labelHidden) continue;
      const [sx, sy] = toScreen(s.x, s.y);
      const off = s.size * zs * 4 + 16 + (1 - s.la) * -8;
      ctx.textAlign = "left";
      ctx.font = `500 14px ${FONT_DISPLAY}`;
      if ("fontStretch" in ctx) ctx.fontStretch = "ultra-condensed";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "-0.6px";
      ctx.fillStyle = rgba(th.ink, 0.96 * s.la * near);
      ctx.fillText(s.title, sx + off, sy + 1);
      if ("fontStretch" in ctx) ctx.fontStretch = "normal";
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.font = `400 9.5px ${FONT_MONO}`;
      ctx.fillStyle = rgba(th.muted, 0.95 * s.la * near);
      ctx.fillText(`${s.proj.name} · ${ago(s.lastActive)} · ${s.messages} mensajes`, sx + off, sy + 17);
    }
  }

  // hilos entre planos: unen un chat con la sesión de Code relacionada a través de la profundidad
  let lit0 = null; // estrellas del otro plano unidas a la que tienes enfocada
  function drawCross(t, k, light) {
    ctx = mainCtx; V = cam;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const focus = selected || hovered;
    lit0 = focus ? new Set(focus.links.filter(l => l.kind === "cross").flatMap(l => [l.a, l.b])) : null;
    ctx.lineCap = "round";
    for (const l of crossLinks) {
      const on = focus && (l.a === focus || l.b === focus);
      l.hl += ((on ? 1 : 0) - l.hl) * k;
      const grow = reduced() || introT0 === null ? 1 : clamp((t - introT0 - Math.max(l.a.delay, l.b.delay) - 0.6) / 0.9, 0, 1);
      if (grow <= 0) continue;
      // el extremo de delante es el más nítido; hacia el fondo se apaga
      const [fr, bk] = l.a.plane.depth <= l.b.plane.depth ? [l.a, l.b] : [l.b, l.a];
      const [fx, fy] = project(fr.plane, fr.x, fr.y), [bx, by] = project(bk.plane, bk.x, bk.y);
      if (Math.max(fx, bx) < -50 || Math.min(fx, bx) > W + 50 || Math.max(fy, by) < -50 || Math.min(fy, by) > H + 50) continue;
      const a = lerp(light ? 0.16 : 0.12, light ? 0.75 : 0.65, l.hl) * easeOutCubic(grow);
      const g = ctx.createLinearGradient(fx, fy, bx, by);
      g.addColorStop(0, rgba(th.relatedLink, a)); g.addColorStop(1, rgba(th.relatedLink, a * lerp(0.12, 0.4, l.hl)));
      ctx.strokeStyle = g; ctx.lineWidth = lerp(0.7, 1.1, l.hl);
      ctx.setLineDash([1.5, 5]);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(lerp(fx, bx, grow), lerp(fy, by, grow)); ctx.stroke();
      // una chispa sube de vez en cuando desde el fondo hacia delante
      const cyc = (t * 0.1 + l.phase) % 5;
      if (cyc < 1 && grow >= 1) {
        const e = easeInOutCubic(cyc);
        ctx.fillStyle = rgba(th.relatedLink, Math.sin(cyc * Math.PI) * lerp(0.5, 0.95, l.hl));
        ctx.beginPath(); ctx.arc(lerp(bx, fx, e), lerp(by, fy, e), lerp(0.6, 1.4, e), 0, 6.283); ctx.fill();
      }
    }
    ctx.setLineDash([]);
  }

  // Estrella fotografiada: corona, picos de difracción y núcleo incandescente.
  // En oscuro la luz se suma ("lighter"); en claro se tiñe sobre el blanco ("multiply").
  // Los chats de Ask son más redondos: sin picos, núcleo más ancho y un anillo fino.
  function drawStar(s, sx, sy, R, a, scint, color, t, light) {
    const ask = s.plane.kind === "ask";
    ctx.globalCompositeOperation = th.blend;
    const g = R * (7 + 4 * s.rec);
    ctx.globalAlpha = a * scint;
    ctx.drawImage(halo(color, light), sx - g, sy - g, g * 2, g * 2);

    const sp = ask ? 0 : clamp(s.spike + s.foc * 0.7, 0, 1.4);
    if (sp > 0.02) {
      const L = R * (5 + 9 * sp) * (0.92 + 0.08 * scint);
      ctx.globalAlpha = a * Math.min(1, sp) * (light ? 0.7 : 0.85);
      ctx.drawImage(spikes(color, light), sx - L, sy - L, L * 2, L * 2);
    }
    if (ask) {
      ctx.globalAlpha = a * (light ? 0.55 : 0.4) * (0.7 + 0.3 * s.rec + 0.3 * s.foc);
      ctx.strokeStyle = color; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx, sy, R * 2.3 + 1.5, 0, 6.283); ctx.stroke();
    }

    if (s.live && !reduced()) { // las de estos días laten
      const ph = ((t + s.pulsePhase) % 3.2) / 3.2;
      ctx.globalAlpha = a * (1 - ph) * (light ? 0.5 : 0.35);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx, sy, R * (1.4 + ph * 5), 0, 6.283); ctx.stroke();
    }

    ctx.globalCompositeOperation = light ? "source-over" : "lighter";
    const c = Math.max(2.4, R * (ask ? 1.8 : 1.5));
    ctx.globalAlpha = Math.min(1, a + 0.25 * (0.4 + 0.6 * s.rec));
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
        drag.moved = true; stopMotion(); canvas.classList.add("dragging");
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
  // trackpad: dos dedos desplazan el mapa; pellizcar (o Ctrl + rueda) acerca y aleja
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    if (e.ctrlKey) { zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); return; }
    tween = null; zoomGoal = null; inertia = null;
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1; // líneas o páginas → píxeles
    cam.x += e.deltaX * k / cam.z; cam.y += e.deltaY * k / cam.z;
  }, { passive: false });
  function statusHover() {} // la barra inferior ya no muestra lo que hay bajo el cursor

  // bandeja del sistema: wifi, volumen, batería y reloj
  const clockTime = document.getElementById("clockTime"), clockDate = document.getElementById("clockDate");
  const tickClock = () => {
    const d = new Date();
    clockTime.textContent = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(d);
    clockDate.textContent = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(/[.,]/g, "");
  };
  tickClock(); setInterval(tickClock, 10000);
  const wifi = document.getElementById("trayWifi");
  const net = () => wifi.classList.toggle("off", !navigator.onLine);
  addEventListener("online", net); addEventListener("offline", net); net();
  // batería real si el navegador la da (Chrome, Edge); si no, se queda en 100 % cargando
  const batFill = document.getElementById("batFill"), batBolt = document.getElementById("batBolt"), batPct = document.getElementById("batPct");
  const showBat = (level, charging) => {
    const pct = Math.round(level * 100);
    batPct.textContent = pct + " %";
    batFill.setAttribute("width", Math.max(0.6, 13.6 * level).toFixed(2));
    batFill.classList.toggle("low", pct <= 15 && !charging);
    batBolt.style.display = charging ? "" : "none";
  };
  showBat(1, true);
  if (navigator.getBattery) navigator.getBattery().then(b => {
    const up = () => showBat(b.level, b.charging);
    up(); b.addEventListener("levelchange", up); b.addEventListener("chargingchange", up);
  }).catch(() => {});

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

  // ── planos: Code delante, Ask detrás (o al revés) ────────────
  const planeTabs = document.getElementById("planes");
  const planeInd = planeTabs.querySelector(".planes-ind");
  const crumb = document.querySelector(".crumb");
  function placeInd() {
    const b = planeTabs.querySelector(`[data-plane="${P.kind}"]`);
    planeInd.style.width = b.offsetWidth + "px";
    planeInd.style.translate = b.offsetLeft + "px 0";
  }
  function switchPlane(kind) {
    const next = PLANES[kind];
    if (!next || next === P) return false;
    const prev = P;
    const v = viewOf(next);
    prev.cam = { x: cam.x, y: cam.y, z: cam.z };
    stopMotion();
    cam.x = v.x; cam.y = v.y; cam.z = v.z;
    next.anchor = { ...cam };
    lastCam.x = cam.x; lastCam.y = cam.y; lastCam.z = cam.z;
    P = next; SESSIONS = P.sessions; projList = P.projList; links = P.links;
    hovered = null; hoverProject = null; statusHover(null);
    closePanel(); clearSearch();
    if (reduced()) { prev.depth = 1; next.depth = 0; shift = null; }
    else shift = { t0: performance.now(), dur: 1150, from: prev, to: next, a0: prev.depth, b0: next.depth };

    const ask = kind === "ask";
    document.body.dataset.plane = kind;
    planeTabs.querySelectorAll("[data-plane]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.plane === kind)));
    placeInd();
    crumb.textContent = ask ? "claude.ai/chats" : "~/.claude/projects";
    search.placeholder = ask ? "Buscar chats" : "Buscar sesiones";
    search.setAttribute("aria-label", search.placeholder);
    $("newSession").querySelector("span").textContent = ask ? "Nuevo chat" : "Nueva sesión";
    return true;
  }
  planeTabs.querySelectorAll("[data-plane]").forEach(b => b.addEventListener("click", () => switchPlane(b.dataset.plane)));

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
    const ask = s.plane.kind === "ask";
    $("pResume").querySelector("span").textContent = ask ? "Abrir chat" : "Reanudar";
    $("pCopy").querySelector("span").textContent = copyLabel(s);
    panel.querySelector(".panel-bar span").textContent = ask ? "Chat" : "Sesión";
    const ul = $("pLinks"); ul.innerHTML = "";
    s.links.forEach(l => {
      const o = l.a === s ? l.b : l.a;
      const li = document.createElement("li"), b = document.createElement("button");
      const kind = l.kind === "chain" ? "mismo proyecto" : l.kind === "cross" ? (o.plane.kind === "ask" ? "chat de Ask" : "sesión de Code") : "relacionada";
      b.innerHTML = `${dotHTML(o.proj)}<span class="t"></span><span class="k">${kind}</span>`;
      b.children[1].textContent = o.title;
      b.onmouseenter = () => { if (o.plane === P) hovered = o; };
      b.onmouseleave = () => { hovered = null; };
      b.onclick = () => select(o);
      li.appendChild(b); ul.appendChild(li);
    });
  }

  let swapTimer = 0;
  function select(s) {
    if (s.plane !== P) switchPlane(s.plane.kind); // un hilo entre planos te lleva al otro plano
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

  const resumeCmd = s => s.plane.kind === "ask" ? `https://claude.ai/chat/${s.id}` : `cd "${s.project}" && claude --resume ${s.id}`;
  const copyLabel = s => (s && s.plane.kind === "ask") ? "Copiar enlace" : "Copiar orden";
  function swapLabel(btn, text, back = btn._back || "Copiar orden") {
    const span = btn.querySelector("span");
    btn.classList.add("swapping");
    setTimeout(() => { span.textContent = text; btn.classList.remove("swapping"); }, reduced() ? 0 : 140);
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.classList.add("swapping");
      setTimeout(() => { span.textContent = back; btn.classList.remove("swapping"); }, reduced() ? 0 : 140);
    }, 1600);
  }
  async function copy(btn, text, label) {
    btn._back = label;
    try { await navigator.clipboard.writeText(text); swapLabel(btn, "Copiado"); }
    catch { swapLabel(btn, "No se pudo copiar"); }
  }
  $("pCopy").onclick = () => selected && copy($("pCopy"), resumeCmd(selected), copyLabel(selected));

  // ── sesión a pantalla completa (simulada) ────────────────────
  // En la versión instalable, aquí se abrirá la terminal real con la sesión.
  // La sesión se muestra en bloques (un bloque por orden o por mensaje) y abajo hay un
  // compositor con adjuntos de imagen y un botón que se convierte en «parar» mientras Claude responde.
  const sessionEl = $("session"), sLog = $("sLog"), sScroll = $("sScroll"), sInput = $("sInput"), sForm = $("sForm");
  const sMain = sessionEl.querySelector(".s-main"), sFile = $("sFile"), sAttach = $("sAttach"), sSend = $("sSend");
  let current = null, camBefore = null, sAnim = null, enterTimer = 0, openTimer = 0, closeTimer = 0;

  // posición de la etiqueta de una estrella en el mapa para una vista dada (igual que la dibuja el lienzo)
  function labelBox(s, view) {
    const zs = Math.pow(view.z, 0.55);
    const sx = (s.x - view.x) * view.z + W / 2, sy = (s.y - view.y) * view.z + H / 2;
    // el lienzo escribe sobre la línea base; la copia en HTML necesita la parte de arriba de su caja
    mainCtx.font = `500 14px ${FONT_DISPLAY}`;
    if ("fontStretch" in mainCtx) mainCtx.fontStretch = "ultra-condensed";
    const asc = mainCtx.measureText(s.title).fontBoundingBoxAscent || 13;
    if ("fontStretch" in mainCtx) mainCtx.fontStretch = "normal";
    return { left: sx + s.size * zs * 4 + 16, top: sy + 1 - asc, ls: "-0.6px" };
  }
  const cssVar = n => getComputedStyle(root).getPropertyValue(n).trim();
  const tabBox = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return { left: r.left, top: r.top, fs: parseFloat(cs.fontSize), st: cs.fontStretch, c: cssVar("--ink"), ls: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing };
  };
  // copia flotante del título que viaja entre el mapa y la pestaña
  let flight = null;
  function flyTitle(text, from, to, dur, delay) {
    if (flight) flight.remove();
    const el = document.createElement("div"); el.className = "title-flight"; el.textContent = text;
    document.body.appendChild(el); flight = el;
    const kf = o => ({ left: o.left + "px", top: o.top + "px", fontSize: o.fs + "px", fontStretch: o.st, color: o.c, letterSpacing: o.ls });
    const an = el.animate([kf(from), kf(to)], { duration: dur, delay, easing: "cubic-bezier(.65,0,.35,1)", fill: "both" });
    return an.finished.catch(() => {}).then(() => { if (flight === el) { el.remove(); flight = null; } });
  }
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
  const CHAT_REPLIES = [
    "Buena pregunta. Te lo explico por partes y con un ejemplo, y si algo no queda claro lo vemos con más calma.",
    "Aquí tienes una primera versión. La he dejado corta a propósito; dime qué tono prefieres y la ajusto.",
    "Depende un poco de lo que busques. Te dejo tres opciones con sus pros y contras para que elijas.",
  ];
  let replyN = 0;
  function respond(b, imgs) {
    b.el.classList.add("running", "reply");
    const id = ++run;
    const thinking = outLine(b.out, "", "thinking");
    thinking.innerHTML = `<span class="spin">✻</span> Pensando…\n`;
    let stopped = false;
    const text = (imgs.length ? `Veo ${imgs.length === 1 ? "la imagen que has adjuntado" : `las ${imgs.length} imágenes que has adjuntado`}. ` : "")
      + (current && current.chat ? CHAT_REPLIES : REPLIES)[replyN++ % REPLIES.length] + "\n(Simulación: aquí respondería Claude de verdad.)";
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

  // lo que una sesión dejó pendiente mientras no estabas: una respuesta terminada o una pregunta
  function showPending(p) {
    if (!p) return;
    const b = block({ prompt: "" }); b.el.classList.add("pending", "reply", p.kind);
    if (p.kind === "done") outLine(b.out, p.text);
    else {
      outLine(b.out, p.q);
      p.opts.forEach((o, i) => outLine(b.out, `  ${i + 1}. ${o}`, "opt"));
      outLine(b.out, "Responde con el número o escribe lo que prefieras.", "d");
    }
  }
  async function intro(s, proj, id) {
    if (current && current.chat) { // un chat se lee como conversación, no como terminal
      if (s) {
        const prev = block({ prompt: s.firstPrompt || "", time: fmtDate(s.started) });
        outLine(prev.out, `… ${Math.max(0, s.messages - 1)} mensajes anteriores · última vez ${ago(s.lastActive)}`, "d");
        showPending(current && current.pending);
      } else {
        const b = block({ prompt: "" }); b.el.classList.add("note");
        outLine(b.out, "Nuevo chat. Al terminar aparecerá como una estrella en el plano Ask.", "d");
      }
      return;
    }
    const b = block({ cmd: true, prompt: s ? `claude --resume ${s.id}` : "claude", time: clock() });
    await wait(450); if (id !== run) return;
    if (s) {
      outLine(b.out, `Reanudando «${s.title}» · ${s.messages} mensajes · última vez ${ago(s.lastActive)}`, "d");
      await wait(250); if (id !== run) return;
      const prev = block({ prompt: s.firstPrompt || "", time: fmtDate(s.started) });
      outLine(prev.out, `… ${Math.max(0, s.messages - 1)} mensajes anteriores`, "d");
      showPending(current && current.pending);
    } else {
      outLine(b.out, "Nueva sesión. Al terminar aparecerá como una estrella nueva en el cúmulo.", "d");
    }
    outLine(b.out, "(Simulación: en la versión instalable aquí se abre Claude de verdad.)", "d");
  }

  function openSession(s, origin) {
    const switching = sessionEl.classList.contains("open"); // cambio de sesión desde la barra inferior
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; } // reabrir mientras la estrella volvía a su sitio
    const dk = s ? dockAdd(s) : null;
    const pending = dk && (dk.state === "ask" || dk.state === "done") ? dk.pending : null;
    if (dk) dockState(dk, "");
    const chat = (s ? s.plane : P).kind === "ask";
    if (window.cumuloMonitor) window.cumuloMonitor.setSession(s); // los chats también gastan uso y contexto
    const proj = s ? s.proj : ((selected && selected.proj) || hoverProject || projList[0]);
    current = { s, proj, chat, pending };
    sessionEl.classList.toggle("chat", chat);
    $("sProject").innerHTML = proj ? dotHTML(proj) : "";
    $("sTitle").textContent = s ? s.title : (chat ? "Nuevo chat" : "Nueva sesión");
    $("sMeta").textContent = chat ? (proj && proj.name !== "Sin proyecto" ? `Proyecto · ${proj.name}` : "Chat sin proyecto") : (proj ? proj.path : "");
    $("sId").textContent = s ? s.id : "sin guardar todavía";
    $("sCopy").querySelector("span").textContent = chat ? "Copiar enlace" : "Copiar orden";
    sInput.placeholder = chat ? "Pregunta a Claude…" : "Escribe a Claude…";
    if (streaming) streaming.stop();
    sLog.innerHTML = ""; sInput.value = ""; autosize();
    attachments = []; sAttach.innerHTML = ""; sAttach.hidden = true; updateSend();

    const motion = !reduced();
    dockSync();
    if (switching) { // ya estás dentro: la nueva sesión entra por partes, sin zambullirse otra vez
      sessionEl.classList.remove("switching"); void sessionEl.offsetWidth;
      if (motion) { sessionEl.classList.add("switching"); clearTimeout(enterTimer); enterTimer = setTimeout(() => sessionEl.classList.remove("switching"), 700); }
      const id = ++run;
      setTimeout(() => { if (id === run) { intro(s, proj, id); sInput.focus({ preventScroll: true }); } }, motion ? 120 : 0);
      return;
    }
    if (sAnim) { sAnim.cancel(); sAnim = null; }
    sessionEl.style.transformOrigin = "";

    // 1) la estrella se coloca en el centro de la pantalla (el inspector se aparta)
    // 2) ya quieta, la cámara se zambulle, su luz llena la pantalla y la sesión surge de ella
    camBefore = { x: cam.x, y: cam.y, z: cam.z };
    document.body.classList.toggle("diving", !!s);
    const [sx0, sy0] = s ? toScreen(s.x, s.y) : [W / 2, H / 2];
    const needCenter = s && motion && Math.hypot(sx0 - W / 2, sy0 - H / 2) > 4;
    const CENTER = 520;
    if (needCenter) flyTo(s.x, s.y, cam.z, { dur: CENTER, noPanel: true, noDip: true, ease: easeInOutCubic });
    const id = ++run;
    clearTimeout(openTimer);
    const reveal = () => {
      if (id !== run) return;
      openTimer = 0;
      const from = s && motion ? labelBox(s, cam) : null;
      if (s) flyTo(s.x, s.y, Math.min(ZMAX, Math.max(cam.z, 1.5) * 2.4), { dur: 760, noPanel: true, noDip: true, ease: easeInOutCubic });
      if (s && motion) dive = { s, t0: performance.now(), dur: 820, dir: 1 };

      sessionEl.classList.remove("closing");
      sessionEl.classList.add("open"); sessionEl.setAttribute("aria-hidden", "false");
      document.body.classList.add("session-open");
      dockSync();
      if (motion) {
        const to = from ? tabBox($("sTitle")) : null; // se mide antes de que empiecen las animaciones de entrada
        const [ox, oy] = origin || [W / 2, H / 2];
        if (!s) sessionEl.style.transformOrigin = `${ox}px ${oy}px`;
        sessionEl.classList.add("entering");
        clearTimeout(enterTimer); enterTimer = setTimeout(() => sessionEl.classList.remove("entering"), 1400);
        sAnim = sessionEl.animate(
          [{ opacity: 0, filter: "blur(10px)", transform: s ? "scale(1.035)" : "scale(.97)" }, { opacity: 1, filter: "blur(0px)", transform: "none" }],
          { duration: s ? 560 : 420, delay: s ? 340 : 0, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }
        );
        sAnim.onfinish = () => { sAnim = null; };
        // el nombre de la estrella viaja hasta la pestaña
        if (from) {
          const t = $("sTitle");
          t.style.opacity = "0"; labelHidden = s;
          flyTitle(s.title, { ...from, fs: 14, st: "75%", c: rgba(th.ink, 0.96) }, to, 720, 40)
            .then(() => { t.style.opacity = ""; });
        }
      }
      setTimeout(() => { if (id === run) { intro(s, proj, id); if (!matchMedia("(pointer: coarse)").matches) sInput.focus({ preventScroll: true }); } }, motion ? (s ? 620 : 300) : 0);
    };
    if (needCenter) openTimer = setTimeout(reveal, CENTER + 40); else reveal();
  }
  // Esc mientras la estrella se está centrando: se cancela la entrada
  function cancelOpen() {
    if (!openTimer) return false;
    clearTimeout(openTimer); openTimer = 0; run++;
    document.body.classList.remove("diving");
    current = null; dockSync();
    return true;
  }

  function closeSession() {
    if (!sessionEl.classList.contains("open")) return;
    const s = current && current.s;
    if (streaming) {
      streaming.stop();
      const o = s && dockFind(s);
      if (o) { // la respuesta sigue en segundo plano; la barra avisará cuando termine
        dockState(o, "working");
        clearTimeout(o.timer);
        o.timer = setTimeout(() => dockState(o, "done", { kind: "done", text: `He terminado de responder en «${s.title}». Te dejo el resultado aquí y, si quieres, seguimos con el siguiente paso.` }), 4000 + Math.random() * 3000);
      }
    }
    run++;
    let [x, y] = s ? toScreen(s.x, s.y) : [W / 2, H / 2];
    if (!s) { const b = $("newSession").getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; }
    sessionEl.classList.remove("open", "entering", "switching"); sessionEl.setAttribute("aria-hidden", "true");
    current = null; dockSync();
    const here = s && s.plane === P; // si la sesión es del otro plano, no hay estrella a la que volver
    document.body.classList.remove("session-open");
    // salida en dos tiempos (lo contrario de la entrada):
    // 1) la cámara se aleja con la estrella fija en el centro mientras la luz vuelve a ella
    // 2) ya terminada la transición, la estrella regresa a donde estaba y el inspector vuelve
    const BACK = 1000;
    const centered = camBefore && here ? { x: s.x, y: s.y, z: camBefore.z } : null;
    clearTimeout(closeTimer);
    if (centered && !reduced()) {
      flyTo(centered.x, centered.y, centered.z, { dur: 900, noPanel: true, noDip: true, ease: easeOutQuart });
      const cb = camBefore;
      closeTimer = setTimeout(() => {
        closeTimer = 0;
        document.body.classList.remove("diving");
        flyTo(cb.x, cb.y, cb.z, { dur: 560, noPanel: true, noDip: true, ease: easeInOutCubic });
      }, BACK);
    } else {
      document.body.classList.remove("diving");
      if (camBefore && here) flyTo(camBefore.x, camBefore.y, camBefore.z, { dur: 900, noPanel: true, noDip: true, ease: easeOutQuart });
    }
    if (sAnim) { sAnim.cancel(); sAnim = null; }
    $("sTitle").style.opacity = "";
    if (reduced()) { labelHidden = null; return; }
    // la ventana se condensa en luz que vuelve a su estrella
    sessionEl.classList.add("closing");
    sessionEl.style.transformOrigin = `${x}px ${y}px`;
    sAnim = sessionEl.animate(
      [{ opacity: 1, filter: "blur(0px)", transform: "none" }, { opacity: 0, filter: "blur(8px)", transform: "scale(.94)" }],
      { duration: 380, easing: "cubic-bezier(.55,0,.75,.1)", fill: "forwards" }
    );
    sAnim.onfinish = () => { sessionEl.classList.remove("closing"); sessionEl.style.transformOrigin = ""; if (sAnim) sAnim.cancel(); sAnim = null; };
    if (here) {
      dive = { s, t0: performance.now() + 140, dur: 1000, dir: -1 };
      const r = $("sTitle").getBoundingClientRect();
      if (r.width && camBefore) {
        labelHidden = s;
        flyTitle(s.title,
          tabBox($("sTitle")),
          { ...labelBox(s, centered || camBefore), fs: 14, st: "75%", c: rgba(th.ink, 0.96) },
          780, 60
        ).then(() => { labelHidden = null; });
      } else labelHidden = null;
    }
    const back = s ? $("pResume") : $("newSession");
    setTimeout(() => back.focus({ preventScroll: true }), centered ? BACK + 300 : 300);
  }

  $("sBack").onclick = closeSession;

  // ── barra de tareas: una carpeta por sesión abierta ──────────
  // Un punto ámbar si la sesión te pregunta algo y verde si ha terminado de responder.
  const dock = $("dock");
  const ICONS = {
    code: `<svg class="kind" viewBox="0 0 16 14" aria-hidden="true"><rect class="frame" x=".7" y=".7" width="14.6" height="12.6" rx="2.2"/><path class="glyph" d="M4 5l2.4 2L4 9M8.2 9.4h3.6"/></svg>`,
    ask: `<svg class="kind" viewBox="0 0 16 14" aria-hidden="true"><path class="frame" d="M3 .9h10a2.2 2.2 0 0 1 2.2 2.2v5.2A2.2 2.2 0 0 1 13 10.5H7.2L4 13v-2.5H3A2.2 2.2 0 0 1 .8 8.3V3.1A2.2 2.2 0 0 1 3 .9z"/><path class="glyph" d="M4.6 4.6h6.8M4.6 7h4.4"/></svg>`,
  };
  const opened = []; // { s, el, state, pending, timer }
  const dockFind = s => opened.find(o => o.s === s);
  function dockAdd(s, state = "") {
    let o = dockFind(s); if (o) return o;
    const el = document.createElement("button"); el.type = "button"; el.className = "dock-item";
    el.style.setProperty("--cd", s.proj.cd); el.style.setProperty("--cl", s.proj.cl);
    el.dataset.kind = s.plane.kind;
    el.innerHTML = `${ICONS[s.plane.kind]}<span class="t"></span><span class="st" aria-hidden="true"></span><span class="x" aria-label="Quitar de la barra"><svg class="ico" viewBox="0 0 16 16"><path d="M5 5l6 6M11 5l-6 6"/></svg></span>`;
    el.querySelector(".t").textContent = s.title;
    o = { s, el, state: "", pending: null, timer: 0 };
    el.onclick = e => { if (e.target.closest(".x")) dockRemove(o); else dockOpen(o); };
    opened.push(o); dock.append(el); dockState(o, state);
    return o;
  }
  function dockState(o, state, pending) {
    o.state = state; if (pending) o.pending = pending;
    o.el.dataset.state = state;
    const why = { ask: " — te pregunta algo", done: " — ha terminado de responder", working: " — trabajando…" }[state] || "";
    o.el.title = o.s.title + why;
    o.el.setAttribute("aria-label", o.s.title + why);
  }
  function dockRemove(o) {
    clearTimeout(o.timer);
    opened.splice(opened.indexOf(o), 1);
    if (current && current.s === o.s) closeSession();
    o.el.classList.add("leaving"); setTimeout(() => o.el.remove(), 320);
  }
  function dockSync() {
    opened.forEach(o => o.el.setAttribute("aria-current", String(!!(current && current.s === o.s && sessionEl.classList.contains("open")))));
  }
  function dockOpen(o) {
    const s = o.s;
    if (sessionEl.classList.contains("open")) { if (!(current && current.s === s)) openSession(s); return; }
    const go = () => { select(s); openSession(s, toScreen(s.x, s.y)); };
    if (s.plane !== P) { switchPlane(s.plane.kind); setTimeout(go, reduced() ? 0 : 700); } else go();
  }
  // simulación: tres sesiones abiertas; una termina de responder y otra te pregunta algo al rato
  {
    const recent = list => [...list].sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    const [c1, c2] = recent(PLANES.code.sessions), [a1] = recent(PLANES.ask.sessions);
    const w = c1 && dockAdd(c1, "working"), q = c2 && dockAdd(c2); if (a1) dockAdd(a1);
    if (w) w.timer = setTimeout(() => dockState(w, "done", { kind: "done", text: `He terminado con «${c1.title}»: los cambios están hechos y las pruebas pasan. ¿Quieres que lo suba?` }), 14000);
    if (q) q.timer = setTimeout(() => dockState(q, "ask", { kind: "ask", q: "Antes de seguir, ¿cómo prefieres que lo haga?", opts: ["Aplicar el cambio ahora", "Hacerlo en una rama aparte", "Explícamelo antes de tocar nada"] }), 32000);
  }

  // órbitas de uso en miniatura (junto a la batería)
  window.addEventListener("cumulo:limits", e => {
    const u = e.detail || [], wk = u.find(x => x.k === "weekly"), se = u.find(x => x.k === "session");
    if (!wk || !se) return;
    const pc = x => Math.round(x.used * 100) + " %";
    const arc = (el, x) => { el.style.strokeDasharray = `${Math.max(0.5, x.used * 100).toFixed(1)} 100`; el.setAttribute("class", "mo-arc " + x.level); };
    arc($("moWeekly"), wk); arc($("moSession"), se);
    $("moText").textContent = `${pc(se)} · ${pc(wk)}`;
    $("moTip").textContent = `5 horas   ${pc(se).padStart(5)}   ${se.reset}\nSemanal   ${pc(wk).padStart(5)}   ${wk.reset}`;
  });

  // compactar la conversación desde el botón de la ventana de contexto (equivale a /compact)
  const ctxBtn = $("ctxCompact");
  ctxBtn.addEventListener("click", async () => {
    const m = window.cumuloMonitor;
    if (!m || ctxBtn.classList.contains("busy")) return;
    if (streaming) streaming.stop();
    const label = ctxBtn.querySelector("span");
    ctxBtn.classList.add("busy"); ctxBtn.disabled = true; label.textContent = "Compactando…";
    const id = ++run;
    const b = block({ prompt: "Compactar conversación" });
    b.el.querySelector(".b-cmd .p").textContent = "⇣";
    b.el.classList.add("running");
    const thinking = outLine(b.out, "", "thinking");
    thinking.innerHTML = `<span class="spin">✻</span> Resumiendo la conversación…\n`;
    await wait(1700);
    thinking.remove(); b.el.classList.remove("running");
    const r = m.compact();
    if (r && id === run) {
      outLine(b.out, `Conversación compactada: los mensajes pasan de ${r.before} a ${r.after} tokens (${r.freed} liberados).`);
      outLine(b.out, "El resumen se queda como contexto; puedes seguir donde lo dejaste.", "d");
    }
    ctxBtn.classList.remove("busy"); label.textContent = "Compactar";
    m.addMessage(0, 0); // recalcula si el botón debe quedar activo
  });
  $("sCopy").onclick = () => {
    if (!current) return;
    if (current.chat) copy($("sCopy"), current.s ? resumeCmd(current.s) : "https://claude.ai/new", "Copiar enlace");
    else copy($("sCopy"), current.s ? resumeCmd(current.s) : `cd "${current.proj ? current.proj.path : "."}" && claude`, "Copiar orden");
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
      else if (cancelOpen()) { /* entrada cancelada */ }
      else if (document.activeElement === search) clearSearch();
      else closePanel();
    } else if ((e.key === "1" || e.key === "2") && !inSession && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      switchPlane(e.key === "1" ? "code" : "ask");
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
  const ba = bounds(PLANES.ask);
  PLANES.ask.cam = { x: ba.x, y: ba.y, z: ba.z };
  PLANES.code.anchor = { x: b0.x, y: b0.y, z: b0.z };
  cam.x = b0.x; cam.y = b0.y; cam.z = b0.z * (reduced() ? 1 : 0.5);
  lastCam.x = cam.x; lastCam.y = cam.y;
  document.body.dataset.plane = "code";
  placeInd();
  if (document.fonts) document.fonts.ready.then(placeInd);
  window.addEventListener("resize", placeInd);
  flyTo(b0.x, b0.y, b0.z, { dur: 2600, ease: easeOutQuart, noDip: true });
  requestAnimationFrame(frame);
})();
