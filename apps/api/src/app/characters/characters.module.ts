import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { Character } from './entities/character.entity';
import { PersonajeEnPartida } from '../partidas/entities/personaje-en-partida.entity';
import { PartidasGatewayModule } from '../partidas/partidas-gateway.module';

@Module({
  // PersonajeEnPartida: para saber en qué mesas está un personaje (lectura
  // del máster, y a quién avisar al editar su ficha). Es solo la entidad,
  // no crea dependencia con PartidasModule.
  imports: [
    TypeOrmModule.forFeature([Character, PersonajeEnPartida]),
    // Solo el gateway (módulo aparte): editar una ficha cambia los valores
    // derivados que muestra la mesa, y hay que avisar a los demás.
    PartidasGatewayModule,
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  // PartidasModule valida la propiedad del personaje al unirse a una mesa
  exports: [CharactersService],
})
export class CharactersModule {}
