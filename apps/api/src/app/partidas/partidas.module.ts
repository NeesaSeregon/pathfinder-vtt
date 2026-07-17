import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartidasService } from './partidas.service';
import { PartidasController } from './partidas.controller';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import { CharactersModule } from '../characters/characters.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partida, PersonajeEnPartida]),
    // Para validar la propiedad del personaje al unirse a una mesa
    CharactersModule,
  ],
  controllers: [PartidasController],
  providers: [PartidasService],
})
export class PartidasModule {}
