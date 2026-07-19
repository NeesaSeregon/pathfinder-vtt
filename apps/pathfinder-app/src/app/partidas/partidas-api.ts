import { inject, Service } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActualizarPersonajeEnPartida,
  CrearPartida,
  MiPartidaResumen,
  PartidaDetalle,
  PartidaResumen,
  PersonajeEnPartidaResumen,
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

  detalle(id: string): Observable<PartidaDetalle> {
    return this.http.get<PartidaDetalle>(`${this.baseUrl}/${id}`);
  }

  unir(
    partidaId: string,
    characterId: string,
  ): Observable<PersonajeEnPartidaResumen> {
    return this.http.post<PersonajeEnPartidaResumen>(
      `${this.baseUrl}/${partidaId}/personajes`,
      { characterId },
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
