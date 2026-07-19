import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartidasService } from './partidas.service';
import { PartidasController } from './partidas.controller';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import { CharactersModule } from '../characters/characters.module';
import { PartidasGatewayModule } from './partidas-gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partida, PersonajeEnPartida]),
    // Para validar la propiedad del personaje al unirse a una mesa
    CharactersModule,
    PartidasGatewayModule,
  ],
  controllers: [PartidasController],
  providers: [PartidasService],
  // Exportado para que CuentaModule limpie los mapas al borrar la cuenta
  exports: [PartidasService],
})
export class PartidasModule {}
