import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  ACTITUD_LABELS,
  ACTITUDES,
  ActitudPnj,
  Character,
  CrearPnj,
  SembrarPnj,
} from '@pathfinder/shared';
import { PnjForm } from './pnj-form';

/**
 * La modal de sembrar PNJ, con sus dos caminos: reutilizar un monstruo del
 * bestiario o crear uno nuevo.
 *
 * TODO su estado es suyo —qué pestaña se ve y las opciones de la siembra
 * (cantidad, actitud, oculto)—; la mesa no lo necesita para nada. Lo único
 * que sube es la orden de sembrar, porque la respuesta del servidor es la
 * partida entera y de esa manda la página.
 */
@Component({
  selector: 'app-pnj-modal',
  imports: [PnjForm],
  templateUrl: './pnj-modal.html',
  styleUrl: './pnj-modal.scss',
})
export class PnjModal {
  /** Las plantillas del máster. Llega vacío mientras se están pidiendo. */
  readonly bestiario = input.required<Character[]>();
  readonly guardando = input(false);
  readonly error = input<string | null>(null);

  readonly sembrar = output<SembrarPnj>();
  readonly crear = output<CrearPnj>();
  readonly cerrar = output<void>();

  /**
   * Se abre en el BESTIARIO si ya hay monstruos guardados (el caso frecuente
   * en cuanto llevas un par de sesiones) y en el formulario si aún no hay
   * ninguno. Es linkedSignal y no un signal a secas porque el bestiario llega
   * DESPUÉS de abrirse la modal: la pestaña tiene que recolocarse cuando
   * aterriza la lista, pero sin pisar el clic del usuario a partir de ahí.
   */
  protected readonly modo = linkedSignal<Character[], 'bestiario' | 'nuevo'>({
    source: this.bestiario,
    computation: (plantillas) => (plantillas.length > 0 ? 'bestiario' : 'nuevo'),
  });

  protected readonly actitudes = ACTITUDES;
  protected readonly actitudLabels = ACTITUD_LABELS;

  /** Opciones de la siembra desde plantilla (las estadísticas ya están). */
  protected readonly cantidad = signal(1);
  protected readonly actitud = signal<ActitudPnj>('enemigo');
  protected readonly oculto = signal(false);

  protected readonly hayPlantillas = computed(() => this.bestiario().length > 0);

  /** Cierra solo si el clic fue en el fondo, no dentro del diálogo. */
  protected onOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected sembrarPlantilla(plantillaId: string): void {
    this.sembrar.emit({
      plantillaId,
      cantidad: this.cantidad(),
      actitud: this.actitud(),
      oculto: this.oculto(),
    });
  }
}
