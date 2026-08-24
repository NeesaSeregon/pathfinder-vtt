import { Component, input, output } from '@angular/core';
import { TiradaResultado } from '@pathfinder/shared';

/**
 * ZONA 4 · El registro de tiradas y su lanzador, abajo a la derecha.
 *
 * Es lo único de la columna derecha que está SIEMPRE: sin selección se
 * lleva la columna entera, y por eso el rótulo explica el hueco en vez de
 * dejar una caja vacía encima.
 *
 * Solo pinta y pide: la tirada la resuelve el servidor y el resultado
 * vuelve por el socket, así que las tiradas bajan como input.
 */
@Component({
  selector: 'app-mesa-registro',
  templateUrl: './mesa-registro.html',
  styleUrl: './mesa-registro.scss',
})
export class MesaRegistro {
  /** Lo más nuevo primero. Efímero: no se guarda entre sesiones. */
  readonly tiradas = input.required<TiradaResultado[]>();
  /** Solo el máster y quien tiene personaje en la mesa pueden tirar. */
  readonly puedeTirar = input(false);
  /** Para explicar en el rótulo por qué el registro ocupa toda la columna. */
  readonly haySeleccion = input(false);

  /** La notación tal cual la escribió el usuario; la valida el servidor. */
  readonly tirar = output<string>();

  /** Dados de acceso rápido (un clic = una tirada de ese dado). */
  protected readonly dadosRapidos = [4, 6, 8, 10, 12, 20, 100];

  /** Ignora la tirada vacía: pulsar Tirar con la caja en blanco no es nada. */
  protected pedir(notacion: string): void {
    if (notacion.trim()) {
      this.tirar.emit(notacion);
    }
  }
}
