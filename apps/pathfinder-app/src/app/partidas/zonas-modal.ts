import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  OnInit,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TERRENO_LABELS,
  TERRENOS,
  Terreno,
  ZONA_NOMBRE_MAX,
  ZonaTablero,
} from '@pathfinder/shared';
import { areaEnRejilla, claseTerreno } from './mesa-zonas';

/**
 * Las zonas del tablero, en lista.
 *
 * Se DIBUJAN en el tablero (arrastrando) y se GESTIONAN aquí. Están
 * separadas a propósito: dibujar es un gesto de ratón y ponerle nombre es
 * escribir, y meter un formulario flotando sobre el tablero rompería la
 * regla de que nada opaco tapa casillas. De paso, esta lista es la única
 * vía con teclado a algo que si no sería solo de ratón.
 *
 * Separadas pero ENCADENADAS: al dibujar, la página abre esta lista con
 * `recienCreada` puesto, y la fila nueva llega marcada y con el foco en su
 * nombre. Sin eso, dibujar cuatro salas seguidas dejaba cuatro filas
 * idénticas y vacías.
 *
 * Cada fila lleva además un MAPA en miniatura del tablero con su zona
 * marcada. Antes había una simple muestra de color, que dice el terreno
 * pero no CUÁL de las tres salas es — y el tablero no tiene coordenadas a
 * la vista, así que unos números tampoco lo dirían.
 *
 * Edita la lista ENTERA en local y la manda de una: el servidor guarda lo
 * que se ve aquí, sin operaciones parciales que puedan quedar a medias.
 */
@Component({
  selector: 'app-zonas-modal',
  imports: [FormsModule],
  templateUrl: './zonas-modal.html',
  styleUrl: './zonas-modal.scss',
})
export class ZonasModal implements OnInit {
  readonly zonas = input.required<ZonaTablero[]>();
  /** Id de la zona recién dibujada, si venimos del tablero. */
  readonly recienCreada = input<string | null>(null);
  readonly guardando = input(false);
  readonly error = input<string | null>(null);

  readonly guardar = output<ZonaTablero[]>();
  readonly cerrar = output<void>();

  protected readonly terrenos = TERRENOS;
  protected readonly etiquetas = TERRENO_LABELS;
  protected readonly nombreMax = ZONA_NOMBRE_MAX;
  protected readonly claseTerreno = claseTerreno;
  protected readonly areaEnRejilla = areaEnRejilla;

  /** Los campos de nombre, en el orden de la lista, para poder enfocar uno. */
  private readonly camposNombre =
    viewChildren<ElementRef<HTMLInputElement>>('campoNombre');

  /** Copia de trabajo: lo de fuera no se toca hasta que se guarda. */
  protected readonly borrador = signal<ZonaTablero[]>([]);

  /** ¿Hay algo distinto de lo que había al abrir? */
  protected readonly hayCambios = computed(
    () => JSON.stringify(this.borrador()) !== JSON.stringify(this.zonas()),
  );

  constructor() {
    // Al montar y una sola vez: la modal se crea al abrirse, así que esto
    // corre una vez por apertura. Enfocar la fila nueva es lo que convierte
    // "dibuja y luego búscala en la lista" en "dibuja y escribe".
    afterNextRender(() => this.enfocarLaNueva());
  }

  // Se copia UNA vez, al montar. La modal se crea al abrirse, así que esto
  // corre una vez por apertura; y al no seguir a la entrada, una recarga por
  // socket a mitad de la edición no le borra al máster lo que va escrito.
  ngOnInit(): void {
    this.borrador.set(this.zonas().map((zona) => ({ ...zona })));
  }

  /**
   * Pone el cursor en el nombre de la zona recién dibujada. Se busca por
   * ÍNDICE en el borrador porque los campos vienen en ese mismo orden; si
   * no hay zona nueva (la lista se abrió desde el menú del máster) no se
   * toca el foco, que ya lo tiene el diálogo.
   */
  private enfocarLaNueva(): void {
    const id = this.recienCreada();
    if (!id) {
      return;
    }
    const indice = this.borrador().findIndex((zona) => zona.id === id);
    this.camposNombre()[indice]?.nativeElement.focus();
  }

  protected cambiarNombre(id: string, nombre: string): void {
    this.editar(id, { nombre: nombre.slice(0, ZONA_NOMBRE_MAX) });
  }

  protected cambiarTerreno(id: string, terreno: string): void {
    this.editar(id, { terreno: terreno as Terreno });
  }

  protected alternarVisible(id: string, visible: boolean): void {
    this.editar(id, { visible });
  }

  protected borrar(id: string): void {
    this.borrador.update((lista) => lista.filter((zona) => zona.id !== id));
  }

  /** Solo cierra si el clic fue en el velo, no dentro del diálogo. */
  protected alPulsarElVelo(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.cerrar.emit();
    }
  }

  protected aceptar(): void {
    this.guardar.emit(
      this.borrador().map((zona) => ({
        ...zona,
        nombre: zona.nombre.trim(),
      })),
    );
  }

  protected esNueva(zona: ZonaTablero): boolean {
    return zona.id === this.recienCreada();
  }

  private editar(id: string, cambio: Partial<ZonaTablero>): void {
    this.borrador.update((lista) =>
      lista.map((zona) => (zona.id === id ? { ...zona, ...cambio } : zona)),
    );
  }
}
