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

/** El contenido firmado dentro del JWT (el payload). */
export interface JwtPayload {
  /** "subject": el id del usuario. Nombre estándar del claim en JWT. */
  sub: string;
  username: string;
}
