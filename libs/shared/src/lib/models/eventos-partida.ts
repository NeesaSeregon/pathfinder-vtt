import { PersonajeEnPartidaResumen } from './partida';
import type { TiradaResultado } from './tirada';

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
 * PG, condiciones...). El payload es NEUTRO (el resumen recalculado SIN
 * esMio, que es lo único que depende de quién pregunta): cada cliente lo
 * fusiona conservando su propio esMio. Incluir el resumen entero hace que
 * los derivados (CA con condiciones, etc.) lleguen también a los demás.
 */
export const EVENTO_ESTADO_PERSONAJE = 'estado-personaje';

export interface EstadoPersonajeEvento {
  pepId: string;
  cambios: Partial<Omit<PersonajeEnPartidaResumen, 'esMio'>>;
}

/**
 * Servidor → sala: la composición de la mesa cambió (alguien se unió o
 * salió). Los clientes recargan el detalle por HTTP, que sí personaliza
 * campos como esMio o el código del máster.
 */
export const EVENTO_MESA_CAMBIADA = 'mesa-cambiada';

/**
 * Servidor → sala: alguien tiró los dados. El resultado ya viene resuelto
 * por el servidor (única fuente de azar); los clientes solo lo muestran.
 * Es efímero: no se persiste, quien entre después no lo verá.
 */
export const EVENTO_TIRADA_DADOS = 'tirada-dados';

export type TiradaDadosEvento = TiradaResultado;
