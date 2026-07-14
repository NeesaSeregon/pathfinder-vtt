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
- Tests: npx nx run-many -t test

## Convenciones
- Todo modelo o evento compartido entre front y back se define en
  libs/shared, nunca duplicado.
- El front consume la API vía /api con proxy.conf.json en desarrollo.
- Angular: componentes standalone y signals; evitar NgModules y Zone.js.
- Generar código nuevo con generadores de Nx cuando exista uno
  (nx g @nx/nest:resource, nx g @angular/...), no a mano.
- Los comandos se ejecutan en PowerShell (Windows).

## Estado actual
- Estructura del monorepo creada y subida a GitHub.
- Persistencia funcionando: PostgreSQL 17 (Docker) + TypeORM con
  synchronize: true (solo desarrollo; pasar a migraciones antes de producción).
- Primer recurso CRUD: /api/characters (entidad Character con columna JSONB
  sheetData). Modelo compartido Character en libs/shared.