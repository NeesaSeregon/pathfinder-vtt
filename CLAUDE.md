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
- Despliegue: con COOLIFY (panel que gestiona proxy, HTTPS, variables y
  backups). Se pulsa Deploy en su panel; ver sección Despliegue y
  DESPLIEGUE.md. Para probar el compose en local sin Coolify:
  DB_PASSWORD=... JWT_SECRET=... APP_URL=http://localhost:3000
  docker compose -f docker-compose.prod.yml up --build
  (APP_URL es OBLIGATORIA desde que existe la recuperación por correo: sin
  ella el compose ni arranca. Las MAIL_* no lo son; sin ellas los correos
  van al log.)

## Despliegue
- UNA imagen (Dockerfile multifase): la API sirve TAMBIÉN el front compilado
  desde ../pathfinder-app/browser, así todo va por el MISMO origen — la
  cookie SameSite=Strict sigue viajando y no hace falta CORS. main.ts añade
  un respaldo de SPA: lo que no empiece por /api ni tenga extensión devuelve
  index.html (si no, recargar en /partidas/:id daría 404).
- HTTPS ES OBLIGATORIO en producción. La cookie lleva secure:true cuando
  NODE_ENV=production, así que sin TLS por delante el navegador NO la guarda
  y NADIE puede iniciar sesión. Lo termina el PROXY DE COOLIFY (Traefik):
  gestiona el certificado de Let's Encrypt y enruta el dominio al servicio
  `api` en el puerto 3000 (incluido el upgrade de WebSocket). Por eso el
  compose NO tiene servicio de proxy ni puertos 80/443, y la API solo
  declara `expose: 3000` (no `ports`): la alcanza Traefik por la red de
  Coolify. El dominio y los secretos se ponen en el PANEL de Coolify, no en
  un .env del servidor. Hubo un servicio Caddy en el compose (jubilado el
  2026-07-20 al elegir Coolify, que trae su propio proxy: dos porteros
  pelearían por el 80/443).
- La guía de despliegue paso a paso para el usuario está en DESPLIEGUE.md
  (VPS Ubuntu LTS, instalar Coolify, Cloudflare, variables, deploy, backups).
  Va dirigida a Luis; esta sección es la versión para mí.
- app.set('trust proxy', 1) en main.ts: NO es para la IP del visitante, sino
  para que Express lea X-Forwarded-Proto del proxy (Traefik) y permita la
  cookie secure:true (si no, creería que la conexión es http y la rechazaría).
- La IP real del visitante (para el freno de login) la da el decorador
  IpCliente (auth/ip-cliente.decorator.ts), que prefiere la cabecera
  CF-Connecting-IP de Cloudflare y cae en req.ip si no está (dev, LAN, o
  Cloudflare en modo "DNS only"). trust proxy solo daría la IP del proxy.
  OJO: esa cabecera es de fiar SOLO si el origen no admite tráfico que no
  venga de Cloudflare — hay que cerrar el cortafuegos a los rangos de
  Cloudflare cuando se active la nube naranja (ver DESPLIEGUE.md §9).
- CORTAFUEGOS Y DOCKER-USER: las reglas de scripts/cortafuegos-cloudflare.sh
  DEBEN llevar `-i <interfaz pública>`. DOCKER-USER cuelga de FORWARD, y por
  FORWARD pasan LOS DOS SENTIDOS del tráfico de un contenedor (lo que entra
  hacia él y lo que él manda a internet): para el kernel ambos son tráfico
  enrutado entre dos interfaces. Sin `-i`, un DROP a `--dport 443` mata
  también las SALIDAS de los contenedores hacia cualquier :443 ajeno, porque
  --dport es "el puerto del servicio al que va el paquete" — tanto da que sea
  nuestro Traefik o el de github.com. Así tumbamos el despliegue del
  2026-08-03: Coolify no pudo hacer git ls-remote (y el npm ci del build
  habría muerto igual), mientras la web seguía cargando perfectamente, porque
  las RESPUESTAS de una conexión entrante van al puerto efímero del cliente y
  no casan con el DROP. Se filtra por la interfaz pública y NO excluyendo los
  puentes de Docker: los `br-xxxx` llevan un hash y cambian al recrear la red.
  Todo cambio en ese script se valida con SUS DOS MITADES (el propio script
  comprueba la salida de un contenedor; que el origen siga cerrado hay que
  probarlo DESDE FUERA — desde el VPS no pasa por FORWARD y siempre diría que
  está abierto).
- Las migraciones corren AUTOMÁTICAS en cada despliegue: un servicio
  `migrate` de un solo uso (restart: 'no') aplica lo pendiente y termina, y
  la API tiene depends_on: migrate con condition: service_completed_successfully,
  así que NO arranca hasta que las migraciones acaban bien. Si una falla, el
  contenedor sale con error, la API no arranca y Coolify marca el despliegue
  en rojo (la versión anterior sigue en pie) — en vez de arrancar sobre un
  esquema roto. Usa la fase `build` de la imagen porque las migraciones
  necesitan TypeScript y ts-node, que no están en la imagen final. (Antes era
  un paso manual `run --rm migrate`; con Coolify, que despliega sin SSH,
  automatizarlo por depends_on es lo natural.)
- En el runtime NO se usa el package.json/lockfile podado que genera Nx en
  dist/apps/api: sale INCOMPLETO (le faltaba content-type, de express) y
  `npm ci` lo rechaza. Se poda el árbol completo con `npm prune --omit=dev`,
  más pesado pero reproducible.
- El Dockerfile tiene TRES fases: `build` (compila con TODAS las deps, sin
  podar), `prod-deps` (FROM build + `npm prune --omit=dev`) y `runtime` (copia
  el node_modules podado de prod-deps y los dist de build). La poda vive en su
  fase aparte A PROPÓSITO: el servicio `migrate` usa la fase `build`, y las
  migraciones corren con ts-node + cross-env, que son devDependencies. Cuando
  la poda estaba dentro de `build` (2026-07-31, primer deploy en Coolify), el
  migrate arrancaba sin esas herramientas y moría con exit 127 ("command not
  found"), tumbando el despliegue. Regla: NADA que la fase build comparta con
  migrate puede depender de tener las devDependencies podadas.
- La base de datos NO publica puertos en prod: solo la ve la red interna.
- COPIAS DE SEGURIDAD: pendientes, y pasan a ser urgentes el día del
  despliegue. Hay que salvar el volumen pgdata (pg_dump). Desde que el
  tablero no admite mapas subidos (ver ZONAS DEL TABLERO) ya no hay nada de
  usuario fuera de la base de datos, así que el volumen de uploads dejó de
  llevar nada que salvar. Comandos concretos en DESPLIEGUE.md §6;
  automatizar con cron cuando haya datos reales.
- WebEmpresa (lo que tiene Luis a día de 2026-07-20) es HOSTING COMPARTIDO
  (cPanel): NO sirve para esta app (sin Docker, sin PostgreSQL —da MySQL—,
  sin proceso Node permanente ni WebSockets estables). Hace falta un VPS con
  root. El dominio de Cloudflare sí vale con cualquier host.

## Convenciones
- Todo modelo o evento compartido entre front y back se define en
  libs/shared, nunca duplicado.
- El front consume la API vía /api con proxy.conf.json en desarrollo.
- Angular: componentes standalone y signals; evitar NgModules y Zone.js.
- CSS: ESTILOS.md manda. Ahí está en qué nivel va cada regla (global /
  parcial de zona / componente), el contrato del tema —los componentes NO
  declaran colores propios; para transparencias, color-mix() sobre la
  variable, no un rgba() reescrito a mano—, la nomenclatura, las invariantes
  de maqueta de la mesa y los presupuestos. Leerlo ANTES de tocar un .scss:
  la trampa de las clases compartidas entre zonas no da error, solo se ve
  mal.
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
- Si el e2e falla, el workflow SUBE LAS CAPTURAS de Cypress como artefacto
  ("cypress-capturas", 7 días) desde la propia página del run. Se añadió el
  2026-08-03 tras un rojo que no se reproducía en local: los logs de
  Actions piden permisos de admin del repo, así que sin la captura hay que
  deducir el fallo a ciegas.
- OJO CON LAS CARRERAS EN CYPRESS: el CI corre en una máquina más lenta y
  saca a la luz esperas implícitas que en local nunca fallan. El caso que
  nos pasó: leer texto con .invoke('text') justo tras un click, sobre un
  contenedor que YA existía (.panel envuelve el formulario y la
  confirmación), devolvía la pantalla de antes de responder la API. Regla:
  antes de leer contenido, poner una aserción que espere al estado nuevo
  (cy.contains(...).should('be.visible')), no confiar en que la petición
  haya terminado.

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
- Freno de fuerza bruta en el login (IntentosLoginService): cuenta SOLO LOS
  FALLOS, por pareja email+IP, y responde 429 sin llegar a comprobar la
  contraseña. Se descartó @nestjs/throttler porque limita TODAS las
  peticiones por IP: habría obligado a un tope tan alto que no protegería
  (el e2e hace ~60 logins en 40s desde la misma máquina). Por email+IP y no
  solo email para que nadie pueda dejar fuera a otro fallando con su correo.
  Está EN MEMORIA: vale para una instancia; con varias haría falta Redis.
  Ajustable con LOGIN_MAX_FALLOS y LOGIN_BLOQUEO_SEGUNDOS.
- VERSIONADO DEL TOKEN (tokenVersion): el JWT lleva un claim `tv` con
  users.tokenVersion, y el AuthGuard lo compara con el de la BD en cada
  petición. Cambiar o restablecer la contraseña incrementa esa columna (en
  el MISMO UPDATE que el hash, con `"tokenVersion" + 1` en SQL) y todos los
  tokens emitidos antes dejan de valer al instante, en vez de sobrevivir
  sus 8h. Cuesta UNA lectura de usuario por petición autenticada, por clave
  primaria: es el precio de poder echar a alguien de verdad, que es lo que
  espera quien restablece porque le han entrado. El gateway de Socket.IO
  hace la MISMA comprobación en su handshake — si no, restablecer echaría
  al intruso de la API pero le dejaría el socket viendo moverse la mesa.
  OJO AL EFECTO COLATERAL: subir tokenVersion invalida también la cookie
  del navegador donde se está cambiando la contraseña. Por eso
  CuentaService.cambiarPassword DEVUELVE un token nuevo y el controlador
  repone la cookie (ponerCookieSesion, en auth/auth.cookie.ts, compartido
  con AuthController para que no haya dos sitios donde olvidar el
  httpOnly). Sin eso, cambiar la contraseña te expulsaba a /entrar a ti
  solo por haber hecho lo que te pedíamos.
- RECUPERAR CONTRASEÑA ("la he olvidado"): POST /api/auth/password/olvidada
  y POST /api/auth/password/restablecer, los dos @Public(). Sigue la
  Forgot Password Cheat Sheet de OWASP:
  · olvidada responde SIEMPRE 204, exista o no la cuenta. Es la regla que
    manda: si respondiera distinto, el formulario sería un comprobador de
    qué correos están registrados aquí. El e2e lo comprueba comparando el
    texto de las dos pantallas.
  · El token son 32 bytes de crypto.randomBytes en base64url (43 chars) y
    en la tabla tokens_recuperacion se guarda su SHA-256, nunca el token.
    SHA-256 y no bcrypt por dos motivos: 256 bits aleatorios no necesitan
    endurecimiento, y con bcrypt (sal por fila) no se podría BUSCAR la fila
    por el hash. Caduca a los 30 min y es de UN SOLO USO: se marca usadoEn
    con un UPDATE condicionado a `usadoEn IS NULL`, así dos peticiones
    simultáneas con el mismo token no pasan las dos.
  · Pedir un enlace nuevo invalida los anteriores del mismo usuario.
  · El enlace se construye desde APP_URL, JAMÁS desde la cabecera Host
    (host header injection: te mandarían el correo con un enlace al
    servidor del atacante). Apunta a /restablecer?token=… del front.
  · Restablecer NO inicia sesión (no pone cookie): manda a /entrar, como
    pide OWASP. Al terminar sale un correo de aviso del cambio, que es la
    única alarma que tiene el usuario si le han entrado; el cambio desde
    /cuenta manda ese mismo aviso.
  · Freno propio (FrenoRecuperacionService), y NO vale el del login: aquí
    se cuentan TODAS las peticiones, no solo los fallos, porque cada
    acierto manda un correo a un TERCERO. Limita por email y por IP a la
    vez (ventana deslizante en memoria, con purga por tamaño para que
    probar correos distintos no sea un agujero de memoria). Mismo límite
    que el freno del login: una sola instancia.
  NOTA HONESTA: /api/auth/register sigue respondiendo 409 "ya existe una
  cuenta con ese email", así que la enumeración de usuarios sigue siendo
  posible por ahí. Se deja a conciencia (decir "ese correo ya está" es
  buena usabilidad al registrarse); el silencio de la recuperación es
  gratis y se mantiene igual.
- CORREO (módulo CorreoModule, @Global): EnviadorCorreo es una CLASE
  abstracta —no una interfaz, que desaparecería al compilar y Nest no
  podría inyectar— con dos implementaciones. EnviadorSmtp (nodemailer, JS
  puro y sin postinstall) va por SMTP y NO por el SDK del proveedor a
  propósito: cambiar de Resend a Brevo o SES es cambiar variables de
  entorno. EnviadorConsola escribe los correos en el log y, si hay
  CORREO_BUZON_DIR, deja cada uno en un .json — es lo que permite probar
  el flujo entero sin cuenta de correo ni secretos en el CI. El módulo
  elige solo: hay MAIL_HOST → SMTP; no lo hay → consola (y en producción
  eso deja un ERROR en el log, porque es el fallo más difícil de
  diagnosticar: todo responde bien y el correo no llega nunca). Un fallo de
  envío se registra y se traga, nunca propaga: convertirlo en un 500 sería
  además una pista sobre qué cuentas existen.
  · TODA VARIABLE NUEVA HAY QUE DECLARARLA EN docker-compose.prod.yml, en
    el bloque environment del servicio api. Rellenarla en el panel de
    Coolify NO basta: el compose solo pasa al contenedor lo que enumera, y
    además es de ahí de donde Coolify saca los campos que te enseña. Se nos
    escapó al montar esto (2026-08-03): las MAIL_* estaban documentadas
    pero no cableadas, así que no habrían llegado nunca.
  · Las variables llegan DEFINIDAS AUNQUE ESTÉN VACÍAS (docker-compose pone
    cadena vacía cuando el campo del panel está en blanco). Por eso
    EnviadorSmtp no usa getOrThrow —que solo se queja de lo indefinido—
    sino la función exigir(), que trata "" como ausente y revienta el
    arranque. Con getOrThrow se arrancaría feliz y se intentaría enviar sin
    remitente ni contraseña, fallando en cada correo.
- Gestión de la propia cuenta en /api/cuenta (módulo CuentaModule): GET
  devuelve datos + contadores (personajes, mesas que diriges, mesas donde
  juegas) y DELETE la borra. Nunca hay :id en la ruta: siempre actúa sobre
  el usuario de la cookie, así que nadie puede tocar la cuenta de otro.
  PATCH /api/cuenta/password la cambia estando dentro (contraseña actual +
  nueva; la repetición de la nueva se comprueba solo en el front y no
  viaja). El hash lo hace AuthService con las mismas rondas que el registro.
  Cambiarla CIERRA las sesiones de los demás dispositivos (tokenVersion) y
  manda un correo de aviso; en este dispositivo se sigue dentro porque el
  controlador repone la cookie. La página lo dice en voz alta.
  Tanto el cambio como el borrado pasan por CuentaService.reautenticar(),
  que pide LA CONTRASEÑA otra vez (AuthService.verificarPassword);
  si falla responde 403, NO 401 — un 401
  significa "sesión caducada" y el authInterceptor te echaría a /entrar en
  vez de enseñarte el error. Personajes y partidas caen por el ON DELETE
  CASCADE de la BD, y desde que no hay mapas subidos no queda nada suyo
  fuera de la base de datos que limpiar aparte.
- Los personajes tienen dueño (Character.ownerId → users): cada usuario
  solo ve y toca los suyos; el personaje de otro devuelve 404, no 403.
  EXCEPCIÓN de LECTURA: GET /api/characters/:id lo sirve CharactersService.
  leer(id, userId), que autoriza al dueño O al máster de una partida donde
  el personaje esté sentado (en mesa real el máster necesita la hoja del
  jugador). Sigue siendo 404 si no tienes acceso. Editar/borrar y el
  findOne interno siguen siendo SOLO del dueño. La mesa ("Ver ficha") usa
  este endpoint; antes había uno propio en partidas, ya retirado.
  Desde la mesa, "Ver ficha" abre en LECTURA y ofrece "Editar" SOLO si la
  ficha es tuya (pep.esMio); el máster la ve pero no la toca, igual que en
  /personajes. Reutiliza CharacterForm (mismo aviso de cambios sin guardar
  vía form.sucio()) y la modal se ensancha a 68rem al editar.
- Editar una ficha AVISA a las mesas donde esté sentada: CharactersService.
  update() emite EVENTO_MESA_CAMBIADA por cada PersonajeEnPartida del
  personaje. Sin eso, el resto de la mesa seguiría viendo la CA/PG/nivel
  viejos hasta recargar, porque esos valores los DERIVA el servidor de
  sheetData. Para poder hacerlo sin ciclo de módulos (PartidasModule ya
  importa CharactersModule) el gateway vive en PartidasGatewayModule, que
  importan los dos.

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
- LOS PG EXACTOS DE UN PNJ SON DEL MÁSTER (2026-08-24). A un jugador le
  llega estadoVital —ileso / herido / malherido / caído, derivado con la
  función pura estadoVitalDe— y NUNCA pgActuales, pgTotal ni danoNoLetal.
  Los PJ no se tocan: la mesa comparte su propio estado. Está en los dos
  caminos que llevan datos al cliente, y por la misma razón que los PNJ
  ocultos:
  · detalle() lo recorta con soloLoPublico(), que es el único sitio donde
    se sabe QUIÉN pregunta.
  · el evento estado-personaje va a toda la sala sin filtrar, así que su
    payload tampoco los lleva (aEstadoPublico); y si el cambio TOCA esos
    números, ni se difunde: se manda mesa-cambiada y cada cliente recarga
    el detalle que le corresponde. Ojo con degradar a mesa-cambiada todo
    cambio de un PNJ: mover un ogro no tiene nada privado y haría recargar
    la mesa entera a los cinco clientes.
  No hay migración: estadoVital es derivado, como la CA o la iniciativa.

## Mejoras futuras
- (HECHO el 2026-08-25: LA BARRA DE HERRAMIENTAS YA NO TAPA EL TABLERO. Iba
  en position:absolute con fondo opaco sobre la esquina superior izquierda
  del marco, y las casillas de debajo no se podían pulsar ni recibir un
  token; como a lo ancho el tablero cabe entero, las columnas 0-1 estaban
  SIEMPRE tapadas y no había forma de destaparlas desplazando. Lo cazó el
  e2e ("this element is being covered by .utiles"). Ahora va EN FILA en una
  cabecera propia encima del marco, junto al rótulo de la zona: cuesta ~3rem
  de alto —una fila de 30— pero no toca el ancho ni el tamaño de casilla,
  que es el principio de esta pantalla (se pierden filas, nunca columnas), y
  deja sitio horizontal para el zoom y el "centrar en el turno". El e2e
  vuelve a colocar en la casilla (0,0) A PROPÓSITO, para que avise si
  alguien pone algo flotando ahí otra vez; MesaTablero tiene además un test
  de que .utiles es HERMANA del marco y no hija.
  El BANQUILLO sigue flotando abajo a la izquierda con el mismo problema,
  pero es transitorio —solo existe con fichas sin colocar— y el tablero ya
  está recortado por abajo. Si molesta: plegarlo, o subirlo a esa cabecera.)
- (HECHO el 2026-08-24: PARTIR LA MESA EN COMPONENTES. Ver la sección
  "La mesa, por dentro" del Estado actual. El presupuesto anyComponentStyle
  volvió a 10/16 kB, que es donde estaba antes del rediseño.)
- PNJ: pendientes de una segunda vuelta si hacen falta en mesa — ataques y
  daño en el bloque corto (hoy solo lo que el tablero muestra: CA, PG,
  iniciativa y tamaño; lo demás se rellena editando la ficha completa) y
  limpiar de golpe los PNJ muertos al terminar el combate.
- (HECHO el 2026-08-03: recuperar contraseña por correo y cerrar las demás
  sesiones al cambiarla. Ver la sección Autenticación. Se hicieron juntas
  porque comparten toda la fontanería y porque un restablecimiento que no
  echa al intruso no sirve de mucho.)
- BOTÓN "CERRAR SESIÓN EN TODOS LOS DISPOSITIVOS" en /cuenta. La fontanería
  YA ESTÁ HECHA: basta un endpoint que incremente users.tokenVersion (lo
  mismo que hace actualizarPassword, pero sin tocar el hash) y reponer la
  cookie de quien lo pulsa, igual que en el cambio de contraseña — si no,
  se expulsaría a sí mismo. Es la respuesta a "creo que alguien ha entrado
  en mi cuenta" SIN obligar a cambiar la contraseña, y es de las mejoras
  más baratas que quedan. Debería pedir la contraseña (reautenticar), como
  el resto de acciones delicadas de esa página.
- CONTRASEÑAS FILTRADAS al registrarse y al cambiarla. Hoy la única regla
  es PASSWORD_MIN_LONGITUD (8). NIST SP 800-63B desaconseja las reglas de
  composición ("una mayúscula y un símbolo") y recomienda EN SU LUGAR
  comprobar la contraseña contra listas de contraseñas comprometidas: sube
  mucho más la seguridad real. Se puede hacer sin enviar la contraseña, con
  la API de HaveIBeenPwned por k-anonymity (se manda solo los 5 primeros
  caracteres del SHA-1 y se busca el resto en la respuesta). Vigilar dos
  cosas: que un fallo o una caída de ese servicio NO impida registrarse
  (ante la duda, dejar pasar) y que el aviso al usuario sea comprensible
  ("esa contraseña aparece en filtraciones conocidas, elige otra").
  Afectaría a los tres sitios a la vez: registro, /cuenta y restablecer.
- Correo de recuperación cuando el email NO tiene cuenta ("alguien ha
  pedido restablecer, pero aquí no hay cuenta con este correo"). OWASP lo
  sugiere para que el usuario no se quede esperando un correo que no va a
  llegar. No se hizo: convierte el formulario en una forma de mandar correo
  a direcciones arbitrarias, y con la mesa que somos el texto de la
  pantalla ("si hay una cuenta con ese correo…") ya lo explica.
- Freno de recuperación y de login EN REDIS. Los dos viven en memoria y
  valen para UNA instancia; el día que haya varias detrás de un
  balanceador, hay que mudarlos a la vez.
- Catálogo de dotes con autocompletar: importar un JSON de dotes del
  contenido OGL de PF1e (nombre, tipo, prerrequisitos, beneficio; fuentes
  candidatas: compendios del sistema PF1 de Foundry u otros datasets OGL de
  GitHub) para rellenar las entradas DoteValores en vez de escribirlas a
  mano. Requisitos: página de créditos con la licencia OGL 1.0a; el texto
  OGL es el inglés (la traducción de Devir tiene copyright — usar tabla
  propia de nombres traducidos). Mantener siempre la entrada libre para
  dotes fuera del catálogo. NO automatizar efectos mecánicos de las dotes
  (decidido el 2026-07-16: demasiado heterogéneos).

## Mejoras futuras (efectos)
- Sistema de buffs/efectos temporales que CAMBIAN características (y con él,
  las condiciones tipo fatigado/exhausto/enredado que hoy solo se describen).
  Enfoque acordado: función pura fichaConEfectos(ficha, efectos) que devuelve
  una COPIA de la ficha con el delta sumado al ajusteTemporal de cada atributo;
  luego se llama a las funciones derivadas de siempre SIN tocarlas y cascadean
  solas (CA, salvaciones, iniciativa, BMC/DMC, habilidades). Clave: −2 a una
  puntuación es siempre −1 al modificador (mod(p−2)=mod(p)−1), así el delta es
  exacto. Excluir Constitución→PG (retroactivo, se cruza con pgActuales) y las
  puntuaciones a 0 (estados especiales). Merece la pena hacerlo JUNTO a los
  buffs (Fuerza de toro, Furia, Heroísmo, inspiración del bardo), donde el
  valor en mesa es alto y la fontanería es la misma; requiere además mostrar
  en la mesa los valores efectivos (salvaciones, iniciativa, ataque, DMC).

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
  Alta/edición en modal ancho: cerrar por fondo o Escape NO descarta a lo
  bruto — CharacterForm expone sucio() (lo marca cualquier input/change por
  propagación; applyInitial lo resetea) y CharactersPage.intentarCerrar()
  pide confirmación solo si hay cambios. Botón Cancelar explícito.
  (El soporte de e2e espera a que la API responda antes del primer test,
  para evitar carreras de arranque en frío.)
- EL E2E RECOGE LO SUYO (2026-08-25). Cada pasada dejaba unas dos docenas de
  mesas, sus asientos y los personajes de los tests tirados en la base de
  datos de desarrollo. En cinco semanas se juntaron 649 partidas de las que
  solo 4 eran de verdad, 380 usuarios generados y 711 personajes; el
  escritorio de tester-fijo llegó a pintar 457 tarjetas. Ahora un after() en
  support/e2e.ts entra en cada cuenta que ha tocado la pasada y la borra: el
  ON DELETE CASCADE se lleva de un golpe partidas, asientos y personajes, y
  no hay que ir apuntando ids por el camino. tester-fijo entra en el barrido
  como las demás — se llama "fijo" porque se reutiliza DENTRO de una pasada,
  y empezar la siguiente con la cuenta recién hecha hace los tests más
  deterministas. Dos avisos para quien lo toque:
  · Las cuentas se apuntan con el COMANDO cy.apuntarCuenta, no importando
    una función del fichero de soporte. Si el spec importa support/commands,
    Cypress lo empaqueta aparte y hay DOS instancias del módulo: cy.login
    escribe en un Map y el barrido lee el otro, vacío. Pasó, y la pasada
    entera se quedó sin limpiar.
  · Los tests que CAMBIAN la contraseña o crean la cuenta por la interfaz
    tienen que llamar a cy.apuntarCuenta ellos mismos: el barrido entra con
    la contraseña apuntada, y con la vieja no abre.
- Usuarios funcionando: /entrar y /registro con JWT en cookie httpOnly
  (ver sección Autenticación); los personajes tienen dueño. Recuperación de
  contraseña por correo en /recuperar y /restablecer (ambas públicas), con
  enlace desde /entrar. Añadido el 2026-08-03, cuando la app dejó de ser
  solo del círculo cercano.
- La home tiene DOS caras y ya no hay nada "en construcción" en ella:
  · SIN sesión, PORTADA (.home, 64rem): el hero y tres tarjetas
    informativas, con entrar/registrarse. No hace NI UNA petición a la API.
  · CON sesión, ESCRITORIO (.escritorio, 100rem como la mesa): saludo +
    accesos (Personajes, Tu cuenta, Cerrar sesión) y dos columnas 2fr/1fr —
    "Tus mesas" a la izquierda y el panel de unirse a la derecha. En móvil
    caen una debajo de otra (max-width: 60rem).
  Las mesas se piden en un effect() atado a sesion.conectado(), NO en el
  constructor: al arrancar la app todavía no se sabe quién eres (/auth/me
  responde después), y un visitante anónimo no debe provocar un 401.
- El panel de buscar/unirse es un componente propio (UnirsePanel) que vive
  en el escritorio de la home ("Unirse a una mesa"). Emite (unido) para que
  la home recargue sus mesas al sentarte en una nueva. Hubo una página
  /partidas/buscar que solo lo envolvía con un título; se retiró por
  redundante (2026-07-20) junto con el desplegable "Partidas" de la navbar,
  que ahora es un enlace "Mesas" → "/" (el escritorio ya reúne tus mesas,
  crear y unirse). Crear SÍ sigue siendo página aparte (/partidas/crear:
  formulario), enlazada desde el escritorio.
- Ninguna acción irreversible se dispara desde la home: el borrado de cuenta
  vive solo en /cuenta, en su zona peligrosa (plegada; al desplegarla pide
  la contraseña y avisa de cuántos personajes y partidas se pierden).
  /cuenta tiene cuatro bloques: Datos, Tu material (cifras), Contraseña
  (cambio plegado, con actual + nueva + repetición) y Sesión, más la zona
  peligrosa del borrado al final.
- LA MESA, POR DENTRO (partida en /partidas/:id, partido el 2026-08-24).
  PartidaDetallePage ya NO pinta nada: es el dueño del estado y el único que
  habla con la API y con el socket. Cada zona del rediseño es un componente
  y recibe lo que pinta por inputs; lo que cambia sube por outputs. Ningún
  trozo pide la partida por su cuenta.
  · MesaBarra: barra + menú del máster + estado de la conexión. Sustituye a
    la navbar general dentro de una partida (ver App.enLaMesa).
  · MesaPersonas: tu tarjeta + rastreador de combate + LA lista. Suyo es el
    ORDEN (computed grupos): en combate manda la iniciativa; fuera, grupos
    Jugadores y luego PNJ por orden de llegada, nunca alfabético.
  · MesaTablero: rejilla, tokens, banquillo, herramientas y regla. Suyo es
    todo el GESTO — herramienta activa, medición, arrastre y el agarre del
    marco (viewChild marcoTablero) —; de ahí solo salen (seleccionar) y
    (mover).
  · MesaSeleccion: el panel del asiento elegido. Solo existe cuando hay
    selección, así que recibe el pep como input.required, no como null.
  · MesaRegistro: tiradas + lanzador. Sin selección se lleva la columna.
  · PnjModal: la siembra de PNJ, con sus dos pestañas.
  · ZonasModal: la lista de zonas del tablero (ver ZONAS más abajo).
  Tres ficheros de apoyo, para que las zonas dibujen igual a la misma gente:
  mesa-visual.ts (funciones puras: colorToken, iniciales, ladoToken,
  fraccionPg, esCaido, nombres de condición), mesa-zonas.ts (areaEnRejilla,
  llevaRotulo, claseTerreno, tituloZona) y el parcial _mesa-comun.scss
  (.rotulo, .tarjeta, .boton, .ficha, .marca, .pgbar, .vital y los rellenos
  .zona--*), que cada zona hace @use — no van a styles.scss porque son
  nombres demasiado genéricos para el ámbito global.
  La rejilla de tres columnas y sus puntos de corte se quedan en la página;
  la caja de cada zona la pone el :host de su componente.
  Cada zona tiene su spec (124 tests en la app); los de la página siguen
  siendo de integración y atraviesan los hijos.
- ZONAS DEL TABLERO (2026-08-25). El máster dibuja RECTÁNGULOS sobre el
  tablero —una sala, un pasillo, un charco— y les pone nombre. Sustituyen al
  mapa de fondo subido, que se retiró entero (endpoints, columna, ficheros
  en disco y la limpieza que arrastraba al borrar una cuenta): no había
  ninguno subido en producción. Compartir imágenes puede volver algún día,
  pero como ILUSTRACIÓN de algo, no como fondo del tablero.
  Decisiones, y el porqué de cada una:
  · EL TERRENO NO AFECTA AL MOVIMIENTO. "Terreno difícil" es un recordatorio
    visual y nada más: la app no encarece ni impide pisar nada, y no debe
    empezar a hacerlo. Quien decide qué cuesta cruzar un pantano es el
    máster en voz alta, como en la mesa de verdad. Está escrito en el
    comentario de TERRENOS (libs/shared) porque es la clase de decisión que
    alguien "arregla" dentro de seis meses.
  · LAS ZONAS NO SON EXCLUSIVAS Y NO COLISIONAN. Una casilla puede estar en
    varias; se pintan en orden de lista y la última manda. Eso no es un
    descuido: es lo que permite meter una fuente dentro de una sala y hacer
    una habitación en L con dos rectángulos, sin inventar una geometría más
    complicada. Por eso tampoco hay reglas de partición ni de solape.
  · SE DIBUJAN EN EL TABLERO Y SE GESTIONAN EN LA MODAL. Dibujar es un gesto
    de ratón (arrastrar de esquina a esquina, misma vía que medir:
    empezarAgarre bifurca por herramienta y casillaEn traduce puntero →
    casilla) y ponerle nombre es escribir. Un formulario flotando sobre el
    tablero rompería la regla de que nada opaco tapa casillas. Además, la
    lista es la única vía CON TECLADO a algo que si no sería solo de ratón.
  · SE PINTAN EN LA MISMA REJILLA CSS que las casillas, con grid-area. Ni
    capa SVG ni píxeles: encajan solas con el hueco de 2px. Van al fondo
    (z-index 0; el token está en el 2) y con pointer-events: none, así que
    la casilla de debajo se sigue pulsando y sigue admitiendo un token —
    la regla que ya costó una tarde con la barra de herramientas.
  · EL COLOR NO VA SOLO: cada terreno lleva trama además de color, el nombre
    del estado está en el title y escrito en la lista. Y una zona pequeña NO
    lleva rótulo (mínimo 3×2): en 1×2 el nombre sale recortado y pisando la
    casilla vecina; el nombre sigue en el title y en la lista.
  · LO QUE UN JUGADOR NO DEBE VER NO SE LE MANDA. visible: false lo filtra
    el SERVIDOR en detalle(), igual que los PNJ ocultos. Ocultarlo en el
    cliente sería enseñarlo en la respuesta de la API a quien la mire. Esto
    NO es niebla de guerra —no hay descubrimiento ni visión por personaje—,
    pero evita que dibujar la mazmorra entera antes de la sesión les enseñe
    el plano.
  · SE GUARDAN ENTERAS: columna jsonb "zonas" y un PUT /partidas/:id/zonas
    que reemplaza la lista. Las edita una sola persona, así que no hay dos
    versiones que fusionar, y un reemplazo no deja estados a medias. El
    aviso a la mesa es mesa-cambiada (recarga filtrada), que además es el
    único correcto aquí: cada jugador ve una lista distinta.
- Partidas: entidad Partida (el creador es el máster; código de invitación
  de 6 caracteres, visible solo para él) y PersonajeEnPartida (tabla
  intermedia con el ESTADO DE SESIÓN: pgActuales —inicializado desde la
  ficha al unirse—, danoNoLetal, condiciones, posX/posY). Crear
  (/partidas/crear) y buscar por nombre o código + unirse (en el escritorio
  de la home) funcionan en el front.
- PNJ (enemigos, aliados, figurantes): un PNJ es un Character con
  tipo='pnj', propiedad del MÁSTER. Se decidió así (frente a una entidad
  aparte) porque en PF1e un monstruo tiene CA, PG, iniciativa y tamaño
  igual que un PJ: reutiliza tokens, huellas, arrastre, condiciones,
  iniciativa, permisos y socket SIN una sola rama nueva. El coste es
  filtrar: findAll(ownerId, tipo='pj') para que el bestiario no sepulte
  /personajes. El tipo NO viaja en CreateCharacterDto — por la API pública
  solo se crean PJ; 'pnj' lo pasa PartidasService como 3er argumento.
- BESTIARIO: characters.plantillaId separa las dos clases de ficha PNJ.
  · PLANTILLA (plantillaId null): el monstruo de tu colección. Persiste,
    se reutiliza y es lo único que listan GET /api/characters?tipo=pnj y la
    pestaña "Bestiario" de /personajes.
  · INSTANCIA (plantillaId = id de la plantilla): la copia sentada en una
    mesa, con sus PG y condiciones. Es DESECHABLE: sacarla de la mesa borra
    su ficha (así se evita la basura que acumulaban las emboscadas). Ojo en
    sacar(): un PJ o una PLANTILLA no se borran jamás por esa vía.
  La FK es ON DELETE SET NULL, no CASCADE: borrar una plantilla del
  bestiario no debe hacer desaparecer monstruos ya puestos en una mesa.
  La instancia COPIA el sheetData (no lo referencia): retocar la plantilla
  no cambia los monstruos ya sembrados a media partida.
- POST /api/partidas/:id/pnjs crea la PLANTILLA + N instancias (todo lo
  que creas queda reutilizable sin decidirlo antes).
  POST /api/partidas/:id/pnjs/desde-plantilla siembra N copias de una ya
  guardada, validando que la plantilla es tuya (404 si no).
  N ≤ PNJ_MAX_CANTIDAD (12); con cantidad=1 no se numera el nombre.
  UNA FICHA POR COPIA porque el asiento es único por (partida, personaje).
  En la mesa, "+ Añadir PNJ" abre en el BESTIARIO si el máster ya tiene
  monstruos guardados, y en el formulario si no tiene ninguno.
  Las estadísticas se piden por COMPONENTES (Destreza, armadura, escudo,
  natural, tamaño) como los da el Bestiario, NO como totales: así CA,
  iniciativa y huella salen de las mismas funciones puras que para un PJ y
  las condiciones siguen sumando encima. El formulario previsualiza esos
  derivados con las MISMAS funciones, así que lo que se lee al crear es lo
  que sale en la mesa.
- actitud y oculto viven en PersonajeEnPartida (el ASIENTO), no en la
  ficha: son estado de escena, y el mismo goblin puede ser enemigo aquí y
  aliado en otra mesa. El token se colorea por actitud
  (--actitud-enemigo/aliado/neutral en styles.scss), fuera de la paleta
  --token-N para que un PJ nunca se confunda con un enemigo.
- PNJ OCULTO (emboscada): el filtro está en UN SOLO SITIO, detalle(), que
  quita los ocultos si no eres el máster. Por eso los cambios de un asiento
  oculto NO pueden ir por EVENTO_ESTADO_PERSONAJE (va a toda la sala sin
  filtrar y delataría su casilla): emitirCambioDePep() los degrada a
  EVENTO_MESA_CAMBIADA, que hace recargar y vuelve a pasar por el filtro.
  PATCH :id/pnjs/:pepId revela u oculta (solo el máster).
- LAS MESAS SON PRIVADAS. Hasta 2026-07-19 no lo eran: el buscador listaba
  las 12 mesas más recientes DE TODO EL MUNDO, detalle() no comprobaba nada
  y unir() no pedía el código — el código de invitación existía pero ningún
  endpoint lo usaba, era decorativo. Cualquiera entraba en la mesa de otro.
  Las cuatro puertas, cerradas y con test de regresión:
  · detalle() → solo participantes, y responde 404 (no 403: un 403
    confirmaría que esa partida existe).
  · unir() → EXIGE el código, salvo que ya seas participante (el máster, o
    un jugador que trae un segundo personaje). Se compara en mayúsculas y
    sin espacios.
  · buscar() → sin texto devuelve []. Con texto: primero código EXACTO (la
    invitación); si no casa, por nombre pero SOLO entre tus mesas. Ya no se
    pueden enumerar mesas ajenas.
  · El socket entrarSala() comprueba la pertenencia por su cuenta. Es fácil
    de olvidar: los WebSockets NO pasan por el AuthGuard de HTTP, y antes
    bastaba con mandar un partidaId para ver moverse los tokens de una mesa
    ajena sin haberse unido. Por eso el gateway tiene sus propios repos.
- POST /api/partidas/:id/codigo regenera el código (solo el máster): la
  respuesta barata a "se me ha filtrado" — los de dentro siguen dentro y el
  viejo deja de abrir. Se prefirió a una cola de solicitudes con aprobación
  manual, que para una mesa de amigos es artillería pesada.
  En el front, la caja de búsqueda hace de campo de código: el texto se
  reenvía como codigo al unirse, pero solo si mide ≤8 (un nombre largo no
  puede ser un código de 6, y mandarlo rompería la validación del DTO).
- CERRAR UNA MESA (DELETE /api/partidas/:id, solo el máster; botón "Cerrar
  mesa" en la cabecera de la mesa, la única acción irreversible de esa
  pantalla). El endpoint existía desde el principio pero no lo llamaba nadie
  y se dejaba tres cosas sin hacer (arregladas el 2026-08-01, con los
  primeros usuarios reales): las INSTANCIAS de PNJ (fichas desechables de
  esa mesa; un PJ o una PLANTILLA no se tocan, misma regla que sacar()) y
  avisar a la sala. Había una tercera, el fichero del mapa, que dejó de
  existir al retirarse el mapa de fondo.
- PERDER EL SITIO EN UNA MESA. La mesa es privada, así que en cuanto dejas
  de ser participante detalle() responde 404 — y esa es justo la respuesta
  que llega cuando te sacan el personaje (mesa-cambiada → recarga → 404).
  Antes eso solo pintaba un error y el jugador se quedaba viendo una sala
  fantasma. Ahora un 404 en cargar() NO se trata como fallo de carga: se
  vuelve al escritorio con el motivo, vía AvisoMesaStore (un aviso de una
  sola lectura que la home consume al construirse; va en un store y no en el
  state del Router para que no sobreviva a una recarga ni al botón atrás).
  Cubre además llegar por URL a una mesa donde no estás, que dejaba la
  página en blanco. Por eso cerrar la mesa emite EVENTO_MESA_ELIMINADA y no
  mesa-cambiada: del 404 seco no se puede deducir el motivo, y con evento
  propio el aviso dice "el máster ha cerrado esa mesa". El máster que la
  cierra IGNORA su propio evento (llega antes que la respuesta HTTP, que es
  la que sabe redactarlo en primera persona).
- PartidaResumen lleva soyParticipante: el buscador ofrecía "Entrar" en
  cualquier resultado, y sin asiento esa página responde 404 — era el camino
  por el que se perdía el recién llegado. Ahora el enlace solo sale si ya
  estás dentro. En el mismo frente: con UN solo personaje el desplegable de
  "Unirse con" viene ya elegido, y cuando no hay elección se dice por qué el
  botón está apagado (un disabled mudo era el defecto). Sin ninguna ficha, el
  panel enlaza a crear una en vez de dejar un párrafo suelto. NO se cambió la
  mecánica (sentarse con una ficha es la regla del dominio): se hizo evidente.
- GET /api/partidas/mias: las mesas del usuario (las que dirige + aquellas
  donde tiene algún personaje sentado), sin tope. Devuelve MiPartidaResumen
  (PartidaResumen + soyMaster + misPersonajes). Se declara ANTES de
  @Get(':id') o 'mias' entraría por ahí y el ParseUUIDPipe daría un 400
  desconcertante. Se consulta en DOS pasos (ids primero) a propósito:
  filtrar por una relación anidada y cargar esa misma relación en una sola
  consulta hace que TypeORM devuelva solo las filas que casan.
- Vista de partida en /partidas/:id: es la ÚNICA página A SANGRE (sin
  max-width; las demás siguen centradas y acotadas). Es la pantalla de
  trabajo: las columnas se pegan a los extremos del monitor y el tablero
  queda centrado entre ellas. Las zonas crecen con clamp(18rem, 19vw, 23rem)
  y clamp(21rem, 23vw, 27rem) — con tope, porque pasado un punto una zona
  más ancha solo aleja el tablero del centro. Tablero
  responsive (rejilla de casillas cuadradas por aspect-ratio). Mide 24 de
  ancho × 30 de alto (TABLERO_ANCHO/TABLERO_ALTO en libs/shared), la medida
  de los mapas grandes de PF1e; hasta 2026-07-20 era 20×15. OJO: el .scss
  repite esos números a mano (el CSS no puede leer las constantes); si
  cambian, hay que tocar grid-template-columns/rows y aspect-ratio.
  Al ser MÁS ALTO QUE ANCHO no cabe entero en un monitor apaisado, y el
  primer intento (encogerlo hasta que cupiera) dejaba casillas de ~25px y
  dos franjas negras a los lados. Ahora el tablero LLENA el ancho
  disponible y se sale por abajo: .tablero-marco lo recorta y se RECORRE
  AGARRANDO EL FONDO (casillas de ~43px). Se pierden filas, nunca columnas,
  para no perder de vista un flanco en combate.
  · El agarre convive con lo que ya hacía el ratón: pulsar una casilla
    COLOCA. Se distinguen por distancia (UMBRAL_AGARRE, 5px); si hubo
    recorrido, el click posterior se traga en fase de CAPTURA para que no
    coloque a nadie. Sobre un token no se agarra: ahí manda el arrastre
    nativo. En táctil no se toca nada: el overflow:auto ya da el gesto.
  · Para que el tablero reciba "el hueco que sobre" (que cambia según haya
    banquillo o no, así que ningún valor fijo en rem servía) la mesa ocupa
    EXACTAMENTE el alto de la ventana y no hay scroll de página: body tiene
    height:100vh (no min-height: con min-height el body crece con su
    contenido y no hay tope contra el que repartir) + display:flex, y la
    cadena app-root → :host → .mesa → .mesa__cuerpo baja con flex:1 y
    min-height:0. .mesa__cuerpo declara grid-template-rows: minmax(0,1fr)
    porque contra una fila automática el tablero no tendría contra qué
    medirse. Los paneles laterales ya no son sticky: sin scroll de página no
    hace falta.
  · A ≤85rem se vuelve al flujo normal (display:block, tablero entero y
    scroll de página): ahí los personajes van debajo y no cabe de una
    pantallada.
  REDISEÑO DE LA MESA (2026-08-24). La pantalla tiene CINCO contenedores con
  un significado claro, y toda función nueva entra por uno de ellos; si no
  encaja en ninguno, falta una zona y eso es una decisión de diseño, no un
  botón más en la cabecera. Era justo el fallo de antes: la cabecera era una
  fila plana donde "Cerrar mesa" pesaba lo mismo que lo demás.
  1. BARRA DE MESA (.barra): sustituye a la navbar general — App.enLaMesa la
     esconde en /partidas/:id (ojo: /partidas/crear NO es una mesa y sí la
     lleva). Trae nombre, máster, el estado de la conexión, el código, el
     único botón de uso continuo ("+ Añadir PNJ") y el menú "Máster" con lo
     demás (zonas, código, y al final y marcado, cerrar la mesa).
     El antiguo botón "Actualizar" permanente es ahora un indicador "En
     vivo" (PartidaSocket.conectado); recargar a mano solo se ofrece cuando
     el socket está caído, que es cuando sirve de algo.
  2. PERSONAS (izquierda): UNA sola lista. Antes eran dos —las fichas a la
     izquierda y el orden de iniciativa a la derecha— con la misma gente
     repetida y la mirada cruzando la pantalla. En combate manda la
     iniciativa; fuera, dos grupos estables (Jugadores y luego PNJ, por
     orden de llegada). Nunca alfabético: con "Ogro veterano 2 y 3" destroza
     la lectura del encuentro. La lista NO se reordena sola: el único
     reordenamiento es el de iniciar combate. El rastreador de combate
     encabeza esta columna, no una aparte. Filas COMPACTAS de dos líneas
     (nombre / barra de PG + condiciones); todo lo demás se fue al panel.
  3. TABLERO (centro), con el banquillo como bandeja FLOTANTE sobre él: era
     una franja a lo ancho que robaba alto permanente por un estado de paso.
  4. SELECCIÓN (derecha, arriba): todo lo del token elegido en un sitio
     fijo — PG (con daño y curación POR CANTIDAD, que es como se canta en
     mesa, en vez de restar de cabeza), condiciones con su descripción,
     iniciativa, ver ficha, ocultar y sacar. Seleccionar es CONSULTAR:
     cualquiera puede mirar a cualquiera; mover sigue siendo de puedeMover.
     Aquí es donde aterrizarán los efectos temporales y los ataques del PNJ.
  5. REGISTRO (derecha, abajo): las tiradas. SIN selección se lleva la
     columna entera — nada de cajas vacías.
  Responsive: a ≤85rem Personas baja a lo ancho bajo el tablero en rejilla
  (auto-fill, 16rem) y a ≤60rem va todo en una columna.
  Tokens = avatares circulares con color propio por personaje (paleta
  --token-0..5 en styles.scss; colorToken() elige por hash del nombre); el
  del turno lleva anillo y el caído (0 PG) va gris y tachado, pero NO sale
  de la iniciativa. Mover en dos clics (banquillo para los no colocados) y
  CA derivada POR EL SERVIDOR. Permisos: máster toca todo, cada jugador lo
  suyo (PATCH /api/partidas/:id/personajes/:pepId).
  Cada zona es un COMPONENTE desde el 2026-08-25: ver "LA MESA, POR DENTRO"
  más arriba para el reparto. Al mover markup entre zonas, OJO con las
  clases que usan dos: si una vive en el .scss de una sola, la otra se queda
  sin estilos y no lo avisa nadie — le pasó a .pg, que dejó la tarjeta de tu
  personaje con el input a lo ancho y los botones apilados (arreglado
  subiéndolo a _mesa-comun.scss). Compilar el .scss y buscar en él las
  clases del .html lo caza en un minuto. Con el reparto, la hoja más gorda
  baja a ~5,5 kB (antes 17,1 kB en una sola) y el presupuesto
  anyComponentStyle vuelve a su 10/16 kB sin un solo aviso.
  PENDIENTE del rediseño: el zoom, la pestaña de Sucesos, tirar la
  iniciativa de los PNJ sola al iniciar combate y la vista de tablet con
  hoja inferior. La barra de herramientas y Medir YA ESTÁN (con el defecto
  de que tapa la esquina; ver Mejoras futuras).
- Zonas del tablero: PUT /partidas/:id/zonas con la lista entera, solo el
  máster. Ver ZONAS DEL TABLERO más arriba para las decisiones de diseño.
- Mover tokens: dos clics (token → casilla) Y arrastrar (drag & drop nativo;
  el dragover hace preventDefault para admitir el soltar). Ambas rutas acaban
  en el mismo PATCH, así que el servidor valida la huella igual.
- Tamaño y huella en el tablero: casillasQueOcupa(ficha) en libs/shared da el
  lado de la huella según el tamaño de la ficha (Grande 2×2, Enorme 3×3,
  Gargantuesco 4×4, Colosal 6×6; el resto 1×1). El resumen lleva casillas;
  el token se pinta solo en su casilla ORIGEN y se dimensiona para cubrir la
  huella (ladoToken), y ocupanteDe(x,y) considera la huella entera. El
  SERVIDOR valida al colocar (validarColocacion): que quepa en el tablero y
  que no se solape con otra huella (huellasSeSolapan) → 400 si no.
- Buscar partida: el backend devuelve solo las 12 más recientes (take: 12);
  es para encontrar TU mesa por nombre/código, no un catálogo completo.
- Tiempo real con Socket.IO: PartidasGateway autentica el handshake con la
  cookie httpOnly, una sala por partida (partida:<id>), eventos tipados en
  libs/shared (eventos-partida.ts): estado-personaje (resumen neutro sin
  esMio, se fusiona en cliente), mesa-cambiada (recargar detalle por HTTP) y
  mesa-eliminada (ya no hay nada que recargar: al escritorio).
  El servicio emite DESPUÉS de persistir. El AuthGuard global ignora el
  contexto ws (el gateway hace su propia auth). Proxy dev: /socket.io
  con ws:true en proxy.conf.json.
- Consulta de fichas en la mesa: componente reutilizable FichaVista
  (apps/pathfinder-app/src/app/characters/ficha-vista.ts) con la vista de
  SOLO LECTURA de una ficha (todos los derivados vía funciones puras). Se
  usa en el modal "Ver ficha" de /personajes Y en la mesa (el máster abre
  la ficha de cualquier jugador; el jugador, la suya).
- Condiciones estructuradas: catálogo oficial de PF1e en libs/shared
  (condiciones.ts: id ascii estable + nombre + efecto, descripciones
  propias porque la traducción de Devir tiene copyright). La columna
  condiciones pasó de texto libre a jsonb string[] (migración
  CondicionesEstructuradas). El DTO valida que cada id sea del catálogo.
  En la mesa se añaden/quitan con chips (nombre + efecto) y un desplegable.
- Sistema de efectos (condiciones.ts): MODIFICADORES_CONDICION declara los
  modificadores PLANOS y directos de cada condición (ca, pierdeDestrezaCA,
  ataque, salvaciones); efectoDeCondiciones los suma y caConCondiciones da
  la CA efectiva (parte de la desprevenida si se pierde la Destreza). El
  servidor deriva ca (efectiva), caBase, modAtaque y modSalvaciones en el
  resumen; la mesa muestra "CA 8 (base 10)" y "Por condiciones: ataque −2".
  NO se auto-aplican los efectos por cambio de característica (−4 Des del
  enredado) ni los situacionales (derribado): siguen en la descripción.
- Tiempo real de estado: EVENTO_ESTADO_PERSONAJE lleva el resumen NEUTRO
  completo (todo menos esMio, que depende de quién pregunta); así los
  derivados (CA con condiciones) llegan a todos los clientes, no solo al
  que actúa. Cada cliente fusiona conservando su propio esMio.
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