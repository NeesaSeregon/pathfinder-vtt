/** Lo que el cliente envía a /api/auth/login: se entra con el email. */
export interface Credenciales {
  email: string;
  password: string;
}

/** Lo que el cliente envía a /api/auth/register. */
export interface RegistroDatos {
  username: string;
  email: string;
  password: string;
}

/**
 * Lo que la API devuelve al registrarse, iniciar sesión o preguntar
 * /api/auth/me. El token NO viaja en el cuerpo: va en una cookie
 * httpOnly que el navegador gestiona solo.
 */
export interface SesionRespuesta {
  username: string;
}

/** El contenido firmado dentro del JWT (el payload). */
export interface JwtPayload {
  /** "subject": el id del usuario. Nombre estándar del claim en JWT. */
  sub: string;
  username: string;
}
