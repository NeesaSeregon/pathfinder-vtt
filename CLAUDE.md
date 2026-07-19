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
- Gestión de la propia cuenta en /api/cuenta (módulo CuentaModule): GET
  devuelve datos + contadores (personajes, mesas que diriges, mesas donde
  juegas) y DELETE la borra. Nunca hay :id en la ruta: siempre actúa sobre
  el usuario de la cookie, así que nadie puede tocar la cuenta de otro.
  PATCH /api/cuenta/password la cambia estando dentro (contraseña actual +
  nueva; la repetición de la nueva se comprueba solo en el front y no
  viaja). El hash lo hace AuthService con las mismas rondas que el registro.
  OJO: los JWT ya emitidos siguen valiendo hasta caducar (8h) — cambiar la
  contraseña NO cierra las sesiones abiertas en otros dispositivos; la
  página lo dice en voz alta. Cerrarlas exigiría versionar el token.
  Tanto el cambio como el borrado pasan por CuentaService.reautenticar(),
  que pide LA CONTRASEÑA otra vez (AuthService.verificarPassword);
  si falla responde 403, NO 401 — un 401
  significa "sesión caducada" y el authInterceptor te echaría a /entrar en
  vez de enseñarte el error. Personajes y partidas caen por el ON DELETE
  CASCADE de la BD; los ficheros de mapas hay que borrarlos a mano antes
  (PartidasService.borrarMapasDeMaster) o quedarían huérfanos en uploads/.
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

## Mejoras futuras
- PNJ: pendientes de una segunda vuelta si hacen falta en mesa — bestiario
  reutilizable (hoy cada siembra crea fichas nuevas; no hay "sembrar desde
  una plantilla ya creada"), ataques/daño en el bloque corto, y limpiar de
  golpe los PNJ muertos al terminar el combate.
- Recuperar contraseña por email ("la he olvidado"). Descartado de momento
  a conciencia: exige tabla de tokens de un solo uso con caducidad (+ su
  migración) y, sobre todo, un SERVICIO DE ENVÍO DE CORREO externo (Resend,
  Postmark, SMTP) con cuenta, clave y dominio verificado — un tema nuevo
  entero. Mientras la mesa sean amigos, el cambio desde dentro cubre el caso
  normal y una contraseña perdida se arregla por BD a mano. Hacerlo el día
  que la app salga del círculo cercano.
- Cerrar las demás sesiones al cambiar la contraseña. Hoy no ocurre: el JWT
  es autocontenido y sigue valiendo sus 8h. Haría falta VERSIONAR el token
  (columna tokenVersion en users, incluida en el payload y comparada por el
  AuthGuard en cada petición); al cambiar la contraseña se incrementa y los
  tokens viejos dejan de validar. Pequeño, pero toca el guard y añade una
  lectura de usuario por petición: hacerlo junto con lo de arriba.
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
- Usuarios funcionando: /entrar y /registro con JWT en cookie httpOnly
  (ver sección Autenticación); los personajes tienen dueño.
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
- El panel de buscar/unirse es un componente propio (UnirsePanel) que usan
  DOS sitios: el escritorio y /partidas/buscar (que se queda como página
  completa). Antes vivía escrito a mano en la página. Emite (unido) para
  que la home recargue sus mesas al sentarte en una nueva.
- Ninguna acción irreversible se dispara desde la home: el borrado de cuenta
  vive solo en /cuenta, en su zona peligrosa (plegada; al desplegarla pide
  la contraseña y avisa de cuántos personajes y partidas se pierden).
  /cuenta tiene cuatro bloques: Datos, Tu material (cifras), Contraseña
  (cambio plegado, con actual + nueva + repetición) y Sesión, más la zona
  peligrosa del borrado al final.
- Partidas: entidad Partida (el creador es el máster; código de invitación
  de 6 caracteres, visible solo para él) y PersonajeEnPartida (tabla
  intermedia con el ESTADO DE SESIÓN: pgActuales —inicializado desde la
  ficha al unirse—, danoNoLetal, condiciones, posX/posY). /partidas/crear
  y /partidas/buscar (por nombre o código) + unirse funcionan en el front.
- PNJ (enemigos, aliados, figurantes): un PNJ es un Character con
  tipo='pnj', propiedad del MÁSTER. Se decidió así (frente a una entidad
  aparte) porque en PF1e un monstruo tiene CA, PG, iniciativa y tamaño
  igual que un PJ: reutiliza tokens, huellas, arrastre, condiciones,
  iniciativa, permisos y socket SIN una sola rama nueva. El coste es
  filtrar: findAll(ownerId, tipo='pj') para que el bestiario no sepulte
  /personajes. El tipo NO viaja en CreateCharacterDto — por la API pública
  solo se crean PJ; 'pnj' lo pasa PartidasService como 3er argumento.
- POST /api/partidas/:id/pnjs siembra N (PNJ_MAX_CANTIDAD=12). Crea UNA
  FICHA POR COPIA (Goblin 1..N) porque el asiento es único por
  (partida, personaje). Con cantidad=1 no se numera.
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
  queda centrado entre ellas. Los paneles crecen con clamp(21rem, 20vw,
  27rem) y clamp(23rem, 21vw, 29rem) — con tope, porque pasado un punto un
  panel más ancho solo aleja el tablero del centro. El padding lateral
  coincide con el de la navbar (1.25rem) para que todo alinee. Tablero
  responsive (rejilla de casillas cuadradas por aspect-ratio,
  acotada por el alto de la ventana) y TRES columnas por grid-template-areas
  ('personajes tablero juego', 21rem | 1fr | 23rem): las fichas de los
  personajes a la IZQUIERDA y combate + dados a la DERECHA. Antes iba todo
  apilado en el panel derecho, que quedaba larguísimo y estrechaba el
  tablero. Ambos paneles son pegajosos y con scroll propio. Responsive:
  a ≤85rem los personajes bajan a lo ancho bajo el tablero en rejilla de
  tarjetas (auto-fill, 18rem) y a ≤60rem va todo en una columna. Tokens = avatares circulares con color propio por
  personaje (paleta --token-0..5 en styles.scss; colorToken() elige por hash
  del nombre). Mover en dos clics (banquillo para los no colocados), PG y
  condiciones editables y CA derivada POR EL SERVIDOR. Permisos: máster toca
  todo, cada jugador lo suyo (PATCH /api/partidas/:id/personajes/:pepId).
- Mapa de fondo del tablero: lo sube el MÁSTER (POST :id/mapa, multipart,
  campo "mapa"); GET :id/mapa lo sirve y DELETE :id/mapa lo quita. Se guarda
  EN DISCO, no en la BD: la columna partidas.mapaFichero solo lleva el nombre
  generado (uuid + extensión por MIME — nunca el nombre del cliente). Carpeta
  configurable con UPLOADS_DIR (por defecto ./uploads/mapas, en .gitignore);
  en despliegue debe ser un VOLUMEN montado. Tipos admitidos y tope de 8 MB
  en libs/shared (MAPA_TIPOS, MAPA_MAX_BYTES), validados también en servidor.
  Se usa el almacenamiento en memoria de multer y escribimos el fichero a
  mano (así no hace falta @types/multer). Al reemplazar o quitar se borra el
  fichero anterior. En el front, el tablero lo pinta de fondo y las casillas
  se vuelven translúcidas (clase tablero--con-mapa).
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
  esMio, se fusiona en cliente) y mesa-cambiada (recargar detalle por HTTP).
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