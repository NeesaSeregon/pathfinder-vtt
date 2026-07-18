# Pathfinder VTT

Aplicación web para gestionar fichas de personaje de Pathfinder y jugar partidas
en un tablero virtual compartido. Dos roles por partida: máster y jugadores.

## Stack
- Monorepo Nx (npm como gestor de paquetes)
- Frontend: Angular 21 zoneless con signals, esbuild, Vitest — apps/pathfinder-app
- Backend: NestJS 11 — apps/api (tests e2e en apps/api-e2e)
- Tipos compartidos: libs/shared, importados como @pathfinder/shared
- Base de datos: PostgreSQL 17 en Docker (docker-compose.yml) + TypeORM
  (@nestjs/typeorm); credenciales en .env (plantilla en .env.example)
- Node 24, TypeScript según tsconfig.base.json

## Comandos
- Base de datos: docker compose up -d (requiere Docker Desktop arrancado)
- Servir front: npx nx serve pathfinder-app
- Servir back: npx nx serve api
- Ambos: npx nx run-many -t serve -p pathfinder-app api
- Lint: npx nx run-many -t lint
- Tests: npx nx run-many -t test (api usa Jest; pathfinder-app y libs/shared
  usan Vitest — el front vía @angular/build:unit-test)
- E2E: npx nx e2e pathfinder-app-e2e (Cypress; arranca los servidores solo)
- Migraciones (esquema de la BD):
  - Aplicar las pendientes: npm run migration:run
  - Generar una tras cambiar entidades: npm run migration:generate -- apps/api/src/migrations/NombreDescriptivo
  - Deshacer la última: npm run migration:revert
  - Ver estado: npm run migration:show

## Convenciones
- Todo modelo o evento compartido entre front y back se define en
  libs/shared, nunca duplicado.
- El front consume la API vía /api con proxy.conf.json en desarrollo.
- Angular: componentes standalone y signals; evitar NgModules y Zone.js.
- Generar código nuevo con generadores de Nx cuando exista uno
  (nx g @nx/nest:resource, nx g @angular/...), no a mano.
- Los comandos se ejecutan en PowerShell (Windows).

## Seguridad de dependencias
- ignore-scripts=true en ~/.npmrc (global, decidido el 2026-07-16 por los
  ataques de cadena de suministro en npm): npm install NO ejecuta los scripts
  preinstall/postinstall de los paquetes.
- Consecuencia: tras un install limpio (node_modules borrado) hay que ejecutar
  manualmente: npm rebuild esbuild nx unrs-resolver && npx cypress install
  (son los únicos paquetes del proyecto con postinstall legítimo).
- No usar comodines "*" en versiones de dependencias; fijar rangos concretos.
- Preferir npm ci cuando no se cambian dependencias, y no adoptar versiones
  recién publicadas (esperar unos días) al añadir o actualizar paquetes.
- La política vive también en el .npmrc DEL REPO, así aplica en CI y en
  cualquier máquina nueva, no solo donde esté la config global.

## CI (GitHub Actions)
- .github/workflows/ci.yml: en cada push a main (la rama por defecto) y en
  cada PR ejecuta
  npm ci (sin scripts) + rebuilds permitidos + lint + tests + e2e, con
  PostgreSQL 17 como service container y JWT_SECRET propio del runner.
- El binario de Cypress se cachea por hash del package-lock.

## Autenticación
- JWT emitido por /api/auth/register y /api/auth/login (se entra con email);
  secreto en JWT_SECRET (.env), expiración 8h, hash de contraseñas con
  bcryptjs (puro JS, compatible con ignore-scripts).
- El token viaja en una cookie httpOnly + SameSite=Strict (pf_sesion);
  secure solo en producción (en dev y LAN vamos por http). JS nunca ve el
  token. Logout = POST /api/auth/logout (borra la cookie en el servidor).
- La API es segura por defecto: AuthGuard global (APP_GUARD) que lee la
  cookie (con Bearer como respaldo para scripts); solo @Public() abierto.
- Front: SesionStore guarda solo el username; la sesión se restaura
  preguntando a GET /api/auth/me (el authGuard lo hace la primera vez).
  El authInterceptor ante un 401 limpia y redirige a /entrar.
- Los personajes tienen dueño (Character.ownerId → users): cada usuario
  solo ve y toca los suyos; el personaje de otro devuelve 404, no 403.
  EXCEPCIÓN: el máster de una partida puede LEER (no editar) la ficha
  completa de los personajes de SU mesa (GET /api/partidas/:id/personajes/
  :pepId/ficha); lo autoriza ser máster o el propio dueño, nadie más.

## Migraciones (TypeORM)
- El esquema de la base de datos SOLO cambia mediante migraciones
  versionadas en git; synchronize está en false (app.module.ts). Nunca
  volver a activarlo: adivinaba diffs y podía destruir datos (nos falló
  dos veces, p. ej. al añadir la columna email NOT NULL a una tabla con
  filas). Las migraciones llevan el SQL exacto, revisado y reversible.
- DataSource propio del CLI en apps/api/src/data-source.ts (fuera de Nest:
  carga el .env con dotenv, lista las entidades a mano y synchronize:false).
  Usa el tsconfig apps/api/tsconfig.migrations.json (commonjs + node +
  emitDecoratorMetadata) seleccionado con TS_NODE_PROJECT vía cross-env.
- Flujo al cambiar una entidad: editas la entidad → migration:generate te
  escribe el diff → LO REVISAS (p. ej. rellenar columnas NOT NULL nuevas en
  tres pasos: añadir nullable, poblar, poner NOT NULL; o añadir CREATE
  EXTENSION si hace falta) → migration:run → commit del archivo.
- La migración inicial (InitialSchema) es el baseline: crea todo el esquema
  desde cero (incluye CREATE EXTENSION "uuid-ossp", que synchronize ponía
  solo). La base de datos de desarrollo existente se marcó como aplicada
  sin re-ejecutarla (fila en la tabla migrations).
- CI aplica las migraciones (npm run migration:run) contra su Postgres vacío
  antes del e2e, así el CI es fiel a producción.

## Decisiones de diseño
- sheetData (JSONB) guarda solo DATOS ORIGEN del personaje; los derivados
  (modificadores, CA/toque/desprevenido, iniciativa, casillas/metros) se
  calculan con funciones puras en libs/shared, nunca se persisten.
- El ESTADO DE SESIÓN (PG actuales, daño no letal, condiciones y efectos
  temporales de combate) NO va en sheetData: pertenecerá al modelo de
  partida cuando exista el tablero compartido. Decidido el 2026-07-15
  para trabajar con vistas a la integración ficha-tablero.

## Mejoras futuras
- Catálogo de dotes con autocompletar: importar un JSON de dotes del
  contenido OGL de PF1e (nombre, tipo, prerrequisitos, beneficio; fuentes
  candidatas: compendios del sistema PF1 de Foundry u otros datasets OGL de
  GitHub) para rellenar las entradas DoteValores en vez de escribirlas a
  mano. Requisitos: página de créditos con la licencia OGL 1.0a; el texto
  OGL es el inglés (la traducción de Devir tiene copyright — usar tabla
  propia de nombres traducidos). Mantener siempre la entrada libre para
  dotes fuera del catálogo. NO automatizar efectos mecánicos de las dotes
  (decidido el 2026-07-16: demasiado heterogéneos).

## Estado actual
- Estructura del monorepo creada y subida a GitHub.
- Persistencia funcionando: PostgreSQL 17 (Docker) + TypeORM con
  migraciones versionadas (synchronize: false; ver sección Migraciones).
- Primer recurso CRUD: /api/characters (entidad Character con columna JSONB
  sheetData). Modelo compartido Character en libs/shared.
- El front tiene home (ruta raíz) con navbar común y tema oscuro global
  (variables CSS en styles.scss; los componentes no declaran colores propios).
  La página de personajes (listar, crear, borrar) vive en /personajes,
  servida contra /api/characters vía proxy. E2E con Cypress verificando
  navegación y el flujo completo (npx nx e2e pathfinder-app-e2e).
- Usuarios funcionando: /entrar y /registro con JWT en cookie httpOnly
  (ver sección Autenticación); los personajes tienen dueño.
- Partidas: entidad Partida (el creador es el máster; código de invitación
  de 6 caracteres, visible solo para él) y PersonajeEnPartida (tabla
  intermedia con el ESTADO DE SESIÓN: pgActuales —inicializado desde la
  ficha al unirse—, danoNoLetal, condiciones, posX/posY). /partidas/crear
  y /partidas/buscar (por nombre o código) + unirse funcionan en el front.
- Vista de partida en /partidas/:id: tablero de 20x15 casillas (TABLERO_*
  en libs/shared), tokens con mover en dos clics (banquillo para los no
  colocados), panel de mesa con PG actuales/condiciones editables y CA
  derivada POR EL SERVIDOR con las reglas compartidas. Permisos: máster
  toca todo, cada jugador lo suyo (PATCH /api/partidas/:id/personajes/:pepId).
- Tiempo real con Socket.IO: PartidasGateway autentica el handshake con la
  cookie httpOnly, una sala por partida (partida:<id>), eventos tipados en
  libs/shared (eventos-partida.ts): estado-personaje (cambios parciales,
  se fusionan en cliente) y mesa-cambiada (recargar detalle por HTTP).
  El servicio emite DESPUÉS de persistir. El AuthGuard global ignora el
  contexto ws (el gateway hace su propia auth). Proxy dev: /socket.io
  con ws:true en proxy.conf.json.
- Consulta de fichas en la mesa: componente reutilizable FichaVista
  (apps/pathfinder-app/src/app/characters/ficha-vista.ts) con la vista de
  SOLO LECTURA de una ficha (todos los derivados vía funciones puras). Se
  usa en el modal "Ver ficha" de /personajes Y en la mesa (el máster abre
  la ficha de cualquier jugador; el jugador, la suya).
- Rastreador de iniciativa y turnos: la iniciativa es estado de sesión
  (PersonajeEnPartida.iniciativa); el estado de combate vive en la partida
  (enCombate, ronda, turnoPepId). El orden lo da la función pura compartida
  ordenarIniciativa (iniciativa desc, desempate por el modificador de la
  ficha). Endpoints: POST :id/personajes/:pepId/iniciativa (tira 1d20+mod,
  máster o dueño), POST :id/combate/{iniciar,siguiente,terminar} (solo
  máster). Al dar la vuelta a la tabla sube la ronda. Los cambios se
  propagan por el socket (mesa-cambiada para el turno/ronda; estado-
  personaje para una iniciativa suelta).
- Tiradas de dados: el SERVIDOR tira (única fuente de azar), no el cliente.
  Función pura lanzarDados(notacion, rng?) en libs/shared (parsea "1d20+5",
  con topes de seguridad). POST /api/partidas/:id/tiradas (solo
  participantes: máster o dueño de un personaje de la mesa) resuelve la
  tirada y la retransmite por el socket (EVENTO_TIRADA_DADOS). Son EFÍMERAS:
  no se persisten (registro en memoria del cliente); quien entre tarde no
  las ve. El cliente deduplica por id (respuesta HTTP + eco del socket).