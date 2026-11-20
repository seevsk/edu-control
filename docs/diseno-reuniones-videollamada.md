# EduControl · Reuniones con videollamada: flujo de pantallas

Brief para **Claude Design**. Describe qué pantallas cambian o se crean en el módulo Reuniones para integrar videollamadas propias (proveedor: **Daily**, incrustado). No describe código: el plan de desarrollo se escribe después, a partir de las pantallas aprobadas.

Fecha: 2026-11-20 · Estado: pendiente de diseño

---

## 1. Contexto en 30 segundos

- EduControl es una web para estudiantes: cursos, evaluaciones, calendario y **trabajos grupales** (tareas, integrantes, horarios, reuniones).
- Hoy una reunión es un formulario: título, fecha, hora y un **enlace que el usuario pega a mano** (Meet, Zoom…). La reunión ocurre fuera de la app.
- **Lo nuevo:** la videollamada se crea y ocurre **dentro de EduControl**. Ningún integrante necesita cuenta en otro servicio: entra con su sesión de EduControl.
- Nuevo atajo **"Reunirse ahora"**: en dos clics el grupo está en llamada.

### Roles que importan

| Rol en el grupo | Ve las reuniones | Programa / Reunirse ahora | Entra a la llamada | Modera (silenciar, sacar, finalizar) |
|---|---|---|---|---|
| Líder | Sí | Sí | Sí | Sí |
| Miembro | Sí | Sí | Sí | Solo en las que él programó o inició |
| Observador | Sí | No | **No** | No |

Solo los integrantes **aceptados** de un grupo **activo** pueden programar o entrar. Un grupo finalizado muestra sus reuniones en solo lectura.

---

## 2. Sistema visual (no inventar uno nuevo)

Respeta lo que ya existe en la app:

- Paleta **"Tinta"**: tema claro por defecto y oscuro completo. Primario tinta (`#18181b` claro / `#ededed` oscuro). El único azul es el anillo de foco. Tokens en `src/app/globals.css`.
- Reuniones ya tienen su color de categoría: `cat-reunion` (franja vertical de 3 px en filas y en el Calendario).
- Tipografía **Geist** / **Geist Mono**, texto base 13–14 px, radio 8 px, interfaz densa tipo Azure DevOps / Plane.
- Componentes shadcn/ui e íconos **lucide-react** (ya instalados). Sugeridos: `Video`, `VideoOff`, `PhoneOff`, `ExternalLink`, `Radio` o un punto pulsante para "En curso".
- Fechas y horas: "Hoy", "Mañana", "Mar 24"; horas en 12 h sin espacio: `7:00pm`, rangos `7:00pm - 8:00pm`.
- **Minimalismo textual:** sin textos de ayuda, notas ni párrafos explicativos. La interfaz se entiende sola. Solo etiquetas, estados y mensajes de error.
- **Móvil primero.** Breakpoints actuales:
  - Móvil (< 768 px): barra inferior (Inicio, Grupos, Calendario, Bandeja, Tú), títulos de 30 px, acciones de 44 px arriba a la derecha, formularios en hojas inferiores, FAB solo dentro del grupo.
  - Tablet (`md`): riel lateral de 80 px.
  - Escritorio (`lg`, 1024 px): barra lateral completa.
- Objetivos táctiles de 44 px como mínimo, foco visible y contraste suficiente.

---

## 3. Estados de una reunión

Toda la UI depende de este ciclo. Ninguno se guarda como columna "estado": se calculan con la hora actual.

| Estado | Cuándo | Qué puede hacer un participante |
|---|---|---|
| **Programada** | Faltan más de 10 min para el inicio | Confirmar asistencia, cancelar (si puede) |
| **Sala abierta** | Desde 10 min antes del inicio | **Unirse** |
| **En curso** | Alguien ya entró y aún no termina | **Unirse** |
| **Por cerrar** | Faltan 5 min o menos para que la sala se cierre | Unirse; aviso visible en la llamada |
| **Terminada** | Alguien la finalizó, o pasaron 15 min desde la hora de fin | Ver quién entró |

- La sala se cierra sola **15 minutos después de la hora de fin** y saca a quien siga dentro.
- Una reunión con videollamada que se cancela desaparece. Hoy ya se borra al cancelar.

**Indicador visual sugerido:**
- *En curso:* punto pulsante + texto "En curso", con el color de `cat-reunion` o de estado activo.
- *Sala abierta:* texto "Sala abierta".
- *Terminada:* texto atenuado.

---

## 4. Mapa de pantallas

```
Grupo › pestaña Reuniones ──┬── [Reunirse ahora] ───────────────► Sala de la reunión (llamada)
                            ├── [Programar reunión] ─► Nueva reunión ─► Grupo › Horarios (como hoy)
                            └── fila de reunión ──────────────────► Detalle de la reunión
Módulo Reuniones (/reuniones) ── fila ─────────────────────────────► Detalle de la reunión
Detalle de la reunión ── [Unirse] ─────────────────────────────────► Sala de la reunión
Bandeja ── aviso "inició una reunión" ── [Unirse] ─────────────────► Sala de la reunión
Calendario ── evento de reunión ───────────────────────────────────► Detalle de la reunión
Sala ── [Salir] / [Finalizar para todos] ──────────────────────────► Detalle de la reunión (terminada)
```

| # | Pantalla | Ruta | Tipo |
|---|---|---|---|
| P1 | Pestaña Reuniones del grupo | `/grupos/[id]/reuniones` | **Cambia** |
| P2 | Encabezado del grupo: aviso de reunión en curso | todas las pestañas de `/grupos/[id]` | **Nuevo elemento** |
| P3 | Módulo Reuniones | `/reuniones` | **Cambia** |
| P4 | Nueva reunión (formulario) | `/reuniones/nueva?grupo=` | **Cambia** |
| P5 | Detalle de la reunión | `/reuniones/[id]` | **Nueva** |
| P6 | Sala de la reunión (llamada incrustada) | `/reuniones/[id]/sala` | **Nueva** |
| P7 | Diálogos: Reunirse ahora, Finalizar para todos | sobre P1, P2 y P6 | **Nuevos** |
| P8 | Bandeja: avisos de inicio y fin | `/bandeja` | **Cambia** |
| P9 | Correos: inicio y fin | correo | **Nuevos** |
| P10 | Calendario | `/calendario` | **Cambio menor** |

---

## 5. Pantallas en detalle

### P1 · Pestaña Reuniones del grupo (`/grupos/[id]/reuniones`) — cambia

**Hoy:** lista "Próximas" y "Pasadas". Cada fila tiene fecha, hora, una franja `cat-reunion`, el título, lugar o "Virtual", "hasta {hora}" y "X de Y asistirán". Arriba a la derecha está el botón "Programar reunión". Cada fila enlaza a `/reuniones?grupo=…#reunion-…`.

**Cambios:**
1. **Acción principal doble** en el encabezado del grupo, para líder y miembros de un grupo activo:
   - Primario: **"Reunirse ahora"** (ícono `Video`).
   - Secundario: **"Programar reunión"** (ícono `CalendarPlus`, el actual).
   - Si ya hay una reunión en curso en el grupo, el primario cambia a **"Unirse a la reunión en curso"**.
2. **Nueva sección "En curso"** arriba de "Próximas", solo si hay una reunión en curso. Es una fila destacada con:
   - punto pulsante;
   - título;
   - "Iniciada por {Nombre} · hace 12 min" o "desde 7:00pm";
   - "hasta 8:00pm";
   - avatares de quién entró;
   - botón **Unirse**.
3. Cada fila de **Próximas** suma:
   - ícono `Video` si es videollamada de EduControl;
   - etiqueta "Sala abierta" cuando corresponde;
   - botón **Unirse** a la derecha si la sala está abierta (además del conteo de asistencia).
4. Cada fila de **Pasadas** muestra "**{n} entraron**" (dato real) en vez de "X de Y asistirán".
5. Las filas enlazan al **Detalle de la reunión** (P5), no a la lista general.
6. Observadores: ven todo, sin botones Unirse ni Reunirse ahora.

**Móvil:** el FAB del grupo, en esta pestaña, es **"Reunirse ahora"**. "Programar" va como acción de 44 px en el encabezado. La fila "En curso" ocupa todo el ancho, con el botón Unirse de 44 px.

**Estados vacíos:** sin reuniones, una línea corta y los dos botones. Sin texto explicativo largo; hoy hay un párrafo que conviene acortar.

### P2 · Aviso de reunión en curso en el encabezado del grupo — nuevo

Mientras haya una reunión en curso, todas las pestañas del grupo (Tareas, Integrantes, Horarios, Reuniones, Actividad, Configuración) muestran **una franja compacta** bajo el encabezado:

`● En curso · {Título} · desde 7:00pm  [Unirse]`

- Una sola línea, densa, que no empuje mucho el contenido.
- No se puede descartar mientras siga en curso.
- Observadores: ven la franja sin botón.
- Móvil: franja fija bajo el título del grupo, con el botón Unirse de 44 px.

### P3 · Módulo Reuniones (`/reuniones`) — cambia

**Hoy:** filtro por grupo (pestañas), sección "Próximas" con tarjeta por reunión (fecha en bloque, título, grupo, fecha y horario, lugar, "Abrir enlace", avatares de quién asistirá, botones Asistiré / No asistiré y "Cancelar reunión"), y "Anteriores".

**Cambios:**
1. Sección **"En curso"** arriba, con las reuniones en curso de **todos** mis grupos, cada una con botón **Unirse**.
2. En cada tarjeta de Próximas:
   - si es videollamada de EduControl, se reemplaza "Abrir enlace" por el botón **Unirse**, deshabilitado hasta que la sala abra;
   - el estado ("Sala abierta", "Empieza en 25 min") se muestra junto al horario;
   - las reuniones con enlace manual siguen mostrando "Abrir enlace" como hoy.
3. Toda la tarjeta enlaza al Detalle (P5); los botones internos conservan su acción.
4. En Anteriores: "{n} entraron" con avatares.
5. Junto a "Programar reunión", un botón **"Reunirse ahora"** que pide elegir el grupo (P7a) si tengo más de uno donde puedo.

### P4 · Nueva reunión (`/reuniones/nueva?grupo=`) — cambia

**Hoy:** grupo (select), sugerencias de huecos en común (chips), título, fecha, desde, hasta, aviso en vivo ("Todos libres" / "Choca con el horario de …"), lugar (opcional), enlace (opcional) y el botón "Programar reunión".

**Cambios:**
1. Nuevo control **"Videollamada en EduControl"** (interruptor o segmento), **activado por defecto**, ubicado antes de Lugar/Enlace.
   - **Activado:** se oculta el campo Enlace. Se puede mantener "Lugar" para reuniones mixtas.
   - **Desactivado:** vuelve el campo Enlace manual, como hoy.
2. Sin más cambios: sugerencias, avisos de choque y la redirección final a la pestaña Horarios se conservan.
3. **Error al crear la sala** (el proveedor no responde): mensaje en línea "No se pudo crear la videollamada." con dos acciones: **Reintentar** y **Usar un enlace propio** (desactiva el interruptor y enfoca el campo Enlace). La reunión no se crea hasta que el usuario elija.

**Móvil:** el formulario sigue en hoja inferior; el interruptor es una fila completa de 44 px.

### P5 · Detalle de la reunión (`/reuniones/[id]`) — nueva

Hoy no existe. Es la página a la que llevan las filas, la Bandeja y el Calendario.

**Contenido (escritorio, columna central como el resto de detalles):**
- Migas: Reuniones › {Grupo} › {Título}.
- Título; grupo (enlace al grupo); fecha y horario; lugar si hay; ícono `Video` + "Videollamada en EduControl", o el enlace manual.
- **Bloque de estado** (el elemento principal de la página), según la sección 3:
  - *Programada:* "Empieza {Hoy, 7:00pm}" + "Sala disponible desde 6:50pm". Botón **Unirse** deshabilitado.
  - *Sala abierta / En curso:* botón primario grande **Unirse** + quién entró (avatares).
  - *Terminada:* "Terminó {7:52pm}" + duración ("52 min") + "**Entraron**: avatares y nombres con hora de entrada".
- **Asistencia:**
  - antes de empezar: Asistiré / No asistiré (como hoy) y el resumen de respuestas;
  - después de terminar: dos listas lado a lado, **"Confirmaron"** y **"Entraron"**. Sin porcentajes, ranking ni "faltó" en rojo: es un dato, no una sanción.
- **Acciones secundarias** (menú `…` o pie de página):
  - Cancelar reunión (quien la programó o el líder, solo antes de empezar);
  - Finalizar para todos (moderadores, solo en curso).
- Observadores: ven todo sin Unirse, sin respuesta de asistencia y sin acciones.

**Móvil:** título de 30 px, bloque de estado en la parte superior y botón **Unirse** fijo abajo (barra de acción de 44 px por encima de la barra inferior) mientras la sala esté abierta o en curso.

**Errores:**
- reunión inexistente o sin acceso: 404 de la app (ya existe);
- sala cerrada: estado "Terminada".

### P6 · Sala de la reunión (`/reuniones/[id]/sala`) — nueva

La llamada ocurre **dentro de EduControl**. El área de video la dibuja Daily (su interfaz "Prebuilt": cámaras, micrófono, compartir pantalla, chat). **No diseñar los controles de video**: solo el marco de EduControl alrededor.

**Escritorio:**
- Se oculta la barra lateral y se maximiza el área de video. Queda una **barra superior compacta** de EduControl:
  - izquierda: botón volver (`←`, vuelve a P5 tras confirmar si estás en llamada) · **título** · grupo;
  - centro: punto "En curso" + **tiempo restante** hasta el cierre ("Cierra en 42 min"); en los últimos 5 min cambia a énfasis de advertencia: "**Cierra en 4 min**";
  - derecha: **Abrir en pestaña nueva** (`ExternalLink`) · **Finalizar para todos** (solo moderadores, estilo destructivo secundario) · **Salir** (`PhoneOff`).
- El resto de la pantalla es el iframe de la llamada, a todo el ancho y alto disponibles.
- Antes de entrar, la propia interfaz de Daily muestra su **vista previa de cámara y micrófono** (pide permisos del navegador). EduControl no la replica.

**Móvil:**
- Pantalla completa: sin barra inferior de navegación.
- Barra superior mínima: volver · título truncado · tiempo restante · menú `…` con "Abrir en pestaña nueva", "Finalizar para todos" (si aplica) y "Salir".
- Debe funcionar en vertical. El iframe ocupa el resto.

**Estados de la sala:**
- *Cargando:* skeleton del área de video con el título visible.
- *Aún no abre* (alguien abrió el enlace antes de tiempo): pantalla vacía centrada con "La sala abre a las 6:50pm" y el botón **Volver**. Sin iframe.
- *Terminada:* "Esta reunión terminó" + **Ver detalle**.
- *Expulsado por cierre:* al cerrarse la sala, la app vuelve sola a P5 en estado Terminada.
- *Error del proveedor:* "No se pudo conectar a la videollamada." + **Reintentar** + **Volver**.
- *Sin permiso de cámara o micrófono:* lo maneja la interfaz de Daily; no diseñar.

### P7 · Diálogos — nuevos

**P7a · Reunirse ahora**
- Desde el grupo (P1/P2), **no hay diálogo**: un clic crea la reunión y lleva a la Sala (P6). El botón muestra estado de carga ("Creando sala…") mientras tanto.
- Desde `/reuniones` (P3), si el usuario tiene más de un grupo posible: un diálogo pequeño (hoja inferior en móvil) con la lista de grupos y el botón **Reunirse**. Con un solo grupo, no hay diálogo.
- Valores automáticos (no se muestran como formulario): título "Reunión de {Grupo}", inicio ahora, fin en 1 hora.
- Si mientras tanto otro integrante ya inició una, el usuario entra a **esa** reunión. En la Sala aparece un toast breve: "{Nombre} ya había iniciado la reunión".

**P7b · Finalizar para todos**
- Confirmación: "¿Finalizar la reunión para todos?" con botones **Finalizar** (destructivo) y **Cancelar**.
- Al confirmar, todos salen de la llamada y la reunión pasa a Terminada.

**P7c · Salir**
- Sin confirmación: sale de la llamada y vuelve a P5. La reunión sigue en curso para los demás.

### P8 · Bandeja — cambia

La Bandeja lista cada aviso con **título corto (qué pasó)** + **objeto (sobre qué)**, y el detalle va en el panel derecho (patrón actual, `src/lib/bandeja.ts`). Nuevos tipos de aviso:

| Aviso | Título corto | Objeto | Panel derecho | Acción |
|---|---|---|---|---|
| Inicio | "Reunión iniciada" | {Título} · {Grupo} | Quién la inició, desde qué hora, hasta qué hora | **Unirse** (deshabilitado si ya terminó: "Ya terminó") |
| Fin | "Reunión terminada" | {Título} · {Grupo} | Duración, quiénes entraron (avatares), quién la finalizó o "cerrada automáticamente" | **Ver detalle** |

- Se envían a los integrantes aceptados no observadores, **menos quien realizó la acción** (quien inició o finalizó).
- "Inicio" se dispara cuando **la primera persona entra** a la sala. Aplica igual a "Reunirse ahora" y a reuniones programadas.
- El aviso existente "Reunión programada" se mantiene sin cambios.

### P9 · Correos — nuevos

Mismo estilo que los correos actuales (por ejemplo "reunión programada"):

- **Inicio:**
  - Asunto: "{Nombre} inició una reunión en {Grupo}".
  - Cuerpo: título, hora de inicio y fin en formato completo ("jueves 20 de noviembre de 2026, 7:00pm").
  - Botón **Unirse a la reunión**, que lleva a P5. Si pide sesión, primero el login.
- **Fin:**
  - Asunto: "Terminó la reunión {Título}".
  - Cuerpo: duración y quiénes entraron.
  - Botón **Ver detalle**.

### P10 · Calendario — cambio menor

- Los eventos de reunión con videollamada llevan el ícono `Video`.
- Una reunión en curso muestra el punto "En curso".
- Al hacer clic se abre el Detalle (P5).

---

## 6. Textos de la interfaz (español de Perú)

| Clave | Texto |
|---|---|
| Botón inmediato | Reunirse ahora |
| Botón inmediato con reunión activa | Unirse a la reunión en curso |
| Botón unirse | Unirse |
| Interruptor del formulario | Videollamada en EduControl |
| Estado | En curso · Sala abierta · Empieza en {25 min} · Terminada |
| Cierre | Cierra en {42 min} |
| Moderación | Finalizar para todos |
| Salida | Salir |
| Pestaña nueva | Abrir en pestaña nueva |
| Asistencia real | {n} entraron |
| Sala aún cerrada | La sala abre a las {6:50pm} |
| Error de creación | No se pudo crear la videollamada. |
| Error de conexión | No se pudo conectar a la videollamada. |
| Carga | Creando sala… |

---

## 7. Fuera de alcance (no diseñar)

- Grabación de reuniones.
- Acta o notas de la reunión, y acuerdos que pasan a tareas (posible mejora futura).
- Observadores dentro de la llamada.
- Chat propio, reacciones o controles de video propios: los da la interfaz de Daily.
- Integración con Zoom, Google Meet o Teams. Solo se conserva el enlace manual.
- Reuniones recurrentes.
- Conteo en vivo de "conectados ahora". Se muestra **quién entró**, no quién sigue dentro.

---

## 8. Entregables que se esperan de Claude Design

1. P1, P3, P4, P5 y P6 en **escritorio y móvil**, en tema **claro y oscuro**.
2. P5 en sus cuatro estados: Programada, Sala abierta, En curso y Terminada.
3. P6 en sus estados: cargando, en llamada (con el iframe representado como un bloque), por cerrar, aún no abre, terminada y error.
4. P2 (franja "En curso") sobre al menos una pestaña del grupo.
5. P7a (selector de grupo), P7b, y P8 (fila y panel de la Bandeja para inicio y fin).
6. El componente del indicador "En curso" y el botón **Unirse** como piezas reutilizables.
