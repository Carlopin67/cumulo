// Lee las sesiones reales de Claude Code (~/.claude/projects/<carpeta>/<id>.jsonl)
// y las convierte al formato de window.CUMULO_DATA. Lo usa la app de escritorio.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(os.homedir(), ".claude", "projects");
const HOME = os.homedir();
const PROY = /[\\/]Proyectos[\\/]([^\\/"'\s]+)/i; // carpeta de proyecto mencionada en las rutas que toca Claude

const cache = new Map(); // archivo → { mtime, size, data }

// textos que llegaron con la codificación cambiada («continÃºa» → «continúa»)
function fixEncoding(t) {
  if (!/Ã[-¿]/.test(t)) return t;
  try { const r = Buffer.from(t, "latin1").toString("utf8"); return r.includes("�") ? t : r; } catch { return t; }
}

// Un prompt "de verdad": texto escrito por ti, no órdenes internas ni resultados de herramientas.
function promptText(o) {
  if (o.type !== "user" || o.isMeta || o.isSidechain) return null;
  const c = o.message && o.message.content;
  let t = typeof c === "string" ? c : Array.isArray(c) ? (c.find(p => p && p.type === "text") || {}).text : null;
  if (!t) return null;
  t = t.trim();
  if (!t || t.startsWith("<") || t.startsWith("[Request interrupted")) return null;
  return fixEncoding(t);
}

// como título, el primer mensaje sin las rutas de adjuntos (@"C:\…\uploads\…")
function cleanPrompt(t) {
  const r = t.replace(/@"[^"]*"|@\S+[\\/]\S+/g, " ").replace(/\s+/g, " ").trim();
  return r || "Imagen o archivo adjunto";
}

function readSession(file) {
  const st = fs.statSync(file);
  const hit = cache.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.data;

  const id = path.basename(file, ".jsonl");
  let title = null, aiTitle = null, cwd = null, started = null, last = null, first = null;
  let prompts = 0, replies = 0, ctx = 0, model = null;
  const proj = new Map();
  const text = fs.readFileSync(file, "utf8");
  let i = 0;
  while (i < text.length) {
    let j = text.indexOf("\n", i); if (j < 0) j = text.length;
    const line = text.slice(i, j); i = j + 1;
    if (!line) continue;
    // filtro rápido antes de parsear: hay líneas enormes que no interesan
    const head = line.slice(0, 160);
    if (!/"type":"(user|assistant|custom-title|ai-title)"/.test(line.length > 4000 ? head + line.slice(-400) : line)) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type === "custom-title" && o.customTitle) { title = o.customTitle; continue; }
    if (o.type === "ai-title" && o.aiTitle) { aiTitle = o.aiTitle; continue; }
    if (o.isSidechain) continue;
    if (o.timestamp) { if (!started) started = o.timestamp; last = o.timestamp; }
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.type === "user") {
      const t = promptText(o);
      if (t) { prompts++; if (!first) first = t; }
    } else if (o.type === "assistant" && o.message) {
      const m = o.message;
      if (Array.isArray(m.content)) {
        if (m.content.some(p => p.type === "text")) replies++;
        for (const p of m.content) if (p.type === "tool_use" && p.input) {
          const mm = PROY.exec(JSON.stringify(p.input)); if (mm) proj.set(mm[1], (proj.get(mm[1]) || 0) + 1);
        }
      }
      const u = m.usage;
      if (u) { ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); }
      if (m.model && m.model !== "<synthetic>") model = m.model;
    }
  }
  if (!prompts) { cache.set(file, { mtime: st.mtimeMs, size: st.size, data: null }); return null; }

  // proyecto: la carpeta donde se abrió; si fue la carpeta personal o una temporal, el proyecto que más tocó
  let project = cwd || HOME, projectName = null;
  const inProy = PROY.exec(project);
  // abierta en una subcarpeta (Proyectos\cumulo\desktop): cuenta como el proyecto (Proyectos\cumulo)
  if (inProy) project = project.slice(0, inProy.index + inProy[0].length);
  else {
    const best = [...proj.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 3) { project = path.join(HOME, "Proyectos", best[0]); }
    else { project = HOME; projectName = "General"; }
  }
  const data = {
    id, cwd: cwd || HOME,
    title: fixEncoding(title || aiTitle || cleanPrompt(first)).replace(/\s+/g, " ").slice(0, 70),
    project, projectName: projectName || undefined,
    started, lastActive: last || started,
    messages: prompts + replies,
    firstPrompt: first.slice(0, 400),
    context: ctx, model,
  };
  cache.set(file, { mtime: st.mtimeMs, size: st.size, data });
  return data;
}

function readAll() {
  const sessions = [];
  let dirs = [];
  try { dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { return { sessions }; }
  for (const d of dirs) {
    const dir = path.join(ROOT, d.name);
    let files = []; try { files = fs.readdirSync(dir); } catch { continue; } // carpeta sin permiso o borrándose
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      try { const s = readSession(path.join(dir, f)); if (s) sessions.push(s); } catch { /* sesión ilegible: se ignora */ }
    }
  }
  sessions.sort((a, b) => new Date(a.started) - new Date(b.started));
  return { sessions, chats: [] };
}

module.exports = { readAll, ROOT };
