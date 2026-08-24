import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PartidaDetalle } from '@pathfinder/shared';

/**
 * ZONA 5 · La barra de la mesa. SUSTITUYE a la navbar general dentro de una
 * partida (ver App.enLaMesa): salir es "← Mesas" y lo demás sobra.
 *
 * Aquí se decide qué está a mano y qué está guardado: la única acción de uso
 * continuo del máster —Añadir PNJ— se queda fuera, y todo lo demás (mapa,
 * código, cerrar la mesa) vive dentro del menú, con lo irreversible al final
 * y marcado. Antes era una fila plana donde "Cerrar mesa" pesaba lo mismo
 * que subir un mapa.
 */
@Component({
  selector: 'app-mesa-barra',
  imports: [RouterLink],
  templateUrl: './mesa-barra.html',
  styleUrl: './mesa-barra.scss',
})
export class MesaBarra {
  readonly partida = input.required<PartidaDetalle>();
  /** El socket, dicho en voz alta: si está caído hay que poder recargar. */
  readonly conectado = input(false);
  /** Cerrando la mesa: desactiva la opción para no pedirlo dos veces. */
  readonly eliminando = input(false);

  readonly recargar = output<void>();
  readonly anadirPnj = output<void>();
  readonly subirMapa = output<File>();
  readonly quitarMapa = output<void>();
  readonly regenerarCodigo = output<void>();
  readonly cerrarMesa = output<void>();

  /** Menú de acciones del máster (mapa, código, cerrar la mesa). */
  protected readonly menuAbierto = signal(false);

  /**
   * Manda el fichero y deja el input en blanco: sin eso, volver a elegir el
   * MISMO mapa no dispararía otro change y parecería que no pasa nada.
   */
  protected elegirMapa(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    input.value = '';
    this.menuAbierto.set(false);
    if (fichero) {
      this.subirMapa.emit(fichero);
    }
  }

  /** Cierra el menú y hace lo pedido: ninguna opción se queda abierta. */
  protected desdeElMenu(accion: 'quitarMapa' | 'regenerarCodigo' | 'cerrarMesa'): void {
    this.menuAbierto.set(false);
    this[accion].emit();
  }
}
