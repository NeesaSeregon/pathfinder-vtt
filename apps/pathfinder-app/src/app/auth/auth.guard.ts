import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SesionStore } from './sesion-store';
import { AuthApi } from './auth-api';

/**
 * Protege rutas. Como el token vive en una cookie httpOnly, el front no
 * puede saber por sí solo si hay sesión: la primera vez pregunta a
 * /api/auth/me y cachea la respuesta en el SesionStore.
 */
export const authGuard: CanActivateFn = () => {
  const sesion = inject(SesionStore);
  const api = inject(AuthApi);
  const router = inject(Router);

  if (sesion.inicializada()) {
    return sesion.conectado() ? true : router.createUrlTree(['/entrar']);
  }

  return api.me().pipe(
    map((respuesta) => {
      sesion.establecer(respuesta.username);
      return true;
    }),
    catchError(() => {
      sesion.limpiar();
      return of(router.createUrlTree(['/entrar']));
    }),
  );
};
