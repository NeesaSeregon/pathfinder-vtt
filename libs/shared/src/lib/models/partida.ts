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

/** Pies que mide el lado de una casilla en PF1e. */
export const PIES_POR_CASILLA = 5;

/**
 * Distancia entre dos casillas EN CASILLAS, con la regla de diagonales de
 * PF1e: la primera diagonal cuenta 1 y la segunda 2 (el famoso 5-10-5), que
 * en fórmula cerrada es "el lado largo más la mitad del corto".
 *
 * Pura y compartida para que la regla viva en UN sitio: hoy la usa la
 * herramienta de medir del tablero, y mañana el alcance de movimiento.
 */
export function distanciaEnCasillas(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
}

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
  /**
   * La apariencia de la ficha (sheetData.descripcion), y el único trozo de
   * ficha que se comparte con TODA la mesa: es lo que verías al mirar al
   * personaje, así que esconderlo a los demás jugadores no tendría sentido.
   * La historia NO viaja por aquí ni por ningún otro sitio: sigue siendo
   * del dueño y su máster (CharactersService.leer).
   */
  descripcion?: string;
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
  /**
   * Las zonas dibujadas sobre el tablero. A quien no es el máster el
   * servidor le manda SOLO las visibles: el filtro está en detalle(),
   * igual que con los PNJ ocultos.
   */
  zonas: ZonaTablero[];
}

// -- Zonas del tablero -------------------------------------------------------

/**
 * El estado del terreno de una zona. Es un RECORDATORIO VISUAL y nada más:
 * la aplicación no impide ni encarece ningún movimiento por pisarlo, y no
 * debe empezar a hacerlo. Quien decide qué cuesta cruzar un pantano es el
 * máster en voz alta, como en la mesa de verdad; el tablero solo se encarga
 * de que a nadie se le olvide que ahí hay un pantano.
 */
export const TERRENOS = [
  'ninguno',
  'dificil',
  'agua',
  'oscuridad',
  'peligro',
] as const;
export type Terreno = (typeof TERRENOS)[number];

export const TERRENO_LABELS: Record<Terreno, string> = {
  ninguno: 'Sin marcar',
  dificil: 'Terreno difícil',
  agua: 'Agua',
  oscuridad: 'Oscuridad',
  peligro: 'Peligro',
};

/**
 * Un rectángulo dibujado sobre el tablero: una sala, un pasillo, un charco.
 *
 * Las zonas NO son exclusivas y NO colisionan: una casilla puede estar en
 * varias a la vez y se pintan en orden de lista, así que la última manda.
 * Eso es deliberado — es lo que permite meter una fuente dentro de una sala
 * o dar forma de L a una habitación con dos rectángulos, sin inventar una
 * geometría más complicada que un rectángulo.
 */
export interface ZonaTablero {
  id: string;
  /** Lo que es, en palabras del máster: "Sala del trono", "Pasillo norte". */
  nombre: string;
  terreno: Terreno;
  /** Si es false, el servidor no se la manda a los jugadores. */
  visible: boolean;
  /** Esquina superior izquierda, en casillas. */
  x: number;
  y: number;
  /** Tamaño en casillas (mínimo 1×1). */
  ancho: number;
  alto: number;
}

/** Tope de zonas por mesa: sobra para una mazmorra y acota el jsonb. */
export const ZONAS_MAX = 60;

/** Tope del nombre de una zona (lo que cabe de rótulo sin estorbar). */
export const ZONA_NOMBRE_MAX = 40;

/** ¿Cabe este rectángulo dentro del tablero y mide al menos una casilla? */
export function zonaCabeEnTablero(zona: {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}): boolean {
  return (
    Number.isInteger(zona.x) &&
    Number.isInteger(zona.y) &&
    Number.isInteger(zona.ancho) &&
    Number.isInteger(zona.alto) &&
    zona.ancho >= 1 &&
    zona.alto >= 1 &&
    zona.x >= 0 &&
    zona.y >= 0 &&
    zona.x + zona.ancho <= TABLERO_ANCHO &&
    zona.y + zona.alto <= TABLERO_ALTO
  );
}

/**
 * Normaliza dos esquinas cualesquiera (las de un arrastre, que puede ir en
 * cualquier dirección) al rectángulo que forman, recortado al tablero.
 */
export function rectanguloEntre(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; ancho: number; alto: number } {
  const izq = Math.max(0, Math.min(x1, x2));
  const arr = Math.max(0, Math.min(y1, y2));
  const der = Math.min(TABLERO_ANCHO - 1, Math.max(x1, x2));
  const aba = Math.min(TABLERO_ALTO - 1, Math.max(y1, y2));
  return { x: izq, y: arr, ancho: der - izq + 1, alto: aba - arr + 1 };
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
