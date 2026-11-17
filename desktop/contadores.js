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
if (Test-Path $cache) { $paths = Get-Content $cache -Encoding UTF8 | ? { $_ } }
else {
  # los nombres de los contadores dependen del idioma de Windows: se buscan una vez y se guardan
  $sets = Get-Counter -ListSet *
  function Find($rx) { ($sets | % { $_.Paths } | ? { $_ -match $rx } | select -First 1) }
  $paths = @(
    ((Find '\\(Processor Information|Informaci.n del procesador)\(\*\)\\(% Processor Utility|% de utilidad del procesador)$') -replace '\(\*\)', '(_Total)'),
    ((Find '\\(PhysicalDisk|Disco f.sico)\(\*\)\\(Disk Read Bytes/sec|Bytes de lectura de disco/s)$') -replace '\(\*\)', '(_Total)'),
    ((Find '\\(PhysicalDisk|Disco f.sico)\(\*\)\\(Disk Write Bytes/sec|Bytes de escritura en disco/s)$') -replace '\(\*\)', '(_Total)'),
    (Find '\\GPU Engine\(\*\)\\Utilization Percentage$'),
    (Find '\\GPU Adapter Memory\(\*\)\\Dedicated Usage$'),
    (Find '\\(Network Interface|Interfaz de red)\(\*\)\\(Bytes Received/sec|Bytes recibidos/s)$'),
    (Find '\\(Network Interface|Interfaz de red)\(\*\)\\(Bytes Sent/sec|Bytes enviados/s)$')
  ) | ? { $_ }
  $paths | Set-Content $cache -Encoding UTF8
}
$paths = $paths | % { if ($_ -match 'GPU Engine') { $_ -replace '\(\*\)', '(*engtype_3D)' } else { $_ } }
Get-Counter -Counter $paths -Continuous -SampleInterval 2 | % {
  $o = @{ cpu = 0; rd = 0; wr = 0; gpu = 0; vram = 0; down = 0; up = 0 }
  foreach ($s in $_.CounterSamples) {
    $p = $s.Path; $v = $s.CookedValue
    if ($p -match 'utilidad del procesador|processor utility') { $o.cpu = $v }
    elseif ($p -match 'lectura|read bytes') { $o.rd += $v }
    elseif ($p -match 'escritura|write bytes') { $o.wr += $v }
    elseif ($p -match 'utilization percentage') { $o.gpu += $v }
    elseif ($p -match 'dedicated usage') { if ($v -gt $o.vram) { $o.vram = $v } }
    elseif ($p -match 'recibidos|received') { $o.down += $v }
    elseif ($p -match 'enviados|sent') { $o.up += $v }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -Compress $o))
}
`;

let ps = null, last = null, stopTimer = 0, dir = null;
function start() {
  if (ps) return;
  const file = path.join(dir, "contadores.ps1");
  fs.writeFileSync(file, "﻿" + PS);
  ps = spawn("powershell.exe", ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", file, path.join(dir, "contadores.txt")],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  let buf = "";
  ps.stdout.setEncoding("utf8");
  ps.stdout.on("data", d => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); try { last = { ...JSON.parse(l), at: Date.now() }; } catch { /* línea a medias */ } }
  });
  ps.on("exit", () => { ps = null; });
}
function stop() { if (ps) { ps.kill(); ps = null; } }

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
