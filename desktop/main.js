// Cúmulo — app de escritorio. Abre la web del lanzador (../index.html) con acceso al ordenador:
// sesiones reales, terminales con Claude de verdad, monitor del sistema, límites de uso y lanzador de apps.
"use strict";
const { app, BrowserWindow, ipcMain, shell, globalShortcut, Tray, Menu, nativeImage, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const pty = require("@lydell/node-pty");
const si = require("systeminformation");
const sesiones = require("./sesiones");
const ventanas = require("./ventanas");
const contadores = require("./contadores");
const teclawin = require("./teclawin");

// --shell: Cúmulo hace de escritorio de Windows (lo arranca Windows en lugar del explorador)
const SHELL = process.argv.includes("--shell");
const LOG = [];
const log = m => { LOG.push(new Date().toISOString().slice(11, 19) + " " + m); if (LOG.length > 300) LOG.shift(); };
// un fallo inesperado no debe tumbar Cúmulo (y menos siendo el escritorio): se apunta en un registro y sigue
const logError = (what, e) => {
  log(what + ": " + (e && e.stack || e));
  try { fs.appendFileSync(path.join(app.getPath("userData"), "errores.log"), new Date().toISOString() + " " + what + ": " + (e && e.stack || e) + "\n"); } catch { /* sin disco */ }
};
process.on("uncaughtException", e => logError("excepción", e));
process.on("unhandledRejection", e => logError("promesa", e));

const WEB = app.isPackaged ? path.join(__dirname, "web") : path.join(__dirname, "..");
const XTERM = path.relative(WEB, path.join(__dirname, "node_modules", "@xterm")).split(path.sep).join("/");
ipcMain.on("app:paths", e => { e.returnValue = { xterm: XTERM }; });
// imagen del portapapeles (la lee la ventana) → archivo temporal, para pasarle la ruta a Claude
ipcMain.handle("clip:save", (_e, bytes, ext) => {
  const dir = path.join(os.tmpdir(), "cumulo-imagenes");
  fs.mkdirSync(dir, { recursive: true });
  // las de hace más de un día ya se adjuntaron: fuera, para no llenar la carpeta temporal
  try { for (const n of fs.readdirSync(dir)) { const f = path.join(dir, n); if (Date.now() - fs.statSync(f).mtimeMs > 86400000) fs.unlinkSync(f); } } catch { /* en uso */ }
  const f = path.join(dir, "imagen-" + Date.now() + "." + (/^(png|jpe?g|gif|webp|bmp)$/.test(ext) ? ext : "png"));
  fs.writeFileSync(f, Buffer.from(bytes));
  return f;
});
const CLAUDE_DIR = path.join(os.homedir(), ".claude");

// la conversación de una sesión para la vista propia (mensajes, respuestas, herramientas e imágenes)
const conversacion = require("./conversacion");
ipcMain.handle("sess:feed", (_e, id, from) => conversacion.feed(sesiones.ROOT, id, from));
const ESTADO = path.join(CLAUDE_DIR, "cumulo-estado.json");
const CFG_FILE = () => path.join(app.getPath("userData"), "ajustes.json");

// copia de pruebas: otra carpeta de datos para poder abrirla junto a la instalada
if (process.env.CUMULO_DEV) app.setPath("userData", app.getPath("userData") + "-dev");
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null, tray = null, bar = null;
let cfg = { autostart: false, shortcut: "Alt+Space" };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CFG_FILE(), "utf8")) }; } catch { /* primera vez */ }
const saveCfg = () => { try { fs.writeFileSync(CFG_FILE(), JSON.stringify(cfg, null, 2)); } catch { /* sin permiso */ } };

// ── claude ─────────────────────────────────────────────────────
function findClaude() {
  const cands = [path.join(os.homedir(), ".local", "bin", "claude.exe")];
  for (const d of (process.env.PATH || "").split(path.delimiter)) cands.push(path.join(d, "claude.exe"), path.join(d, "claude.cmd"));
  return cands.find(f => { try { return fs.statSync(f).isFile(); } catch { return false; } }) || "claude";
}
const CLAUDE = findClaude();

// ── terminales ─────────────────────────────────────────────────
// entorno limpio: si Cúmulo se abrió desde otra sesión de Claude, sus marcas no deben heredarse
function cleanEnv() {
  const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "3", CUMULO_TERM: "1" };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_AGENT|CLAUDE_PLUGIN_ROOT|ELECTRON_RUN_AS_NODE)/.test(k)) delete env[k];
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  return env;
}
const terms = new Map(); // key → { p, key, sessionId }
function send(ch, ...a) { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); }
function sendBar(ch, ...a) { if (bar && !bar.isDestroyed() && bar.isVisible()) bar.webContents.send(ch, ...a); }

ipcMain.handle("term:open", async (_e, { key, sessionId, cwd, cols, rows, shellOnly }) => {
  const t = terms.get(key);
  if (t) { try { t.p.resize(cols, rows); } catch { /* ya cerrado */ } return { pid: t.p.pid, reused: true, buffer: t.buf.join("") }; }
  // una sesión que ya está abierta en otro sitio (otra ventana, otro terminal) no se abre dos veces:
  // serían dos Claude escribiendo en la misma conversación
  if (sessionId && !shellOnly) {
    const mine = new Set([...terms.values()].map(r => r.p.pid));
    if (readLive().some(l => l.sessionId === sessionId && !mine.has(l.pid))) return { pid: 0, elsewhere: true, buffer: "" };
  }
  const dir = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  const file = shellOnly ? "powershell.exe" : CLAUDE;
  const args = shellOnly ? ["-NoLogo"] : sessionId ? ["--resume", sessionId] : [];
  const p = pty.spawn(file, args, {
    name: "xterm-256color", cols: cols || 100, rows: rows || 30, cwd: dir,
    env: cleanEnv(),
    useConpty: true,
  });
  const rec = { p, key, sessionId: sessionId || null, buf: [], size: 0 };
  terms.set(key, rec);
  p.onData(d => {
    // se guarda lo último para poder volver a pintar el terminal si la ventana se recarga
    rec.buf.push(d); rec.size += d.length;
    while (rec.size > 400000 && rec.buf.length > 1) rec.size -= rec.buf.shift().length;
    send("term:data", key, d);
  });
  // si ya se cerró a mano (o se abrió otra con la misma clave), este aviso llega tarde y no debe tocar la nueva
  p.onExit(({ exitCode }) => { if (terms.get(key) !== rec) return; terms.delete(key); send("term:exit", key, exitCode); });
  // con ConPTY el pid llega un instante después de crear el terminal: sin él no se sabría el estado de la sesión
  for (let i = 0; i < 60 && !p.pid; i++) await new Promise(r => setTimeout(r, 50));
  return { pid: p.pid, reused: false, buffer: "" };
});
ipcMain.on("term:write", (_e, key, d) => { const t = terms.get(key); if (t) { try { t.p.write(d); } catch { /* cerrándose */ } } });
ipcMain.on("term:resize", (_e, key, c, r) => { const t = terms.get(key); if (t && c > 0 && r > 0) { try { t.p.resize(c, r); } catch { /* cerrado */ } } });
ipcMain.on("term:kill", (_e, key) => { const t = terms.get(key); if (t) { try { t.p.kill(); } catch { /* ya cerrado */ } terms.delete(key); } });

// ── datos de sesiones ──────────────────────────────────────────
ipcMain.on("data:sync", e => { e.returnValue = sesiones.readAll(); });
ipcMain.handle("data:read", () => sesiones.readAll());

// estado de las sesiones abiertas (Claude escribe ~/.claude/sessions/<pid>.json) y lo que guarda la barra de estado
let lastEstado = {};
function readLive() {
  const out = [];
  const dir = path.join(CLAUDE_DIR, "sessions");
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        // un Claude cerrado a la fuerza deja su archivo; Windows reutiliza los pid: sin esto se confundirían sesiones
        try { process.kill(j.pid, 0); } catch { continue; }
        out.push({ pid: j.pid, sessionId: j.sessionId, status: j.status, cwd: j.cwd, updatedAt: j.updatedAt });
      } catch { /* escribiéndose */ }
    }
  } catch { /* no existe todavía */ }
  // la barra de estado puede estar escribiendo el archivo justo ahora: entonces vale lo último bueno
  let estado = lastEstado;
  try { estado = lastEstado = JSON.parse(fs.readFileSync(ESTADO, "utf8")) || {}; } catch { /* aún sin datos o a medias */ }
  return { live: out, limits: estado.limits || null, context: estado.context || {} };
}
ipcMain.on("live:sync", e => { e.returnValue = readLive(); });
setInterval(() => {
  const toWin = win && win.isVisible() && !win.isMinimized(), toBar = bar && bar.isVisible();
  if (!toWin && !toBar) return;
  const v = readLive(); if (toWin) send("live", v); if (toBar) sendBar("live", v);
}, 2500);

// ── monitor del sistema ────────────────────────────────────────
// Ligero a propósito: CPU y RAM salen de Node (sin procesos); la gráfica, la red y Claude se leen
// cada pocos segundos y SOLO mientras el monitor está a la vista (sesión abierta y ventana delante).
let sys = null, sysStatic = null, claudeProc = { processes: 0, memory: 0 };
let monitorOn = false, gpu = null, net = { down: 0, up: 0 }, netPrev = null;
const pending = new Set();
const once = (k, fn) => { if (pending.has(k)) return; pending.add(k); Promise.resolve().then(fn).catch(() => {}).finally(() => pending.delete(k)); };
const run = (file, args, ms = 4000) => new Promise((ok, ko) => execFile(file, args, { windowsHide: true, timeout: ms }, (e, out) => e ? ko(e) : ok(out)));

async function sysInit() {
  const cpus = os.cpus();
  let disk = { used: 0, size: 1 };
  try { const fsz = await si.fsSize(); disk = fsz.find(d => /^c:/i.test(d.mount)) || fsz[0] || disk; } catch { /* sin datos */ }
  let hasNv = false; try { await run("nvidia-smi", ["-L"], 3000); hasNv = true; } catch { /* sin NVIDIA */ }
  sysStatic = { cores: cpus.length, ghz: (cpus[0] && cpus[0].speed / 1000) || 0, disk, hasNv };
}
let cpuPrev = null;
function cpuUsage() {
  const now = os.cpus().reduce((a, c) => { const t = c.times; a.idle += t.idle; a.total += t.user + t.nice + t.sys + t.idle + t.irq; return a; }, { idle: 0, total: 0 });
  const prev = cpuPrev; cpuPrev = now;
  if (!prev || now.total === prev.total) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - (now.idle - prev.idle) / (now.total - prev.total))));
}
function gpuTick() {
  if (!sysStatic || !sysStatic.hasNv) return;
  once("gpu", async () => {
    const out = await run("nvidia-smi", ["--query-gpu=memory.used,memory.total,utilization.gpu,temperature.gpu", "--format=csv,noheader,nounits"]);
    const [used, total, util, temp] = out.split(/\r?\n/)[0].split(",").map(x => parseFloat(x));
    gpu = { used: used / 1024, total: total / 1024, gpuUsage: util || 0, temp: temp || 0 };
  });
}
function netTick() {
  once("net", async () => {
    const out = await run("netstat", ["-e"]);
    const m = /(?:Bytes|Bytes recibidos)\s+(\d+)\s+(\d+)/i.exec(out) || /\n\S[^\n]*?\s(\d{4,})\s+(\d{4,})/.exec(out);
    if (!m) return;
    const cur = { t: Date.now(), rx: +m[1], tx: +m[2] };
    if (netPrev) { const dt = (cur.t - netPrev.t) / 1000; net = { down: Math.max(0, (cur.rx - netPrev.rx) / dt / 1e6), up: Math.max(0, (cur.tx - netPrev.tx) / dt / 1e6) }; }
    netPrev = cur;
  });
}
function diskTick() {
  once("disk", async () => { const fsz = await si.fsSize(); const d = fsz.find(x => /^c:/i.test(x.mount)) || fsz[0]; if (d) sysStatic.disk = d; });
}
function sysTick() {
  if (!sysStatic) return;
  const total = os.totalmem(), free = os.freemem();
  const g = gpu || { used: 0, total: 1, gpuUsage: 0, temp: 0 };
  const c = contadores.read(); // los del Administrador de tareas (si ya han llegado)
  const cpu = cpuUsage();
  sys = {
    cpu: { usage: c ? Math.min(100, c.cpu) : cpu, cores: sysStatic.cores, ghz: sysStatic.ghz, temp: 0 },
    ram: { used: (total - free) / 1e9, total: total / 1e9 },
    vram: c ? { used: c.vram / 1073741824, total: g.total || 1, gpuUsage: Math.min(100, c.gpu), temp: g.temp } : g,
    disk: { used: sysStatic.disk.used / 1e9, total: sysStatic.disk.size / 1e9, read: c ? c.rd / 1e6 : 0, write: c ? c.wr / 1e6 : 0 },
    net: c ? { down: c.down / 1e6, up: c.up / 1e6 } : net,
    claude: claudeProc,
  };
  send("sys", sys);
}
// procesos de Claude
function claudeTick() {
  once("claude", async () => {
    const out = await run("tasklist", ["/fi", "imagename eq claude.exe", "/fo", "csv", "/nh"]);
    const rows = out.split(/\r?\n/).filter(l => l.startsWith('"claude.exe"'));
    const kb = rows.reduce((a, l) => a + (parseInt(l.split('","')[4].replace(/\D/g, ""), 10) || 0), 0);
    claudeProc = { processes: rows.length, memory: kb / 1e6 };
  });
}
ipcMain.on("monitor:active", (_e, v) => { monitorOn = !!v; contadores.setActive(monitorOn, app.getPath("userData")); });
let tickN = 0;
function monitorLoop() {
  tickN++;
  if (!monitorOn || !win || !win.isVisible() || win.isMinimized()) return; // nadie lo mira: no se gasta nada
  sysTick();
  if (tickN % 15 === 0) gpuTick(); // solo para la memoria total y la temperatura de la NVIDIA
  if (tickN % 3 === 0 && !contadores.read()) { netTick(); contadores.setActive(true, app.getPath("userData")); } // si el lector se cayó, vuelve (como mucho uno cada 15 s)
  if (tickN % 6 === 0) claudeTick();
  if (tickN % 120 === 0) diskTick();
}
ipcMain.on("sys:sync", e => { e.returnValue = sys; });

// ── ordenador: abrir cosas, apps instaladas, ajustes ───────────
ipcMain.handle("os:open", (_e, target) => /^https?:\/\//.test(target) ? shell.openExternal(target) : shell.openPath(target));
ipcMain.handle("os:reveal", (_e, target) => shell.showItemInFolder(target));
ipcMain.handle("os:home", () => os.homedir());

// accesos directos del menú Inicio (del usuario y de todos) → lista de apps
let appsCache = null;
function listApps() {
  if (appsCache) return appsCache;
  const roots = [
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
  ];
  const seen = new Set(), apps = [];
  const walk = (d, depth) => {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const f = path.join(d, e.name);
      if (e.isDirectory() && depth < 3) walk(f, depth + 1);
      else if (/\.(lnk|url)$/i.test(e.name)) {
        const name = e.name.replace(/\.(lnk|url)$/i, "");
        if (/uninstall|desinstalar|readme|léame|help|ayuda|website|sitio web/i.test(name)) continue;
        const k = name.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
        apps.push({ name, path: f, group: path.basename(d) === "Programs" ? "" : path.basename(d) });
      }
    }
  };
  roots.forEach(r => walk(r, 0));
  apps.sort((a, b) => a.name.localeCompare(b.name, "es"));
  appsCache = apps;
  return apps;
}
ipcMain.handle("os:apps", () => listApps());
const appIcons = new Map();
ipcMain.handle("os:icon", async (_e, file) => {
  if (appIcons.has(file)) return appIcons.get(file);
  let url = null;
  try {
    let target = file;
    if (/\.lnk$/i.test(file)) { try { const l = shell.readShortcutLink(file); if (l.icon) target = l.icon; else if (l.target) target = l.target; } catch { /* acceso directo raro */ } }
    url = (await app.getFileIcon(target, { size: "normal" })).toDataURL();
  } catch { /* sin icono */ }
  appIcons.set(file, url);
  return url;
});

// buscar archivos y carpetas en los sitios habituales (rápido, sin indexar todo el disco)
ipcMain.handle("os:find", (_e, q) => {
  q = String(q || "").toLowerCase().trim(); if (q.length < 2) return [];
  const H = os.homedir();
  const roots = ["Proyectos", "Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music"].map(d => path.join(H, d));
  const out = [];
  const walk = (d, depth) => {
    if (out.length >= 30) return;
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= 30) return;
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const f = path.join(d, e.name);
      if (e.name.toLowerCase().includes(q)) out.push({ name: e.name, path: f, dir: e.isDirectory() });
      if (e.isDirectory() && depth < 3) walk(f, depth + 1);
    }
  };
  roots.forEach(r => walk(r, 0));
  return out;
});

// acciones del sistema
ipcMain.handle("os:power", (_e, what) => {
  const run = (cmd, args) => execFile(cmd, args, { windowsHide: true });
  if (what === "lock") run("rundll32.exe", ["user32.dll,LockWorkStation"]);
  else if (what === "sleep") run("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"]);
  else if (what === "restart") run("shutdown", ["/r", "/t", "0"]);
  else if (what === "shutdown") run("shutdown", ["/s", "/t", "0"]);
  else if (what === "settings") shell.openExternal("ms-settings:");
  else if (what === "explorer") shell.openPath(os.homedir());
  else if (what === "taskmgr") run("taskmgr.exe", []);
  else if (what === "logoff") run("shutdown", ["/l"]);
});

// ventanas de otras apps: la barra de tareas de Cúmulo
const UD = () => app.getPath("userData");
ipcMain.handle("win:list", () => ventanas.list(UD(), process.pid).catch(() => []));
ipcMain.handle("win:focus", (_e, h) => ventanas.focus(h, UD()));
ipcMain.handle("win:min", (_e, h) => ventanas.minimize(h, UD()));
ipcMain.handle("win:close", (_e, h) => ventanas.close(h, UD()));

// Cúmulo como escritorio de Windows
ipcMain.handle("shell:get", async () => {
  const v = await ventanas.shellGet();
  return { running: SHELL, enabled: !!(v && /c[uú]mulo/i.test(v)), packaged: app.isPackaged };
});
ipcMain.handle("shell:set", async (_e, on) => {
  if (on && !app.isPackaged) return { ok: false, why: "Solo desde la app instalada" };
  const ok = await ventanas.shellSet(on ? process.execPath : null, app.getPath("userData"));
  // al volver a Windows normal estando de escritorio, el explorador entra ya como escritorio y barra de tareas
  if (!on && SHELL) { teclawin.stop(); execFile("explorer.exe", [], { windowsHide: false }); }
  return { ok };
});

// ajustes de la app: pantalla completa, arrancar con Windows y atajo global
ipcMain.handle("cfg:get", () => ({ ...cfg, autostart: app.getLoginItemSettings().openAtLogin }));
ipcMain.handle("cfg:set", (_e, patch) => {
  cfg = { ...cfg, ...patch };
  if ("autostart" in patch) app.setLoginItemSettings({ openAtLogin: !!patch.autostart, args: ["--inicio"] });
  if ("shortcut" in patch) registerShortcut();
  saveCfg();
  return cfg;
});
ipcMain.on("win:fullscreen", () => { if (win && !SHELL) win.setFullScreen(!win.isFullScreen()); }); // como escritorio, siempre completa
// Como escritorio, Cúmulo nunca se minimiza (detrás no hay nada y la pantalla se quedaba gris):
// «minimizar» y «cerrar» lo mandan detrás, trayendo delante la última app abierta; si no hay ninguna, se queda.
async function toBack() {
  if (!win) return;
  const list = await ventanas.list(app.getPath("userData"), process.pid).catch(() => []);
  const next = list.find(w => !w.min);
  if (next) ventanas.focus(next.h, app.getPath("userData"));
}
ipcMain.on("win:minimize", () => { if (!win) return; if (SHELL) toBack(); else win.minimize(); });
ipcMain.on("win:hide", () => { if (!win) return; if (SHELL) toBack(); else win.hide(); }); // fuera de escritorio: a la bandeja
ipcMain.on("app:shell", e => { e.returnValue = SHELL; });
ipcMain.on("win:sync", e => { e.returnValue = win ? win.isFullScreen() : true; });

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) { if (SHELL) toBack(); else win.hide(); return; } // como escritorio nunca se esconde
  bringFront(); send("palette");
}
function registerShortcut() {
  globalShortcut.unregisterAll();
  if (cfg.shortcut) { try { globalShortcut.register(cfg.shortcut, toggleWindow); } catch { /* atajo ocupado */ } }
}

// ── ventana ────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1600, width), height: Math.min(1000, height), minWidth: 720, minHeight: 480,
    backgroundColor: "#000000", show: false,
    frame: false, // la app dibuja sus propios botones de ventana
    icon: path.join(__dirname, "icono.png"),
    fullscreen: true, // siempre se abre a pantalla completa
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: false, spellcheck: false },
  });
  win.removeMenu();
  win.loadFile(path.join(WEB, "index.html"));
  win.once("ready-to-show", () => { win.setFullScreen(true); win.show(); });
  win.on("enter-full-screen", () => send("win:state", true));
  // como escritorio no hay nada detrás: si una app (un juego, un cambio de resolución…) lo saca de pantalla completa,
  // se quedaba una ventana pequeña con su barra en medio y la barra de abajo: dos barras. Vuelve enseguida.
  win.on("leave-full-screen", () => { send("win:state", false); if (SHELL) setTimeout(() => { if (win && !win.isDestroyed() && !win.isFullScreen()) win.setFullScreen(true); }, 150); });
  // enlaces externos al navegador, nunca dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on("before-input-event", (e, i) => {
    if (i.type === "keyDown" && i.key === "F11") { e.preventDefault(); if (!SHELL) win.setFullScreen(!win.isFullScreen()); }
    if (i.type === "keyDown" && i.key === "F12") win.webContents.toggleDevTools();
    if (i.type === "keyDown" && i.control && i.key.toLowerCase() === "r" && i.shift) win.webContents.reload();
  });
  // cerrar la ventana la esconde en la bandeja: las sesiones siguen vivas
  win.on("close", e => { if (!app.isQuitting) { e.preventDefault(); if (SHELL) toBack(); else win.hide(); } });
  // si algo lo minimiza igualmente (Win+M, otra app…), vuelve enseguida a su sitio, detrás
  win.on("minimize", () => { if (SHELL) setTimeout(() => { if (win && win.isMinimized()) { win.restore(); win.setFullScreen(true); } }, 60); });
  // si el proceso de la página se cae, se vuelve a cargar (como escritorio no puede quedarse en negro)
  win.webContents.on("render-process-gone", () => { setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 800); });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "icono.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip("Cúmulo");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Cúmulo", click: () => bringFront() },
    { type: "separator" },
    { label: "Salir (cierra las sesiones abiertas)", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => bringFront());
}

// si estaba abierto como app normal (p. ej. lo abrió el instalador) y el vigilante lo pide como escritorio,
// se reinicia en modo escritorio: si no, no habría tecla Windows, ni barra, ni programas de inicio
app.on("second-instance", (_e, argv) => {
  if (!SHELL && argv.includes("--shell")) { app.isQuitting = true; app.relaunch({ args: [...process.argv.slice(1).filter(a => a !== "--shell"), "--shell"] }); app.exit(0); return; }
  bringFront();
});
// ── barra de tareas siempre visible (solo como escritorio) ──────
// Las apps maximizadas (Chrome…) ocupaban toda la pantalla y tapaban la barra de Cúmulo. Se reserva una franja
// abajo (zona de trabajo de Windows) y ahí vive esta barra, encima de todo, mientras otra app está delante.
const BAR_H = 28;
function placeBar() {
  if (!bar) return;
  const d = screen.getPrimaryDisplay(), b = d.bounds;
  bar.setBounds({ x: b.x, y: b.y + b.height - BAR_H, width: b.width, height: BAR_H });
  const wa = screen.dipToScreenRect(null, { x: b.x, y: b.y, width: b.width, height: b.height - BAR_H });
  ventanas.workArea(wa.x, wa.y, wa.x + wa.width, wa.y + wa.height, app.getPath("userData")).catch(() => {});
}
function syncBar() {
  if (!bar || bar.isDestroyed()) return;
  const front = win && win.isVisible() && !win.isMinimized() && win.isFocused();
  if (front) bar.hide(); else if (!bar.isVisible()) { bar.showInactive(); bar.setAlwaysOnTop(true, "screen-saver"); }
}
function createBar() {
  bar = new BrowserWindow({
    frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, backgroundColor: "#0b0b0d",
    webPreferences: { preload: path.join(__dirname, "preload-barra.js"), contextIsolation: true, sandbox: false, spellcheck: false },
  });
  bar.setAlwaysOnTop(true, "screen-saver");
  bar.loadFile(path.join(WEB, "barra.html"));
  bar.once("ready-to-show", () => { placeBar(); syncBar(); });
  // cambio de resolución o de escala (algunos juegos y apps lo hacen): barra y Cúmulo vuelven a su sitio
  // (solo si cambia la pantalla de verdad: reservar la franja de la barra también avisa, y eso no debe repetirse)
  screen.on("display-metrics-changed", (_e, _d, changed) => {
    placeBar();
    if (!changed.some(c => c === "bounds" || c === "scaleFactor")) return;
    if (win && !win.isDestroyed()) { win.setFullScreen(false); win.setFullScreen(true); }
  });
  ["focus", "blur", "minimize", "restore", "hide", "show"].forEach(ev => win.on(ev, () => setTimeout(syncBar, 30)));
}
ipcMain.on("bar:cumulo", () => bringFront());

// traer Cúmulo delante aunque otra app tenga el foco (Windows no deja robarlo sin este truco)
function bringFront() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.setAlwaysOnTop(true); win.show(); win.setFullScreen(true); win.focus();
  setTimeout(() => { if (win && !win.isDestroyed()) win.setAlwaysOnTop(false); }, 400);
}
app.whenReady().then(async () => {
  if (SHELL && !process.env.CUMULO_DEV) ventanas.runStartup(log).catch(() => {});
  // tecla Windows: abre o cierra el lanzador (como el menú Inicio)
  if (SHELL && !process.env.CUMULO_DEV) teclawin.start(app.getPath("userData"), () => {
    if (!win) return;
    const front = win.isVisible() && !win.isMinimized() && win.isFocused();
    if (!front) { bringFront(); send("palette"); } else send("palette:toggle");
  });
  createWindow();
  if (SHELL) createBar();
  createTray();
  registerShortcut();
  await sysInit().catch(() => {});
  sysTick(); claudeTick(); gpuTick(); netTick();
  setInterval(monitorLoop, 1000);
});
app.on("will-quit", () => { teclawin.stop(); ventanas.stop(); contadores.stop(); globalShortcut.unregisterAll(); for (const t of terms.values()) { try { t.p.kill(); } catch { /* ya cerrado */ } } });
app.on("window-all-closed", () => { /* sigue en la bandeja */ });
