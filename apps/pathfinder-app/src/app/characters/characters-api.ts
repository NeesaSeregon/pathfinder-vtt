import { inject, Service } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Character, CharacterUpsert } from '@pathfinder/shared';

@Service()
export class CharactersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/characters';

  list(): Observable<Character[]> {
    return this.http.get<Character[]>(this.baseUrl);
  }

  /** El BESTIARIO: las plantillas de PNJ del máster, listas para sembrar. */
  bestiario(): Observable<Character[]> {
    return this.http.get<Character[]>(this.baseUrl, {
      params: new HttpParams().set('tipo', 'pnj'),
    });
  }

  /** Una ficha por id. La API permite leerla al dueño o al máster de su mesa. */
  get(id: string): Observable<Character> {
    return this.http.get<Character>(`${this.baseUrl}/${id}`);
  }

  create(data: CharacterUpsert): Observable<Character> {
    return this.http.post<Character>(this.baseUrl, data);
  }

  update(id: string, data: Partial<CharacterUpsert>): Observable<Character> {
    return this.http.patch<Character>(`${this.baseUrl}/${id}`, data);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
