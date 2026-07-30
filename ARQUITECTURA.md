# Arquitectura técnica — Pathfinder VTT

Documentación del funcionamiento interno de la aplicación: qué hace cada
bloque, cómo se comunican el frontend y el backend entre sí y con PostgreSQL,
y cómo está montado el testing.

> Documentos hermanos: [CLAUDE.md](CLAUDE.md) (notas de trabajo y decisiones
> de diseño con su porqué) y [DESPLIEGUE.md](DESPLIEGUE.md) (puesta en
> producción). Este documento explica **cómo funciona**; aquellos, **por qué**
> y **cómo se despliega**.

---

## 1. Visión general

Pathfinder VTT es una aplicación web para gestionar fichas de personaje de
Pathfinder 1e y jugar partidas sobre un **tablero virtual compartido en tiempo
real**. Cada partida tiene dos roles: **máster** y **jugadores**.

### Stack

| Capa            | Tecnología                                                        |
| --------------- | ----------------------------------------------------------------- |
| Frontend        | Angular 22 (zoneless, signals), compilado con esbuild             |
| Backend         | NestJS 11 sobre Node 24 y Express                                  |
| Tipos comunes   | TypeScript compartido en `libs/shared`                            |
| Base de datos   | PostgreSQL 17 + TypeORM (migraciones versionadas)                 |
| Tiempo real     | Socket.IO (WebSocket)                                             |
| Monorepo        | Nx (gestor de paquetes: npm)                                      |

### Los tres bloques del monorepo

```
pathfinder-vtt/
├── apps/
│   ├── pathfinder-app/      FRONTEND  (Angular)
│   ├── pathfinder-app-e2e/  tests de extremo a extremo (Cypress)
│   └── api/                 BACKEND   (NestJS)
└── libs/
    └── shared/              CONTRATO  (tipos y lógica pura compartidos)
```

La regla de oro: **todo lo que front y back comparten vive en `libs/shared`**,
nunca duplicado. Se importa como `@pathfinder/shared` desde los dos lados.

```
   ┌────────────────┐         HTTP /api  +  WebSocket        ┌────────────────┐
   │   FRONTEND     │ ◄─────────────────────────────────────►│    BACKEND     │
   │  (Angular)     │                                        │   (NestJS)     │
   └───────┬────────┘                                        └───────┬────────┘
           │                                                         │
           │            ambos importan los mismos tipos             │ TypeORM
           │                 y funciones puras                      │
           ▼                                                         ▼
   ┌─────────────────────────────────────────┐            ┌────────────────┐
   │            @pathfinder/shared            │            │  PostgreSQL 17 │
   │   modelos · eventos · cálculos de reglas │            └────────────────┘
   └─────────────────────────────────────────┘
```

---

## 2. `libs/shared` — el contrato entre las dos mitades

Es la pieza que mantiene coherentes el front y el back. Contiene **solo tipos
y funciones puras** (sin dependencias de Angular ni de Nest), en
[libs/shared/src/lib/models/](libs/shared/src/lib/models/):

| Fichero            | Qué define                                                          |
| ------------------ | ------------------------------------------------------------------- |
| `character.ts`     | El modelo `Character` y **todos los cálculos de reglas** (ver abajo) |
| `partida.ts`       | Modelos de partida, `PersonajeEnPartidaResumen`, dimensiones del tablero |
| `condiciones.ts`   | Catálogo oficial de condiciones de PF1e y sus modificadores         |
| `tirada.ts`        | `lanzarDados()`: parseo y resolución de notación de dados ("1d20+5") |
| `eventos-partida.ts`| Los eventos tipados del WebSocket (contrato del tiempo real)        |
| `auth.ts`          | DTOs de sesión, cuenta y cambio de contraseña                       |

### Los cálculos de reglas viven aquí, y son funciones puras

Decisión central del proyecto: **los valores derivados no se guardan nunca**.
La ficha almacena solo los DATOS ORIGEN (puntuaciones, clase de armadura
base…). Todo lo que se deduce de ellos —modificadores, CA de toque y
desprevenida, iniciativa, casillas de movimiento— lo calculan funciones puras
como `claseDeArmadura()`, `iniciativa()` o `casillasQueOcupa()`.

La ventaja de tenerlas en `shared`: el **front** las usa para previsualizar en
vivo (p. ej. al crear un PNJ se ve su CA antes de guardar) y el **back** las usa
para derivar los valores que manda a la mesa. Como es el mismo código, lo que
el jugador ve al crear es exactamente lo que sale en el tablero.

---

## 3. Backend (NestJS)

Vive en [apps/api/](apps/api/). Es una API REST + un gateway de WebSocket,
organizada en **módulos** por dominio. Cada módulo agrupa su controlador
(rutas HTTP), su servicio (lógica) y, si procede, sus entidades y DTOs.

### Módulos

```
apps/api/src/app/
├── auth/         Registro, login, sesión, y toda la seguridad transversal
├── users/        Acceso a la tabla de usuarios (lo consume auth y cuenta)
├── characters/   CRUD de fichas de personaje (PJ y PNJ)
├── cuenta/       Gestión de la propia cuenta (datos, contraseña, borrado)
└── partidas/     Partidas, tablero, tiempo real (el módulo más grande)
```

#### `auth` — autenticación y seguridad

Es transversal: protege TODA la API. Piezas clave:

- **`AuthController`** — `POST /api/auth/register`, `/login`, `/logout`,
  `GET /me`. El login y el registro emiten un **JWT** (expira en 8 h) que viaja
  en una **cookie httpOnly + SameSite=Strict** (`pf_sesion`). Al ser httpOnly,
  el JavaScript nunca ve el token: un ataque XSS no puede robarlo.
- **`AuthGuard`** (registrado como `APP_GUARD`, global) — la API es **segura
  por defecto**: toda ruta exige sesión válida salvo las marcadas con el
  decorador `@Public()`. Lee la cookie (con `Authorization: Bearer` como
  respaldo para scripts).
- **`IntentosLoginService`** — freno de fuerza bruta. Cuenta SOLO los fallos,
  por pareja email+IP, y responde **429** sin llegar a comprobar la contraseña.
- **`IpCliente`** (decorador) — obtiene la IP real del visitante, prefiriendo la
  cabecera `CF-Connecting-IP` de Cloudflare cuando existe. Es lo que hace que
  el freno anterior funcione detrás de un proxy.

#### `characters` — fichas

CRUD de personajes. Cada `Character` tiene dueño (`ownerId`): un usuario solo
ve y toca los suyos (el de otro devuelve **404**, no 403, para no confirmar
siquiera que existe). Un mismo modelo sirve para **PJ y PNJ** (`tipo`), y para
el bestiario distingue **plantillas** (monstruos guardados) de **instancias**
(la copia sentada en una mesa) mediante `plantillaId`.

#### `partidas` — el corazón del juego

El módulo más grande. Contiene:

- **`PartidasController` / `PartidasService`** — crear/buscar/unirse a mesas,
  el estado de la sesión (posición de tokens, PG, condiciones, iniciativa,
  combate), sembrar PNJ, subir el mapa de fondo, y las tiradas de dados.
- **`PartidasGateway`** — el servidor de **WebSocket** (ver §6). Vive en su
  propio submódulo (`PartidasGatewayModule`) para romper un ciclo de
  dependencias: tanto `partidas` como `characters` necesitan emitir eventos.

Las mesas son **privadas**: solo se entra con el código de invitación, y tanto
el detalle HTTP como la sala de WebSocket comprueban la pertenencia por su
cuenta.

### Arranque y responsabilidades de `main.ts`

[apps/api/src/main.ts](apps/api/src/main.ts) hace más que arrancar Nest:

1. **Sirve el front compilado** en producción (mismo origen que la API → la
   cookie SameSite=Strict viaja sin CORS) con un respaldo de SPA para que
   recargar en `/partidas/:id` no dé 404.
2. **`trust proxy`** para leer el protocolo real detrás del proxy inverso y
   permitir la cookie `secure`.
3. **`ValidationPipe` global** (`whitelist` + `transform`): valida y convierte
   cada body JSON en su DTO antes de llegar al controlador.

---

## 4. Base de datos (PostgreSQL + TypeORM)

### Entidades y relaciones

Cuatro tablas, definidas como entidades de TypeORM en
`apps/api/src/app/**/entities/`:

```
   users ──1:N──► characters ──1:N──► personajes_en_partida ◄──N:1── partidas
    │                                                                    │
    └── el creador de una partida es su master (partidas.masterId) ──────┘
```

- **`users`** — cuentas (email, hash de contraseña con bcryptjs).
- **`characters`** — fichas (PJ y PNJ). Columna clave: **`sheetData` (JSONB)**.
- **`partidas`** — mesas (máster, código de invitación, estado de combate).
- **`personajes_en_partida`** (PEP) — tabla intermedia. Es el **asiento** de un
  personaje en una mesa y guarda el **ESTADO DE SESIÓN**: PG actuales, daño no
  letal, condiciones, posición (`posX`/`posY`), iniciativa, actitud, oculto.

### Doctrina de datos: qué se guarda y qué no

Es la decisión de diseño más importante y explica el reparto de columnas:

- **`characters.sheetData` (JSONB)** guarda solo los **datos origen** de la
  ficha. Los valores derivados NO se persisten: se calculan con las funciones
  puras de `shared` cuando hacen falta.
- **El estado de sesión** (lo que cambia jugando: PG, condiciones, posición) NO
  va en la ficha, sino en `personajes_en_partida`. Así el mismo goblin puede
  estar malherido en una mesa e intacto en otra.

### Migraciones: el esquema solo cambia de forma versionada

`synchronize` está en **`false`** a propósito (activarlo dejaría que TypeORM
adivinara cambios de esquema y podría destruir datos). El esquema **solo** se
modifica con **migraciones versionadas en git**, en
[apps/api/src/migrations/](apps/api/src/migrations/), que llevan el SQL exacto,
revisado y reversible.

- El CLI de migraciones usa un `DataSource` propio
  ([apps/api/src/data-source.ts](apps/api/src/data-source.ts)), fuera de Nest.
- Flujo al cambiar una entidad: editar la entidad → `npm run
  migration:generate` escribe el diff → **se revisa a mano** → `migration:run`
  → commit del fichero.
- En producción, las migraciones corren **automáticamente en cada despliegue**
  antes de arrancar la API (ver DESPLIEGUE.md).

---

## 5. Frontend (Angular)

Vive en [apps/pathfinder-app/](apps/pathfinder-app/). Angular 22 en modo
**zoneless** (sin Zone.js) con **signals**: el estado son señales (`signal`,
`computed`, `effect`) y la UI reacciona a sus cambios sin detección de cambios
tradicional. Componentes **standalone**, sin NgModules.

### Estructura por secciones

```
apps/pathfinder-app/src/app/
├── auth/        login, registro, sesión (store, guard, interceptor, api)
├── home/        la home: portada (sin sesión) y escritorio (con sesión)
├── characters/  listado y formulario de fichas, vista de solo lectura
├── cuenta/      gestión de la propia cuenta
└── partidas/    crear mesa y la vista del tablero en tiempo real
```

### Patrones transversales del front

- **Servicios `*-api.ts`** (`AuthApi`, `CharactersApi`, `PartidasApi`,
  `CuentaApi`) — cada uno encapsula las llamadas HTTP de su dominio contra
  `/api`. Los componentes nunca llaman a `HttpClient` directamente.
- **`SesionStore`** — señal con el usuario actual; la UI (navbar, guards) la
  observa. Al arrancar la app se restaura preguntando a `GET /api/auth/me`
  (la cookie httpOnly no se puede leer desde JS, hay que preguntar).
- **`authGuard`** — protege las rutas que exigen sesión.
- **`authInterceptor`** — ante un **401** limpia la sesión y redirige a
  `/entrar`. (Por eso ciertos errores usan 403 y no 401 a propósito: un 401
  significa "tu sesión ha caducado" y te echaría.)

### La vista del tablero

[partida-detalle-page.ts](apps/pathfinder-app/src/app/partidas/partida-detalle-page.ts)
es el componente más rico: pinta la rejilla (24×30 casillas), coloca los tokens
según su huella, permite moverlos (dos clics o arrastrar), gestiona PG y
condiciones, el rastreador de iniciativa y las tiradas. Se mantiene sincronizado
por WebSocket a través de [partida-socket.ts](apps/pathfinder-app/src/app/partidas/partida-socket.ts).

---

## 6. Cómo se comunican front y back

Dos canales, cada uno para lo suyo.

### Canal 1 — HTTP REST (peticiones puntuales)

Todo bajo el prefijo **`/api`**. El front llama; el back responde.

- **En desarrollo**, el front (`nx serve`, puerto 4200) y la API (puerto 3000)
  son procesos separados: un **proxy** (`proxy.conf.json`) reenvía `/api` y
  `/socket.io` de uno a otro, así el navegador cree que todo es el mismo origen.
- **En producción**, la propia API sirve el front, así que ya son el mismo
  origen de verdad.
- La sesión viaja en la **cookie** `pf_sesion` en cada petición,
  automáticamente. El front nunca manipula el token.

```
  Componente ──► *-api.ts ──► HttpClient ──► /api/... ──► Controller ──► Service ──► TypeORM ──► PostgreSQL
                                                                                                    │
  Componente ◄── signal  ◄── (respuesta JSON, tipos de @pathfinder/shared) ◄────────────────────────┘
```

### Canal 2 — WebSocket / Socket.IO (tiempo real)

El HTTP no basta para una mesa compartida: si un jugador mueve un token, los
demás deben verlo **sin recargar**. Eso lo resuelve Socket.IO.

- El **`PartidasGateway`** del back autentica el handshake con la misma cookie
  y mete a cada cliente en una **sala por partida** (`partida:<id>`).
- Los eventos son **tipados y compartidos** (`eventos-partida.ts`):
  - `EVENTO_ESTADO_PERSONAJE` — el resumen neutro de un personaje que cambió
    (CA, PG, posición, condiciones…). Se fusiona en cada cliente.
  - `EVENTO_MESA_CAMBIADA` — "recarga el detalle por HTTP". Se usa cuando un
    cambio no puede viajar entero sin filtrar información (p. ej. un PNJ oculto).
  - `EVENTO_TIRADA_DADOS` — una tirada resuelta, para el registro compartido.
- El servidor emite **siempre después de persistir**: primero la base de datos,
  luego el aviso. Así nadie ve un estado que no llegó a guardarse.

### Flujo completo de una acción (mover un token)

```
1. Jugador arrastra un token          (FRONTEND)
2. PartidasApi.actualizarPersonaje()  → PATCH /api/partidas/:id/personajes/:pepId
3. PartidasService valida la huella con casillasQueOcupa() de @pathfinder/shared
4. TypeORM guarda posX/posY en personajes_en_partida        (POSTGRESQL)
5. El servicio emite EVENTO_ESTADO_PERSONAJE a la sala       (WEBSOCKET)
6. Todos los navegadores de esa mesa reciben el evento y actualizan su signal
7. El token se mueve en la pantalla de todos, sin recargar   (FRONTEND)
```

La fuente de azar (tiradas) y la validación (¿cabe el token?, ¿es tuyo ese
personaje?) están **siempre en el servidor**: el cliente propone, el servidor
dispone.

---

## 7. Testing

El proyecto se apoya en tres niveles de test, con la herramienta adecuada en
cada capa. Estado actual: **97 (shared) + 94 (API) + 64 (front) unitarios, y
30 de extremo a extremo**.

### La pirámide

```
        ╱╲          e2e (Cypress) — 1 spec, 30 tests
       ╱  ╲         Flujos reales de usuario en un navegador de verdad
      ╱────╲        contra front + API + PostgreSQL levantados.
     ╱      ╲
    ╱ unit   ╲      unitarios (Vitest / Jest) — 30 specs
   ╱  e int.  ╲     Lógica de servicios, componentes y funciones puras
  ╱────────────╲    aislada, rápida.
```

### Nivel 1 — Unitarios y de integración

| Bloque          | Runner  | Qué prueba                                                    |
| --------------- | ------- | ------------------------------------------------------------- |
| `libs/shared`   | Vitest  | Las **funciones puras de reglas** (CA, iniciativa, dados, condiciones). Es donde más tests hay: es el cerebro de las reglas y no debe fallar nunca. |
| `apps/api`      | Jest    | **Servicios y controladores** con sus dependencias simuladas (mocks): permisos, el freno de login, la lógica de partidas, el decorador de IP… |
| `apps/pathfinder-app` | Vitest (vía `@angular/build:unit-test`) | **Componentes y servicios** del front: que el escritorio no pida datos sin sesión, que un formulario avise de cambios sin guardar, etc. |

Los tests viven **junto al código** que prueban (`*.spec.ts`). Ejemplos
representativos:

- `character.spec.ts` — que `modificadorDeCaracteristica(20)` es +5, que la CA
  con armadura pesada da las casillas de movimiento correctas…
- `partidas.service.spec.ts` — que un personaje Grande no cabe pegado al borde,
  que no se pisan dos huellas, que la mesa de otro devuelve 404.
- `ip-cliente.decorator.spec.ts` — que se prefiere `CF-Connecting-IP` y se cae
  en `req.ip` cuando no está.

### Nivel 2 — Extremo a extremo (e2e)

En [apps/pathfinder-app-e2e/](apps/pathfinder-app-e2e/), con **Cypress**. Un
único fichero, [app.cy.ts](apps/pathfinder-app-e2e/src/e2e/app.cy.ts), que
arranca el front y la API de verdad y los maneja como un usuario en un
navegador real. Cubre los flujos completos, entre ellos:

- Registro, login (y que una contraseña incorrecta se explica sin echarte).
- Crear una mesa, encontrarla por nombre y unirse con un personaje.
- **Regresiones de seguridad**: que la mesa de otro no se lista, ni se ve, ni se
  entra sin código.
- Mover un token y ver el cambio reflejado **por el WebSocket sin recargar**.
- Sembrar PNJ desde el bestiario, la emboscada (PNJ oculto), el rastreador de
  iniciativa, subir un mapa de fondo, cambiar la contraseña, borrar la cuenta.

Son la red de seguridad que confirma que las piezas encajan de verdad, no solo
por separado.

### Cómo ejecutarlos

```bash
npx nx run-many -t lint test    # lint + todos los unitarios (shared, api, front)
npx nx e2e pathfinder-app-e2e   # los e2e (Cypress arranca los servidores solo)
```

> En Windows, antes de los e2e conviene liberar el entorno de
> `ELECTRON_RUN_AS_NODE`, o Cypress falla al lanzarse.

### Integración continua (CI)

En [.github/workflows/ci.yml](.github/workflows/ci.yml): en cada push a `main`
y en cada Pull Request, GitHub Actions ejecuta **lint + unitarios + e2e +
build de producción**, con un PostgreSQL 17 real como service container y las
migraciones aplicadas antes de los e2e. Así el CI es fiel a producción: si algo
pasa en verde, se puede desplegar.

---

## 8. Despliegue (resumen)

La aplicación se empaqueta en una **imagen Docker** (Dockerfile multifase: la
API sirve también el front) y se despliega con **Coolify**, que aporta el
proxy inverso, el HTTPS automático, las variables y los backups. El detalle
paso a paso está en [DESPLIEGUE.md](DESPLIEGUE.md).
