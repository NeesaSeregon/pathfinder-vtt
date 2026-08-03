import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Credenciales,
  OlvidePasswordDatos,
  RegistroDatos,
  RestablecerPasswordDatos,
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

  /**
   * Paso 1 de "he olvidado mi contraseña". Devuelve 204 exista o no la
   * cuenta: el front NO puede saber si el correo estaba registrado, y esa
   * es justamente la idea.
   */
  olvidePassword(datos: OlvidePasswordDatos): Observable<void> {
    return this.http.post<void>('/api/auth/password/olvidada', datos);
  }

  /** Paso 2: canjear el token del correo por una contraseña nueva. */
  restablecerPassword(datos: RestablecerPasswordDatos): Observable<void> {
    return this.http.post<void>('/api/auth/password/restablecer', datos);
  }
}
