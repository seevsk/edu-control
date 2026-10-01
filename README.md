# EduControl

Plataforma web para estudiantes que reúne en un solo lugar sus **cursos, evaluaciones, calendario, disponibilidad horaria y trabajos grupales**, con seguimiento del avance de cada integrante de un grupo.

> Las reglas de negocio, el alcance del MVP y las decisiones de arquitectura están documentadas a fondo en [`AGENTS.md`](./AGENTS.md). Este README es la guía práctica para clonar y levantar el proyecto; `AGENTS.md` es la fuente de verdad del *qué* y el *por qué*.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| Backend | Route Handlers y Server Actions dentro del mismo proyecto Next.js (sin backend separado) |
| Base de datos | PostgreSQL 17 |
| ORM y migraciones | Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Validación | Zod |
| Autenticación | Google OAuth, flujo manual (`openid-client` + `jose`), sesión propia por cookie firmada |
| Correo | `EmailSender` con `ConsoleEmailSender` en desarrollo (Resend cuando haya dominio verificado) |
| Entorno local | Docker solo para PostgreSQL |

## Requisitos previos

- **Node.js 20 o superior** (se desarrolló con Node 22).
- **Docker Desktop** (para levantar PostgreSQL local).
- Una cuenta de **Google Cloud** para generar las credenciales OAuth (ver más abajo).

## Primeros pasos

```bash
git clone https://github.com/seevsk/edu-control.git
cd edu-control
npm install
```

### 1. Variables de entorno

```bash
cp .env.example .env
```

Completá `.env` con los valores reales. El detalle de cada variable está comentado en `.env.example`, pero en resumen:

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Ya viene lista para el Postgres de Docker de este repo (ver abajo). No la toques salvo que cambies el puerto. |
| `APP_URL` | `http://localhost:3000` en local. |
| `SESSION_SECRET` | Cualquier string random de 32+ caracteres, uno por entorno. Generalo así: |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales reales de un proyecto de Google Cloud (ver sección siguiente). Sin esto el login no funciona. |

### 2. Base de datos (Docker)

```bash
docker compose up -d
```

Levanta PostgreSQL en el contenedor `educontrol-db`, publicado en el **puerto 5433** del host (no 5432: ese puerto suele estar ocupado por otro Postgres local; si en tu máquina está libre, igual dejalo en 5433 para no tener que tocar `DATABASE_URL`).

Credenciales (ya están en `docker-compose.yml` y coinciden con el `DATABASE_URL` de `.env.example`):

- Host: `localhost` · Puerto: `5433` · Usuario: `educontrol` · Contraseña: `educontrol_dev` · Base: `educontrol`

Para conectarte con un cliente gráfico (TablePlus, DBeaver, pgAdmin, etc.), usá esos mismos datos.

### 3. Prisma: cliente, migraciones y datos de ejemplo

```bash
npx prisma generate        # genera el cliente en generated/prisma (gitignored, hace falta regenerarlo en cada clon)
npx prisma migrate dev     # aplica las migraciones que ya estan en prisma/migrations
npx prisma db seed         # (opcional) carga usuarios, cursos, grupos y tareas de ejemplo
```

`prisma/seed.ts` es **solo para desarrollo**: borra y vuelve a crear usuarios, cursos, grupos y tareas de ejemplo cada vez que corre. Si ya iniciaste sesión con tu cuenta real de Google antes de correr el seed, tu cuenta también se borra — simplemente volvé a entrar con Google después y se crea de nuevo (ver *Troubleshooting*).

### 4. Credenciales de Google OAuth

El login es exclusivamente con Google, así que hace falta un cliente OAuth real:

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto (o usá uno existente).
2. **APIs & Services → OAuth consent screen**: tipo **Externo**, completá nombre y correo de soporte. Mientras esté en modo *Testing*, agregá tu cuenta de Google como "usuario de prueba" para poder loguearte vos mismo.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Tipo de aplicación: **Aplicación web**.
   - URI de redirección autorizada: `http://localhost:3000/api/auth/google/callback` (tiene que ser exacta).
4. Copiá el **Client ID** y el **Client Secret** a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` en tu `.env`.

Scopes pedidos: solo `openid email profile`. No se guarda ningún token de Google (ver `AGENTS.md` sección 8.1).

### 5. Levantar la app

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Te redirige a `/login`.

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Corre el build de producción |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Chequeo de tipos sin emitir archivos |
| `npx prisma generate` | Regenera el cliente de Prisma (`generated/prisma`) |
| `npx prisma migrate dev --name <nombre>` | Crea y aplica una migración nueva en local |
| `npx prisma migrate deploy` | Aplica migraciones pendientes **en staging/producción** (nunca `migrate dev` ahí) |
| `npx prisma db seed` | Recarga los datos de ejemplo (borra y recrea todo) |
| `npx prisma studio` | Explorador visual de la base de datos |
| `docker compose up -d` | Levanta Postgres |
| `docker compose down` | Apaga Postgres (los datos quedan en el volumen `educontrol_pgdata`) |

## Estructura del proyecto

```
src/
  app/
    (auth)/login/          # Login (fuera del area autenticada)
    (app)/                 # Area autenticada: inicio, cursos, calendario, grupos, invitaciones, notificaciones, perfil
    api/auth/               # Route Handlers del login con Google y la sesion
  server/
    auth/                  # Sesion (cookie firmada) y helpers de usuario autenticado
    db/                    # Cliente de Prisma (driver adapter pg)
    email/                 # Interfaz EmailSender + ConsoleEmailSender
    notifications/         # Plantillas y politica de que notificaciones mandan correo
    services/               # Reglas de negocio (cursos, grupos, tareas, metricas, perfil...)
  lib/                      # Validacion (Zod), fechas/zona horaria, calculo de metricas, etc. (funciones puras)
  components/               # Componentes de UI compartidos
prisma/
  schema.prisma
  migrations/
  seed.ts
docs/
  educontrol.dbml           # Especificacion exacta del esquema (11 tablas + relaciones de importacion)
docker-compose.yml
.env.example
```

Para el detalle de cada regla de negocio (quién puede hacer qué, cómo se calculan las métricas, la política de notificaciones, etc.), ver `AGENTS.md`.

## Flujo de Git

- `main`: producción. No se commitea ni se mergea ahí directo.
- `develop`: integración. Todo el trabajo termina acá.
- `feature/<nombre>` o `fix/<nombre>`: una rama por avance, mergeada a `develop` con `--no-ff`.
- Commits en *Conventional Commits* (`feat:`, `fix:`, `chore:`...), descripción en español.

## Troubleshooting

**"Unknown argument `X`" en una Server Action, o un error de Prisma que no tiene sentido.**
El cliente de Prisma quedó desactualizado en memoria (por ejemplo, después de un `git pull` que trae un cambio de `schema.prisma`, o de correr `prisma migrate dev` con el server ya corriendo). Solución: `npx prisma generate` y **reiniciar** `npm run dev` — el servidor tiene que recargar el cliente nuevo, no alcanza con que el archivo se haya regenerado en disco.

**Después de iniciar sesión, la app tira un error de Prisma o te manda en bucle a `/login`.**
Tu sesión quedó apuntando a un usuario que ya no existe (típicamente porque alguien corrió `npx prisma db seed`, que borra y recrea los usuarios). Desde esta versión el sistema lo detecta solo: te limpia la cookie y te redirige a `/login` con un aviso. Si ves esto, simplemente volvé a entrar con Google.

**El login con Google tira `Error 401: invalid_client`.**
Faltan credenciales reales de Google Cloud en `.env` (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), o la URI de redirección configurada en Google Cloud no coincide exactamente con `http://localhost:3000/api/auth/google/callback`.

**`docker compose up -d` falla porque el puerto 5432 ya está en uso.**
Ya usamos 5433 por esto mismo (ver `docker-compose.yml`). Si 5433 también estuviera ocupado en tu máquina, cambiá el mapeo de puertos ahí y el puerto en `DATABASE_URL` de tu `.env`.

**TablePlus/DBeaver no se conecta aunque el contenedor esté corriendo.**
Confirmá que estás usando el puerto **5433**, no 5432 — es un error común si tenés otro Postgres local en el puerto por defecto.
