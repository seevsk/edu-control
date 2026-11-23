# Verificación de preferencias, tareas y grupos (HU-004, HU-008, HU-011 y HU-013)

Con las dependencias instaladas, el cliente de Prisma generado y PostgreSQL local disponible:

```powershell
npm run verificar:tareas-grupos
npx tsc --noEmit
npm run lint
npm run build
npm run verificar:acciones-tarea-http
```

La verificación usa las dependencias existentes y las aserciones de Node, sin agregar un framework.
Lee `DATABASE_URL` de `.env`, exige un servidor local y crea una base temporal con nombre aleatorio.
Aplica las migraciones solo a esa base y la elimina al terminar, incluso cuando una prueba falla.
No modifica la base de datos de la aplicación. El usuario de PostgreSQL necesita permiso para crear bases.

Comprueba los permisos, las asignaciones, las transiciones y las fechas de entrega, el historial atómico,
los cambios simultáneos, la reversión ante un fallo del historial y el retiro con asignaciones concurrentes.
También verifica que finalizar preserve la consulta y bloquee edición, reapertura, invitaciones,
respuestas pendientes, retiros y cambios de tareas. El inicio muestra solo tareas de grupos activos
en los que el usuario sigue siendo un integrante aceptado que no sea observador.

La HU-004 comprueba que cada integrante aceptado pueda activar o silenciar sus correos de actividad
sin desactivar la campana ni los avisos importantes. Un invitado pendiente, observador o usuario externo
no puede modificar esa preferencia, y un grupo finalizado mantiene el modo de solo lectura.

Para revisar la interfaz, finalizar un grupo como líder y comprobar el aviso de solo lectura en el
resumen, tablero y detalle de tarea. No deben aparecer controles para editar, invitar, retirar o modificar
tareas. Una invitación a ese grupo debe indicar que está finalizado. Si otra pestaña conserva un
formulario anterior, enviarlo debe mostrar un error sin guardar cambios.

## Revisión de entregas y finalización de tareas

El responsable envía una entrega y la tarea pasa a revisión; él ve «Esperando revisión». Solo el líder
(también en su propia tarea) ve «Aprobar» y «Devolver» en el detalle, junto a la entrega; ni el tablero
ni la lista las ofrecen. Cualquier integrante puede «Tomar tarea» si está pendiente y sin responsable.
Las acciones del detalle, incluidas las que fallan, conservan `vista=tablero`.
Los grupos finalizados y los observadores no ven ninguna acción.

La prueba HTTP necesita el build generado y las variables locales de `.env`, incluido `SESSION_SECRET`.
Levanta un servidor en un puerto libre y una base temporal con usuarios ficticios. Comprueba los
formularios reales de Server Actions (copiándolos como lo haría un atacante: un asignado, un miembro,
un observador o un externo no pueden aprobar, devolver ni tomar una tarea ya tomada), el envío de
una entrega por `POST /api/entregas` (solo el responsable, con la tarea en progreso), las redirecciones,
el historial, el cierre de la entrega, las notificaciones y el avance calculado. Detiene el servidor
y elimina la base al terminar.

Para una revisión manual con esos datos, ejecuta desde una terminal interactiva:

```powershell
npm run verificar:acciones-tarea-http -- --visual
```

Abre la URL impresa. El sufijo `/__qa/2` muestra al responsable y `/__qa/1` al líder que revisa;
agrega `?vista=tablero` o `?vista=detalle` para cambiar la vista. Presiona Enter en la terminal
al terminar. El acceso de prueba solo existe en el proxy local de este script, sobre la base temporal.

## Salidas, cuenta eliminada y grupos finalizados (2026-11-22)

`npm run verificar:tareas-grupos` también cubre: al salir, las tareas `en_progreso` vuelven a `pendiente` sin responsable y las `en_revision` conservan a su autor; devolver, aprobar y reabrir una tarea cuyo autor salió; eliminar la cuenta bloqueada por liderazgo y permitida (salida de grupos, tareas liberadas, invitaciones canceladas, idempotencia, sin avisos); finalizar un grupo con invitaciones pendientes; y que no se avise la respuesta a una invitación a quien ya salió.

## Entregas de tarea (2026-11-18)

`npm run verificar:tareas-grupos` también cubre las entregas: contenido mínimo, tipos y firma de archivo,
reversión completa si algo falla, que solo el responsable envíe, que solo el líder apruebe o devuelva
(también su propia entrega, con aviso solo dentro de la app) y que "por revisar" muestre únicamente los
grupos que lidera. Para probar la interfaz: pasar una tarea a En progreso, usar **Enviar a revisión** con
un archivo y comprobar la descarga, devolverla con motivo, reenviar y aprobarla.
