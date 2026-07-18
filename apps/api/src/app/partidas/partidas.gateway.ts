import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
  EntrarSala,
  EstadoPersonajeEvento,
  EVENTO_ENTRAR_SALA,
  EVENTO_ESTADO_PERSONAJE,
  EVENTO_MESA_CAMBIADA,
  EVENTO_TIRADA_DADOS,
  JwtPayload,
  PersonajeEnPartidaResumen,
  TiradaResultado,
} from '@pathfinder/shared';
import { COOKIE_SESION } from '../auth/auth.constants';

/**
 * Saca el JWT del header Cookie del handshake. El handshake de un
 * WebSocket es una petición HTTP normal, así que la cookie httpOnly
 * viaja en él igual que en cualquier fetch del mismo origen.
 */
export function extraerTokenDeCookie(
  cookieHeader: string | undefined,
): string | undefined {
  return cookieHeader
    ?.split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_SESION}=`))
    ?.slice(COOKIE_SESION.length + 1);
}

const sala = (partidaId: string) => `partida:${partidaId}`;

@WebSocketGateway()
export class PartidasGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  /** Sin token válido no hay conexión: el tablero es solo para usuarios. */
  async handleConnection(socket: Socket): Promise<void> {
    const token = extraerTokenDeCookie(socket.handshake.headers.cookie);
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token ?? '');
      socket.data['user'] = payload;
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage(EVENTO_ENTRAR_SALA)
  entrarSala(
    @ConnectedSocket() socket: Socket,
    @MessageBody() datos: EntrarSala,
  ): void {
    if (typeof datos?.partidaId === 'string') {
      socket.join(sala(datos.partidaId));
    }
  }

  /** Lo llama PartidasService tras guardar un cambio de estado. */
  emitirEstadoPersonaje(
    partidaId: string,
    pepId: string,
    cambios: Partial<Omit<PersonajeEnPartidaResumen, 'esMio'>>,
  ): void {
    const evento: EstadoPersonajeEvento = { pepId, cambios };
    this.server?.to(sala(partidaId)).emit(EVENTO_ESTADO_PERSONAJE, evento);
  }

  /** Alguien entró o salió de la mesa: que los clientes recarguen. */
  emitirMesaCambiada(partidaId: string): void {
    this.server?.to(sala(partidaId)).emit(EVENTO_MESA_CAMBIADA);
  }

  /** Alguien tiró los dados: el resultado (ya resuelto) va a toda la sala. */
  emitirTirada(partidaId: string, tirada: TiradaResultado): void {
    this.server?.to(sala(partidaId)).emit(EVENTO_TIRADA_DADOS, tirada);
  }
}
