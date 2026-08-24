import { Component, computed, input, model, output } from '@angular/core';
import {
  ESTADO_VITAL_LABELS,
  ordenarIniciativa,
  PersonajeEnPartidaResumen,
} from '@pathfinder/shared';
import {
  colorToken,
  descripcionCondicion,
  esCaido,
  fraccionPg,
  iniciales,
  nombreCondicion,
} from './mesa-visual';

/** Golpe o cura pedido desde la tarjeta de tu personaje. */
export interface AjustePg {
  pep: PersonajeEnPartidaResumen;
  signo: 1 | -1;
}

/** PG absolutos tecleados en la tarjeta de tu personaje. */
export interface FijarPg {
  pep: PersonajeEnPartidaResumen;
  valor: string;
}

/**
 * ZONA 1 · Quién está en la mesa: tu personaje, el rastreador de combate y
 * LA lista.
 *
 * Una sola lista, no dos. Antes eran las fichas por un lado y el orden de
 * iniciativa por otro: la misma gente repetida y la mirada cruzando la
 * pantalla para casarlas.
 */
@Component({
  selector: 'app-mesa-personas',
  // El rótulo va en el host: la zona ES el componente, sin un <section>
  // extra por dentro que solo serviría para colgarle el aria-label.
  host: { role: 'region', 'aria-label': 'Personas en la mesa' },
  templateUrl: './mesa-personas.html',
  styleUrl: './mesa-personas.scss',
})
export class MesaPersonas {
  readonly personajes = input.required<PersonajeEnPartidaResumen[]>();
  readonly enCombate = input(false);
  readonly ronda = input(0);
  readonly turnoPepId = input<string | null>(null);
  readonly esMaster = input(false);
  readonly seleccionadoId = input<string | null>(null);

  /** La misma caja de daño/cura que el panel de selección: se canta una vez. */
  readonly cantidadPg = model(1);

  readonly seleccionar = output<PersonajeEnPartidaResumen>();
  readonly fijarPg = output<FijarPg>();
  readonly ajustarPg = output<AjustePg>();
  readonly verFicha = output<PersonajeEnPartidaResumen>();
  readonly iniciarCombate = output<void>();
  readonly siguienteTurno = output<void>();
  readonly terminarCombate = output<void>();

  protected readonly estadoVitalLabels = ESTADO_VITAL_LABELS;
  protected readonly iniciales = iniciales;
  protected readonly colorToken = colorToken;
  protected readonly fraccionPg = fraccionPg;
  protected readonly esCaido = esCaido;
  protected readonly nombreCondicion = nombreCondicion;
  protected readonly descripcionCondicion = descripcionCondicion;

  /**
   * TUS personajes: la tarjeta fija de arriba. Un jugador no debería tener
   * que buscarse en la lista, y puede traer más de uno. Solo PJ: al máster,
   * esMio le sale true en todos SUS PNJ, y una tarjeta por goblin no es lo
   * que nadie quiere.
   */
  protected readonly misPjs = computed(() =>
    this.personajes().filter((pep) => pep.esMio && pep.tipo === 'pj'),
  );

  /** Quién tiene el turno ahora mismo (null fuera de combate). */
  protected readonly turnoDe = computed(
    () => this.personajes().find((pep) => pep.id === this.turnoPepId()) ?? null,
  );

  /**
   * LA lista, en el único orden que hay. En combate manda la iniciativa;
   * fuera, dos grupos estables —Jugadores y luego PNJ, cada uno por orden de
   * llegada—. La regla de oro es que la lista NO se reordene sola bajo el
   * dedo: el único reordenamiento es el de iniciar combate, que es explícito
   * y se espera. Los ocultos NO se agrupan aparte.
   */
  protected readonly grupos = computed<
    { titulo: string | null; gente: PersonajeEnPartidaResumen[] }[]
  >(() => {
    const gente = this.personajes();
    if (this.enCombate()) {
      const conIniciativa = ordenarIniciativa(
        gente.filter((p) => p.iniciativa !== null),
      );
      const sinTirar = gente.filter((p) => p.iniciativa === null);
      return [
        { titulo: null, gente: conIniciativa },
        { titulo: 'Sin iniciativa', gente: sinTirar },
      ].filter((g) => g.gente.length > 0);
    }
    return [
      { titulo: 'Jugadores', gente: gente.filter((p) => p.tipo === 'pj') },
      { titulo: 'PNJ', gente: gente.filter((p) => p.tipo === 'pnj') },
    ].filter((g) => g.gente.length > 0);
  });

  protected esTurno(pep: PersonajeEnPartidaResumen): boolean {
    return this.turnoPepId() === pep.id;
  }
}
