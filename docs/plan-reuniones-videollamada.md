# Plan de desarrollo · Reuniones con videollamada (LiveKit Cloud)

> **Cambio de proveedor (2026-11-20):** el usuario eligió **LiveKit Cloud** en lugar de Daily (Daily pide tarjeta; el plan Build de LiveKit no la pide y al pasar el tope corta en vez de cobrar). Aprobó las dependencias `livekit-client`, `@livekit/components-react` y `@livekit/components-styles`. Donde este plan diga "Daily", aplica la sección **2.1 (LiveKit)**. La columna `sala_url` guarda el **nombre de la sala** de LiveKit (no una URL).

Rama: `feature/reuniones-videollamada` (creada desde `develop`). **No hagas commit, push ni merge.** Al terminar cada fase deja los cambios en el working tree.

Documentos que debes leer antes de empezar:
1. `AGENTS.md` completo (reglas del proyecto; ganan sobre tu memoria).
2. `docs/diseno-reuniones-videollamada.md` (brief de pantallas).
3. `docs/diseno-reuniones-spec.md` (especificación visual extraída del diseño: medidas, textos y diferencias por dispositivo). **Para la UI manda esta spec.**
4. Este plan.

Reglas que no se negocian:
- Next.js de este repo tiene cambios respecto a lo que conoces: antes de escribir rutas, layouts o Server Actions lee la guía en `node_modules/next/dist/docs/`.
- Route Handlers y Server Actions delgados: sesión → Zod → autorización → service. Prisma solo en `src/server/services` (o `src/server/video` para nada: ahí no hay Prisma).
- Sin dependencias nuevas. Daily se usa con `fetch` y un `<iframe>`.
- Sin textos de ayuda ni párrafos explicativos en la UI (AGENTS.md §9).
- No uses `useMemo`, `useCallback` ni `React.memo` si `next.config.ts` tiene el React Compiler activado (revísalo).
- Fechas: se guardan en UTC y se muestran en America/Lima con `src/lib/formato-fecha.ts` y `src/lib/calendario.ts`.
- Al final de **cada fase**: `npx tsc --noEmit` y `npm run lint` sin errores.
- Si algo de este plan no se puede hacer como está escrito (una API de Daily que no se comporta como se describe, un archivo que no existe), **detente y repórtalo**; no inventes una alternativa.

---

## 0. Resumen funcional

- Una reunión puede ser **videollamada en EduControl** (`videollamada = true`): el servidor crea una sala privada en Daily y cada integrante entra con un permiso (meeting token) que el servidor emite al pulsar **Unirse**.
- **Reunirse ahora**: crea en un clic una reunión que empieza ahora y dura 1 h, y lleva a la sala. Solo una reunión activa por grupo: si ya hay una, se entra a esa.
- **Sala**: se abre 10 min antes del inicio y se cierra 15 min después del fin (saca a todos). Aviso visual en los últimos 5 min.
- **Asistencia real**: se guarda la hora en que cada integrante pulsó Unirse por primera vez.
- **Avisos**: `reunion_iniciada` cuando entra la primera persona; `reunion_finalizada` cuando se finaliza (botón o cierre automático). Ambos por Bandeja y correo.
- **Observadores**: ven reuniones, no entran a la llamada, no tienen Unirse ni Reunirse ahora.
- **Moderadores** (`is_owner` en Daily y botón "Finalizar para todos"): el líder y quien creó la reunión.
- Las reuniones con **enlace manual** siguen funcionando como hoy.

Estados (calculados, nunca guardados), en `src/lib/estado-reunion.ts`:

| Estado | Condición (ahora = `ahora`) |
|---|---|
| `terminada` | `finalizadaEn != null` **o** `ahora >= cierre` |
| `programada` | `ahora < apertura` |
| `por_cerrar` | `ahora >= cierre - 5 min` |
| `en_curso` | `iniciadaEn != null` |
| `sala_abierta` | resto (ventana abierta, nadie entró) |

Con `apertura = inicio - 10 min` y `cierre = fin + 15 min`. Para reuniones **sin** videollamada solo existen `programada` (antes de `fin`) y `terminada` (desde `fin`).

---

## Fase 1 · Datos, configuración y reglas puras

### 1.1 Prisma (`prisma/schema.prisma`)

En `model Reunion` agrega:

```prisma
  videollamada  Boolean   @default(false)
  salaUrl       String?   @map("sala_url")
  iniciadaEn    DateTime? @map("iniciada_en")
  finalizadaEn  DateTime? @map("finalizada_en")
  idFinalizador Int?      @map("id_finalizador")

  finalizador Usuario? @relation("ReunionFinalizador", fields: [idFinalizador], references: [idUsuario])
```

En `model ReunionAsistente` agrega:

```prisma
  fechaEntrada DateTime? @map("fecha_entrada")
```

En `model Usuario` agrega la relación inversa `reunionesFinalizadas Reunion[] @relation("ReunionFinalizador")` (mira cómo está declarada `ReunionCreador`).

En `enum TipoNotificacion` agrega `reunion_iniciada` y `reunion_finalizada`.

Crea la migración: `npx prisma migrate dev --name reuniones_videollamada` (solo local; requiere `docker compose up -d`). Luego `npx prisma generate`.

Actualiza `docs/educontrol.dbml` en el mismo cambio (tabla de reunión, de asistentes y el enum), con los nombres snake_case.

### 1.2 Variables de entorno

`src/lib/env.ts`:
- `VIDEO_PROVIDER: z.enum(["simulado", "livekit"]).default("simulado")`
- `LIVEKIT_URL: z.string().startsWith("wss://").optional()` (es pública: el navegador se conecta a ella)
- `LIVEKIT_API_KEY: z.string().min(1).optional()`, `LIVEKIT_API_SECRET: z.string().min(1).optional()`
- En el `superRefine`: si `VIDEO_PROVIDER === "livekit"`, exige las tres ("Falta LIVEKIT_URL para usar LiveKit", etc.).
- Agrégalas al objeto de `schema.parse`.

`.env.example`: documenta `VIDEO_PROVIDER=simulado`, `LIVEKIT_URL=`, `LIVEKIT_API_KEY=` y `LIVEKIT_API_SECRET=` con un comentario corto (sin valores reales).

`render.yaml`: en `envVars` agrega `VIDEO_PROVIDER` con `value: livekit` y las tres de LiveKit con `sync: false`.

### 1.3 Política de notificaciones (`src/server/notifications/eventos.ts`)

```ts
  // Aprobado por el usuario (2026-11-20): aviso y correo al iniciar y al terminar una videollamada.
  reunion_iniciada: { correo: true, actividad: false },
  reunion_finalizada: { correo: true, actividad: true },
```

### 1.4 Plantillas (`src/server/notifications/templates.ts`)

- Cambia el `enlace` de `reunionProgramada` a `/reuniones/${idReunion}`.
- Agrega:
  - `reunionIniciada(persona, titulo, nombreGrupo, idReunion, desde, hasta)` → mensaje `${persona} inició "${titulo}" en "${nombreGrupo}", ${desde} - ${hasta}.`, enlace `/reuniones/${idReunion}`, asunto `${persona} inició una reunión en ${nombreGrupo}`.
  - `reunionFinalizada(titulo, nombreGrupo, idReunion, duracion, entraron, finalizador | null)` → mensaje `Terminó "${titulo}" en "${nombreGrupo}". Duró ${duracion}; entraron ${entraron}.` + (finalizador ? ` La finalizó ${finalizador}.` : ` Se cerró automáticamente.`), enlace `/reuniones/${idReunion}`, asunto `Terminó la reunión ${titulo}`.
  - El formato de horas y duración debe salir de `src/lib/formato-fecha.ts` / `src/lib/tiempos-tarea.ts` (reutiliza el formateador de duraciones `45 min`, `1 h 20 min` si existe; si no, crea uno pequeño en `estado-reunion.ts`).

### 1.5 Bandeja (`src/lib/bandeja.ts`)

- Agrega los dos tipos a `TipoBandeja` y a `TITULOS`: `reunion_iniciada: "Reunión iniciada"`, `reunion_finalizada: "Reunión terminada"`.
- En el `switch` de resumen, extrae `objeto` (el título de la reunión: la primera cita del mensaje) y `persona` (para `reunion_iniciada`, el texto antes de " inició").

### 1.6 Reglas puras (`src/lib/estado-reunion.ts`, nuevo, sin Prisma ni Next)

Exporta:
- Constantes `APERTURA_MIN = 10`, `CIERRE_MIN = 15`, `AVISO_CIERRE_MIN = 5`, `DURACION_INMEDIATA_MIN = 60`.
- `ventanaSala(inicio: Date, fin: Date): { apertura: Date; cierre: Date }`.
- `estadoReunion(r: { inicio: Date; fin: Date; videollamada: boolean; iniciadaEn: Date | null; finalizadaEn: Date | null }, ahora: Date): "programada" | "sala_abierta" | "en_curso" | "por_cerrar" | "terminada"` según la tabla de la sección 0.
- `salaAbierta(estado)` → `true` para `sala_abierta | en_curso | por_cerrar`.
- `minutosHasta(fecha: Date, ahora: Date): number` (redondeo hacia arriba, mínimo 0).
- `etiquetaEstado(estado, r, ahora)` → "Empieza en 25 min" / "Sala abierta" / "En curso" / "Cierra en 4 min" / "Terminada" (textos exactos de la spec).

### 1.7 Color de reunión único (`src/app/globals.css`)

El fucsia actual se confunde con el violeta de "En revisión" y de las evaluaciones. Reunión pasa a **cian**, que ya usa el Calendario (`--cal-reunion`). Cambia solo estos valores:

Tema claro:
```css
  --cat-reunion: #0891b2;
  --cat-reunion-bg: #ecfeff;
  --cat-reunion-fg: #0e7490;
  --cat-reunion-borde: #a5f3fc;
```
Tema oscuro (`.dark`):
```css
  --cat-reunion: #22d3ee;
  --cat-reunion-bg: #083344;
  --cat-reunion-fg: #a5f3fc;
  --cat-reunion-borde: #155e75;
```
`--cal-reunion` queda igual (`#0891b2` / `#22d3ee`). En la spec de diseño los tokens `reunion`, `reunion-soft` y `reunion-fg` equivalen a `cat-reunion`, `cat-reunion-bg` y `cat-reunion-fg`. **Todo** lo que el diseño pinta en morado para reuniones (punto "En curso", pulso, franja, etiqueta "Sala abierta", ícono de video) usa estos tokens. El pulso de la spec usa `rgba(...)` del morado: tradúcelo a `color-mix(in oklab, var(--cat-reunion) 50%, transparent)` dentro de un `@keyframes` en `globals.css`, y detén la animación con `prefers-reduced-motion`.

### 1.8 AGENTS.md

Actualiza en el mismo cambio:
- §3 fila "Reuniones": agrega "con videollamada propia (Daily, incrustada) y 'Reunirse ahora' (aprobado 2026-11-20)".
- §4 tabla: fila "Videollamadas | Daily (REST + iframe de Daily Prebuilt) detrás de `ProveedorVideo` configurable por entorno (ver 8.7)".
- §7 tabla `reunion`: menciona `videollamada`, `sala_url`, `iniciada_en`, `finalizada_en`, `id_finalizador`; `reunion_asistente`: `fecha_entrada`.
- §8.6 tabla de eventos: filas `reunion_iniciada` (integrantes aceptados no observadores menos quien entró primero, correo sí) y `reunion_finalizada` (integrantes aceptados no observadores menos quien finalizó, correo sí, silenciable con `correo_actividad`).
- §8.7: reglas de la sección 0 de este plan (ventana, Reunirse ahora, moderadores, observadores fuera de la llamada, asistencia real como dato sin ranking, sin grabación).
- §9: "Color de reunión: cian (`cat-reunion`), distinto del violeta de En revisión."
- §11 variables: `VIDEO_PROVIDER` (`simulado` | `daily`) y `DAILY_API_KEY`.

**Fin de fase 1:** `npx tsc --noEmit`, `npm run lint`.

---

## Fase 2 · Proveedor de video, servicio y acciones

### 2.1-LiveKit · Proveedor real (reemplaza a la parte de Daily de 2.1)

Instala: `npm install livekit-client @livekit/components-react @livekit/components-styles` (aprobadas por el usuario). **No** instales `livekit-server-sdk`: los tokens se firman con `jose`, que ya está en el proyecto.

**Verifica primero en la documentación** (context7 o WebFetch sobre `docs.livekit.io`, en particular https://docs.livekit.io/frontends/reference/tokens-grants.md y la referencia de RoomService) y reporta con URLs:
- (a) formato del access token: algoritmo (HS256), `iss` = API key, `sub` = identidad, `name`, `nbf`, `exp` y el claim `video` (`room`, `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`, `roomAdmin`);
- (b) que la sala se crea sola al entrar, y cómo crearla antes con `CreateRoom` (`emptyTimeout`, `maxParticipants`) por HTTP (Twirp: `POST {host https}/twirp/livekit.RoomService/CreateRoom`);
- (c) `DeleteRoom` por HTTP saca a todos, y qué permiso necesita el token de servidor (`roomCreate`);
- (d) qué props tienen `PreJoin`, `LiveKitRoom` y `VideoConference` para poner los textos **en español**.

Si algo no se confirma, detente y repórtalo.

Interfaz (`src/server/video/proveedor-video.ts`), en lugar de la de 2.1:
```ts
export type CredencialesSala =
  | { tipo: "livekit"; serverUrl: string; token: string }
  | { tipo: "simulado" };

export interface ProveedorVideo {
  /** Prepara la sala. Devuelve el identificador que se guarda en `reunion.sala_url`. */
  crearSala(datos: { nombre: string; abre: Date; cierra: Date }): Promise<string>;
  credencialesDeEntrada(datos: { sala: string; idUsuario: number; nombre: string; moderador: boolean; abre: Date; cierra: Date }): Promise<CredencialesSala>;
  /** Saca a todos y cierra la sala ya. No falla si no existe. */
  cerrarSala(sala: string): Promise<void>;
  /** Igual que cerrarSala (reunión cancelada). */
  borrarSala(sala: string): Promise<void>;
}
```

`livekit-proveedor.ts`:
- `crearSala`: `CreateRoom` con `{ name, emptyTimeout: 600, maxParticipants: 20 }` y devuelve `name`. Esto confirma las credenciales al programar (si falla, `ErrorDeNegocio("No se pudo crear la videollamada.")`).
- `credencialesDeEntrada`: firma con `jose` (`new SignJWT(...).setProtectedHeader({ alg: "HS256" })`) un token con `iss = LIVEKIT_API_KEY`, `sub = String(idUsuario)`, `name = nombre`, `nbf = abre`, `exp = cierra` y `video: { room: sala, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, roomAdmin: moderador }`. Devuelve `{ tipo: "livekit", serverUrl: env.LIVEKIT_URL, token }`.
- `cerrarSala` / `borrarSala`: `DeleteRoom` con `{ room: sala }`; trata "no existe" como éxito.
- Token de servidor para la API: JWT HS256 de vida corta (60 s) con `video: { roomCreate: true }` o lo que la documentación indique. El host HTTP sale de `LIVEKIT_URL` cambiando `wss://` por `https://`.
- Nunca registres el secreto ni los tokens.

`simulado-proveedor.ts`: `crearSala` devuelve el nombre; `credencialesDeEntrada` devuelve `{ tipo: "simulado" }`; `cerrarSala`/`borrarSala` registran en consola.

Cliente de la sala (Fase 3.7): un componente `"use client"` que importa `@livekit/components-styles` y usa `PreJoin` (con textos en español) y luego `LiveKitRoom` (`serverUrl`, `token`, `connect`, `audio`/`video` según lo elegido en `PreJoin`) con `VideoConference` dentro. `onDisconnected` → navegar a `/reuniones/${id}`. Si la conexión falla → pantalla de error de la spec. Con `tipo: "simulado"`, el bloque gris "Videollamada simulada". Los textos de LiveKit que no se puedan traducir por props se reportan; no los parches con CSS.

"Abrir en pestaña nueva" (decisión del usuario, se conserva): abre `/reuniones/${id}/sala` en una pestaña nueva y navega la actual a `/reuniones/${id}` (así la persona no queda conectada dos veces).

### 2.1 `src/server/video/` (nuevo, mismo patrón que `src/server/email/`) — *versión Daily, ya no aplica salvo el patrón de archivos y el simulado*

Lee `src/server/email/email-sender.ts`, `index.ts` y sus implementaciones, y repite la forma.

`proveedor-video.ts`:
```ts
export interface SalaCreada { url: string }
export interface ProveedorVideo {
  crearSala(datos: { nombre: string; abre: Date; cierra: Date }): Promise<SalaCreada>;
  /** Permiso de entrada para una persona. Devuelve la URL lista para el iframe. */
  urlDeEntrada(datos: { salaUrl: string; idUsuario: number; nombre: string; moderador: boolean; abre: Date; cierra: Date }): Promise<string>;
  /** Saca a todos y cierra la sala ya. No falla si la sala no existe. */
  cerrarSala(salaUrl: string): Promise<void>;
  /** Borra la sala (reunión cancelada). No falla si no existe. */
  borrarSala(salaUrl: string): Promise<void>;
}
```

`daily-proveedor.ts` (`fetch` a `https://api.daily.co/v1`, header `Authorization: Bearer ${env.DAILY_API_KEY}`, `Content-Type: application/json`):
- `crearSala`: `POST /rooms` con `{ name, privacy: "private", properties: { nbf, exp, eject_at_room_exp: true, max_participants: 20, enable_prejoin_ui: true } }` (`nbf`/`exp` en segundos Unix). Devuelve `url` de la respuesta.
- `urlDeEntrada`: `POST /meeting-tokens` con `{ properties: { room_name, user_name: nombre, user_id: String(idUsuario), is_owner: moderador, nbf, exp, eject_at_token_exp: true } }`. Devuelve `${salaUrl}?t=${token}`.
- `cerrarSala`: `POST /rooms/{name}` con `{ properties: { exp: <ahora + 5 s>, eject_at_room_exp: true } }`.
- `borrarSala`: `DELETE /rooms/{name}`; trata 404 como éxito.
- `name` = último segmento de `salaUrl`.
- Si la respuesta no es `ok`, lanza `ErrorDeNegocio("No se pudo crear la videollamada.")` (o el texto que corresponda), **sin** incluir la respuesta de Daily en el mensaje. Registra en consola solo el código HTTP, nunca la clave.
- **Verifica antes de implementar** en la documentación de Daily (usa la herramienta context7 o WebFetch sobre docs.daily.co): (a) que la URL con `?t=<token>` hace entrar a una sala privada en Daily Prebuilt; (b) que actualizar `exp` con `eject_at_room_exp` saca a los participantes; (c) los nombres exactos de las propiedades usadas. Si alguna no se cumple, detente y repórtalo.

`simulado-proveedor.ts` (desarrollo sin clave): no llama a nada; `crearSala` devuelve `https://simulado.invalid/${nombre}`; `urlDeEntrada` devuelve `salaUrl`; `cerrarSala`/`borrarSala` registran en consola. La página de sala detecta el host `simulado.invalid` y muestra un bloque gris con el texto "Videollamada simulada" en lugar del iframe.

`index.ts`: exporta `proveedorVideo` según `env.VIDEO_PROVIDER`.

### 2.2 Servicio (`src/server/services/reunion.ts`)

Mantén las funciones actuales y su comportamiento. Cambios y funciones nuevas:

**Helpers internos**
- `esModerador(reunion, integrante)` → `integrante.rol === "lider" || reunion.idCreador === integrante.idUsuario`.
- `nombreSala(idReunion)` → `ec-${idReunion}-${randomBytes(4).toString("hex")}` (`node:crypto`).
- `participantesDe(idGrupo)` → aceptados no observadores (ya existe la consulta en `crearReunion`; extráela).

**`crearReunion(idUsuario, idGrupo, datos)`** — `datos` gana `videollamada: boolean` (ver Zod en 2.3).
- Si `videollamada` es `false`: igual que hoy.
- Si es `true`, dentro de `prisma.$transaction(async (tx) => …, { timeout: 15000 })`:
  1. crear la reunión con asistentes (como hoy) con `videollamada: true`, `enlace: null`;
  2. `const sala = await proveedorVideo.crearSala({ nombre: nombreSala(id), abre: apertura, cierra: cierre })`;
  3. `tx.reunion.update({ salaUrl: sala.url })`.
  Si el paso 2 falla, la transacción se revierte sola. Si la transacción falla **después** del paso 2, en el `catch` llama a `proveedorVideo.borrarSala(sala.url)` y relanza.
- Las notificaciones `reunion_programada` se envían **después** del commit (como hoy).

**`reunirseAhora(idUsuario, idGrupo): Promise<{ idReunion: number; yaExistia: boolean; iniciador: string | null }>`**
- `requerirParticipante` + grupo activo.
- En una transacción con `timeout: 15000`:
  1. `await tx.$executeRaw\`SELECT pg_advisory_xact_lock(4247, ${idGrupo})\`` (serializa por grupo; dos clics simultáneos no crean dos reuniones);
  2. buscar una reunión del grupo con `videollamada: true`, `finalizadaEn: null`, `inicio <= ahora + 10 min` y `fin + 15 min > ahora` (calcula con `ventanaSala`; la condición en SQL: `inicio: { lte: ahora+10min }, fin: { gt: ahora-15min }`). Si existe → devuelve `{ idReunion, yaExistia: true, iniciador: nombre de quien entró primero o del creador }`;
  3. si no existe: crea la reunión con `titulo: "Reunión de ${grupo.nombre}"` (recorta a 120), `inicio: ahora` (sin segundos), `fin: inicio + 60 min`, asistentes como en `crearReunion`, y crea la sala como en `crearReunion`.
- **No** envía `reunion_programada` (el aviso será `reunion_iniciada` cuando entre la primera persona, que es quien la creó).

**`registrarEntrada(idUsuario, idReunion)`** (lo usa la acción Unirse)
- Carga la reunión; si no existe → `ErrorDeNegocio("Esa reunión ya no existe")`.
- `requerirParticipante` (observadores quedan fuera) y grupo… (no exijas grupo activo: una reunión ya creada puede usarse).
- Si `!videollamada` → error. Calcula el estado; si no `salaAbierta(estado)` → `ErrorDeNegocio("La sala no está abierta")`.
- `upsert` de `reunionAsistente` poniendo `fechaEntrada` **solo si es null** (usa `updateMany({ where: { idReunion, idUsuario, fechaEntrada: null } })` tras asegurar la fila con `upsert` sin tocar `fechaEntrada`).
- Marca el inicio de forma atómica: `const { count } = await prisma.reunion.updateMany({ where: { idReunion, iniciadaEn: null }, data: { iniciadaEn: new Date() } })`. Si `count === 1`, envía `reunion_iniciada` a los participantes **menos** `idUsuario`.

**`datosDeSala(idUsuario, idReunion)`** (lo usa la página de sala)
- Verifica participante y que la sala esté abierta; si no, devuelve `{ estado }` sin URL.
- Si `fechaEntrada` del usuario es null → devuelve `{ requiereUnirse: true }` (la página redirige al detalle).
- Devuelve `{ estado, url: await proveedorVideo.urlDeEntrada(...), cierre, moderador, titulo, grupo }`.

**`finalizarReunion(idUsuario, idReunion)`**
- Participante + `esModerador`; si no → `ErrorDeNegocio("Solo el líder o quien creó la reunión puede finalizarla")`.
- `updateMany({ where: { idReunion, finalizadaEn: null }, data: { finalizadaEn: now, idFinalizador: idUsuario } })`. Si `count === 1`: `await proveedorVideo.cerrarSala(salaUrl)` (si falla, regístralo y sigue: la sala vence sola) y, si `iniciadaEn != null`, envía `reunion_finalizada` a los participantes menos `idUsuario`.

**`cerrarReunionesVencidas(idsGrupo: number[])`** (cierre perezoso; no hay cron)
- Busca reuniones con `videollamada: true`, `finalizadaEn: null` y `fin < ahora - 15 min` en esos grupos.
- Para cada una: `updateMany` con `finalizadaEn: null` → `finalizadaEn: cierre` (no `now`). Si `count === 1` e `iniciadaEn != null`, envía `reunion_finalizada` a todos los participantes (sin finalizador: "Se cerró automáticamente").
- Llámala al inicio de `listarMisReuniones`, del detalle y de `reunionesDelGrupoEntre`. Es idempotente: dos pestañas no duplican avisos.

**`cerrarSiVencio(idUsuario, idReunion)`** — la página de sala la llama cuando el contador llega a cero; valida participante y delega en la misma lógica de `cerrarReunionesVencidas` para esa reunión.

**`cancelarReunion`**: tras borrar la fila, si tenía `salaUrl`, `await proveedorVideo.borrarSala(salaUrl)` dentro de `try/catch` (si falla, regístralo; la sala vence sola).

**Lecturas**
- `listarMisReuniones`: incluye `videollamada`, `salaUrl` (no la expongas al cliente: solo `tieneSala: boolean`), `iniciadaEn`, `finalizadaEn`, `finalizador { nombre }` y en asistentes `fechaEntrada`. Agrega una lista `enCurso` (estado `sala_abierta | en_curso | por_cerrar`) aparte de `proximas` y `pasadas`; una reunión finalizada antes de su `fin` va a `pasadas`.
- `obtenerReunion(idUsuario, idReunion)` (nuevo, para el detalle): integrante aceptado de su grupo (observadores incluidos) o `null`. Devuelve reunión, grupo, rol del usuario, `moderador`, asistentes con respuesta y `fechaEntrada`, y el estado calculado.
- `reunionEnCursoDelGrupo(idUsuario, idGrupo)` → la reunión activa del grupo (para la franja y el botón "Unirse a la reunión en curso") o `null`.
- **Nunca** envíes `salaUrl` ni tokens a componentes de cliente fuera de la página de sala.

### 2.3 Validación (`src/lib/validation/reunion.ts`)

- `crearReunionSchema` gana `videollamada` (el checkbox llega como `"on"` o ausente: `z.preprocess((v) => v === "on" || v === true, z.boolean())`). Si `videollamada` es `true`, ignora `enlace`.
- `idReunionSchema = z.coerce.number().int().positive()` y `idGrupoSchema` igual, para las acciones nuevas.

### 2.4 Acciones (`src/app/(app)/reuniones/actions.ts`)

- `crearReunionAction`: pasa `videollamada`. Si el error es de la sala, redirige al formulario con `error=No se pudo crear la videollamada.` y conserva lo escrito (usa los parámetros que ya maneja la página o agrega `sala=error`; revisa la spec, pantalla P4 error).
- `reunirseAhoraAction(idGrupo)`: llama a `reunirseAhora`, luego a `registrarEntrada`, y redirige a `/reuniones/${id}/sala` (con `?ya=1` si `yaExistia`, para el toast "{Nombre} ya había iniciado la reunión").
- `unirseReunionAction(idReunion)`: `registrarEntrada` → redirige a `/reuniones/${id}/sala`. En error, vuelve al detalle con `error`.
- `finalizarReunionAction(idReunion)`: `finalizarReunion` → redirige a `/reuniones/${id}` con `toast=Reunión finalizada`.
- `cerrarSiVencioAction(idReunion)`: llamada desde el cliente de la sala al llegar a cero; devuelve `void` y la página navega al detalle.
- Todas: `revalidatePath("/reuniones")`, `revalidatePath(`/reuniones/${id}`)`, `revalidatePath(`/grupos/${idGrupo}`, "layout")` y `revalidatePath("/calendario")` donde aplique.
- Las redirecciones existentes a `/reuniones#reunion-…` pasan a `/reuniones/${id}`.

### 2.5 Acceso por ruta (`src/server/auth/acceso-rutas.ts`)

Agrega a `RUTAS` **antes** de cualquier patrón genérico:
```ts
{ patron: /^\/reuniones\/(\d+)(?:\/sala)?\/?$/, tipo: "reunion" },
```
(`\d+` evita que `/reuniones/nueva` dé 404.) En el `switch`: `true` si el usuario es integrante `aceptada` del grupo de esa reunión. Revisa en `src/proxy.ts` que el `matcher` cubra `/reuniones/...`.

**Fin de fase 2:** `npx tsc --noEmit`, `npm run lint`, y prueba manual con `VIDEO_PROVIDER=simulado`: crear reunión con videollamada, Reunirse ahora dos veces seguidas (la segunda entra a la misma), finalizar, cancelar.

---

## Fase 3 · Pantallas

La forma visual, los textos, las medidas y las variantes de escritorio, tablet y móvil están en `docs/diseno-reuniones-spec.md`. Responsividad de la app: móvil < 768 px (`useEsMovil`, barra inferior, `EncabezadoMovil`, hojas inferiores, objetivos de 44 px, FAB solo en el grupo), tablet `md` (riel de 80 px) y escritorio `lg`. Reutiliza los componentes existentes (`Avatar`, `Button`, `Toast`, `BotonConfirmacion`, `SubmitButton`, `MarcoGrupo`, `VolverMovil`, `EncabezadoMovil`). Íconos: lucide-react.

### 3.1 Componentes reutilizables (`src/components/ui-app/reuniones/`)

Según la spec: `PuntoEnCurso` (pulso), `EstadoReunion` (chip por estado, tamaños normal y grande, variante "por cerrar" en ámbar `--hoy`/`estado-en-progreso` según la spec), `BotonUnirse` (formulario con `unirseReunionAction`; tamaños s/m/l/táctil; deshabilitado con `aria-disabled` si la sala no abre; estado "Creando sala…" usando `useFormStatus`), `BotonReunirseAhora` (formulario con `reunirseAhoraAction`; muta a "Unirse a la reunión en curso" si recibe `enCurso`), `FranjaEnCurso` y `FilaReunion`.

Todo lo que dependa de la hora actual en cliente (contador "Cierra en 4 min", "Empieza en 25 min") se recalcula con un intervalo de 30 s en un componente cliente pequeño; el servidor envía las fechas en ISO.

### 3.2 P1 · Pestaña Reuniones del grupo (`src/app/(app)/grupos/[id]/reuniones/page.tsx`)

- Acción principal doble en `MarcoGrupo` (`accionPrincipal`): `BotonReunirseAhora` + "Programar reunión" (enlace actual). Solo líder/miembro y grupo activo.
- Sección **En curso** arriba (si hay), luego Próximas y Pasadas con `FilaReunion`. Las filas enlazan a `/reuniones/${id}`.
- Pasadas: "{n} entraron" en lugar de "X de Y asistirán" cuando es videollamada.
- **Sin franja** en esta pestaña (decisión del usuario).
- Estado vacío según la spec (R-W05).
- Móvil: el FAB del grupo en esta pestaña es "Reunirse ahora" (revisa cómo se declara el FAB hoy en el grupo).

### 3.3 P2 · Franja en curso (`MarcoGrupo`)

En `src/app/(app)/grupos/[id]/_components/marco-grupo.tsx`, si `reunionEnCursoDelGrupo` devuelve algo y `activa !== "reuniones"`, muestra `FranjaEnCurso` bajo el encabezado del grupo. Observadores: sin botón. Obtén el dato en el servidor (las páginas de pestaña ya cargan `datos`; agrega la consulta donde se arma `datos` o en `MarcoGrupo` si es server component; revisa cuál es).

### 3.4 P3 · Módulo Reuniones (`src/app/(app)/reuniones/page.tsx`)

- Sección **En curso** arriba (todas mis reuniones activas) con `BotonUnirse`.
- Junto a "Programar reunión", `BotonReunirseAhora`: si tengo un solo grupo posible, actúa directo; con varios, abre el selector de grupo (P7a, `Dialog` en escritorio y hoja inferior en móvil, según la spec R-W07 / R-M05).
- Tarjetas: estado junto al horario; "Unirse" en lugar de "Abrir enlace" si es videollamada; toda la tarjeta enlaza al detalle; Anteriores con "{n} entraron".

### 3.5 P4 · Formulario (`src/app/(app)/reuniones/nueva/formulario-reunion.tsx` y `page.tsx`)

- Interruptor "Videollamada en EduControl" activado por defecto (`name="videollamada"`), antes de Lugar/Enlace. Activado: se oculta Enlace. Usa el `Switch` de shadcn si existe en `src/components/ui`; si no, un checkbox con estilo de interruptor (sin dependencia nueva).
- Error de sala (R-W13 / R-M07): mensaje en línea "No se pudo crear la videollamada." con **Reintentar** (reenvía) y **Usar un enlace propio** (apaga el interruptor y enfoca Enlace). Conserva los valores escritos.

### 3.6 P5 · Detalle (`src/app/(app)/reuniones/[id]/page.tsx`, nuevo)

- `notFound()` si `obtenerReunion` devuelve `null` o el id no es entero.
- `generateMetadata` con el título de la reunión (`%s · EduControl` lo aplica el layout).
- Migas: Reuniones › {Grupo} › {Título} (mira cómo registran migas otras páginas: `MigasProvider`).
- Bloque de estado según los cuatro estados de la spec (R-W08…R-W11, R-T03, R-M08…R-M11). En móvil, `BotonUnirse` fijo abajo mientras la sala esté abierta.
- Asistencia: antes de empezar, Asistiré / No asistiré (reusa `responderReunionAction`); después, listas "Confirmaron" y "Entraron" (con hora de entrada, `formatoHora`). Sin porcentajes ni rojo.
- Acciones: Cancelar (quien la creó o el líder, solo `programada`/`sala_abierta` sin `iniciadaEn`) y Finalizar para todos (moderador, `en_curso`/`por_cerrar`), con `BotonConfirmacion` o el diálogo de la spec.

### 3.7 P6 · Sala (pantalla completa, sin barra lateral ni barra inferior)

Ruta `/reuniones/[id]/sala` **fuera** del layout `(app)`: crea el grupo de rutas `src/app/(sala)/reuniones/[id]/sala/page.tsx` con su propio `layout.tsx` mínimo (llama a `requerirSesion`; nada de sidebar). Antes, confirma en `node_modules/next/dist/docs/` que dos grupos de rutas pueden compartir el segmento `reuniones` sin conflicto (el detalle vive en `(app)/reuniones/[id]/page.tsx` y la sala en `(sala)/reuniones/[id]/sala/page.tsx`). Si hay conflicto, detente y repórtalo.

- Server: `datosDeSala`. Si `requiereUnirse` → `redirect(`/reuniones/${id}`)`. Estados sin URL → pantallas R-W18 / R-M15…R-M18 (aún no abre, terminada, error).
- Barra superior según la spec (R-W14…R-W17, R-T04, R-M12…R-M14): volver, título, grupo, `EstadoReunion` con "Cierra en N min", "Abrir en pestaña nueva" (`<a target="_blank" rel="noopener noreferrer">` a la misma URL de entrada), "Finalizar para todos" (solo moderador; diálogo de confirmación) y "Salir" (enlace al detalle).
- `<iframe src={url} allow="camera; microphone; autoplay; display-capture; fullscreen" className="…" title="Videollamada" />` ocupando el resto de la pantalla. Con el proveedor simulado, el bloque gris "Videollamada simulada".
- Componente cliente con el contador: a los 5 min cambia a la variante "por cerrar"; al llegar a cero llama `cerrarSiVencioAction` y navega a `/reuniones/${id}`.
- Toast "{Nombre} ya había iniciado la reunión" si llega `?ya=1` (reusa `Toast`).
- No agregues cabeceras CSP; hoy no hay ninguna que bloquee el iframe.

### 3.8 P10 · Calendario

En `src/app/(app)/calendario/_components/eventos.ts` e `items.ts`: los eventos de reunión enlazan a `/reuniones/${id}`, llevan el ícono `Video` si es videollamada y el punto `PuntoEnCurso` si está en curso. Necesitarás `videollamada`, `iniciadaEn` y `finalizadaEn` en `reunionesDelUsuarioEntre`.

**Fin de fase 3:** `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## Fase 4 · Bandeja y correos

- `src/app/(app)/notificaciones/_components/detalles.tsx`: paneles para `reunion_iniciada` (quién la inició, desde/hasta, `BotonUnirse` o "Ya terminó") y `reunion_finalizada` (duración, quiénes entraron con avatares, quién la finalizó o "Cerrada automáticamente", botón "Ver detalle"), según R-W19/R-W20 y R-M19/R-M20. Mira cómo el panel de `reunion_programada` obtiene los datos de la reunión desde el `enlace` y repite el patrón (el enlace nuevo es `/reuniones/{id}`; conserva compatibilidad con el formato antiguo `?reunion=`).
- Correos: el `EmailSender` ya arma el correo con `cuerpo` + botón a `APP_URL + enlace`. Revisa si la plantilla permite cambiar el texto del botón; si sí, usa "Unirse a la reunión" para `reunion_iniciada` y "Ver detalle" para `reunion_finalizada`. En el cuerpo, las fechas en formato completo (`fechaCompleta`).

**Fin de fase 4:** `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## Fase 5 · Verificación final

1. `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Con `VIDEO_PROVIDER=simulado` y el seed: recorrer como líder, miembro y observador:
   - programar con y sin videollamada;
   - Reunirse ahora (y un segundo intento que entra a la misma);
   - franja en Tareas pero no en Reuniones;
   - detalle en sus cuatro estados (ajusta horas a mano en la base si hace falta);
   - sala, finalizar y cancelar;
   - avisos en la Bandeja y correo en consola;
   - observador sin botones y con 404 en `/reuniones/{id}/sala`;
   - un no integrante recibe 404 en `/reuniones/{id}`.
3. Si `prisma/seed.ts` crea reuniones, agrega una con videollamada en curso para la demo.
4. Reporta: archivos cambiados, decisiones tomadas por tu cuenta, lo que no se pudo verificar (por ejemplo, Daily real sin clave).
