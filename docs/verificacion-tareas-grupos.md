# Verificación de tareas y grupos (HU-008, HU-011 y HU-013)

Con las dependencias instaladas, el cliente de Prisma generado y PostgreSQL local disponible:

```powershell
npm run verificar:tareas-grupos
npx tsc --noEmit
npm run lint
npm run build
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
