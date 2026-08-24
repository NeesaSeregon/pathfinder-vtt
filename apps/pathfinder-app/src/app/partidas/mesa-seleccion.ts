import { Component, input, model, output } from '@angular/core';
import {
  ACTITUD_LABELS,
  ESTADO_VITAL_LABELS,
  PersonajeEnPartidaResumen,
} from '@pathfinder/shared';
import {
  colorToken,
  condicionesDisponibles,
  descripcionCondicion,
  fraccionPg,
  iniciales,
  nombreCondicion,
} from './mesa-visual';

/**
 * ZONA 3 · El panel del asiento elegido: PG, condiciones e iniciativa.
 *
 * Solo existe CUANDO hay selección —si no, el registro se lleva la columna
 * entera— y por eso recibe el asiento como input obligatorio en vez de
 * apañárselas con un null.
 *
 * No toca la API: cada cambio sube como output y lo aplica la mesa, que es
 * la que tiene la partida y el socket. Aquí solo se decide QUÉ se pide.
 */
@Component({
  selector: 'app-mesa-seleccion',
  templateUrl: './mesa-seleccion.html',
  styleUrl: './mesa-seleccion.scss',
})
export class MesaSeleccion {
  readonly pep = input.required<PersonajeEnPartidaResumen>();
  /**
   * ¿Se puede TOCAR, o solo mirar? Seleccionar es consultar: cualquiera
   * abre el panel de cualquiera, pero editar es del dueño y del máster.
   */
  readonly puedeEditar = input(false);
  /** Revelar un PNJ es cosa del máster: es SU emboscada. */
  readonly esMaster = input(false);

  /**
   * La cantidad del golpe o la cura. Es model y no signal propio porque la
   * tarjeta de tu personaje tiene la misma caja: se canta "ocho de daño"
   * una vez y sirve para las dos.
   */
  readonly cantidadPg = model(1);

  readonly cerrar = output<void>();
  /** PG absolutos, tal como se han tecleado en la caja. */
  readonly fijarPg = output<string>();
  /** Golpe (-1) o cura (+1) por la cantidad de arriba. */
  readonly ajustarPg = output<1 | -1>();
  readonly anadirCondicion = output<string>();
  readonly quitarCondicion = output<string>();
  readonly fijarIniciativa = output<string>();
  readonly tirarIniciativa = output<void>();
  readonly verFicha = output<void>();
  readonly alternarOculto = output<void>();
  readonly sacar = output<void>();

  protected readonly actitudLabels = ACTITUD_LABELS;
  protected readonly estadoVitalLabels = ESTADO_VITAL_LABELS;

  protected readonly iniciales = iniciales;
  protected readonly colorToken = colorToken;
  protected readonly fraccionPg = fraccionPg;
  protected readonly nombreCondicion = nombreCondicion;
  protected readonly descripcionCondicion = descripcionCondicion;
  protected readonly condicionesDisponibles = condicionesDisponibles;
}
