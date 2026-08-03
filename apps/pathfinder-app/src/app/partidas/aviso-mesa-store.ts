import { Service, signal } from '@angular/core';

/**
 * El motivo por el que se ha devuelto a alguien de una mesa al escritorio:
 * le sacaron el personaje, el máster cerró la mesa, o la cerró él mismo.
 * Sin esto la vuelta al home sería muda y el jugador no sabría qué ha
 * pasado — que es justo el defecto que veníamos a arreglar.
 *
 * Va en un store y no en el state del Router porque el aviso no pertenece a
 * la URL: no debe sobrevivir a una recarga ni reaparecer al volver atrás.
 * Se publica, se navega, y la home lo CONSUME una sola vez.
 */
@Service()
export class AvisoMesaStore {
  private readonly mensajeSignal = signal<string | null>(null);

  publicar(mensaje: string): void {
    this.mensajeSignal.set(mensaje);
  }

  /** Devuelve el aviso pendiente (si lo hay) y lo borra. */
  consumir(): string | null {
    const mensaje = this.mensajeSignal();
    this.mensajeSignal.set(null);
    return mensaje;
  }
}
