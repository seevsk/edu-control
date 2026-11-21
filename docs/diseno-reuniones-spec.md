# EduControl · Reuniones con videollamada: especificación de implementación

Traducción a código de los tableros de Claude Design (artefacto "Reuniones con videollamada", tableros `R-W00…R-W20`, `R-T01…R-T05`, `R-M01…R-M20`, temas claro y oscuro). Complementa el brief `docs/diseno-reuniones-videollamada.md`: aquí van medidas, textos, componentes y datos; el brief sigue mandando en reglas de negocio.

Fecha: 2026-11-20 · Estado: lista para escribir el plan de desarrollo

---

## 0. Decisiones que prevalecen sobre el diseño

1. **Franja "En curso" (P2):** en todas las pestañas del grupo **excepto Reuniones**, donde la sección "En curso" cumple ese papel. El diseño ya lo hace así en escritorio (W01), tablet (T01) y móvil (M01, la franja está con `display:none`), pero **el tablero del observador (W04) sí la muestra en Reuniones: ignorarlo**. La nota del diseñador lo dejaba "por confirmar"; queda confirmado.
2. **Color de reunión:** el morado del diseño choca con `estado-en-revision`. Se define un color nuevo y único con tres tokens (valores claro y oscuro los fija el plan):

   | Token | Uso | Dónde |
   |---|---|---|
   | `reunion` (sólido) | Relleno y anillo del punto pulsante; franja vertical de 3 px en filas; ícono `Video` en filas, metadatos e interruptor; bordes con opacidad (`border-reunion/20` a `/40`) | `PuntoEnCurso`, `FilaReunion`, `BloqueEstado`, bloque de fecha activo, fila del interruptor |
   | `reunion-soft` (fondo 8-12 %) | Fondo de la píldora "En curso", de la franja P2, de la fila/tarjeta "En curso", del bloque de estado (sala abierta / en curso), del bloque de fecha activo, del círculo de ícono en la Bandeja y de la fila del interruptor | Todo fondo tintado de reunión |
   | `reunion-fg` (texto) | Texto "En curso", "Sala abierta" (+ `DoorOpen`), "HOY 20" del bloque de fecha activo, "En curso" dentro del selector de grupo | Todo texto con color de reunión |

   - Registrar en `:root`, en `.dark` y en `@theme` (`--color-reunion`, `--color-reunion-soft`, `--color-reunion-fg`) para tener `bg-reunion`, `bg-reunion-soft`, `text-reunion-fg`, `border-reunion/30`, etc.
   - Hoy existe `cat-reunion` (+ `-bg`, `-fg`, `-borde`), usado en filas y Calendario. Recomendación: que `cat-reunion*` apunte a los nuevos tokens (`cat-reunion` → `reunion`, `-bg` → `reunion-soft`, `-fg` → `reunion-fg`) para que Calendario, filas y franja usen el mismo color.
   - En el diseño los fondos usan 5 %, 6 %, 8 % y 12 % según el elemento. Se unifican en `reunion-soft`. Si el bloque de estado queda muy fuerte, usar `bg-reunion/5` solo ahí.
   - En oscuro, el diseño sube la opacidad de las píldoras (14 % frente a 12 %) y la del pulso (55 % frente a 50 %): reflejarlo en el valor oscuro de `reunion-soft`.
3. **Observadores:** ven todas las reuniones, la franja y la sección "En curso", pero **sin** "Unirse", "Reunirse ahora", "Programar", respuesta de asistencia ni menú de acciones. En el lugar del botón, el módulo muestra `Eye` + "Observador" (W06).

---

## 1. Componentes reutilizables (R-W00)

Ubicación sugerida: `src/components/ui-app/reuniones/`. Íconos de `lucide-react`.

### 1.1 Equivalencia de íconos del diseño

| SVG del diseño | lucide | Dónde aparece |
|---|---|---|
| Cámara con triángulo | `Video` | Unirse, Reunirse ahora, filas, metadatos, interruptor, estado vacío, Bandeja |
| Calendario con + | `CalendarPlus` | Programar reunión, Bandeja "Reunión programada" |
| Puerta abierta | `DoorOpen` | "Sala abierta", estado "Esta reunión terminó" |
| Reloj | `Clock` | "Empieza en…", "Cierra en…", Desde/Hasta, "La sala abre…" |
| Calendario | `Calendar` | Fecha en detalle y formulario |
| Personas | `Users` | Línea de grupo en el detalle |
| Pin | `MapPin` | Lugar |
| Flecha `<` | `ChevronLeft` | Volver (móvil y sala) |
| Tres puntos | `MoreHorizontal` (`Ellipsis`) | Más acciones |
| Equis | `X` | Cerrar diálogo/hoja; "Finalizar para todos" en el menú móvil |
| Check | `Check` | "Asistiré", "Todos libres", "Asistirás" |
| Flecha a caja | `ExternalLink` | Abrir en pestaña nueva, Abrir enlace |
| Teléfono tachado | `PhoneOff` | Salir |
| Círculo con ! | `CircleAlert` | Errores |
| Flecha circular | `RotateCw` | Reintentar |
| Eslabón | `Link` | Usar un enlace propio |
| Arco | `LoaderCircle` + `animate-spin` | Creando sala… |
| Ojo | `Eye` | Rol observador |
| Papelera | `Trash2` | Cancelar reunión |
| `v` | `ChevronDown` | Select de grupo |
| Lupa | `Search` | Buscar (tablet) |

### 1.2 `PuntoEnCurso` (diseño: LiveDot)

- Props: `tamano?: 6 | 7 | 8 | 10` (por defecto 8), `className`.
- `span` redondo, `bg-reunion`, `aria-hidden`. Nunca va solo: siempre acompaña un texto ("En curso", "Cierra en…").
- Tamaños de uso: 6 px en el selector de grupo (P7a), 7 px dentro de la píldora y en la cabecera de sala móvil, 8 px en la franja y en la cabecera de sala de escritorio.
- **Pulso:** `box-shadow` de `0 0 0 0` con `reunion` al 50 % a `0 0 0 7px` transparente (70 %) y vuelta a 0; `1.8s ease-out infinite`.
  - Definir `@keyframes reunion-pulso` en `globals.css` dentro de `@media (prefers-reduced-motion: no-preference)` (igual que `animate-page-in`), con `color-mix(in oklab, var(--reunion) 50%, transparent)`; clase `animate-reunion-pulso`.
  - Con `prefers-reduced-motion: reduce`: sin animación, punto estático.

### 1.3 `EstadoReunion` (diseño: MeetingState)

Props: `estado: "en_curso" | "sala_abierta" | "empieza" | "por_cerrar" | "terminada"`, `tamano?: "md" | "lg"`, `minutos?: number`, `texto?: string` (para "Mañana" u otra etiqueta relativa).

| Variante | Forma | Clases |
|---|---|---|
| `en_curso` md | Píldora: punto 7 px + "En curso" | `inline-flex items-center gap-1.5 h-[22px] pl-2 pr-[9px] rounded-full bg-reunion-soft text-reunion-fg text-xs font-semibold whitespace-nowrap` |
| `en_curso` lg | Igual, 26 px de alto y 13 px | `h-[26px] text-[13px]` (usado en el bloque de estado de P5) |
| `sala_abierta` | Sin píldora: `DoorOpen` 13 px + "Sala abierta" | `inline-flex items-center gap-[5px] text-xs font-semibold text-reunion-fg` |
| `empieza` | `Clock` 13 px + "Empieza en 25 min" (o "Mañana") | `inline-flex items-center gap-[5px] text-xs text-muted-foreground` |
| `por_cerrar` | Píldora de advertencia: `Clock` 13 px (trazo 2.2) + "Cierra en 4 min" | `h-[22px] px-[9px] rounded-full bg-hoy/12 text-hoy text-xs font-semibold` (el token `hoy` coincide con el ámbar del diseño en claro y oscuro) |
| `terminada` | Solo texto "Terminada" | `text-xs text-subtle-foreground` |

### 1.4 `BotonUnirse` (diseño: JoinButton)

- Props: `href` (a `/reuniones/[id]/sala`) o `onClick`, `tamano: "s" | "m" | "l" | "tactil" | "barra"`, `deshabilitado?`, `cargando?`, `texto?` (por defecto "Unirse"; también "Reunirse ahora", "Unirse a la reunión en curso", "Reunirse").
- Base: primario, `inline-flex items-center justify-center gap-[7px] font-semibold whitespace-nowrap border border-primary bg-primary text-primary-foreground`, ícono `Video`.

| Tamaño | Alto | Padding | Radio | Texto | Ícono | Uso |
|---|---|---|---|---|---|---|
| `s` | 30 px | 0 14 px | 8 px | 13 px | 15 px | Filas de escritorio, franja P2 escritorio |
| `m` | 32 px | 0 14 px | 8 px | 13 px | 15 px | Encabezado del grupo y del módulo, fila "En curso" |
| `l` | 40 px | 0 14 px | 8 px | 14 px | 15 px | Bloque de estado P5, panel de la Bandeja |
| `tactil` | 44 px | 0 18 px | 12 px | 15 px | 17 px | Móvil y tablet (filas, franja, encabezado) |
| `barra` | 50 px, `w-full` | 0 18 px | 12 px | 15 px | 17 px | Barra fija inferior de P5 móvil, hojas inferiores |

- **Deshabilitado** (sala sin abrir): `aria-disabled="true"`, `bg-accent text-subtle-foreground border-border cursor-not-allowed`. Usar `aria-disabled` (no `disabled`) para que siga siendo enfocable.
- **Creando sala:** `aria-disabled`, `opacity-75`, ícono `LoaderCircle animate-spin`, texto "Creando sala…".
- **Observador:** no se renderiza.

### 1.5 Acción doble del grupo

- Primario `BotonUnirse` tamaño `m` con texto "Reunirse ahora", o "Unirse a la reunión en curso" si hay una en curso (W01).
- Secundario "Programar reunión": `CalendarPlus` 14 px, h 32, padding 0 12 px, borde `border-input`, fondo transparente, 13 px peso normal. En el diseño su radio es 6 px frente a 8 px del primario: usar `Button variant="outline"` de la app y unificar el radio.
- Tablet (T01, T05): primario `tactil` (44 px) y "Programar" como botón de solo ícono de 44 × 44 px, radio 12 px y borde `border-input` (`aria-label="Programar reunión"`).
- Móvil: ver P1.

### 1.6 `FranjaEnCurso` (diseño: LiveBanner, P2)

- Props: `reunion: { idReunion, titulo, inicio }`, `puedeUnirse: boolean`.
- `role="status"`, fila `flex items-center gap-2.5`, `bg-reunion-soft`, `border-b border-reunion/20`.
- Contenido: `PuntoEnCurso` 8 px · "En curso" (`text-reunion-fg font-semibold shrink-0`) · "·" (`text-subtle-foreground`) · bloque truncable (`flex-1 min-w-0 truncate`) con **título** (`font-medium`) + " · desde 7:00pm" (`text-muted-foreground`) · `BotonUnirse` (si `puedeUnirse`).
- Escritorio: `min-h-11 px-6 text-[13px]`, Unirse `s`.
- Tablet: `min-h-14 px-5 text-sm`, Unirse `tactil`.
- Móvil: `min-h-14 px-4 text-sm`, Unirse `tactil`.
- No se puede descartar. Desaparece cuando la reunión termina.

### 1.7 `FilaReunion` (diseño: MeetingRow)

Dos variantes: `grupo` (P1, con columna de fecha) y `modulo` (P3, con bloque de fecha y grupo). Detalle en P1 y P3.

### 1.8 Otros componentes que salen de los tableros

| Nombre | Dónde | Resumen |
|---|---|---|
| `TarjetaEnCurso` | P1 y P3 (sección "En curso") | Escritorio: fila destacada. Móvil: tarjeta con Unirse a todo el ancho |
| `BloqueEstadoReunion` | P5 | Bloque principal del detalle, 4 estados |
| `ListaPersonas` | P5 | Lista con avatar 22 px, nombre, "Tú" para uno mismo y hora opcional |
| `SelectorAsistencia` | P3 y P5 | Segmentado "Asistiré / No asistiré" |
| `SelectorGrupoReunion` | P7a | Radiogroup de grupos |
| `InterruptorVideollamada` | P4 | Fila con `Switch` de shadcn |
| `MarcoSala` | P6 | Barra superior + área de video |
| `EstadoSala` | P6 | Pantalla vacía centrada (aún no abre / terminó / error) |
| `AvataresApilados` | Filas, bloques, Bandeja | Solapados −6 px con anillo de 2 px del color de fondo; 20, 22, 24 o 26 px según el contexto (usar `UserAvatar`) |

---

## 2. Pantallas

Convenciones comunes del diseño:
- Encabezado de sección de lista: `h-9 px-6 bg-muted border-b border-border-subtle text-[13px] font-medium` + contador `font-normal text-subtle-foreground` (igual que hoy).
- Fila: separador `border-b border-border-subtle`, hover `bg-muted`.
- Formato de fecha y hora con `src/lib/formato-fecha.ts` ("Hoy", "Mañana", "Lun 23"; `7:00pm`, `7:00pm - 8:00pm`).

### P1 · Pestaña Reuniones del grupo (`/grupos/[id]/reuniones`) — W01, W02, W04, W05, T01, M01, M02

**Escritorio (W01 en curso · W02 sala abierta · W04 observador · W05 vacío)**

1. Encabezado del grupo (`EncabezadoGrupo`), sin cambios salvo las acciones:
   - líder/miembro de grupo activo: acción doble (1.5). Con una reunión en curso, el primario dice "Unirse a la reunión en curso" y lleva a su sala.
   - Mientras se crea la sala: el primario pasa a "Creando sala…" (W02).
   - Observador: sin botones. La línea de contexto muestra "Inteligencia artificial · `Eye` Observador".
2. Pestañas. **Sin `FranjaEnCurso`** en esta pestaña.
3. Sección **"En curso"** (solo si hay): encabezado de sección "En curso" (sin contador) + fila destacada:
   - contenedor `flex items-center gap-3.5 px-6 py-3.5 bg-reunion-soft border-b border-reunion/20`;
   - columna izquierda: línea 1 = `EstadoReunion en_curso` + título (15 px, 600); línea 2 (13 px, `text-muted-foreground`) = "Iniciada por Valeria · hace 33 min · hasta 8:00pm". El observador (W04) ve "Iniciada por Lucía · desde 7:15pm · hasta 8:15pm";
   - avatares de quién entró (24 px);
   - `BotonUnirse m` (no para observador).
4. Sección **"Próximas {n}"**, filas `FilaReunion variante=grupo`:
   - `a` a todo el ancho → `/reuniones/[id]`; `flex items-center gap-3 min-h-14 px-6`;
   - columna de fecha de 74 px: día (13 px, `text-foreground`: "Hoy", "Mañana", "Lun 23") / hora de inicio (12 px, `text-subtle-foreground`, `mt-0.5`);
   - franja vertical 3 × 34 px, `rounded-full bg-reunion`;
   - bloque central `flex-1 min-w-0`: título 14 px con `Video` 14 px `text-reunion` delante si es videollamada (`title="Videollamada en EduControl"`); línea 2 (12 px, `text-subtle-foreground`, `mt-[3px]`): "7:00pm - 8:00pm · Videollamada", "8:00pm - 9:00pm · Videollamada · Lab 304" o, con enlace manual, "6:00pm - 7:00pm · Virtual · meet.google.com";
   - derecha `flex items-center gap-3.5`: `EstadoReunion sala_abierta` (solo si corresponde) · avatares 22 px de quienes asistirán · "2 de 3 asistirán" (12 px, `text-muted-foreground`) · `BotonUnirse s` si la sala está abierta.
5. Sección **"Pasadas {n}"**: misma fila con `opacity-85`, sin estado ni botón; a la derecha avatares de quienes entraron + "3 entraron".
6. **Vacío (W05):** centrado, `py-[120px] gap-3.5`: cuadro de 44 × 44 px, radio 12 px, `bg-accent text-muted-foreground` con `Video` · "Sin reuniones" (14 px, `text-muted-foreground`) · acción doble (Reunirse ahora + Programar reunión). Para el observador, solo el ícono y el texto (no está diseñado; es lo coherente).

**Tablet (T01)**
- Barra superior de 56 px: migas "Grupos / Grupo Nº7" (14 px) + botón `Search` de 44 px.
- Título 24 px/700; acciones: primario `tactil` + "Programar" solo ícono de 44 px.
- Pestañas `gap-6 px-5 text-sm`; activa 600 con borde inferior de 2 px.
- Fila "En curso" igual que en escritorio con `px-5 py-4` y Unirse `tactil`. Filas de lista con `px-5`; el conteo aparece como "3 de 4" (sin "asistirán"; ver dudas).

**Móvil (M01 en curso · M02 sala abierta)**
- Encabezado: "`ChevronLeft` Grupos" (44 px, 15 px) · espacio · botón de 44 px `CalendarPlus` ("Programar reunión") · botón de 44 px `MoreHorizontal` ("Más acciones del grupo"). Título del grupo 22 px/700 (no 30 px, como el resto de pantallas de grupo) y contexto 13 px.
- Pestañas `gap-[22px] px-4`, 14 px, activa 600 + borde inferior de 2 px.
- Encabezados de sección como texto (`px-4 pt-[22px] pb-2 text-[13px] font-semibold text-muted-foreground`), no como barra gris.
- **Tarjeta "En curso"**: `px-4 pt-3.5 pb-4 bg-reunion-soft border-b border-reunion/20 flex flex-col gap-2.5`:
  - fila 1: `EstadoReunion en_curso` · espacio · avatares 26 px;
  - título 17 px/600; debajo "Valeria · hace 33 min · hasta 8:00pm" (13 px, `text-muted-foreground`);
  - `BotonUnirse tactil w-full`.
- **Fila** (`min-h-[68px] px-4 py-2 gap-3`): franja de 3 × 40 px; título 15 px (+ `Video`); "Mañana · 7:00pm - 8:00pm" (13 px, subtle); línea 3 (13 px): avatares 20 px + "3 de 4 asistirán", o "`DoorOpen` Sala abierta · 2 de 3 asistirán"; a la derecha `BotonUnirse tactil` si la sala está abierta. Pasadas: `opacity-85`, avatares + "3 entraron".
- **FAB** (56 px de alto, `rounded-full`, padding 0 20 / 0 18, 15 px/600, `shadow-pop`): "Reunirse ahora" (M02). Con una reunión en curso dice "**Unirse a la reunión en curso**" (M01). Observador: sin FAB.
- Sin franja P2 en esta pestaña.

**Diferencias con el brief**
- El brief no detallaba la línea secundaria: el diseño la cambia de "{lugar o Virtual} · hasta {hora}" a "{rango} · Videollamada[ · lugar]" o "{rango} · Virtual · {dominio del enlace}".
- Se quita "· N sin responder" del conteo de la fila (hoy existe).
- En móvil el FAB cambia a "Unirse a la reunión en curso" cuando hay una en curso (el brief decía siempre "Reunirse ahora").
- Se añade el estado "Creando sala…" en el botón del encabezado (pedido en P7a, aplicado aquí).
- El texto vacío largo de hoy se reemplaza por "Sin reuniones" + ícono + botones (alineado con el brief).

### P2 · Franja "En curso" — W03, T02, M03

- `FranjaEnCurso` (1.6) en Tareas, Horarios, Integrantes, Actividad y Configuración. **No en Reuniones.**
- Posición:
  - escritorio y tablet: debajo de las pestañas, antes de la barra de herramientas de la pestaña (W03: antes de "Lista / Tablero · Nueva tarea");
  - móvil: entre el bloque título/contexto del grupo y las pestañas (M03).
- Texto exacto: "En curso · Reunión de Grupo Nº7 · desde 7:00pm" + [Unirse].
- Observador: misma franja sin botón.
- Móvil: el FAB "Nueva tarea" de Tareas se mantiene.

**Diferencias con el brief:** el brief la ponía "bajo el encabezado". El diseño la pone bajo las pestañas en escritorio y tablet, y sobre las pestañas en móvil. El brief pedía "fija" en móvil, pero el tablero no muestra si es `sticky` (ver dudas).

### P3 · Módulo Reuniones (`/reuniones`) — W06, T05, M04

**Escritorio (W06)**
1. Barra superior: migas "Reuniones".
2. Encabezado `px-8 pt-5 pb-3.5 border-b flex items-center gap-3`: h1 "Reuniones" (20 px/600) · `BotonUnirse m` "Reunirse ahora" · "Programar reunión" secundario. Los botones van junto al título.
3. Filtro por grupo: `px-8 py-2.5 border-b flex gap-1`. Píldoras `h-7 px-2.5 rounded-[7px] text-[13px]`: activa `bg-background text-foreground shadow-xs`, inactiva `text-muted-foreground`. Opciones: "Todos", "Grupo Nº7", "Grupo 11", "Grupo 3".
4. Secciones (encabezado gris de 36 px, `px-8`): "**En curso {n}**", "**Próximas {n}**", "**Anteriores**" (sin contador).
5. Fila `variante=modulo` (`a` → `/reuniones/[id]`, `flex items-center gap-3.5 min-h-[68px] px-8 border-b border-border-subtle`):
   - **bloque de fecha** 44 × 46 px, radio 10 px, borde `border-border`: día corto en mayúsculas 10 px/600 `text-subtle-foreground` ("HOY", "SÁB", "LUN", "MIÉ") / número 17 px/600. En una reunión en curso: `border-reunion/40 bg-reunion-soft` y ambos textos `text-reunion-fg`;
   - centro: título 14 px/500 (+ `Video` 14 px `text-reunion`); línea 2 (12 px, subtle, `gap-1.5`): cuadro 7 px del color del curso + grupo · horario · estado (`EstadoReunion en_curso`, `sala_abierta` o `empieza` con "Mañana");
   - avatares 22 px (quién entró si está en curso; quién asistirá si es próxima);
   - acciones (`gap-3.5`):
     - en curso: `BotonUnirse s`; para el observador, "`Eye` Observador" (12 px, subtle);
     - próxima con videollamada: `SelectorAsistencia` + `BotonUnirse s` (habilitado si la sala está abierta; deshabilitado si no);
     - próxima con enlace manual: `SelectorAsistencia` + botón secundario de 30 px "`ExternalLink` Abrir enlace", sin `Video` en el título y con línea "6:00pm - 7:00pm · Virtual";
     - anteriores: avatares de quién entró + "3 entraron".
   - Los botones internos detienen la propagación del enlace de la fila (o se colocan fuera del `a`).
6. `SelectorAsistencia`: contenedor `inline-flex gap-0.5 p-0.5 rounded-lg bg-muted border`; botones `h-[26px] px-[9px] rounded-md text-xs`; activo `bg-accent text-foreground ring-1 ring-input` (+ `Check` 12 px en "Asistiré"); inactivo `text-muted-foreground`. `role="group" aria-label="Tu asistencia"`, `aria-pressed`.

**Tablet (T05)**
- Barra superior de 56 px con "Reuniones" y `Search`. Encabezado `p-5`: h1 24 px/700 + "Reunirse ahora" `tactil` + "Programar" solo ícono de 44 px.
- Filas `px-5`; Unirse `tactil`; el resto igual.

**Móvil (M04)**
- Encabezado `px-4 pt-[54px] pb-2`: arriba a la derecha dos botones de 44 px: `CalendarPlus` ("Programar reunión") y `Video` ("Reunirse ahora"). h1 "Reuniones" 30 px/700.
- Filtro como chips `h-[34px] px-3.5 rounded-full text-sm`: activo `bg-primary text-primary-foreground`, inactivo `border border-input text-muted-foreground`; deslizables en horizontal.
- "En curso": la misma tarjeta que en P1 móvil, con línea "■ Grupo Nº7 · Valeria · 7:00pm · hasta 8:00pm".
- Filas como en P1 móvil, con línea 3: "■ Grupo 11 · `DoorOpen` Sala abierta" + `BotonUnirse tactil`; "■ Grupo Nº7 · `Check` Asistirás"; "■ Grupo Nº7 · Abrir enlace" (como texto). **Sin selector de asistencia en la lista móvil** (se responde en el detalle).
- Hoy existe `VolverMovil` hacia "Tú"; el diseño no lo muestra (ver dudas).

**Vacío / cargando / error:** no diseñados. Mantener "Sin reuniones próximas." con el estilo de lista de P1 y el `role="alert"` actual para `?error=`. Para la carga, `Skeleton` de filas de 68 px.

**Diferencias con el brief**
- Las tarjetas de hoy pasan a **filas densas** con bloque de fecha.
- **"Cancelar reunión" desaparece de la lista**; solo queda en el menú `…` del detalle.
- El texto de conteo ("N asistirán · N no · N sin responder") desaparece en el módulo de escritorio: solo quedan los avatares.
- El estado se muestra junto al horario, como pedía el brief. "Empieza en 25 min" solo aparece en el componente; en el módulo se ve `Clock` + "Mañana" (ver dudas).
- La sección "En curso" incluye las de todos mis grupos, también donde soy observador (con la etiqueta "Observador").

### P4 · Nueva reunión (`/reuniones/nueva?grupo=`) — W12, W13, M06, M07

**Escritorio (W12)**
- Migas "Reuniones / Programar". Contenedor `max-w-[640px] px-8 pt-8 pb-12`. h1 "Programar reunión" 22 px/700.
- Campos (`flex flex-col gap-[18px]`, etiqueta 13 px/500 encima):
  1. **Grupo:** select de 36 px, radio 6 px, `ChevronDown`.
  2. **Huecos en común** (hoy "Sugerencias"): chips `h-7 px-2.5 rounded-full text-[13px]` en una sola línea ("Hoy 8:00pm", "Mañana 7:00pm", "Dom 22 10:00am"); el elegido `bg-primary text-primary-foreground`, el resto `border border-input text-muted-foreground`. Hoy el chip elegido es verde y muestra "falta X" en una segunda línea: el diseño no muestra esa segunda línea (ver dudas).
  3. **Título:** input de 36 px, radio 8 px, 14 px.
  4. Grid `1.4fr 1fr 1fr gap-3`: **Fecha** (`Calendar`, "Mañana · Sáb 21") · **Desde** (`Clock`, "7:00pm") · **Hasta** (`Clock`, "8:00pm").
  5. Aviso en vivo: "`Check` Todos libres" (13 px, `text-estado-completada`). Hoy es un punto; el diseño usa `Check`. Los avisos "Choca con el horario de …" / "Coincide con la reunión …" se conservan como hoy.
  6. **`InterruptorVideollamada`:** `label` `flex items-center gap-3 min-h-12 px-3.5 rounded-[10px] border border-reunion/30 bg-reunion-soft`: `Video` `text-reunion` · "Videollamada en EduControl" (14 px/500, `flex-1`) · `Switch` (36 × 20 px, encendido `bg-primary`). **Activado por defecto.**
  7. **Lugar · opcional** (hoy "(opcional)"): input con `MapPin`, placeholder "Ej. Lab 304".
  8. **Enlace · opcional:** solo con el interruptor apagado (estado no diseñado; reutilizar el campo actual con el mismo estilo que Lugar, ícono `Link`).
- Pie: `flex gap-2`: "Cancelar" secundario (36 px) + "`CalendarPlus` Programar reunión" primario (36 px). Hoy no hay "Cancelar": vuelve a donde se vino.
- **Error (W13):** bajo el interruptor, `role="alert"` `flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-destructive/8 border border-destructive/30 text-[13px]`: `CircleAlert` `text-destructive` · "No se pudo crear la videollamada." · botones secundarios de 30 px "`RotateCw` Reintentar" y "`Link` Usar un enlace propio". "Usar un enlace propio" apaga el interruptor, muestra Enlace y lo enfoca. La reunión no se crea.

**Móvil (M06, M07)**
- Hoja inferior sobre la pestaña Reuniones del grupo (alto 790 de 844 px, radio superior 18 px, asa de 36 × 5 px, fondo `--overlay`).
- Cabecera de 48 px: "Programar reunión" 17 px/700 + `X` de 44 px.
- **Sin campo Grupo** (se abre desde el grupo).
- Chips de 36 px; inputs de 48 px y **16 px** (evita el zoom de iOS); Fecha a todo el ancho; Desde y Hasta en 2 columnas.
- Interruptor `min-h-14`, texto de 15 px.
- Botones del error de 40 px; pasan a otra línea si no caben.
- Pie fijo `px-4 pt-3 pb-[30px] border-t`: "`CalendarPlus` Programar reunión" primario de 50 px, a todo el ancho, radio 12 px. Sin botón Cancelar (cierra la `X`).

**Diferencias con el brief:** "Sugerencias" pasa a "Huecos en común"; el formulario de escritorio pasa de tarjeta a página con "Cancelar"; la fila del interruptor mide 56 px en móvil (el brief pedía 44, cumple el mínimo); no hay tablet. El resto coincide.

### P5 · Detalle de la reunión (`/reuniones/[id]`) — W08-W11, T03, M08-M11

**Escritorio**
- Migas: "Reuniones / {Grupo} / {Título}" (Reuniones y Grupo son enlaces).
- Contenedor `max-w-[760px] px-8 pt-8 pb-12 flex flex-col gap-[22px]`.
1. Fila de título: h1 24 px/700 + botón `MoreHorizontal` de 32 px ("Más acciones"), **solo si hay acciones** (W09). El menú (220 px, radio 10 px, `p-1`) tiene un ítem de 34 px: "`Trash2` Cancelar reunión" en `text-destructive`.
2. Metadatos (`min-h-7 gap-2.5 text-sm text-muted-foreground`, ícono `text-subtle-foreground`):
   - `Calendar` "Mañana · 7:00pm - 8:00pm" / "Hoy · 7:40pm - 8:30pm" / "Lun 16 · 7:00pm - 8:00pm";
   - `Users` enlace al grupo (cuadro de 8 px del color del curso + nombre, `text-foreground`);
   - `MapPin` lugar (si hay);
   - `Video` `text-reunion` "Videollamada en EduControl" (con enlace manual: "Abrir enlace", no diseñado).
3. **`BloqueEstadoReunion`** (`section aria-label="Estado"`, `rounded-[14px] p-5 flex items-center gap-4`; contenido a la izquierda y botón a la derecha):

   | Estado | Fondo/borde | Contenido | Botón |
   |---|---|---|---|
   | Programada (W08) | `bg-muted border` | "Empieza mañana, 7:00pm" (18 px/600) / "Sala disponible desde 6:50pm" (13 px, muted) | `BotonUnirse l` deshabilitado |
   | Sala abierta (W09) | `bg-reunion-soft border-reunion/30` | `EstadoReunion sala_abierta` (13 px) / "Empieza en 7 min" (18 px/600) | `BotonUnirse l` |
   | En curso (W10) | `bg-reunion-soft border-reunion/30` | `EstadoReunion en_curso lg` / "Iniciada por Valeria · 7:00pm" (18 px/600) / "Entraron" + avatares 22 px (13 px) | `BotonUnirse l` |
   | Terminada (W11) | `bg-muted border` | En una línea: "Terminó 7:52pm" (18 px/600) + "52 min · finalizada por Rodolfo" (14 px, muted) | — |

4. **Asistencia**:
   - Programada y Sala abierta: cabecera `flex gap-3`: h3 "Asistencia" (13 px/600, muted) + `SelectorAsistencia`. Debajo, grid de 2 columnas (`gap-8`): "Asistirán · 3" y "Sin responder · 1" (12 px, subtle), cada una con una lista (`li min-h-9 gap-2.5 text-sm`: avatar 22 px + nombre; uno mismo = "Tú").
   - En curso: el bloque cambia a h3 "Entraron 2" + lista con la hora de entrada a la derecha (12 px, subtle): "Valeria 7:00pm", "Rodolfo 7:06pm". Sin selector de asistencia.
   - Terminada: grid de 2 columnas "Confirmaron 4" y "Entraron 3" (esta con hora de entrada). Sin porcentajes ni marcas rojas.
5. Observador: sin Unirse, sin selector y sin `…`.

**Tablet (T03)** — barra de 56 px con las migas como texto ("Reuniones / Grupo Nº7 / Reunión de Grupo Nº7"); contenedor `max-w-[600px] p-7 gap-5`; h1 30 px/700; metadatos antes del estado; bloque de estado `p-4` con `BotonUnirse tactil w-full` **debajo** del contenido, dentro del bloque.

**Móvil (M08-M11)**
- Encabezado: "`ChevronLeft` Reuniones" (44 px) + `…` de 44 px solo si hay acciones (M09).
- `px-4 pt-1.5 flex flex-col gap-4`: h1 30 px/700 → **bloque de estado primero** (`p-4`, sin botón dentro) → metadatos → asistencia (1 columna, `gap-2`; en Terminada: "Confirmaron" encima de "Entraron").
- **Barra de acción fija** sobre la barra inferior (`bottom: 82px`, `px-4 py-2.5 bg-background border-t`) con `BotonUnirse barra`: deshabilitada en Programada (M08), activa en Sala abierta y En curso, ausente en Terminada.

**Errores:** reunión inexistente o sin acceso → 404 de la app; sala cerrada → estado Terminada.

**Diferencias con el brief**
- Texto de Programada: "Empieza mañana, 7:00pm" (el brief decía "Empieza {Hoy, 7:00pm}"; usar la etiqueta relativa en minúscula tras "Empieza").
- En Sala abierta se muestra "Empieza en 7 min" en lugar de avatares (nadie entró aún).
- En Terminada, los avatares y horas de "Entraron" salen del bloque y pasan a la lista inferior; el bloque añade "finalizada por {Nombre}".
- Antes de empezar, el diseño muestra "Asistirán" y "Sin responder" lado a lado, no un resumen. "No asistirán" no aparece (ver dudas).
- **"Finalizar para todos" no aparece en el menú del detalle** (el brief lo pedía para moderadores en curso); solo está en la sala.
- En móvil la barra fija aparece también en Programada (deshabilitada); el brief la pedía solo con la sala abierta o en curso.

### P6 · Sala (`/reuniones/[id]/sala`) — W14-W18, T04, M12-M18

**Escritorio (W14 en llamada · W15 por cerrar · W16 finalizar · W17 ya iniciada)**
- Pantalla completa sin barra lateral ni barra superior de la app (layout propio fuera de `(app)` o con el shell oculto).
- Barra superior `grid grid-cols-[1fr_auto_1fr] items-center h-[52px] pl-2 pr-3 border-b bg-background`:
  - izquierda (`gap-2`): `ChevronLeft` de 36 px (`aria-label="Volver al detalle"`) · título 14 px/600 (truncable) · cuadro de 7 px del color del curso + grupo (13 px, muted);
  - centro: `PuntoEnCurso` 8 px · "En curso" (`text-reunion-fg font-semibold`) · "· Cierra en 53 min" (13 px, muted). **Por cerrar (≤ 5 min):** se sustituye todo por `EstadoReunion por_cerrar` "Cierra en 4 min";
  - derecha (`gap-2`):
    - "`ExternalLink` Abrir en pestaña nueva": ghost, 32 px, 13 px, muted;
    - "Finalizar para todos": solo moderadores; 32 px, `border border-destructive/45 text-destructive`, 13 px/500, fondo transparente;
    - "`PhoneOff` Salir": primario, 32 px, 13 px/600.
- Área de video: `flex-1 min-h-0 p-3.5`, **oscura en ambos temas** (no sigue el tema; fondo neutro casi negro). Contiene el iframe de Daily Prebuilt a todo el ancho y alto; mosaicos y controles los dibuja Daily.
- **Toast "ya había iniciado" (W17):** centrado arriba (72 px del borde superior), 40 px de alto, radio 10 px, avatar 22 px + "Valeria ya había iniciado la reunión". Usar `sonner` (`toast`) de la app; el tablero lo pinta oscuro con texto oscuro (ilegible, ver dudas).
- **Finalizar (W16):** `AlertDialog` de 400 px, radio 14 px, alineado arriba (`pt-40`), velo `bg-black/30`: título "¿Finalizar la reunión para todos?" (16 px/600) + `X` de 32 px; pie `px-5 py-3 border-t`: "Cancelar" secundario (34 px) + "Finalizar" (34 px, `bg-destructive text-white`, 600). Sin texto de cuerpo.
- Miembro no moderador (W17, T04): no ve "Finalizar para todos".

**Tablet (T04):** igual que escritorio; "Abrir en pestaña nueva" pasa a solo ícono (`aria-label`).

**Móvil (M12-M14)**
- Sin barra inferior. Encabezado `flex items-center gap-1 pt-12 px-1 pb-1.5 border-b` (respetar `safe-area-inset-top`):
  - `ChevronLeft` de 44 px ("Volver al detalle");
  - título 15 px/600, truncado, `flex-1`;
  - `PuntoEnCurso` 7 px + "Cierra en 53 min" (12 px, muted; sin la palabra "En curso"); por cerrar: píldora `por_cerrar`;
  - `MoreHorizontal` de 44 px ("Más acciones de la llamada").
- Menú (M13): 250 px, radio 14 px, `p-1.5`, `shadow-pop`, ítems de 46 px y 15 px: "`ExternalLink` Abrir en pestaña nueva", "`X` Finalizar para todos" (`text-destructive`, solo moderadores), "`PhoneOff` Salir".
- Área de video: `p-2.5 pb-[30px]`, en vertical.
- Finalizar (M14): hoja inferior (radio superior 18 px, asa): "¿Finalizar la reunión para todos?" (18 px/700) y, apilados, `px-4 pb-[30px] gap-2`: "Finalizar" (50 px, destructivo) y debajo "Cancelar" (50 px, secundario).

**Estados (W18 y M15-M18)** — encabezado reducido: `ChevronLeft` ("Volver") + título + grupo; sin estado ni acciones. Cuerpo centrado (`flex flex-col items-center text-center gap-3.5 p-6`):

| Estado | Ícono (cuadro 48 × 48 px, radio 14 px, `bg-accent`) | Texto (17 px/600) | Botones (escritorio 34 px / móvil 50 px, ancho 260 px, apilados) |
|---|---|---|---|
| Cargando (M15) | — | — | Sin cuerpo: skeleton del área de video (mosaicos oscuros). En escritorio, barra skeleton de 120 × 10 px en el lugar del estado |
| Aún no abre (M16) | `Clock` muted | "La sala abre a las 7:30pm" | "`ChevronLeft` Volver" (secundario) |
| Terminada (M17) | `DoorOpen` muted | "Esta reunión terminó" | "Ver detalle" (primario) |
| Error (M18) | `CircleAlert` `text-destructive` | "No se pudo conectar a la videollamada." | "`RotateCw` Reintentar" (primario) + "Volver" (secundario) |

- Expulsado por cierre: volver solo a P5 (sin pantalla propia).

**Diferencias con el brief:** el volver es `ChevronLeft` (el brief decía `←`); en móvil el centro muestra solo "Cierra en…" sin "En curso"; tablet compacta "Abrir en pestaña nueva" a un ícono; el ítem "Finalizar para todos" del menú móvil lleva `X`. Lo demás coincide.

### P7 · Diálogos — W02, W07, M05, W16, M14

- **P7a Reunirse ahora**
  - Desde el grupo: sin diálogo; el botón pasa a "Creando sala…" (W02) y luego lleva a la sala.
  - Desde `/reuniones` con más de un grupo posible:
    - **Escritorio (W07):** `Dialog` de 420 px, radio 14 px, alineado arriba (`pt-40`), velo `bg-black/30`. Cabecera `pt-4 pr-4 pb-2 pl-5`: "Reunirse ahora" (16 px/600) + `X` de 32 px. Cuerpo `px-5 pt-1 pb-4`: `role="radiogroup" aria-label="Grupo"`, `gap-2`; cada opción `label min-h-11 px-3 gap-3 rounded-[10px] border`: radio de 16 px (sin marcar: borde de 1.5 px `subtle-foreground`; marcado: borde de 5 px `primary`, opción con `bg-accent border-input`) · nombre 14 px con cuadro de 8 px del color del curso · línea de 12 px subtle "Proyecto tecnológico ·" + `PuntoEnCurso` 6 px "En curso" (`text-reunion-fg`) si ese grupo ya tiene una en curso. Pie `px-5 py-3 border-t`: "Cancelar" (34 px, secundario) + "`Video` Reunirse" (34 px, primario).
    - **Móvil (M05):** hoja inferior de 340 px (radio 18 px, asa); título 17 px/700 + `X` de 44 px; opciones `min-h-14`; pie `px-4 pt-3 pb-[30px]`: "Reunirse" de 50 px a todo el ancho. Sin "Cancelar".
  - Elegir un grupo con reunión en curso lleva a esa reunión (regla del brief) y en la sala aparece el toast "{Nombre} ya había iniciado la reunión".
- **P7b Finalizar para todos:** ver P6.
- **P7c Salir:** sin confirmación (no hay tablero).

### P8 · Bandeja — W19, W20, M19, M20

**Lista (columna izquierda, patrón actual)**
- Fila `flex gap-2.5 pl-2.5 pr-3.5 py-2.5 rounded-md`, seleccionada `bg-border-subtle`:
  - punto de no leído de 6 px `bg-primary` (transparente si ya está leído);
  - círculo de ícono de 28 px;
  - título 13 px (500 si no leído, 400 si leído) + objeto 12 px subtle "{Título} · ■ {Grupo}";
  - hora (12 px, subtle) a la derecha.
- Círculo según el tipo:
  - "**Reunión iniciada**": `bg-reunion-soft` + `PuntoEnCurso` 7 px;
  - "**Reunión programada**" (existente): `bg-reunion-soft` + `CalendarPlus` `text-reunion`;
  - "**Reunión terminada**": `bg-accent` + `Video` `text-subtle-foreground`.
- Agrupación "Hoy" / "Esta semana" (existente).

**Panel derecho** (`max-w-[620px] px-8 py-7 gap-[18px]`)
- Inicio (W19): `EstadoReunion en_curso` → h2 "Reunión iniciada" (20 px/700) → "Reunión de Grupo Nº7 · ■ Grupo Nº7" (14 px, muted) → filas clave/valor (`min-h-10 border-b border-border-subtle text-sm`, etiqueta de 130 px subtle): "Iniciada por" (avatar + "Valeria"), "Desde" ("7:00pm"), "Hasta" ("8:00pm") → `BotonUnirse l`.
- Fin (W20): "Terminada" (12 px, subtle) → h2 "Reunión terminada" → "Planificación del Avance 4 · ■ Grupo Nº7" → "Duración" ("52 min"), "Entraron" (avatares + "Rodolfo, Valeria y tú"), "Finalizada por" (avatar + "Rodolfo") → "Ver detalle" (secundario, 40 px).

**Móvil (M19, M20):** pantalla de detalle con "`ChevronLeft` Bandeja"; h2 de 22 px; mismo contenido en `p-4`; "Unirse" `tactil` a todo el ancho (44 px); "Ver detalle" secundario de 50 px a todo el ancho.

**Diferencias con el brief / no diseñado:** el estado deshabilitado "Ya terminó" del aviso de inicio y la variante "cerrada automáticamente" no están en los tableros (implementar: botón `aria-disabled` con texto "Ya terminó"; fila "Finalizada por" → "Cerrada automáticamente"). La píldora de la cabecera del panel debe reflejar el estado **actual** de la reunión, no el del momento del aviso.

### No diseñado (queda como en el brief)

- P9 Correos, P10 Calendario y tablet de P4, P7 y P8.
- Grupo finalizado en solo lectura.
- Detalle de una reunión con enlace manual.

---

## 3. Datos que necesita cada pantalla

Estado calculado (nunca guardado) a partir de `ahora`, `inicio`, `fin`, primera entrada y finalización: `programada | sala_abierta | en_curso | por_cerrar | terminada`, con `aperturaSala = inicio − 10 min` y `cierreSala = fin + 15 min` (o `finalizadaEn`). Conviene una función pura en `src/lib/estado-reunion.ts`.

| Dato | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| `idReunion`, `titulo`, `inicio`, `fin`, `lugar`, `enlace` | ✓ | título, inicio | ✓ | | ✓ | título | | ✓ |
| `esVideollamada` (tiene sala de EduControl) | ✓ | | ✓ | | ✓ | ✓ | | |
| Grupo: id, nombre, color (id del curso para `CourseDot`), estado activo/finalizado | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rol del usuario en el grupo (líder, miembro, observador) | ✓ | ✓ | por grupo | | ✓ | ✓ | | ✓ |
| Estado calculado + minutos para empezar, para abrir o para cerrar | ✓ | | ✓ | | ✓ | ✓ (cuenta regresiva en el cliente) | | ✓ |
| Reunión en curso del grupo (id, título, inicio) | ✓ (sección y botón) | ✓ | sección "En curso" | | | | por grupo | |
| **Iniciada por** (usuario) + **iniciada en** (primera entrada) | ✓ | | ✓ | | ✓ | toast | | ✓ |
| **Entradas**: usuario + hora de su primera entrada, sin duplicados | avatares / "{n} entraron" | | ✓ | | lista con horas | | | avatares + nombres |
| Asistentes con respuesta (`asistire`, `no_asistire`, `pendiente`) + la mía | "{n} de {m} asistirán" | | avatares + selector | | listas + selector | | | |
| `finalizadaEn`, `finalizadaPor` (null = cierre automático), duración | | | | | ✓ | | | ✓ |
| Permisos: `puedeUnirse`, `puedeModerar` (líder, o quien programó o inició), `puedeCancelar` (quien programó o líder, antes de empezar), `puedeResponder` | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ |
| Grupos donde puedo "Reunirse ahora" (+ si tienen una en curso, nombre del curso) | | | ✓ (decide si abre el diálogo) | | | | ✓ | |
| Huecos en común, integrantes ocupados, reuniones programadas (como hoy) | | | | ✓ | | | | |
| Token y URL de la sala de Daily (al entrar) | | | | | | ✓ | | |
| Indicador "ya había iniciado" (por ejemplo `?ya=1` + nombre) | | | | | | ✓ | | |
| Notificación: tipo (`reunion_iniciada`, `reunion_terminada`), leída, fecha, enlace a P5 | | | | | | | | ✓ |

Notas:
- "Hace 33 min" y "Cierra en 53 min" se recalculan en el cliente (intervalo de 30-60 s); el servidor entrega las marcas de tiempo.
- La lista de "Pasadas" del grupo y "Anteriores" del módulo necesitan las entradas reales (hoy solo hay asistentes).

---

## 4. Dudas e inconsistencias del diseño

1. **Línea "Iniciada por":** aparece como "Iniciada por Valeria · hace 33 min" (W01, T01), "Iniciada por Lucía · desde 7:15pm" (W04), "Valeria · hace 33 min" (M01) y "Valeria · 7:00pm" (M04). Falta una regla única (¿"hace X min" si es menos de 1 h, si no "desde …"?).
2. **Franja P2:** en móvil va sobre las pestañas y en escritorio y tablet bajo ellas. El brief pedía "fija" en móvil y el tablero no muestra si es `sticky`.
3. **Observador W04** muestra la franja en la pestaña Reuniones: contradice la decisión 1 (se ignora).
4. **Color:** el morado del diseño choca con "En revisión"; además el `cat-reunion` actual de la app es otro tono. Se resuelve con los tokens `reunion*` (decisión 2).
5. **Duración "52 min":** "Terminó 7:52pm" con inicio programado a las 7:00pm, pero la primera entrada fue a las 6:58pm (W11). ¿Se mide desde el inicio programado o desde la primera entrada?
6. **Inicio vencido sin nadie dentro:** no hay texto para una sala abierta con la hora de inicio ya pasada (¿"Empezó hace 3 min"?).
7. **Regla de "Empieza en X min" frente a `Clock` "Mañana":** el módulo usa "Mañana" para el día siguiente y nada para fechas posteriores (Lun 23). Definir desde cuándo se muestra la etiqueta.
8. **P5 Programada en móvil:** muestra la barra fija con Unirse deshabilitado; el brief la quería solo con la sala abierta o en curso.
9. **"Finalizar para todos" en P5:** no está diseñado (el brief lo pedía en el menú del detalle mientras está en curso).
10. **Columna "No asistirán"** en el detalle: no aparece. ¿Dónde se lista a quien respondió "No asistiré"?
11. **Asistencia durante "En curso":** el selector desaparece. ¿Se puede seguir respondiendo hasta que termine (hoy sí se puede)?
12. **Módulo móvil:** muestra "`Check` Asistirás" en lugar del selector; no hay diseño para "No asistirás" ni "Sin responder".
13. **"Cancelar reunión"** sale de la lista del módulo y queda solo en el detalle: confirmar.
14. **Conteos:** tablet muestra "3 de 4" y escritorio "3 de 4 asistirán"; el módulo de escritorio no muestra conteo. Unificar.
15. **Tablet T05:** la fila "Ensayo de la demo" (videollamada, sala cerrada) no muestra Unirse deshabilitado, pero escritorio sí.
16. **"Reunirse ahora" con una sala abierta de otra reunión programada (W02):** el botón sigue diciendo "Reunirse ahora". ¿Crea otra reunión o debería llevar a la que tiene la sala abierta?
17. **FAB y tarjeta en móvil (M01):** "Unirse a la reunión en curso" (FAB) y "Unirse" (tarjeta) llevan al mismo sitio. ¿Se mantiene el FAB como "Reunirse ahora" mientras hay una en curso, o se oculta?
18. **Toast de la sala (W17, T04):** fondo oscuro con texto del color de texto del tema claro, ilegible. Usar `sonner` con los colores del tema.
19. **Etiquetas de nombre en los mosaicos** de video: en claro usan un velo del 10 % sobre fondo oscuro. Solo aplica al marcador de posición (lo dibuja Daily); ignorar.
20. **Formulario:** no hay diseño del interruptor apagado (campo Enlace) ni del resultado de "Usar un enlace propio". El chip de hueco pierde el "falta {nombre}" que muestra hoy: ¿se descarta?
21. **Formulario móvil sin campo Grupo:** ¿qué pasa al abrir "Programar" desde `/reuniones` en móvil (sin grupo)? No diseñado.
22. **Bandeja:** el ícono de "Reunión iniciada" pulsa en la lista aunque la reunión haya terminado (debería pulsar solo si sigue en curso). Faltan "Ya terminó" y "Cerrada automáticamente". La altura del botón cambia entre el aviso de inicio (44 px) y el de fin (50 px) en móvil.
23. **"Abrir en pestaña nueva":** si se abre Daily en otra pestaña, ¿se deja o se desmonta el iframe (doble conexión del mismo usuario)?
24. **Pestaña Configuración:** W01 la muestra a un miembro; en la app solo la ve el líder (prevalece la app). Los tableros móviles y de tablet no la muestran ni al líder.
25. **Radios distintos** en la acción doble (primario 8 px, secundario 6 px) y en botones de diálogo (34 px de alto frente a 32 px de los botones de página): unificar con `Button`.
26. **Módulo móvil sin "volver a Tú":** hoy existe `VolverMovil`; el diseño pone las acciones arriba a la derecha y no muestra volver.
27. **Selección inicial del diálogo P7a:** el tablero marca el grupo sin reunión en curso. Definir la opción por defecto (¿el último grupo usado?).
28. **Vacíos, cargas y errores** de P1 (observador o grupo finalizado), P3 y P5 no están diseñados: se usan los patrones de la app.

## 5. Resoluciones (obligatorias para implementar)

Cada número responde a la duda de la sección 4 con el mismo número.

**Precedencia (corregida por el usuario, 2026-11-20):** en lo visual **mandan los tableros de Claude Design**. Estas resoluciones solo llenan huecos que el diseño no cubre (estados no dibujados, reglas de negocio, datos) o aplican decisiones explícitas del usuario: sin franja en la pestaña Reuniones, color cian en lugar del morado, observadores sin acciones, se conserva "Abrir en pestaña nueva", sala en español sin `VideoConference`. Si una resolución cambia algo que el tablero sí muestra (radios, el chip "falta X", "Finalizar para todos" en el detalle, `VolverMovil` en el módulo móvil), se sigue el tablero.

1. **"Iniciada por":** una sola función de formato:
   - menos de 60 min: "Iniciada por {Nombre} · hace {n} min";
   - 60 min o más: "Iniciada por {Nombre} · desde {7:00pm}".
   - En móvil se omite "Iniciada por": "{Nombre} · hace {n} min".
   - "{Nombre}" = quien entró primero (`fechaEntrada` mínima).
2. **Franja en móvil:** va bajo el encabezado del grupo y sobre las pestañas, con `sticky top-0` y `z-10`. En escritorio y tablet va bajo las pestañas, sin sticky.
3. Se ignora W04 en ese punto: no hay franja en la pestaña Reuniones, tampoco para observadores.
4. Tokens `reunion` = `cat-reunion`, `reunion-soft` = `cat-reunion-bg`, `reunion-fg` = `cat-reunion-fg`. Los valores cian están en el plan (§1.7).
5. **Duración** = desde `iniciadaEn` (primera entrada) hasta `finalizadaEn`. Si la sala se cerró sola, `finalizadaEn` = cierre de la sala.
6. **Sala abierta con la hora de inicio pasada y nadie dentro:** la etiqueta dice "Sala abierta" (sin "Empezó hace…").
7. **"Empieza en {n} min"** solo cuando faltan menos de 60 min y la sala aún no abre. Si no, se muestra la fecha con `fechaCorta` ("Hoy", "Mañana", "Lun 23"), como el resto de la app.
8. Se acepta el diseño: en móvil la barra fija aparece también en "Programada", con Unirse deshabilitado y el texto "La sala abre a las {6:50pm}" encima o al lado.
9. **"Finalizar para todos"** va también en el detalle (P5) para moderadores mientras está en curso o por cerrar. Se pone en el menú `…` y en móvil en la barra de acciones, con el mismo diálogo de confirmación de la sala.
10. **"No asistirán":** en la sección de asistencia, bajo "Confirmaron", una línea en `text-muted` con "No asistirán: {nombres}" y otra con "Sin responder: {n}". Solo si hay alguien.
11. Se puede responder Asistiré / No asistiré **hasta que empiece** (`iniciadaEn` = null y estado ≠ terminada). En curso, el selector se oculta: lo que cuenta es quién entró.
12. **Módulo móvil:** se muestra la respuesta propia como texto: "Asistirás" (`Check`, tono `estado-completada`), "No asistirás" (`X`, `text-muted`) o "Sin responder" (`text-muted`). Para cambiarla se entra al detalle.
13. Confirmado: "Cancelar reunión" sale de la lista del módulo y queda solo en el detalle.
14. **Conteo único:**
    - antes de terminar: "{n} de {m} asistirán";
    - después, si es videollamada: "{n} entraron";
    - después, si es con enlace manual: "{n} de {m} asistieron".
    - Tablet y móvil usan el mismo texto, truncado si falta espacio.
15. Tablet igual que escritorio: las videollamadas con la sala cerrada muestran Unirse deshabilitado.
16. **"Reunirse ahora" con una sala ya abierta** de otra reunión del grupo, aunque nadie haya entrado: **lleva a esa reunión**, no crea otra. El botón dice "Unirse a la reunión en curso" desde que hay una sala abierta (estados `sala_abierta`, `en_curso`, `por_cerrar`).
17. **FAB en móvil:** con una sala abierta dice "Unirse a la reunión en curso" y lleva a esa reunión. Se mantiene aunque la tarjeta también tenga Unirse.
18. El toast de la sala usa el componente de toast de la app (`Toast` / `sonner`) con los colores del tema. Nada de colores fijos.
19. Se ignora: los mosaicos los dibuja Daily.
20. **Formulario:** con el interruptor apagado aparece el campo Enlace, igual que hoy. "Usar un enlace propio" apaga el interruptor y enfoca ese campo. El chip de hueco **conserva** "falta {nombre}" cuando aplique: es información útil que la app ya tiene.
21. **Campo Grupo en móvil:** se oculta solo si la página llega con `?grupo=`. Sin grupo, se muestra el selector actual.
22. **Bandeja:**
    - El ícono pulsa solo si la reunión sigue con la sala abierta.
    - "Reunión iniciada" ya terminada: el botón Unirse se reemplaza por el texto "Ya terminó" en `text-muted`.
    - "Reunión terminada" sin finalizador: "Cerrada automáticamente".
    - Botones en móvil: 44 px siempre.
23. **"Abrir en pestaña nueva"** navega la pestaña actual al detalle de la reunión (desmonta el iframe) y abre la sala de Daily en una pestaña nueva. Así no hay doble conexión.
24. Prevalece la app: Configuración solo para el líder.
25. Se usa el `Button` de shadcn con sus tamaños y radios. No se replican los radios del diseño.
26. Se mantiene `VolverMovil` hacia "Tú" en el módulo móvil, además de las acciones arriba a la derecha.
27. **Diálogo P7a:** sin selección por defecto. El botón "Reunirse" está deshabilitado hasta elegir un grupo. Los grupos con sala abierta muestran "En curso" y, al elegirlos, el botón dice "Unirse".
28. Vacíos, cargas y errores no diseñados: patrones existentes de la app (skeletons de `loading.tsx`, `error.tsx`, `not-found.tsx` y estados vacíos de una línea). Grupo finalizado: lista en solo lectura, sin Reunirse ahora ni Programar.
