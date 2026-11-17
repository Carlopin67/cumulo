// Tecla Windows → lanzador de Cúmulo (solo cuando Cúmulo es el escritorio: sin explorador no hay menú Inicio).
// Un gancho de teclado avisa cuando se pulsa y se suelta la tecla Windows SOLA (Win+otra tecla no cuenta).
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PS = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms @'
using System; using System.Diagnostics; using System.Runtime.InteropServices; using System.Windows.Forms;
public static class TeclaWin {
  delegate IntPtr Proc(int n, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, Proc f, IntPtr mod, uint tid);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
  static Proc proc = Hook; static IntPtr hook; static bool down, combo;
  static IntPtr Hook(int n, IntPtr w, IntPtr l) {
    if (n >= 0) {
      int vk = Marshal.ReadInt32(l); int msg = (int)w;
      bool isDown = msg == 0x100 || msg == 0x104, isUp = msg == 0x101 || msg == 0x105;
      if (vk == 0x5B || vk == 0x5C) {
        if (isDown && !down) { down = true; combo = false; }
        else if (isUp && down) { down = false; if (!combo) { Console.Out.WriteLine("win"); Console.Out.Flush(); } }
      } else if (isDown && down) combo = true;
    }
    return CallNextHookEx(hook, n, w, l);
  }
  public static void Run() {
    using (var p = Process.GetCurrentProcess()) using (var m = p.MainModule) hook = SetWindowsHookEx(13, proc, GetModuleHandle(m.ModuleName), 0);
    Application.Run();
  }
}
'@
[TeclaWin]::Run()
`;

let ps = null, stopped = false;
function start(dir, onPress) {
  stopped = false;
  const file = path.join(dir, "teclawin.ps1");
  fs.writeFileSync(file, "﻿" + PS);
  ps = spawn("powershell.exe", ["-NoProfile", "-NoLogo", "-STA", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  ps.stdout.setEncoding("utf8");
  ps.stdout.on("data", d => { if (d.includes("win")) onPress(); });
  ps.on("exit", () => { ps = null; if (!stopped) setTimeout(() => start(dir, onPress), 3000); }); // si se cae, vuelve
}
module.exports = { start, stop: () => { stopped = true; if (ps) ps.kill(); } };
