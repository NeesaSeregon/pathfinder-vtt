export const ESTADOS_PARTIDA = [
  'preparacion',
  'activa',
  'finalizada',
] as const;

export type EstadoPartida = (typeof ESTADOS_PARTIDA)[number];

export const ESTADO_PARTIDA_LABELS: Record<EstadoPartida, string> = {
  preparacion: 'En preparación',
  activa: 'Activa',
  finalizada: 'Finalizada',
};

/** Lo que se envía para crear una partida. */
export interface CrearPartida {
  nombre: string;
  descripcion?: string;
}

/** Una partida en el listado/buscador. */
export interface PartidaResumen {
  id: string;
  nombre: string;
  descripcion: string;
  estado: EstadoPartida;
  master: string;
  numPersonajes: number;
  /** Solo presente si TÚ eres el máster: es la invitación a compartir. */
  codigo?: string;
}

/** Dimensiones del tablero en casillas (1 casilla = 5 pies). */
export const TABLERO_ANCHO = 20;
export const TABLERO_ALTO = 15;

/**
 * Un personaje sentado a la mesa: referencia a su ficha + el ESTADO DE
 * SESIÓN (lo que cambia jugando y no pertenece a la ficha).
 */
export interface PersonajeEnPartidaResumen {
  id: string;
  characterId: string;
  nombre: string;
  jugador?: string;
  nivel: number;
  /** CA derivada de la ficha por el SERVIDOR, con las reglas compartidas. */
  ca: number;
  pgTotal?: number;
  pgActuales: number | null;
  danoNoLetal: number;
  /** Condiciones activas como ids del catálogo (ver condiciones.ts). */
  condiciones: string[];
  posX: number | null;
  posY: number | null;
  /** Iniciativa TIRADA en el combate actual (null = aún no ha tirado). */
  iniciativa: number | null;
  /** Modificador de iniciativa de la ficha, derivado por el SERVIDOR. */
  iniciativaMod: number;
  /** ¿El personaje es del usuario que pregunta? (para permitir moverlo) */
  esMio: boolean;
}

/** Cambios de estado de sesión de un personaje en la mesa. */
export interface ActualizarPersonajeEnPartida {
  posX?: number;
  posY?: number;
  pgActuales?: number;
  danoNoLetal?: number;
  condiciones?: string[];
  iniciativa?: number;
}

export interface PartidaDetalle extends PartidaResumen {
  esMaster: boolean;
  personajes: PersonajeEnPartidaResumen[];
  /** Estado del rastreador de combate (ver ordenarIniciativa). */
  enCombate: boolean;
  ronda: number;
  /** pepId del personaje que tiene el turno (null fuera de combate). */
  turnoPepId: string | null;
}

/** Lo mínimo para ordenar el turno: la tirada y su desempate. */
export interface Combatiente {
  iniciativa: number | null;
  iniciativaMod: number;
}

/**
 * Ordena combatientes por iniciativa descendente. Empate → gana el mayor
 * modificador de iniciativa (regla de PF1e). Quien no ha tirado va al final.
 * La usan el servidor (para el turno) y el cliente (para pintar el orden),
 * así ambos coinciden siempre.
 */
export function ordenarIniciativa<T extends Combatiente>(
  combatientes: readonly T[],
): T[] {
  return [...combatientes].sort((a, b) => {
    const ia = a.iniciativa ?? Number.NEGATIVE_INFINITY;
    const ib = b.iniciativa ?? Number.NEGATIVE_INFINITY;
    if (ib !== ia) {
      return ib - ia;
    }
    return b.iniciativaMod - a.iniciativaMod;
  });
}
