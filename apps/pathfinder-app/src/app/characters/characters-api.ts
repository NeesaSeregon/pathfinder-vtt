import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Character } from '@pathfinder/shared';

@Service()
export class CharactersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/characters';

  list(): Observable<Character[]> {
    return this.http.get<Character[]>(this.baseUrl);
  }

  create(data: { name: string; level: number }): Observable<Character> {
    return this.http.post<Character>(this.baseUrl, data);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
