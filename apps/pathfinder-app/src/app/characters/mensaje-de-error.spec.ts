import { HttpErrorResponse } from '@angular/common/http';
import { mensajeDeError } from './mensaje-de-error';

describe('mensajeDeError', () => {
  it('explica que la API no responde cuando el status es 0', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(mensajeDeError(error)).toContain('no hay conexión con la API');
  });

  it('muestra los mensajes de validación de NestJS (400)', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        message: ['name should not be empty', 'level must not be greater than 20'],
        error: 'Bad Request',
        statusCode: 400,
      },
    });
    expect(mensajeDeError(error)).toBe(
      'name should not be empty; level must not be greater than 20',
    );
  });

  it('muestra el mensaje simple de otros errores del servidor', () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: { message: 'Character with id X not found', statusCode: 404 },
    });
    expect(mensajeDeError(error)).toBe('Character with id X not found');
  });

  it('indica el código cuando el servidor no manda mensaje', () => {
    const error = new HttpErrorResponse({ status: 500 });
    expect(mensajeDeError(error)).toBe('error 500 del servidor');
  });
});
