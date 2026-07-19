import {
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import {
  Character,
  CharacterUpsert,
  CONDICIONES,
  CONDICION_POR_ID,
  EstadoPersonajeEvento,
  ordenarIniciativa,
  PartidaDetalle,
  PersonajeEnPartidaResumen,
  TABLERO_ALTO,
  TABLERO_ANCHO,
  TiradaResultado,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { PartidaSocket } from './partida-socket';
import { CharactersApi } from '../characters/characters-api';
import { FichaVista } from '../characters/ficha-vista';
import { CharacterForm } from '../characters/character-form';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-partida-detalle-page',
  imports: [FichaVista, CharacterForm],
  templateUrl: './partida-detalle-page.html',
  styleUrl: './partida-detalle-page.scss',
})
export class PartidaDetallePage {
  private readonly api = inject(PartidasApi);
  private readonly charactersApi = inject(CharactersApi);
  private readonly partidaId =
    inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly columnas = Array.from(
    { length: TABLERO_ANCHO },
    (_, i) => i,
  );
  protected readonly filas = Array.from({ length: TABLERO_ALTO }, (_, i) => i);

  protected readonly partida = signal<PartidaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Id del personaje seleccionado para mover (dos clics: token → casilla). */
  protected readonly seleccionado = signal<string | null>(null);
  /** Id del personaje que se está arrastrando (alternativa a los dos clics). */
  protected readonly arrastrando = signal<string | null>(null);

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

  /** Combatientes (los que han tirado) en orden de turno, como el servidor. */
  protected readonly ordenIniciativa = computed(() =>
    ordenarIniciativa(
      (this.partida()?.personajes ?? []).filter((p) => p.iniciativa !== null),
    ),
  );

  constructor() {
    this.cargar();
    // Tiempo real: los cambios de otros llegan solos por el socket
    const socket = inject(PartidaSocket);
    socket.conectar(this.partidaId, {
      onEstadoPersonaje: (evento) => this.aplicarEvento(evento),
      onMesaCambiada: () => this.cargar(),
      onTirada: (tirada) => this.agregarTirada(tirada),
    });
    inject(DestroyRef).onDestroy(() => socket.desconectar());
  }

  /** Recarga completa (también botón Actualizar, como respaldo manual). */
  protected cargar(): void {
    this.error.set(null);
    this.api.detalle(this.partidaId).subscribe({
      next: (partida) => this.partida.set(partida),
      error: (err) =>
        this.error.set(`No se pudo cargar la partida: ${mensajeDeError(err)}`),
    });
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
    const ocupante = this.ocupanteDe(x, y);
    if (ocupante) {
      // Clic sobre un token: selecciona (o deselecciona) si puedes moverlo
      if (this.puedeMover(ocupante)) {
        this.seleccionado.set(
          this.seleccionado() === ocupante.id ? null : ocupante.id,
        );
      }
      return;
    }
    const pepId = this.seleccionado();
    if (pepId) {
      this.mover(pepId, x, y);
    }
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

  protected seleccionarDelBanquillo(pep: PersonajeEnPartidaResumen): void {
    if (this.puedeMover(pep)) {
      this.seleccionado.set(this.seleccionado() === pep.id ? null : pep.id);
    }
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

  /** Color estable del avatar según el nombre (paleta del tema, styles.scss). */
  protected colorToken(nombre: string): string {
    let suma = 0;
    for (let i = 0; i < nombre.length; i++) {
      suma += nombre.charCodeAt(i);
    }
    return `var(--token-${suma % 6})`;
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
