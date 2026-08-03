import { Response } from 'express';
import { COOKIE_SESION } from './auth.constants';

const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

/**
 * Pone la cookie de sesión. Vive fuera del controlador porque la ponen DOS:
 * AuthController (registro y login) y CuentaController (que renueva la
 * sesión tras cambiar la contraseña). Duplicarla sería la forma más fácil
 * de que un día una de las dos se quedara sin httpOnly.
 */
export function ponerCookieSesion(res: Response, token: string): void {
  res.cookie(COOKIE_SESION, token, {
    // httpOnly: JavaScript no puede leerla → un XSS no puede robarla
    httpOnly: true,
    // strict: el navegador solo la envía en peticiones desde NUESTRA
    // página → la protección anti-CSRF nos sale casi gratis
    sameSite: 'strict',
    // secure exige HTTPS; en desarrollo (y jugando por LAN) vamos por http
    secure: process.env.NODE_ENV === 'production',
    maxAge: OCHO_HORAS_MS,
    path: '/',
  });
}
