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
    const el = document.createElement("div"); el.className = "xt" + (opts.shell ? " shell" : ""); host.append(el);
    const live = document.createElement("div"); live.className = "xt-live"; el.append(live);
    const xt = new window.Terminal({
      fontFamily: "'Cascadia Mono', 'Martian Mono', Consolas, monospace", fontSize: 13, lineHeight: 1.15,
      cursorBlink: true, cursorStyle: "bar", allowProposedApi: true, scrollback: 8000,
      theme: xtTheme(), macOptionIsMeta: true, windowsPty: { backend: "conpty" },
    });
    const fit = new window.FitAddon.FitAddon();
    xt.loadAddon(fit); xt.open(live);
    if (window.WebglAddon) {
      try { const gl = new window.WebglAddon.WebglAddon(); gl.onContextLoss(() => gl.dispose()); xt.loadAddon(gl); } catch { /* sin WebGL: se queda el normal */ }
    }
    // imágenes dentro de la terminal (sixel e iTerm: imgcat, chafa, viu…)
    if (window.ImageAddon) { try { xt.loadAddon(new window.ImageAddon.ImageAddon({ sixelSizeLimit: 8e6 })); } catch { /* sin imágenes */ } }
    imageLinks(xt, opts.cwd);
    const t = { key, xt, fit, el, live, pid: 0, sessionId: opts.sessionId || null, exited: false, opts, createdAt: Date.now() };
    if (!opts.shell) {
      el.prepend(makeFeed(t)); el.append(makeComposer(t));
      // una sesión que ya existe: la conversación se lee ya, sin esperar a que arranque Claude
      if (t.sessionId) { t.cv.empty.hidden = true; feedTick(t); }
      const h = document.createElement("p"); h.className = "xt-ask-h"; h.textContent = "Claude necesita tu respuesta · contesta aquí con el teclado"; live.append(h);
    }
    new ResizeObserver(() => { if (t === active) fitNow(t); }).observe(live);
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
      if (r.elsewhere) {
        t.exited = true;
        t.xt.write("\r\n\x1b[2m— Esta sesión ya está abierta en otra ventana. Aquí puedes leerla; para escribir, ciérrala allí y pulsa Intro.\x1b[0m\r\n");
        if (t.cv) t.cv.setReadonly(true);
        return;
      }
      t.pid = r.pid; t.exited = false;
      if (t.cv) t.cv.setReadonly(false);
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
  function screenText(t, n = 40) {
    const b = t.xt.buffer.active, out = [];
    for (let i = Math.max(0, b.length - n); i < b.length; i++) { const l = b.getLine(i); out.push(l ? l.translateToString(true) : ""); }
    return out.join("\n");
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

  // ── vista de conversación (como la app del móvil) ──
  // Arriba, la conversación leída del .jsonl de la sesión: tus mensajes, lo que responde Claude, sus
  // herramientas y las imágenes en su sitio. Abajo, la parte viva de Claude (donde se escribe, el
  // «pensando…», los permisos y las preguntas), que crece sola cuando Claude te pregunta algo.
  const fileUrl = p => "file:///" + encodeURI(p.replace(/\\/g, "/")).replace(/#/g, "%23");
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function inline(s) {
    return esc(s)
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>")
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  }
  // markdown corto: bloques de código, títulos, listas, citas, tablas (tal cual) y párrafos
  function md(src) {
    const out = [], lines = src.replace(/\r/g, "").split("\n");
    let i = 0, para = [], list = null;
    const flushP = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.tag}>${list.items.map(x => `<li>${inline(x)}</li>`).join("")}</${list.tag}>`); list = null; } };
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        flushP(); flushL();
        const code = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
        i++; out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        flushP(); flushL();
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
        const cells = r => r.trim().slice(1, -1).split("|").map(c => inline(c.trim()));
        const body = rows.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
        out.push(`<div class="cv-table"><table>${body.map((r, n) => `<tr>${cells(r).map(c => n ? `<td>${c}</td>` : `<th>${c}</th>`).join("")}</tr>`).join("")}</table></div>`);
        continue;
      }
      let m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { flushP(); flushL(); out.push(`<h4>${inline(m[2])}</h4>`); i++; continue; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(l)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) {
        flushP();
        const tag = /^\s*\d/.test(l) ? "ol" : "ul";
        if (!list || list.tag !== tag) { flushL(); list = { tag, items: [] }; }
        list.items.push(m[1]); i++; continue;
      }
      if ((m = /^>\s?(.*)$/.exec(l))) { flushP(); flushL(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); i++; continue; }
      if (!l.trim()) { flushP(); flushL(); i++; continue; }
      if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += " " + l.trim(); i++; continue; }
      flushL(); para.push(l); i++;
    }
    flushP(); flushL();
    return out.join("");
  }

  // vista grande de una imagen: clic o Esc para cerrar
  const box = document.createElement("div"); box.className = "xt-box"; box.hidden = true;
  box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure>`;
  document.body.append(box);
  const boxImg = box.querySelector("img"), boxCap = box.querySelector("figcaption");
  const closeBox = () => { box.hidden = true; focusT(active); };
  box.onclick = closeBox;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { e.stopPropagation(); closeBox(); } }, true);
  const zoom = (src, name) => { boxImg.src = src; boxCap.textContent = name || ""; box.hidden = false; };

  function imgEl(src, name, file) {
    const f = document.createElement("figure"); f.className = "cv-fig";
    const b = document.createElement("button"); b.type = "button"; b.className = "cv-img";
    b.title = file ? "Clic: ampliar · doble clic: abrir el archivo" : "Clic: ampliar";
    const im = document.createElement("img"); im.alt = name || ""; im.loading = "lazy"; im.src = src;
    im.onerror = () => { f.classList.add("gone"); b.remove(); };
    b.append(im);
    b.onclick = () => zoom(src, name);
    if (file) b.ondblclick = () => D.open(file);
    f.append(b);
    if (name) { const c = document.createElement("figcaption"); c.textContent = name; f.append(c); }
    return f;
  }
  const TOOL_ES = { Read: "Lee", Write: "Escribe", Edit: "Edita", MultiEdit: "Edita", Bash: "Ejecuta", PowerShell: "Ejecuta", Grep: "Busca", Glob: "Busca archivos",
    WebFetch: "Abre", WebSearch: "Busca en internet", Agent: "Agente", Task: "Agente", TodoWrite: "Tareas", AskUserQuestion: "Te pregunta", Skill: "Habilidad", NotebookEdit: "Edita" };
  const hhmm = at => { try { return at ? new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(at)) : ""; } catch { return ""; } };
  const toolName = x => TOOL_ES[x.name] || String(x.name || "").replace(/^mcp__.*?__/, "").replace(/_/g, " ");
  // lo que se lee de un vistazo: la ruta se queda en el nombre del archivo
  const toolShort = x => { const a = x.arg || ""; return /^[A-Za-z]:[\\/]|^\//.test(a) && !/\s/.test(a) ? a.split(/[\\/]/).pop() : a; };
  function head(who, at) {
    const h = document.createElement("header"); h.className = "cv-head";
    h.innerHTML = `<span class="cv-who"></span><time></time>`;
    h.firstChild.textContent = who; h.lastChild.textContent = hhmm(at);
    return h;
  }
  // ── encuestas (AskUserQuestion): se contestan en la tarjeta, sin ver la terminal ──
  // Claude espera teclas: un número elige (o marca, si es de varias), «Type something» se rellena y se
  // confirma con Intro, Tab pasa a la siguiente pregunta y en «Review your answers» el 1 envía.
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function qCard(t, x) {
    const card = document.createElement("div"); card.className = "cv-q"; if (x.id) card.dataset.q = x.id;
    const sel = x.questions.map(() => ({ picked: new Set(), other: "" }));
    const sendB = document.createElement("button");
    const ready = () => sel.every(s => s.picked.size || s.other.trim());
    const update = () => { sendB.disabled = !ready() || card.classList.contains("sending"); };
    x.questions.forEach((q, qi) => {
      const box = document.createElement("div"); box.className = "cv-qi" + (q.multi ? " multi" : ""); box.dataset.question = q.question;
      box.innerHTML = `<p class="cv-qh"><span class="cv-qtag"></span><b></b><small class="cv-qkind"></small></p><div class="cv-qopts" role="${q.multi ? "group" : "radiogroup"}"></div><p class="cv-qother" hidden></p>`;
      box.querySelector(".cv-qtag").textContent = q.header || "Pregunta";
      box.querySelector("b").textContent = q.question;
      box.querySelector(".cv-qkind").textContent = q.multi ? "Puedes elegir varias" : "";
      const opts = box.querySelector(".cv-qopts");
      const paint = () => opts.querySelectorAll(".cv-qo").forEach(b => { const on = b.dataset.i === "o" ? !!sel[qi].other.trim() : sel[qi].picked.has(+b.dataset.i); b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); });
      q.options.forEach((o, i) => {
        const b = document.createElement("button"); b.type = "button"; b.className = "cv-qo"; b.dataset.i = i; b.dataset.label = o.label;
        b.setAttribute("role", q.multi ? "checkbox" : "radio");
        b.innerHTML = `<span class="cv-qmark" aria-hidden="true"></span><span class="cv-qt"><b></b><small></small></span>`;
        b.querySelector("b").textContent = o.label;
        b.querySelector("small").textContent = o.description;
        b.onclick = () => {
          if (card.classList.contains("done") || card.classList.contains("sending")) return;
          const s = sel[qi];
          if (q.multi) { s.picked.has(i) ? s.picked.delete(i) : s.picked.add(i); }
          else { s.picked = new Set([i]); s.other = ""; otherIn.value = ""; }
          paint(); update();
        };
        opts.append(b);
      });
      // otra respuesta escrita
      const ow = document.createElement("label"); ow.className = "cv-qo cv-qo-other"; ow.dataset.i = "o";
      ow.innerHTML = `<span class="cv-qmark" aria-hidden="true"></span><input type="text" placeholder="Otra respuesta…" spellcheck="false">`;
      const otherIn = ow.querySelector("input");
      otherIn.oninput = () => { sel[qi].other = otherIn.value; if (!q.multi && otherIn.value.trim()) sel[qi].picked.clear(); paint(); update(); };
      otherIn.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || ready())) { e.preventDefault(); sendB.click(); } };
      opts.append(ow);
      card.append(box);
    });
    const bar = document.createElement("div"); bar.className = "cv-qbar";
    bar.innerHTML = `<span class="cv-qfoot">Elige y envía</span><button type="button" class="cv-qterm">Ver en la terminal</button>`;
    sendB.type = "button"; sendB.className = "cv-qsend"; sendB.textContent = "Enviar respuestas";
    bar.append(sendB); card.append(bar);
    bar.querySelector(".cv-qterm").onclick = () => { t.el.classList.remove("qmode"); t.qTerm = true; focusT(t); };
    sendB.onclick = async () => {
      if (!ready() || t.exited || t.readonly) { if (t.readonly) card.querySelector(".cv-qfoot").textContent = "Esta sesión está en otra ventana: contesta allí"; return; }
      card.classList.add("sending"); update(); card.querySelector(".cv-qfoot").textContent = "Enviando…";
      try { await answerQ(t, x.questions, sel); card.querySelector(".cv-qfoot").textContent = "Enviada"; }
      catch { card.querySelector(".cv-qfoot").textContent = "No se pudo: contesta en la terminal"; t.el.classList.remove("qmode"); }
      card.classList.remove("sending"); update();
    };
    update();
    return card;
  }
  async function answerQ(t, qs, sel) {
    const K = d => D.term.write(t.key, d);
    const scr = () => screenText(t, 30);
    if (!/Type something|Enter to select/.test(scr())) throw new Error("no hay pregunta en pantalla");
    for (let i = 0; i < qs.length; i++) {
      const q = qs[i], s = sel[i], other = q.options.length + 1;
      if (q.multi) {
        for (const k of [...s.picked].sort()) { K(String(k + 1)); await sleep(220); }
        if (s.other.trim()) { K(String(other)); await sleep(260); K(s.other.trim()); await sleep(260); }
        K("\t");
      } else if (s.other.trim()) { K(String(other)); await sleep(260); K(s.other.trim()); await sleep(260); K("\r"); }
      else K(String([...s.picked][0] + 1));
      await sleep(450);
    }
    // con varias preguntas (o de varias respuestas) sale el resumen: el 1 envía
    for (let k = 0; k < 15; k++) {
      const sc = scr();
      if (/Submit answers/.test(sc)) { K("1"); return; }
      if (!/Enter to select|Type something/.test(sc)) return; // ya se envió sola
      await sleep(200);
    }
  }
  // un turno: tu mensaje y, debajo, todo lo que hace y dice Claude hasta tu siguiente mensaje
  function renderItems(t, list, prepend) {
    const frag = document.createDocumentFragment();
    let st = prepend ? { claude: null, tools: null } : t.cv.st || { claude: null, tools: null };
    const claudeBlock = at => {
      if (st.claude) return st.claude;
      const c = document.createElement("section"); c.className = "cv-claude";
      c.append(head("Claude", at));
      const body = document.createElement("div"); body.className = "cv-body"; c.append(body);
      frag.append(c); st.claude = body; return body;
    };
    list.forEach(x => {
      if (x.k === "u") {
        const u = document.createElement("section"); u.className = "cv-user";
        u.append(head("Tú", x.at));
        if (x.imgs && x.imgs.length) { const g = document.createElement("div"); g.className = "cv-imgs"; x.imgs.forEach(s => g.append(imgEl(s, ""))); u.append(g); }
        if (x.text) { const p = document.createElement("div"); p.className = "cv-utext"; p.textContent = x.text; u.append(p); }
        frag.append(u); st = { claude: null, tools: null }; return;
      }
      const body = claudeBlock(x.at);
      if (x.k === "t") {
        // acciones seguidas: un solo renglón plegado («Lee mon4.png y 3 más»); se despliega al pulsar
        if (!st.tools) {
          const d = document.createElement("details"); d.className = "cv-tools";
          d.innerHTML = `<summary><svg class="cv-tico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg><span class="cv-tsum"></span><span class="cv-tn"></span></summary><ol></ol>`;
          body.append(d); st.tools = { d, n: 0, first: x };
        }
        const li = document.createElement("li");
        li.innerHTML = `<b></b><span></span>`; li.firstChild.textContent = toolName(x); li.lastChild.textContent = x.arg || "";
        li.title = x.arg || "";
        st.tools.d.querySelector("ol").append(li);
        st.tools.n++;
        const f = st.tools.first;
        st.tools.d.querySelector(".cv-tsum").textContent = `${toolName(f)} ${toolShort(f)}`.trim();
        st.tools.d.querySelector(".cv-tn").textContent = st.tools.n > 1 ? `y ${st.tools.n - 1} más` : "";
        return;
      }
      if (x.k === "q") { st.tools = null; body.append(qCard(t, x)); return; }
      if (x.k === "qa") {
        // se marca en su tarjeta lo que respondiste (y si escribiste otra cosa, se enseña)
        const sel = x.id ? `.cv-q[data-q="${CSS.escape(x.id)}"]` : null;
        const card = (sel && (frag.querySelector(sel) || t.cv.list.querySelector(sel))) || [...t.cv.list.querySelectorAll(".cv-q:not(.done)"), ...frag.querySelectorAll(".cv-q:not(.done)")].pop();
        if (card) {
          card.classList.add("done");
          card.querySelectorAll(".cv-qi").forEach(box => {
            const a = x.answers[box.dataset.question]; if (a == null) return;
            const picked = String(a).split(", ");
            let hit = false;
            box.querySelectorAll(".cv-qo[data-label]").forEach(li => { const on = picked.includes(li.dataset.label) || String(a) === li.dataset.label; li.classList.toggle("on", on); hit = hit || on; });
            if (!hit) { const o = box.querySelector(".cv-qother"); o.hidden = false; o.textContent = String(a); }
          });
          card.querySelector(".cv-qfoot").textContent = "Respondida";
        }
        return;
      }
      st.tools = null;
      if (x.k === "a") { const d = document.createElement("div"); d.className = "cv-a"; d.innerHTML = md(x.text); body.append(d); return; }
      if (x.k === "img") {
        const name = x.path.split(/[\\/]/).pop();
        if (x.gone) { const p = document.createElement("p"); p.className = "cv-gone"; p.textContent = `Imagen ya borrada · ${name}`; body.append(p); }
        else body.append(imgEl(fileUrl(x.path), name, x.path));
      }
    });
    if (prepend) t.cv.list.prepend(frag); else { t.cv.list.append(frag); t.cv.st = st; }
    // la encuesta ya contestada llega al registro: la tarjeta en vivo que esperaba se va sin dejar hueco
    const lc = t.cv.qcard;
    if (!prepend && lc && lc.classList.contains("sent") && list.some(x => x.k === "q")) { lc.remove(); lc.dataset.sig = ""; lc.classList.remove("sent"); }
  }
  const PAGE = 300; // se pintan las últimas; las anteriores, al pedirlas
  function makeFeed(t) {
    const feed = document.createElement("div"); feed.className = "xt-feed";
    feed.innerHTML = `<div class="cv-col"><button type="button" class="cv-more" hidden></button><div class="cv-list"></div><div class="cv-work"><span class="cv-spark" aria-hidden="true"></span>Claude está trabajando<small></small></div><p class="cv-empty">Escribe abajo para empezar. Aquí irá la conversación, con las imágenes en su sitio.</p></div>`;
    t.cv = { feed, list: feed.querySelector(".cv-list"), more: feed.querySelector(".cv-more"), empty: feed.querySelector(".cv-empty"), work: feed.querySelector(".cv-work"), items: [], shownFrom: 0, st: null, busy: false, id: null };
    t.cv.more.onclick = () => {
      const cv = t.cv, from = Math.max(0, cv.shownFrom - PAGE), h = feed.scrollHeight;
      renderItems(t, cv.items.slice(from, cv.shownFrom), true); cv.shownFrom = from;
      feed.scrollTop += feed.scrollHeight - h;
      cv.more.hidden = !from; cv.more.textContent = `Ver ${Math.min(PAGE, from)} anteriores`;
    };
    feed.addEventListener("click", e => { const a = e.target.closest("a[href]"); if (a) { e.preventDefault(); D.open(a.href); } });
    return feed;
  }
  async function feedTick(t = active) {
    if (!t || !t.cv || t.opts.shell || !D.sessFeed) return;
    const cv = t.cv;
    if (!t.sessionId || cv.busy) return;
    // vaciar sin perder lo que acabas de mandar (en una sesión nueva el id llega después del primer mensaje)
    const wipe = () => { const keep = [...cv.list.querySelectorAll(".cv-user.pending")]; cv.items = []; cv.shownFrom = 0; cv.list.textContent = ""; cv.st = null; cv.list.append(...keep); };
    if (cv.id !== t.sessionId) { cv.id = t.sessionId; wipe(); }
    cv.busy = true;
    let r = null; try { r = await D.sessFeed(t.sessionId, cv.items.length); } catch { /* sin datos */ }
    cv.busy = false;
    if (!r || cv.id !== t.sessionId) return;
    if (r.reset) wipe();
    if (!r.items.length) { cv.empty.hidden = !!cv.items.length || !!cv.list.querySelector(".pending"); return; }
    // cada mensaje tuyo que llega al registro quita su copia provisional: la que coincide en texto o, si
    // Claude lo guardó cambiado (texto pegado largo, solo imagen…), la más antigua mandada antes que él
    r.items.filter(x => x.k === "u").forEach(x => {
      const ps = [...cv.list.querySelectorAll(".cv-user.pending")]; if (!ps.length) return;
      const at = x.at ? Date.parse(x.at) : NaN;
      const oldest = ps[0], sentAt = +oldest.dataset.at || 0;
      const p = ps.find(p => p.dataset.text && (x.text || "").includes(p.dataset.text)) || (isNaN(at) || at >= sentAt - 3000 ? oldest : null);
      if (p) p.remove();
    });
    const f = cv.feed, stick = f.scrollTop + f.clientHeight >= f.scrollHeight - 60 || !cv.items.length;
    const first = !cv.items.length;
    if (first) cv.pinUntil = Date.now() + 5000; // al abrir, abajo del todo aunque las imágenes tarden en cargar
    cv.items.push(...r.items);
    if (first && cv.items.length > PAGE) {
      cv.shownFrom = cv.items.length - PAGE;
      cv.more.hidden = false; cv.more.textContent = `Ver ${Math.min(PAGE, cv.shownFrom)} anteriores`;
      renderItems(t, cv.items.slice(cv.shownFrom));
    } else renderItems(t, r.items);
    // lo que mandaste y aún no ha llegado sigue abajo del todo, debajo de lo que Claude va escribiendo
    const still = cv.list.querySelectorAll(".cv-user.pending"); if (still.length) cv.list.append(...still);
    cv.empty.hidden = true;
    if (stick) {
      f.scrollTop = f.scrollHeight;
      // las imágenes llegan después: se sigue abajo cuando terminan de cargar
      cv.list.querySelectorAll("img:not([data-w])").forEach(im => { im.dataset.w = "1"; im.addEventListener("load", () => { if (Date.now() < cv.pinUntil || f.scrollHeight - f.scrollTop - f.clientHeight < 600) f.scrollTop = f.scrollHeight; }, { once: true }); });
    }
  }
  setInterval(() => { if (!document.hidden) feedTick(); }, 1200);

  // vista: conversación (por defecto) o la terminal entera, como antes
  let rawTerm = false; try { rawTerm = localStorage.getItem("cumulo-vista") === "terminal"; } catch { /* sin almacenamiento */ }
  const viewBtn = document.getElementById("sView");
  function setView(raw) {
    rawTerm = raw; root.classList.toggle("raw-term", raw);
    if (viewBtn) { viewBtn.querySelector("span").textContent = raw ? "Conversación" : "Terminal"; viewBtn.title = raw ? "Ver la conversación con las imágenes" : "Ver la terminal entera de Claude"; }
    try { localStorage.setItem("cumulo-vista", raw ? "terminal" : "conversacion"); } catch { /* da igual */ }
    requestAnimationFrame(() => { fitNow(active); if (active && active.cv && !raw) active.cv.feed.scrollTop = active.cv.feed.scrollHeight; });
  }
  setView(rawTerm);
  if (viewBtn) viewBtn.onclick = () => { setView(!rawTerm); focusT(active); };


  // ── caja de escribir propia (en vez de la línea de la terminal) ──
  // Lo escrito se le pasa a Claude como un pegado (respeta los saltos de línea) y luego Intro.
  // Las imágenes pegadas o arrastradas se guardan en un archivo y viajan como su ruta: Claude las adjunta.
  const IC = {
    clip: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 7.6 8.1 13a3.3 3.3 0 0 1-4.7-4.7l5.6-5.6a2.2 2.2 0 0 1 3.1 3.1L6.6 11.3a1.1 1.1 0 0 1-1.6-1.6l5-5"/></svg>`,
    send: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>`,
    stop: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1.2"/></svg>`,
    x: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5l6 6M11 5l-6 6"/></svg>`,
  };
  const focusT = t => {
    if (!t) return;
    if (!t.opts.shell && !rawTerm && t.cv && !t.el.classList.contains("ask")) t.cv.input.focus({ preventScroll: true });
    else t.xt.focus();
  };
  function makeComposer(t) {
    const c = document.createElement("form"); c.className = "cv-composer"; c.autocomplete = "off";
    c.innerHTML = `<div class="cv-box">
        <div class="cv-tray" hidden></div>
        <textarea rows="1" placeholder="Escribe a Claude…" aria-label="Mensaje para Claude" spellcheck="false"></textarea>
        <div class="cv-bar">
          <label class="cv-btn" title="Adjuntar imágenes (también puedes pegarlas o arrastrarlas)">${IC.clip}<span>Imagen</span><input type="file" accept="image/*" multiple hidden></label>
          <span class="cv-state"></span>
          <span class="cv-keys"><span class="k-send"><kbd>↵</kbd> enviar · <kbd>Ctrl</kbd><kbd>↵</kbd> salto</span><span class="k-stop"><kbd>Esc</kbd> parar</span></span>
          <button type="submit" class="cv-send" title="Enviar (Intro)" aria-label="Enviar">${IC.send}${IC.stop}</button>
        </div>
      </div>`;
    const ta = c.querySelector("textarea"), tray = c.querySelector(".cv-tray"), file = c.querySelector("input[type=file]"), sendB = c.querySelector(".cv-send");
    const files = []; // rutas de imágenes ya guardadas
    const autosize = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 220) + "px"; };
    const refresh = () => {
      const busy = t.status === "busy";
      c.classList.toggle("busy", busy && !ta.value.trim() && !files.length);
      sendB.disabled = !t.readonly && !busy && !ta.value.trim() && !files.length;
      sendB.title = t.readonly ? "Volver a intentar abrirla aquí" : c.classList.contains("busy") ? "Parar (Esc)" : "Enviar (Intro)";
    };
    const addPath = p => {
      if (!p) return;
      files.push(p);
      const b = document.createElement("span"); b.className = "cv-att";
      b.innerHTML = `<img alt=""><button type="button" title="Quitar">${IC.x}</button>`;
      b.querySelector("img").src = fileUrl(p);
      b.querySelector("button").onclick = () => { files.splice(files.indexOf(p), 1); b.remove(); tray.hidden = !files.length; refresh(); };
      tray.append(b); tray.hidden = false; refresh();
    };
    const addBlob = async f => { try { const ext = (f.type.split("/")[1] || "png").replace("jpeg", "jpg"); addPath(await D.saveImage(new Uint8Array(await f.arrayBuffer()), ext)); } catch { /* no se pudo guardar */ } };
    file.onchange = () => { [...file.files].forEach(f => { const p = D.pathFor(f); p ? addPath(p) : addBlob(f); }); file.value = ""; ta.focus(); };
    ta.addEventListener("paste", e => {
      const imgs = [...(e.clipboardData && e.clipboardData.items || [])].filter(i => i.type.startsWith("image/"));
      if (!imgs.length) return;
      e.preventDefault(); imgs.forEach(i => addBlob(i.getAsFile()));
    });
    c.addEventListener("dragover", e => { e.preventDefault(); c.classList.add("drag"); });
    c.addEventListener("dragleave", () => c.classList.remove("drag"));
    c.addEventListener("drop", e => {
      e.preventDefault(); e.stopPropagation(); c.classList.remove("drag");
      [...e.dataTransfer.files].forEach(f => { const p = D.pathFor(f); if (p && /\.(png|jpe?g|gif|webp|bmp)$/i.test(p)) addPath(p); else if (p) { ta.value += (ta.value ? " " : "") + (/\s/.test(p) ? `"${p}"` : p); autosize(); refresh(); } });
      ta.focus();
    });
    ta.addEventListener("input", () => { autosize(); refresh(); });
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) {
        // Intro envía; Ctrl+Intro (o Mayús+Intro) hace un salto de línea
        if (e.shiftKey) return; // el salto lo pone el propio cuadro
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) { ta.setRangeText("\n", ta.selectionStart, ta.selectionEnd, "end"); autosize(); refresh(); }
        else c.requestSubmit();
      }
      else if (e.key === "Escape" && t.status === "busy") { e.preventDefault(); e.stopPropagation(); D.term.write(t.key, "\x1b"); }
    });
    c.addEventListener("submit", e => {
      e.preventDefault();
      if (c.classList.contains("busy")) { D.term.write(t.key, "\x1b"); return; }
      const text = [ta.value.trim(), ...files.map(p => /\s/.test(p) ? `"${p}"` : p)].filter(Boolean).join(" ");
      if (t.readonly) { restart(t); return; } // por si ya se cerró en la otra ventana
      if (!text || t.exited) { if (t.exited) restart(t); return; }
      D.term.write(t.key, "\x05\x15"); // lo que hubiera a medias en la línea de Claude, fuera
      setTimeout(() => D.term.write(t.key, "\x1b[200~" + text + "\x1b[201~"), 80);
      setTimeout(() => D.term.write(t.key, "\r"), 380);
      t.qSent = Date.now();
      // el mensaje sale ya en el chat; cuando Claude lo apunta en su registro se cambia por el de verdad
      const pend = document.createElement("section"); pend.className = "cv-user pending" + (t.status === "busy" ? " queued" : "");
      pend.dataset.text = ta.value.trim().slice(0, 60); pend.dataset.at = Date.now();
      pend.append(head("Tú", new Date().toISOString()));
      if (files.length) { const g = document.createElement("div"); g.className = "cv-imgs"; files.forEach(p => g.append(imgEl(fileUrl(p), ""))); pend.append(g); }
      if (ta.value.trim()) { const p = document.createElement("div"); p.className = "cv-utext"; p.textContent = ta.value.trim(); pend.append(p); }
      t.cv.list.append(pend); t.cv.empty.hidden = true;
      [600, 1100, 1800].forEach(ms => setTimeout(() => feedTick(t), ms));
      ta.value = ""; files.length = 0; tray.textContent = ""; tray.hidden = true; autosize(); refresh();
      t.cv.pinUntil = Date.now() + 4000; t.cv.feed.scrollTop = t.cv.feed.scrollHeight;
    });
    const ro = document.createElement("p"); ro.className = "cv-ro"; ro.hidden = true;
    ro.innerHTML = `<span><b>Solo lectura.</b> Esta sesión está abierta en otra ventana (por ejemplo, en Windows Terminal).</span><button type="button" class="cv-take">Traer aquí</button>`;
    c.prepend(ro);
    // dos pasos: el primero avisa de lo que va a pasar; el segundo cierra la otra y la abre aquí
    const take = ro.querySelector(".cv-take");
    let armed = 0;
    take.onclick = async () => {
      if (!armed) {
        armed = setTimeout(() => { armed = 0; take.textContent = "Traer aquí"; take.classList.remove("armed"); }, 5000);
        take.textContent = "Se cerrará en la otra ventana · pulsa otra vez"; take.classList.add("armed"); return;
      }
      clearTimeout(armed); armed = 0; take.disabled = true; take.textContent = "Trayéndola…";
      try { await D.takeover(t.sessionId); } catch { /* da igual: se intenta abrir igual */ }
      take.disabled = false; take.textContent = "Traer aquí"; take.classList.remove("armed");
      restart(t);
    };
    t.cv.setReadonly = v => {
      t.readonly = v; ro.hidden = !v; c.classList.toggle("ro", v);
      ta.placeholder = v ? "Solo lectura: esta sesión está abierta en otra ventana" : "Escribe a Claude…";
      refresh();
    };
    t.cv.input = ta; t.cv.refresh = refresh; t.cv.stateEl = c.querySelector(".cv-state");
    refresh();
    return c;
  }
  // «trabajando…» al final de la conversación mientras Claude responde
  function setStatus(t, status) {
    if (!t.cv) return;
    const was = t.status; t.status = status;
    const ask = status !== "busy" && status !== "idle";
    t.el.classList.toggle("ask", ask);
    t.el.classList.toggle("working", status === "busy");
    if (!ask) t.qTerm = false;
    checkQ(t);
    if (status === "busy" && was !== "busy") t.cv.since = Date.now();
    if (t.cv.refresh) t.cv.refresh();
    if (t === active && ask !== (was !== "busy" && was !== "idle" && was !== undefined)) requestAnimationFrame(() => focusT(t));
  }
  // si lo que pregunta Claude es una encuesta, se contesta en una tarjeta y la terminal no sale.
  // La pregunta no está en el registro hasta que se responde: se lee de su pantalla.
  // Filas: las opciones numeradas; la última antes de la raya es «Type something» (o lo ya escrito en ella);
  // en las de varias, debajo está «Submit». El cursor (❯) dice dónde está Claude.
  function parseQ(text) {
    const L = text.split("\n").map(l => l.replace(/\s+$/, ""));
    let end = -1; for (let i = L.length - 1; i >= 0; i--) if (/Enter to select|Submit answers/.test(L[i])) { end = i; break; }
    if (end < 0) return null;
    let tabs = -1; for (let i = end; i >= 0; i--) if (/[☐☒]\s|✔ Submit/.test(L[i])) { tabs = i; break; }
    const tabLine = tabs >= 0 ? L[tabs] : "";
    const steps = (tabLine.match(/[☐☒]/g) || []).length, doneSteps = (tabLine.match(/☒/g) || []).length;
    const from = tabs >= 0 ? tabs + 1 : Math.max(0, end - 25);
    const body = L.slice(from, end + 1);
    if (body.some(l => /Review your answers/.test(l))) {
      const sum = body.filter(l => /^\s*(●|→)/.test(l)).map(l => l.trim());
      return { review: true, sum, steps, doneSteps };
    }
    let title = "", rows = [], multi = false, submit = false, cursor = -1, closed = false;
    for (const l of body) {
      if (/Enter to select/.test(l)) break;
      if (/^\s*─{5,}/.test(l)) { if (rows.length) closed = true; continue; }
      if (closed) continue; // «Chat about this» y lo de debajo
      const m = /^\s*(❯)?\s*(\d+)\.\s+(?:\[([ ✔])\]\s+)?(.*)$/.exec(l);
      if (m) {
        if (m[3] !== undefined) multi = true;
        if (m[1]) cursor = rows.length;
        rows.push({ n: +m[2], label: m[4].trim(), on: m[3] === "✔", desc: "" });
        continue;
      }
      const sm = /^\s*(❯)?\s*Submit\s*$/.exec(l);
      if (sm) { submit = true; if (sm[1]) cursor = rows.length; continue; }
      if (!l.trim()) continue;
      if (!rows.length) title += (title ? " " : "") + l.trim();
      else if (/^\s{4,}/.test(l)) rows[rows.length - 1].desc += (rows[rows.length - 1].desc ? " " : "") + l.trim();
    }
    if (rows.length < 2) return null;
    const o = rows.pop(); // la última fila es la respuesta libre
    const typed = /^Type something\.?$/.test(o.label) ? "" : o.label;
    return { title, opts: rows, other: o.n, otherOn: o.on, typed, multi, submit, cursor, otherRow: rows.length, submitRow: rows.length + 1,
      steps, doneSteps, last: steps <= 1 || doneSteps >= steps - 1 };
  }
  // permisos («Allow this read…?», «Do you want to proceed?»): opciones numeradas y debajo «Esc to cancel».
  // Encima, el recuadro con lo que quiere hacer (herramienta, ruta, orden…), que se enseña tal cual.
  function parseP(text) {
    const L = text.split("\n").map(l => l.replace(/\s+$/, ""));
    let end = -1; for (let i = L.length - 1; i >= 0; i--) if (/Esc to cancel/.test(L[i])) { end = i; break; }
    if (end < 0 || L.slice(end + 1).some(l => /^\s*(❯\s*)?\d+\.\s/.test(l))) return null;
    const opts = []; let cursor = -1, i = end - 1;
    for (; i >= 0; i--) {
      const l = L[i];
      const m = /^\s*(❯)?\s*(\d+)\.\s+(.*)$/.exec(l);
      if (m) { opts.unshift({ n: +m[2], label: m[3].trim(), desc: "", cur: !!m[1] }); continue; }
      if (!l.trim() || (opts.length && /^\s{4,}/.test(l))) { if (opts.length && l.trim()) opts[0].desc += (opts[0].desc ? " " : "") + l.trim(); continue; }
      break;
    }
    if (opts.length < 2 || opts[0].n !== 1) return null;
    opts.forEach((o, k) => { if (o.cur) cursor = k; delete o.cur; });
    let title = "", qi = -1;
    for (let k = i; k >= Math.max(0, i - 3); k--) if (/\?\s*$/.test(L[k])) { title = L[k].trim(); qi = k; break; }
    let top = qi >= 0 ? qi - 1 : i; const ctx = [];
    for (let k = top; k >= 0 && ctx.length < 14; k--) { if (/^\s*[─━╌]{5,}/.test(L[k])) break; ctx.unshift(L[k].replace(/^\s*[│┃]\s?|\s?[│┃]\s*$/g, "")); }
    while (ctx.length && !ctx[0].trim()) ctx.shift();
    while (ctx.length && !ctx[ctx.length - 1].trim()) ctx.pop();
    return { perm: true, title: title || "Claude pide permiso", ctx: ctx.join("\n"), opts, cursor };
  }
  const DRAFT = "cumulo-encuesta-borrador";
  const draftGet = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || "{}"); } catch { return {}; } };
  const draftSet = (title, v) => { try { const d = draftGet(); if (v) d[title] = v; else delete d[title]; localStorage.setItem(DRAFT, JSON.stringify(d)); } catch { /* sin almacenamiento */ } };
  // lleva el cursor de Claude a una fila (flechas), mirando la pantalla para no pasarse
  async function moveTo(t, row) {
    for (let k = 0; k < 12; k++) {
      const q = parseQ(screenText(t, 45)); if (!q || q.review) return q;
      if (q.cursor === row) return q;
      D.term.write(t.key, q.cursor < row ? "\x1b[B" : "\x1b[A");
      await sleep(140);
    }
    return parseQ(screenText(t, 45));
  }
  const q0 = t => t.cv && t.cv.q;
  function liveQCard(t) {
    if (t.cv.qcard) return t.cv.qcard;
    const c = document.createElement("div"); c.className = "cv-q cv-qlive";
    const K = d => D.term.write(t.key, d);
    const run = async f => {
      if (c.classList.contains("sending")) return;
      c.classList.add("sending"); t.qSent = Date.now();
      try { await f(); } catch { /* se vuelve a leer la pantalla */ }
      await sleep(350); c.classList.remove("sending"); checkQ(t);
    };
    c.addEventListener("click", e => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      const k = b.dataset.k, q = t.cv.q; if (!q) return;
      if (k === "term") { t.qTerm = true; t.el.classList.remove("qmode"); focusT(t); return; }
      const sel = () => (t.cv.qsel = t.cv.qsel && t.cv.qsel.title === q.title ? t.cv.qsel : { title: q.title, on: new Set(q.opts.filter(o => o.on).map(o => o.n)) });
      const text = () => { const i = c.querySelector(".cv-qo-other textarea"); return i ? i.value.replace(/\s*\n\s*/g, " ").trim() : ""; };
      if (q.multi && /^\d+$/.test(k)) { // solo se marca aquí; se manda todo junto al pulsar el botón
        const S = sel().on, n = +k; S.has(n) ? S.delete(n) : S.add(n); b.classList.toggle("on", S.has(n)); return;
      }
      if (k === "other" || k === "next") {
        const v = text();
        if (!q.multi) { if (!v) return; run(async () => { K(String(q.other)); await sleep(300); K(v); await sleep(300); K("\r"); draftSet(q.title, ""); t.qAuto = Date.now(); }); return; }
        const S = sel().on;
        run(async () => {
          let f = parseQ(screenText(t, 45)); if (!f || f.review) return;
          if (f.cursor === f.otherRow) f = await moveTo(t, 0) || f; // con el cursor en el texto, los números se escribirían dentro
          for (const o of f.opts) if (o.on !== S.has(o.n)) { K(String(o.n)); await sleep(120); }
          if (v && v !== f.typed) {
            if (!f.otherOn) { K(String(f.other)); await sleep(200); }
            await moveTo(t, f.otherRow);
            if (f.typed) { K("\x7f".repeat(f.typed.length + 2)); await sleep(120); }
            K(v); await sleep(250);
          } else if (!v && f.otherOn) { K(String(f.other)); await sleep(150); }
          await moveTo(t, f.submitRow); await sleep(120); K("\r");
          draftSet(q.title, ""); t.cv.qsel = null; t.qAuto = Date.now();
        });
        return;
      }
      run(async () => { K(k); await sleep(200); t.qAuto = Date.now(); });
    });
    c.addEventListener("input", e => { if (e.target.matches(".cv-qo-other textarea") && t.cv.q) draftSet(t.cv.q.title, e.target.value); });
    c.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches(".cv-qo-other textarea")) { e.preventDefault(); c.querySelector(q0(t) && t.cv.q.multi ? '[data-k="next"]' : '[data-k="other"]').click(); } });
    t.cv.qcard = c; return c;
  }
  function paintQ(t, q) {
    const c = liveQCard(t), sig = JSON.stringify(q);
    c.classList.toggle("perm", !!q.perm);
    if (c.dataset.sig === sig) return; c.dataset.sig = sig;
    const esc2 = s => esc(String(s || ""));
    if (q.perm) {
      c.innerHTML = `<div class="cv-qi cv-qperm"><p class="cv-qh"><span class="cv-qtag">Claude pide permiso</span><b>${esc2(q.title)}</b></p>
        ${q.ctx ? `<pre class="cv-qctx">${esc2(q.ctx)}</pre>` : ""}
        <div class="cv-qopts">${q.opts.map(o => `<button type="button" class="cv-qo" data-k="${o.n}"><span class="cv-qmark"></span><span class="cv-qt"><b>${esc2(o.label)}</b>${o.desc ? `<small>${esc2(o.desc)}</small>` : ""}</span></button>`).join("")}</div></div>
        <div class="cv-qbar"><button type="button" class="cv-qterm" data-k="term">Ver en la terminal</button><span class="cv-qfoot">Pulsa una opción</span></div>`;
      return;
    }
    const step = q.steps > 1 ? `<span class="cv-qstep">Pregunta ${Math.min(q.doneSteps + 1, q.steps)} de ${q.steps}</span>` : "";
    if (q.review) {
      c.innerHTML = `<div class="cv-qi"><p class="cv-qh"><span class="cv-qtag">Revisa tus respuestas</span></p>
        <div class="cv-qsum">${q.sum.map(l => `<p class="${/^→/.test(l) ? "a" : "q"}">${esc2(l.replace(/^[●→]\s*/, ""))}</p>`).join("")}</div></div>
        <div class="cv-qbar"><button type="button" class="cv-qterm" data-k="term">Ver en la terminal</button><span class="cv-qfoot"></span><button type="button" class="cv-qback" data-k="2">Cancelar</button><button type="button" class="cv-qsend" data-k="1">Enviar respuestas</button></div>`;
      return;
    }
    const L = t.cv.qsel && t.cv.qsel.title === q.title ? t.cv.qsel.on : null;
    const isOn = o => L ? L.has(o.n) : o.on;
    const keep = c.querySelector(".cv-qo-other textarea");
    const typed = (keep && keep.value) || draftGet()[q.title] || q.typed || "";
    c.innerHTML = `<div class="cv-qi${q.multi ? " multi" : ""}"><p class="cv-qh"><span class="cv-qtag">Claude te pregunta</span>${step}<b>${esc2(q.title)}</b><small class="cv-qkind">${q.multi ? "Puedes elegir varias" : "Pulsa una opción"}</small></p>
      <div class="cv-qopts">${q.opts.map(o => `<button type="button" class="cv-qo${isOn(o) ? " on" : ""}" data-k="${o.n}"><span class="cv-qmark"></span><span class="cv-qt"><b>${esc2(o.label)}</b>${o.desc ? `<small>${esc2(o.desc)}</small>` : ""}</span></button>`).join("")}
      <label class="cv-qo cv-qo-other"><span class="cv-qmark"></span><textarea rows="1" placeholder="Otra respuesta…" spellcheck="false"></textarea>${q.multi ? "" : `<button type="button" class="cv-qok" data-k="other">Enviar</button>`}</label></div></div>
      <div class="cv-qbar"><button type="button" class="cv-qterm" data-k="term">Ver en la terminal</button><span class="cv-qfoot">${q.multi ? "Intro también envía" : "Pulsa una opción y listo"}</span>${q.multi ? `<button type="button" class="cv-qsend" data-k="next">${q.last ? "Enviar" : "Siguiente"}</button>` : ""}</div>`;
    const inp = c.querySelector(".cv-qo-other textarea");
    inp.value = typed;
    const fit = () => { inp.style.height = "auto"; inp.style.height = Math.min(inp.scrollHeight, 160) + "px"; };
    inp.addEventListener("input", fit); fit();
  }
  // la terminal de Claude solo sale si de verdad pide algo que no es encuesta: mientras redibuja entre
  // pregunta y pregunta (o al contestar) la pantalla no se entiende un momento y no debe asomar
  function askShow(t) {
    const want = t.el.classList.contains("ask") && !t.el.classList.contains("qmode");
    if (!want) { clearTimeout(t.askT); t.askT = 0; t.el.classList.remove("askshow"); return; }
    if (t.qTerm) { t.el.classList.add("askshow"); return; }
    if (t.el.classList.contains("askshow") || t.askT) return;
    // justo después de contestar, Claude tarda unos segundos en marcar que ya sigue: ahí no se enseña nada
    const wait = Math.max(1300, (t.qSent || 0) + 6000 - Date.now());
    t.askT = setTimeout(() => { t.askT = 0; if (Date.now() - (t.qSent || 0) < 6000) { askShow(t); return; } checkQ(t); if (t.el.classList.contains("ask") && !t.el.classList.contains("qmode")) t.el.classList.add("askshow"); }, wait);
  }
  function checkQ(t) { checkQ0(t); if (t.el) askShow(t); }
  function checkQ0(t) {
    if (!t.cv) return;
    const asking = t.status && t.status !== "busy" && t.status !== "idle";
    const scr = asking && !t.qTerm && !t.readonly ? screenText(t, 45) : "";
    const q = scr ? parseQ(scr) || parseP(scr) : null;
    t.el.classList.toggle("qmode", !!q);
    t.cv.q = q;
    if (!q) {
      const c = t.cv.qcard; if (!c) return;
      // recién contestada, la tarjeta se queda quieta hasta que llega la de verdad al registro (o la siguiente pregunta)
      if (c.parentNode && !t.qTerm && !c.classList.contains("perm") && Date.now() - (t.qSent || 0) < 10000) { c.classList.add("sent"); return; }
      c.remove(); c.dataset.sig = ""; c.classList.remove("sent"); return;
    }
    if (t.cv.qcard) t.cv.qcard.classList.remove("sent");
    if (t.cv.qcard && t.cv.qcard.contains(document.activeElement) && document.activeElement.matches("textarea") && t.cv.qcard.dataset.title === (q.title || "")) return; // escribiendo: no se repinta
    if (q.review && Date.now() - (t.qAuto || 0) < 15000) { if (!t.qRevSent) { t.qRevSent = true; D.term.write(t.key, "1"); t.qSent = Date.now(); setTimeout(() => { t.qRevSent = false; }, 2500); } return; }
    paintQ(t, q);
    t.cv.qcard.dataset.title = q.title || "";
    const f = t.cv.feed, col = f.querySelector(".cv-col");
    if (t.cv.qcard.parentNode !== col) { col.insertBefore(t.cv.qcard, t.cv.work); f.scrollTop = f.scrollHeight; }
  }
  setInterval(() => { terms.forEach(t => { if (t.status && t.status !== "busy" && t.status !== "idle") checkQ(t); }); }, 700);
  setInterval(() => {
    const t = active; if (!t || !t.cv || t.status !== "busy") return;
    const s = Math.round((Date.now() - (t.cv.since || Date.now())) / 1000);
    t.cv.work.querySelector("small").textContent = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
  }, 1000);
  // en la caja de escribir, el modelo y el esfuerzo con los que va a responder
  setInterval(() => {
    const t = active; if (!t || !t.cv || !t.cv.stateEl) return;
    const s = t.seen || {}, m = MODELS.find(x => x.id === s.model), e = EFFORTS.find(x => x[0] === s.effort);
    const txt = [m && m.label, e && "esfuerzo " + e[1].toLowerCase()].filter(Boolean).join(" · ");
    if (t.cv.stateEl.textContent !== txt) t.cv.stateEl.textContent = txt;
  }, 1000);

  // arrastrar archivos al terminal escribe sus rutas (Claude las entiende como adjuntos)
  host.addEventListener("dragover", e => { e.preventDefault(); });
  host.addEventListener("drop", e => {
    e.preventDefault(); if (!active) return;
    const paths = [...e.dataTransfer.files].map(f => D.pathFor(f)).filter(Boolean);
    // en la vista de conversación, lo soltado va a la caja de escribir
    if (paths.length && active.cv && !rawTerm && !active.el.classList.contains("ask")) {
      const dt = new DataTransfer(); [...e.dataTransfer.files].forEach(f => dt.items.add(f));
      active.el.querySelector(".cv-composer").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      return;
    }
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
      // Claude te pregunta algo (permiso, elegir una opción): la parte viva crece para que se vea entera
      setStatus(t, L.status);
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
      feedTick(t);
      requestAnimationFrame(() => { if (active === t) { fitNow(t); focusT(t); } });
      return t;
    },
    hide() { showSeq++; if (active) active.xt.blur(); active = null; },
    focus() { focusT(active); },
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
    // lo que se ve ahora en la terminal de Claude (las últimas filas), para leer su estado
    screen(key, n = 40) { const t = key ? terms.get(key) : active; return t ? screenText(t, n) : ""; },
    keys(key, d) { const t = key ? terms.get(key) : active; if (t) D.term.write(t.key, d); },
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
