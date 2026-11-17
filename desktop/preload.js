// Puente entre la web del lanzador y el ordenador. La web funciona igual sin esto (modo simulación);
// con esto, los datos y los terminales son de verdad.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

const data = ipcRenderer.sendSync("data:sync");
let live = ipcRenderer.sendSync("live:sync");
let sys = ipcRenderer.sendSync("sys:sync");

// el contexto que guarda la barra de estado de Claude es más fresco que el del archivo de la sesión
const ctxFor = id => live.context && live.context[id] ? live.context[id].tokens : null;
data.sessions.forEach(s => { const c = ctxFor(s.id); if (c) s.context = c; });

const listeners = { data: new Map(), exit: new Map(), live: new Set(), palette: new Set() };
ipcRenderer.on("term:data", (_e, key, d) => { const f = listeners.data.get(key); if (f) f(d); });
ipcRenderer.on("term:exit", (_e, key, code) => { const f = listeners.exit.get(key); if (f) f(code); });
ipcRenderer.on("live", (_e, v) => { live = v; listeners.live.forEach(f => f(v)); });
ipcRenderer.on("sys", (_e, v) => { sys = v; });
ipcRenderer.on("palette", () => listeners.palette.forEach(f => f()));

contextBridge.exposeInMainWorld("CUMULO_DATA", data);

contextBridge.exposeInMainWorld("CUMULO_SYSTEM", {
  read: () => sys || {
    cpu: { usage: 0, cores: 0, ghz: 0, temp: 0 }, ram: { used: 0, total: 1 }, vram: { used: 0, total: 1, gpuUsage: 0, temp: 0 },
    disk: { used: 0, total: 1, read: 0, write: 0 }, net: { down: 0, up: 0 }, claude: { processes: 0, memory: 0 },
  },
});

// límites de uso reales (los guarda la barra de estado de Claude en ~/.claude/cumulo-estado.json)
const H = 3600e3;
const hist = { session: [], weekly: [] };
function limits() {
  const l = live.limits; if (!l) return null;
  const mk = (k, src, span) => {
    if (!src) return { used: 0, start: Date.now() - span / 2, end: Date.now() + span / 2, history: [] };
    const end = src.resets_at * 1000, start = end - span, used = Math.min(1, (src.used_percentage || 0) / 100);
    const h = hist[k];
    if (!h.length || h[0][0] !== start) { h.length = 0; h.push([start, 0]); }
    const now = Math.min(Date.now(), end);
    const last = h[h.length - 1];
    if (now - last[0] > span / 80) h.push([now, used]); else if (h.length > 1) { last[0] = now; last[1] = used; } else h.push([now, used]);
    return { used, start, end, history: h.map(p => [p[0], p[1]]) };
  };
  return { session: mk("session", l.five_hour, 5 * H), weekly: mk("weekly", l.seven_day, 7 * 24 * H) };
}
if (live.limits) contextBridge.exposeInMainWorld("CUMULO_LIMITS", { read: () => limits() });

contextBridge.exposeInMainWorld("cumuloDesktop", {
  xtermDir: ipcRenderer.sendSync("app:paths").xterm,
  term: {
    open: opts => ipcRenderer.invoke("term:open", opts),
    write: (key, d) => ipcRenderer.send("term:write", key, d),
    resize: (key, c, r) => ipcRenderer.send("term:resize", key, c, r),
    kill: key => ipcRenderer.send("term:kill", key),
    onData: (key, f) => { listeners.data.set(key, f); },
    onExit: (key, f) => { listeners.exit.set(key, f); },
    off: key => { listeners.data.delete(key); listeners.exit.delete(key); },
  },
  live: () => live,
  onLive: f => { listeners.live.add(f); },
  context: id => ctxFor(id),
  reloadData: () => ipcRenderer.invoke("data:read"),
  open: target => ipcRenderer.invoke("os:open", target),
  reveal: target => ipcRenderer.invoke("os:reveal", target),
  apps: () => ipcRenderer.invoke("os:apps"),
  icon: file => ipcRenderer.invoke("os:icon", file),
  find: q => ipcRenderer.invoke("os:find", q),
  power: what => ipcRenderer.invoke("os:power", what),
  getConfig: () => ipcRenderer.invoke("cfg:get"),
  setConfig: patch => ipcRenderer.invoke("cfg:set", patch),
  toggleFullscreen: () => ipcRenderer.send("win:fullscreen"),
  minimize: () => ipcRenderer.send("win:minimize"),
  hide: () => ipcRenderer.send("win:hide"),
  isFullscreen: () => ipcRenderer.sendSync("win:sync"),
  onWindowState: f => { ipcRenderer.on("win:state", (_e, v) => f(v)); },
  onPalette: f => { listeners.palette.add(f); },
  monitorActive: v => ipcRenderer.send("monitor:active", v),
  isShell: ipcRenderer.sendSync("app:shell"),
  windows: () => ipcRenderer.invoke("win:list"),
  winFocus: h => ipcRenderer.invoke("win:focus", h),
  winMin: h => ipcRenderer.invoke("win:min", h),
  winClose: h => ipcRenderer.invoke("win:close", h),
  shellGet: () => ipcRenderer.invoke("shell:get"),
  shellSet: on => ipcRenderer.invoke("shell:set", on),
  sep: path.sep,
});
