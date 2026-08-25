import {
  Component,
  computed,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TERRENO_LABELS,
  TERRENOS,
  Terreno,
  ZONA_NOMBRE_MAX,
  ZonaTablero,
} from '@pathfinder/shared';
import { claseTerreno } from './mesa-zonas';

/**
 * Las zonas del tablero, en lista.
 *
 * Se DIBUJAN en el tablero (arrastrando) y se GESTIONAN aquí. Están
 * separadas a propósito: dibujar es un gesto de ratón y ponerle nombre es
 * escribir, y meter un formulario flotando sobre el tablero rompería la
 * regla de que nada opaco tapa casillas. De paso, esta lista es la única
 * vía con teclado a algo que si no sería solo de ratón.
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
  readonly guardando = input(false);
  readonly error = input<string | null>(null);

  readonly guardar = output<ZonaTablero[]>();
  readonly cerrar = output<void>();

  protected readonly terrenos = TERRENOS;
  protected readonly etiquetas = TERRENO_LABELS;
  protected readonly nombreMax = ZONA_NOMBRE_MAX;
  protected readonly claseTerreno = claseTerreno;

  /** Copia de trabajo: lo de fuera no se toca hasta que se guarda. */
  protected readonly borrador = signal<ZonaTablero[]>([]);

  /** ¿Hay algo distinto de lo que había al abrir? */
  protected readonly hayCambios = computed(
    () => JSON.stringify(this.borrador()) !== JSON.stringify(this.zonas()),
  );

  // Se copia UNA vez, al montar. La modal se crea al abrirse, así que esto
  // corre una vez por apertura; y al no seguir a la entrada, una recarga por
  // socket a mitad de la edición no le borra al máster lo que va escrito.
  ngOnInit(): void {
    this.borrador.set(this.zonas().map((zona) => ({ ...zona })));
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

  private editar(id: string, cambio: Partial<ZonaTablero>): void {
    this.borrador.update((lista) =>
      lista.map((zona) => (zona.id === id ? { ...zona, ...cambio } : zona)),
    );
  }
}
