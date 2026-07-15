import { HttpErrorResponse } from '@angular/common/http';

/**
 * Traduce un error HTTP a un texto útil para el usuario.
 * - status 0: la petición no llegó (API caída, sin red).
 * - 400 de NestJS: el ValidationPipe manda { message: string[] } con el
 *   detalle de cada campo inválido — lo mostramos tal cual.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'no hay conexión con la API (¿está arrancada? npx nx serve api)';
    }
    const message = error.error?.message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return `error ${error.status} del servidor`;
  }
  return 'error inesperado';
}
