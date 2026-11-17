# Cúmulo

Lanzador de sesiones de Claude Code: cada sesión es una estrella, los proyectos forman cúmulos y los hilos unen sesiones relacionadas.

**Estado:** simulación en el navegador con datos inventados. Objetivo final: app instalable que lea las sesiones reales y las abra en una terminal.

## Estructura
- `index.html` — página
- `css/styles.css` — estilos
- `js/monitor.js` — monitor del sistema (datos simulados)
- `js/app.js` — dibujo del cúmulo, cámara, panel, temas y vista de sesión a pantalla completa (simulada)
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

## Diseño
- **Temas:** oscuro (cielo fotografiado) y claro (carta celeste impresa). Sigue al sistema hasta que eliges uno con el botón sol/luna; el cambio se hace con un revelado circular.
- **Estrellas:** el tamaño crece con los mensajes; las sesiones largas tienen picos de difracción (oscuro) o cruz de carta (claro); las activas estos días laten.
- **Tipografía:** todo en Martian Mono, una fuente de terminal: estrecha para títulos y normal para texto y datos.
- **Monitor del sistema:** dentro de cada sesión, arriba a la derecha (CPU, RAM, VRAM, disco, red, Claude), como gráficas de área difuminadas sin tarjeta. Se puede plegar. Los datos son simulados hasta que exista `window.CUMULO_SYSTEM.read()` (forma descrita en `js/monitor.js`).
- **Límites de uso:** debajo del monitor, la ventana de 5 h y la semanal como dos órbitas: el arco es lo gastado (acaba en una punta brillante), la bolita hueca es el tiempo pasado y hay un punto cada 20 %; además, cuenta atrás y proyección al ritmo actual. Simulados hasta que exista `window.CUMULO_LIMITS.read()` (forma descrita en `js/monitor.js`).
- **Interfaz:** barra de título y barra de estado como una app de escritorio, inspector acoplado a la derecha (hoja inferior en el móvil). Referencias: Ghostty, Stellarium, Warp y btop.
- **Sesión:** pantalla completa con pestaña, bloques por intercambio (estilo Warp) y un compositor fijo abajo: adjuntar imágenes (botón, pegar o arrastrar; en el móvil abre cámara o galería) y botón para parar la respuesta (o Esc).
- **Movimiento:** cámara con vuelos suavizados, zoom anclado al cursor e inercia; todo respeta `prefers-reduced-motion`.
