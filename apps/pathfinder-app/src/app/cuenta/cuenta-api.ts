import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BorrarCuentaDatos,
  CambiarPasswordDatos,
  CuentaDetalle,
} from '@pathfinder/shared';

@Service()
export class CuentaApi {
  private readonly http = inject(HttpClient);

  detalle(): Observable<CuentaDetalle> {
    return this.http.get<CuentaDetalle>('/api/cuenta');
  }

  cambiarPassword(datos: CambiarPasswordDatos): Observable<void> {
    return this.http.patch<void>('/api/cuenta/password', datos);
  }

  /** El cuerpo viaja en un DELETE: es la contraseña de confirmación. */
  borrar(datos: BorrarCuentaDatos): Observable<void> {
    return this.http.delete<void>('/api/cuenta', { body: datos });
  }
}
