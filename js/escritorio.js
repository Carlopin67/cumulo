// Cúmulo de escritorio: terminales de verdad dentro de las sesiones y lanzador para usar el ordenador.
// Solo se activa dentro de la app instalable (window.cumuloDesktop); en la web no hace nada.
(() => {
  "use strict";
  const D = window.cumuloDesktop;
  if (!D) return;
  const root = document.documentElement;
  root.classList.add("desktop");
  const cs = document.getElementById("ctxSub"); if (cs) cs.textContent = "en vivo";

  // botones de ventana propios (la app va siempre a pantalla completa): minimizar, pantalla completa y cerrar a la bandeja
  const winBtns = () => {
    const g = document.createElement("div"); g.className = "win-ctl";
    g.innerHTML = `
      <button type="button" data-a="min" title="Minimizar" aria-label="Minimizar"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.5h8"/></svg></button>
      <button type="button" data-a="fs" title="Salir de pantalla completa (F11)" aria-label="Pantalla completa"><svg viewBox="0 0 16 16" aria-hidden="true"><path class="fs-out" d="M6.5 3.5v3h-3M9.5 3.5v3h3M6.5 12.5v-3h-3M9.5 12.5v-3h3"/><path class="fs-in" d="M3.5 6.5v-3h3M12.5 6.5v-3h-3M3.5 9.5v3h3M12.5 9.5v3h-3"/></svg></button>
      <button type="button" data-a="hide" class="close" title="Cerrar (sigue en la bandeja con las sesiones abiertas)" aria-label="Cerrar"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></button>`;
    g.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "min") D.minimize(); else if (b.dataset.a === "fs") D.toggleFullscreen(); else D.hide();
    });
    return g;
  };
  document.querySelector(".titlebar .tb-right").append(winBtns());
  document.querySelector("#session .s-tools").append(winBtns());
  const setFs = v => {
    root.classList.toggle("fullscreen", v);
    document.querySelectorAll('.win-ctl [data-a="fs"]').forEach(b => { b.title = v ? "Salir de pantalla completa (F11)" : "Pantalla completa (F11)"; });
  };
  setFs(D.isFullscreen()); D.onWindowState(setFs);

  const css = n => getComputedStyle(root).getPropertyValue(n).trim();
  const load = (tag, attrs) => new Promise((ok, ko) => { const el = document.createElement(tag); Object.assign(el, attrs); el.onload = ok; el.onerror = ko; document.head.append(el); });
  const X = D.xtermDir;
  const ready = Promise.all([
    load("link", { rel: "stylesheet", href: `${X}/xterm/css/xterm.css` }),
    load("script", { src: `${X}/xterm/lib/xterm.js` }).then(() => Promise.all([
      load("script", { src: `${X}/addon-fit/lib/addon-fit.js` }),
      load("script", { src: `${X}/addon-webgl/lib/addon-webgl.js` }).catch(() => {}),
    ])),
  ]);

  // ── terminales ───────────────────────────────────────────────
  const host = document.getElementById("sXterm");
  const terms = new Map(); // key → { key, xt, fit, el, pid, sessionId, exited }
  let active = null;
  const statusFns = new Set();

  function xtTheme() {
    const dark = root.dataset.theme !== "light";
    const base = {
      background: css("--bg"), foreground: css("--ink"), cursor: css("--accent"), cursorAccent: css("--bg"),
      selectionBackground: dark ? "rgba(240,163,94,.28)" : "rgba(200,96,26,.22)",
      scrollbarSliderBackground: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
    };
    // colores ANSI afinados a la paleta del lanzador (tintas de estrellas en oscuro, de atlas en claro)
    const pal = dark
      ? ["#1b1b1f", "#ff6a5a", "#4cc38a", "#ffc46b", "#8fa9f2", "#c9a6ff", "#7fd6e0", "#d8d6d0", "#55545a", "#ff8a7a", "#6fdba6", "#ffd29a", "#a7c0ff", "#dcc2ff", "#a3e6ee", "#f4f2ec"]
      : ["#151519", "#d23228", "#1f9a5c", "#b97100", "#2f5fe0", "#7c4dff", "#0d8aa0", "#6e6e76", "#a2a2aa", "#e5483d", "#28b36d", "#d18a00", "#3d6bff", "#9468ff", "#14a3bd", "#3b3b42"];
    ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"].forEach((n, i) => {
      base[n] = pal[i]; base["bright" + n[0].toUpperCase() + n.slice(1)] = pal[i + 8];
    });
    return base;
  }
  new MutationObserver(() => terms.forEach(t => { t.xt.options.theme = xtTheme(); })).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const fitNow = t => { if (!t || !t.el.offsetWidth) return; try { t.fit.fit(); D.term.resize(t.key, t.xt.cols, t.xt.rows); } catch { /* aún sin medir */ } };
  new ResizeObserver(() => fitNow(active)).observe(host);

  async function make(key, opts) {
    await ready;
    const el = document.createElement("div"); el.className = "xt"; host.append(el);
    const xt = new window.Terminal({
      fontFamily: "'Cascadia Mono', 'Martian Mono', Consolas, monospace", fontSize: 13, lineHeight: 1.15,
      cursorBlink: true, cursorStyle: "bar", allowProposedApi: true, scrollback: 8000,
      theme: xtTheme(), macOptionIsMeta: true, windowsPty: { backend: "conpty" },
    });
    const fit = new window.FitAddon.FitAddon();
    xt.loadAddon(fit); xt.open(el);
    if (window.WebglAddon) {
      try { const gl = new window.WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); xt.loadAddon(gl); } catch { /* sin WebGL: se queda el normal */ }
    }
    const t = { key, xt, fit, el, pid: 0, sessionId: opts.sessionId || null, exited: false, opts };
    terms.set(key, t);
    // copiar con selección, pegar texto; si el portapapeles solo tiene una imagen, Claude la lee con Alt+V
    xt.attachCustomKeyEventHandler(e => {
      if (e.type !== "keydown") return true;
      const k = e.key.toLowerCase();
      if (e.ctrlKey && !e.altKey && k === "c" && xt.hasSelection()) { navigator.clipboard.writeText(xt.getSelection()); xt.clearSelection(); return false; }
      if (e.ctrlKey && !e.altKey && k === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then(txt => { if (txt) xt.paste(txt); else D.term.write(key, "\x1bv"); }).catch(() => D.term.write(key, "\x1bv"));
        return false;
      }
      if (e.altKey && e.key === "ArrowLeft") return false; // reservado para volver al cúmulo
      return true;
    });
    xt.onData(d => D.term.write(key, d));
    D.term.onData(key, d => xt.write(d));
    D.term.onExit(key, () => {
      t.exited = true;
      xt.write("\r\n\x1b[2m— La sesión ha terminado. Pulsa Intro para volver a abrirla.\x1b[0m\r\n");
      emit(t, "exit");
    });
    xt.onKey(({ domEvent }) => { if (t.exited && domEvent.key === "Enter") restart(t); });
    fitNow(t);
    await start(t);
    return t;
  }
  async function start(t) {
    const r = await D.term.open({ key: t.key, sessionId: t.sessionId, cwd: t.opts.cwd, shellOnly: t.opts.shell, cols: t.xt.cols, rows: t.xt.rows });
    t.pid = r.pid; t.exited = false;
    if (r.buffer) t.xt.write(r.buffer);
  }
  function restart(t) { t.xt.clear(); start(t); }

  // arrastrar archivos al terminal escribe sus rutas (Claude las entiende como adjuntos)
  host.addEventListener("dragover", e => { e.preventDefault(); });
  host.addEventListener("drop", e => {
    e.preventDefault(); if (!active) return;
    const paths = [...e.dataTransfer.files].map(f => f.path).filter(Boolean);
    if (paths.length) { D.term.write(active.key, paths.map(p => /\s/.test(p) ? `"${p}"` : p).join(" ")); active.xt.focus(); }
  });

  function emit(t, status) { statusFns.forEach(f => f(t.key, status, t.sessionId)); }

  // estado de cada terminal a partir de ~/.claude/sessions/<pid>.json (el pid es el del propio Claude)
  const lastStatus = new Map();
  D.onLive(v => {
    terms.forEach(t => {
      if (!t.pid || t.exited || t.opts.shell) return;
      const L = v.live.find(x => x.pid === t.pid); if (!L) return;
      if (L.sessionId && L.sessionId !== t.sessionId) { t.sessionId = L.sessionId; emit(t, "id"); }
      const prev = lastStatus.get(t.key); lastStatus.set(t.key, L.status);
      if (prev !== L.status) emit(t, L.status === "busy" ? "working" : L.status === "idle" ? (prev === "busy" ? "done" : "idle") : "ask");
      const c = v.context && t.sessionId && v.context[t.sessionId];
      if (c && t === active && window.cumuloMonitor && window.cumuloMonitor.setContext) window.cumuloMonitor.setContext(c.tokens);
    });
  });

  window.cumuloTerm = {
    async show(key, opts) {
      let t = terms.get(key);
      terms.forEach(o => { o.el.hidden = o !== t; });
      if (!t) t = await make(key, opts);
      terms.forEach(o => { o.el.hidden = o !== t; });
      active = t;
      requestAnimationFrame(() => { fitNow(t); t.xt.focus(); });
      return t;
    },
    hide() { if (active) active.xt.blur(); active = null; },
    focus() { if (active) active.xt.focus(); },
    has: key => terms.has(key),
    kill(key) { const t = terms.get(key); if (!t) return; D.term.kill(key); D.term.off(key); t.xt.dispose(); t.el.remove(); terms.delete(key); if (active === t) active = null; },
    send(key, text) { D.term.write(key, text); },
    sessionId: key => (terms.get(key) || {}).sessionId,
    onStatus: f => statusFns.add(f),
  };

  // ── lanzador: apps, archivos, sesiones y acciones del ordenador ──
  const pal = document.createElement("div");
  pal.className = "palette"; pal.hidden = true;
  pal.innerHTML = `
    <div class="pal-box" role="dialog" aria-label="Lanzador">
      <label class="pal-field">
        <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4 14 14"/></svg>
        <input type="text" placeholder="Abrir una app, un archivo, una sesión o una acción…" spellcheck="false" autocomplete="off" aria-label="Buscar">
        <kbd>Esc</kbd>
      </label>
      <ul class="pal-list" role="listbox"></ul>
      <p class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> elegir</span><span><kbd>↵</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>↵</kbd> mostrar en carpeta</span><span class="pal-sc"></span></p>
    </div>`;
  document.body.append(pal);
  const pIn = pal.querySelector("input"), pList = pal.querySelector(".pal-list");
  let apps = [], items = [], sel = 0, cfg = {}, findSeq = 0, shellSt = { enabled: false, running: D.isShell }, wins = [];
  const refreshShell = () => D.shellGet().then(v => { shellSt = v; });
  refreshShell();
  D.apps().then(a => { apps = a; });
  D.getConfig().then(c => { cfg = c; pal.querySelector(".pal-sc").textContent = c.shortcut ? `${c.shortcut.replace("Space", "Espacio")} desde cualquier sitio` : ""; });

  const I = {
    app: '<path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z"/>',
    dir: '<path d="M1.8 4.2c0-.7.5-1.2 1.2-1.2h3l1.4 1.6H13c.7 0 1.2.5 1.2 1.2v6c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z"/>',
    file: '<path d="M4 1.8h5.2L12.4 5v9.2H4z"/><path d="M9 1.8V5h3.4"/>',
    star: '<path d="M8 1.8v12.4M1.8 8h12.4M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8"/>',
    act: '<path d="M8 2v5M4.6 4.1a5 5 0 1 0 6.8 0"/>',
    win: '<rect x="2" y="3" width="12" height="10" rx="1.4"/><path d="M2 5.8h12"/>',
    term: '<rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.4"/><path d="M4.4 6.4 6.6 8.2 4.4 10M8 10.4h3.4"/>',
  };
  const ACTIONS = () => [
    { kind: "act", icon: "term", name: "Terminal (PowerShell)", hint: "Dentro de Cúmulo", run: () => window.cumulo && window.cumulo.openShell() },
    { kind: "act", icon: "star", name: "Nueva sesión de Claude", hint: "En la carpeta que elijas en el mapa", run: () => document.getElementById("newSession").click() },
    { kind: "act", icon: "dir", name: "Explorador de archivos", hint: "Tu carpeta personal", run: () => D.power("explorer") },
    { kind: "act", icon: "act", name: "Configuración de Windows", run: () => D.power("settings") },
    { kind: "act", icon: "act", name: "Administrador de tareas", run: () => D.power("taskmgr") },
    { kind: "act", icon: "act", name: root.classList.contains("fullscreen") ? "Salir de pantalla completa" : "Pantalla completa", hint: "F11 · al abrir Cúmulo siempre vuelve a pantalla completa", run: () => D.toggleFullscreen() },
    { kind: "act", icon: "act", name: cfg.autostart ? "No arrancar Cúmulo con Windows" : "Arrancar Cúmulo con Windows", hint: cfg.autostart ? "Ahora arranca al encender" : "Se abre al encender el ordenador", run: async () => { cfg = await D.setConfig({ autostart: !cfg.autostart }); } },
    shellSt.enabled
      ? { kind: "act", icon: "act", name: "Volver al escritorio normal de Windows", hint: "Vuelven la barra de tareas y el escritorio de siempre", confirm: true, run: async () => { await D.shellSet(false); refreshShell(); } }
      : { kind: "act", icon: "act", name: "Usar Cúmulo como escritorio de Windows", hint: "Al entrar en Windows solo estará Cúmulo (se deshace desde aquí)", confirm: true, run: async () => { await D.shellSet(true); refreshShell(); } },
    { kind: "act", icon: "act", name: "Cerrar sesión de Windows", confirm: true, run: () => D.power("logoff") },
    { kind: "act", icon: "act", name: "Bloquear el ordenador", run: () => D.power("lock") },
    { kind: "act", icon: "act", name: "Suspender", run: () => D.power("sleep") },
    { kind: "act", icon: "act", name: "Reiniciar", hint: "Cierra las sesiones abiertas", confirm: true, run: () => D.power("restart") },
    { kind: "act", icon: "act", name: "Apagar", hint: "Cierra las sesiones abiertas", confirm: true, run: () => D.power("shutdown") },
  ];
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function score(name, q) {
    const n = norm(name); if (!q) return 1;
    if (n.startsWith(q)) return 3; if (n.split(/[\s\-_.]+/).some(w => w.startsWith(q))) return 2; if (n.includes(q)) return 1;
    return 0;
  }
  function compute(files) {
    const q = norm(pIn.value.trim());
    const pick = (list, map, max) => list.map(x => ({ x, s: score(map(x), q) })).filter(o => o.s).sort((a, b) => b.s - a.s).slice(0, max).map(o => o.x);
    const sess = (window.CUMULO_DATA.sessions || []).slice().sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    const out = [];
    wins = window.__cumuloWins || [];
    const W = wins.map(w => ({ kind: "win", icon: "win", name: w.title, hint: w.name, h: w.h, path: w.path }));
    if (!q) {
      out.push(...W.slice(0, 6));
      out.push(...ACTIONS().slice(0, 3));
      out.push(...sess.slice(0, 5).map(s => ({ kind: "sess", icon: "star", name: s.title, hint: s.projectName || s.project.split(/[\\/]/).pop(), id: s.id })));
      out.push(...apps.slice(0, 0));
    } else {
      out.push(...pick(W, w => w.name + " " + w.hint, 4));
      out.push(...pick(apps, a => a.name, 6).map(a => ({ kind: "app", icon: "app", name: a.name, hint: a.group, path: a.path })));
      out.push(...pick(ACTIONS(), a => a.name, 4));
      out.push(...pick(sess, s => s.title + " " + s.project, 5).map(s => ({ kind: "sess", icon: "star", name: s.title, hint: s.projectName || s.project.split(/[\\/]/).pop(), id: s.id })));
      out.push(...(files || []).map(f => ({ kind: f.dir ? "dir" : "file", icon: f.dir ? "dir" : "file", name: f.name, hint: f.path, path: f.path })));
    }
    return out;
  }
  const LABEL = { app: "App", act: "Acción", sess: "Sesión", dir: "Carpeta", file: "Archivo", win: "Abierta" };
  function render() {
    pList.innerHTML = "";
    items.forEach((it, i) => {
      const li = document.createElement("li"); li.role = "option"; li.className = "pal-item"; li.dataset.kind = it.kind;
      li.setAttribute("aria-selected", String(i === sel));
      li.innerHTML = `<span class="pi-ico"><svg viewBox="0 0 16 16" aria-hidden="true">${I[it.icon]}</svg></span><span class="pi-txt"><b></b><small></small></span><span class="pi-kind">${it.confirmArm ? "Pulsa otra vez" : LABEL[it.kind]}</span>`;
      li.querySelector("b").textContent = it.name; li.querySelector("small").textContent = it.hint || "";
      if ((it.kind === "app" || it.kind === "win") && it.path) D.icon(it.path).then(u => { if (u) li.querySelector(".pi-ico").innerHTML = `<img alt="" src="${u}">`; });
      li.onmousemove = () => { if (sel !== i) { sel = i; mark(); } };
      li.onclick = e => exec(it, e.ctrlKey);
      pList.append(li);
    });
    if (!items.length) pList.innerHTML = `<li class="pal-empty">Nada con ese nombre</li>`;
  }
  function mark() { [...pList.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === sel))); const c = pList.children[sel]; if (c) c.scrollIntoView({ block: "nearest" }); }
  function refresh() {
    items = compute(); sel = 0; render();
    const q = pIn.value.trim(), my = ++findSeq;
    if (q.length >= 2) D.find(q).then(f => { if (my !== findSeq) return; const keep = items[sel]; items = compute(f); sel = Math.max(0, items.indexOf(keep)); render(); });
  }
  async function exec(it, reveal) {
    if (it.confirm && !it.confirmArm) { it.confirmArm = true; render(); return; } // las acciones que apagan piden dos pulsaciones
    if (reveal && it.path && it.kind !== "win") { D.reveal(it.path); closePal(); return; }
    closePal();
    if (it.kind === "sess") window.cumulo && window.cumulo.openById(it.id);
    else if (it.kind === "win") D.winFocus(it.h);
    else if (it.run) it.run();
    else if (it.path) D.open(it.path);
  }
  let lastFocus = null;
  function openPal() {
    if (!pal.hidden) { pIn.select(); return; }
    lastFocus = document.activeElement;
    pal.hidden = false; pIn.value = ""; refresh(); pIn.focus();
    pal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
    pal.querySelector(".pal-box").animate([{ transform: "translateY(-6px) scale(.985)" }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(.16,1,.3,1)" });
  }
  function closePal() {
    if (pal.hidden) return;
    pal.hidden = true;
    if (window.cumuloTerm && document.getElementById("session").classList.contains("open")) window.cumuloTerm.focus();
    else if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  pIn.addEventListener("input", refresh);
  pIn.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) exec(items[sel], e.ctrlKey); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePal(); }
  });
  pal.addEventListener("mousedown", e => { if (e.target === pal) closePal(); });
  window.addEventListener("keydown", e => {
    if (e.ctrlKey && e.code === "Space") { e.preventDefault(); e.stopPropagation(); pal.hidden ? openPal() : closePal(); }
  }, true);
  D.onPalette(openPal);
  window.cumuloPalette = { open: openPal, close: closePal, isOpen: () => !pal.hidden };
})();

// ── barra de tareas: las ventanas abiertas de otras apps, junto a las sesiones ──
(() => {
  const D = window.cumuloDesktop;
  if (!D) return;
  const dock = document.getElementById("dock");
  const bar = document.createElement("nav");
  bar.className = "appbar"; bar.setAttribute("aria-label", "Ventanas abiertas");
  dock.after(bar);
  const els = new Map(); // h → botón
  const icons = new Map();
  let busy = false;
  async function tick() {
    if (busy || document.hidden) return; busy = true;
    try {
      const list = await D.windows();
      window.__cumuloWins = list;
      const seen = new Set();
      list.forEach(w => {
        seen.add(w.h);
        let b = els.get(w.h);
        if (!b) {
          b = document.createElement("button"); b.type = "button"; b.className = "app-item";
          b.innerHTML = `<span class="ai-ico"></span><span class="t"></span><span class="x" aria-label="Cerrar ventana"><svg class="ico" viewBox="0 0 16 16"><path d="M5 5l6 6M11 5l-6 6"/></svg></span>`;
          b.onclick = e => {
            if (e.target.closest(".x")) { D.winClose(w.h); return; }
            if (b.dataset.fg === "1" && !b.dataset.min) D.winMin(w.h); else D.winFocus(w.h);
            setTimeout(tick, 250);
          };
          b.onauxclick = e => { if (e.button === 1) D.winClose(w.h); };
          els.set(w.h, b); bar.append(b);
          const key = w.path || w.name;
          const setIco = u => { if (u) b.querySelector(".ai-ico").innerHTML = `<img alt="" src="${u}">`; };
          if (icons.has(key)) setIco(icons.get(key));
          else if (w.path) D.icon(w.path).then(u => { icons.set(key, u); setIco(u); });
        }
        b.querySelector(".t").textContent = w.title;
        b.title = `${w.title} — ${w.name}  (clic: traer · clic central: cerrar)`;
        b.dataset.fg = w.fg ? "1" : ""; b.dataset.min = w.min ? "1" : "";
      });
      els.forEach((b, h) => { if (!seen.has(h)) { b.remove(); els.delete(h); } });
      bar.classList.toggle("empty", !els.size);
    } catch { /* sin datos esta vez */ }
    busy = false;
  }
  tick(); setInterval(tick, 3000);
  window.addEventListener("focus", tick);
})();
