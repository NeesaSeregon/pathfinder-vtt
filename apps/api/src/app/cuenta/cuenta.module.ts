import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaService } from './cuenta.service';
import { CuentaController } from './cuenta.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { PartidasModule } from '../partidas/partidas.module';
import { Character } from '../characters/entities/character.entity';
import { Partida } from '../partidas/entities/partida.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';

@Module({
  imports: [
    // Solo para CONTAR lo que cuelga de la cuenta; el borrado real lo hace
    // el ON DELETE CASCADE de la base de datos.
    TypeOrmModule.forFeature([Character, Partida, PersonajeEnPartida]),
    UsersModule,
    AuthModule,
    PartidasModule,
  ],
  controllers: [CuentaController],
  providers: [CuentaService],
})
export class CuentaModule {}
