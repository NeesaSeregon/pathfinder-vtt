import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CharactersModule } from './characters/characters.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PartidasModule } from './partidas/partidas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'pathfinder'),
        password: config.get('DB_PASSWORD', 'pathfinder'),
        database: config.get('DB_NAME', 'pathfinder'),
        autoLoadEntities: true,
        // El esquema NO se toca en el arranque: todos los cambios pasan
        // por migraciones versionadas (ver apps/api/src/data-source.ts y
        // los scripts migration:* en package.json). synchronize: true
        // podía destruir datos al adivinar diffs; ya no lo usamos.
        synchronize: false,
      }),
    }),
    CharactersModule,
    UsersModule,
    AuthModule,
    PartidasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
