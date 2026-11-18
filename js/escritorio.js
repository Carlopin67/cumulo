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
  if (D.isShell) {
    document.querySelectorAll('.win-ctl [data-a="min"], .win-ctl [data-a="hide"]').forEach(b => { b.title = "Mandar detrás (Cúmulo es tu escritorio: no se cierra)"; });
    document.querySelectorAll('.win-ctl [data-a="fs"]').forEach(b => b.remove()); // como escritorio siempre va a pantalla completa
  }
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
      load("script", { src: `${X}/addon-image/lib/addon-image.js` }).catch(() => {}),
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
    // imágenes dentro de la terminal (sixel e iTerm: imgcat, chafa, viu…)
    if (window.ImageAddon) { try { xt.loadAddon(new window.ImageAddon.ImageAddon({ sixelSizeLimit: 8e6 })); } catch { /* sin imágenes */ } }
    imageLinks(xt, opts.cwd);
    const t = { key, xt, fit, el, pid: 0, sessionId: opts.sessionId || null, exited: false, opts, createdAt: Date.now() };
    terms.set(key, t);
    // copiar con selección, pegar texto; si el portapapeles solo tiene una imagen, Claude la lee con Alt+V
    xt.attachCustomKeyEventHandler(e => {
      if (e.type !== "keydown") return true;
      const k = e.key.toLowerCase();
      if (e.ctrlKey && !e.altKey && k === "c" && xt.hasSelection()) { navigator.clipboard.writeText(xt.getSelection()).catch(() => {}); xt.clearSelection(); return false; }
      if (e.ctrlKey && !e.altKey && k === "v") {
        e.preventDefault();
        // texto tal cual; una imagen se guarda en un archivo y se pega su ruta (Claude la adjunta como imagen)
        const img = () => clipImage().then(p => p ? xt.paste(p) : D.term.write(key, "\x1bv")).catch(() => D.term.write(key, "\x1bv"));
        navigator.clipboard.readText().then(txt => { if (txt) xt.paste(txt); else img(); }).catch(img);
        return false;
      }
      if (e.altKey && e.key === "ArrowLeft") return false; // reservado para volver al cúmulo
      return true;
    });
    xt.onData(d => D.term.write(key, d));
    D.term.onData(key, d => { xt.write(d); if (!t.opts.shell) sniff(t); });
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
    if (t.starting) return; // Intro pulsado varias veces seguidas: un solo arranque
    t.starting = true;
    try {
      const r = await D.term.open({ key: t.key, sessionId: t.sessionId, cwd: t.opts.cwd, shellOnly: t.opts.shell, cols: t.xt.cols, rows: t.xt.rows });
      t.pid = r.pid; t.exited = false;
      if (r.buffer) { t.xt.write(r.buffer); if (!t.opts.shell) sniff(t); }
    } catch (e) {
      t.exited = true;
      t.xt.write("\r\n\x1b[31m— No se pudo abrir Claude aquí. Pulsa Intro para intentarlo otra vez.\x1b[0m\r\n");
    } finally { t.starting = false; }
  }
  // modelo y esfuerzo leídos del texto que Claude tiene en pantalla: así el panel acierta desde el
  // principio y confirma al momento lo que eliges. Lo vivo manda: el pie («● high · /effort») y la
  // cabecera («Opus 5.5 with high effort»); si no se ven, el último «Set model/effort to…».
  const EF = "(low|medium|high|xhigh|max)", MD = "(Haiku|Sonnet|Opus|Fable)";
  const RX_HEAD = new RegExp(MD + " \\d+(?:\\.\\d+)? with " + EF + " effort");
  const RX_FOOT = new RegExp("[●◐◑◒◓○◉•] ?" + EF + " · /effort");
  const RX_SETM = new RegExp("(?:Set model to|Using) " + MD + " ", "g");
  const RX_SETE = new RegExp("effort level to " + EF, "g");
  function sniff(t) {
    if (t.sniffT) return; // como mucho una lectura cada medio segundo, aunque la terminal no pare
    t.sniffT = setTimeout(() => {
      t.sniffT = 0;
      const b = t.xt.buffer.active, lines = [];
      for (let i = Math.max(0, b.length - 400); i < b.length; i++) { const l = b.getLine(i); if (l) lines.push(l.translateToString(true)); }
      const txt = lines.join("\n");
      const last = rx => { let m, r = null; rx.lastIndex = 0; while ((m = rx.exec(txt))) r = m[1]; return r; };
      const head = txt.match(RX_HEAD), foot = txt.match(RX_FOOT);
      const model = (head && head[1]) || last(RX_SETM);
      const effort = (foot && foot[1]) || (head && head[2]) || last(RX_SETE);
      const seen = t.seen || (t.seen = {}), now = Date.now();
      const mm = model && MODELS.find(x => x.name === model), id = mm && mm.id;
      let changed = false;
      if (id && id !== seen.model) { seen.model = id; seen.modelAt = now; changed = true; }
      if (effort && effort !== seen.effort) { seen.effort = effort; seen.effortAt = now; changed = true; }
      if (changed && t === active) claudeBox(t, t.ctx, t.busy ? "busy" : "idle");
    }, 500);
  }
  function restart(t) { if (t.starting) return; t.xt.clear(); start(t); }

  // imagen del portapapeles → archivo temporal; devuelve su ruta (o null si no hay imagen)
  async function clipImage() {
    for (const it of await navigator.clipboard.read()) {
      const type = it.types.find(x => x.startsWith("image/"));
      if (type) return D.saveImage(new Uint8Array(await (await it.getType(type)).arrayBuffer()), type.split("/")[1]);
    }
    return null;
  }

  // rutas de imágenes que escribe Claude: al pasar el ratón se ve la imagen; con clic se abre
  // con letra de unidad se admiten espacios (C:\Mis fotos\a.png); las relativas, no (cortarían la frase de delante)
  const RX_IMG = /[A-Za-z]:[\\/][^"'<>|*?\r\n:]*?\.(?:png|jpe?g|gif|webp|bmp|svg|avif)\b|(?:~[\\/]|\.{1,2}[\\/])?[\w\-.~()\\/À-ÿ]*?[\w\-.~()À-ÿ]+\.(?:png|jpe?g|gif|webp|bmp|svg|avif)\b/gi;
  const peek = document.createElement("div"); peek.className = "xt-peek"; peek.hidden = true;
  const peekImg = document.createElement("img"); peek.append(peekImg); document.body.append(peek);
  peekImg.onerror = () => { peek.hidden = true; };
  function imageLinks(xt, cwd) {
    const full = p => {
      p = p.trim();
      if (/^[A-Za-z]:[\\/]/.test(p)) return p;
      if (/^~[\\/]/.test(p)) return D.home ? D.home + p.slice(1) : p;
      return cwd ? cwd.replace(/[\\/]+$/, "") + "\\" + p.replace(/^\.[\\/]/, "") : p;
    };
    const url = p => "file:///" + encodeURI(p.replace(/\\/g, "/")).replace(/#/g, "%23");
    xt.registerLinkProvider({
      provideLinks(y, cb) {
        const line = xt.buffer.active.getLine(y - 1); if (!line) return cb(undefined);
        const txt = line.translateToString(true), out = []; let m;
        RX_IMG.lastIndex = 0;
        while ((m = RX_IMG.exec(txt))) {
          const raw = m[0].replace(/^\s+/, ""), x = m.index + (m[0].length - raw.length);
          if (!/[\\/]/.test(raw) && !cwd) continue;
          const p = full(raw);
          out.push({
            text: raw, range: { start: { x: x + 1, y }, end: { x: x + raw.length, y } },
            decorations: { underline: true, pointerCursor: true },
            activate: () => D.open(p),
            hover: e => {
              peekImg.src = url(p); peek.hidden = false;
              const w = 320, r = { x: Math.min(e.clientX + 14, innerWidth - w - 12), y: e.clientY + 18 };
              if (r.y + 240 > innerHeight) r.y = e.clientY - 250;
              peek.style.left = r.x + "px"; peek.style.top = r.y + "px";
            },
            leave: () => { peek.hidden = true; },
          });
        }
        cb(out.length ? out : undefined);
      },
    });
  }

  // ── imágenes de la sesión: lo que Claude mira o crea aparece debajo de su terminal (como en el móvil) ──
  const shots = document.createElement("div"); shots.className = "xt-shots"; shots.hidden = true;
  shots.innerHTML = `<button type="button" class="xs-head" aria-expanded="true"><span>Imágenes</span><small></small><svg class="ico chev" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></svg></button><div class="xs-row" role="list"></div>`;
  host.after(shots);
  const shotRow = shots.querySelector(".xs-row"), shotHead = shots.querySelector(".xs-head");
  const fileUrl = p => "file:///" + encodeURI(p.replace(/\\/g, "/")).replace(/#/g, "%23");
  let folded = false; try { folded = localStorage.getItem("cumulo-shots-folded") === "1"; } catch { /* sin almacenamiento */ }
  const setFold = v => { folded = v; shots.classList.toggle("folded", v); shotHead.setAttribute("aria-expanded", String(!v)); try { localStorage.setItem("cumulo-shots-folded", v ? "1" : "0"); } catch { /* da igual */ } requestAnimationFrame(() => fitNow(active)); };
  setFold(folded);
  shotHead.onclick = () => setFold(!folded);
  // vista grande: clic o Esc para cerrar; doble clic abre el archivo
  const box = document.createElement("div"); box.className = "xt-box"; box.hidden = true;
  box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure>`;
  document.body.append(box);
  const boxImg = box.querySelector("img"), boxCap = box.querySelector("figcaption");
  const closeBox = () => { box.hidden = true; if (active) active.xt.focus(); };
  box.onclick = closeBox;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); closeBox(); } }, true);
  let shotKey = "", shotBusy = false;
  async function refreshShots() {
    const t = active;
    if (!t || !t.sessionId || t.opts.shell || !D.sessImages) { if (!shots.hidden) { shots.hidden = true; shotKey = ""; fitNow(active); } return; }
    if (shotBusy) return; shotBusy = true;
    let list = []; try { list = await D.sessImages(t.sessionId); } catch { /* sin datos */ }
    shotBusy = false;
    if (t !== active) return;
    const key = t.sessionId + "|" + list.map(x => x.path).join("|");
    if (key === shotKey) return;
    const same = shotKey.startsWith(t.sessionId + "|"), had = new Set([...shotRow.children].map(b => b.dataset.p));
    shotKey = key;
    shotRow.textContent = "";
    list.slice(-12).forEach(x => {
      const b = document.createElement("button"); b.type = "button"; b.className = "xs-item"; b.dataset.p = x.path;
      b.setAttribute("role", "listitem");
      const name = x.path.split(/[\\/]/).pop(); b.title = name + "  (clic: ver · doble clic: abrir)";
      const im = document.createElement("img"); im.alt = name; im.loading = "lazy"; im.src = fileUrl(x.path);
      im.onerror = () => b.remove();
      b.append(im);
      if (same && !had.has(x.path)) b.classList.add("new");
      b.onclick = () => { boxImg.src = im.src; boxCap.textContent = name; box.hidden = false; };
      b.ondblclick = () => D.open(x.path);
      shotRow.append(b);
    });
    shots.querySelector(".xs-head small").textContent = list.length;
    const was = shots.hidden; shots.hidden = !list.length;
    if (was !== shots.hidden) requestAnimationFrame(() => fitNow(active));
    shotRow.scrollLeft = shotRow.scrollWidth;
  }
  setInterval(() => { if (!document.hidden) refreshShots(); }, 2000);

  // arrastrar archivos al terminal escribe sus rutas (Claude las entiende como adjuntos)
  host.addEventListener("dragover", e => { e.preventDefault(); });
  host.addEventListener("drop", e => {
    e.preventDefault(); if (!active) return;
    const paths = [...e.dataTransfer.files].map(f => D.pathFor(f)).filter(Boolean);
    if (paths.length) { active.xt.paste(paths.map(p => /\s/.test(p) ? `"${p}"` : p).join(" ")); active.xt.focus(); }
  });

  function emit(t, status) { statusFns.forEach(f => f(t.key, status, t.sessionId)); }

  // estado de cada terminal a partir de ~/.claude/sessions/<pid>.json (el pid es el del propio Claude)
  const lastStatus = new Map();
  D.onLive(v => {
    terms.forEach(t => {
      if (!t.pid || t.exited || t.opts.shell) return;
      const L = v.live.find(x => x.pid === t.pid); if (!L) return;
      if (L.sessionId && L.sessionId !== t.sessionId) {
        // una sesión nueva nunca puede ser una que ya existía antes de abrir su terminal
        const old = !t.opts.sessionId && window.cumulo && window.cumulo.sessions && window.cumulo.sessions().find(s => s.id === L.sessionId && new Date(s.started) < t.createdAt - 60000);
        if (!old) { t.sessionId = L.sessionId; emit(t, "id"); }
      }
      const prev = lastStatus.get(t.key); lastStatus.set(t.key, L.status);
      if (prev !== L.status) emit(t, L.status === "busy" ? "working" : L.status === "idle" ? (prev === "busy" ? "done" : "idle") : "ask");
      const c = v.context && t.sessionId && v.context[t.sessionId];
      if (c && t === active && window.cumuloMonitor && window.cumuloMonitor.setContext) window.cumuloMonitor.setContext(c.tokens, false, c.size);
      t.ctx = c;
      if (t === active) claudeBox(t, c, L.status);
    });
  });

  // ── modelo y esfuerzo de la sesión abierta (en vez de escribir /model y /effort) ──
  const MODELS = [
    { id: "claude-haiku-5-5", name: "Haiku", label: "Haiku 5.5", rx: /haiku/i },
    { id: "claude-sonnet-5-5", name: "Sonnet", label: "Sonnet 5.5", rx: /sonnet/i },
    { id: "claude-opus-5-5", name: "Opus", label: "Opus 5.5", rx: /opus/i },
    { id: "claude-fable-5-2", name: "Fable", label: "Fable 5.2", rx: /fable/i },
  ];
  const EFFORTS = [["low", "Bajo", "Bajo"], ["medium", "Medio", "Medio"], ["high", "Alto", "Alto"], ["xhigh", "Muy alto", "Muy alto"], ["max", "Máximo", "Máx"]];
  const cbBox = document.getElementById("claudeBox");
  const cbModelVal = document.getElementById("cbModelVal"), cbEffortVal = document.getElementById("cbEffortVal");
  const cbModel = document.getElementById("cbModel"), cbEffort = document.getElementById("cbEffort");
  const cbTip = document.getElementById("cbTip"), cbSub = document.getElementById("cbSub");
  const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(2).replace(".", ",") + " M" : n >= 1e3 ? Math.round(n / 1e3) + " mil" : String(n);
  function segButtons(box, items, kind) {
    box.querySelectorAll("button").forEach(b => b.remove());
    items.forEach(([val, label, title]) => {
      const b = document.createElement("button"); b.type = "button"; b.role = "radio"; b.dataset.v = val;
      b.textContent = label; b.title = title || label;
      b.setAttribute("aria-checked", "false");
      b.onclick = () => choose(kind, val);
      box.append(b);
    });
  }
  segButtons(cbModel, MODELS.map(m => [m.id, m.name, m.id]), "model");
  segButtons(cbEffort, EFFORTS.map(([v, l, s]) => [v, s, l]), "effort");
  function markBox(box, val) {
    const bs = [...box.querySelectorAll("button")], k = bs.findIndex(b => b.dataset.v === val);
    bs.forEach((b, i) => b.setAttribute("aria-checked", String(i === k)));
    if (box === cbEffort) {
      cbEffortVal.textContent = k >= 0 ? EFFORTS[k][1] : "—";
    } else {
      const m = MODELS.find(x => x.id === val);
      cbModelVal.textContent = m ? m.label : "—";
    }
  }
  // el comando se teclea y el Intro va aparte: si va todo junto, Claude lo toma como texto pegado y no lo ejecuta
  // antes se vacía la caja de escribir (Ctrl+E al final y Ctrl+U borra la línea): si había algo a medio
  // escribir, el comando se pegaba detrás y se mandaba como mensaje («b/model …»)
  function send(t, cmd) {
    D.term.write(t.key, "\x05\x15");
    setTimeout(() => D.term.write(t.key, cmd), 120);
    setTimeout(() => D.term.write(t.key, "\r"), 400);
  }
  const queued = new Map(); // terminal -> órdenes elegidas mientras Claude trabajaba
  function choose(kind, val) {
    if (!active || active.exited) return;
    const cmd = kind === "model" ? `/model ${val}` : `/effort ${val}`;
    if (active.busy) {
      const q = queued.get(active) || {}; q[kind] = cmd; queued.set(active, q);
    } else send(active, cmd);
    active.wanted = { kind, val, at: Date.now() + (active.busy ? 600000 : 0) }; // lo elegido, hasta que Claude lo confirme (de cada terminal)
    markBox(kind === "model" ? cbModel : cbEffort, val);
    cbBox.classList.add("pending-" + kind);
    cbSub.textContent = active.busy ? "se aplica al terminar" : "";
    active.xt.focus();
  }
  function claudeBox(t, c, status) {
    t.busy = status === "busy";
    const wanted = t.wanted;
    const q = queued.get(t);
    if (!t.busy && q) {
      queued.delete(t);
      Object.values(q).forEach((cmd, i) => setTimeout(() => send(t, cmd), i * 700));
      if (wanted) wanted.at = Date.now();
    }
    cbSub.textContent = queued.has(t) ? "se aplica al terminar" : t.busy ? "trabajando…" : "";
    // lo más reciente manda: la barra de estado (tras cada mensaje) o lo visto en la terminal
    const sn = t.seen || {}, cm = c && MODELS.find(x => x.rx.test(c.model || c.modelName || ""));
    const cat = (c && c.at) || 0;
    const model = (sn.modelAt || 0) > cat ? sn.model : (cm && cm.id) || sn.model;
    const effort = (sn.effortAt || 0) > cat ? sn.effort : (c && c.effort) || sn.effort;
    const fresh = wanted && Date.now() - wanted.at < 8000;
    for (const [kind, box, val] of [["model", cbModel, model], ["effort", cbEffort, effort]]) {
      if (!val) continue;
      if (fresh && wanted.kind === kind && val !== wanted.val) continue; // aún no lo ha aplicado
      markBox(box, val); cbBox.classList.remove("pending-" + kind);
    }
    if (c) {
      // umbrales pensados para 1M; con una ventana más pequeña se avisa antes (a la misma proporción)
      const n = c.tokens || 0, k = Math.min(1, (c.size || 1e6) / 1e6), crit = 400000 * k, warn = 150000 * k;
      cbTip.className = "cb-tip" + (n >= crit ? " crit" : n >= warn ? " warn" : "");
      cbTip.innerHTML = n >= crit
        ? `<b>Empieza un chat nuevo.</b> Cada mensaje relee ${fmtK(n)} fichas y gasta mucho plan.`
        : n >= warn
        ? `<b>Chat largo.</b> Si cambias de tema, mejor uno nuevo o «Compactar».`
        : `<b>Chat ligero.</b> Puedes seguir en este sin problema.`;
    } else cbTip.textContent = "Se completa al primer mensaje de Claude.";
  }

  // Abrir y cerrar sesiones deprisa: cada terminal se crea una sola vez aunque se pida dos veces mientras arranca,
  // y si entretanto se ha cambiado de sesión o se ha vuelto al mapa, la que llega tarde no se pone delante.
  const making = new Map(); // key → promesa de la terminal que se está creando
  let showSeq = 0;
  window.cumuloTerm = {
    async show(key, opts) {
      const my = ++showSeq;
      let t = terms.get(key);
      terms.forEach(o => { o.el.hidden = o !== t; });
      if (!t) {
        let p = making.get(key);
        if (!p) { p = make(key, opts).finally(() => making.delete(key)); making.set(key, p); }
        try { t = await p; } catch { return null; }
      }
      if (my !== showSeq || terms.get(key) !== t) { if (t.el) t.el.hidden = t !== active; return t; }
      terms.forEach(o => { o.el.hidden = o !== t; });
      active = t;
      if (!t.opts.shell) claudeBox(t, t.ctx, t.busy ? "busy" : "idle");
      refreshShots();
      requestAnimationFrame(() => { if (active === t) { fitNow(t); t.xt.focus(); } });
      return t;
    },
    hide() { showSeq++; if (active) active.xt.blur(); active = null; refreshShots(); },
    focus() { if (active) active.xt.focus(); },
    has: key => terms.has(key),
    kill(key) {
      const p = making.get(key);
      if (p) { p.then(() => window.cumuloTerm.kill(key), () => {}); return; } // aún arrancando: se cierra al terminar
      const t = terms.get(key); if (!t) return;
      D.term.kill(key); D.term.off(key); clearTimeout(t.sniffT); queued.delete(t); lastStatus.delete(key);
      t.xt.dispose(); t.el.remove(); terms.delete(key); if (active === t) active = null;
    },
    send(key, text) { D.term.write(key, text); },
    // una orden de Claude (/compact…) con la caja de escribir vaciada antes y el Intro aparte
    command(key, cmd) { const t = terms.get(key); if (t && !t.exited) send(t, cmd); },
    sessionId: key => (terms.get(key) || {}).sessionId,
    onStatus: f => statusFns.add(f),
  };

  // ── lanzador: apps, archivos, sesiones y acciones del ordenador ──
  const pal = document.createElement("div");
  pal.className = "palette"; pal.hidden = true;
  pal.innerHTML = `
    <div class="pal-box" role="dialog" aria-label="Lanzador">
      <label class="pal-field">
        <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8v12.4M1.8 8h12.4M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8"/></svg>
        <input type="text" placeholder="Busca una app, un archivo o una sesión" spellcheck="false" autocomplete="off" aria-label="Buscar">
        <kbd>Esc</kbd>
      </label>
      <ul class="pal-list" role="listbox"></ul>
      <p class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> elegir</span><span><kbd>↵</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>↵</kbd> en su carpeta</span><span class="pal-sc"></span></p>
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
    ...(D.isShell ? [] : [{ kind: "act", icon: "act", name: root.classList.contains("fullscreen") ? "Salir de pantalla completa" : "Pantalla completa", hint: "F11 · al abrir Cúmulo siempre vuelve a pantalla completa", run: () => D.toggleFullscreen() }]),
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
    const sess = ((window.cumulo && window.cumulo.sessions && window.cumulo.sessions()) || window.CUMULO_DATA.sessions || []).slice().sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
    const out = [];
    wins = window.__cumuloWins || [];
    const W = wins.map(w => ({ kind: "win", icon: "win", name: w.title, hint: w.name, h: w.h, path: w.path }));
    if (!q) {
      out.push(...W.slice(0, 6));
      out.push(...ACTIONS().slice(0, 3));
      out.push(...sess.slice(0, 5).map(s => ({ kind: "sess", icon: "star", name: s.title, hint: s.projectName || s.project.split(/[\\/]/).pop(), id: s.id })));
      out.push(...apps.map(a => ({ kind: "app", icon: "app", name: a.name, hint: a.group, path: a.path })));
    } else {
      out.push(...pick(W, w => w.name + " " + w.hint, 4));
      out.push(...pick(apps, a => a.name, 6).map(a => ({ kind: "app", icon: "app", name: a.name, hint: a.group, path: a.path })));
      out.push(...pick(ACTIONS(), a => a.name, 4));
      out.push(...pick(sess, s => s.title + " " + s.project, 5).map(s => ({ kind: "sess", icon: "star", name: s.title, hint: s.projectName || s.project.split(/[\\/]/).pop(), id: s.id })));
      out.push(...(files || []).map(f => ({ kind: f.dir ? "dir" : "file", icon: f.dir ? "dir" : "file", name: f.name, hint: f.path, path: f.path })));
    }
    // secciones con rótulo (como las constelaciones del mapa); sin buscar, las apps van en cuadrícula
    return out.map(x => ({ ...x, sec: SEC[x.kind], tile: !q && x.kind === "app" }));
  }
  const SEC = { win: "Ventanas abiertas", act: "Acciones", sess: "Sesiones", app: "Apps", dir: "Archivos", file: "Archivos" };
  let els = []; // <li> de cada elemento, en el mismo orden que items
  function render() {
    pList.innerHTML = ""; els = [];
    let last = null;
    items.forEach((it, i) => {
      if (it.sec !== last) {
        last = it.sec;
        const h = document.createElement("li"); h.className = "pal-sec"; h.setAttribute("role", "presentation");
        h.textContent = it.sec; pList.append(h);
      }
      const li = document.createElement("li"); li.role = "option"; li.className = "pal-item" + (it.tile ? " tile" : ""); li.dataset.kind = it.kind;
      li.setAttribute("aria-selected", String(i === sel));
      li.innerHTML = `<span class="pi-ico"><svg viewBox="0 0 16 16" aria-hidden="true">${I[it.icon]}</svg></span><span class="pi-txt"><b></b><small></small></span><span class="pi-kind">${it.confirmArm ? "Pulsa otra vez" : "↵"}</span>`;
      if (it.confirmArm) li.classList.add("arm");
      li.querySelector("b").textContent = it.name; li.querySelector("small").textContent = it.tile ? "" : it.hint || "";
      if (it.tile) li.title = it.name;
      els.push(li);
      if ((it.kind === "app" || it.kind === "win") && it.path) D.icon(it.path).then(u => { if (u) li.querySelector(".pi-ico").innerHTML = `<img alt="" src="${u}">`; });
      li.onmousemove = () => { if (sel !== i) { sel = i; mark(); } };
      li.onclick = e => exec(it, e.ctrlKey);
      pList.append(li);
    });
    if (!items.length) pList.innerHTML = `<li class="pal-empty">${searching ? "Buscando…" : "Nada con ese nombre"}</li>`;
  }
  function mark() {
    els.forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
    const c = els[sel]; if (!c) return;
    // al volver arriba del todo se ve también el rótulo de la sección
    const prev = c.previousElementSibling;
    (prev && prev.classList.contains("pal-sec") ? prev : c).scrollIntoView({ block: "nearest" });
    if (prev !== c) c.scrollIntoView({ block: "nearest" });
  }
  // flechas por posición en pantalla: en la lista va fila a fila y en la cuadrícula de apps, por columnas
  function move(dir) {
    if (!els.length) return;
    const r = els[sel].getBoundingClientRect(), cx = items[sel].tile ? r.left + r.width / 2 : r.left; // desde una fila se entra por la primera app
    if (dir === "left" || dir === "right") {
      if (!items[sel].tile) return false;
      const j = sel + (dir === "right" ? 1 : -1);
      if (items[j] && items[j].tile) { sel = j; mark(); }
      return true;
    }
    let best = -1, bd = Infinity;
    els.forEach((li, i) => {
      if (i === sel) return;
      const b = li.getBoundingClientRect();
      const dy = dir === "down" ? b.top - r.bottom : r.top - b.bottom;
      if (dy < -2) return;
      const d = dy * 10 + Math.abs(b.left + b.width / 2 - cx);
      if (d < bd) { bd = d; best = i; }
    });
    sel = best >= 0 ? best : dir === "down" ? 0 : els.length - 1;
    mark(); return true;
  }
  let searching = false; // mientras se buscan archivos no se dice «nada» todavía
  function refresh() {
    const q = pIn.value.trim(), my = ++findSeq;
    searching = q.length >= 2;
    items = compute(); sel = 0; render();
    if (searching) D.find(q).then(f => { if (my !== findSeq) return; searching = false; const keep = items[sel]; items = compute(f); sel = Math.max(0, items.indexOf(keep)); render(); }, () => { if (my === findSeq) { searching = false; render(); } });
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
    if (e.key === "ArrowDown") { e.preventDefault(); move("down"); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move("up"); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !pIn.value && items[sel] && items[sel].tile) { e.preventDefault(); move(e.key === "ArrowLeft" ? "left" : "right"); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) exec(items[sel], e.ctrlKey); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closePal(); }
  });
  pal.addEventListener("mousedown", e => { if (e.target === pal) closePal(); });
  window.addEventListener("keydown", e => {
    if (e.ctrlKey && e.code === "Space") { e.preventDefault(); e.stopPropagation(); pal.hidden ? openPal() : closePal(); }
  }, true);
  D.onPalette(toggle => { if (toggle && !pal.hidden) closePal(); else openPal(); });
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
  const CLAUDE_APPS = /^(chrome|claude|WindowsTerminal|OpenConsole|powershell|pwsh|cmd|Code)$/i;
  let busy = false;
  async function tick() {
    if (busy || document.hidden) return; busy = true;
    try {
      // solo lo que se usa con Claude (navegador y terminales); el resto vive en la barra de Windows
      const list = (await D.windows()).filter(w => CLAUDE_APPS.test(w.name || ""));
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
