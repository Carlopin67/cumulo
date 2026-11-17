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

// --shell: Cúmulo hace de escritorio de Windows (lo arranca Windows en lugar del explorador)
const SHELL = process.argv.includes("--shell");
const LOG = [];
const log = m => { LOG.push(new Date().toISOString().slice(11, 19) + " " + m); if (LOG.length > 300) LOG.shift(); };

const WEB = app.isPackaged ? path.join(__dirname, "web") : path.join(__dirname, "..");
const XTERM = path.relative(WEB, path.join(__dirname, "node_modules", "@xterm")).split(path.sep).join("/");
ipcMain.on("app:paths", e => { e.returnValue = { xterm: XTERM }; });
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const ESTADO = path.join(CLAUDE_DIR, "cumulo-estado.json");
const CFG_FILE = () => path.join(app.getPath("userData"), "ajustes.json");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null, tray = null;
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
  const env = { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "3" };
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_AGENT|CLAUDE_PLUGIN_ROOT|ELECTRON_RUN_AS_NODE)/.test(k)) delete env[k];
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  return env;
}
const terms = new Map(); // key → { p, key, sessionId }
function send(ch, ...a) { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); }

ipcMain.handle("term:open", (_e, { key, sessionId, cwd, cols, rows, shellOnly }) => {
  const t = terms.get(key);
  if (t) { try { t.p.resize(cols, rows); } catch { /* ya cerrado */ } return { pid: t.p.pid, reused: true, buffer: t.buf.join("") }; }
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
  p.onExit(({ exitCode }) => { terms.delete(key); send("term:exit", key, exitCode); });
  return { pid: p.pid, reused: false, buffer: "" };
});
ipcMain.on("term:write", (_e, key, d) => { const t = terms.get(key); if (t) t.p.write(d); });
ipcMain.on("term:resize", (_e, key, c, r) => { const t = terms.get(key); if (t && c > 0 && r > 0) { try { t.p.resize(c, r); } catch { /* cerrado */ } } });
ipcMain.on("term:kill", (_e, key) => { const t = terms.get(key); if (t) { try { t.p.kill(); } catch { /* ya cerrado */ } terms.delete(key); } });

// ── datos de sesiones ──────────────────────────────────────────
ipcMain.on("data:sync", e => { e.returnValue = sesiones.readAll(); });
ipcMain.handle("data:read", () => sesiones.readAll());

// estado de las sesiones abiertas (Claude escribe ~/.claude/sessions/<pid>.json) y lo que guarda la barra de estado
function readLive() {
  const out = [];
  const dir = path.join(CLAUDE_DIR, "sessions");
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); out.push({ pid: j.pid, sessionId: j.sessionId, status: j.status, cwd: j.cwd, updatedAt: j.updatedAt }); } catch { /* escribiéndose */ }
    }
  } catch { /* no existe todavía */ }
  let estado = {};
  try { estado = JSON.parse(fs.readFileSync(ESTADO, "utf8")); } catch { /* aún sin datos */ }
  return { live: out, limits: estado.limits || null, context: estado.context || {} };
}
ipcMain.on("live:sync", e => { e.returnValue = readLive(); });
setInterval(() => send("live", readLive()), 1500);

// ── monitor del sistema ────────────────────────────────────────
let sys = null, sysStatic = null, claudeProc = { processes: 0, memory: 0 };
async function sysInit() {
  const [cpu, mem, gfx, fsz] = await Promise.all([si.cpu(), si.mem(), si.graphics().catch(() => ({ controllers: [] })), si.fsSize().catch(() => [])]);
  const g = (gfx.controllers || []).sort((a, b) => (b.vram || 0) - (a.vram || 0))[0] || {};
  const sysDisk = fsz.find(d => /^c:/i.test(d.mount)) || fsz[0] || { used: 0, size: 1 };
  sysStatic = { cores: cpu.cores, ghz: cpu.speed, ramTotal: mem.total / 1e9, vramTotal: (g.vram || 0) / 1024, disk: sysDisk };
}
async function sysTick() {
  if (!sysStatic) return;
  const [load, mem, temp, net, gfx] = await Promise.all([
    si.currentLoad(), si.mem(), si.cpuTemperature().catch(() => ({})), si.networkStats().catch(() => []),
    sysStatic.vramTotal ? si.graphics().catch(() => null) : null,
  ]);
  const g = gfx && (gfx.controllers || []).sort((a, b) => (b.vram || 0) - (a.vram || 0))[0];
  const down = net.reduce((a, n) => a + Math.max(0, n.rx_sec || 0), 0) / 1e6;
  const up = net.reduce((a, n) => a + Math.max(0, n.tx_sec || 0), 0) / 1e6;
  sys = {
    cpu: { usage: load.currentLoad || 0, cores: sysStatic.cores, ghz: sysStatic.ghz, temp: temp.main || 0 },
    ram: { used: (mem.total - mem.available) / 1e9, total: mem.total / 1e9 },
    vram: { used: g && g.memoryUsed ? g.memoryUsed / 1024 : 0, total: sysStatic.vramTotal || 1, gpuUsage: (g && g.utilizationGpu) || 0, temp: (g && g.temperatureGpu) || 0 },
    disk: { used: sysStatic.disk.used / 1e9, total: sysStatic.disk.size / 1e9, read: 0, write: 0 },
    net: { down, up },
    claude: claudeProc,
  };
  send("sys", sys);
}
// procesos de Claude: más lento, cada 5 s
function claudeTick() {
  execFile("tasklist", ["/fi", "imagename eq claude.exe", "/fo", "csv", "/nh"], { windowsHide: true }, (err, out) => {
    if (err) return;
    const rows = out.split(/\r?\n/).filter(l => l.startsWith('"claude.exe"'));
    const kb = rows.reduce((a, l) => a + (parseInt(l.split('","')[4].replace(/\D/g, ""), 10) || 0), 0);
    claudeProc = { processes: rows.length, memory: kb / 1e6 };
  });
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
  if (!on && SHELL) execFile("explorer.exe", [], { windowsHide: false });
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
ipcMain.on("win:fullscreen", () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on("win:minimize", () => { if (win) win.minimize(); });
ipcMain.on("win:hide", () => { if (!win) return; if (SHELL) win.minimize(); else win.hide(); }); // a la bandeja (sin bandeja, si es el escritorio)
ipcMain.on("app:shell", e => { e.returnValue = SHELL; });
ipcMain.on("win:sync", e => { e.returnValue = win ? win.isFullScreen() : true; });

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) { win.hide(); return; }
  win.show(); win.setFullScreen(true); win.focus(); send("palette");
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
  win.on("leave-full-screen", () => send("win:state", false));
  // enlaces externos al navegador, nunca dentro de la app
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on("before-input-event", (e, i) => {
    if (i.type === "keyDown" && i.key === "F11") { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (i.type === "keyDown" && i.key === "F12") win.webContents.toggleDevTools();
    if (i.type === "keyDown" && i.control && i.key.toLowerCase() === "r" && i.shift) win.webContents.reload();
  });
  // cerrar la ventana la esconde en la bandeja: las sesiones siguen vivas
  win.on("close", e => { if (!app.isQuitting) { e.preventDefault(); if (SHELL) win.minimize(); else win.hide(); } });
  // si el proceso de la página se cae, se vuelve a cargar (como escritorio no puede quedarse en negro)
  win.webContents.on("render-process-gone", () => { setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 800); });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, "icono.png")).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip("Cúmulo");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Cúmulo", click: () => { win.show(); win.setFullScreen(true); win.focus(); } },
    { type: "separator" },
    { label: "Salir (cierra las sesiones abiertas)", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => { win.show(); win.setFullScreen(true); win.focus(); });
}

app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });
app.whenReady().then(async () => {
  if (SHELL) ventanas.runStartup(log).catch(() => {});
  createWindow();
  createTray();
  registerShortcut();
  await sysInit().catch(() => {});
  sysTick(); setInterval(() => sysTick().catch(() => {}), 1000);
  claudeTick(); setInterval(claudeTick, 5000);
});
app.on("will-quit", () => { ventanas.stop(); globalShortcut.unregisterAll(); for (const t of terms.values()) { try { t.p.kill(); } catch { /* ya cerrado */ } } });
app.on("window-all-closed", () => { /* sigue en la bandeja */ });
