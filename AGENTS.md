# AGENTS.md — EduControl

Instrucciones para agentes de código (Claude Code, Codex, etc.). Léelo completo antes de tocar código.

- Si algo de este archivo contradice lo que el usuario te pide en la conversación, gana el usuario, y avísale para que este archivo se actualice.
- La sección 13 lista **decisiones pendientes**: si una tarea depende de una, **pregunta al usuario antes de implementar**; no asumas.
- No inventes requisitos. Si algo no está aquí ni en `docs/educontrol.dbml`, pregunta.

---

## 1. Qué es EduControl

Plataforma web para estudiantes que reúne en un solo lugar sus **cursos, evaluaciones, calendario, disponibilidad horaria y trabajos grupales**, con seguimiento del avance de cada integrante de un grupo.

Nació como proyecto del curso *Proyecto Tecnológico* (NRC 3708, ISIL, metodología Scrum), pero **va a producción real** con usuarios reales. Por eso importan la seguridad, la privacidad de los datos y no depender de terceros para el núcleo.

**Problema que resuelve** (viene del informe del proyecto):

- En los trabajos grupales la participación no es equitativa y nadie ve con claridad quién hizo qué; hoy todo se coordina por mensajes informales.
- Los integrantes tienen horarios, clases y obligaciones (trabajo, familia) distintos, y cuesta encontrar cuándo reunirse.

**Propuesta de valor:** el grupo ve, con datos objetivos y no con la palabra de cada uno, cómo va el avance general, cuánta carga tiene cada integrante y quién cumplió su parte.

**Contexto del equipo:** 2 desarrolladores. Los otros integrantes (Scrum Master, Product Owner y un compañero de otra carrera) **no son devs**: probarán el producto desde un entorno desplegado, sin clonar el repo ni instalar Docker (de ahí la necesidad futura de staging). Hay exposiciones de 10 minutos como máximo: el flujo principal debe ser fluido y contar con datos de ejemplo (seed).

## 2. Estado actual

- Repositorio: `seevsk/edu-control` (GitHub). Ramas: `main` y `develop`.
- Next.js (App Router, TypeScript, carpeta `src/`, alias `@/*`) con PostgreSQL + Prisma, login con Google y sesión propia.
- **Implementado (develop, 2026-11-16):** cursos con horario y evaluaciones (con estados e historial), grupos con invitaciones y salida voluntaria, tareas con tablero, lista, detalle, historial y tiempos, entregas de tarea con archivos (rama `feature/entregas-tareas`, 2026-11-18, ver 8.4), métricas del grupo, Bandeja (notificaciones e invitaciones) con correo por Resend, calendario, tiempo ocupado (incluido horario excepcional), disponibilidad y horarios del grupo, reuniones, perfil y perfiles de otros, buscador de personas, guía de bienvenida, SEO y demo en Render.
- **Pendiente:** ver sección 13.
- El backlog vive en Azure DevOps, pero **puede estar desactualizado**. La referencia de historias de usuario es el Excel del equipo (PBIs v1.3) más lo definido en este archivo. Si hay conflicto, **gana este archivo**, porque refleja decisiones posteriores.

## 3. Alcance del MVP

### Dentro

| Área | HU (referencia) | Nota |
|---|---|---|
| Inicio de sesión con Google | HU-001 | Único método de acceso |
| Grupos | HU-011, HU-012 | Crear grupo, invitar y administrar integrantes |
| Tareas de grupo | HU-007, HU-008, HU-013 | Registrar tareas, cambiar estado, asignar responsable |
| Avance del grupo | HU-014 | Se calcula con consultas, no se guarda |
| Cursos | HU-005 | Registrados a mano por el usuario |
| Calendario | HU-015 | Vista interna sobre evaluaciones y tareas de grupo |
| Evaluaciones | HU-009, HU-010 | Modelo `evaluacion` |
| Perfil y disponibilidad | HU-003, HU-017, HU-018 | Modelo `perfil` y `bloque_ocupado`; se construye después del núcleo |
| Disponibilidad del grupo | — (aprobado por el usuario, 2026-10-05) | Pestaña "Horarios" del grupo: mapa semanal ocupado/libre y huecos en común. Calculado, sin tabla (ver 8.5) |
| Reuniones | — (aprobado por el usuario, 2026-10-05) | Módulo propio en el sidebar (`/reuniones`): programar con sugerencias de la disponibilidad del grupo, confirmar asistencia, verlas en el Calendario. Modelos `reunion` y `reunion_asistente` (ver 8.7). Con videollamada propia (sala privada en un proveedor de video, incrustada) y "Reunirse ahora" (aprobado 2026-11-20) |
| Perfil de otros usuarios y buscador de personas | — (aprobado por el usuario, 2026-10-05) | `/usuarios` y `/usuarios/[id]` (ver 8.1) |
| Entregas de tarea | — (aprobado por el usuario, 2026-11-18) | Para pasar a revisión el asignado envía una entrega (título, descripción, enlace y archivos con tope de MB); el líder la aprueba o devuelve; todos la ven y descargan. Modelos `entrega`, `entrega_archivo` y `entrega_archivo_contenido` (ver 8.4) |

**Las tareas existen solo dentro de grupos.** No hay tareas personales en el MVP.

### Fuera (no implementar ni preparar integraciones)

- Integración con **Moodle** (HU-019, HU-020, HU-021). EduControl es 100% independiente: todo dato lo carga el usuario.
- Sincronización con **Google Calendar** y envío por la **API de Gmail** (HU-016, HU-022, HU-023). El calendario y las notificaciones son propios.
- **Pagos académicos** (HU-024, HU-025, HU-026) y cualquier API del centro educativo.
- **Recuperación de acceso** (HU-002): no aplica, porque no hay contraseñas propias; la recuperación la gestiona Google.
- Subida de archivos fuera de una entrega de tarea (los únicos archivos permitidos son los adjuntos de una entrega, ver 8.4). Sin vista previa dentro de la app: solo descarga.
- Ranking o puntaje único de participación (ver sección 8.5).

### Recorrido principal de usuario (guía para la demo)

1. Entra con Google (se crean `usuario` y `perfil`).
2. Registra sus cursos, horarios de clase y evaluaciones.
3. Crea un grupo (queda como líder) e invita a compañeros que ya se registraron.
4. Los invitados aceptan dentro de la web.
5. Se crean tareas con peso y fecha límite, y se asignan responsables.
6. El asignado avanza la tarea; al terminar la pasa a revisión; otro integrante la confirma.
7. El grupo ve el avance, la carga y el cumplimiento de cada integrante, y recibe notificaciones.

## 4. Stack y decisiones técnicas

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + React + Tailwind CSS |
| Componentes e íconos | shadcn/ui (sobre Radix), lucide-react, calendario ReUI (`src/components/reui`), dnd-kit (tablero), cmdk, sonner, date-fns, `livekit-client`, `@livekit/components-react` y `@livekit/components-styles` (sala de videollamada; aprobadas 2026-11-20) |
| Backend | TypeScript dentro del mismo proyecto Next.js (Route Handlers y Server Actions). **No hay backend separado ni CORS** |
| Base de datos | PostgreSQL |
| ORM y migraciones | Prisma |
| Validación | Zod (esquemas compartidos entre cliente y servidor) |
| Animaciones | `motion` (solo en el login, pedido del usuario 2026-11-16) |
| Autenticación | Google OAuth únicamente, flujo manual con `openid-client` + `jose` (ver 8.1) |
| Correo | Resend mediante `EmailSender` configurable por entorno (ver 8.6) |
| Videollamadas | LiveKit Cloud (plan Build, sin tarjeta; al pasar el tope corta en vez de cobrar) detrás de `ProveedorVideo`, con implementaciones `simulado` y `livekit`, configurable por entorno (ver 8.7). Los tokens se firman con `jose` (HS256); no se usa `livekit-server-sdk` |
| Entorno local | Docker solo para PostgreSQL |
| Control de versiones | GitHub |
| Gestión del proyecto | Azure DevOps |
| Pruebas de API | Postman |

Notas:

- **Consulta siempre la documentación vigente** de Next.js, Prisma, Zod y la librería de auth antes de implementar: sus APIs cambian entre versiones mayores. La versión instalada está en `package.json`; no te fíes de tu memoria para APIs recientes.
- Si `next.config.ts` tiene el React Compiler activado, no escribas `useMemo`, `useCallback` ni `React.memo` a mano.
- Valida las variables de entorno al arrancar con Zod (por ejemplo en `src/lib/env.ts`).

## 5. Entornos y despliegue

**Desarrollo en local + una demo en Render** (pedido por el usuario, 2026-10-12): `render.yaml` define el servicio `educontrol-demo` (rama `develop`) y su base `educontrol-demo-db`, ambos en plan **free**. Los datos de la demo son descartables (la base free expira a los 30 días); lo que se conserva es la configuración, versionada en `render.yaml`. Pasar a pago = cambiar `plan` en ese archivo. No agregues Dockerfile de la app ni CI de despliegue sin que se pida.

### Local (actual)

- Next.js con `npm run dev`.
- PostgreSQL en un contenedor Docker (ver sección 11). La app **no** se ejecuta dentro de Docker.
- Por defecto los correos se registran en consola; se pueden probar con Resend configurando las variables de entorno (ver 8.6).

### Próximamente (prepara el código para esto, sin implementarlo)

| Entorno | Rama | Dónde | Base de datos |
|---|---|---|---|
| Staging | `develop` | Render (servicio web propio) | PostgreSQL propia, separada de producción |
| Producción | `main` | Render (servicio web propio) | PostgreSQL propia |

Para que el código sea portable entre entornos:

- **Toda configuración va por variables de entorno.** Nada de URLs, dominios ni secretos escritos en el código.
- La URL base de la app sale de una variable (`APP_URL`). Los enlaces guardados en la base de datos son **rutas relativas**.
- Cada entorno tendrá sus propias credenciales y URLs de retorno de Google OAuth.
- En staging y producción las migraciones se aplican con `prisma migrate deploy`; **nunca** `migrate dev` ni `db push` contra esas bases.
- Usa la **misma versión mayor de PostgreSQL** en local y en Render.
- Mantén `.env.example` actualizado (sin valores reales). `.env` nunca se sube a Git.

## 6. Estructura y arquitectura

Estructura sugerida (adáptala si hay una razón, y actualiza este archivo):

```
src/
  app/                    # Rutas (App Router)
    (auth)/login/
    (app)/                # Área autenticada: inicio, bandeja, calendario, reuniones, cursos, grupos, usuarios, perfil
    api/                  # Route Handlers, solo si hacen falta
  server/
    auth/                 # Sesión, helpers de usuario autenticado y acceso por recurso (acceso-rutas.ts, usado en src/proxy.ts)
    db/                   # Cliente de Prisma
    services/             # Reglas de negocio (grupos, tareas, notificaciones, disponibilidad, métricas)
    email/                # Interfaz EmailSender + implementaciones (consola, Resend)
    notifications/        # Plantillas por tipo de notificación
  lib/
    validation/           # Esquemas Zod compartidos
    dates.ts              # Conversión UTC <-> America/Lima
    formato-fecha.ts      # Cómo se muestran fechas y horas (ver 9)
    calendario.ts, disponibilidad.ts, metricas.ts, estado-tarea.ts, estado-evaluacion.ts, bandeja.ts  # Reglas puras
    env.ts
  components/
    ui/                   # Componentes de shadcn/ui (no editar a mano salvo ajustes de estilo)
    ui-app/               # Componentes propios de EduControl
    marca/                # Monograma y logotipo
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  educontrol.dbml         # Especificación exacta del esquema
docker-compose.yml
.env.example
```

Reglas de arquitectura:

- **Route Handlers y Server Actions son delgados:** (1) obtener el usuario de la sesión, (2) validar la entrada con Zod, (3) autorizar, (4) llamar a un *service*. La lógica de negocio vive en `src/server/services`.
- Prisma se usa solo dentro de `services` (o repositorios), nunca en componentes.
- Las reglas de cálculo son **funciones puras** y testeables: métricas de avance, solapes de horario (incluido el cruce de medianoche), proyección de bloques semanales a fechas.
- Usa `prisma.$transaction` cuando varias escrituras deben ser atómicas (ver 8.3 y 8.4).
- Para mutaciones desde la UI prefiere Server Actions; usa Route Handlers cuando haga falta una API HTTP (por ejemplo, para probar con Postman).

## 7. Modelo de datos

**La especificación exacta está en `docs/educontrol.dbml`** (17 tablas). Si ese archivo no existe, pídelo al usuario; no inventes el esquema. Una vez creado `prisma/schema.prisma`, este pasa a ser la fuente de verdad y el `.dbml` se actualiza en el mismo cambio.

| Tabla | Propósito |
|---|---|
| `usuario` | Identidad que viene de Google (`google_id` es el ancla). Se anonimiza en vez de borrarse (`eliminado_en`) |
| `perfil` | 1:1 con `usuario`. Datos que edita la persona: `tipo_cuenta`, institución, carrera, ciclo, biografía, `trabaja`, `visible_en_busqueda` |
| `bloque_ocupado` | Patrón semanal de tiempo no disponible (laboral, familiar, personal) |
| `curso` | Cursos que cada usuario registra para sí mismo (puede ser una copia sincronizada, ver 8.2) |
| `horario_curso` | Sesiones semanales de un curso (un curso puede tener varias) |
| `evaluacion` | Evaluaciones de un curso, con ventana de apertura y cierre |
| `grupo` | Trabajo grupal, con su propia fecha límite y enlace del trabajo |
| `grupo_integrante` | Pertenencia a un grupo: rol, estado de invitación, preferencia de correo |
| `tarea` | Tareas de un grupo, con responsable, estado y peso |
| `tarea_historial` | Registro inmutable de cambios de cada tarea |
| `notificacion` | Avisos por destinatario, con estado de envío de correo |
| `reunion` | Reunión de un grupo, de una sola vez (título, inicio, fin, lugar y enlace opcionales; `videollamada`, `sala_url`, `iniciada_en`, `finalizada_en`, `id_finalizador`) |
| `reunion_asistente` | Confirmación de asistencia por integrante (`pendiente` \| `asistire` \| `no_asistire`) y `fecha_entrada` (primera vez que pulsó Unirse) |
| `evaluacion_historial` | Registro inmutable del avance personal de cada evaluación (como `tarea_historial`) |
| `entrega` | Lo que el asignado envía al pasar una tarea a revisión: título, descripción, enlace, `resultado` (`en_revision` \| `aprobada` \| `devuelta`), revisor, fecha y motivo de devolución |
| `entrega_archivo` | Metadatos de cada archivo adjunto (nombre, tipo, tamaño) |
| `entrega_archivo_contenido` | El binario del archivo, en tabla aparte para no cargarlo al listar (ver 8.4) |

**Lo que NO tiene tabla** (se calcula con consultas): el calendario, el avance del grupo, la carga y el cumplimiento por integrante, el feed de actividad y el tiempo libre.

### Convenciones para Prisma

- Modelos en PascalCase y en español: `Usuario`, `Perfil`, `BloqueOcupado`, `Curso`, `HorarioCurso`, `Evaluacion`, `EvaluacionHistorial`, `Grupo`, `GrupoIntegrante`, `Tarea`, `TareaHistorial`, `Notificacion`, `Reunion`, `ReunionAsistente`.
- Campos en camelCase (`idUsuario`, `googleId`), mapeados al esquema del `.dbml` con `@map` / `@@map` (columnas y tablas en snake_case).
- **Sin tildes ni ñ en ningún identificador** (Prisma no las acepta).
- Los conjuntos cerrados (estado de tarea, rol, estado de invitación, tipo de bloque, tipo de cuenta, modalidad, estado del grupo, estado del correo) se pueden modelar como `enum` de Prisma conservando exactamente los valores del `.dbml`.
- Respeta el comportamiento al borrar (`onDelete`) que indica el `.dbml`. Los `usuario` **nunca se borran**.
- Las fechas se guardan en UTC. Los campos `time` (`hora_inicio`, `hora_fin`) llegan como `DateTime` en Prisma: encapsula esa conversión en un helper.
- Restricciones únicas obligatorias: `usuario.google_id`, `usuario.correo`, `perfil.id_usuario` y la pareja (`grupo_integrante.id_grupo`, `grupo_integrante.id_usuario`).
- No agregues columnas ni tablas que no estén en el `.dbml` sin preguntar.

## 8. Reglas de negocio

### 8.1 Autenticación y usuarios

- **Google OAuth es el único método de acceso.** No hay registro con contraseña ni recuperación de cuenta.
- **Implementación (decidido):** flujo OAuth manual, sin librería de auth. `openid-client` para el intercambio del código y la validación del ID token de Google; `jose` para firmar la cookie de sesión propia. Ninguna tabla de usuario/cuenta/sesión impuesta por una librería.
- El acceso está **abierto a cualquier cuenta de Google**, no restringido a un dominio institucional.
- Pide solo los scopes `openid`, `email` y `profile`. **No pidas Gmail, Calendar ni ningún otro.** No guardes access tokens ni refresh tokens de Google.
- Mapeo del ID token al usuario:

| Token de Google | Campo |
|---|---|
| `sub` | `usuario.google_id` |
| `email` | `usuario.correo` (en minúsculas) |
| `given_name` | `usuario.nombre` |
| `family_name` | `usuario.apellidos` (Google entrega un solo apellido; no lo separes en paterno y materno) |
| `picture` | `usuario.foto_url` (guarda la URL, no descargues la imagen) |

- `dominio_correo` es el texto después de `@`, en minúsculas, **calculado en el backend**. Se recalcula junto con `correo` en cada login.
- Haz *upsert* **por `google_id`**, no por correo (el correo de una cuenta de Workspace puede cambiar).
- **Nombre y foto (confirmado):** `correo` y `dominio_correo` se refrescan siempre; `nombre`, `apellidos` y `foto_url` solo se fijan al crear la cuenta (después el usuario los podrá editar desde su perfil).
- En el primer login crea `usuario` y `perfil` (con `tipo_cuenta = 'estudiante'`) en una sola transacción.
- Tras el login el servidor emite **su propia sesión**. **El id del usuario autenticado sale siempre de la sesión en el servidor, nunca de un parámetro que envíe el cliente.**
- Sugerir compañeros por dominio de correo solo tiene sentido si el dominio **no es genérico** (gmail.com, hotmail.com, outlook.com, live.com, yahoo.com, icloud.com, etc.). Guarda esa lista en un archivo de constantes.
- `perfil.tipo_cuenta` (`estudiante` | `profesor`) es **solo una etiqueta autodeclarada, sin ningún permiso**. Los permisos salen únicamente de `grupo_integrante.rol`. No la muestres como insignia de "verificado".
- **Búsqueda de compañeros:** solo usuarios registrados, no eliminados y con `visible_en_busqueda = true`. Exige correo exacto o un mínimo de caracteres, limita la cantidad de resultados y limita las invitaciones por hora. Nunca muestres datos de disponibilidad en los resultados.
- **Perfil de otros usuarios (`/usuarios/[id]`, confirmado):** muestra primero los datos básicos: `tipo_cuenta` (como texto, no como insignia), nombres, apellidos, institución, carrera, ciclo, `trabaja` (Sí/No) y biografía, más los grupos en común. Nunca el correo. Lo ve cualquier usuario solo si la persona tiene `visible_en_busqueda = true`; sus compañeros de grupo (ambos `aceptada`) lo ven siempre. Arriba, el botón **"Ver disponibilidad"** lleva a `/usuarios/[id]/disponibilidad` solo si son compañeros (ver 8.2); si no, aparece deshabilitado. El buscador de la barra superior (`/usuarios?q=`) sigue las mismas reglas que la búsqueda para invitar y tampoco muestra el correo.
- **Eliminar cuenta = anonimizar:** poner `eliminado_en`, vaciar nombre, apellidos, correo y foto, borrar `perfil` y `bloque_ocupado`, y conservar `tarea` y `tarea_historial` (para no romper los grupos). **Decisión del usuario, 2026-11-22:** si lidera un grupo activo con otro integrante aceptado no observador, se bloquea ("Cede el liderazgo en: X, Y"). Si no, en la misma transacción sale de cada grupo activo como en "salir del grupo" (`retirado`, `retiro_voluntario = true`, tareas abiertas liberadas), sus invitaciones pendientes pasan a `cancelada` (nadie las respondió, no son rechazos) y un líder sin otros integrantes que puedan liderar deja su grupo como está. Es idempotente. Una cuenta eliminada no entra por su cookie (`requerirSesion` la manda a `/api/auth/sesion-invalida`) ni recibe notificaciones ni correos.

### 8.2 Cursos, horarios, evaluaciones y calendario

- Cada usuario registra **sus propios cursos** a mano (no hay importación de Moodle ni de ningún sistema externo). `modalidad`: `presencial` | `remoto`. `activo = false` cuando termina el ciclo.
- **Creación de cursos (confirmado por el usuario, 2026-11-02):** nombre, código y al menos un día del horario semanal son obligatorios. La selección del horario usa el mismo patrón que "Agregar tiempo ocupado": chips de días y horas en intervalos de 30 minutos; se pueden marcar varios días con la misma franja. El curso y sus sesiones iniciales se crean de forma atómica, para que un horario inválido no deje un curso incompleto.
- **Importar curso desde un grupo (confirmado):** si un grupo nace de la evaluación de otro usuario (`grupo.id_evaluacion` -> `evaluacion.id_curso`), un integrante invitado (nunca el dueño del curso) puede traerse ese curso a los suyos con una acción explícita, no automática. Si ya tiene un curso propio con el mismo `codigo`, se **sobrescriben** `nombre`/`docente`/`modalidad` en vez de duplicar la fila (cada quien conserva su propio `id_curso`, no hay colisión de PK posible). El curso resultante queda enlazado vía `importado_de_id_curso`, y esa sincronización es **automática y continua**: cuando el dueño edita su curso, `nombre`/`docente`/`modalidad` se propagan solos a todas las copias importadas (nunca `activo`, que es de cada quien).
- **Horario y evaluaciones al importar:** la importación también trae `horario_curso` y `evaluacion` (enlazados vía `importado_de_id_horario` / `importado_de_id_evaluacion`), porque son parte del curso. A diferencia de los campos escalares del curso, estas son listas: la sincronización posterior **no es automática**, es una acción manual ("traer actualizaciones") que agrega lo nuevo y actualiza lo existente (por el id importado, nunca por nombre) sin borrar nada que ya esté; `fecha_entrega` de una evaluación nunca se pisa, es autodeclarada por cada quien.
- `horario_curso` es un patrón **semanal** (día 1 = lunes … 7 = domingo), pero en la práctica los cursos no dictan clase en domingo: la UI y la validación limitan `horario_curso` a **1-6 (lunes a sábado)**. `bloque_ocupado` sí usa el rango completo 1-7. Un curso puede tener varias sesiones. La hora de fin debe ser estrictamente posterior a la hora de inicio; las sesiones no cruzan la medianoche.
- **Horario estable del curso (confirmado por el usuario, 2026-11-02):** una vez que el curso tiene horario, no se pueden agregar ni eliminar sesiones manualmente; solo editar el día y la franja de cada sesión existente. El formulario para configurar horario solo aparece en cursos antiguos o importados que todavía no tengan ninguna sesión. La sincronización manual de un curso importado conserva su comportamiento aprobado y puede traer sesiones nuevas desde el curso original.
- Los horarios de un curso solo aparecen en el Calendario mientras `curso.activo = true`. Al desactivar el curso se conservan sus sesiones en la base de datos, pero se retiran inmediatamente del Calendario; al reactivarlo vuelven a mostrarse.
- `bloque_ocupado` es un patrón semanal **personal**: `laboral` | `familiar` | `personal`. `dia_semana` indica el día del bloque. La hora de fin debe ser posterior a la de inicio, salvo que el usuario active **Horario excepcional**: entonces el bloque termina al día siguiente (p. ej. 9:00pm - 8:00am; fin = inicio sigue prohibido). No hay columna: `hora_fin < hora_inicio` significa que cruza la medianoche, y el cálculo de disponibilidad y el Calendario ya lo reparten entre los dos días (decisión del usuario, 2026-11-16, reemplaza la del 2026-10-19). Solo aplica a `bloque_ocupado`; las sesiones de curso siguen sin cruzar la medianoche.
- **Tiempo ocupado** de un usuario = `horario_curso` de sus cursos activos + sus `bloque_ocupado`. **El tiempo libre se calcula restando; nunca se guarda.** Los solapes se calculan en TypeScript.
- `evaluacion`: pertenece a un curso. `fecha_cierre` es obligatoria. `fecha_apertura` es opcional (una evaluación presencial no tiene ventana). Si el usuario solo indica el día, usa **23:59 (America/Lima)** como hora de cierre. `requiere_entrega` indica si se sube algo; `fecha_entrega` la marca el propio usuario (`NULL` = aún no entrega) y es autodeclarada, no verificada.
- **Avance de una evaluación (confirmado, 2026-11-16, `src/lib/estado-evaluacion.ts`):** mismos criterios que las tareas, pero lo maneja solo el dueño. `evaluacion.estado`: `pendiente` → `en_progreso` → `completada` ("Terminada"), más `descartada` (motivo obligatorio). Terminar exige haber marcado la entrega si `requiere_entrega`; una terminada no puede quitar la entrega sin reabrirla. Reabrir: `completada` → `en_progreso`; restaurar: `descartada` → `pendiente`. `fecha_vista` + acción `vista` registran la primera vez que se abre el detalle (`/cursos/[id]?evaluacion=`). Cada cambio escribe en `evaluacion_historial` (`creada` | `vista` | `estado` | `entrega`) en la misma transacción; el motivo va en `valor_nuevo`. El estado es personal: no se copia al importar ni al traer actualizaciones. Inicio y Calendario ocultan las descartadas; Inicio también las terminadas.
- **"Origen" del curso (creado por ti / importado):** oculto por ahora en el detalle del curso (`MOSTRAR_ORIGEN`, pedido del usuario 2026-11-16).
- **El calendario es una vista, no una tabla.** Eventos con fecha: cierres de evaluaciones y fechas límite de tareas de grupo. Patrones semanales (`horario_curso` y `bloque_ocupado`): franjas de fondo proyectadas sobre los días de la semana mostrada.
- **Fechas:** se guardan en UTC y se muestran en `America/Lima` (UTC-5, sin horario de verano). Centraliza la conversión en `src/lib/dates`.
- La disponibilidad es información sensible (decisión del usuario, 2026-10-05): un **compañero** (comparten un grupo donde ambos están `aceptada` y ninguno es observador) puede ver el horario semanal del otro en `/usuarios/[id]/disponibilidad`, con la misma segmentación y colores del Calendario: clases con el nombre del curso y bloques con su categoría (Laboral / Familiar-Personal). **Nunca el `detalle` de un bloque** ni las entregas. En la pestaña "Horarios" del grupo se sigue mostrando solo ocupado/libre por persona. Nadie fuera de esa condición ve la disponibilidad.

### 8.3 Grupos e invitaciones

- Al crear un grupo, **en la misma transacción**, inserta al creador en `grupo_integrante` con `rol = 'lider'` y `estado_invitacion = 'aceptada'`.
- `grupo.fecha_limite` vive en el grupo. Si el creador elige una `evaluacion`, su fecha de cierre se **copia una vez** para precargar. Las evaluaciones son de cada usuario, por eso el grupo no depende de ellas.
- `grupo.enlace_trabajo` (Drive, Word online, repo…) es opcional. **Valida con Zod que empiece con `https://` o `http://`** antes de guardarlo; rechaza cualquier otro esquema (por ejemplo `javascript:`).
- `grupo.estado`: `activo` | `finalizado`. Un grupo finalizado es de solo lectura; al finalizar, sus invitaciones `pendiente` pasan a `cancelada` (decisión del usuario, 2026-11-22).
- **Invitaciones:** el líder busca a un usuario ya registrado y crea una fila con `estado_invitacion = 'pendiente'`. **El invitado acepta o rechaza dentro de la web**, nunca desde un enlace del correo (no hay tokens de aceptación). Al responder se llena `fecha_respuesta`.
- Antes de aceptar, el invitado debe confirmar expresamente que fue informado de los datos personales que compartirán los integrantes del grupo, la finalidad de coordinación y las consecuencias de aceptar o rechazar. Esta confirmación se valida también en el servidor (decisión del usuario, 2026-10-19).
- Estados: `pendiente` | `aceptada` | `rechazada` | `cancelada` | `retirado`. `cancelada` (confirmado, 2026-11-18): el líder retiró la invitación **antes de que respondiera** (invitó a la persona equivocada); nunca fue integrante, así que no figura en la tabla de Integrantes ni en el historial de quien la recibió, y se puede volver a invitar (igual que a quien `rechazó`, reabriendo su misma fila). En Integrantes, una invitación pendiente ofrece **"Cancelar invitación"** y solo los aceptados ofrecen **"Retirar"**; `retirado` queda solo para quien ya fue integrante y no puede volver. **Solo los integrantes `aceptada` cuentan** para asignaciones, métricas, notificaciones y permisos.
- **Retirar a un integrante:** cambia su estado a `retirado` y llena `fecha_retiro`; **no borres la fila** (conserva su historial de aporte). Libera sus tareas abiertas y registra el cambio en `tarea_historial` (decisión del usuario, 2026-11-22): `pendiente` queda sin responsable; `en_progreso` vuelve a `pendiente` sin responsable (historial `reasignada` y `estado`); `en_revision` sigue en revisión con su entrega y conserva a quien la envió, para que el líder la apruebe o la devuelva (no se avisa a quien salió).
- **Salir del grupo (confirmado, 2026-11-16):** cualquier integrante aceptado de un grupo activo puede salir por su cuenta desde Integrantes. Queda igual que un retiro (`retirado`, `fecha_retiro`, tareas abiertas liberadas con historial, ver Retirar) pero con `retiro_voluntario = true`. El líder primero cede el liderazgo a un miembro aceptado (no observador); si no hay ninguno, no puede salir. Se avisa al líder (o al nuevo líder) con `integrante_salio`. Hoy no se puede volver a invitar a quien salió (la fila ya existe). La respuesta a una invitación no se avisa a quien invitó si ya no es integrante aceptado.
- **Historial de invitaciones (confirmado, 2026-11-15):** cada invitación guarda quién la envió (`id_invitador`). En la Bandeja (filtro Invitaciones; el módulo Invitaciones se integró ahí el 2026-11-16), cada usuario ve las pendientes y su historial: qué aceptó o rechazó (con la fecha de respuesta, quién lo invitó y a qué grupo y curso) y de qué grupos lo retiraron (con `fecha_retiro`). Los registros anteriores a estas columnas asumen al creador del grupo como invitador y no tienen fecha de retiro.
- Roles: `lider` | `miembro` | `observador`.
  - **Observador:** solo lectura de tareas, avance e historial. No cuenta en las métricas, no se le asignan tareas y **no ve los `bloque_ocupado` de nadie**. Así se incorpora a un profesor: el grupo lo invita como observador.
- Permisos por defecto (confirmado): el líder invita, retira y edita el grupo; líder y miembros crean y asignan tareas.
- Un grupo solo es visible para sus integrantes. **Verifica membresía y rol en cada acceso a datos de un grupo.**
- **Sin acceso = 404, nunca 403 (decidido 2026-11-16):** a quien no es integrante (o no es dueño del curso, o no puede ver un perfil) se le responde igual que si el recurso no existiera, para no confirmar que existe. `src/proxy.ts` + `src/server/auth/acceso-rutas.ts` lo resuelven en las cargas de página antes de transmitirla, para que el código HTTP sea un 404 real (`src/app/not-found.tsx`). No reemplaza las verificaciones de páginas y servicios; las Server Actions (POST) siguen validando permisos y respondiendo su error.

### 8.4 Tareas

- Las tareas pertenecen siempre a un grupo. `id_asignado` debe ser un integrante `aceptada` que no sea observador (o `NULL` si está sin asignar).
- `peso`: 1 a 3, lo define el grupo al crear la tarea.
- **Restricciones adicionales (confirmadas por el usuario, 2026-11-02; responsable opcional desde 2026-11-22):** al crear una tarea la fecha límite es obligatoria y el responsable es **opcional** (por defecto "Sin asignar"; reemplaza la regla de 2026-11-02 que lo exigía). La fecha no puede estar en el pasado ni superar `grupo.fecha_limite`. Una tarea sin responsable (desde la creación, por una reasignación o por el retiro de un integrante) solo puede estar `pendiente`: necesita responsable antes de pasar a `en_progreso`. Una tarea `en_revision` o `completada` no se reasigna. Una tarea `en_progreso` solo la puede reasignar el líder y, al hacerlo, vuelve a `pendiente`; se registran tanto la reasignación como el cambio de estado en el historial. Las tareas `pendiente` sí pueden reasignarlas líder y miembros.
- **Tomar tarea (confirmado, 2026-11-22; `tomarTarea` en `src/server/services/tarea.ts`):** un integrante aceptado no observador de un grupo activo puede asignarse a sí mismo, con un clic, una tarea `pendiente` sin responsable. Es una reasignación normal: historial `reasignada` (anterior `NULL`) más `vista` (quien se la asigna a sí mismo la tiene vista) y no se notifica al propio actor. Si dos personas la toman a la vez, la transacción deja ganar a una sola y la otra recibe "Otra persona ya tomó esta tarea". En el detalle aparece como el botón principal "Tomar tarea", y el filtro de responsable del tablero y la lista ofrece "Sin asignar".
- Un grupo no puede pasar a `finalizado` mientras tenga tareas abiertas (`pendiente`, `en_progreso` o `en_revision`). Las `completada` y `descartada` están cerradas.
- Estados: `pendiente` → `en_progreso` → `en_revision` → `completada`, más `descartada` (tarea que ya no se hará, como "Removed" en Azure o "Won't Do" en Jira). Nunca se borran tareas.

| Transición | Quién |
|---|---|
| `pendiente` → `en_progreso` | El asignado (o el líder) |
| `en_progreso` → `en_revision` | Solo el asignado, **enviando una entrega** (ver abajo); no existe como cambio de estado suelto. Significa "terminé". Se llena `fecha_terminada` |
| `en_revision` → `completada` | **Solo el líder** (aprueba la entrega). También puede aprobar la suya (confirmado, 2026-11-18) |
| `en_revision` → `en_progreso` | **Solo el líder**, al devolverla. Debe escribir obligatoriamente un motivo y se borra `fecha_terminada`. Si el responsable ya no puede recibir tareas (retirado, observador o ninguno), la tarea queda `pendiente` sin asignar (2026-11-22) |
| `completada` → `en_progreso` (reabrir) | Solo el líder, con motivo obligatorio. Se borra `fecha_terminada`. Si el responsable ya no puede recibir tareas, vuelve a `pendiente` sin asignar (confirmado, 2026-11-09) |
| abierta → `descartada` | Solo el líder, con motivo obligatorio (confirmado, 2026-11-09) |
| `descartada` → `pendiente` (restaurar) | Solo el líder. Si el responsable ya no puede recibir tareas, queda sin asignar |

  Rechaza cualquier otra transición. Si el equipo pide más flexibilidad, se amplía esta tabla. La revisión del trabajo real ocurre fuera de la app (el revisor abre el documento del grupo); la app solo registra quién confirmó y cuándo. Reabrir, descartar y restaurar solo se ofrecen en el detalle de la tarea, no en el tablero ni en la lista.
- **Editar una tarea (confirmado, 2026-11-09):** el líder o quien la creó pueden cambiar título, descripción, peso y fecha límite mientras la tarea esté abierta. Una fecha nueva sigue las mismas reglas que al crear; si no cambia, se conserva aunque ya esté vencida. Para editar una tarea cerrada primero hay que reabrirla o restaurarla.
- **Vencida** = fecha límite pasada y tarea abierta. Se calcula, no se guarda. Todos la ven marcada; el líder la resuelve reprogramando (editar la fecha), reasignando o descartando.
- **Cada cambio de `estado`, de `id_asignado`, de `fecha_limite` o de `peso` escribe una fila en `tarea_historial` dentro de la misma transacción que actualiza la tarea.** Lee el valor anterior **antes** de actualizar:
  - `accion`: `creada` | `estado` | `reasignada` | `vista` | `fecha_limite` | `peso`.
  - `valor_anterior` y `valor_nuevo`: texto. En `reasignada` guarda el **id del usuario**, no el nombre. En `fecha_limite`, la fecha en ISO UTC. En `creada` y `vista` ambos son `NULL`.
  - Al devolver, descartar o reabrir, `valor_nuevo` conserva el estado junto con el motivo en el mismo texto usando el formato interpretado por `src/lib/tarea-historial.ts`; así se muestra en el historial sin agregar columnas.
  - `vista` (confirmado, 2026-11-09) = la primera vez que el responsable actual abre el detalle de la tarea; se registra una vez por asignación. Quien se asigna su propia tarea la tiene vista al asignarla. No aparece en el feed de actividad del grupo.
  - `id_usuario` sale de la sesión del servidor.
- **Seguimiento de tiempos (confirmado, 2026-11-09, `src/lib/tiempos-tarea.ts`):** se calcula desde `tarea_historial`, nunca se guarda. Cada cambio de estado o de responsable cierra un tramo y abre otro, con reloj corrido (24/7, sin calendario laboral). Contadores: **Sin asignar** (tarea abierta sin responsable), **Pendiente** (desde que se asignó hasta que empezó), **En progreso** (trabajo del asignado; suma todos sus tramos, también tras una devolución o reapertura), **En revisión** (tiempo del revisor: el reloj del asignado queda pausado) y **Total** (desde que se creó hasta que se cerró, o hasta ahora). Si se reasigna, cada persona suma solo sus horas. El tramo abierto se mide hasta el momento actual. El detalle de la tarea muestra la línea de tiempo con la hora de cada paso (12 h, America/Lima) y la duración de cada tramo (`45 min`, `7 h 20 min`, `2 d 3 h`).
- El historial nunca se edita ni se borra.
- **Entregas (confirmado, 2026-11-18; `src/lib/entregas.ts`, `src/server/services/entrega.ts`):**
  - Pasar a `en_revision` exige una entrega: **título** (≤120) más **descripción** (≤2000), **enlace** (`http(s)://`) o al menos un **archivo**. Solo la envía el asignado y solo con la tarea `en_progreso`. Crear la entrega, pasar la tarea a revisión, escribir el historial (`estado`) y notificar ocurre en **una sola transacción**: si algo falla no queda nada.
  - `entrega.resultado`: `en_revision` → `aprobada` o `devuelta`. Lo fija el líder al aprobar o devolver la tarea, en la misma transacción que el cambio de estado, junto con `id_revisor`, `fecha_revision` y, al devolver, `motivo_devolucion`. Cada devolución cierra su entrega; el asignado envía una **entrega nueva** (no se edita la enviada). Las entregas se distinguen por orden de fecha: **no hay "rondas" ni columna de número**. Una tarea que ya estaba en revisión antes de existir las entregas se aprueba o devuelve igual, sin entrega.
  - **Autoaprobada** = `id_revisor = id_autor` (se calcula, no se guarda). Se muestra "Aprobada por el propio líder" y se avisa dentro de la app (sin correo) a los demás integrantes.
  - Los integrantes aceptados, **observadores incluidos**, ven las entregas y descargan; solo el líder aprueba o devuelve. Un grupo finalizado conserva todo en lectura. En una tarea `descartada` la entrega pendiente no se etiqueta.
  - **Archivos (tope de la demo, porque Render free tiene disco efímero y 1 GB de Postgres compartido):** 5 MB por archivo, 3 archivos y 10 MB por entrega, 40 MB por grupo. Tipos: PDF, Word, PowerPoint, Excel, PNG y JPG (lista cerrada por extensión y firma del archivo; nunca html ni svg). El binario vive en `entrega_archivo_contenido` (bytea); el resto de consultas nunca lo carga. Si algo pesa más, se usa el enlace.
  - Subida por `POST /api/entregas` (multipart; fuera del proxy, con sesión del servidor y comprobación de origen) y descarga por `GET /api/entregas/archivos/[id]`: verifica membresía (sin acceso = 404), responde `attachment` con `nosniff` y sin caché. El nombre se sanea al guardar.
  - Para producción el acceso a los bytes se cambia por almacenamiento de objetos (S3/R2) sin tocar las reglas; ver sección 13.
- El `enlace_trabajo` del grupo sigue siendo opcional y distinto del enlace de una entrega.

### 8.5 Métricas del grupo (siempre calculadas, nunca guardadas)

- **Avance del grupo** = suma del `peso` de tareas `completada` ÷ suma del `peso` de todas las tareas. Sin tareas, muestra "sin tareas" en lugar de 0 %.
- **Carga de un integrante** = suma del `peso` que se le asignó ÷ suma del `peso` **asignado** (las tareas sin responsable no son carga de nadie; el avance del grupo sí las incluye). Sirve para detectar que el líder le cargó todo a dos personas.
- **Cumplimiento de un integrante** = suma del `peso` completado ÷ suma del `peso` asignado.
- **Puntualidad** = tareas entregadas a tiempo ÷ tareas entregadas con fecha límite. La entrega se mide con la **primera vez que la tarea pasó a `en_revision` desde que se le asignó al responsable actual** según `tarea_historial` (no con `fecha_terminada`, que se borra al devolverla), para no penalizar al asignado si el revisor tarda. Se compara con la **fecha límite vigente cuando se le asignó** (confirmado, 2026-11-09): reprogramar después no borra el atraso. Opcional: cuántas veces se devolvió cada tarea.
- Excluye a los observadores de todas las métricas.
- Las tareas `descartada` quedan fuera del avance, la carga, el cumplimiento y la puntualidad (como "Removed" en Azure); su historial se conserva.
- **No hay ranking ni puntaje único.** Muestra carga y cumplimiento lado a lado.
- **Feed de actividad del grupo** = lectura de `tarea_historial`. No lleva tabla propia.
- **Disponibilidad del grupo** (pestaña "Horarios", `src/lib/disponibilidad.ts`): ocupado de cada integrante aceptado no observador = `horario_curso` de sus cursos activos + sus `bloque_ocupado`, sobre la semana tipo. La vista abre en la semana calendario actual (lunes a domingo) y permite navegar a la semana anterior o siguiente. Las reuniones ya programadas de ese mismo grupo dentro de la semana visible se superponen al patrón: bloquean la franja para todo el grupo, se muestran en la pestaña y se excluyen de las sugerencias, sin convertirse en eventos recurrentes. Se muestra en franjas de 30 min entre 7 AM y 11 PM, con cuántos están libres y **quién falta por nombre**, nunca el motivo (tipo de bloque ni curso). Huecos en común = franjas consecutivas de 1 h o más con todos libres; si no hay, los de "falta una persona". Los observadores no ven esta pestaña.

### 8.6 Notificaciones

- Una fila de `notificacion` por **destinatario**, no por evento. Hay dos canales: campana dentro de la app (siempre) y correo (según el evento).
- El servidor genera la notificación en el mismo código que ejecuta la acción (dentro de la misma transacción cuando sea posible) usando **plantillas en código**, una por `tipo` (`src/server/notifications/templates.ts`). La fila guarda el resultado final (`mensaje` y `enlace`), no la plantilla.
- `enlace` es una **ruta relativa** (por ejemplo `/grupos/12/tareas/45`), generada siempre por el servidor. Nunca la construyas con texto que escriba un usuario. Al enviar un correo, arma la URL completa con `APP_URL`.
- **Un enlace no es seguridad:** la página de destino debe verificar que quien entra es integrante del grupo.
- **Nunca notifiques a quien realizó la acción.** Los observadores no reciben notificaciones de tareas en el MVP.
- Eventos y destinatarios (política "solo lo que importa por correo", confirmada por el usuario el 2026-10-29):

| Evento | `tipo` | Destinatarios | ¿Correo? |
|---|---|---|---|
| Invitan a un grupo | `invitacion_grupo` | El invitado | Sí |
| Responden una invitación | `invitacion_respondida` | Quien invitó | No |
| Asignan o reasignan una tarea (al crearla con responsable o después; no al crearla sin responsable ni al tomarla uno mismo, 2026-11-22) | `tarea_asignada` | El nuevo asignado | Sí |
| Una tarea pasa a `en_revision` | `tarea_en_revision` | Integrantes aceptados que no sean observadores ni el asignado | Sí |
| Devuelven una tarea a `en_progreso` | `tarea_devuelta` | El asignado | Sí |
| Una tarea queda `completada` | `tarea_completada` | El asignado | No |
| El líder aprueba su propia entrega | `tarea_completada` | Integrantes aceptados no observadores, menos el líder | No |
| El líder reabre una tarea | `tarea_reabierta` | El asignado | No |
| Cambia la fecha límite de una tarea | `tarea_reprogramada` | El asignado | No |
| El líder descarta una tarea | `tarea_descartada` | El asignado | No |
| Cambio a `en_progreso` | — | Nadie (solo queda en el historial) | No |
| Programan una reunión | `reunion_programada` | Integrantes aceptados no observadores, menos quien la programó | Sí (confirmado por el usuario, 2026-11-02) |
| Inicia una videollamada (entra la primera persona) | `reunion_iniciada` | Integrantes aceptados no observadores, menos quien entró primero | Sí (aprobado 2026-11-20) |
| Termina una videollamada (botón o cierre automático) | `reunion_finalizada` | Integrantes aceptados no observadores, menos quien finalizó | Sí, silenciable con `correo_actividad` (aprobado 2026-11-20) |
| Un integrante sale del grupo | `integrante_salio` | El líder (o quien queda como líder) | No |
| Registras una evaluación | `evaluacion_creada` | **El propio dueño** (excepción a "nunca notifiques a quien realizó la acción", pedida por el usuario 2026-11-16) | Sí |

- Mantén la **lista de eventos que envían correo en un único lugar** (una constante o archivo de configuración), para poder cambiar la política sin tocar la lógica.
- `grupo_integrante.correo_actividad = false` silencia los correos de **actividad** de ese grupo (revisión, completada). Los importantes (invitaciones, tareas asignadas o devueltas y reuniones programadas) siguen llegando.
- `estado_correo`: `no_aplica` | `pendiente` | `enviado` | `fallido`. Los avisos solo dentro de la app usan `no_aplica`. Tras intentar el envío, actualiza a `enviado` o `fallido`. No construyas reintentos automáticos en el MVP.
- **Envío de correo detrás de una interfaz `EmailSender`** con dos implementaciones:
  - `ConsoleEmailSender` (desarrollo): imprime el correo en consola.
  - `ResendEmailSender` (demo/producción): usa el `id_notificacion` como clave de idempotencia para que un reintento no duplique el correo.
- Límites de Resend en el plan gratuito: tope diario de envíos para toda la app y necesidad de verificar un dominio propio para escribir a terceros. Por eso el correo se reserva para lo que exige acción de alguien.

### 8.7 Reuniones (confirmado)

- Módulo propio en el sidebar: `/reuniones` lista las de todos mis grupos (filtro por grupo) y `/reuniones/nueva?grupo=` las programa. También se llega desde la pestaña "Horarios" del grupo (botón o un hueco en común, que precarga la próxima fecha de ese día).
- Las programan el líder y los miembros (aceptados, no observadores) de un grupo `activo`. Son de **una sola vez** (sin repetición) y empiezan y terminan el mismo día. No se programan en el pasado.
- Al programar una reunión, vuelve a la pestaña **Horarios** del grupo y abre la semana que contiene la reunión creada.
- **El sistema sugiere, no obliga** (decisión del usuario): el formulario muestra como sugerencias los huecos en común de los próximos 7 días y el mapa del grupo. Se puede elegir cualquier otra hora; si pisa el horario semanal de alguien, se avisa en vivo ("Choca con el horario de …") pero se permite programarla.
- `enlace` se valida con Zod (`https://` o `http://`), igual que `grupo.enlace_trabajo`.
- Al crearla se inserta una fila de `reunion_asistente` por integrante aceptado no observador en el mismo `create` anidado: quien la programa queda `asistire`, el resto `pendiente`. Quien se une al grupo después puede responder igual (upsert).
- Responden (`asistire` | `no_asistire`) los integrantes aceptados no observadores mientras la reunión no haya terminado. Cancelan (borrar la fila; borra en cascada sus asistentes) quien la programó o el líder. Cancelar no notifica en el MVP.
- Los observadores ven las reuniones del grupo pero no son asistentes ni reciben avisos.
- Aparecen en el Calendario de cada integrante participante (solo en la vista "Todo", con su propio color), sin contar en las horas por categoría.
- **Videollamada (aprobado 2026-11-20):** una reunión puede ser `videollamada`: el servidor crea una sala privada con el `ProveedorVideo` (`src/server/video`: implementaciones `simulado` y `livekit`) y cada participante entra con un token que el servidor firma al pulsar **Unirse**. `reunion.sala_url` guarda el **nombre de la sala** de LiveKit, no una URL. Nunca se envía `sala_url` ni el permiso a componentes de cliente fuera de la página de sala. Sin grabación.
- **Ventana de la sala:** abre 10 min antes del inicio y cierra 15 min después del fin. Aviso visual en los últimos 5 min. El estado (`programada`, `sala_abierta`, `en_curso`, `por_cerrar`, `terminada`) se calcula en `src/lib/estado-reunion.ts`, nunca se guarda. No hay cron: las vencidas se cierran de forma perezosa al consultarlas (`finalizada_en` = hora de cierre).
- **Reunirse ahora:** crea en un clic una reunión que empieza ahora y dura 1 h, y entra a la sala. Solo una reunión activa por grupo (bloqueo por grupo): si ya hay una, se entra a esa. No envía `reunion_programada`; el aviso es `reunion_iniciada`.
- **Moderadores:** el líder y quien creó la reunión finalizan para todos. Los observadores ven las reuniones pero no entran a la llamada.
- **Asistencia real:** `reunion_asistente.fecha_entrada` guarda la primera vez que cada integrante pulsó Unirse. Es un dato informativo: sin porcentajes, ranking ni puntaje.
- **Salas vacías (2026-11-22):** una reunión no debe seguir "en curso" cuando ya nadie está dentro. Si quien sale cree ser la última persona, la sala llama a `salidaDeSalaAction`: el servidor pregunta al proveedor (`participantesConectados`) y, si no queda nadie, la reunión termina (`finalizada_en`, sin `id_finalizador`: se muestra "cerrada automáticamente" y se envía `reunion_finalizada`). Para sesiones caídas o pestañas cerradas (nadie avisa) hay un **cierre perezoso**: al consultar reuniones, la franja del grupo o "Reunirse ahora", una reunión iniciada hace más de 5 min (`GRACIA_SALA_VACIA_MIN`) cuya sala está vacía se termina. No hay webhooks ni cron. Si la reunión ya terminó, "Reunirse ahora" crea una nueva.
- **Cierre y reapertura (2026-11-22, `src/lib/estado-reunion.ts`, `npm run verificar:reuniones`):** antes de la hora de inicio una sala vacía **no** termina la reunión: solo se limpia `iniciadaEn` y vuelve a "sala abierta", sin `reunion_finalizada`. El aviso `reunion_iniciada` no se duplica si no hubo un cierre en medio (se omite si ya existe uno para esa reunión). Si una reunión se cerró sola por sala vacía (`finalizadaEn` y `id_finalizador` nulo) y alguien pulsa Unirse antes del cierre de la ventana (fin + 15 min), la sala se **reabre** (se limpia `finalizadaEn`, se recrea la sala en el proveedor y se reenvía `reunion_iniciada`), como Meet o Zoom. No se reabre si la finalizó un moderador ni si venció por horario (`finalizadaEn >= cierre`). Detalle, franja, listas y Bandeja ofrecen "Unirse" en ese caso. Un grupo finalizado no entrega token.
- **Otras reglas (2026-11-22):** "Reunirse ahora" dura 1 h pero se recorta a las 23:59 (Lima) para no cruzar la medianoche (en el último minuto del día el inicio se adelanta a 23:58). Solo se finaliza una videollamada con la sala abierta. No se programa una reunión que empiece en el pasado y la fecha debe existir (no 2026-02-31). Responder asistencia se permite mientras la reunión no haya terminado (también ya iniciada). Una reunión cerrada antes de su fin ocupa solo hasta `finalizadaEn` en Horarios y Calendario (cerrada antes de su inicio, nada). Los asistentes y conteos incluyen solo integrantes que siguen `aceptada` y no observadores.
- **Cámara o micrófono ocupados:** no impiden entrar. Si el navegador no puede abrirlos (otra aplicación los usa, por ejemplo una llamada de Meet, o falta el permiso), la persona entra sin ellos, ve un aviso en español y puede activarlos después desde los botones. No se trata como fallo de conexión.
- **Actualización automática:** las pantallas que ofrecen "Unirse" a una sala abierta (detalle, franja y listas de reuniones, panel de la Bandeja) se refrescan cada 15 s con la pestaña visible (`RefrescoEnVivo`), para que el botón desaparezca cuando otra persona termina la reunión. Los correos son estáticos: su botón lleva al detalle, que muestra el estado real.
- Las reuniones con enlace manual (sin videollamada) siguen funcionando como antes.

## 9. Diseño de la interfaz

Usa **Azure DevOps** como referencia visual: se siente profesional, densa en información pero legible, pensada para seguir el estado de un vistazo. Es **inspiración, no copia**: no uses sus logos, íconos ni marca.

**Estructura general**

- Barra superior: migas de pan y buscador de personas (Ctrl K). El nombre del producto y el usuario (menú con tema y cerrar sesión) están en la barra lateral, que se puede colapsar.
- **Móvil y tablet (rama `feature/ui-mobile`, Claude Design):** la barra lateral completa solo desde `lg` (1024 px). En tablet (`md`) hay un riel de 80 px (Menú, Inicio, Grupos, Calendario, Bandeja, Cursos y avatar) y la búsqueda es un ícono. En móvil (<768 px, `useEsMovil`) hay una barra inferior con Inicio, Grupos, Calendario, Bandeja y Tú (`/tu`: perfil, cursos, reuniones y cuenta), títulos de 30 px con acciones de 44 px arriba a la derecha (`EncabezadoMovil`), filtros como chips, formularios y detalles en hojas inferiores, tablero de una columna por vez y FAB solo en el grupo. Calendario y Horarios del grupo se ven como franja de días más la agenda o los tramos del día elegido. Objetivos táctiles de 44 px como mínimo.
- Barra lateral izquierda con íconos: Inicio, Bandeja (con contador), Calendario, Reuniones, Cursos, Grupos y Perfil. **No hay módulo Invitaciones**: `/invitaciones` redirige a la Bandeja, filtro Invitaciones (pendientes con Aceptar/Rechazar e historial).
- **Bandeja (2026-11-16):** cada aviso se lista con un título corto (qué pasó) y su objeto (sobre qué); el detalle va al panel derecho: quién lo hizo, cuándo, el motivo, y los datos de la tarea, invitación, reunión o evaluación (`src/lib/bandeja.ts`).
- **Marca:** monograma "e" de Claude Design (`src/components/marca/monograma.tsx`, `src/app/icon.svg`). El tema arranca en claro.
- **SEO:** cada página define su título (`%s · EduControl`). Solo `/login` se indexa; el resto lleva `noindex` y `robots.txt` lo bloquea. Hay `sitemap.xml`, `manifest`, imagen Open Graph e ícono de Apple generados con `next/og`.
- Migas de pan (*breadcrumbs*) y pestañas dentro de cada página. Página de un grupo: **Tareas · Integrantes · Horarios · Reuniones · Actividad · Configuración**.
- Detalles y ediciones en paneles laterales o diálogos controlados por la URL (`?tarea=`, `?evaluacion=`, `?editar=1`), para que se puedan compartir y cerrar con "atrás".
- Sin textos de ayuda ni avisos explicativos de relleno: la interfaz debe entenderse sola.

**Cursos:** tabla con filtro en vivo (curso, docente, modalidad, horario, próxima evaluación, grupos) y alta en panel lateral. Cada curso tiene un color propio que **se deriva de su id** (`src/lib/color-curso.ts`); no hay columna de color en la base de datos.

**Tareas**

- Vista de **tablero** tipo Azure Boards con cuatro columnas (Pendiente, En progreso, En revisión, Completada) y vista de **lista/tabla** con columnas Título, Asignado a (avatar y nombre), Estado, Peso y Fecha límite.
- Para que el tablero no se acumule (como Jira): la columna Completada muestra solo lo completado en los últimos 14 días, con un enlace a las anteriores en la lista. Las `descartada` no aparecen en el tablero ni en la lista por defecto; se ven filtrando por estado "Descartada".
- Etiquetas calculadas en tarjetas y lista: "Vencida" (abierta con fecha pasada) y "Entregada con atraso" (completada después de su fecha vigente).
- Barra de filtros con desplegables (estado y responsable). El tablero se mueve arrastrando; las acciones que piden motivo se hacen en el detalle.
- Estado con **ícono de forma + color** (`StatusIcon`): pendiente gris (círculo vacío), en progreso ámbar (mitad), en revisión violeta (tres cuartos), completada verde (check), descartada gris atenuado (tachado). Las evaluaciones usan los mismos íconos.

**Avance:** barra de progreso o dona para el avance del grupo; carga y cumplimiento por integrante lado a lado, sin ranking.

**Color de reunión:** cian (`cat-reunion`), distinto del violeta de En revisión.

**Estilo visual** (valores orientativos, defínelos como variables CSS o tokens de Tailwind para poder ajustarlos):

- Paleta **"Tinta"** (estructura tipo Plane/Jira, diseñada en Claude Design): tema claro por defecto y tema oscuro completo, elegibles por el usuario. Tokens en `src/app/globals.css`.
- Primario tinta (`#18181b` en claro, `#ededed` en oscuro); el único azul es el anillo de foco. Superficies blancas, barra lateral gris muy claro, bordes finos y sombras suaves solo en el tema claro.
- Radio base de 8 px, texto base de 13–14 px, tipografía **Geist** y **Geist Mono** (via `next/font/google`).
- Componentes densos y compactos, con estados de carga (*skeletons*), estados vacíos y mensajes de error claros.

**Reglas transversales**

- **Responsivo y móvil primero:** los estudiantes consultarán desde el celular.
- Textos de la interfaz **en español (Perú)**. Fechas en lenguaje natural y relativas a hoy, siempre en America/Lima: "Hoy", "Mañana", "Mar 24", "Mar 24 nov" (de otro año: "Lun 5 nov 2025"); la fecha completa ("martes 24 de noviembre de 2026, 11:59pm") va en el `title` y en los correos (`src/lib/formato-fecha.ts#fechaCorta` y `#fechaCompleta`). Horas en 12 h, siempre con minutos y sin espacio: `7:00pm`, rangos `7:00pm - 9:30pm` (`src/lib/formato-fecha.ts#formatoHora` y `#rangoHoras`, pedido del usuario 2026-11-16).
- Accesibilidad básica: contraste suficiente, navegación por teclado y foco visible.
- Usa los componentes de shadcn/ui y los íconos de lucide-react ya instalados; no agregues otra librería de componentes, íconos o animaciones sin consultarlo.

## 10. Convenciones de código y de trabajo

- **Idioma del código:** los nombres de dominio (modelos, tablas, funciones de negocio) van en español, coherentes con el esquema (`crearGrupo`, `marcarTareaEnRevision`). Los términos técnicos genéricos van en inglés (`handler`, `service`). Sin tildes ni ñ en identificadores. Comentarios en español, breves y solo cuando explican el porqué.
- TypeScript estricto. Evita `any`.
- **Validación:** todo dato que llegue de un formulario, una Server Action o un Route Handler se valida con Zod **en el servidor** (la validación del cliente es solo comodidad). Valida también fechas (`fecha_cierre >= fecha_apertura`), longitudes (`biografia` ≤ 300), valores de enums y URLs `https://`. No agregues una librería de formularios sin consultarlo.
- **Autorización explícita** en cada operación sobre grupos, tareas y notificaciones. Los datos de un usuario nunca se leen por un id que venga del cliente sin verificar que le pertenece.
- Errores: mensajes al usuario en español y sin exponer detalles internos.
- **Seguridad:** no registres secretos en logs; no confíes en el navegador para saber quién es el usuario; sanea y valida cualquier URL que un usuario pueda ingresar.
- **Git:** ramas `main` (producción futura), `develop` (integración y staging futuro) y `feature/<nombre>`. Commits con *Conventional Commits*, descripción en español. **No hagas commit ni push sin que el usuario lo pida.**
- **Dependencias:** no agregues ninguna sin consultar; prefiere lo que ya está (Next.js, Prisma, Zod, Tailwind).
- **Pruebas:** no hay framework de pruebas; pregunta antes de agregar uno. Hay dos verificaciones con `node:assert` que usan una base temporal: `npm run verificar:tareas-grupos` (reglas de servicio) y `npm run verificar:acciones-tarea-http` (la app compilada por HTTP; requiere `npm run build`). Ver `docs/verificacion-tareas-grupos.md`. Mantén las reglas de negocio en funciones puras para que puedan probarse.
- Trabaja en **pasos pequeños y verificables**. Antes de dar algo por terminado, corre `npx tsc --noEmit` y `npm run lint`.

## 11. Entorno local y comandos

Ejemplo de `docker-compose.yml` para PostgreSQL:

```yaml
services:
  db:
    image: postgres:<VERSION_MAYOR>   # fija una versión mayor concreta, la misma que ofrezca Render
    container_name: educontrol-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: educontrol
      POSTGRES_PASSWORD: educontrol_dev
      POSTGRES_DB: educontrol
    ports:
      - "5432:5432"      # si ya hay un PostgreSQL local en 5432, usa "5433:5432" y ajusta DATABASE_URL
    volumes:
      - educontrol_pgdata:/var/lib/postgresql/data

volumes:
  educontrol_pgdata:
```

Variables de entorno (documéntalas en `.env.example` sin valores reales; los nombres de las variables de auth dependen de la librería elegida):

```
DATABASE_URL=postgresql://educontrol:educontrol_dev@localhost:5432/educontrol?schema=public
APP_URL=http://localhost:3000
# Google OAuth: ID y secreto del cliente, y secreto para firmar la sesión
# Correo: EMAIL_PROVIDER (`console` | `resend`); con Resend, RESEND_API_KEY y EMAIL_FROM
# Video: VIDEO_PROVIDER (`simulado` | `livekit`); con LiveKit, LIVEKIT_URL (pública, wss://), LIVEKIT_API_KEY y LIVEKIT_API_SECRET (solo servidor)
```

Comandos habituales (confirma los scripts reales en `package.json`):

```
docker compose up -d                        # levantar PostgreSQL
npx prisma migrate dev --name <cambio>      # crear y aplicar migración (solo local)
npx prisma generate                         # regenerar el cliente
npx prisma db seed                          # datos de ejemplo (si está configurado)
npm run dev                                 # servidor de desarrollo
npm run lint
npx tsc --noEmit
```

Datos de ejemplo (`prisma/seed.ts`, **solo desarrollo**): varios usuarios de prueba, cursos con horarios, evaluaciones, un grupo con tareas en cada estado y su historial, y una invitación pendiente. Sirve para la demo de 10 minutos y para probar la interfaz sin cargar todo a mano.

## 12. Orden de implementación sugerido

1. `docker-compose.yml`, `.env.example`, `prisma/schema.prisma` a partir de `docs/educontrol.dbml`, primera migración y seed.
2. Login con Google, *upsert* de `usuario` y `perfil`, sesión propia y layout base (barra superior y lateral).
3. Cursos, horarios de clase y evaluaciones (CRUD con Zod).
4. Grupos: crear, buscar compañeros, invitar, aceptar o rechazar, retirar.
5. Tareas: crear, asignar, cambiar estado con historial (transacciones), tablero y lista.
6. Métricas: avance, carga, cumplimiento y feed de actividad.
7. Notificaciones dentro de la app (campana) y después el envío de correo con `EmailSender`.
8. Calendario (evaluaciones, tareas de grupo y franjas de tiempo ocupado).
9. Perfil completo y `bloque_ocupado`.
10. Pulido visual siguiendo la sección 9. Mantén el estilo consistente desde el primer paso; no lo dejes todo para el final.

## 13. Decisiones pendientes (pregunta antes de implementar)

- **Dominio definitivo de producción:** la demo ya puede usar un dominio temporal verificado mediante `EMAIL_FROM`; antes de producción se debe elegir y verificar el dominio definitivo del equipo.
- **Fechas de tarea frente a la apertura de la evaluación (pendiente, 2026-11-18):** definir qué regla aplica cuando el grupo nace de una evaluación con fecha de apertura y cuando nace de una sin apertura (por ejemplo, si la fecha límite de una tarea no puede ser anterior a la apertura). Hoy la tarea solo valida que no esté en el pasado y que no supere la fecha límite del grupo. La asignación a uno mismo o a otro integrante en "Nueva tarea" ya funciona.
- **Almacenamiento de archivos en producción (pendiente, 2026-11-18):** la demo guarda los adjuntos de las entregas en Postgres con topes bajos. Antes de producción hay que elegir almacenamiento de objetos (por ejemplo Cloudflare R2 o Supabase Storage), subir los topes y cambiar la implementación de acceso a los bytes (`entrega.ts`) sin tocar las reglas. Los archivos de estudiantes son datos personales: entra en la decisión de privacidad de abajo.
- **Framework de pruebas**, librería de formularios y React Compiler (los componentes e íconos ya se decidieron: ver sección 4).
- **Recordatorios de evaluaciones (pendiente, 2026-11-16):** avisos en la Bandeja y por correo a 7 y 3 días del cierre (no si ya está terminada). Falta decidir cómo se disparan: ruta protegida llamada por GitHub Actions, revisión al entrar a la app, o ambas. El correo de "evaluación creada" ya funciona.
- **Privacidad:** con usuarios reales aplica la Ley 29733 de Protección de Datos Personales (Perú). Antes de abrir la app hacen falta política de privacidad, términos y consentimiento; lo decide el equipo, no lo improvises.

## 14. Lo que NO debes hacer

- No implementes integraciones con Moodle, Google Calendar, Gmail ni pagos.
- No pidas más scopes de Google que `openid`, `email` y `profile`, ni guardes tokens de Google.
- No agregues contraseñas, registro propio ni recuperación de cuenta.
- No crees tareas personales ni subida de archivos fuera de una entrega de tarea; no superes los topes de 8.4 ni aceptes tipos fuera de la lista.
- No borres filas de `usuario`, `grupo_integrante`, `tarea` ni `tarea_historial`. Una tarea que ya no se hará se descarta.
- No confíes en un id de usuario que venga del cliente; no dejes rutas de grupo sin verificar membresía.
- No expongas el `detalle` de un bloque ocupado a nadie más que su dueño, ni la disponibilidad a quien no sea compañero (ver 8.2).
- No guardes cifras derivadas (avance, carga, cumplimiento, tiempo libre) en la base de datos.
- No hardcodees URLs, dominios ni secretos; no subas `.env` a Git.
- No agregues dependencias, columnas o tablas fuera de lo definido sin preguntar.
- No hagas commit ni push sin que el usuario lo pida.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
