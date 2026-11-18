// Barra de tareas de Cúmulo cuando otra app está delante: ventanas abiertas, uso, batería y hora.
(() => {
  "use strict";
  const B = window.barra;
  const $ = id => document.getElementById(id);
  if (!B) return;

  $("home").onclick = () => B.cumulo();

  // ventanas abiertas (clic: traer o minimizar; clic central o ×: cerrar)
  const bar = $("apps"), els = new Map(), icons = new Map();
  let busy = false;
  async function tick() {
    if (busy) return; busy = true;
    try {
      const list = await B.windows();
      const seen = new Set();
      list.forEach(w => {
        seen.add(w.h);
        let b = els.get(w.h);
        if (!b) {
          b = document.createElement("button"); b.type = "button"; b.className = "app-item";
          b.innerHTML = `<span class="ai-ico"></span><span class="t"></span><span class="x" aria-label="Cerrar ventana"><svg class="ico" viewBox="0 0 16 16"><path d="M5 5l6 6M11 5l-6 6"/></svg></span>`;
          b.onclick = e => {
            if (e.target.closest(".x")) { B.close(w.h); return; }
            if (b.dataset.fg === "1" && !b.dataset.min) B.minimize(w.h); else B.focus(w.h);
            setTimeout(tick, 250);
          };
          b.onauxclick = e => { if (e.button === 1) B.close(w.h); };
          els.set(w.h, b); bar.append(b);
          const key = w.path || w.name;
          const setIco = u => { if (u) b.querySelector(".ai-ico").innerHTML = `<img alt="" src="${u}">`; };
          if (icons.has(key)) setIco(icons.get(key));
          else if (w.path) B.icon(w.path).then(u => { icons.set(key, u); setIco(u); });
        }
        b.querySelector(".t").textContent = w.title;
        b.title = `${w.title} — ${w.name}`;
        b.dataset.fg = w.fg ? "1" : ""; b.dataset.min = w.min ? "1" : "";
      });
      els.forEach((b, h) => { if (!seen.has(h)) { b.remove(); els.delete(h); } });
      bar.classList.toggle("empty", !els.size);
    } catch { /* sin datos esta vez */ }
    busy = false;
  }
  tick(); setInterval(() => { if (!document.hidden) tick(); }, 2000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

  // hora
  const tickClock = () => {
    const d = new Date();
    $("clockTime").textContent = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(d);
    $("clockDate").textContent = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(/[.,]/g, "");
  };
  tickClock(); setInterval(tickClock, 10000);

  // batería
  const showBat = (level, charging) => {
    const pct = Math.round(level * 100);
    $("batPct").textContent = pct + " %";
    $("batFill").setAttribute("width", Math.max(0.6, 13.6 * level).toFixed(2));
    $("batFill").classList.toggle("low", pct <= 15 && !charging);
    $("batBolt").style.display = charging ? "" : "none";
  };
  if (navigator.getBattery) navigator.getBattery().then(b => {
    const up = () => showBat(b.level, b.charging);
    up(); b.addEventListener("levelchange", up); b.addEventListener("chargingchange", up);
  }).catch(() => {});

  // uso de Claude (lo que guarda la barra de estado de Claude)
  const lvl = u => u >= 0.9 ? "crit" : u >= 0.7 ? "warn" : "";
  function usage(v) {
    const l = v && v.limits; if (!l || !l.five_hour || !l.seven_day) return;
    // una ventana que ya se reinició vale 0 hasta que Claude escriba el dato nuevo (como en el panel de Cúmulo)
    const pct = x => x.resets_at * 1000 > Date.now() ? (x.used_percentage || 0) / 100 : 0;
    const se = pct(l.five_hour), wk = pct(l.seven_day);
    const arc = (el, u) => { el.style.strokeDasharray = `${Math.max(0.5, u * 100).toFixed(1)} 100`; el.setAttribute("class", "mo-arc " + lvl(u)); };
    arc($("moWeekly"), wk); arc($("moSession"), se);
    $("moText").textContent = `${Math.round(se * 100)} % · ${Math.round(wk * 100)} %`;
  }
  usage(B.live()); B.onLive(usage);

  // el tema cambia en Cúmulo: se sigue
  window.addEventListener("storage", e => { if (e.key === "cumulo-theme" && e.newValue) document.documentElement.dataset.theme = e.newValue; });
})();
