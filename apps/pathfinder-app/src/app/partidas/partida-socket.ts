import { Service, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  EstadoPersonajeEvento,
  EVENTO_ENTRAR_SALA,
  EVENTO_ESTADO_PERSONAJE,
  EVENTO_MESA_CAMBIADA,
  EVENTO_MESA_ELIMINADA,
  EVENTO_TIRADA_DADOS,
  TiradaResultado,
} from '@pathfinder/shared';

export interface EscuchasDeMesa {
  /** El estado de un personaje cambió: fusiona los cambios en tu copia. */
  onEstadoPersonaje: (evento: EstadoPersonajeEvento) => void;
  /** La composición de la mesa cambió: recarga el detalle por HTTP. */
  onMesaCambiada: () => void;
  /** El máster cerró la mesa: ya no hay nada que recargar, hay que salir. */
  onMesaEliminada: () => void;
  /** Alguien tiró los dados: añádelo al registro de la mesa. */
  onTirada: (tirada: TiradaResultado) => void;
}

/**
 * Conexión Socket.IO de la mesa. El navegador envía la cookie httpOnly
 * en el handshake (mismo origen, vía proxy), así que el servidor sabe
 * quiénes somos sin que aquí haya que tocar ningún token.
 */
@Service()
export class PartidaSocket {
  private socket: Socket | null = null;

  private readonly enLinea = signal(false);
  /**
   * ¿Está viva la conexión ahora mismo? La mesa lo pinta ("En vivo") en vez
   * de tener un botón Actualizar permanente: el botón solo tiene sentido
   * cuando esto es false, y entonces sí hace falta de verdad.
   */
  readonly conectado = this.enLinea.asReadonly();

  conectar(partidaId: string, escuchas: EscuchasDeMesa): void {
    this.desconectar();
    this.socket = io({ path: '/socket.io' });
    // Al (re)conectar, entra a la sala: cubre también cortes de red
    this.socket.on('connect', () => {
      this.enLinea.set(true);
      this.socket?.emit(EVENTO_ENTRAR_SALA, { partidaId });
    });
    this.socket.on('disconnect', () => this.enLinea.set(false));
    this.socket.on(EVENTO_ESTADO_PERSONAJE, escuchas.onEstadoPersonaje);
    this.socket.on(EVENTO_MESA_CAMBIADA, escuchas.onMesaCambiada);
    this.socket.on(EVENTO_MESA_ELIMINADA, escuchas.onMesaEliminada);
    this.socket.on(EVENTO_TIRADA_DADOS, escuchas.onTirada);
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.enLinea.set(false);
  }
}
