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
window.CUMULO_DATA = {
  sessions: [ { id, title, project, started, lastActive, messages, firstPrompt, related: [ids] } ], // Claude Code
  chats:    [ { id, title, project, started, lastActive, messages, firstPrompt, related: [ids] } ], // modo Ask
};
```
- En `chats`, `project` es el nombre del proyecto de claude.ai (o «Sin proyecto»).
- Si `related` une un chat con una sesión de Code, el hilo cruza de un plano a otro.
- Los hilos "mismo proyecto" se calculan solos (sesiones de la misma carpeta, por orden de fecha).
- `related` añade hilos punteados entre proyectos distintos (opcional).

Las sesiones reales están en `~/.claude/projects/<carpeta>/<id>.jsonl`; un script generará este archivo a partir de ellas. Los datos reales no se subirán al repositorio público.

## Diseño
- **Temas:** oscuro (cielo fotografiado) y claro (carta celeste impresa). Sigue al sistema hasta que eliges uno con el botón sol/luna; el cambio se hace con un revelado circular.
- **Dos planos:** delante, las sesiones de Claude Code; detrás, más pequeños, desenfocados y con menos paralaje, los chats del modo Ask. El conmutador `Code · Ask` de la barra de título (o las teclas `1` y `2`) intercambia los planos: el de delante retrocede y se desenfoca mientras el otro avanza y se enfoca. Leyenda, búsqueda, inspector y botón de nuevo se adaptan al plano activo. Los hilos entre un chat y una sesión atraviesan la profundidad, y al pulsar uno en el inspector te lleva al otro plano.
- **Estrellas:** el tamaño crece con los mensajes; las sesiones largas tienen picos de difracción; las activas estos días laten. Los chats de Ask son más redondos (sin picos, con un anillo fino) y usan otra gama de colores.
- **Actividad:** cuanto más reciente es una sesión, más brilla, más grande se ve y más titila; las de hace semanas se quedan quietas y tenues, como polvo.
- **Tipografía:** todo en Martian Mono, una fuente de terminal: estrecha para títulos y normal para texto y datos.
- **Monitor del sistema:** dentro de cada sesión, arriba a la derecha (CPU, RAM, VRAM, disco, red, Claude), como gráficas de área difuminadas sin tarjeta. Se puede plegar. Los datos son simulados hasta que exista `window.CUMULO_SYSTEM.read()` (forma descrita en `js/monitor.js`).
- **Límites de uso:** debajo del monitor, la ventana de 5 h y la semanal como dos órbitas: el arco es lo gastado (acaba en un haz de luz), la bolita hueca es el tiempo pasado y hay un punto por día (semanal) o por hora (5 h); además, cuenta atrás y proyección al ritmo actual. Simulados hasta que exista `window.CUMULO_LIMITS.read()` (forma descrita en `js/monitor.js`).
- **Ventana de contexto:** debajo de los límites, 100 casillas sobre 1M de tokens (1 % = 10k cada una) repartidas por categorías como `/context` de Claude Code; crece al escribir en la sesión y tiene un botón **Compactar** que hace lo mismo que `/compact`. Simulada.
- **Interfaz:** barra de título arriba y, abajo, solo la bandeja del sistema (wifi, volumen, batería real si el navegador la da, fecha y hora) con el estilo de la app; inspector acoplado a la derecha (hoja inferior en el móvil). Referencias: Ghostty, Stellarium, Warp y btop.
- **Chat (Ask):** se abre a pantalla completa como conversación (tus mensajes en burbuja, la respuesta debajo). A la derecha se ven los límites de uso (compartidos con Code) y la ventana de contexto; no hay monitor del sistema ni botón de compactar, porque un chat no se ejecuta en tu ordenador.
- **Sesión:** pantalla completa con pestaña, bloques por intercambio (estilo Warp) y un compositor fijo abajo: adjuntar imágenes (botón, pegar o arrastrar; en el móvil abre cámara o galería) y botón para parar la respuesta (o Esc).
- **Entrar en una sesión:** primero el inspector se aparta y la estrella se coloca en el centro de la pantalla; ya quieta, la cámara se zambulle en ella, su luz crece hasta llenar la pantalla mientras el polvo se estira en estelas, y la sesión surge desenfocada de esa luz. El nombre de la estrella viaja hasta la pestaña y la ventana se monta por partes (pestañas, panel derecho con las órbitas trazándose, terminal o chat). Al salir pasa al revés y también en dos tiempos: la ventana se condensa en luz que vuelve a su estrella (que sigue en el centro), el título regresa a su etiqueta y la estrella late al recibirla; cuando termina, la estrella vuelve a donde estaba y el inspector reaparece.
- **Barra de tareas:** abajo a la izquierda, un icono por cada sesión o chat abierto (un terminal para Code, un bocadillo para Ask, del color del proyecto); la activa se subraya. Un punto fijo ámbar indica que la sesión te pregunta algo y uno verde que ha terminado de responder; al abrirla ves lo que dejó pendiente. Si sales de una sesión mientras Claude responde, sigue en segundo plano y avisa al terminar. Desde la barra se cambia de sesión sin volver al mapa.
- **Uso en la bandeja:** junto al wifi, una órbita en miniatura (5 h dentro, semanal fuera) con los dos porcentajes; al pasar el ratón muestra cuándo se reinician.
- **Cursor:** en el mapa, con ratón o trackpad, la app dibuja su propia mira (una cruz fina con un hueco, como el buscador de un telescopio). Sobre una estrella se abre en los cuatro arcos del visor y se centra en ella; al arrastrar se encoge; al hacer clic suelta un pulso. En barras, inspector y terminal se usa el cursor normal del sistema.
- **Pasos de Claude:** cada respuesta muestra los pasos que da (leer, buscar, editar, ejecutar, captura; en Ask, buscar en la web y leer páginas). Mientras trabaja se ven uno a uno; al terminar se pliegan en una línea con miniaturas. Las capturas se abren en un visor (← → para recorrerlas, Esc para cerrar) y se dibujan con la paleta del lanzador. Simuladas hasta la versión instalable.
- **Encuestas:** cuando Claude te pregunta cómo seguir, aparece una tarjeta con las opciones: eliges con clic o pulsando su número, o escribes otra respuesta (en la tarjeta o en el compositor). Lo elegido queda marcado y Claude continúa.
- **Cursor:** fuera del mapa, la app usa su propio cursor oscuro (flecha, flecha con anillo naranja en lo que se puede pulsar y barra de texto).
- **Movimiento:** en el trackpad, dos dedos mueven el mapa (con un ligero amortiguado, libre en las dos direcciones) y pellizcar acerca o aleja (también Ctrl + rueda); arrastrar con el clic sigue funcionando. Cámara con vuelos suavizados, zoom anclado al cursor e inercia; todo respeta `prefers-reduced-motion`.
