// La conversación de una sesión, leída de su .jsonl, para la vista propia de Cúmulo (como la app del móvil):
// tus mensajes (con sus imágenes), lo que responde Claude, sus herramientas y las imágenes que mira.
// Se lee por trozos: cada vez solo lo nuevo desde la última lectura.
"use strict";
const fs = require("fs");
const path = require("path");

const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const MAX_INLINE = 4 * 1024 * 1024; // imágenes pegadas más grandes no se incrustan
const tails = new Map(); // id → { file, pos, rest, items }

function findFile(root, id) {
  try {
    for (const d of fs.readdirSync(root)) {
      const f = path.join(root, d, id + ".jsonl");
      if (fs.existsSync(f)) return f;
    }
  } catch { /* sin carpeta */ }
  return null;
}

// de cada herramienta, lo que mejor la resume en una línea
function toolArg(name, inp) {
  if (!inp || typeof inp !== "object") return "";
  const v = inp.description || inp.command || inp.file_path || inp.pattern || inp.url || inp.query || inp.prompt || inp.skill || inp.path || "";
  return String(v).replace(/\s+/g, " ").slice(0, 160);
}

function userItem(o) {
  if (o.isMeta || o.isCompactSummary) return null;
  const c = o.message && o.message.content;
  let text = "", imgs = [];
  if (typeof c === "string") text = c;
  else if (Array.isArray(c)) {
    if (c.some(p => p && p.type === "tool_result")) return null; // respuesta de una herramienta, no tuya
    for (const p of c) {
      if (!p) continue;
      if (p.type === "text") text += (text ? "\n" : "") + p.text;
      else if (p.type === "image" && p.source && p.source.type === "base64" && p.source.data.length < MAX_INLINE)
        imgs.push(`data:${p.source.media_type || "image/png"};base64,${p.source.data}`);
    }
  }
  text = text.trim();
  if (text.startsWith("<") || text.startsWith("[Request interrupted")) {
    // órdenes como /model se guardan entre etiquetas: se enseña la orden, no las etiquetas
    const m = /<command-name>([^<]+)<\/command-name>/.exec(text);
    if (!m) return imgs.length ? { k: "u", text: "", imgs } : null;
    const args = (/<command-args>([^<]*)<\/command-args>/.exec(text) || [])[1] || "";
    text = (m[1] + " " + args).trim();
  }
  text = text.replace(/\[Image #\d+\]\s*/g, "").trim();
  if (!text && !imgs.length) return null;
  return { k: "u", text, imgs };
}

function read(root, id) {
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) return null;
  let t = tails.get(id);
  if (!t || !t.file) {
    t = { file: findFile(root, id), pos: 0, rest: "", items: [] };
    tails.set(id, t);
    if (!t.file) return t;
  }
  try {
    const size = fs.statSync(t.file).size;
    if (size < t.pos) Object.assign(t, { pos: 0, rest: "", items: [] });
    if (size > t.pos) {
      const fd = fs.openSync(t.file, "r"), buf = Buffer.alloc(size - t.pos);
      fs.readSync(fd, buf, 0, buf.length, t.pos); fs.closeSync(fd); t.pos = size;
      const lines = (t.rest + buf.toString("utf8")).split("\n"); t.rest = lines.pop();
      for (const line of lines) {
        const queued = line.includes('"type":"queued_command"');
        if (!queued && !line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
        let o; try { o = JSON.parse(line); } catch { continue; }
        if (o.isSidechain) continue;
        const at = o.timestamp || null;
        // lo que escribiste mientras Claude trabajaba: no se guarda como mensaje tuyo, sino como añadido a su turno
        if (o.type === "attachment") {
          const a = o.attachment;
          if (a && a.type === "queued_command" && a.commandMode === "prompt" && (!a.origin || a.origin.kind === "human") && typeof a.prompt === "string") {
            const u = userItem({ message: { content: a.prompt } }); if (u) { u.at = at; t.items.push(u); }
          }
          continue;
        }
        if (o.type === "user") {
          // la respuesta a una pregunta con opciones (AskUserQuestion)
          const ans = o.toolUseResult && o.toolUseResult.answers;
          if (ans && typeof ans === "object") {
            const c = o.message && Array.isArray(o.message.content) ? o.message.content.find(p => p && p.type === "tool_result") : null;
            t.items.push({ k: "qa", id: c ? c.tool_use_id : null, answers: ans, at });
            continue;
          }
          const u = userItem(o); if (u) { u.at = at; t.items.push(u); }
          continue;
        }
        if (o.type !== "assistant" || !o.message || !Array.isArray(o.message.content)) continue;
        if (o.message.model === "<synthetic>") continue; // avisos que no escribe Claude («No response requested.»)
        for (const p of o.message.content) {
          if (!p) continue;
          if (p.type === "text" && p.text && p.text.trim()) t.items.push({ k: "a", text: p.text.trim(), at });
          else if (p.type === "tool_use" && p.name === "AskUserQuestion" && p.input && Array.isArray(p.input.questions)) {
            t.items.push({ k: "q", id: p.id, at, questions: p.input.questions.map(q => ({
              question: String(q.question || ""), header: String(q.header || ""), multi: !!q.multiSelect,
              options: (q.options || []).map(x => ({ label: String(x.label || ""), description: String(x.description || "") })),
            })) });
          }
          else if (p.type === "tool_use") {
            t.items.push({ k: "t", name: p.name, arg: toolArg(p.name, p.input), at });
            const f = p.name === "Read" && p.input && p.input.file_path;
            if (f && IMG_EXT.test(f)) t.items.push({ k: "img", path: f, at });
          }
        }
      }
    }
  } catch { /* archivo en uso: la próxima vez */ }
  return t;
}

// devuelve lo que el que pregunta aún no tiene (desde «from»); si el archivo empezó de nuevo, desde 0
function feed(root, id, from = 0) {
  const t = read(root, id);
  if (!t) return { total: 0, items: [], reset: false };
  const reset = from > t.items.length;
  const start = reset ? 0 : from;
  const items = t.items.slice(start).map(x => x.k === "img" ? { ...x, gone: !fs.existsSync(x.path) } : x);
  return { total: t.items.length, from: start, items, reset };
}

module.exports = { feed };
