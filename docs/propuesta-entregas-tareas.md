# Propuesta: Entregas de tarea (envío a revisión con contenido)

Documento para **Claude Design**. Define **qué existe, qué datos hay y cómo se organiza cada pantalla**. El diseño visual (composición, espaciado, jerarquía, microinteracciones) lo decide Claude Design dentro del sistema actual de EduControl (paleta "Tinta", Geist, `StatusIcon`, paneles laterales en web, hojas inferiores en móvil, objetivos táctiles de 44 px). Entregables esperados: mockups en **móvil (<768 px), tablet (768–1023 px) y web (≥1024 px)**, tema claro y oscuro.

Textos en español (Perú), sin textos de relleno ni avisos explicativos: la interfaz se entiende sola.

> **Ajustes posteriores a los mockups (2026-11-18, prevalecen sobre el resto del documento):**
> - **No hay "rondas".** No se muestra "Ronda N" ni se numera. La entrega vigente es la más reciente por fecha; las demás van en **"Entregas anteriores"** (colapsadas).
> - La etiqueta **"Rechazada" pasa a "Devuelta"** y el botón **"Rechazar" a "Devolver"** (mismo término que el estado existente "devolver a progreso"). "Aprobar" no cambia.
> - Un grupo finalizado o una tarea descartada no muestran etiqueta de "En revisión" en entregas pendientes.
> - Los topes de la demo son 5 MB por archivo, 3 archivos, 10 MB por entrega y 40 MB por grupo (ver `src/lib/entregas.ts`).

---

## 1. Qué cambia y por qué

Hoy una tarea solo cambia de estado (`pendiente → en_progreso → en_revision → completada`). Quien termina pulsa "pasar a revisión" y no deja nada que revisar dentro de la app.

**Nuevo:** para pasar a **En revisión** el asignado debe **enviar una entrega**: un título, una descripción, un enlace opcional y archivos opcionales. Todos los integrantes ven lo entregado (y descargan). **Solo el líder** aprueba o rechaza. Cada rechazo abre una **nueva ronda**; queda el historial de todas las entregas.

Los demás integrantes no aprueban ni rechazan: **solo ven** la entrega y su resultado.

## 2. Roles y permisos (resumen para la UI)

| Rol | Ve entregas | Descarga | Envía entrega | Aprueba / rechaza |
|---|---|---|---|---|
| Líder | Sí | Sí | Sí, si es el asignado | **Sí (también las suyas)** |
| Miembro | Sí | Sí | Solo si es el asignado | No |
| Observador | Sí (solo lectura) | Sí | No | No |

- Un integrante sin permiso **no ve botones deshabilitados con explicaciones**: simplemente no ve la acción.
- Si el **líder es el asignado** y aprueba su propia entrega, se muestra la etiqueta **"Aprobada por el propio líder"** (visible para todos). No se oculta.

## 3. Estados y etiquetas

### 3.1 Estado de la tarea (ya existe, sin cambios)
`Pendiente · En progreso · En revisión · Completada · Descartada`, con `StatusIcon` (forma + color).

### 3.2 Resultado de cada entrega (nuevo)
Una etiqueta junto a cada entrega, con **ícono de forma + color** (mismo criterio que `StatusIcon`, no solo color):

| Etiqueta | Cuándo | Información adicional visible |
|---|---|---|
| **En revisión** | Enviada, espera al líder | Fecha y hora de envío |
| **Aprobada** | El líder la aceptó | Quién, cuándo. Si fue el propio autor: "Aprobada por el propio líder" |
| **Rechazada** | El líder la devolvió | Quién, cuándo y **motivo (obligatorio)** |

Cada entrega muestra su **ronda** ("Ronda 1", "Ronda 2"…). La más reciente es la vigente; las anteriores quedan como historial.

Relación con el estado de la tarea:
- Entrega nueva (ronda N) → tarea en **En revisión**.
- Entrega aprobada → tarea **Completada**.
- Entrega rechazada → tarea vuelve a **En progreso** (el asignado envía la ronda N+1).

## 4. Datos de una entrega (qué muestra la UI)

- **Título** (obligatorio, hasta 120 caracteres).
- **Descripción** (obligatoria si no hay archivos ni enlace; hasta 2000 caracteres). Texto plano con saltos de línea.
- **Enlace** (opcional, `https://` o `http://`). Pensado para archivos pesados (Drive, repositorio, etc.). Se muestra como enlace externo con el dominio visible.
- **Archivos** (opcionales): nombre original, tipo (ícono por tipo de archivo), tamaño legible ("2,4 MB"), botón de descarga.
- **Autor** (avatar + nombre) y **fecha/hora de envío** (formato del proyecto: "Hoy 3:40pm", con fecha completa en `title`).
- **Ronda** y **etiqueta de resultado**.
- Si fue revisada: **revisor** (avatar + nombre), fecha/hora y, si es rechazo, **motivo**.

Regla de contenido mínimo: una entrega necesita **título + (descripción o enlace o al menos un archivo)**.

### Límites de archivos (la UI debe comunicarlos de forma compacta, no con párrafos)
- Máximo **5 MB por archivo**, **3 archivos por entrega**, **10 MB por entrega**.
- Tipos: PDF, Word, PowerPoint, Excel, PNG, JPG.
- Si algo no cabe, el campo de enlace es la salida (el formulario debe hacer evidente esa alternativa sin explicarla en un párrafo).

## 5. Pantallas y estructura

> Contexto existente: el detalle de una tarea se abre en un **panel lateral** (web/tablet) o una **hoja inferior** (móvil), controlado por la URL (`?tarea=`). Allí viven datos, historial y tiempos. Las entregas se integran en ese mismo detalle, no son una página nueva.

### 5.1 Detalle de la tarea: nueva sección "Entregas"
Ubicada entre los datos de la tarea y el historial/tiempos. Estructura:

1. **Entrega vigente** (la más reciente), destacada:
   - Cabecera: etiqueta de resultado + "Ronda N" + autor + fecha de envío.
   - Título.
   - Descripción.
   - Enlace (si hay).
   - Lista de archivos (nombre, tamaño, descargar).
   - Si está rechazada: bloque con el motivo y quién la rechazó.
   - Si está en revisión **y el usuario es líder**: acciones **Aprobar** y **Rechazar** (ver 5.3).
2. **Rondas anteriores**: lista colapsable, cada una con ronda, etiqueta, fecha, y al abrir muestra el mismo contenido (incluido el motivo de rechazo). Ordenadas de más reciente a más antigua.
3. **Estado vacío** (tarea sin entregas aún): para el asignado en `en_progreso`, el espacio donde está la acción **"Enviar a revisión"**; para los demás, un vacío mínimo ("Aún sin entregas").

### 5.2 Formulario "Enviar a revisión" (solo el asignado, tarea `en_progreso`)
- **Web/tablet:** diálogo o panel lateral sobre el detalle.
- **Móvil:** hoja inferior a pantalla casi completa.
- Campos en este orden: **Título · Descripción · Enlace (opcional) · Archivos (opcional)**.
- Zona de archivos: seleccionar o arrastrar (en móvil, selector del sistema). Cada archivo seleccionado muestra nombre, tamaño, **progreso de carga**, y opción de quitar. Indicador compacto de cupo: archivos usados de 3 y MB usados de 10.
- Estados a diseñar:
  - Vacío (inicial).
  - Con archivos seleccionados.
  - **Enviando** (progreso, botón bloqueado, no se puede cerrar por accidente).
  - Errores: archivo demasiado grande, tipo no permitido, más de 3 archivos, total excede 10 MB, enlace inválido, falta contenido mínimo, fallo de red (con reintento que conserva lo escrito).
  - Éxito: el panel se cierra y el detalle muestra la entrega vigente "En revisión".
- Acción principal: **Enviar a revisión**. Secundaria: Cancelar (si hay datos escritos, confirmar descarte).
- Si es una **ronda 2+**, mostrar arriba, de forma compacta, el **motivo del rechazo anterior** para que el asignado lo tenga a la vista mientras escribe.

### 5.3 Revisión del líder
- Visible solo para el líder cuando la entrega vigente está **En revisión**.
- **Aprobar**: acción directa con confirmación ligera. Si el líder es el autor, la confirmación lo deja claro y el resultado mostrará "Aprobada por el propio líder".
- **Rechazar**: abre un campo de **motivo obligatorio** (diálogo en web/tablet, hoja inferior en móvil) y confirma.
- Resultado: la etiqueta cambia en vivo para el líder; los demás la ven al abrir o recargar.

### 5.4 Tablero y lista de tareas
- Tarjeta/fila de una tarea **En revisión**: indicador discreto de que tiene entrega (por ejemplo, ícono de adjunto o conteo de archivos) y, si es una ronda 2+, la ronda.
- **Arrastrar una tarjeta a "En revisión" ya no mueve la tarea**: abre el formulario de envío (5.2) si el usuario es el asignado. Si no lo es, no hay acción.
- Arrastrar desde "En revisión" a "Completada" o "En progreso" **ya no existe**: aprobar/rechazar solo se hace desde el detalle (líder).
- En la lista, columna o marca para distinguir "En revisión" con entrega ronda N.

### 5.5 Historial de la tarea y actividad del grupo
- Nuevos eventos con su línea de tiempo y hora (12 h, America/Lima):
  - "X envió una entrega (ronda N)"
  - "X aprobó la entrega (ronda N)" / "X aprobó su propia entrega (ronda N)"
  - "X rechazó la entrega (ronda N)" + motivo
- Se integran con los eventos actuales (estado, reasignación, fecha límite, peso).

### 5.6 Bandeja de notificaciones
Reutiliza los tipos existentes; solo cambia el contenido del detalle:
- **Tarea en revisión** (a los integrantes): incluye título de la entrega y ronda.
- **Tarea completada** (al asignado): entrega aprobada.
- **Tarea devuelta** (al asignado): entrega rechazada con el motivo.
- **Autoaprobación del líder:** aviso solo dentro de la app a los demás integrantes (sin correo).

### 5.7 Inicio
La sección de "tareas por revisar" (hoy muestra tareas en revisión de otros) pasa a ser **solo para líderes**, con acceso directo a la entrega vigente.

## 6. Estados transversales a diseñar
- **Carga** (skeleton) del detalle y de la lista de entregas.
- **Vacío** (sin entregas).
- **Error** de descarga de un archivo (archivo no disponible) sin exponer detalles internos.
- **Sin permisos:** no se muestra nada especial; la acción simplemente no aparece. Quien no pertenece al grupo recibe el 404 ya existente.
- **Grupo finalizado:** todo en solo lectura; las entregas siguen visibles y descargables.
- **Tarea descartada:** las entregas anteriores siguen visibles.

## 7. Responsivo: qué cambia por tamaño
- **Móvil:** formularios y revisión en hojas inferiores; archivos en lista vertical; acciones de 44 px; la entrega vigente ocupa el ancho completo; rondas anteriores colapsadas.
- **Tablet:** detalle en panel lateral; formulario en diálogo.
- **Web:** detalle en panel lateral; entrega vigente y rondas anteriores visibles sin desplazarse mucho; formulario en diálogo/panel.
- Todo accesible: foco visible, navegación por teclado, etiquetas de resultado con ícono + texto (no solo color), contraste suficiente.

## 8. Lo que NO incluye
- Vista previa de archivos dentro de la app (solo descarga).
- Comentarios o chat en la entrega (el único texto del revisor es el motivo de rechazo).
- Edición de una entrega ya enviada (si hay error, se rechaza y se envía una nueva ronda).
- Subida de archivos fuera de una entrega.
- Ranking o puntajes.

## 9. Pantallas a entregar (checklist para mockups)
Para **móvil, tablet y web**:
1. Detalle de tarea con entrega **En revisión** (vista de integrante y vista de líder con acciones).
2. Detalle con entrega **Aprobada** y con **"Aprobada por el propio líder"**.
3. Detalle con entrega **Rechazada** (motivo visible) y ronda 2 en revisión con rondas anteriores abiertas.
4. Formulario "Enviar a revisión": vacío, con archivos y progreso, y con errores.
5. Formulario ronda 2+ mostrando el motivo anterior.
6. Revisión: confirmación de aprobar y diálogo/hoja de rechazar con motivo.
7. Tablero y lista con tarjetas/filas en revisión (indicador de entrega y ronda).
8. Historial/actividad con los nuevos eventos.
9. Bandeja: detalle de los avisos con entrega.
10. Estados vacío, carga y error.
