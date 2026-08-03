/**
 * Longitud mínima de una contraseña. Vive aquí para que el registro, el
 * cambio desde /cuenta y el restablecimiento por correo usen EXACTAMENTE
 * el mismo mínimo: si uno se quedara corto, sería la puerta por la que
 * rebajar la contraseña de las otras dos.
 */
export const PASSWORD_MIN_LONGITUD = 8;

/**
 * Máximo. No es una manía nuestra: bcrypt solo mira los primeros 72 BYTES
 * de la contraseña y descarta el resto en silencio. Mejor rechazarlo que
 * dar por buena una contraseña de la que se ignora media.
 */
export const PASSWORD_MAX_LONGITUD = 72;

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

/**
 * Los datos de la cuenta que ve su dueño en /cuenta. Los contadores están
 * aquí para que el aviso de borrado diga QUÉ se va a perder: un "vas a
 * borrar 4 personajes y 2 partidas" pesa más que un "¿seguro?".
 */
export interface CuentaDetalle {
  username: string;
  email: string;
  /** Fecha de alta en ISO; el front la formatea. */
  creadaEl: string;
  numPersonajes: number;
  numPartidasComoMaster: number;
  numPartidasComoJugador: number;
}

/**
 * Borrar la cuenta es irreversible, así que se pide la contraseña otra vez:
 * si alguien se deja la sesión abierta, no basta con pulsar un botón.
 */
export interface BorrarCuentaDatos {
  password: string;
}

/**
 * Cambiar la contraseña estando dentro. Se pide la actual por el mismo
 * motivo que para borrar: una sesión abierta no debe bastar para
 * quedarse con la cuenta de otro.
 */
export interface CambiarPasswordDatos {
  passwordActual: string;
  passwordNueva: string;
}

/**
 * "He olvidado mi contraseña": lo único que se pide es el correo. La API
 * responde SIEMPRE 204, exista o no esa cuenta (ver RecuperacionService).
 */
export interface OlvidePasswordDatos {
  email: string;
}

/**
 * El segundo paso: el token que venía en el enlace del correo y la
 * contraseña nueva. La repetición se comprueba solo en el front y no
 * viaja, igual que en el cambio desde /cuenta.
 */
export interface RestablecerPasswordDatos {
  token: string;
  passwordNueva: string;
}

/** El contenido firmado dentro del JWT (el payload). */
export interface JwtPayload {
  /** "subject": el id del usuario. Nombre estándar del claim en JWT. */
  sub: string;
  username: string;
  /**
   * Versión de credenciales del usuario (users.tokenVersion) en el momento
   * de emitir el token. El AuthGuard la compara con la que hay en la base
   * de datos: al cambiar o restablecer la contraseña esa cifra sube y
   * TODOS los tokens emitidos antes dejan de valer al instante.
   *
   * Es lo que convierte "cambiar la contraseña" en "echar a quien esté
   * dentro", que es justo lo que espera quien restablece porque le han
   * entrado en la cuenta. Sin esto, un JWT es autocontenido y sobreviviría
   * sus 8 horas completas.
   */
  tv: number;
}
