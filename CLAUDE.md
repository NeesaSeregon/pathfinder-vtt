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

## Convenciones
- Todo modelo o evento compartido entre front y back se define en
  libs/shared, nunca duplicado.
- El front consume la API vía /api con proxy.conf.json en desarrollo.
- Angular: componentes standalone y signals; evitar NgModules y Zone.js.
- Generar código nuevo con generadores de Nx cuando exista uno
  (nx g @nx/nest:resource, nx g @angular/...), no a mano.
- Los comandos se ejecutan en PowerShell (Windows).

## Decisiones de diseño
- sheetData (JSONB) guarda solo DATOS ORIGEN del personaje; los derivados
  (modificadores, CA/toque/desprevenido, iniciativa, casillas/metros) se
  calculan con funciones puras en libs/shared, nunca se persisten.
- El ESTADO DE SESIÓN (PG actuales, daño no letal, condiciones y efectos
  temporales de combate) NO va en sheetData: pertenecerá al modelo de
  partida cuando exista el tablero compartido. Decidido el 2026-07-15
  para trabajar con vistas a la integración ficha-tablero.

## Estado actual
- Estructura del monorepo creada y subida a GitHub.
- Persistencia funcionando: PostgreSQL 17 (Docker) + TypeORM con
  synchronize: true (solo desarrollo; pasar a migraciones antes de producción).
- Primer recurso CRUD: /api/characters (entidad Character con columna JSONB
  sheetData). Modelo compartido Character en libs/shared.
- El front tiene una página de personajes (listar, crear, borrar) en la ruta
  raíz, servida contra /api/characters vía proxy. E2E con Cypress verificando
  el flujo completo (npx nx e2e pathfinder-app-e2e).