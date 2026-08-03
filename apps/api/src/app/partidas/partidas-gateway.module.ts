import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartidasGateway } from './partidas.gateway';
import { Partida } from './entities/partida.entity';
import { PersonajeEnPartida } from './entities/personaje-en-partida.entity';
import { UsersModule } from '../users/users.module';

/**
 * El gateway vive en su propio módulo porque lo necesitan DOS: PartidasModule
 * (estado de la mesa, tiradas) y CharactersModule (al editar una ficha hay
 * que avisar a las mesas donde está sentada). Si CharactersModule importara
 * PartidasModule tendríamos un ciclo, porque PartidasModule ya importa
 * CharactersModule. Depende de JwtService, que es global, y de UsersModule
 * para comprobar el tokenVersion en el handshake.
 */
@Module({
  // El gateway consulta la pertenencia por su cuenta al entrar en una sala:
  // los WebSockets no pasan por el AuthGuard de HTTP.
  imports: [TypeOrmModule.forFeature([Partida, PersonajeEnPartida]), UsersModule],
  providers: [PartidasGateway],
  exports: [PartidasGateway],
})
export class PartidasGatewayModule {}
