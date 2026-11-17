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

window.CUMULO_DATA = {
  sessions: [
    // ── observatorio ───────────────────────────────────────────
    { id: "4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10", title: "Mapa del cielo en canvas", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-02T17:12:00Z", lastActive: "2026-10-02T19:40:00Z", messages: 64, firstPrompt: "quiero una web que dibuje el cielo de esta noche desde Madrid" },
    { id: "8b1d0e57-3a9c-4f61-8e2d-5c7a0b9f4e21", title: "Catálogo de estrellas Hipparcos", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-04T10:05:00Z", lastActive: "2026-10-04T12:31:00Z", messages: 88, firstPrompt: "descarga el catálogo Hipparcos y quédate solo con las estrellas visibles" },
    { id: "c93e2f04-6b7a-4d15-a0c8-2f9e1d6b3a32", title: "Constelaciones con nombres", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-09T18:20:00Z", lastActive: "2026-10-09T20:02:00Z", messages: 41, firstPrompt: "une las estrellas de cada constelación con líneas finas" },
    { id: "1e7c5a28-9f0b-4c3d-b6e1-7a2d4c8f5b43", title: "Modo móvil y giroscopio", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-10-21T16:45:00Z", lastActive: "2026-10-21T18:10:00Z", messages: 37, firstPrompt: "que al mover el móvil se mueva el cielo" },
    { id: "5d4b8e61-2c7f-4a90-8b3e-9c1f6a2d7e54", title: "Publicar en Vercel", project: "C:\\Users\\carlos\\Proyectos\\observatorio", started: "2026-11-12T19:00:00Z", lastActive: "2026-11-12T19:35:00Z", messages: 18, firstPrompt: "súbelo a Vercel con un dominio bonito", related: ["e6a3d9f2-8b4c-4e17-9a50-3d8b2f7c1a65"] },

    // ── recetario ──────────────────────────────────────────────
    { id: "a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76", title: "Estructura de la app de recetas", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-06T11:00:00Z", lastActive: "2026-10-06T13:22:00Z", messages: 52, firstPrompt: "app para guardar recetas de mi abuela con fotos" },
    { id: "f81b6d40-3c2e-4a79-8d15-0b7e9f4a6c87", title: "Escanear recetas a mano", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-11T09:30:00Z", lastActive: "2026-10-11T11:48:00Z", messages: 73, firstPrompt: "quiero hacer foto a una receta escrita a mano y que la pase a texto" },
    { id: "2c9e7a15-8d3f-4b06-a1e7-4f2c6b9d0e98", title: "Lista de la compra automática", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-10-18T17:10:00Z", lastActive: "2026-10-18T18:05:00Z", messages: 29, firstPrompt: "que al elegir recetas me saque la lista de la compra junta" },
    { id: "6e3d1b84-0a5c-4f72-9e38-1b6d4a8c2f09", title: "Arreglar fotos que no cargan", project: "C:\\Users\\carlos\\Proyectos\\recetario", started: "2026-11-02T20:15:00Z", lastActive: "2026-11-02T20:50:00Z", messages: 21, firstPrompt: "las fotos de las recetas viejas salen en blanco" },

    // ── torneo-ajedrez ─────────────────────────────────────────
    { id: "b4f8c2e7-1d6a-4e93-8f05-7c2a9e3b6d1a", title: "Cuadro de eliminatorias", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-03T16:00:00Z", lastActive: "2026-10-03T18:40:00Z", messages: 95, firstPrompt: "web para llevar el torneo del club con emparejamientos suizos" },
    { id: "7a2e5d93-4c1b-4f80-9d36-2e8b7a1c4f2b", title: "Desempates Buchholz", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-07T18:30:00Z", lastActive: "2026-10-07T19:55:00Z", messages: 44, firstPrompt: "añade desempate Buchholz y Sonneborn-Berger" },
    { id: "d1c6a8f4-9e2b-4d57-a3f0-8b4e1c7d2a3c", title: "Exportar a PDF para imprimir", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-14T17:45:00Z", lastActive: "2026-10-14T18:20:00Z", messages: 19, firstPrompt: "necesito imprimir la clasificación para pegarla en el club" },
    { id: "3f9b2d76-6a4e-4c18-8e91-5d3a7f0b2e4d", title: "Ranking Elo de socios", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-10-25T10:10:00Z", lastActive: "2026-10-25T12:44:00Z", messages: 67, firstPrompt: "calcula el Elo de cada socio con todas las partidas del año" },
    { id: "9c5e0a31-2b8d-4f6c-b7e4-0a9c3e5f1d5e", title: "Inscripciones con formulario", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-11-08T18:00:00Z", lastActive: "2026-11-08T19:12:00Z", messages: 33, firstPrompt: "formulario para que la gente se apunte al torneo de navidad" },
    { id: "e2a7f5c8-3d1e-4b90-8c62-1f7d4b9a3e6f", title: "Partidas en vivo", project: "C:\\Users\\carlos\\Proyectos\\torneo-ajedrez", started: "2026-11-15T16:30:00Z", lastActive: "2026-11-15T18:58:00Z", messages: 81, firstPrompt: "que se vean las partidas en directo con un tablero en la web", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10"] },

    // ── podcast-historia ───────────────────────────────────────
    { id: "0d8c4b62-7f3a-4e15-9a27-6c1e8d5b4f70", title: "Guion episodio 1: Roma", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-12T21:00:00Z", lastActive: "2026-10-12T22:15:00Z", messages: 26, firstPrompt: "guion de 10 minutos sobre la caída de Roma, tono cercano" },
    { id: "5b3f9e17-0c6d-4a82-8e49-3b7f2a6d5c81", title: "Voces y música de fondo", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-16T19:40:00Z", lastActive: "2026-10-16T21:30:00Z", messages: 58, firstPrompt: "busca música libre de derechos que pegue con historia antigua" },
    { id: "a6e1c3d9-8b4f-4c27-9f50-4e2b8c7a6d92", title: "Guion episodio 2: Bizancio", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-10-29T20:20:00Z", lastActive: "2026-10-29T21:05:00Z", messages: 22, firstPrompt: "segundo episodio, Bizancio, mismo formato que el anterior", related: ["0d8c4b62-7f3a-4e15-9a27-6c1e8d5b4f70"] },
    { id: "c7f2d8a4-1e9b-4d36-8a61-5f3c9d2b7ea3", title: "Portada y descripción", project: "C:\\Users\\carlos\\Proyectos\\podcast-historia", started: "2026-11-10T18:10:00Z", lastActive: "2026-11-10T18:52:00Z", messages: 15, firstPrompt: "texto para Spotify y una portada sobria" },

    // ── portfolio ──────────────────────────────────────────────
    { id: "e6a3d9f2-8b4c-4e17-9a50-3d8b2f7c1a65", title: "Portfolio personal", project: "C:\\Users\\carlos\\Proyectos\\portfolio", started: "2026-10-20T15:00:00Z", lastActive: "2026-10-20T17:35:00Z", messages: 70, firstPrompt: "web sencilla con mis proyectos, que parezca de revista" },
    { id: "1b7e4c95-2d8a-4f03-b6c1-9e4a7d3f2b76", title: "Fichas de cada proyecto", project: "C:\\Users\\carlos\\Proyectos\\portfolio", started: "2026-10-27T16:40:00Z", lastActive: "2026-10-27T17:58:00Z", messages: 38, firstPrompt: "una página por proyecto con capturas y lo que aprendí", related: ["b4f8c2e7-1d6a-4e93-8f05-7c2a9e3b6d1a", "a07f3c92-5e1d-4b68-9f24-6e3a8d0c5b76"] },
    { id: "8f0c5a26-4e3d-4b91-8d72-0a5f8e4c3d87", title: "Formulario de contacto", project: "C:\\Users\\carlos\\Proyectos\\portfolio", started: "2026-11-14T12:00:00Z", lastActive: "2026-11-14T12:40:00Z", messages: 17, firstPrompt: "que me llegue un correo cuando alguien escriba" },

    // ── bot-clima ──────────────────────────────────────────────
    { id: "3d6a0f84-5c2e-4a17-9b83-6d0a4f1e5b98", title: "Bot de Telegram del tiempo", project: "C:\\Users\\carlos\\Proyectos\\bot-clima", started: "2026-10-08T08:30:00Z", lastActive: "2026-10-08T10:15:00Z", messages: 49, firstPrompt: "bot que cada mañana me diga si va a llover" },
    { id: "f4b9e2c7-6d1a-4f58-8c94-7e1b5a2f6c09", title: "Avisos de tormenta", project: "C:\\Users\\carlos\\Proyectos\\bot-clima", started: "2026-10-23T07:50:00Z", lastActive: "2026-10-23T08:40:00Z", messages: 24, firstPrompt: "que avise si hay alerta naranja en mi zona" },
    { id: "2a5d8c13-7e0f-4b69-a1d5-8f2c6b3e7d1a", title: "Que arranque solo con el PC", project: "C:\\Users\\carlos\\Proyectos\\bot-clima", started: "2026-11-05T19:30:00Z", lastActive: "2026-11-05T20:05:00Z", messages: 20, firstPrompt: "quiero que el bot se encienda al encender el portátil" },

    // ── juego-plataformas ──────────────────────────────────────
    { id: "6c1f4a79-9b3e-4d20-8e15-2a7d9c4b8e2b", title: "Prototipo del salto", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-10-13T17:00:00Z", lastActive: "2026-10-13T19:44:00Z", messages: 102, firstPrompt: "juego de plataformas en el navegador, empecemos por el salto" },
    { id: "b8e3d0f5-1a6c-4e94-9d27-3b8e1f5c9a3c", title: "Niveles con editor", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-10-19T16:20:00Z", lastActive: "2026-10-19T18:50:00Z", messages: 77, firstPrompt: "un editor para dibujar los niveles con el ratón" },
    { id: "0f7a2c58-3e9d-4b16-8a40-4c9f2a6d0b4d", title: "Música chiptune", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-10-30T18:45:00Z", lastActive: "2026-10-30T19:30:00Z", messages: 31, firstPrompt: "música de 8 bits generada en el propio navegador", related: ["5b3f9e17-0c6d-4a82-8e49-3b7f2a6d5c81"] },
    { id: "4e2c9b61-8f5a-4d73-b0e6-5d1a3f7c2e5e", title: "Enemigos y vidas", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-11-09T17:15:00Z", lastActive: "2026-11-09T19:28:00Z", messages: 59, firstPrompt: "añade enemigos que patrullan y tres vidas" },
    { id: "d9a6e3b2-0c4f-4a85-9e61-6f2d8b4a3c6f", title: "Versión para móvil", project: "C:\\Users\\carlos\\Proyectos\\juego-plataformas", started: "2026-11-16T18:00:00Z", lastActive: "2026-11-16T19:46:00Z", messages: 46, firstPrompt: "botones táctiles para jugar en el móvil", related: ["1e7c5a28-9f0b-4c3d-b6e1-7a2d4c8f5b43"] },

    // ── carpeta personal ───────────────────────────────────────
    { id: "7b0e5f38-2d9c-4e61-a4f7-0e5b9d3c1f70", title: "Limpiar el escritorio", project: "C:\\Users\\carlos", started: "2026-10-05T12:00:00Z", lastActive: "2026-10-05T12:25:00Z", messages: 14, firstPrompt: "ordena las descargas por tipo de archivo" },
    { id: "c2d8a4f1-5e7b-4c30-8f96-1d4c7e0a5b81", title: "Copia de seguridad semanal", project: "C:\\Users\\carlos", started: "2026-10-17T10:40:00Z", lastActive: "2026-10-17T11:30:00Z", messages: 27, firstPrompt: "copia mis proyectos a un disco externo cada domingo" },
    { id: "5f3a1e96-7c2d-4b48-9e05-2f6a0c8d4e92", title: "Atajos de teclado", project: "C:\\Users\\carlos", started: "2026-11-01T21:10:00Z", lastActive: "2026-11-01T21:32:00Z", messages: 12, firstPrompt: "quiero abrir la terminal con un atajo" },
    { id: "9e4c7b02-3a8f-4d59-b1c6-7a3e2d9f5ba3", title: "Lanzador de sesiones", project: "C:\\Users\\carlos", started: "2026-11-17T17:00:00Z", lastActive: "2026-11-17T17:30:00Z", messages: 9, firstPrompt: "un lanzador más estético que la terminal, con las sesiones como estrellas", related: ["4f2a91c3-7d1e-4b8a-9c02-1e6b5d3a7f10", "5f3a1e96-7c2d-4b48-9e05-2f6a0c8d4e92"] }
  ]
};
