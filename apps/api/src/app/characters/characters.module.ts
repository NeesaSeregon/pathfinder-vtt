import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { Character } from './entities/character.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';

@Module({
  // PersonajeEnPartida: para saber en qué mesas está un personaje (lectura
  // del máster). Es solo la entidad, no crea dependencia con PartidasModule.
  imports: [TypeOrmModule.forFeature([Character, PersonajeEnPartida])],
  controllers: [CharactersController],
  providers: [CharactersService],
  // PartidasModule valida la propiedad del personaje al unirse a una mesa
  exports: [CharactersService],
})
export class CharactersModule {}
