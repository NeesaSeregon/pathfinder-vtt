import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Credenciales,
  RegistroDatos,
  SesionRespuesta,
} from '@pathfinder/shared';

@Service()
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(datos: RegistroDatos): Observable<SesionRespuesta> {
    return this.http.post<SesionRespuesta>('/api/auth/register', datos);
  }

  login(credenciales: Credenciales): Observable<SesionRespuesta> {
    return this.http.post<SesionRespuesta>('/api/auth/login', credenciales);
  }

  /** ¿Hay sesión (cookie) válida? Devuelve el username o 401. */
  me(): Observable<SesionRespuesta> {
    return this.http.get<SesionRespuesta>('/api/auth/me');
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {});
  }
}
