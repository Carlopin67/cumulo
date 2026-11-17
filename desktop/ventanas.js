// Ventanas abiertas de otras apps (para la barra de tareas de Cúmulo) y programas de inicio.
// Un PowerShell fijo en segundo plano responde órdenes por línea; así no se arranca uno cada vez.
"use strict";
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public class W {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint c);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int s);
}
'@
while ($true) {
  $line = [Console]::In.ReadLine(); if ($line -eq $null) { break }
  $p = $line.Split(' ', 3); $cmd = $p[0]
  try {
    if ($cmd -eq 'list') {
      $fg = [W]::GetForegroundWindow(); $out = New-Object System.Collections.ArrayList
      $cb = [W+EnumProc]{ param($h, $x)
        if (-not [W]::IsWindowVisible($h)) { return $true }
        if ([W]::GetWindow($h, 4) -ne [IntPtr]::Zero) { return $true }          # tiene dueño (diálogos)
        $ex = [W]::GetWindowLong($h, -20); if ($ex -band 0x80) { return $true } # ventana de herramientas
        $cl = 0; [void][W]::DwmGetWindowAttribute($h, 14, [ref]$cl, 4); if ($cl) { return $true } # oculta (apps de la tienda)
        $n = [W]::GetWindowTextLength($h); if ($n -le 0) { return $true }
        $sb = New-Object System.Text.StringBuilder ($n + 1); [void][W]::GetWindowText($h, $sb, $n + 1)
        $wpid = 0; [void][W]::GetWindowThreadProcessId($h, [ref]$wpid)
        $pr = Get-Process -Id $wpid
        [void]$out.Add(@{ h = $h.ToInt64(); title = $sb.ToString(); pid = $wpid; name = $pr.ProcessName; path = $pr.Path; min = [W]::IsIconic($h); fg = ($h -eq $fg) })
        return $true }
      [void][W]::EnumWindows($cb, [IntPtr]::Zero)
      [Console]::Out.WriteLine((ConvertTo-Json -Compress -Depth 3 @($out)))
    } elseif ($cmd -eq 'focus') {
      $h = [IntPtr][Int64]$p[1]
      if ([W]::IsIconic($h)) { [void][W]::ShowWindowAsync($h, 9) }
      [W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero) # Alt: permite traer la ventana delante
      [void][W]::SetForegroundWindow($h); [Console]::Out.WriteLine('ok')
    } elseif ($cmd -eq 'min') { [void][W]::ShowWindowAsync([IntPtr][Int64]$p[1], 6); [Console]::Out.WriteLine('ok')
    } elseif ($cmd -eq 'close') { [void][W]::PostMessage([IntPtr][Int64]$p[1], 0x10, [IntPtr]::Zero, [IntPtr]::Zero); [Console]::Out.WriteLine('ok')
    } else { [Console]::Out.WriteLine('?') }
  } catch { [Console]::Out.WriteLine('[]') }
}
`;

let ps = null, queue = [], buf = "";
function start(dir) {
  const file = path.join(dir, "ventanas.ps1");
  fs.writeFileSync(file, "\ufeff" + PS);
  ps = spawn("powershell.exe", ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
  ps.stdout.setEncoding("utf8");
  ps.stdout.on("data", d => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); const q = queue.shift(); if (q) q(line); }
  });
  ps.on("exit", () => { ps = null; queue.splice(0).forEach(q => q("[]")); });
}
function ask(cmd, dir) {
  if (!ps) start(dir);
  return new Promise(r => { queue.push(r); ps.stdin.write(cmd + "\n"); });
}
async function list(dir, selfPid) {
  const raw = await ask("list", dir);
  let arr = []; try { arr = JSON.parse(raw || "[]"); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [arr];
  const skip = /^(explorer|TextInputHost|ShellExperienceHost|StartMenuExperienceHost|SearchHost|LockApp|SystemSettingsAdminFlows|CrossDeviceResume)$/i;
  return arr.filter(w => w && w.pid !== selfPid && !skip.test(w.name || "") && w.title !== "Program Manager" && !/Cúmulo/.test(w.path || ""));
}

// ── programas de inicio (lo que haría el escritorio de Windows al entrar) ──
// Se respetan los desactivados en el Administrador de tareas (StartupApproved: primer byte impar = desactivado).
function regValues(key) {
  return new Promise(r => execFile("reg", ["query", key], { windowsHide: true }, (e, out) => {
    const vals = {};
    if (!e) out.split(/\r?\n/).forEach(l => { const m = /^\s{4}(.+?)\s{4}(REG_\w+)\s{4}(.*)$/.exec(l); if (m) vals[m[1]] = m[3]; });
    r(vals);
  }));
}
function splitCmd(cmd) {
  cmd = cmd.replace(/%([^%]+)%/g, (_, v) => process.env[v] || _).trim();
  if (cmd.startsWith('"')) { const i = cmd.indexOf('"', 1); return [cmd.slice(1, i), cmd.slice(i + 1).trim()]; }
  const m = /^(.+?\.exe)(\s.*)?$/i.exec(cmd);
  return m ? [m[1], (m[2] || "").trim()] : [cmd, ""];
}
async function runStartup(log) {
  const sets = [
    ["HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run"],
    ["HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run"],
    ["HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32"],
  ];
  for (const [runKey, okKey] of sets) {
    const [vals, ok] = await Promise.all([regValues(runKey), regValues(okKey)]);
    for (const [name, cmd] of Object.entries(vals)) {
      const flag = ok[name];
      if (flag && parseInt(flag.slice(0, 2), 16) % 2 === 1) continue; // desactivado
      const [file, args] = splitCmd(cmd);
      try {
        // se lanza a través de cmd para respetar las comillas de los argumentos tal cual
        spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${file}" ${args}`], { windowsHide: true, detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
        log(`inicio: ${name}`);
      } catch (e) { log(`inicio falló: ${name}`); }
    }
  }
  const folders = [
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup"),
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs", "StartUp"),
  ];
  for (const d of folders) {
    let ents = []; try { ents = fs.readdirSync(d); } catch { continue; }
    for (const f of ents) if (!/desktop\.ini$/i.test(f)) {
      spawn("cmd.exe", ["/d", "/s", "/c", `start "" "${path.join(d, f)}"`], { windowsHide: true, detached: true, stdio: "ignore", windowsVerbatimArguments: true }).unref();
      log(`inicio: ${f}`);
    }
  }
}

// ── Cúmulo como escritorio de Windows (por usuario; se deshace borrando el valor) ──
const WINLOGON = "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon";
function shellGet() { return regValues(WINLOGON).then(v => v.Shell || null); }
// Windows arranca un vigilante (VBScript) que abre Cúmulo y lo vuelve a abrir si se cierra o falla.
function shellSet(exe, dir) {
  return new Promise(r => {
    if (exe) {
      const vbs = path.join(dir, "cumulo-escritorio.vbs");
      const q = s => s.replace(/"/g, '""');
      const src = [
        "' Vigilante de Cúmulo como escritorio de Windows: lo abre y lo reabre si se cierra.",
        'Set sh = CreateObject("WScript.Shell")',
        `exe = "${q(exe)}"`,
        "Do",
        '  sh.Run """" & exe & """ --shell", 1, True',
        "  On Error Resume Next",
        `  v = sh.RegRead("HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon\\Shell")`,
        "  If Err.Number <> 0 Then Exit Do",
        "  On Error GoTo 0",
        "  WScript.Sleep 1500",
        "Loop",
      ].join("\r\n");
      fs.writeFileSync(vbs, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(src, "utf16le")])); // VBScript lee UTF-16
      execFile("reg", ["add", WINLOGON, "/v", "Shell", "/t", "REG_SZ", "/d", `wscript.exe "${vbs}"`, "/f"], { windowsHide: true }, e => r(!e));
    } else execFile("reg", ["delete", WINLOGON, "/v", "Shell", "/f"], { windowsHide: true }, () => r(true));
  });
}

module.exports = {
  list, focus: (h, dir) => ask(`focus ${h}`, dir), minimize: (h, dir) => ask(`min ${h}`, dir), close: (h, dir) => ask(`close ${h}`, dir),
  runStartup, shellGet, shellSet, stop: () => { if (ps) ps.kill(); },
};
