import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Character } from './app/characters/entities/character.entity';
import { User } from './app/users/entities/user.entity';
import { Partida } from './app/partidas/entities/partida.entity';
import { PersonajeEnPartida } from './app/partidas/entities/personaje-en-partida.entity';

// El CLI de migraciones vive FUERA de Nest, así que no dispone del
// ConfigModule que carga el .env. Lo cargamos aquí a mano para leer las
// MISMAS credenciales que usa la app (el .env de la raíz del repo).
cargarEnv();

/**
 * DataSource que usa el CLI de TypeORM para generar y aplicar migraciones.
 * Comparte credenciales y entidades con la app (app.module.ts), pero aquí
 * synchronize está DESACTIVADO a propósito: el esquema de la base de datos
 * solo cambia mediante migraciones versionadas en git, nunca en caliente.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'pathfinder',
  password: process.env.DB_PASSWORD ?? 'pathfinder',
  database: process.env.DB_NAME ?? 'pathfinder',
  // Entidades listadas explícitamente (no por glob): más robusto bajo
  // ts-node en Windows y deja claro qué tablas gobierna el esquema.
  entities: [Character, User, Partida, PersonajeEnPartida],
  // Las migraciones viven junto al datasource; el glob cubre tanto los
  // .ts (dev/CI vía ts-node) como los .js (si algún día se compilan).
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
