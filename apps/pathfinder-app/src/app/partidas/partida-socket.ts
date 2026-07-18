import { Service } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  EstadoPersonajeEvento,
  EVENTO_ENTRAR_SALA,
  EVENTO_ESTADO_PERSONAJE,
  EVENTO_MESA_CAMBIADA,
} from '@pathfinder/shared';

export interface EscuchasDeMesa {
  /** El estado de un personaje cambió: fusiona los cambios en tu copia. */
  onEstadoPersonaje: (evento: EstadoPersonajeEvento) => void;
  /** La composición de la mesa cambió: recarga el detalle por HTTP. */
  onMesaCambiada: () => void;
}

/**
 * Conexión Socket.IO de la mesa. El navegador envía la cookie httpOnly
 * en el handshake (mismo origen, vía proxy), así que el servidor sabe
 * quiénes somos sin que aquí haya que tocar ningún token.
 */
@Service()
export class PartidaSocket {
  private socket: Socket | null = null;

  conectar(partidaId: string, escuchas: EscuchasDeMesa): void {
    this.desconectar();
    this.socket = io({ path: '/socket.io' });
    // Al (re)conectar, entra a la sala: cubre también cortes de red
    this.socket.on('connect', () => {
      this.socket?.emit(EVENTO_ENTRAR_SALA, { partidaId });
    });
    this.socket.on(EVENTO_ESTADO_PERSONAJE, escuchas.onEstadoPersonaje);
    this.socket.on(EVENTO_MESA_CAMBIADA, escuchas.onMesaCambiada);
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
