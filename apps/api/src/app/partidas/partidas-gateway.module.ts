import { Module } from '@nestjs/common';
import { PartidasGateway } from './partidas.gateway';

/**
 * El gateway vive en su propio módulo porque lo necesitan DOS: PartidasModule
 * (estado de la mesa, tiradas) y CharactersModule (al editar una ficha hay
 * que avisar a las mesas donde está sentada). Si CharactersModule importara
 * PartidasModule tendríamos un ciclo, porque PartidasModule ya importa
 * CharactersModule. Solo depende de JwtService, que es global.
 */
@Module({
  providers: [PartidasGateway],
  exports: [PartidasGateway],
})
export class PartidasGatewayModule {}
