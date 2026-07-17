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
  pgTotal?: number;
  pgActuales: number | null;
  danoNoLetal: number;
  condiciones: string;
  posX: number | null;
  posY: number | null;
}

export interface PartidaDetalle extends PartidaResumen {
  esMaster: boolean;
  personajes: PersonajeEnPartidaResumen[];
}
