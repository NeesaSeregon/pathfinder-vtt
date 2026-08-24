import type { Tamano, TipoPersonaje } from './character';

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
  /**
   * ¿Ya estás dentro (la diriges o tienes un personaje sentado)? El
   * buscador lo necesita para NO ofrecer "Entrar" en una mesa donde aún no
   * te has sentado: entrar sin asiento devuelve un 404 y era el camino por
   * el que los recién llegados se perdían.
   */
  soyParticipante: boolean;
  /** Solo presente si TÚ eres el máster: es la invitación a compartir. */
  codigo?: string;
}

/**
 * Una de TUS mesas en el escritorio de la home: el resumen de siempre más
 * qué pintas tienes en ella. Se separa de PartidaResumen porque el
 * buscador lista mesas ajenas, donde estos campos no significan nada.
 */
export interface MiPartidaResumen extends PartidaResumen {
  soyMaster: boolean;
  /** Nombres de TUS personajes sentados ahí; vacío si solo la diriges. */
  misPersonajes: string[];
}

/**
 * Actitud de un PNJ en ESTA mesa. Va en el asiento y no en la ficha porque
 * es estado de escena: el mismo bloque de estadísticas puede ser un enemigo
 * hoy y un aliado en otra partida.
 */
export const ACTITUDES = ['enemigo', 'aliado', 'neutral'] as const;
export type ActitudPnj = (typeof ACTITUDES)[number];

export const ACTITUD_LABELS: Record<ActitudPnj, string> = {
  enemigo: 'Enemigo',
  aliado: 'Aliado',
  neutral: 'Neutral',
};

/**
 * Lo que el máster rellena para sembrar PNJ. Las estadísticas van por
 * COMPONENTES (Destreza, armadura, escudo, tamaño) como las da el
 * Bestiario: así la CA y la iniciativa las derivan las mismas funciones
 * puras que para un PJ, sin excepciones.
 */
export interface CrearPnj {
  nombre: string;
  /** Siembra varios de golpe: "Goblin" ×4 → Goblin 1..4, cada uno su token. */
  cantidad: number;
  actitud: ActitudPnj;
  /** Colocado pero invisible para los jugadores hasta que el máster revele. */
  oculto: boolean;
  nivel?: number;
  tamano?: Tamano;
  destreza?: number;
  bonifArmadura?: number;
  bonifEscudo?: number;
  armaduraNatural?: number;
  pgTotal?: number;
  modVarioIniciativa?: number;
}

/**
 * Traer a la mesa copias de un monstruo YA guardado en el bestiario. No
 * lleva estadísticas: se copian de la plantilla, que es justo el sentido
 * de tenerla guardada.
 */
export interface SembrarPnj {
  plantillaId: string;
  cantidad: number;
  actitud: ActitudPnj;
  oculto: boolean;
}

/** Tope por siembra: evita que un cero de más llene la mesa de goblins. */
export const PNJ_MAX_CANTIDAD = 12;

/**
 * Dimensiones del tablero en casillas (1 casilla = 5 pies).
 *
 * 24×30 es la medida de los mapas grandes de PF1e (los flip-mat de 24×30
 * pulgadas a una pulgada por casilla). Hay otros formatos que se montan
 * uniendo trozos, pero con este espacio el máster puede colocar sus piezas
 * por su cuenta y usarlo igual.
 */
export const TABLERO_ANCHO = 24;
export const TABLERO_ALTO = 30;

/**
 * Cómo de tocada está una criatura, sin decir cuántos PG le quedan.
 * Decidido el 2026-08-24: los números exactos de un PNJ son del máster y
 * los jugadores solo ven este tramo.
 */
export const ESTADOS_VITALES = [
  'ileso',
  'herido',
  'malherido',
  'caido',
] as const;

export type EstadoVital = (typeof ESTADOS_VITALES)[number];

export const ESTADO_VITAL_LABELS: Record<EstadoVital, string> = {
  ileso: 'Ileso',
  herido: 'Herido',
  malherido: 'Malherido',
  caido: 'Caído',
};

/** "Malherido" empieza a un cuarto de los PG totales o menos. */
export const UMBRAL_MALHERIDO = 0.25;

/**
 * Deriva el estado vital de unos PG. Pura y compartida, como
 * ordenarIniciativa: el servidor la usa para no mandar números
 * privilegiados y el cliente para pintar lo mismo cuando sí los tiene, así
 * los dos dicen siempre lo mismo.
 *
 * Devuelve null cuando no hay con qué decidir: sin PG actuales, o en pie
 * pero sin un total contra el que comparar (un PNJ improvisado sin pgTotal).
 */
export function estadoVitalDe(
  pgActuales: number | null | undefined,
  pgTotal: number | null | undefined,
): EstadoVital | null {
  if (pgActuales === null || pgActuales === undefined) {
    return null;
  }
  // A 0 o menos está caído aunque no sepamos su total: en PF1e a 0 PG ya no
  // te tienes en pie. Va ANTES del descarte por falta de total.
  if (pgActuales <= 0) {
    return 'caido';
  }
  if (!pgTotal || pgTotal <= 0) {
    return null;
  }
  if (pgActuales >= pgTotal) {
    return 'ileso';
  }
  return pgActuales <= pgTotal * UMBRAL_MALHERIDO ? 'malherido' : 'herido';
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
  /** CA EFECTIVA (ficha + condiciones activas), derivada por el SERVIDOR. */
  ca: number;
  /** CA de la ficha SIN condiciones, para mostrar "(base X)" si difieren. */
  caBase: number;
  /** Penalización de ataque acumulada por las condiciones activas (≤ 0). */
  modAtaque: number;
  /** Penalización de salvaciones acumulada por las condiciones activas (≤ 0). */
  modSalvaciones: number;
  /**
   * PG exactos y daño no letal. OPCIONALES a propósito: de un PNJ solo los
   * recibe el máster. A un jugador le llega estadoVital y nada más, porque
   * saber que al ogro le quedan 3 PG clavados no es información de mesa.
   * El recorte vive en detalle() (ver soloLoPublico en PartidasService);
   * los PJ NO se tocan: la partida comparte su propio estado.
   */
  pgTotal?: number;
  pgActuales?: number | null;
  danoNoLetal?: number;
  /**
   * Cómo de tocado está, SIN números. Va siempre que se pueda derivar, para
   * todos: es lo que pinta el jugador y le ahorra al máster el cálculo.
   */
  estadoVital?: EstadoVital | null;
  /** Condiciones activas como ids del catálogo (ver condiciones.ts). */
  condiciones: string[];
  posX: number | null;
  posY: number | null;
  /** Lado de la huella en el tablero según el tamaño (Grande=2, etc.). */
  casillas: number;
  /** Iniciativa TIRADA en el combate actual (null = aún no ha tirado). */
  iniciativa: number | null;
  /** Modificador de iniciativa de la ficha, derivado por el SERVIDOR. */
  iniciativaMod: number;
  /** ¿El personaje es del usuario que pregunta? (para permitir moverlo) */
  esMio: boolean;
  /** 'pnj' pinta el token por actitud y lo trata como criatura del máster. */
  tipo: TipoPersonaje;
  /** Solo en PNJ: colorea el token (enemigo/aliado/neutral). */
  actitud?: ActitudPnj;
  /**
   * PNJ colocado pero aún invisible para los jugadores. El servidor NO
   * envía estos asientos a quien no es el máster: el filtro está en
   * detalle(), y por eso los cambios de un oculto se notifican con
   * mesa-cambiada (recarga filtrada) y no con el evento de estado.
   */
  oculto: boolean;
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
  /** ¿La mesa tiene mapa de fondo? (se sirve en GET :id/mapa) */
  tieneMapa: boolean;
}

/** Tipos de imagen admitidos para el mapa y su extensión en disco. */
export const MAPA_TIPOS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Tope de tamaño del mapa subido (8 MB). */
export const MAPA_MAX_BYTES = 8 * 1024 * 1024;

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
