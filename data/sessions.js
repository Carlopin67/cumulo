// DATOS INVENTADOS para la simulación.
// Para usar datos reales, basta con generar este mismo archivo con la misma forma
// (ver README.md → "Formato de los datos"). La app no necesita nada más.
//
// Campos de cada sesión:
//   id          → identificador de la sesión (el que usa `claude --resume <id>`)
//   title       → nombre corto de la sesión
//   project     → carpeta en la que se abrió Claude
//   started     → fecha del primer mensaje (ISO)
//   lastActive  → fecha del último mensaje (ISO)
//   messages    → número de mensajes
//   firstPrompt → primer mensaje que escribiste
//   related     → (opcional) ids de otras sesiones con las que conectar un hilo

if (!window.CUMULO_DATA) window.CUMULO_DATA = { // en la app instalable ya vienen los datos reales
  sessions: [
    // ── observatorio ───────────────────────────────────────────
    { id: "4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10", title: "Mapa del cielo en canvas", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-02T17:12:00Z", lastActive: "2026-10-02T19:40:00Z", messages: 64, firstPrompt: "quiero una web que dibuje el cielo de esta noche desde Madrid" },
    { id: "8b1d0e57-3a9c-4f61-8e2d-5c7a0b9f4e21", title: "Catálogo de estrellas Hipparcos", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-04T10:05:00Z", lastActive: "2026-10-04T12:31:00Z", messages: 88, firstPrompt: "descarga el catálogo Hipparcos y quédate solo con las estrellas visibles" },
    { id: "c93e2f04-6b7a-4d15-a0c8-2f9e1d6b3a32", title: "Constelaciones con nombres", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-09T18:20:00Z", lastActive: "2026-10-09T20:02:00Z", messages: 41, firstPrompt: "une las estrellas de cada constelación con líneas finas" },
    { id: "5d4b8e61-2c7f-4a90-8b3e-9c1f6a2d7e54", title: "Publicar en Vercel", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-11-12T19:00:00Z", lastActive: "2026-11-12T19:35:00Z", messages: 18, firstPrompt: "súbelo a Vercel con un dominio bonito", related: ["e6a3d9f2-8b4c-4e17-9a50-3d8b2f7c1a65"] },

    // ── recetario ──────────────────────────────────────────────
    { id: "a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76", title: "Estructura de la app de recetas", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-06T11:00:00Z", lastActive: "2026-10-06T13:22:00Z", messages: 52, firstPrompt: "app para guardar recetas de mi abuela con fotos" },
    { id: "f81b6d40-3c2e-4a79-8d15-0b7e9f4a6c87", title: "Escanear recetas a mano", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-11T09:30:00Z", lastActive: "2026-10-11T11:48:00Z", messages: 73, firstPrompt: "quiero hacer foto a una receta escrita a mano y que la pase a texto" },
    { id: "2c9e7a15-8d3f-4b06-a1e7-4f2c6b9d0e98", title: "Lista de la compra automática", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-18T17:10:00Z", lastActive: "2026-10-18T18:05:00Z", messages: 29, firstPrompt: "que al elegir recetas me saque la lista de la compra junta" },

    // ── torneo-ajedrez ─────────────────────────────────────────
    { id: "b4f8c2e7-1d6a-4e93-8f05-7c2a9e3b6d1a", title: "Cuadro de eliminatorias", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-03T16:00:00Z", lastActive: "2026-10-03T18:40:00Z", messages: 95, firstPrompt: "web para llevar el torneo del club con emparejamientos suizos" },
    { id: "3f9b2d76-6a4e-4c18-8e91-5d3a7f0b2e4d", title: "Ranking Elo de socios", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-25T10:10:00Z", lastActive: "2026-10-25T12:44:00Z", messages: 67, firstPrompt: "calcula el Elo de cada socio con todas las partidas del año" },
    { id: "9c5e0a31-2b8d-4f6c-b7e4-0a9c3e5f1d5e", title: "Inscripciones con formulario", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-11-08T18:00:00Z", lastActive: "2026-11-08T19:12:00Z", messages: 33, firstPrompt: "formulario para que la gente se apunte al torneo de navidad" },
    { id: "e2a7f5c8-3d1e-4b90-8c62-1f7d4b9a3e6f", title: "Partidas en vivo", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-11-15T16:30:00Z", lastActive: "2026-11-15T18:58:00Z", messages: 81, firstPrompt: "que se vean las partidas en directo con un tablero en la web", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10"] },

    // ── podcast-historia ───────────────────────────────────────
    { id: "0d8c4b62-7f3a-4e15-9a27-6c1e8d5b4f70", title: "Guion episodio 1: Roma", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-12T21:00:00Z", lastActive: "2026-10-12T22:15:00Z", messages: 26, firstPrompt: "guion de 10 minutos sobre la caída de Roma, tono cercano" },
    { id: "5b3f9e17-0c6d-4a82-8e49-3b7f2a6d5c81", title: "Voces y música de fondo", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-16T19:40:00Z", lastActive: "2026-10-16T21:30:00Z", messages: 58, firstPrompt: "busca música libre de derechos que pegue con historia antigua" },
    { id: "a6e1c3d9-8b4f-4c27-9f50-4e2b8c7a6d92", title: "Guion episodio 2: Bizancio", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-29T20:20:00Z", lastActive: "2026-10-29T21:05:00Z", messages: 22, firstPrompt: "segundo episodio, Bizancio, mismo formato que el anterior", related: ["0d8c4b62-7f3a-4e15-9a27-6c1e8d5b4f70"] },

    // ── portfolio ──────────────────────────────────────────────
    { id: "e6a3d9f2-8b4c-4e17-9a50-3d8b2f7c1a65", title: "Portfolio personal", project: "C:\\Users\\carlos\\Proyectos\\portfolio", started: "2026-10-20T15:00:00Z", lastActive: "2026-10-20T17:35:00Z", messages: 70, firstPrompt: "web sencilla con mis proyectos, que parezca de revista" },
    { id: "1b7e4c95-2d8a-4f03-b6c1-9e4a7d3f2b76", title: "Fichas de cada proyecto", project: "C:\\Users\\carlos\\Proyectos\\portfolio", started: "2026-10-27T16:40:00Z", lastActive: "2026-10-27T17:58:00Z", messages: 38, firstPrompt: "una página por proyecto con capturas y lo que aprendí", related: ["b4f8c2e7-1d6a-4e93-8f05-7c2a9e3b6d1a", "a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76"] },

    // ── bot-clima ──────────────────────────────────────────────
    { id: "3d6a0f84-5c2e-4a17-9b83-6d0a4f1e5b98", title: "Bot de Telegram del tiempo", project: "C:\\Users\\carlos\\Proyectos\\bot-clima", started: "2026-10-08T08:30:00Z", lastActive: "2026-10-08T10:15:00Z", messages: 49, firstPrompt: "bot que cada mañana me diga si va a llover" },
    { id: "f4b9e2c7-6d1a-4f58-8c94-7e1b5a2f6c09", title: "Avisos de tormenta", project: "C:\\Users\\carlos\\Proyectos\\bot-clima", started: "2026-10-23T07:50:00Z", lastActive: "2026-10-23T08:40:00Z", messages: 24, firstPrompt: "que avise si hay alerta naranja en mi zona" },

    // ── juego-plataformas ──────────────────────────────────────
    { id: "6c1f4a79-9b3e-4d20-8e15-2a7d9c4b8e2b", title: "Prototipo del salto", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-10-13T17:00:00Z", lastActive: "2026-10-13T19:44:00Z", messages: 102, firstPrompt: "juego de plataformas en el navegador, empecemos por el salto" },
    { id: "b8e3d0f5-1a6c-4e94-9d27-3b8e1f5c9a3c", title: "Niveles con editor", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-10-19T16:20:00Z", lastActive: "2026-10-19T18:50:00Z", messages: 77, firstPrompt: "un editor para dibujar los niveles con el ratón" },
    { id: "4e2c9b61-8f5a-4d73-b0e6-5d1a3f7c2e5e", title: "Enemigos y vidas", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-11-09T17:15:00Z", lastActive: "2026-11-09T19:28:00Z", messages: 59, firstPrompt: "añade enemigos que patrullan y tres vidas" },
    { id: "d9a6e3b2-0c4f-4a85-9e61-6f2d8b4a3c6f", title: "Versión para móvil", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-11-16T18:00:00Z", lastActive: "2026-11-16T19:46:00Z", messages: 46, firstPrompt: "botones táctiles para jugar en el móvil" },

    // ── carpeta personal ───────────────────────────────────────
    { id: "c2d8a4f1-5e7b-4c30-8f96-1d4c7e0a5b81", title: "Copia de seguridad semanal", project: "C:\\Users\\carlos", started: "2026-10-17T10:40:00Z", lastActive: "2026-10-17T11:30:00Z", messages: 27, firstPrompt: "copia mis proyectos a un disco externo cada domingo" },
    { id: "9e4c7b02-3a8f-4d59-b1c6-7a3e2d9f5ba3", title: "Lanzador de sesiones", project: "C:\\Users\\carlos", started: "2026-11-17T17:00:00Z", lastActive: "2026-11-17T17:30:00Z", messages: 9, firstPrompt: "un lanzador más estético que la terminal, con las sesiones como estrellas", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10"] }
  ],

  // Chats del modo Ask (claude.ai / app de escritorio): el segundo plano del cielo.
  // Mismos campos; `project` es el nombre del proyecto de claude.ai (o «Sin proyecto»).
  // `related` puede apuntar a sesiones de Claude Code: esos hilos cruzan de un plano a otro.
  chats: [
    // ── Estudios ───────────────────────────────────────────────
    { id: "a1c4e7f0-2b5d-4e81-9c3a-6f0b2d5e8a11", title: "Por qué titilan las estrellas", project: "Estudios", started: "2026-10-01T21:30:00Z", lastActive: "2026-10-01T21:52:00Z", messages: 12, firstPrompt: "por qué las estrellas parpadean y los planetas no", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10"] },
    { id: "b2d5f8a1-3c6e-4f92-8d4b-7a1c3e6f9b22", title: "Resumen tema 4 de física", project: "Estudios", started: "2026-10-15T16:10:00Z", lastActive: "2026-10-15T17:05:00Z", messages: 26, firstPrompt: "resúmeme el tema de ondas en una página" },
    { id: "c3e6a9b2-4d7f-4a03-9e5c-8b2d4f7a0c33", title: "Ejercicios de derivadas", project: "Estudios", started: "2026-10-28T18:00:00Z", lastActive: "2026-10-28T19:20:00Z", messages: 34, firstPrompt: "ponme 10 derivadas de examen y corrígemelas" },
    { id: "d4f7b0c3-5e8a-4b14-8f6d-9c3e5a8b1d44", title: "Comentario de texto: Machado", project: "Estudios", started: "2026-11-06T17:30:00Z", lastActive: "2026-11-06T18:15:00Z", messages: 18, firstPrompt: "ayúdame a estructurar un comentario de «Caminante, no hay camino»" },
    { id: "e5a8c1d4-6f9b-4c25-9a7e-0d4f6b9c2e55", title: "Plan de estudio para enero", project: "Estudios", started: "2026-11-16T20:00:00Z", lastActive: "2026-11-17T09:10:00Z", messages: 15, firstPrompt: "hazme un calendario para preparar los exámenes de enero" },
    { id: "8b9d2434-e465-4150-bd9c-66b3ad3c2d6d", title: "Repaso de la Revolución francesa", project: "Estudios", started: "2026-10-16T08:00:00Z", lastActive: "2026-10-16T08:45:00Z", messages: 15, firstPrompt: "hazme un esquema de las fases de la Revolución francesa" },
    { id: "386ecbe0-6b65-46a4-8b81-48f6b38a088c", title: "Dudas de química orgánica", project: "Estudios", started: "2026-08-11T02:40:00Z", lastActive: "2026-08-11T02:55:00Z", messages: 5, firstPrompt: "no entiendo la nomenclatura de los alcoholes" },
    { id: "562b0f79-c374-49ee-b50b-ea63371ecd7b", title: "Integrales por partes", project: "Estudios", started: "2026-09-27T01:20:00Z", lastActive: "2026-09-27T03:24:00Z", messages: 31, firstPrompt: "explícame integración por partes paso a paso" },
    { id: "142c3fe8-60e7-4113-ac1b-8ca1f91e1d4c", title: "Preguntas tipo test de biología", project: "Estudios", started: "2026-08-13T17:40:00Z", lastActive: "2026-08-13T19:15:00Z", messages: 19, firstPrompt: "ponme 15 preguntas tipo test del tema de genética" },
    { id: "146d3f31-fc37-4a4c-8a15-544dc5e7ce8a", title: "Esquema de la Generación del 27", project: "Estudios", started: "2026-10-07T18:30:00Z", lastActive: "2026-10-07T18:58:00Z", messages: 14, firstPrompt: "autores y obras clave de la Generación del 27" },
    { id: "4458a885-ab90-49a4-b5a2-40ae5af30553", title: "Probabilidad condicionada", project: "Estudios", started: "2026-11-05T05:05:00Z", lastActive: "2026-11-05T05:37:00Z", messages: 8, firstPrompt: "no me sale este ejercicio de probabilidad condicionada" },
    { id: "ece66fa2-fd51-46e6-851b-4cf36123fdf7", title: "Corregir redacción de filosofía", project: "Estudios", started: "2026-10-22T06:05:00Z", lastActive: "2026-10-22T06:41:00Z", messages: 12, firstPrompt: "corrígeme esta redacción sobre Platón sin cambiarme el estilo" },
    { id: "66b2bc5b-50c1-47fc-8e17-7b4e0837b8a3", title: "Física: movimiento circular", project: "Estudios", started: "2026-10-16T09:50:00Z", lastActive: "2026-10-16T10:04:00Z", messages: 7, firstPrompt: "por qué en el MCU hay aceleración si la velocidad es constante" },
    { id: "ea1fca65-e27a-484d-a548-21d07fcd9eb1", title: "Técnicas para memorizar", project: "Estudios", started: "2026-09-06T04:15:00Z", lastActive: "2026-09-06T06:11:00Z", messages: 29, firstPrompt: "cómo memorizo fechas de historia sin volverme loco" },
    { id: "663f1c97-9562-49f0-a5d7-b8756dadd6c7", title: "Selectividad: notas de corte", project: "Estudios", started: "2026-10-16T16:10:00Z", lastActive: "2026-10-16T16:38:00Z", messages: 7, firstPrompt: "cómo se calcula la nota de admisión" },
    { id: "cac5b68c-28f4-4481-a0a0-4dc427209bdf", title: "Matrices y determinantes", project: "Estudios", started: "2026-09-17T10:10:00Z", lastActive: "2026-09-17T10:32:00Z", messages: 11, firstPrompt: "resuélveme este sistema con Cramer y explícamelo" },
    { id: "f143262f-dc5c-4eed-8da0-365bf89897b9", title: "Resumen de Luces de bohemia", project: "Estudios", started: "2026-10-20T06:05:00Z", lastActive: "2026-10-20T06:45:00Z", messages: 8, firstPrompt: "resumen por escenas de Luces de bohemia" },

    // ── Ajedrez ────────────────────────────────────────────────
    { id: "f6b9d2e5-7a0c-4d36-8b8f-1e5a7c0d3f66", title: "Cómo funciona el Elo", project: "Ajedrez", started: "2026-10-24T22:00:00Z", lastActive: "2026-10-24T22:30:00Z", messages: 10, firstPrompt: "explícame la fórmula del Elo con un ejemplo", related: ["3f9b2d76-6a4e-4c18-8e91-5d3a7f0b2e4d"] },
    { id: "07c0e3f6-8b1d-4e47-9c9a-2f6b8d1e4a77", title: "Aperturas para blancas", project: "Ajedrez", started: "2026-10-10T19:00:00Z", lastActive: "2026-10-10T19:45:00Z", messages: 22, firstPrompt: "qué apertura me recomiendas si juego e4 y me gusta atacar" },
    { id: "18d1f4a7-9c2e-4f58-8dab-3a7c9e2f5b88", title: "Reglamento del torneo", project: "Ajedrez", started: "2026-11-07T11:00:00Z", lastActive: "2026-11-07T11:40:00Z", messages: 14, firstPrompt: "redacta las normas del torneo de navidad del club", related: ["9c5e0a31-2b8d-4f6c-b7e4-0a9c3e5f1d5e"] },
    { id: "6f4cc69a-4b22-4308-9c8e-aee95715bd6f", title: "Finales de torre", project: "Ajedrez", started: "2026-07-25T14:05:00Z", lastActive: "2026-07-25T15:09:00Z", messages: 16, firstPrompt: "los finales de torre básicos que tengo que saber" },
    { id: "4c66e0a8-a013-4c6e-9eda-4e161b3dbd5c", title: "Analizar mi partida", project: "Ajedrez", started: "2026-08-22T10:00:00Z", lastActive: "2026-08-22T10:18:00Z", messages: 6, firstPrompt: "te paso mi partida en PGN, ¿dónde la fastidié?", related: ["e2a7f5c8-3d1e-4b90-8c62-1f7d4b9a3e6f"] },
    { id: "eb2263dd-87c5-421e-ac24-a3c5c754108f", title: "Defensa siciliana", project: "Ajedrez", started: "2026-11-04T00:50:00Z", lastActive: "2026-11-04T01:26:00Z", messages: 12, firstPrompt: "qué variante de la siciliana es más fácil de aprender" },
    { id: "3d4cbf37-4eb9-4eff-8e88-cb2dd4e80839", title: "Entrenar táctica", project: "Ajedrez", started: "2026-07-20T23:30:00Z", lastActive: "2026-07-21T00:10:00Z", messages: 10, firstPrompt: "plan de 20 minutos al día para mejorar en táctica" },

    // ── Viajes ─────────────────────────────────────────────────
    { id: "29e2a5b8-0d3f-4a69-9ebc-4b8d0f3a6c99", title: "Ruta por Asturias", project: "Viajes", started: "2026-10-19T10:00:00Z", lastActive: "2026-10-19T10:50:00Z", messages: 20, firstPrompt: "4 días por Asturias en coche, sin prisas" },
    { id: "3af3b6c9-1e4a-4b7a-8fcd-5c9e1a4b7daa", title: "Qué llevar a la montaña", project: "Viajes", started: "2026-10-20T09:00:00Z", lastActive: "2026-10-20T09:20:00Z", messages: 8, firstPrompt: "lista de cosas para una ruta de un día en otoño" },
    { id: "4b04c7da-2f5b-4c8b-9ade-6daf2b5c8ebb", title: "Cielos oscuros en España", project: "Viajes", started: "2026-11-11T21:00:00Z", lastActive: "2026-11-11T21:35:00Z", messages: 16, firstPrompt: "sitios con poca contaminación lumínica para ver estrellas", related: ["a1c4e7f0-2b5d-4e81-9c3a-6f0b2d5e8a11"] },
    { id: "20de435d-2031-4750-840d-b9b4885f6e66", title: "Fin de semana en Lisboa", project: "Viajes", started: "2026-08-05T17:05:00Z", lastActive: "2026-08-05T17:13:00Z", messages: 4, firstPrompt: "qué ver en Lisboa en dos días" },
    { id: "badcc32a-c159-4f53-8a0f-4efbedcd465e", title: "Billetes de tren baratos", project: "Viajes", started: "2026-10-18T07:50:00Z", lastActive: "2026-10-18T08:15:00Z", messages: 5, firstPrompt: "trucos para encontrar billetes de tren baratos" },
    { id: "3f76be1d-1efa-4197-b394-988f847fd9b4", title: "Interrail el verano que viene", project: "Viajes", started: "2026-10-21T03:20:00Z", lastActive: "2026-10-21T03:52:00Z", messages: 8, firstPrompt: "ruta de interrail de 15 días con poco dinero" },
    { id: "5496f63c-dc11-40c1-880a-adfbe7c99b26", title: "Frases básicas en portugués", project: "Viajes", started: "2026-08-31T15:30:00Z", lastActive: "2026-08-31T15:54:00Z", messages: 12, firstPrompt: "frases útiles para un viaje a Portugal" },
    { id: "7900f7f9-9382-4b43-922f-e15ae1e3db63", title: "Presupuesto del viaje", project: "Viajes", started: "2026-08-08T04:15:00Z", lastActive: "2026-08-08T04:36:00Z", messages: 7, firstPrompt: "ayúdame a montar un presupuesto para 4 personas" },
    { id: "778eedb3-693d-4fbc-ac6f-a6115ab33edf", title: "Qué ver en Granada", project: "Viajes", started: "2026-09-03T01:45:00Z", lastActive: "2026-09-03T02:17:00Z", messages: 16, firstPrompt: "plan de un día en Granada con la Alhambra" },

    // ── Cocina ─────────────────────────────────────────────────
    { id: "5c15d8eb-3a6c-4d9c-8bef-7eb03c6d9fcc", title: "Croquetas de la abuela", project: "Cocina", started: "2026-10-06T13:30:00Z", lastActive: "2026-10-06T13:55:00Z", messages: 9, firstPrompt: "cómo consigo que la bechamel no quede grumosa", related: ["a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76"] },
    { id: "6d26e9fc-4b7d-4ead-9cf0-8fc14d7eaadd", title: "Menú de la semana", project: "Cocina", started: "2026-11-02T10:00:00Z", lastActive: "2026-11-02T10:30:00Z", messages: 13, firstPrompt: "menú barato y sano para 5 días" },
    { id: "7e37fa0d-5c8e-4fbe-8d01-9ad25e8fbbee", title: "Sustituir el huevo", project: "Cocina", started: "2026-11-14T19:00:00Z", lastActive: "2026-11-14T19:10:00Z", messages: 6, firstPrompt: "con qué sustituyo el huevo en un bizcocho" },
    { id: "30b187ef-310c-4c00-bfa7-f1041bf90e27", title: "Pan casero sin amasadora", project: "Cocina", started: "2026-11-05T23:00:00Z", lastActive: "2026-11-05T23:20:00Z", messages: 5, firstPrompt: "receta de pan fácil sin máquina" },
    { id: "dc815fe7-ceda-4bbb-b171-0434134c6c92", title: "Tupper para la semana", project: "Cocina", started: "2026-10-06T03:10:00Z", lastActive: "2026-10-06T03:37:00Z", messages: 9, firstPrompt: "ideas de comida para llevar que aguanten 3 días" },
    { id: "610461e3-2a25-4888-8f02-bad0e7067ef4", title: "Qué hago con calabacines", project: "Cocina", started: "2026-11-05T07:05:00Z", lastActive: "2026-11-05T07:20:00Z", messages: 5, firstPrompt: "tengo 4 calabacines, ¿qué cocino?" },
    { id: "fed4057d-bb02-4576-b512-c4c3b253d218", title: "Bizcocho de yogur", project: "Cocina", started: "2026-07-21T23:40:00Z", lastActive: "2026-07-21T23:55:00Z", messages: 3, firstPrompt: "receta clásica de bizcocho de yogur" },
    { id: "504867ba-bf7b-439b-8f9a-ea4b8acd4e10", title: "Cena para invitados", project: "Cocina", started: "2026-10-29T19:45:00Z", lastActive: "2026-10-29T19:57:00Z", messages: 6, firstPrompt: "menú sencillo para 6 personas que quede bien" },
    { id: "118a9d29-2f92-4996-99f1-95d014822f53", title: "Masa de pizza", project: "Cocina", started: "2026-08-05T13:45:00Z", lastActive: "2026-08-10T14:18:00Z", messages: 11, firstPrompt: "cómo hago una masa de pizza crujiente" },

    // ── Inglés ────────────────────────────────────────────────
    { id: "6b5252e3-14fc-4d54-9e8f-c9650a2c827e", title: "Corregir mi writing", project: "Inglés", started: "2026-10-12T00:15:00Z", lastActive: "2026-10-12T00:21:00Z", messages: 2, firstPrompt: "corrígeme este writing de nivel B2" },
    { id: "a53f8a28-abf3-43fc-a181-3d25655238a6", title: "Phrasal verbs comunes", project: "Inglés", started: "2026-10-18T01:50:00Z", lastActive: "2026-10-18T02:22:00Z", messages: 8, firstPrompt: "los 30 phrasal verbs más usados con ejemplos" },
    { id: "e1805081-5958-4499-aeea-163e21e8ac68", title: "Preparar el speaking", project: "Inglés", started: "2026-09-10T03:30:00Z", lastActive: "2026-09-10T04:03:00Z", messages: 11, firstPrompt: "simula conmigo un examen de speaking B2" },
    { id: "8768a84f-a76a-4de6-8e9e-1a11fcbb4e59", title: "Diferencia entre for y since", project: "Inglés", started: "2026-08-07T19:15:00Z", lastActive: "2026-08-07T19:51:00Z", messages: 9, firstPrompt: "cuándo uso for y cuándo since" },
    { id: "8da01097-be0f-451b-9b66-b5a9e3c43657", title: "Vocabulario de tecnología", project: "Inglés", started: "2026-07-24T08:50:00Z", lastActive: "2026-07-24T09:05:00Z", messages: 5, firstPrompt: "vocabulario en inglés para hablar de programación" },
    { id: "7d106c60-8162-4cf1-8394-72e6da587e8a", title: "Carta formal en inglés", project: "Inglés", started: "2026-08-22T00:20:00Z", lastActive: "2026-08-22T01:08:00Z", messages: 16, firstPrompt: "cómo empiezo y termino una carta formal" },
    { id: "fad409e2-a319-4cb4-a17d-65a0c56811cd", title: "Present perfect", project: "Inglés", started: "2026-09-04T02:00:00Z", lastActive: "2026-09-07T02:20:00Z", messages: 5, firstPrompt: "explícame el present perfect con ejemplos fáciles" },
    { id: "093923de-8bab-4e3b-a628-6bfbe767dcea", title: "Series para aprender", project: "Inglés", started: "2026-09-05T11:45:00Z", lastActive: "2026-09-11T12:09:00Z", messages: 12, firstPrompt: "series en inglés con acento claro para mi nivel" },

    // ── Programación ──────────────────────────────────────────
    { id: "dc570131-f8e1-4aa7-8bce-abdeeededb07", title: "Qué es una API REST", project: "Programación", started: "2026-11-03T09:50:00Z", lastActive: "2026-11-03T10:18:00Z", messages: 7, firstPrompt: "explícame qué es una API REST como si tuviera 15 años" },
    { id: "6808593f-dfed-4c43-a256-a6dc8f5486b7", title: "Git para novatos", project: "Programación", started: "2026-08-01T22:30:00Z", lastActive: "2026-08-01T22:44:00Z", messages: 7, firstPrompt: "diferencia entre commit, push y pull" },
    { id: "698c206f-e1a4-4e10-ad53-4dd0cf8ebc5a", title: "Python o JavaScript", project: "Programación", started: "2026-11-15T11:10:00Z", lastActive: "2026-11-15T12:07:00Z", messages: 19, firstPrompt: "qué lenguaje aprendo primero" },
    { id: "61ee411a-1bac-47a7-b386-f7a4c991603f", title: "Error de CORS", project: "Programación", started: "2026-07-29T09:30:00Z", lastActive: "2026-07-29T10:24:00Z", messages: 18, firstPrompt: "me sale un error de CORS, ¿qué significa?" },
    { id: "3a43b2ba-df0f-46cb-8b9b-c326d20eac17", title: "Cómo funciona canvas", project: "Programación", started: "2026-11-06T17:45:00Z", lastActive: "2026-11-06T17:55:00Z", messages: 2, firstPrompt: "cómo dibujo cosas en un canvas de HTML", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10"] },
    { id: "8268690b-a438-45b5-99e4-b6714774bc58", title: "Expresiones regulares", project: "Programación", started: "2026-08-31T10:15:00Z", lastActive: "2026-08-31T10:33:00Z", messages: 9, firstPrompt: "una regex para validar un correo y explícamela" },
    { id: "09cb3942-43f5-4a85-bbc9-f87af668a617", title: "Qué es Vercel", project: "Programación", started: "2026-09-21T16:50:00Z", lastActive: "2026-09-21T17:26:00Z", messages: 9, firstPrompt: "para qué sirve Vercel y si es gratis", related: ["5d4b8e61-2c7f-4a90-8b3e-9c1f6a2d7e54"] },
    { id: "e645f129-629c-4ae3-9d9a-f65982ec9f2d", title: "Bases de datos para principiantes", project: "Programación", started: "2026-08-14T17:40:00Z", lastActive: "2026-08-14T18:05:00Z", messages: 5, firstPrompt: "SQL o NoSQL para un proyecto pequeño" },
    { id: "ebb7a385-aa0b-4b14-b2e9-702d11e9cdaa", title: "CSS grid vs flexbox", project: "Programación", started: "2026-10-10T04:20:00Z", lastActive: "2026-10-10T04:32:00Z", messages: 4, firstPrompt: "cuándo usar grid y cuándo flexbox" },
    { id: "6703b636-5380-4904-a88c-7015aab97e49", title: "Hacer un bot de Telegram", project: "Programación", started: "2026-09-13T18:30:00Z", lastActive: "2026-09-13T19:22:00Z", messages: 13, firstPrompt: "qué necesito para hacer un bot de Telegram", related: ["3d6a0f84-5c2e-4a17-9b83-6d0a4f1e5b98"] },

    // ── Gimnasio ──────────────────────────────────────────────
    { id: "91b0e1d9-9d92-42af-ac8d-0e44e71e43a6", title: "Rutina de 3 días", project: "Gimnasio", started: "2026-10-21T20:50:00Z", lastActive: "2026-10-21T21:15:00Z", messages: 5, firstPrompt: "rutina de gimnasio de 3 días para principiante" },
    { id: "527eecfa-a79a-49aa-9b4e-2c249479e1e6", title: "Cuánta proteína", project: "Gimnasio", started: "2026-09-10T06:50:00Z", lastActive: "2026-09-10T07:44:00Z", messages: 18, firstPrompt: "cuánta proteína necesito si entreno 3 veces" },
    { id: "a2086977-a9f2-4336-83f4-a9a948a639d0", title: "Dolor de rodilla al correr", project: "Gimnasio", started: "2026-09-28T18:45:00Z", lastActive: "2026-09-28T19:30:00Z", messages: 15, firstPrompt: "me duele la rodilla al correr, ¿qué puede ser?" },
    { id: "0bd4a990-0640-4e0f-a5b8-fd4b32fa2de8", title: "Estiramientos después de entrenar", project: "Gimnasio", started: "2026-10-14T09:05:00Z", lastActive: "2026-10-14T11:49:00Z", messages: 41, firstPrompt: "estiramientos de 10 minutos para después" },
    { id: "b7e58481-31c6-41ec-935f-2b0aa1384ddc", title: "Dominadas desde cero", project: "Gimnasio", started: "2026-09-03T06:45:00Z", lastActive: "2026-09-03T08:15:00Z", messages: 18, firstPrompt: "cómo llego a hacer mi primera dominada" },
    { id: "1b494e15-e2ad-4909-8521-bf2ddc45d539", title: "Comer antes de entrenar", project: "Gimnasio", started: "2026-10-21T18:45:00Z", lastActive: "2026-10-21T19:03:00Z", messages: 9, firstPrompt: "qué como antes de ir al gimnasio por la tarde" },

    // ── Sin proyecto ───────────────────────────────────────────
    { id: "8f480b1e-6d9f-4acf-9e12-0be36f9accff", title: "Correo al casero", project: "Sin proyecto", started: "2026-10-09T08:40:00Z", lastActive: "2026-10-09T08:55:00Z", messages: 7, firstPrompt: "escribe un correo educado pidiendo que arreglen la caldera" },
    { id: "90591c2f-7ea0-4bd0-8f23-1cf47a0bdd00", title: "Qué portátil comprar", project: "Sin proyecto", started: "2026-10-26T17:00:00Z", lastActive: "2026-10-26T18:10:00Z", messages: 24, firstPrompt: "portátil para programar y algo de juegos, unos 900 €" },
    { id: "a16a2d30-8fb1-4ce1-9034-2d058b1cee11", title: "Ideas para un podcast", project: "Sin proyecto", started: "2026-10-11T22:00:00Z", lastActive: "2026-10-11T22:40:00Z", messages: 19, firstPrompt: "quiero hacer un podcast de historia, ¿cómo lo enfoco?", related: ["0d8c4b62-7f3a-4e15-9a27-6c1e8d5b4f70"] },
    { id: "b27b3e41-90c2-4df2-8145-3e169c2dff22", title: "Nombre para la app de recetas", project: "Sin proyecto", started: "2026-10-05T20:00:00Z", lastActive: "2026-10-05T20:15:00Z", messages: 8, firstPrompt: "dame nombres cortos para una app de recetas familiares", related: ["a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76"] },
    { id: "c38c4f52-a1d3-4e03-9256-4f27ad3e0033", title: "Cómo funciona un LLM", project: "Sin proyecto", started: "2026-11-15T23:00:00Z", lastActive: "2026-11-16T00:05:00Z", messages: 21, firstPrompt: "explícame qué es un token y la ventana de contexto", related: ["9e4c7b02-3a8f-4d59-b1c6-7a3e2d9f5ba3"] },
    { id: "d49d5063-b2e4-4f14-8367-50380e4f1144", title: "Felicitación de cumpleaños", project: "Sin proyecto", started: "2026-11-17T08:00:00Z", lastActive: "2026-11-17T08:12:00Z", messages: 5, firstPrompt: "un mensaje gracioso para el cumple de mi hermano" },
    { id: "cd29a36f-2222-42e1-b4da-aebf1f115b76", title: "Mensaje para el grupo de clase", project: "Sin proyecto", started: "2026-10-29T08:15:00Z", lastActive: "2026-10-29T08:48:00Z", messages: 11, firstPrompt: "redacta un mensaje para organizar la cena de clase" },
    { id: "28be9288-e5af-4e39-b227-64e68c41561b", title: "Qué móvil comprar", project: "Sin proyecto", started: "2026-09-28T17:50:00Z", lastActive: "2026-09-28T19:10:00Z", messages: 16, firstPrompt: "móvil bueno por menos de 400 €" },
    { id: "3d3f3799-a072-45e9-bc0e-8cd88573e793", title: "Regalo para mi madre", project: "Sin proyecto", started: "2026-10-26T04:45:00Z", lastActive: "2026-10-26T05:17:00Z", messages: 8, firstPrompt: "ideas de regalo para mi madre, le gusta leer" },
    { id: "269cd696-236c-4b87-94a0-bccb8a476a87", title: "Por qué el cielo es azul", project: "Sin proyecto", started: "2026-09-07T01:05:00Z", lastActive: "2026-09-07T02:01:00Z", messages: 14, firstPrompt: "por qué el cielo es azul y el atardecer naranja" },
    { id: "34f3193c-0ff0-455c-aa70-2e2f7746d0ba", title: "Película para esta noche", project: "Sin proyecto", started: "2026-09-01T12:10:00Z", lastActive: "2026-09-01T13:15:00Z", messages: 13, firstPrompt: "recomiéndame una peli de ciencia ficción poco conocida" },
    { id: "7a1b5806-6160-46b4-9360-715fc3fe0183", title: "Reclamar un pedido", project: "Sin proyecto", started: "2026-11-03T05:40:00Z", lastActive: "2026-11-03T06:40:00Z", messages: 30, firstPrompt: "cómo reclamo un pedido que no ha llegado" },
    { id: "9a6ec2f5-ccc4-4903-8bcf-53a1bc10fa52", title: "Cómo funciona el IVA", project: "Sin proyecto", started: "2026-07-23T15:30:00Z", lastActive: "2026-07-23T16:05:00Z", messages: 7, firstPrompt: "explícame el IVA de forma sencilla" },
    { id: "67814c1f-cc53-4e36-addc-3e13ab3b4d37", title: "Nombre para mi perro", project: "Sin proyecto", started: "2026-11-08T23:45:00Z", lastActive: "2026-11-08T23:57:00Z", messages: 6, firstPrompt: "nombres cortos para un perro pequeño" },
    { id: "2e85cb21-7631-4e9d-9de9-f86322bd3388", title: "Traducir un correo", project: "Sin proyecto", started: "2026-10-24T08:45:00Z", lastActive: "2026-10-28T09:17:00Z", messages: 16, firstPrompt: "tradúceme este correo al inglés de forma natural" },
    { id: "f3821cfd-c083-473a-873b-d358610e6a64", title: "Dormir mejor", project: "Sin proyecto", started: "2026-08-04T04:40:00Z", lastActive: "2026-08-04T05:08:00Z", messages: 7, firstPrompt: "consejos para dormir mejor en época de exámenes" },
    { id: "1190f938-a66f-47f7-b966-9fa759970043", title: "Resumen de un vídeo", project: "Sin proyecto", started: "2026-11-03T03:20:00Z", lastActive: "2026-11-03T04:02:00Z", messages: 21, firstPrompt: "te paso la transcripción, resúmemela en 5 puntos" },
    { id: "41992fdf-b310-42f0-b70c-779837cc863b", title: "Calcular la hipoteca", project: "Sin proyecto", started: "2026-10-29T14:00:00Z", lastActive: "2026-10-29T14:14:00Z", messages: 7, firstPrompt: "cómo se calcula la cuota de una hipoteca" },
    { id: "edcb8cb6-0692-4c63-9424-aed51bac5c15", title: "Libros como Dune", project: "Sin proyecto", started: "2026-10-28T07:10:00Z", lastActive: "2026-10-28T08:40:00Z", messages: 30, firstPrompt: "libros parecidos a Dune" },
    { id: "1a16342c-3e2b-4091-a092-f52ad4a057a7", title: "Organizar mi semana", project: "Sin proyecto", started: "2026-09-11T14:40:00Z", lastActive: "2026-09-11T14:54:00Z", messages: 7, firstPrompt: "ayúdame a organizar la semana entre clases y gimnasio" },
    { id: "58e25888-0a83-41be-885a-ca4690e0f4a0", title: "Qué es la inflación", project: "Sin proyecto", started: "2026-10-21T20:20:00Z", lastActive: "2026-10-21T21:14:00Z", messages: 27, firstPrompt: "qué es la inflación con un ejemplo" },
    { id: "75b17a55-d426-4982-a43e-4288a2b5b498", title: "Contestar a una reseña", project: "Sin proyecto", started: "2026-10-05T19:30:00Z", lastActive: "2026-10-08T19:50:00Z", messages: 4, firstPrompt: "cómo contesto a una reseña mala sin quedar mal" },
    { id: "7bc67e1f-c64e-46e3-89c5-b31aeb6c1016", title: "Ideas para Halloween", project: "Sin proyecto", started: "2026-10-22T19:40:00Z", lastActive: "2026-10-22T20:00:00Z", messages: 5, firstPrompt: "disfraces fáciles para Halloween" },
    { id: "76f72255-c01f-46bf-be6d-d58b7367c28d", title: "Juegos de mesa para 4", project: "Sin proyecto", started: "2026-09-28T17:20:00Z", lastActive: "2026-09-28T17:36:00Z", messages: 8, firstPrompt: "juegos de mesa para 4 personas que no sean largos" },
  ]
};
