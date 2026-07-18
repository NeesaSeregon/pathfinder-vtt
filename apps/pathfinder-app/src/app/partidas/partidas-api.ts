import { inject, Service } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ActualizarPersonajeEnPartida,
  CrearPartida,
  PartidaDetalle,
  PartidaResumen,
  PersonajeEnPartidaResumen,
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
}
