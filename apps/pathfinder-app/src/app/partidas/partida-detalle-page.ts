import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Character,
  CharacterUpsert,
  CrearPnj,
  EstadoPersonajeEvento,
  PartidaDetalle,
  PersonajeEnPartidaResumen,
  SembrarPnj,
  TiradaResultado,
  ZonaTablero,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { PartidaSocket } from './partida-socket';
import { AvisoMesaStore } from './aviso-mesa-store';
import { CharactersApi } from '../characters/characters-api';
import { FichaVista } from '../characters/ficha-vista';
import { CharacterForm } from '../characters/character-form';
import { MesaBarra } from './mesa-barra';
import { MesaPersonas } from './mesa-personas';
import { MesaRegistro } from './mesa-registro';
import { MesaSeleccion } from './mesa-seleccion';
import { MesaTablero, RectanguloDibujado } from './mesa-tablero';
import { PnjModal } from './pnj-modal';
import { ZonasModal } from './zonas-modal';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-partida-detalle-page',
  imports: [
    FichaVista,
    CharacterForm,
    MesaBarra,
    MesaPersonas,
    MesaRegistro,
    MesaSeleccion,
    MesaTablero,
    PnjModal,
    ZonasModal,
  ],
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

  protected readonly partida = signal<PartidaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Cerrando la mesa: desactiva el botón para no pedirlo dos veces. */
  protected readonly eliminando = signal(false);
  /** Id del personaje seleccionado para mover (dos clics: token → casilla). */
  protected readonly seleccionado = signal<string | null>(null);
  /** Registro de tiradas recientes (efímero, lo más nuevo primero). */
  protected readonly tiradas = signal<TiradaResultado[]>([]);

  /** Solo el máster o el dueño de un personaje de la mesa pueden tirar. */
  protected readonly esParticipante = computed(() => {
    const p = this.partida();
    return !!p && (p.esMaster || p.personajes.some((pep) => pep.esMio));
  });

  /**
   * Zonas del tablero (solo el máster las edita). La lista que llega en el
   * detalle ya viene filtrada por el servidor: un jugador no recibe las que
   * no ha de ver, así que aquí no hay nada que ocultar.
   */
  protected readonly zonasAbiertas = signal(false);
  protected readonly guardandoZonas = signal(false);
  protected readonly errorZonas = signal<string | null>(null);

  /**
   * Siembra de PNJ (solo el máster). Aquí solo queda lo que la mesa necesita
   * saber: si está abierta, qué plantillas hay y en qué anda la petición.
   * La pestaña y las opciones de la siembra son cosa de PnjModal.
   */
  protected readonly pnjAbierto = signal(false);
  protected readonly bestiario = signal<Character[]>([]);
  protected readonly creandoPnj = signal(false);
  protected readonly errorPnj = signal<string | null>(null);

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

  /** El asiento seleccionado, que es lo que pinta el panel de la derecha. */
  protected readonly pepSeleccionado = computed(() => {
    const id = this.seleccionado();
    return id
      ? (this.partida()?.personajes.find((p) => p.id === id) ?? null)
      : null;
  });

  /** Cantidad del golpe o la cura que se va a aplicar al seleccionado. */
  protected readonly cantidadPg = signal(1);

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

  protected puedeMover(pep: PersonajeEnPartidaResumen): boolean {
    return (this.partida()?.esMaster ?? false) || pep.esMio;
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

  /**
   * El máster ha arrastrado un rectángulo sobre el tablero: nace una zona
   * sin nombre y sin terreno, YA VISIBLE, y se guarda en el acto. Ponerle
   * nombre es después y en la lista — dibujar y escribir son dos gestos
   * distintos y no deben pedirse a la vez.
   */
  protected dibujarZona(rectangulo: RectanguloDibujado): void {
    const p = this.partida();
    if (!p?.esMaster) {
      return;
    }
    const zona: ZonaTablero = {
      id: crypto.randomUUID(),
      nombre: '',
      terreno: 'ninguno',
      visible: true,
      ...rectangulo,
    };
    this.guardarZonas([...p.zonas, zona]);
  }

  /** Guarda la lista ENTERA de zonas; el servidor se queda con esto y ya. */
  protected guardarZonas(zonas: ZonaTablero[]): void {
    this.errorZonas.set(null);
    this.guardandoZonas.set(true);
    this.api.guardarZonas(this.partidaId, zonas).subscribe({
      next: (partida) => {
        this.partida.set(partida);
        this.guardandoZonas.set(false);
        this.zonasAbiertas.set(false);
      },
      error: (err) => {
        this.guardandoZonas.set(false);
        this.errorZonas.set(
          `No se pudieron guardar las zonas: ${mensajeDeError(err)}`,
        );
        // Dibujar no abre la lista, así que si falla ahí el error no se
        // vería: se dice también arriba, donde se ven los de la mesa.
        if (!this.zonasAbiertas()) {
          this.error.set(this.errorZonas());
        }
      },
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
        `Vas a cerrar «${p.nombre}» para siempre: se pierden las zonas, el ` +
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

  /** Arrastre: empieza en el token (si puedes moverlo). */
  protected guardarPg(pep: PersonajeEnPartidaResumen, valor: string): void {
    const pgActuales = Number(valor);
    if (!Number.isInteger(pgActuales)) {
      return;
    }
    this.aplicarCambio(pep.id, { pgActuales });
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

  /**
   * El máster siembra PNJ: abre la modal y pide el bestiario. La modal se
   * abre sola por la pestaña que toque según lo que llegue aquí (vacío
   * mientras se pide, y vacío también si la petición falla: entonces
   * siempre queda crear uno a mano).
   */
  protected abrirPnj(): void {
    this.pnjAbierto.set(true);
    this.errorPnj.set(null);
    this.charactersApi.bestiario().subscribe({
      next: (plantillas) => this.bestiario.set(plantillas),
      error: () => this.bestiario.set([]),
    });
  }

  protected sembrarDesdePlantilla(datos: SembrarPnj): void {
    this.errorPnj.set(null);
    this.creandoPnj.set(true);
    this.api
      .sembrarDesdePlantilla(this.partidaId, datos)
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

  /** Lo pide el tablero (clic en casilla o soltar un token). */
  protected mover(pepId: string, posX: number, posY: number): void {
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
