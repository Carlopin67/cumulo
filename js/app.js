// Cúmulo — lanzador de sesiones de Claude como cúmulo de estrellas.
// Lee los datos de window.CUMULO_DATA (data/sessions.js). Todo lo demás se calcula aquí.
(() => {
  "use strict";

  const SESSIONS = ((window.CUMULO_DATA && window.CUMULO_DATA.sessions) || []).map(s => ({ ...s }));
  const byId = new Map(SESSIONS.map(s => [s.id, s]));

  // Colores de estrellas reales (de azul caliente a naranja frío)
  const PALETTE = ["#a9c1ff", "#ffd59b", "#cfdcff", "#ffb47a", "#f4f1ff", "#ffe6c4", "#9fb6f5", "#ffc58f"];

  // ── utilidades ──────────────────────────────────────────────
  const hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const folderName = p => (p.split(/[\\/]/).filter(Boolean).pop() || p);
  const fmtDate = d => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  const ago = d => {
    const days = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (days <= 0) return "hoy"; if (days === 1) return "ayer";
    if (days < 30) return `hace ${days} días`;
    const m = Math.floor(days / 30); return m === 1 ? "hace un mes" : `hace ${m} meses`;
  };
  const hexToRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };

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
    p.color = PALETTE[i % PALETTE.length];
    p.sessions.sort((a, b) => new Date(a.started) - new Date(b.started));
    const R = rng(hash(p.path));
    let maxR = 0;
    p.sessions.forEach((s, k) => {
      const rr = 30 * Math.sqrt(k + 0.4) + R() * 16;
      const aa = k * GA + R() * 0.9;
      s.x = p.x + Math.cos(aa) * rr; s.y = p.y + Math.sin(aa) * rr;
      s.proj = p;
      s.size = 1.4 + Math.log2(1 + (s.messages || 1)) * 0.5;
      s.twinkle = R() * Math.PI * 2;
      maxR = Math.max(maxR, rr);
    });
    p.radius = maxR + 20;
  });

  const now = Date.now();
  SESSIONS.forEach(s => {
    const age = Math.max(0, (now - new Date(s.lastActive || s.started)) / 86400000);
    s.glow = 0.4 + 0.6 * Math.exp(-age / 12); // más reciente = más brillante
  });

  // ── hilos ────────────────────────────────────────────────────
  const links = [];
  const linkKey = (a, b) => a.id < b.id ? a.id + "|" + b.id : b.id + "|" + a.id;
  const seen = new Set();
  const addLink = (a, b, kind) => {
    const k = linkKey(a, b); if (a === b || seen.has(k)) return; seen.add(k);
    const R = rng(hash(k));
    links.push({ a, b, kind, bend: (R() - 0.5) * 0.5, phase: R() * 10 });
  };
  projList.forEach(p => p.sessions.forEach((s, k) => { if (k > 0) addLink(p.sessions[k - 1], s, "chain"); }));
  SESSIONS.forEach(s => (s.related || []).forEach(id => { const t = byId.get(id); if (t) addLink(s, t, "related"); }));
  SESSIONS.forEach(s => s.links = links.filter(l => l.a === s || l.b === s));

  // ── canvas ───────────────────────────────────────────────────
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;
  const cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // fondo de estrellas lejanas
  const bgR = rng(7);
  const bgStars = Array.from({ length: 700 }, () => ({
    x: bgR() * 4000, y: bgR() * 4000, r: bgR() < 0.92 ? 0.35 + bgR() * 0.5 : 0.9 + bgR() * 0.6,
    a: 0.15 + bgR() * 0.5, d: 0.05 + bgR() * 0.25, tw: bgR() * 6.28, sp: 0.5 + bgR() * 1.5,
  }));

  // sprites de brillo por color
  const sprites = new Map();
  function sprite(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.08, rgba(color, 0.95));
    grad.addColorStop(0.25, rgba(color, 0.28));
    grad.addColorStop(0.6, rgba(color, 0.06));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    sprites.set(color, c); return c;
  }

  const toScreen = (x, y) => [(x - cam.x) * cam.z + W / 2, (y - cam.y) * cam.z + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.z + cam.x, (sy - H / 2) / cam.z + cam.y];

  // ── estado ───────────────────────────────────────────────────
  let hovered = null, selected = null, hoverProject = null, query = "";
  const matches = s => !query || (s.title + " " + (s.firstPrompt || "") + " " + s.proj.name).toLowerCase().includes(query);

  function ctrl(l) { // punto de control de la curva
    const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
    const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
    return [mx - dy * l.bend, my + dx * l.bend];
  }
  function bez(l, t) {
    const [cx, cy] = ctrl(l), u = 1 - t;
    return [u * u * l.a.x + 2 * u * t * cx + t * t * l.b.x, u * u * l.a.y + 2 * u * t * cy + t * t * l.b.y];
  }

  // ── dibujo ───────────────────────────────────────────────────
  function frame(time) {
    const t = time / 1000;
    cam.x += (cam.tx - cam.x) * 0.12; cam.y += (cam.ty - cam.y) * 0.12; cam.z += (cam.tz - cam.z) * 0.12;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#04050a"; ctx.fillRect(0, 0, W, H);

    // estrellas lejanas con paralaje
    for (const b of bgStars) {
      const sx = ((b.x - cam.x * b.d * cam.z) % W + W) % W;
      const sy = ((b.y - cam.y * b.d * cam.z) % H + H) % H;
      const a = b.a * (0.75 + 0.25 * Math.sin(t * b.sp + b.tw));
      ctx.fillStyle = `rgba(220,225,240,${a})`;
      ctx.fillRect(sx, sy, b.r * 1.4, b.r * 1.4);
    }

    const focus = selected || hovered;
    const lit = focus ? new Set(focus.links.flatMap(l => [l.a, l.b])) : null;

    // hilos
    ctx.lineCap = "round";
    for (const l of links) {
      const on = focus && (l.a === focus || l.b === focus);
      const projOn = hoverProject && l.a.proj === hoverProject && l.b.proj === hoverProject;
      const dim = (query && !(matches(l.a) && matches(l.b))) || (focus && !on && !projOn) || (hoverProject && !projOn);
      let alpha = l.kind === "chain" ? 0.22 : 0.16;
      if (on || projOn) alpha = 0.7; else if (dim) alpha *= 0.3;
      const color = l.kind === "chain" ? l.a.proj.color : "#e8e4da";
      const [ax, ay] = toScreen(l.a.x, l.a.y), [bx, by] = toScreen(l.b.x, l.b.y);
      const [cx0, cy0] = ctrl(l), [cx, cy] = toScreen(cx0, cy0);
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = on ? 1.1 : 0.7;
      ctx.setLineDash(l.kind === "related" ? [2, 5] : []);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(cx, cy, bx, by); ctx.stroke();

      // pulso de luz que recorre el hilo
      const cyc = (t * 0.12 + l.phase) % 4;
      if (cyc < 1 && !dim) {
        const [px, py] = toScreen(...bez(l, cyc));
        const pa = Math.sin(cyc * Math.PI) * (on ? 0.9 : 0.45);
        ctx.fillStyle = rgba(color, pa);
        ctx.beginPath(); ctx.arc(px, py, on ? 1.6 : 1.1, 0, 6.283); ctx.fill();
      }
    }
    ctx.setLineDash([]);

    // nombres de proyectos
    const labelA = clamp((cam.z - 0.35) * 1.6, 0, 0.55);
    if (labelA > 0.01) {
      ctx.font = "500 10px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      for (const p of projList) {
        const [sx, sy] = toScreen(p.x, p.y - p.radius);
        const a = hoverProject === p ? 0.95 : (hoverProject || (focus && focus.proj !== p) ? labelA * 0.4 : labelA);
        ctx.fillStyle = rgba("#ece8de", a);
        ctx.fillText(p.name.toUpperCase().split("").join("\u200A"), sx, sy - 6);
      }
    }

    // estrellas (sesiones)
    ctx.globalCompositeOperation = "lighter";
    const zs = Math.pow(cam.z, 0.55);
    for (const s of SESSIONS) {
      const [sx, sy] = toScreen(s.x, s.y);
      if (sx < -80 || sy < -80 || sx > W + 80 || sy > H + 80) continue;
      let a = s.glow * (0.85 + 0.15 * Math.sin(t * 1.3 + s.twinkle));
      const dimmed = (query && !matches(s)) || (lit && !lit.has(s)) || (hoverProject && s.proj !== hoverProject);
      if (dimmed) a *= 0.22;
      const r = s.size * zs * (s === focus ? 1.35 : 1);
      const g = r * 9;
      ctx.globalAlpha = a;
      ctx.drawImage(sprite(s.proj.color), sx - g, sy - g, g * 2, g * 2);
      ctx.globalAlpha = Math.min(1, a + 0.2);
      ctx.fillStyle = "#fffaf0";
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.8, r * 0.55), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // anillo de selección
    if (selected) {
      const [sx, sy] = toScreen(selected.x, selected.y);
      const rr = selected.size * zs * 4 + 6 + Math.sin(t * 2) * 1.2;
      ctx.strokeStyle = "rgba(236,232,222,0.55)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.283); ctx.stroke();
    }

    // etiqueta al pasar por encima
    const lab = hovered || selected;
    if (lab) {
      const [sx, sy] = toScreen(lab.x, lab.y);
      const off = lab.size * zs * 4 + 12;
      ctx.textAlign = "left";
      ctx.font = "italic 19px 'Instrument Serif', Georgia, serif";
      ctx.fillStyle = "rgba(236,232,222,0.95)";
      ctx.fillText(lab.title, sx + off, sy + 2);
      ctx.font = "10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "rgba(139,138,134,0.95)";
      ctx.fillText(`${lab.proj.name} · ${ago(lab.lastActive)} · ${lab.messages} mensajes`, sx + off, sy + 18);
    }

    requestAnimationFrame(frame);
  }

  // ── cámara ───────────────────────────────────────────────────
  const panelW = () => (document.body.classList.contains("panel-open") && W > 720 ? 380 : 0);
  function fitAll(instant) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    SESSIONS.forEach(s => { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); });
    if (!SESSIONS.length) { x0 = y0 = -100; x1 = y1 = 100; }
    const pw = panelW();
    cam.tz = clamp(Math.min((W - pw - 160) / (x1 - x0 + 120), (H - 200) / (y1 - y0 + 120)), 0.2, 2.2);
    cam.tx = (x0 + x1) / 2 + pw / 2 / cam.tz; cam.ty = (y0 + y1) / 2;
    if (instant) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
  }
  function flyTo(x, y, z) {
    cam.tz = z ?? cam.tz;
    cam.tx = x + panelW() / 2 / cam.tz; cam.ty = y;
  }
  function zoomAt(factor, sx, sy) {
    const [wx, wy] = toWorld(sx, sy);
    const z = clamp(cam.z * factor, 0.15, 6);
    cam.z = cam.tz = z;
    cam.x = cam.tx = wx - (sx - W / 2) / z;
    cam.y = cam.ty = wy - (sy - H / 2) / z;
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
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
  });
  canvas.addEventListener("pointermove", e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) { drag.moved = true; canvas.classList.add("dragging"); hideHint(); }
      if (drag.moved) { cam.x = cam.tx = drag.cx - dx / cam.z; cam.y = cam.ty = drag.cy - dy / cam.z; }
      return;
    }
    hovered = pick(e.clientX, e.clientY);
    canvas.classList.toggle("pointing", !!hovered);
  });
  canvas.addEventListener("pointerup", e => {
    canvas.classList.remove("dragging");
    if (drag && !drag.moved) {
      const s = pick(e.clientX, e.clientY);
      if (s) select(s); else closePanel();
    }
    drag = null;
  });
  canvas.addEventListener("pointerleave", () => { hovered = null; });
  canvas.addEventListener("wheel", e => {
    e.preventDefault(); hideHint();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }, { passive: false });

  document.getElementById("zoomIn").onclick = () => zoomAt(1.4, W / 2, H / 2);
  document.getElementById("zoomOut").onclick = () => zoomAt(1 / 1.4, W / 2, H / 2);
  document.getElementById("zoomFit").onclick = () => fitAll(false);

  const hint = document.getElementById("hint");
  function hideHint() { hint.classList.add("gone"); }
  setTimeout(hideHint, 9000);

  // búsqueda
  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    query = search.value.trim().toLowerCase();
    const found = SESSIONS.filter(matches);
    if (query && found.length === 1) flyTo(found[0].x, found[0].y, Math.max(cam.tz, 1.6));
  });
  search.addEventListener("keydown", e => {
    if (e.key === "Enter") { const f = SESSIONS.filter(matches); if (f[0]) select(f[0]); search.blur(); }
  });

  // leyenda
  const legend = document.getElementById("legend");
  projList.forEach(p => {
    const b = document.createElement("button");
    b.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${p.name}</span><span class="n">${p.sessions.length}</span>`;
    b.onmouseenter = () => { hoverProject = p; };
    b.onmouseleave = () => { hoverProject = null; };
    b.onclick = () => { closePanel(); flyTo(p.x, p.y, clamp(Math.min(W, H) / (p.radius * 3.2), 0.6, 3)); };
    legend.appendChild(b);
  });
  document.getElementById("stats").textContent = `${SESSIONS.length} sesiones · ${projList.length} proyectos · ${links.length} hilos`;

  // panel de sesión
  const $ = id => document.getElementById(id);
  const panel = $("panel");
  function select(s) {
    selected = s;
    $("pProject").innerHTML = `<span class="dot" style="background:${s.proj.color}"></span>${s.proj.name}`;
    $("pTitle").textContent = s.title;
    $("pPrompt").textContent = s.firstPrompt ? `«${s.firstPrompt}»` : "";
    $("pStarted").textContent = fmtDate(s.started);
    $("pLast").textContent = ago(s.lastActive);
    $("pMsgs").textContent = s.messages;
    $("pId").textContent = s.id; $("pId").title = s.id;
    const ul = $("pLinks"); ul.innerHTML = "";
    s.links.forEach(l => {
      const o = l.a === s ? l.b : l.a;
      const li = document.createElement("li"), b = document.createElement("button");
      b.innerHTML = `<span class="dot" style="background:${o.proj.color}"></span><span></span><span class="k">${l.kind === "chain" ? "mismo proyecto" : "relacionada"}</span>`;
      b.children[1].textContent = o.title;
      b.onclick = () => select(o);
      li.appendChild(b); ul.appendChild(li);
    });
    panel.classList.add("open"); panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("panel-open");
    flyTo(s.x, s.y, Math.max(cam.tz, 1.5));
  }
  function closePanel() {
    if (!selected) return;
    selected = null;
    panel.classList.remove("open"); panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("panel-open");
  }
  $("panelClose").onclick = closePanel;

  const resumeCmd = s => `cd "${s.project}" && claude --resume ${s.id}`;
  $("pCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(resumeCmd(selected)); $("pCopy").textContent = "Copiada"; }
    catch { $("pCopy").textContent = "No se pudo copiar"; }
    setTimeout(() => $("pCopy").textContent = "Copiar orden", 1500);
  };

  // ── terminal simulada ────────────────────────────────────────
  // En la versión instalable, aquí se abrirá la terminal real con la sesión.
  const term = $("term"), termBody = $("termBody");
  let typing = 0;
  function openTerm(title, lines) {
    const myRun = ++typing;
    $("termTitle").textContent = title;
    termBody.innerHTML = "";
    term.classList.add("open"); term.setAttribute("aria-hidden", "false");
    let i = 0;
    const next = () => {
      if (myRun !== typing) return;
      if (i >= lines.length) { termBody.insertAdjacentHTML("beforeend", `<span class="p">&gt; </span><span class="cursor"></span>`); return; }
      const [cls, text] = lines[i++];
      const span = document.createElement("span"); if (cls) span.className = cls;
      termBody.appendChild(span);
      let j = 0;
      const tick = () => {
        if (myRun !== typing) return;
        span.textContent = text.slice(0, ++j);
        if (j < text.length) setTimeout(tick, cls === "cmd" ? 18 : 4);
        else { termBody.appendChild(document.createTextNode("\n")); setTimeout(next, 160); }
      };
      tick();
    };
    next();
  }
  function closeTerm() { typing++; term.classList.remove("open"); term.setAttribute("aria-hidden", "true"); }
  $("termClose").onclick = closeTerm;
  term.addEventListener("click", e => { if (e.target === term) closeTerm(); });

  $("pResume").onclick = () => {
    const s = selected;
    openTerm(`claude — ${s.title}`, [
      ["cmd", `PS ${s.project}> claude --resume ${s.id}`],
      ["d", ""],
      ["d", `Reanudando «${s.title}» · ${s.messages} mensajes · última vez ${ago(s.lastActive)}`],
      ["d", ""],
      ["", `Tú: ${s.firstPrompt || ""}`],
      ["d", "  …"],
      ["d", ""],
      ["d", "(Simulación: en la versión instalable aquí se abre la sesión real.)"],
    ]);
  };
  $("newSession").onclick = () => {
    const p = (selected && selected.proj) || hoverProject || projList[0];
    openTerm("claude — nueva sesión", [
      ["cmd", `PS ${p ? p.path : "C:\\"}> claude`],
      ["d", ""],
      ["d", "Nueva sesión. Al terminar aparecerá como una estrella nueva en el cúmulo."],
      ["d", ""],
      ["d", "(Simulación: en la versión instalable aquí se abre Claude de verdad.)"],
    ]);
  };

  // teclado
  window.addEventListener("keydown", e => {
    if (e.key === "/" && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    else if (e.key === "Escape") {
      if (term.classList.contains("open")) closeTerm();
      else if (document.activeElement === search) { search.value = ""; query = ""; search.blur(); }
      else closePanel();
    }
  });

  window.addEventListener("resize", () => { resize(); });
  resize();
  fitAll(true);
  cam.z *= 0.6; // pequeña entrada: empieza más lejos y se acerca
  requestAnimationFrame(frame);
})();
