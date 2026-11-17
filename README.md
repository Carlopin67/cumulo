# Cúmulo

Lanzador de sesiones de Claude Code: cada sesión es una estrella, los proyectos forman cúmulos y los hilos unen sesiones relacionadas.

**Estado:** simulación en el navegador con datos inventados. Objetivo final: app instalable que lea las sesiones reales y las abra en una terminal.

## Estructura
- `index.html` — página
- `css/styles.css` — estilos
- `js/app.js` — dibujo del cúmulo, cámara, panel y terminal simulada
- `data/sessions.js` — **los datos** (lo único que hay que cambiar para usar datos reales)

## Formato de los datos
```js
window.CUMULO_DATA = { sessions: [
  { id, title, project, started, lastActive, messages, firstPrompt, related: [ids] }
]};
```
- Los hilos "mismo proyecto" se calculan solos (sesiones de la misma carpeta, por orden de fecha).
- `related` añade hilos punteados entre proyectos distintos (opcional).

Las sesiones reales están en `~/.claude/projects/<carpeta>/<id>.jsonl`; un script generará este archivo a partir de ellas. Los datos reales no se subirán al repositorio público.
