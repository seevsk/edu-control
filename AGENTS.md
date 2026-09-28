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
- Solo existe el scaffold de `create-next-app` (Next.js App Router, TypeScript, ESLint, Tailwind CSS, carpeta `src/`, alias `@/*`).
- **Aún no existe:** base de datos, esquema Prisma, autenticación ni ninguna funcionalidad.
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

**Las tareas existen solo dentro de grupos.** No hay tareas personales en el MVP.

### Fuera (no implementar ni preparar integraciones)

- Integración con **Moodle** (HU-019, HU-020, HU-021). EduControl es 100% independiente: todo dato lo carga el usuario.
- Sincronización con **Google Calendar** y envío por la **API de Gmail** (HU-016, HU-022, HU-023). El calendario y las notificaciones son propios.
- **Pagos académicos** (HU-024, HU-025, HU-026) y cualquier API del centro educativo.
- **Recuperación de acceso** (HU-002): no aplica, porque no hay contraseñas propias; la recuperación la gestiona Google.
- Subida de archivos o capturas como evidencia de tareas (descartado por complejidad).
- Ranking o puntaje único de participación (ver sección 8.5).
- **Candidato a futuro, no implementar sin aprobación:** sugerir horarios comunes del grupo cruzando disponibilidad. El modelo ya lo soporta.

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
| Backend | TypeScript dentro del mismo proyecto Next.js (Route Handlers y Server Actions). **No hay backend separado ni CORS** |
| Base de datos | PostgreSQL |
| ORM y migraciones | Prisma |
| Validación | Zod (esquemas compartidos entre cliente y servidor) |
| Autenticación | Google OAuth únicamente, flujo manual con `openid-client` + `jose` (ver 8.1) |
| Correo | Resend (cuando exista dominio verificado; ver 8.6) |
| Entorno local | Docker solo para PostgreSQL |
| Control de versiones | GitHub |
| Gestión del proyecto | Azure DevOps |
| Pruebas de API | Postman |

Notas:

- **Consulta siempre la documentación vigente** de Next.js, Prisma, Zod y la librería de auth antes de implementar: sus APIs cambian entre versiones mayores. La versión instalada está en `package.json`; no te fíes de tu memoria para APIs recientes.
- Si `next.config.ts` tiene el React Compiler activado, no escribas `useMemo`, `useCallback` ni `React.memo` a mano.
- Valida las variables de entorno al arrancar con Zod (por ejemplo en `src/lib/env.ts`).

## 5. Entornos y despliegue

**Por ahora todo se ejecuta en local.** No agregues configuración de despliegue (ni `render.yaml`, ni Dockerfile de la app, ni CI de despliegue) hasta que se pida.

### Local (actual)

- Next.js con `npm run dev`.
- PostgreSQL en un contenedor Docker (ver sección 11). La app **no** se ejecuta dentro de Docker.
- Los correos no se envían de verdad: se registran en consola (ver 8.6).

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
    (app)/                # Área autenticada: inicio, cursos, calendario, grupos, invitaciones, perfil
    api/                  # Route Handlers, solo si hacen falta
  server/
    auth/                 # Sesión y helpers de usuario autenticado
    db/                   # Cliente de Prisma
    services/             # Reglas de negocio (grupos, tareas, notificaciones, disponibilidad, métricas)
    email/                # Interfaz EmailSender + implementaciones (consola, Resend)
    notifications/        # Plantillas por tipo de notificación
  lib/
    validation/           # Esquemas Zod compartidos
    dates/                # Conversión UTC <-> America/Lima y utilidades de horario
    env.ts
  components/
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

**La especificación exacta está en `docs/educontrol.dbml`** (11 tablas). Si ese archivo no existe, pídelo al usuario; no inventes el esquema. Una vez creado `prisma/schema.prisma`, este pasa a ser la fuente de verdad y el `.dbml` se actualiza en el mismo cambio.

| Tabla | Propósito |
|---|---|
| `usuario` | Identidad que viene de Google (`google_id` es el ancla). Se anonimiza en vez de borrarse (`eliminado_en`) |
| `perfil` | 1:1 con `usuario`. Datos que edita la persona: `tipo_cuenta`, institución, carrera, ciclo, biografía, `trabaja`, `visible_en_busqueda` |
| `bloque_ocupado` | Patrón semanal de tiempo no disponible (laboral, familiar, personal) |
| `curso` | Cursos que cada usuario registra para sí mismo |
| `horario_curso` | Sesiones semanales de un curso (un curso puede tener varias) |
| `evaluacion` | Evaluaciones de un curso, con ventana de apertura y cierre |
| `grupo` | Trabajo grupal, con su propia fecha límite y enlace del trabajo |
| `grupo_integrante` | Pertenencia a un grupo: rol, estado de invitación, preferencia de correo |
| `tarea` | Tareas de un grupo, con responsable, estado y peso |
| `tarea_historial` | Registro inmutable de cambios de cada tarea |
| `notificacion` | Avisos por destinatario, con estado de envío de correo |

**Lo que NO tiene tabla** (se calcula con consultas): el calendario, el avance del grupo, la carga y el cumplimiento por integrante, el feed de actividad y el tiempo libre.

### Convenciones para Prisma

- Modelos en PascalCase y en español: `Usuario`, `Perfil`, `BloqueOcupado`, `Curso`, `HorarioCurso`, `Evaluacion`, `Grupo`, `GrupoIntegrante`, `Tarea`, `TareaHistorial`, `Notificacion`.
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
- **Eliminar cuenta = anonimizar:** poner `eliminado_en`, vaciar nombre, apellidos, correo y foto, borrar `perfil` y `bloque_ocupado`, y conservar `tarea` y `tarea_historial` (para no romper los grupos).

### 8.2 Cursos, horarios, evaluaciones y calendario

- Cada usuario registra **sus propios cursos** a mano. No hay importación externa. `modalidad`: `presencial` | `remoto`. `activo = false` cuando termina el ciclo.
- `horario_curso` es un patrón **semanal** (día 1 = lunes … 7 = domingo), pero en la práctica los cursos no dictan clase en domingo: la UI y la validación limitan `horario_curso` a **1-6 (lunes a sábado)**. `bloque_ocupado` sí usa el rango completo 1-7. Un curso puede tener varias sesiones.
- `bloque_ocupado` es un patrón semanal **personal**: `laboral` | `familiar` | `personal`. `dia_semana` es el día en que **empieza** el bloque. Si `hora_fin < hora_inicio`, el bloque cruza la medianoche (turno nocturno). Valida que `hora_inicio != hora_fin`.
- **Tiempo ocupado** de un usuario = `horario_curso` de sus cursos activos + sus `bloque_ocupado`. **El tiempo libre se calcula restando; nunca se guarda.** Los solapes se calculan en TypeScript.
- `evaluacion`: pertenece a un curso. `fecha_cierre` es obligatoria. `fecha_apertura` es opcional (una evaluación presencial no tiene ventana). Si el usuario solo indica el día, usa **23:59 (America/Lima)** como hora de cierre. `requiere_entrega` indica si se sube algo; `fecha_entrega` la marca el propio usuario (`NULL` = aún no entrega) y es autodeclarada, no verificada.
- **El calendario es una vista, no una tabla.** Eventos con fecha: cierres de evaluaciones y fechas límite de tareas de grupo. Patrones semanales (`horario_curso` y `bloque_ocupado`): franjas de fondo proyectadas sobre los días de la semana mostrada. Un bloque que cruza la medianoche se dibuja hasta las 24:00 de un día y desde las 00:00 del siguiente.
- **Fechas:** se guardan en UTC y se muestran en `America/Lima` (UTC-5, sin horario de verano). Centraliza la conversión en `src/lib/dates`.
- La disponibilidad es información sensible: a otros integrantes del grupo solo se les puede mostrar **ocupado/libre**, nunca el tipo de bloque ni el curso.

### 8.3 Grupos e invitaciones

- Al crear un grupo, **en la misma transacción**, inserta al creador en `grupo_integrante` con `rol = 'lider'` y `estado_invitacion = 'aceptada'`.
- `grupo.fecha_limite` vive en el grupo. Si el creador elige una `evaluacion`, su fecha de cierre se **copia una vez** para precargar. Las evaluaciones son de cada usuario, por eso el grupo no depende de ellas.
- `grupo.enlace_trabajo` (Drive, Word online, repo…) es opcional. **Valida con Zod que empiece con `https://` o `http://`** antes de guardarlo; rechaza cualquier otro esquema (por ejemplo `javascript:`).
- `grupo.estado`: `activo` | `finalizado`. Un grupo finalizado es de solo lectura.
- **Invitaciones:** el líder busca a un usuario ya registrado y crea una fila con `estado_invitacion = 'pendiente'`. **El invitado acepta o rechaza dentro de la web**, nunca desde un enlace del correo (no hay tokens de aceptación). Al responder se llena `fecha_respuesta`.
- Estados: `pendiente` | `aceptada` | `rechazada` | `retirado`. **Solo los integrantes `aceptada` cuentan** para asignaciones, métricas, notificaciones y permisos.
- **Retirar a un integrante:** cambia su estado a `retirado`; **no borres la fila** (conserva su historial de aporte). Desasigna sus tareas abiertas y registra el cambio en `tarea_historial`.
- Roles: `lider` | `miembro` | `observador`.
  - **Observador:** solo lectura de tareas, avance e historial. No cuenta en las métricas, no se le asignan tareas y **no ve los `bloque_ocupado` de nadie**. Así se incorpora a un profesor: el grupo lo invita como observador.
- Permisos por defecto (confirmado): el líder invita, retira y edita el grupo; líder y miembros crean y asignan tareas.
- Un grupo solo es visible para sus integrantes. **Verifica membresía y rol en cada acceso a datos de un grupo.**

### 8.4 Tareas

- Las tareas pertenecen siempre a un grupo. `id_asignado` debe ser un integrante `aceptada` que no sea observador (o `NULL` si está sin asignar).
- `peso`: 1 a 3, lo define el grupo al crear la tarea.
- Estados: `pendiente` → `en_progreso` → `en_revision` → `completada`.

| Transición | Quién |
|---|---|
| `pendiente` → `en_progreso` | El asignado (o el líder) |
| `en_progreso` → `en_revision` | El asignado. Significa "terminé". Se llena `fecha_terminada` |
| `en_revision` → `completada` | Cualquier integrante aceptado (no observador) que no sea el asignado (confirmado) |
| `en_revision` → `en_progreso` | Otro integrante, al devolverla. Se borra `fecha_terminada` |

  Rechaza cualquier otra transición. Si el equipo pide más flexibilidad, se amplía esta tabla. La revisión del trabajo real ocurre fuera de la app (el revisor abre el documento del grupo); la app solo registra quién confirmó y cuándo.
- **Cada cambio de `estado` o de `id_asignado` escribe una fila en `tarea_historial` dentro de la misma transacción que actualiza la tarea.** Lee el valor anterior **antes** de actualizar:
  - `accion`: `creada` | `estado` | `reasignada`.
  - `valor_anterior` y `valor_nuevo`: texto. En `reasignada` guarda el **id del usuario**, no el nombre. En `creada` ambos son `NULL`.
  - `id_usuario` sale de la sesión del servidor.
- El historial nunca se edita ni se borra.
- No hay evidencia adjunta por tarea. Como mucho, el `enlace_trabajo` del grupo.

### 8.5 Métricas del grupo (siempre calculadas, nunca guardadas)

- **Avance del grupo** = suma del `peso` de tareas `completada` ÷ suma del `peso` de todas las tareas. Sin tareas, muestra "sin tareas" en lugar de 0 %.
- **Carga de un integrante** = suma del `peso` que se le asignó ÷ suma del `peso` total. Sirve para detectar que el líder le cargó todo a dos personas.
- **Cumplimiento de un integrante** = suma del `peso` completado ÷ suma del `peso` asignado.
- **Puntualidad** = tareas entregadas a tiempo ÷ tareas entregadas con fecha límite. La entrega se mide con la **primera vez que la tarea pasó a `en_revision`** según `tarea_historial` (no con `fecha_terminada`, que se borra al devolverla), para no penalizar al asignado si el revisor tarda. Opcional: cuántas veces se devolvió cada tarea.
- Excluye a los observadores de todas las métricas.
- **No hay ranking ni puntaje único.** Muestra carga y cumplimiento lado a lado.
- **Feed de actividad del grupo** = lectura de `tarea_historial`. No lleva tabla propia.

### 8.6 Notificaciones

- Una fila de `notificacion` por **destinatario**, no por evento. Hay dos canales: campana dentro de la app (siempre) y correo (según el evento).
- El servidor genera la notificación en el mismo código que ejecuta la acción (dentro de la misma transacción cuando sea posible) usando **plantillas en código**, una por `tipo` (`src/server/notifications/templates.ts`). La fila guarda el resultado final (`mensaje` y `enlace`), no la plantilla.
- `enlace` es una **ruta relativa** (por ejemplo `/grupos/12/tareas/45`), generada siempre por el servidor. Nunca la construyas con texto que escriba un usuario. Al enviar un correo, arma la URL completa con `APP_URL`.
- **Un enlace no es seguridad:** la página de destino debe verificar que quien entra es integrante del grupo.
- **Nunca notifiques a quien realizó la acción.** Los observadores no reciben notificaciones de tareas en el MVP.
- Eventos y destinatarios (política por defecto = "solo lo que importa por correo"; pendiente de confirmar, ver sección 13):

| Evento | `tipo` | Destinatarios | ¿Correo? |
|---|---|---|---|
| Invitan a un grupo | `invitacion_grupo` | El invitado | Sí |
| Responden una invitación | `invitacion_respondida` | Quien invitó | No |
| Asignan o reasignan una tarea | `tarea_asignada` | El nuevo asignado | Sí |
| Una tarea pasa a `en_revision` | `tarea_en_revision` | Integrantes aceptados que no sean observadores ni el asignado | Sí |
| Devuelven una tarea a `en_progreso` | `tarea_devuelta` | El asignado | Sí |
| Una tarea queda `completada` | `tarea_completada` | El asignado | No |
| Cambio a `en_progreso` | — | Nadie (solo queda en el historial) | No |

- Mantén la **lista de eventos que envían correo en un único lugar** (una constante o archivo de configuración), para poder cambiar la política sin tocar la lógica.
- `grupo_integrante.correo_actividad = false` silencia los correos de **actividad** de ese grupo (revisión, completada). Los importantes (invitaciones, tareas asignadas o devueltas) siguen llegando.
- `estado_correo`: `no_aplica` | `pendiente` | `enviado` | `fallido`. Los avisos solo dentro de la app usan `no_aplica`. Tras intentar el envío, actualiza a `enviado` o `fallido`. No construyas reintentos automáticos en el MVP.
- **Envío de correo detrás de una interfaz `EmailSender`** con dos implementaciones:
  - `ConsoleEmailSender` (desarrollo): imprime el correo en consola.
  - `ResendEmailSender` (cuando exista dominio verificado): usa el `id_notificacion` como clave de idempotencia para que un reintento no duplique el correo.
- Límites de Resend en el plan gratuito: tope diario de envíos para toda la app y necesidad de verificar un dominio propio para escribir a terceros. Por eso el correo se reserva para lo que exige acción de alguien.

## 9. Diseño de la interfaz

Usa **Azure DevOps** como referencia visual: se siente profesional, densa en información pero legible, pensada para seguir el estado de un vistazo. Es **inspiración, no copia**: no uses sus logos, íconos ni marca.

**Estructura general**

- Barra superior: nombre del producto, búsqueda, campana de notificaciones y avatar.
- Barra lateral izquierda con íconos: Inicio, Cursos, Calendario, Grupos, Invitaciones (con contador si hay pendientes) y Perfil.
- Migas de pan (*breadcrumbs*) y pestañas dentro de cada página. Ejemplo, página de un grupo: **Resumen · Tareas · Integrantes · Actividad**.
- Franjas informativas en azul claro para avisos (por ejemplo, "Tienes 2 invitaciones pendientes").

**Tarjetas de curso** (como las tarjetas de proyecto de Azure DevOps): cuadrado de color con las **iniciales** del curso, nombre, código, docente, chip de modalidad, próxima clase y próximas evaluaciones, y un menú `⋯`. El color se **deriva de un hash del nombre o código**; no hay columna de color en la base de datos.

**Tareas**

- Vista de **tablero** tipo Azure Boards con cuatro columnas (Pendiente, En progreso, En revisión, Completada) y vista de **lista/tabla** con columnas Título, Asignado a (avatar y nombre), Estado, Peso y Fecha límite.
- Barra de filtros con búsqueda por palabra y filtros desplegables (asignado, estado).
- Estado con **punto de color + texto**, como en Azure DevOps: pendiente gris, en progreso azul, en revisión ámbar, completada verde.

**Avance:** barra de progreso o dona para el avance del grupo; carga y cumplimiento por integrante lado a lado, sin ranking.

**Estilo visual** (valores orientativos, defínelos como variables CSS o tokens de Tailwind para poder ajustarlos):

- Tema claro primero; deja preparados los tokens para un tema oscuro futuro.
- Color primario azul cercano a `#0078D4`; superficies blancas; neutros muy claros para el fondo; bordes finos y sombras sutiles.
- Radios pequeños (2–4 px), texto base de 14 px, tipografía `"Segoe UI", system-ui, sans-serif`.
- Componentes densos y compactos, con estados de carga (*skeletons*), estados vacíos y mensajes de error claros.

**Reglas transversales**

- **Responsivo y móvil primero:** los estudiantes consultarán desde el celular.
- Textos de la interfaz **en español (Perú)**. Fechas `dd/mm/aaaa`, horas en formato de 24 h (evita ambigüedades con turnos nocturnos).
- Accesibilidad básica: contraste suficiente, navegación por teclado y foco visible.
- No agregues una librería de componentes ni de íconos sin consultarlo.

## 10. Convenciones de código y de trabajo

- **Idioma del código:** los nombres de dominio (modelos, tablas, funciones de negocio) van en español, coherentes con el esquema (`crearGrupo`, `marcarTareaEnRevision`). Los términos técnicos genéricos van en inglés (`handler`, `service`). Sin tildes ni ñ en identificadores. Comentarios en español, breves y solo cuando explican el porqué.
- TypeScript estricto. Evita `any`.
- **Validación:** todo dato que llegue de un formulario, una Server Action o un Route Handler se valida con Zod **en el servidor** (la validación del cliente es solo comodidad). Valida también fechas (`fecha_cierre >= fecha_apertura`), longitudes (`biografia` ≤ 300), valores de enums y URLs `https://`. No agregues una librería de formularios sin consultarlo.
- **Autorización explícita** en cada operación sobre grupos, tareas y notificaciones. Los datos de un usuario nunca se leen por un id que venga del cliente sin verificar que le pertenece.
- Errores: mensajes al usuario en español y sin exponer detalles internos.
- **Seguridad:** no registres secretos en logs; no confíes en el navegador para saber quién es el usuario; sanea y valida cualquier URL que un usuario pueda ingresar.
- **Git:** ramas `main` (producción futura), `develop` (integración y staging futuro) y `feature/<nombre>`. Commits con *Conventional Commits*, descripción en español. **No hagas commit ni push sin que el usuario lo pida.**
- **Dependencias:** no agregues ninguna sin consultar; prefiere lo que ya está (Next.js, Prisma, Zod, Tailwind).
- **Pruebas:** no hay framework de pruebas definido; pregunta antes de agregar uno. Mantén las reglas de negocio en funciones puras para que puedan probarse.
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
# Correo (cuando exista dominio verificado): RESEND_API_KEY y EMAIL_FROM
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

- **Política de correos:** todos los cambios a todos, solo lo importante (supuesto actual) o lo importante más un resumen periódico.
- **Dominio y Resend:** aún no hay dominio verificado. Mientras tanto, los correos se registran en consola.
- **Reapertura** de una tarea `completada` y transiciones de estado adicionales.
- **Framework de pruebas**, librería de formularios, librería de componentes e íconos, y React Compiler.
- **Privacidad:** con usuarios reales aplica la Ley 29733 de Protección de Datos Personales (Perú). Antes de abrir la app hacen falta política de privacidad, términos y consentimiento; lo decide el equipo, no lo improvises.

## 14. Lo que NO debes hacer

- No implementes integraciones con Moodle, Google Calendar, Gmail ni pagos.
- No pidas más scopes de Google que `openid`, `email` y `profile`, ni guardes tokens de Google.
- No agregues contraseñas, registro propio ni recuperación de cuenta.
- No crees tareas personales ni subida de archivos.
- No borres filas de `usuario`, `grupo_integrante` ni `tarea_historial`.
- No confíes en un id de usuario que venga del cliente; no dejes rutas de grupo sin verificar membresía.
- No expongas a otros usuarios el tipo de un bloque ocupado ni el detalle de la disponibilidad.
- No guardes cifras derivadas (avance, carga, cumplimiento, tiempo libre) en la base de datos.
- No hardcodees URLs, dominios ni secretos; no subas `.env` a Git.
- No agregues dependencias, columnas o tablas fuera de lo definido sin preguntar.
- No hagas commit ni push sin que el usuario lo pida. tomate tu tiempo en leer todo el plan, si necesitas dudas en algo avisame.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
