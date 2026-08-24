import {
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  distanciaEnCasillas,
  PersonajeEnPartidaResumen,
  PIES_POR_CASILLA,
  TABLERO_ALTO,
  TABLERO_ANCHO,
} from '@pathfinder/shared';
import { colorToken, esCaido, iniciales, ladoToken } from './mesa-visual';

/**
 * Píxeles que hay que recorrer con el botón pulsado para que el gesto deje
 * de ser un clic (colocar) y pase a ser un desplazamiento del tablero. Un
 * clic normal mueve el ratón uno o dos píxeles sin querer.
 */
const UMBRAL_AGARRE = 5;

/** Un token cambia de casilla: quién y adónde. */
export interface Movimiento {
  pepId: string;
  x: number;
  y: number;
}

/**
 * ZONA 2 · El tablero: rejilla, tokens, banquillo, herramientas y regla.
 *
 * El tablero (24×30) es MÁS ALTO que el hueco disponible: el marco lo
 * recorta y se agarra con el ratón para recorrerlo. El ancho sí cabe
 * entero — se pierden filas, nunca columnas, para no perder de vista un
 * flanco.
 *
 * Todo lo que vive aquí dentro es GESTO: qué herramienta está en la mano,
 * qué se está midiendo, qué se arrastra y por dónde va el marco. Nada de
 * eso le importa al resto de la mesa, y por eso no sale. Lo único que sube
 * es que alguien quiere mirar a otro (seleccionar) o ponerlo en otra
 * casilla (mover).
 */
@Component({
  selector: 'app-mesa-tablero',
  host: { role: 'region', 'aria-label': 'Tablero' },
  templateUrl: './mesa-tablero.html',
  styleUrl: './mesa-tablero.scss',
})
export class MesaTablero {
  readonly personajes = input.required<PersonajeEnPartidaResumen[]>();
  /** El máster mueve a cualquiera; los demás, solo lo suyo. */
  readonly esMaster = input(false);
  readonly seleccionadoId = input<string | null>(null);
  readonly turnoPepId = input<string | null>(null);
  /** La url() del mapa de fondo, o null si la mesa no tiene mapa. */
  readonly fondo = input<string | null>(null);

  readonly seleccionar = output<PersonajeEnPartidaResumen>();
  readonly mover = output<Movimiento>();

  protected readonly columnas = Array.from(
    { length: TABLERO_ANCHO },
    (_, i) => i,
  );
  protected readonly filas = Array.from({ length: TABLERO_ALTO }, (_, i) => i);

  protected readonly iniciales = iniciales;
  protected readonly colorToken = colorToken;
  protected readonly ladoToken = ladoToken;
  protected readonly esCaido = esCaido;

  /** El marco que recorta el tablero; se desplaza al agarrar el fondo. */
  private readonly marcoTablero =
    viewChild<ElementRef<HTMLElement>>('marcoTablero');
  /** ¿Se está recorriendo el tablero ahora mismo? (solo para el cursor). */
  protected readonly agarrando = signal(false);
  /** Id del personaje que se está arrastrando (alternativa a los dos clics). */
  protected readonly arrastrando = signal<string | null>(null);

  /**
   * Herramienta activa. Es el contenedor que faltaba: sin un modo activo,
   * medir, plantillas o niebla no tienen dónde vivir.
   */
  protected readonly herramienta = signal<'seleccionar' | 'medir'>(
    'seleccionar',
  );

  /** Medición en curso o recién terminada (se borra al cambiar de tarea). */
  protected readonly medicion = signal<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  /** Casillas y pies de la medición, con la regla 5-10-5 de PF1e. */
  protected readonly distancia = computed(() => {
    const m = this.medicion();
    if (!m) {
      return null;
    }
    const casillas = distanciaEnCasillas(m.x1, m.y1, m.x2, m.y2);
    return { casillas, pies: casillas * PIES_POR_CASILLA };
  });

  /** Personajes aún sin colocar en el tablero. */
  protected readonly banquillo = computed(() =>
    this.personajes().filter((pep) => pep.posX === null),
  );

  /**
   * ¿Hay una ficha esperando destino? Seleccionar es CONSULTAR, así que las
   * casillas solo se marcan como destino cuando además puedes mover lo
   * seleccionado: si no, mirar a un enemigo iluminaría medio tablero.
   */
  protected readonly hayDestino = computed(() => {
    const id = this.arrastrando() ?? this.seleccionadoId();
    const pep = this.personajes().find((p) => p.id === id);
    return !!pep && this.puedeMover(pep);
  });

  protected puedeMover(pep: PersonajeEnPartidaResumen): boolean {
    return this.esMaster() || pep.esMio;
  }

  protected esTurno(pep: PersonajeEnPartidaResumen): boolean {
    return this.turnoPepId() === pep.id;
  }

  /**
   * Quién OCUPA la casilla, contando la huella completa: un Grande en (3,3)
   * ocupa también (4,3), (3,4) y (4,4).
   */
  protected ocupanteDe(
    x: number,
    y: number,
  ): PersonajeEnPartidaResumen | undefined {
    return this.personajes().find(
      (pep) =>
        pep.posX !== null &&
        pep.posY !== null &&
        x >= pep.posX &&
        x < pep.posX + pep.casillas &&
        y >= pep.posY &&
        y < pep.posY + pep.casillas,
    );
  }

  /** Solo en su casilla ORIGEN se pinta el token (que luego cubre su huella). */
  protected tokenEn(
    x: number,
    y: number,
  ): PersonajeEnPartidaResumen | undefined {
    return this.personajes().find((pep) => pep.posX === x && pep.posY === y);
  }

  protected clickCelda(x: number, y: number): void {
    // Con la regla en la mano no se mueve a nadie sin querer
    if (this.herramienta() === 'medir') {
      return;
    }
    const ocupante = this.ocupanteDe(x, y);
    if (ocupante) {
      // Seleccionar es CONSULTAR: cualquiera puede mirar a cualquiera y
      // verlo en el panel de la derecha. Mover ya es otra cosa, y para eso
      // sigue mandando puedeMover() más abajo.
      this.seleccionar.emit(ocupante);
      return;
    }
    const pepId = this.seleccionadoId();
    const pep = this.personajes().find((p) => p.id === pepId);
    if (pepId && pep && this.puedeMover(pep)) {
      this.mover.emit({ pepId, x, y });
    }
  }

  /** Cambia de herramienta; al salir de medir se borra lo medido. */
  protected usarHerramienta(cual: 'seleccionar' | 'medir'): void {
    this.herramienta.set(cual);
    this.medicion.set(null);
  }

  protected iniciarArrastre(
    evento: DragEvent,
    pep: PersonajeEnPartidaResumen,
  ): void {
    if (!this.puedeMover(pep)) {
      evento.preventDefault();
      return;
    }
    this.arrastrando.set(pep.id);
    // Opcional en algunos navegadores, pero hace el arrastre más fiable
    evento.dataTransfer?.setData('text/plain', pep.id);
    if (evento.dataTransfer) {
      evento.dataTransfer.effectAllowed = 'move';
    }
  }

  protected terminarArrastre(): void {
    this.arrastrando.set(null);
  }

  /** Sin preventDefault en dragover el navegador no admite el soltar. */
  protected permitirSoltar(evento: DragEvent): void {
    evento.preventDefault();
  }

  protected soltarEn(evento: DragEvent, x: number, y: number): void {
    evento.preventDefault();
    const pepId = this.arrastrando();
    this.arrastrando.set(null);
    if (pepId) {
      this.mover.emit({ pepId, x, y });
    }
  }

  /** La casilla que hay bajo el puntero, leída del DOM (data-x / data-y). */
  private casillaEn(evento: PointerEvent): { x: number; y: number } | null {
    const bajo = document
      .elementFromPoint(evento.clientX, evento.clientY)
      ?.closest('.tablero__celda') as HTMLElement | null;
    const x = bajo?.dataset['x'];
    const y = bajo?.dataset['y'];
    if (x === undefined || y === undefined) {
      return null;
    }
    return { x: +x, y: +y };
  }

  /**
   * Medir es arrastrar de casilla a casilla. Lo medido SE QUEDA en pantalla
   * al soltar: en mesa se pregunta "¿llego?" y se mira la respuesta con
   * calma, no de un vistazo mientras se sujeta el botón.
   */
  protected empezarMedicion(evento: PointerEvent): void {
    const desde = this.casillaEn(evento);
    if (!desde) {
      return;
    }
    evento.preventDefault();
    this.medicion.set({ x1: desde.x, y1: desde.y, x2: desde.x, y2: desde.y });

    const mover = (e: PointerEvent) => {
      const hasta = this.casillaEn(e);
      const actual = this.medicion();
      if (hasta && actual) {
        this.medicion.set({ ...actual, x2: hasta.x, y2: hasta.y });
      }
    };
    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }

  /**
   * Recorrer el tablero agarrando el fondo. El tablero es más alto que el
   * hueco disponible, así que hay que poder moverse por él.
   *
   * Lo delicado es que el mismo gesto ya significa otra cosa: pulsar una
   * casilla COLOCA al personaje seleccionado. Se distinguen por la
   * distancia — hasta UMBRAL_AGARRE píxeles sigue siendo un clic; a partir
   * de ahí es un desplazamiento y el clic de después se descarta. Sobre un
   * token no se agarra nada: ahí manda el arrastre nativo, que lo mueve.
   */
  protected empezarAgarre(evento: PointerEvent): void {
    if (evento.button !== 0) return;
    // Con la regla activa, el gesto es medir, no recorrer el tablero
    if (this.herramienta() === 'medir') {
      this.empezarMedicion(evento);
      return;
    }
    const destino = evento.target as HTMLElement | null;
    if (destino?.closest('.tablero__token')) return;

    const marco = this.marcoTablero()?.nativeElement;
    if (!marco) return;

    const inicioX = evento.clientX;
    const inicioY = evento.clientY;
    const arribaAlEmpezar = marco.scrollTop;
    const izquierdaAlEmpezar = marco.scrollLeft;
    let recorrido = false;

    const tragarClic = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const mover = (e: PointerEvent) => {
      const dx = e.clientX - inicioX;
      const dy = e.clientY - inicioY;
      if (!recorrido && Math.hypot(dx, dy) < UMBRAL_AGARRE) return;
      recorrido = true;
      this.agarrando.set(true);
      // Al revés que el puntero: arrastrar hacia arriba enseña lo de abajo,
      // como cuando empujas un mapa de papel.
      marco.scrollTop = arribaAlEmpezar - dy;
      marco.scrollLeft = izquierdaAlEmpezar - dx;
    };

    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      document.removeEventListener('pointercancel', soltar);
      this.agarrando.set(false);
      if (!recorrido) return;
      // El navegador dispara un click al soltar: si acabamos de recorrer el
      // tablero, ese click NO debe colocar a nadie. Se intercepta en fase de
      // captura, antes de llegar a la casilla.
      marco.addEventListener('click', tragarClic, { capture: true });
      // Y se retira enseguida: el click llega en el mismo ciclo, así que si
      // no ha llegado (soltaste fuera del marco) no queda nada acechando al
      // siguiente clic legítimo.
      setTimeout(() => marco.removeEventListener('click', tragarClic, true));
    };

    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', soltar);
  }
}
