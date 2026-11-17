// Puente de la barra de tareas (ventana aparte, siempre visible abajo).
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
let live = ipcRenderer.sendSync("live:sync");
const fns = new Set();
ipcRenderer.on("live", (_e, v) => { live = v; fns.forEach(f => f(v)); });
contextBridge.exposeInMainWorld("barra", {
  windows: () => ipcRenderer.invoke("win:list"),
  focus: h => ipcRenderer.invoke("win:focus", h),
  minimize: h => ipcRenderer.invoke("win:min", h),
  close: h => ipcRenderer.invoke("win:close", h),
  icon: f => ipcRenderer.invoke("os:icon", f),
  cumulo: () => ipcRenderer.send("bar:cumulo"),
  live: () => live,
  onLive: f => { fns.add(f); },
});
