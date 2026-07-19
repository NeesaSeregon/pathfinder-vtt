import { inject, Service } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActualizarPersonajeEnPartida,
  CrearPartida,
  CrearPnj,
  MiPartidaResumen,
  PartidaDetalle,
  PartidaResumen,
  PersonajeEnPartidaResumen,
  SembrarPnj,
  TiradaResultado,
} from '@pathfinder/shared';

@Service()
export class PartidasApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/partidas';

  crear(datos: CrearPartida): Observable<PartidaResumen> {
    return this.http.post<PartidaResumen>(this.baseUrl, datos);
  }

  buscar(texto?: string): Observable<PartidaResumen[]> {
    const params = texto?.trim()
      ? new HttpParams().set('buscar', texto.trim())
      : undefined;
    return this.http.get<PartidaResumen[]>(this.baseUrl, { params });
  }

  /** Tus mesas: las que diriges y aquellas donde tienes un personaje. */
  mias(): Observable<MiPartidaResumen[]> {
    return this.http.get<MiPartidaResumen[]>(`${this.baseUrl}/mias`);
  }

  /** Siembra PNJ en la mesa (solo el máster). Devuelve el detalle ya al día. */
  crearPnjs(partidaId: string, datos: CrearPnj): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/pnjs`,
      datos,
    );
  }

  /** Trae copias de un monstruo del bestiario (solo el máster). */
  sembrarDesdePlantilla(
    partidaId: string,
    datos: SembrarPnj,
  ): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/pnjs/desde-plantilla`,
      datos,
    );
  }

  /** Revela u oculta un PNJ del tablero (solo el máster). */
  revelarPnj(
    partidaId: string,
    pepId: string,
    oculto: boolean,
  ): Observable<PartidaDetalle> {
    return this.http.patch<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/pnjs/${pepId}`,
      { oculto },
    );
  }

  detalle(id: string): Observable<PartidaDetalle> {
    return this.http.get<PartidaDetalle>(`${this.baseUrl}/${id}`);
  }

  /**
   * Se sienta en una mesa. El código es la invitación: hace falta salvo que
   * ya estés dentro (el máster, o un jugador con un segundo personaje).
   */
  unir(
    partidaId: string,
    characterId: string,
    codigo?: string,
  ): Observable<PersonajeEnPartidaResumen> {
    return this.http.post<PersonajeEnPartidaResumen>(
      `${this.baseUrl}/${partidaId}/personajes`,
      { characterId, codigo },
    );
  }

  /** Cambia el código de invitación de la mesa (solo el máster). */
  regenerarCodigo(partidaId: string): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/codigo`,
      {},
    );
  }

  actualizarPersonaje(
    partidaId: string,
    pepId: string,
    cambios: ActualizarPersonajeEnPartida,
  ): Observable<PersonajeEnPartidaResumen> {
    return this.http.patch<PersonajeEnPartidaResumen>(
      `${this.baseUrl}/${partidaId}/personajes/${pepId}`,
      cambios,
    );
  }

  sacar(partidaId: string, pepId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${partidaId}/personajes/${pepId}`,
    );
  }

  tirar(
    partidaId: string,
    notacion: string,
    etiqueta?: string,
  ): Observable<TiradaResultado> {
    return this.http.post<TiradaResultado>(
      `${this.baseUrl}/${partidaId}/tiradas`,
      { notacion, etiqueta },
    );
  }

  /** Sube el mapa de fondo (multipart; el navegador pone el Content-Type). */
  subirMapa(partidaId: string, fichero: File): Observable<PartidaDetalle> {
    const datos = new FormData();
    datos.append('mapa', fichero);
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/mapa`,
      datos,
    );
  }

  quitarMapa(partidaId: string): Observable<PartidaDetalle> {
    return this.http.delete<PartidaDetalle>(`${this.baseUrl}/${partidaId}/mapa`);
  }

  tirarIniciativa(
    partidaId: string,
    pepId: string,
  ): Observable<PersonajeEnPartidaResumen> {
    return this.http.post<PersonajeEnPartidaResumen>(
      `${this.baseUrl}/${partidaId}/personajes/${pepId}/iniciativa`,
      {},
    );
  }

  iniciarCombate(partidaId: string): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/combate/iniciar`,
      {},
    );
  }

  siguienteTurno(partidaId: string): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/combate/siguiente`,
      {},
    );
  }

  terminarCombate(partidaId: string): Observable<PartidaDetalle> {
    return this.http.post<PartidaDetalle>(
      `${this.baseUrl}/${partidaId}/combate/terminar`,
      {},
    );
  }
}
