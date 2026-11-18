// Contadores de rendimiento de Windows: los mismos que usa el Administrador de tareas
// (CPU, disco, gráfica —incluida la integrada—, memoria de gráfica y red).
// Un único PowerShell los lee cada 2 s mientras el monitor está a la vista; si nadie mira, se cierra.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$cache = $args[0]
$paths = @()
if (Test-Path $cache) { $paths = @(Get-Content $cache -Encoding UTF8 | ? { $_ }) }
if (-not $paths) {
  # los nombres de los contadores dependen del idioma de Windows: se buscan una vez y se guardan
  $sets = Get-Counter -ListSet *
  function Find($rx) { ($sets | % { $_.Paths } | ? { $_ -match $rx } | select -First 1) }
  $paths = @(
    ((Find '\\(Processor Information|Informaci.n del procesador)\(\*\)\\(% Processor Utility|% de utilidad del procesador)$') -replace '\(\*\)', '(_Total)'),
    ((Find '\\(PhysicalDisk|Disco f.sico)\(\*\)\\(Disk Read Bytes/sec|Bytes de lectura de disco/s)$') -replace '\(\*\)', '(_Total)'),
    ((Find '\\(PhysicalDisk|Disco f.sico)\(\*\)\\(Disk Write Bytes/sec|Bytes de escritura en disco/s)$') -replace '\(\*\)', '(_Total)'),
    (Find '\\GPU Engine\(\*\)\\Utilization Percentage$'),
    (Find '\\GPU Adapter Memory\(\*\)\\Dedicated Usage$'),
    (Find '\\GPU Adapter Memory\(\*\)\\Shared Usage$'),
    (Find '\\(Network Interface|Interfaz de red)\(\*\)\\(Bytes Received/sec|Bytes recibidos/s)$'),
    (Find '\\(Network Interface|Interfaz de red)\(\*\)\\(Bytes Sent/sec|Bytes enviados/s)$')
  ) | ? { $_ }
  if ($paths) { $paths | Set-Content $cache -Encoding UTF8 } # si no salió nada, se vuelve a buscar la próxima vez
}
if (-not $paths) { exit 1 }
$paths = $paths | % { if ($_ -match 'GPU Engine') { $_ -replace '\(\*\)', '(*engtype_3D)' } else { $_ } }
Get-Counter -Counter $paths -Continuous -SampleInterval 2 | % {
  $o = @{ cpu = 0; rd = 0; wr = 0; gpu = 0; vram = 0; shared = 0; down = 0; up = 0 }
  foreach ($s in $_.CounterSamples) {
    $p = $s.Path; $v = $s.CookedValue
    if ($p -match 'utilidad del procesador|processor utility') { $o.cpu = $v }
    elseif ($p -match 'lectura|read bytes') { $o.rd += $v }
    elseif ($p -match 'escritura|write bytes') { $o.wr += $v }
    elseif ($p -match 'utilization percentage') { $o.gpu += $v }
    elseif ($p -match 'dedicated usage') { if ($v -gt $o.vram) { $o.vram = $v } }
    elseif ($p -match 'shared usage') { $o.shared += $v } # la integrada (Intel) solo usa memoria compartida
    elseif ($p -match 'recibidos|received') { $o.down += $v }
    elseif ($p -match 'enviados|sent') { $o.up += $v }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress $o))
}
`;

let ps = null, last = null, stopTimer = 0, dir = null, startedAt = 0;
function start() {
  // si se cae, no se relanza en bucle: como mucho uno cada 15 s (mientras tanto el monitor usa sus lecturas de reserva)
  if (ps || !dir || Date.now() - startedAt < 15000) return;
  startedAt = Date.now();
  const file = path.join(dir, "contadores.ps1");
  try { fs.writeFileSync(file, "﻿" + PS); } catch { return; }
  const me = spawn("powershell.exe", ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", file, path.join(dir, "contadores-2.txt")],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  ps = me;
  let buf = "";
  me.on("error", () => { if (ps === me) ps = null; });
  me.stdout.setEncoding("utf8");
  me.stdout.on("data", d => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); try { last = { ...JSON.parse(l), at: Date.now() }; } catch { /* línea a medias */ } }
  });
  me.on("exit", () => { if (ps === me) ps = null; }); // el aviso de uno viejo no borra al nuevo
}
function stop() { if (ps) { const p = ps; ps = null; startedAt = 0; try { p.kill(); } catch { /* ya cerrado */ } } }

module.exports = {
  // activo: arranca (si no estaba); inactivo: se cierra a los 10 s para no gastar nada
  setActive(on, userData) {
    dir = userData;
    clearTimeout(stopTimer);
    if (on) start(); else if (ps) stopTimer = setTimeout(stop, 10000);
  },
  read: () => (last && Date.now() - last.at < 8000 ? last : null),
  stop,
};
