import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SesionStore } from './sesion-store';

/**
 * Con la cookie httpOnly ya no hay que añadir ningún header: el navegador
 * adjunta la cookie solo. Este interceptor queda para UNA cosa: si la API
 * responde 401 (sesión caducada), limpiar el estado y llevar a /entrar.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      // Los 401 de /api/auth/ son "contraseña mala" o "aún sin sesión":
      // los gestionan las propias páginas de login y el guard.
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/api/auth/')
      ) {
        sesion.limpiar();
        router.navigate(['/entrar']);
      }
      return throwError(() => error);
    }),
  );
};
