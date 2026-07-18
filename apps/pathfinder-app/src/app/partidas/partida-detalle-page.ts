import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  EstadoPersonajeEvento,
  PartidaDetalle,
  PersonajeEnPartidaResumen,
  TABLERO_ALTO,
  TABLERO_ANCHO,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { PartidaSocket } from './partida-socket';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-partida-detalle-page',
  imports: [],
  templateUrl: './partida-detalle-page.html',
  styleUrl: './partida-detalle-page.scss',
})
export class PartidaDetallePage {
  private readonly api = inject(PartidasApi);
  private readonly partidaId =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly columnas = Array.from(
    { length: TABLERO_ANCHO },
    (_, i) => i,
  );
  protected readonly filas = Array.from({ length: TABLERO_ALTO }, (_, i) => i);

  protected readonly partida = signal<PartidaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Id del personaje seleccionado para mover (dos clics: token → casilla). */
  protected readonly seleccionado = signal<string | null>(null);

  /** Personajes aún sin colocar en el tablero. */
  protected readonly banquillo = computed(() =>
    (this.partida()?.personajes ?? []).filter((pep) => pep.posX === null),
  );

  constructor() {
    this.cargar();
    // Tiempo real: los cambios de otros llegan solos por el socket
    const socket = inject(PartidaSocket);
    socket.conectar(this.partidaId, {
      onEstadoPersonaje: (evento) => this.aplicarEvento(evento),
      onMesaCambiada: () => this.cargar(),
    });
    inject(DestroyRef).onDestroy(() => socket.desconectar());
  }

  /** Recarga completa (también botón Actualizar, como respaldo manual). */
  protected cargar(): void {
    this.error.set(null);
    this.api.detalle(this.partidaId).subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) =>
        this.error.set(`No se pudo cargar la partida: ${mensajeDeError(err)}`),
    });
  }

  protected personajeEn(
    x: number,
    y: number,
  ): PersonajeEnPartidaResumen | undefined {
    return this.partida()?.personajes.find(
      (pep) => pep.posX === x && pep.posY === y,
    );
  }

  protected puedeMover(pep: PersonajeEnPartidaResumen): boolean {
    return (this.partida()?.esMaster ?? false) || pep.esMio;
  }

  protected clickCelda(x: number, y: number): void {
    const ocupante = this.personajeEn(x, y);
    if (ocupante) {
      // Clic sobre un token: selecciona (o deselecciona) si puedes moverlo
      if (this.puedeMover(ocupante)) {
        this.seleccionado.set(
          this.seleccionado() === ocupante.id ? null : ocupante.id,
        );
      }
      return;
    }
    const pepId = this.seleccionado();
    if (pepId) {
      this.mover(pepId, x, y);
    }
  }

  protected seleccionarDelBanquillo(pep: PersonajeEnPartidaResumen): void {
    if (this.puedeMover(pep)) {
      this.seleccionado.set(this.seleccionado() === pep.id ? null : pep.id);
    }
  }

  protected guardarPg(pep: PersonajeEnPartidaResumen, valor: string): void {
    const pgActuales = Number(valor);
    if (!Number.isInteger(pgActuales)) {
      return;
    }
    this.aplicarCambio(pep.id, { pgActuales });
  }

  protected guardarCondiciones(
    pep: PersonajeEnPartidaResumen,
    condiciones: string,
  ): void {
    this.aplicarCambio(pep.id, { condiciones: condiciones.trim() });
  }

  protected sacar(pep: PersonajeEnPartidaResumen): void {
    this.api.sacar(this.partidaId, pep.id).subscribe({
      next: () => this.cargar(),
      error: (err) =>
        this.error.set(`No se pudo sacar: ${mensajeDeError(err)}`),
    });
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .map((palabra) => palabra[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private mover(pepId: string, posX: number, posY: number): void {
    this.aplicarCambio(pepId, { posX, posY });
    this.seleccionado.set(null);
  }

  private aplicarCambio(
    pepId: string,
    cambios: Parameters<PartidasApi['actualizarPersonaje']>[2],
  ): void {
    this.error.set(null);
    this.api.actualizarPersonaje(this.partidaId, pepId, cambios).subscribe({
      next: (actualizado) => this.reemplazar(actualizado),
      error: (err) =>
        this.error.set(`No se pudo actualizar: ${mensajeDeError(err)}`),
    });
  }

  /** Evento del socket: fusiona los cambios parciales en nuestra copia. */
  private aplicarEvento(evento: EstadoPersonajeEvento): void {
    this.partida.update((partida) =>
      partida
        ? {
            ...partida,
            personajes: partida.personajes.map((pep) =>
              pep.id === evento.pepId ? { ...pep, ...evento.cambios } : pep,
            ),
          }
        : partida,
    );
  }

  /** Sustituye el personaje en la señal por la versión del servidor. */
  private reemplazar(actualizado: PersonajeEnPartidaResumen): void {
    this.partida.update((partida) =>
      partida
        ? {
            ...partida,
            personajes: partida.personajes.map((pep) =>
              pep.id === actualizado.id ? actualizado : pep,
            ),
          }
        : partida,
    );
  }
}
