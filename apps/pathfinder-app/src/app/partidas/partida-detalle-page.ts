import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ACTITUD_LABELS,
  ACTITUDES,
  ActitudPnj,
  Character,
  CharacterUpsert,
  CONDICIONES,
  CrearPnj,
  CONDICION_POR_ID,
  distanciaEnCasillas,
  ESTADO_VITAL_LABELS,
  EstadoPersonajeEvento,
  ordenarIniciativa,
  PartidaDetalle,
  PersonajeEnPartidaResumen,
  PIES_POR_CASILLA,
  TABLERO_ALTO,
  TABLERO_ANCHO,
  TiradaResultado,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { PartidaSocket } from './partida-socket';
import { AvisoMesaStore } from './aviso-mesa-store';
import { CharactersApi } from '../characters/characters-api';
import { FichaVista } from '../characters/ficha-vista';
import { CharacterForm } from '../characters/character-form';
import { PnjForm } from './pnj-form';
import { mensajeDeError } from '../characters/mensaje-de-error';

/**
 * Píxeles que hay que recorrer con el botón pulsado para que el gesto deje
 * de ser un clic (colocar) y pase a ser un desplazamiento del tablero. Un
 * clic normal mueve el ratón uno o dos píxeles sin querer.
 */
const UMBRAL_AGARRE = 5;

@Component({
  selector: 'app-partida-detalle-page',
  imports: [RouterLink, FichaVista, CharacterForm, PnjForm],
  templateUrl: './partida-detalle-page.html',
  styleUrl: './partida-detalle-page.scss',
})
export class PartidaDetallePage {
  private readonly api = inject(PartidasApi);
  private readonly charactersApi = inject(CharactersApi);
  private readonly router = inject(Router);
  /** Para decirle al escritorio POR QUÉ se ha vuelto, si toca volver. */
  private readonly aviso = inject(AvisoMesaStore);
  private readonly partidaId =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly columnas = Array.from(
    { length: TABLERO_ANCHO },
    (_, i) => i,
  );
  protected readonly filas = Array.from({ length: TABLERO_ALTO }, (_, i) => i);

  protected readonly partida = signal<PartidaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Cerrando la mesa: desactiva el botón para no pedirlo dos veces. */
  protected readonly eliminando = signal(false);
  /** Id del personaje seleccionado para mover (dos clics: token → casilla). */
  protected readonly seleccionado = signal<string | null>(null);
  /** Id del personaje que se está arrastrando (alternativa a los dos clics). */
  protected readonly arrastrando = signal<string | null>(null);

  /** El marco que recorta el tablero; se desplaza al agarrar el fondo. */
  private readonly marcoTablero =
    viewChild<ElementRef<HTMLElement>>('marcoTablero');
  /** ¿Se está recorriendo el tablero ahora mismo? (solo para el cursor). */
  protected readonly agarrando = signal(false);

  /** Personajes aún sin colocar en el tablero. */
  protected readonly banquillo = computed(() =>
    (this.partida()?.personajes ?? []).filter((pep) => pep.posX === null),
  );

  /** Dados de acceso rápido (un clic = una tirada de ese dado). */
  protected readonly dadosRapidos = [4, 6, 8, 10, 12, 20, 100];
  /** Registro de tiradas recientes (efímero, lo más nuevo primero). */
  protected readonly tiradas = signal<TiradaResultado[]>([]);

  /** Solo el máster o el dueño de un personaje de la mesa pueden tirar. */
  protected readonly esParticipante = computed(() => {
    const p = this.partida();
    return !!p && (p.esMaster || p.personajes.some((pep) => pep.esMio));
  });

  /** Sube al cambiar el mapa: rompe la caché del navegador para la imagen. */
  private readonly versionMapa = signal(0);

  /** URL de fondo del tablero, o null si la mesa no tiene mapa. */
  protected readonly fondoTablero = computed(() => {
    const p = this.partida();
    return p?.tieneMapa
      ? `url(/api/partidas/${this.partidaId}/mapa?v=${this.versionMapa()})`
      : null;
  });

  protected readonly actitudLabels = ACTITUD_LABELS;
  protected readonly estadoVitalLabels = ESTADO_VITAL_LABELS;

  /** Siembra de PNJ (solo el máster): desde el bestiario o creando uno nuevo. */
  protected readonly pnjAbierto = signal(false);
  protected readonly modoPnj = signal<'bestiario' | 'nuevo'>('bestiario');
  protected readonly bestiario = signal<Character[]>([]);
  protected readonly creandoPnj = signal(false);
  protected readonly errorPnj = signal<string | null>(null);

  /** Opciones de la siembra desde plantilla (las estadísticas ya están). */
  protected readonly cantidadPlantilla = signal(1);
  protected readonly actitudPlantilla = signal<ActitudPnj>('enemigo');
  protected readonly ocultoPlantilla = signal(false);
  protected readonly actitudes = ACTITUDES;

  /** Ficha abierta en la modal de consulta (null = cerrada). */
  protected readonly fichaAbierta = signal<Character | null>(null);
  protected readonly cargandoFicha = signal(false);
  /**
   * ¿La ficha abierta es MÍA? Solo entonces se puede editar: el máster ve
   * las fichas de su mesa, pero editarlas sigue siendo cosa del dueño (el
   * servidor lo impone igualmente con un 404).
   */
  protected readonly fichaEsMia = signal(false);
  /** Modo edición dentro de la modal (por defecto se abre en lectura). */
  protected readonly editandoFicha = signal(false);
  protected readonly guardandoFicha = signal(false);
  /** Para preguntar antes de descartar cambios sin guardar (form.sucio()). */
  private readonly formularioFicha = viewChild(CharacterForm);

  /**
   * LA lista de personas de la mesa, en el único orden que hay. Sustituye a
   * tener las fichas por un lado y el orden de iniciativa por otro: era la
   * misma gente dos veces y obligaba a cruzar la pantalla con la mirada.
   *
   * En combate manda la iniciativa; fuera, dos grupos estables —Jugadores y
   * luego PNJ, cada uno por orden de llegada—. La regla de oro es que la
   * lista NO se reordene sola bajo el dedo: el único reordenamiento es el de
   * iniciar combate, que es explícito y se espera.
   */
  protected readonly grupos = computed<
    { titulo: string | null; gente: PersonajeEnPartidaResumen[] }[]
  >(() => {
    const gente = this.partida()?.personajes ?? [];
    if (this.partida()?.enCombate) {
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

  /** El asiento seleccionado, que es lo que pinta el panel de la derecha. */
  protected readonly pepSeleccionado = computed(() => {
    const id = this.seleccionado();
    return id
      ? (this.partida()?.personajes.find((p) => p.id === id) ?? null)
      : null;
  });

  /** Quién tiene el turno ahora mismo (null fuera de combate). */
  protected readonly turnoDe = computed(() => {
    const p = this.partida();
    return p?.personajes.find((pep) => pep.id === p.turnoPepId) ?? null;
  });

  /**
   * ¿Hay una ficha esperando destino? Seleccionar es CONSULTAR, así que las
   * casillas solo se marcan como destino cuando además puedes mover lo
   * seleccionado: si no, mirar a un enemigo iluminaría medio tablero.
   */
  protected readonly hayDestino = computed(() => {
    const id = this.arrastrando() ?? this.seleccionado();
    const pep = this.partida()?.personajes.find((p) => p.id === id);
    return !!pep && this.puedeMover(pep);
  });

  /** Cantidad del golpe o la cura que se va a aplicar al seleccionado. */
  protected readonly cantidadPg = signal(1);

  /**
   * TUS personajes en la mesa: la tarjeta fija de arriba a la izquierda. Un
   * jugador no debería tener que buscarse en la lista, y puede traer más de
   * uno. Solo PJ: al máster, esMio le sale true en todos SUS PNJ, y una
   * tarjeta por goblin no es lo que nadie quiere.
   */
  protected readonly misPjs = computed(() =>
    (this.partida()?.personajes ?? []).filter(
      (pep) => pep.esMio && pep.tipo === 'pj',
    ),
  );

  /**
   * Herramienta activa del tablero. Es el contenedor que faltaba: sin un
   * modo activo, medir, plantillas o niebla no tienen dónde vivir.
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

  /** Menú de acciones del máster (mapa, código, cerrar la mesa). */
  protected readonly menuMaster = signal(false);

  /** Público: la barra de la mesa pinta si la conexión está viva. */
  protected readonly socket = inject(PartidaSocket);

  constructor() {
    this.cargar();
    // Tiempo real: los cambios de otros llegan solos por el socket
    const socket = this.socket;
    socket.conectar(this.partidaId, {
      onEstadoPersonaje: (evento) => this.aplicarEvento(evento),
      onMesaCambiada: () => this.cargar(),
      onMesaEliminada: () => this.mesaCerrada(),
      onTirada: (tirada) => this.agregarTirada(tirada),
    });
    inject(DestroyRef).onDestroy(() => socket.desconectar());
  }

  /** Recarga completa (también botón Actualizar, como respaldo manual). */
  protected cargar(): void {
    this.error.set(null);
    this.api.detalle(this.partidaId).subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) => {
        // Un 404 aquí NO es un fallo de carga: la mesa es privada, así que
        // significa que ya no tienes sitio en ella. Pasaba al sacarte el
        // personaje: llegaba mesa-cambiada, la recarga daba 404 y te
        // quedabas mirando una sala que para el servidor ya no era tuya.
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.volverAlEscritorio(
            this.partida()
              ? 'Ya no tienes ningún personaje en esa mesa, así que has ' +
                  'vuelto a tu escritorio.'
              : 'No estás en esa mesa. Para entrar necesitas su código de ' +
                  'invitación y sentarte con uno de tus personajes.',
          );
          return;
        }
        this.error.set(`No se pudo cargar la partida: ${mensajeDeError(err)}`);
      },
    });
  }

  /**
   * El máster cerró la mesa mientras estábamos dentro. Si el que la cerró
   * soy YO, no digo nada aquí: el evento llega antes que la respuesta HTTP,
   * y es esa la que sabe redactar el aviso en primera persona.
   */
  private mesaCerrada(): void {
    if (this.eliminando()) {
      return;
    }
    this.volverAlEscritorio('El máster ha cerrado esa mesa.');
  }

  /**
   * Se acabó la mesa para ti: al escritorio, y diciendo por qué. Volver sin
   * explicación desconcierta tanto como quedarse en una sala fantasma.
   */
  private volverAlEscritorio(motivo: string): void {
    this.aviso.publicar(motivo);
    this.router.navigate(['/']);
  }

  /**
   * Quién OCUPA la casilla, contando la huella completa: un Grande en (3,3)
   * ocupa también (4,3), (3,4) y (4,4).
   */
  protected ocupanteDe(
    x: number,
    y: number,
  ): PersonajeEnPartidaResumen | undefined {
    return this.partida()?.personajes.find(
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
    return this.partida()?.personajes.find(
      (pep) => pep.posX === x && pep.posY === y,
    );
  }

  /** Lado del token para cubrir su huella, contando los huecos de la rejilla. */
  protected ladoToken(pep: PersonajeEnPartidaResumen): string {
    return `calc(${pep.casillas * 100}% + ${(pep.casillas - 1) * 2 - 4}px)`;
  }

  protected puedeMover(pep: PersonajeEnPartidaResumen): boolean {
    return (this.partida()?.esMaster ?? false) || pep.esMio;
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
      this.seleccionar(ocupante);
      return;
    }
    const pepId = this.seleccionado();
    const pep = this.pepSeleccionado();
    if (pepId && pep && this.puedeMover(pep)) {
      this.mover(pepId, x, y);
    }
  }

  /** Cambia de herramienta; al salir de medir se borra lo medido. */
  protected usarHerramienta(cual: 'seleccionar' | 'medir'): void {
    this.herramienta.set(cual);
    this.medicion.set(null);
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

  /** Selecciona (o deselecciona) un asiento: es lo que llena el panel. */
  protected seleccionar(pep: PersonajeEnPartidaResumen): void {
    this.seleccionado.set(this.seleccionado() === pep.id ? null : pep.id);
  }

  /**
   * Golpe o cura por CANTIDAD, que es como se canta en la mesa ("ocho de
   * daño"), en vez de obligar a restar de cabeza y reescribir el total.
   * Los PG pueden bajar de cero: en PF1e ahí empieza lo interesante.
   */
  protected ajustarPg(pep: PersonajeEnPartidaResumen, signo: 1 | -1): void {
    const actual = pep.pgActuales;
    if (actual === null || actual === undefined) {
      return;
    }
    const cantidad = Math.trunc(this.cantidadPg());
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return;
    }
    let pgActuales = actual + signo * cantidad;
    // Curar no sube por encima del total; el daño no tiene suelo.
    if (signo === 1 && pep.pgTotal !== undefined) {
      pgActuales = Math.min(pgActuales, pep.pgTotal);
    }
    this.aplicarCambio(pep.id, { pgActuales });
  }

  /** Fracción de PG que queda (0..1), para la barra. Null si no se sabe. */
  protected fraccionPg(pep: PersonajeEnPartidaResumen): number | null {
    if (
      pep.pgActuales === null ||
      pep.pgActuales === undefined ||
      !pep.pgTotal
    ) {
      return null;
    }
    return Math.max(0, Math.min(1, pep.pgActuales / pep.pgTotal));
  }

  /** A 0 PG se marca, pero NO sale de la iniciativa: sigue en su sitio. */
  protected esCaido(pep: PersonajeEnPartidaResumen): boolean {
    return pep.estadoVital === 'caido';
  }

  /** El máster sube (o reemplaza) el mapa de fondo de la mesa. */
  protected subirMapa(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    if (!fichero) {
      return;
    }
    this.error.set(null);
    this.api.subirMapa(this.partidaId, fichero).subscribe({
      next: (partida) => {
        this.partida.set(partida);
        this.versionMapa.update((v) => v + 1);
        // Permite volver a elegir el MISMO fichero si hiciera falta
        input.value = '';
      },
      error: (err) =>
        this.error.set(`No se pudo subir el mapa: ${mensajeDeError(err)}`),
    });
  }

  /** Cambia el código de invitación: la salida barata si se filtra. */
  protected regenerarCodigo(): void {
    if (
      !window.confirm(
        'Se generará un código nuevo y el anterior dejará de servir. ' +
          'Los que ya están en la mesa siguen dentro. ¿Continuar?',
      )
    ) {
      return;
    }
    this.error.set(null);
    this.api.regenerarCodigo(this.partidaId).subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) =>
        this.error.set(`No se pudo cambiar el código: ${mensajeDeError(err)}`),
    });
  }

  /**
   * Cierra la mesa para siempre. Es lo único irreversible de esta pantalla,
   * así que la confirmación NOMBRA la mesa y dice a cuánta gente afecta —y
   * qué NO se pierde, que es la duda razonable al leer "borrar".
   */
  protected eliminarMesa(): void {
    const p = this.partida();
    if (!p || this.eliminando()) {
      return;
    }
    const cuantos = p.personajes.length;
    if (
      !window.confirm(
        `Vas a cerrar «${p.nombre}» para siempre: se pierden el mapa, el ` +
          `combate y los ${cuantos} ${cuantos === 1 ? 'asiento' : 'asientos'}` +
          ' de la mesa. Las fichas de los jugadores NO se borran. Quien esté' +
          ' dentro volverá a su escritorio. ¿Continuar?',
      )
    ) {
      return;
    }
    this.error.set(null);
    this.eliminando.set(true);
    this.api.eliminar(this.partidaId).subscribe({
      next: () => {
        this.aviso.publicar(`Has cerrado la mesa «${p.nombre}».`);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.eliminando.set(false);
        this.error.set(`No se pudo cerrar la mesa: ${mensajeDeError(err)}`);
      },
    });
  }

  protected quitarMapa(): void {
    this.error.set(null);
    this.api.quitarMapa(this.partidaId).subscribe({
      next: (partida) => {
        this.partida.set(partida);
        this.versionMapa.update((v) => v + 1);
      },
      error: (err) =>
        this.error.set(`No se pudo quitar el mapa: ${mensajeDeError(err)}`),
    });
  }

  /** Arrastre: empieza en el token (si puedes moverlo). */
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
      this.mover(pepId, x, y);
    }
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

  protected seleccionarDelBanquillo(pep: PersonajeEnPartidaResumen): void {
    this.seleccionar(pep);
  }

  protected guardarPg(pep: PersonajeEnPartidaResumen, valor: string): void {
    const pgActuales = Number(valor);
    if (!Number.isInteger(pgActuales)) {
      return;
    }
    this.aplicarCambio(pep.id, { pgActuales });
  }

  protected nombreCondicion(id: string): string {
    return CONDICION_POR_ID[id]?.nombre ?? id;
  }

  protected descripcionCondicion(id: string): string {
    return CONDICION_POR_ID[id]?.descripcion ?? '';
  }

  /** Condiciones del catálogo que este personaje aún NO tiene activas. */
  protected condicionesDisponibles(pep: PersonajeEnPartidaResumen) {
    return CONDICIONES.filter((c) => !pep.condiciones.includes(c.id));
  }

  protected anadirCondicion(pep: PersonajeEnPartidaResumen, id: string): void {
    if (!id || pep.condiciones.includes(id)) {
      return;
    }
    this.aplicarCambio(pep.id, { condiciones: [...pep.condiciones, id] });
  }

  protected quitarCondicion(pep: PersonajeEnPartidaResumen, id: string): void {
    this.aplicarCambio(pep.id, {
      condiciones: pep.condiciones.filter((c) => c !== id),
    });
  }

  protected guardarIniciativa(
    pep: PersonajeEnPartidaResumen,
    valor: string,
  ): void {
    const iniciativa = Number(valor);
    if (!Number.isInteger(iniciativa)) {
      return;
    }
    this.aplicarCambio(pep.id, { iniciativa });
  }

  /** Tira 1d20 + el modificador de iniciativa de la ficha en el servidor. */
  protected tirarIniciativa(pep: PersonajeEnPartidaResumen): void {
    this.error.set(null);
    this.api.tirarIniciativa(this.partidaId, pep.id).subscribe({
      next: (actualizado) => this.reemplazar(actualizado),
      error: (err) =>
        this.error.set(`No se pudo tirar iniciativa: ${mensajeDeError(err)}`),
    });
  }

  protected esTurno(pep: PersonajeEnPartidaResumen): boolean {
    return this.partida()?.turnoPepId === pep.id;
  }

  protected iniciarCombate(): void {
    this.accionCombate(this.api.iniciarCombate(this.partidaId));
  }

  protected siguienteTurno(): void {
    this.accionCombate(this.api.siguienteTurno(this.partidaId));
  }

  protected terminarCombate(): void {
    this.accionCombate(this.api.terminarCombate(this.partidaId));
  }

  /** Las acciones de combate devuelven el detalle completo ya actualizado. */
  private accionCombate(obs: Observable<PartidaDetalle>): void {
    this.error.set(null);
    obs.subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) =>
        this.error.set(`No se pudo actualizar el combate: ${mensajeDeError(err)}`),
    });
  }

  protected sacar(pep: PersonajeEnPartidaResumen): void {
    this.api.sacar(this.partidaId, pep.id).subscribe({
      next: () => this.cargar(),
      error: (err) =>
        this.error.set(`No se pudo sacar: ${mensajeDeError(err)}`),
    });
  }

  /** Pide una tirada al servidor; el resultado llega por el socket. */
  protected lanzar(notacion: string, etiqueta?: string): void {
    const limpia = notacion.trim();
    if (!limpia) {
      return;
    }
    this.error.set(null);
    this.api.tirar(this.partidaId, limpia, etiqueta?.trim() || undefined).subscribe({
      // Añadimos también desde la respuesta HTTP para feedback inmediato;
      // el eco del socket trae el mismo id y agregarTirada lo deduplica.
      next: (tirada) => this.agregarTirada(tirada),
      error: (err) =>
        this.error.set(`No se pudo tirar: ${mensajeDeError(err)}`),
    });
  }

  /** Añade una tirada al registro, sin duplicar (id compartido con el eco). */
  private agregarTirada(tirada: TiradaResultado): void {
    this.tiradas.update((prev) =>
      prev.some((t) => t.id === tirada.id)
        ? prev
        : [tirada, ...prev].slice(0, 30),
    );
  }

  /** Abre la ficha COMPLETA de un personaje (el servidor valida el acceso:
   *  dueño o máster de la mesa donde está sentado). */
  protected verFicha(pep: PersonajeEnPartidaResumen): void {
    this.cargandoFicha.set(true);
    this.error.set(null);
    this.charactersApi.get(pep.characterId).subscribe({
      next: (ficha) => {
        this.fichaAbierta.set(ficha);
        this.fichaEsMia.set(pep.esMio);
        this.editandoFicha.set(false);
        this.cargandoFicha.set(false);
      },
      error: (err) => {
        this.error.set(`No se pudo abrir la ficha: ${mensajeDeError(err)}`);
        this.cargandoFicha.set(false);
      },
    });
  }

  protected editarFicha(): void {
    this.editandoFicha.set(true);
  }

  /**
   * Guarda la ficha desde la mesa. Al volver hay que RECARGAR la partida:
   * la CA, los PG totales, la iniciativa y las casillas que ocupa son
   * derivados de la ficha y los calcula el servidor.
   */
  protected guardarFicha(cambios: CharacterUpsert): void {
    const ficha = this.fichaAbierta();
    if (!ficha) {
      return;
    }
    this.guardandoFicha.set(true);
    this.charactersApi.update(ficha.id, cambios).subscribe({
      next: (actualizada) => {
        this.fichaAbierta.set(actualizada);
        this.editandoFicha.set(false);
        this.guardandoFicha.set(false);
        this.cargar();
      },
      error: (err) => {
        this.guardandoFicha.set(false);
        this.error.set(`No se pudo guardar la ficha: ${mensajeDeError(err)}`);
      },
    });
  }

  protected cerrarFicha(): void {
    // Editando, no se cierra a lo bruto: se pregunta como en /personajes
    if (this.editandoFicha() && this.formularioFicha()?.sucio()) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Descartar y cerrar?')) {
        return;
      }
    }
    this.fichaAbierta.set(null);
    this.editandoFicha.set(false);
  }

  /** Cierra la modal solo si el clic fue en el fondo, no dentro de la ventana. */
  protected onOverlayFicha(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarFicha();
    }
  }

  protected iniciales(nombre: string): string {
    return nombre
      .split(/\s+/)
      .map((palabra) => palabra[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  /**
   * Color del token. Los PNJ van por ACTITUD (rojo enemigo, verde aliado,
   * gris neutral) para leer el tablero de un vistazo; los PJ mantienen su
   * color estable por nombre, que es lo que distingue a los jugadores.
   */
  protected colorToken(pep: PersonajeEnPartidaResumen): string {
    if (pep.tipo === 'pnj' && pep.actitud) {
      return `var(--actitud-${pep.actitud})`;
    }
    let suma = 0;
    for (let i = 0; i < pep.nombre.length; i++) {
      suma += pep.nombre.charCodeAt(i);
    }
    return `var(--token-${suma % 6})`;
  }

  /**
   * El máster siembra PNJ. Se abre en el BESTIARIO si ya tiene monstruos
   * guardados (el caso frecuente en cuanto lleva un par de sesiones) y en
   * el formulario si aún no tiene ninguno.
   */
  protected abrirPnj(): void {
    this.pnjAbierto.set(true);
    this.errorPnj.set(null);
    this.charactersApi.bestiario().subscribe({
      next: (plantillas) => {
        this.bestiario.set(plantillas);
        this.modoPnj.set(plantillas.length > 0 ? 'bestiario' : 'nuevo');
      },
      // Sin bestiario disponible siempre queda crear uno a mano
      error: () => this.modoPnj.set('nuevo'),
    });
  }

  protected sembrarDesdePlantilla(plantillaId: string): void {
    this.errorPnj.set(null);
    this.creandoPnj.set(true);
    this.api
      .sembrarDesdePlantilla(this.partidaId, {
        plantillaId,
        cantidad: this.cantidadPlantilla(),
        actitud: this.actitudPlantilla(),
        oculto: this.ocultoPlantilla(),
      })
      .subscribe({
        next: (partida) => {
          this.partida.set(partida);
          this.creandoPnj.set(false);
          this.pnjAbierto.set(false);
        },
        error: (err) => {
          this.creandoPnj.set(false);
          this.errorPnj.set(mensajeDeError(err));
        },
      });
  }

  protected cerrarPnj(): void {
    this.pnjAbierto.set(false);
  }

  /** Cierra la modal de PNJ solo si el clic fue en el fondo. */
  protected onOverlayPnj(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrarPnj();
    }
  }

  protected crearPnjs(datos: CrearPnj): void {
    this.errorPnj.set(null);
    this.creandoPnj.set(true);
    this.api.crearPnjs(this.partidaId, datos).subscribe({
      next: (partida) => {
        this.partida.set(partida);
        this.creandoPnj.set(false);
        this.pnjAbierto.set(false);
      },
      error: (err) => {
        this.creandoPnj.set(false);
        this.errorPnj.set(mensajeDeError(err));
      },
    });
  }

  /** Saca al PNJ de la sombra (o lo vuelve a esconder). */
  protected alternarOculto(pep: PersonajeEnPartidaResumen): void {
    this.api.revelarPnj(this.partidaId, pep.id, !pep.oculto).subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) =>
        this.error.set(`No se pudo cambiar la visibilidad: ${mensajeDeError(err)}`),
    });
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
