# Verificación de tareas y grupos (HU-008, HU-011 y HU-013)

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

Para revisar la interfaz, finalizar un grupo como líder y comprobar el aviso de solo lectura en el
resumen, tablero y detalle de tarea. No deben aparecer controles para editar, invitar, retirar o modificar
tareas. Una invitación a ese grupo debe indicar que está finalizado. Si otra pestaña conserva un
formulario anterior, enviarlo debe mostrar un error sin guardar cambios.

## Aprobación y finalización de tareas

El responsable envía la tarea a revisión y ve «Pendiente de aprobación por otro integrante».
Otro integrante aceptado, que no sea observador, ve «Aprobar y completar» y «Devolver a progreso»
en el tablero, la lista y el detalle. Las acciones de la lista conservan esa vista, también ante errores.
Los grupos finalizados mantienen las tareas en modo de solo lectura.

La prueba HTTP necesita el build generado y las variables locales de `.env`, incluido `SESSION_SECRET`.
Levanta un servidor en un puerto libre y una base temporal con usuarios ficticios. Comprueba los
formularios reales de Server Actions, los permisos, las redirecciones, el historial, las notificaciones
y el avance calculado. Detiene el servidor y elimina la base al terminar.

Para una revisión manual con esos datos, ejecuta desde una terminal interactiva:

```powershell
npm run verificar:acciones-tarea-http -- --visual
```

Abre la URL impresa. El sufijo `/__qa/2` muestra al responsable y `/__qa/3` al revisor;
agrega `?vista=tablero` o `?vista=detalle` para cambiar la vista. Presiona Enter en la terminal
al terminar. El acceso de prueba solo existe en el proxy local de este script, sobre la base temporal.
