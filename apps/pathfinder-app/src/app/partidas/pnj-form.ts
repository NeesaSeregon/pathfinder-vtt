import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ACTITUD_LABELS,
  ACTITUDES,
  ActitudPnj,
  casillasQueOcupa,
  claseDeArmadura,
  CrearPnj,
  iniciativa,
  PNJ_MAX_CANTIDAD,
  Tamano,
  TAMANO_LABELS,
  TAMANOS,
} from '@pathfinder/shared';

/**
 * Bloque de estadísticas corto para sembrar PNJ. Pide COMPONENTES
 * (Destreza, armadura, escudo, tamaño) tal como los da el Bestiario, no
 * totales: así la CA, la iniciativa y la huella salen de las mismas
 * funciones puras que para un PJ. La vista previa muestra en vivo lo que
 * va a salir, que es lo que evita tener que echar la cuenta a mano.
 */
@Component({
  selector: 'app-pnj-form',
  imports: [FormsModule],
  templateUrl: './pnj-form.html',
  styleUrl: './pnj-form.scss',
})
export class PnjForm {
  readonly guardando = input(false);
  readonly error = input<string | null>(null);
  readonly crear = output<CrearPnj>();
  readonly cancelar = output<void>();

  protected readonly actitudes = ACTITUDES;
  protected readonly actitudLabels = ACTITUD_LABELS;
  protected readonly tamanos = TAMANOS;
  protected readonly tamanoLabels = TAMANO_LABELS;
  protected readonly maxCantidad = PNJ_MAX_CANTIDAD;

  protected readonly nombre = signal('');
  protected readonly actitud = signal<ActitudPnj>('enemigo');
  protected readonly oculto = signal(false);
  protected readonly tamano = signal<Tamano>('mediano');

  /**
   * Los numéricos admiten null = casilla VACÍA. Es importante: si al
   * borrar el campo forzáramos un 0, se reescribiría en el input y los
   * dígitos que teclea el usuario caerían alrededor de ese cero (escribir
   * "15" sobre un 0 da 150). Vacío se interpreta como el valor por defecto
   * solo al calcular y al enviar.
   */
  protected readonly cantidad = signal<number | null>(1);
  protected readonly nivel = signal<number | null>(1);
  protected readonly destreza = signal<number | null>(10);
  protected readonly bonifArmadura = signal<number | null>(0);
  protected readonly bonifEscudo = signal<number | null>(0);
  protected readonly armaduraNatural = signal<number | null>(0);
  protected readonly pgTotal = signal<number | null>(0);
  protected readonly modVarioIniciativa = signal<number | null>(0);

  /** Lo que teclea el usuario: '' (borrado) se guarda como null, no como 0. */
  protected aNumero(valor: unknown): number | null {
    if (valor === '' || valor === null || valor === undefined) {
      return null;
    }
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  /** La ficha que se guardará, para poder previsualizar sus derivados. */
  private readonly sheet = computed(() => ({
    tamano: this.tamano(),
    atributos: { destreza: { puntuacion: this.destreza() ?? 10 } },
    combate: {
      bonifArmadura: this.bonifArmadura() ?? 0,
      bonifEscudo: this.bonifEscudo() ?? 0,
      armaduraNatural: this.armaduraNatural() ?? 0,
      modVarioIniciativa: this.modVarioIniciativa() ?? 0,
    },
    pg: { total: this.pgTotal() ?? 0 },
  }));

  // Los MISMOS cálculos que hará el servidor: si aquí pone CA 17, en la
  // mesa saldrá 17. No se envían, se derivan en ambos lados.
  protected readonly caPrevia = computed(() => claseDeArmadura(this.sheet()));
  protected readonly iniciativaPrevia = computed(() =>
    iniciativa(this.sheet()),
  );
  protected readonly casillasPrevias = computed(() =>
    casillasQueOcupa(this.sheet()),
  );

  protected readonly valido = computed(
    () => this.nombre().trim().length > 0 && (this.cantidad() ?? 0) >= 1,
  );

  protected enviar(): void {
    if (!this.valido()) {
      return;
    }
    this.crear.emit({
      nombre: this.nombre().trim(),
      cantidad: this.cantidad() ?? 1,
      actitud: this.actitud(),
      oculto: this.oculto(),
      nivel: this.nivel() ?? 1,
      tamano: this.tamano(),
      destreza: this.destreza() ?? 10,
      bonifArmadura: this.bonifArmadura() ?? 0,
      bonifEscudo: this.bonifEscudo() ?? 0,
      armaduraNatural: this.armaduraNatural() ?? 0,
      pgTotal: this.pgTotal() ?? 0,
      modVarioIniciativa: this.modVarioIniciativa() ?? 0,
    });
  }
}
