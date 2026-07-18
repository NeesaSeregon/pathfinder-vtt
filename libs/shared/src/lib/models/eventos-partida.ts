import { ActualizarPersonajeEnPartida } from './partida';

/**
 * Contrato de eventos WebSocket de la mesa. Front y back importan ESTOS
 * nombres y tipos: un typo en el nombre de un evento sería un error de
 * compilación, no un bug silencioso de "no me llega nada".
 */

/** Cliente → servidor: únete a la sala de una partida. */
export const EVENTO_ENTRAR_SALA = 'entrar-sala';

export interface EntrarSala {
  partidaId: string;
}

/**
 * Servidor → sala: el estado de sesión de un personaje cambió (se movió,
 * PG, condiciones...). El payload es neutro (igual para todos los
 * clientes): cada uno lo fusiona con lo que ya tiene.
 */
export const EVENTO_ESTADO_PERSONAJE = 'estado-personaje';

export interface EstadoPersonajeEvento {
  pepId: string;
  cambios: ActualizarPersonajeEnPartida;
}

/**
 * Servidor → sala: la composición de la mesa cambió (alguien se unió o
 * salió). Los clientes recargan el detalle por HTTP, que sí personaliza
 * campos como esMio o el código del máster.
 */
export const EVENTO_MESA_CAMBIADA = 'mesa-cambiada';
