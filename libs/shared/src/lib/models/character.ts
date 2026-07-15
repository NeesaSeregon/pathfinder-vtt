/**
 * Valores posibles del alineamiento. `as const` convierte el array en una
 * tupla de literales: sirve a la vez como lista para el desplegable del
 * front y como tipo (Alineamiento) que impide valores fuera de la lista.
 */
export const ALINEAMIENTOS = [
  'bueno',
  'malo',
  'legal bueno',
  'legal malo',
  'caótico',
  'neutral',
] as const;

export type Alineamiento = (typeof ALINEAMIENTOS)[number];

export const ATRIBUTOS = [
  'fuerza',
  'destreza',
  'constitucion',
  'inteligencia',
  'sabiduria',
  'carisma',
] as const;

export type Atributo = (typeof ATRIBUTOS)[number];

export const ATRIBUTO_LABELS: Record<Atributo, string> = {
  fuerza: 'Fuerza',
  destreza: 'Destreza',
  constitucion: 'Constitución',
  inteligencia: 'Inteligencia',
  sabiduria: 'Sabiduría',
  carisma: 'Carisma',
};

/**
 * De cada atributo solo se GUARDAN la puntuación y el ajuste temporal.
 * Los modificadores no se almacenan: se derivan con
 * modificadorDeCaracteristica(). Guardar datos derivados invita a que se
 * desincronicen del dato original.
 */
export interface AtributoValor {
  puntuacion?: number;
  ajusteTemporal?: number;
}

export type CharacterAtributos = Partial<Record<Atributo, AtributoValor>>;

/**
 * Regla de Pathfinder: modificador = (puntuación − 10) / 2, redondeando
 * hacia abajo. Vive en la lib compartida para que front y back apliquen
 * siempre la misma fórmula.
 */
export function modificadorDeCaracteristica(puntuacion: number): number {
  return Math.floor((puntuacion - 10) / 2);
}

/** Formatea un número con su signo, al estilo de la ficha: +2, -1, +0. */
export function conSigno(valor: number): string {
  return valor >= 0 ? `+${valor}` : `${valor}`;
}

/** Formatea un modificador al estilo de la ficha: +2, −1, o — si no hay dato. */
export function formatearModificador(
  puntuacion: number | null | undefined,
): string {
  if (puntuacion === null || puntuacion === undefined) {
    return '—';
  }
  return conSigno(modificadorDeCaracteristica(puntuacion));
}

/**
 * Casillas de combate que se rellenan a mano en la ficha. Los totales
 * (CA, iniciativa) NO se guardan: se derivan con las funciones de abajo.
 */
export interface CombateValores {
  bonifArmadura?: number;
  bonifEscudo?: number;
  modTamano?: number;
  armaduraNatural?: number;
  modDesvio?: number;
  /** Bonif. de esquiva separado del vario: se pierde al quedar desprevenido. */
  modEsquiva?: number;
  modVarioCa?: number;
  modVarioIniciativa?: number;
  /** Caja "Modificadores" de la ficha: anota el origen de cada bonif. */
  notas?: string;
}

/**
 * Modificador efectivo de un atributo: si hay ajuste temporal, este
 * REEMPLAZA a la puntuación (regla de Pathfinder). Sin datos cuenta como 0.
 */
export function modificadorDeAtributo(
  sheet: CharacterSheetData,
  atributo: Atributo,
): number {
  const valor = sheet.atributos?.[atributo];
  const puntuacion = valor?.ajusteTemporal ?? valor?.puntuacion;
  return puntuacion === undefined ? 0 : modificadorDeCaracteristica(puntuacion);
}

/**
 * CA = 10 + bonif. armadura + bonif. escudo + mod. Destreza + mod. tamaño
 *      + armadura natural + mod. desvío + mod. vario
 */
export function claseDeArmadura(sheet: CharacterSheetData): number {
  const combate = sheet.combate ?? {};
  return (
    10 +
    (combate.bonifArmadura ?? 0) +
    (combate.bonifEscudo ?? 0) +
    modificadorDeAtributo(sheet, 'destreza') +
    (combate.modTamano ?? 0) +
    (combate.armaduraNatural ?? 0) +
    (combate.modDesvio ?? 0) +
    (combate.modEsquiva ?? 0) +
    (combate.modVarioCa ?? 0)
  );
}

/**
 * CA de toque: el ataque solo necesita tocarte (rayos, conjuros de toque,
 * criaturas incorpóreas), así que IGNORA armadura, escudo y armadura
 * natural. Conserva Destreza, tamaño, desvío, esquiva y varios.
 */
export function caDeToque(sheet: CharacterSheetData): number {
  const combate = sheet.combate ?? {};
  return (
    10 +
    modificadorDeAtributo(sheet, 'destreza') +
    (combate.modTamano ?? 0) +
    (combate.modDesvio ?? 0) +
    (combate.modEsquiva ?? 0) +
    (combate.modVarioCa ?? 0)
  );
}

/**
 * CA desprevenido: aún no has actuado en el combate (o te niegan la
 * Destreza), así que PIERDES el mod. de Destreza positivo y la esquiva.
 * Un mod. de Destreza NEGATIVO se conserva: estar desprevenido no te
 * vuelve más ágil (de ahí el Math.min).
 */
export function caDesprevenido(sheet: CharacterSheetData): number {
  const combate = sheet.combate ?? {};
  return (
    10 +
    (combate.bonifArmadura ?? 0) +
    (combate.bonifEscudo ?? 0) +
    Math.min(modificadorDeAtributo(sheet, 'destreza'), 0) +
    (combate.modTamano ?? 0) +
    (combate.armaduraNatural ?? 0) +
    (combate.modDesvio ?? 0) +
    (combate.modVarioCa ?? 0)
  );
}

/** Iniciativa = mod. Destreza + mod. vario */
export function iniciativa(sheet: CharacterSheetData): number {
  return (
    modificadorDeAtributo(sheet, 'destreza') +
    (sheet.combate?.modVarioIniciativa ?? 0)
  );
}

/**
 * Grados de maniobrabilidad de vuelo (PF1e). Cada uno da un modificador
 * a la habilidad Volar: torpe -8, pobre -4, normal +0, buena +4, perfecta +8.
 */
export const MANIOBRABILIDADES = [
  'torpe',
  'pobre',
  'normal',
  'buena',
  'perfecta',
] as const;

export type Maniobrabilidad = (typeof MANIOBRABILIDADES)[number];

export const MODIFICADOR_MANIOBRABILIDAD: Record<Maniobrabilidad, number> = {
  torpe: -8,
  pobre: -4,
  normal: 0,
  buena: 4,
  perfecta: 8,
};

/**
 * Velocidades en PIES (la unidad nativa del juego); casillas y metros se
 * derivan. "conArmadura" es manual: depende de la armadura equipada (tabla
 * irregular + excepciones raciales), que aún no modelamos.
 * "modTemporales" es texto libre, como la caja de la ficha de papel.
 */
export interface VelocidadValores {
  base?: number;
  conArmadura?: number;
  volar?: number;
  maniobrabilidad?: Maniobrabilidad;
  nadar?: number;
  trepar?: number;
  excavar?: number;
  modTemporales?: string;
}

/**
 * Puntos de golpe. El total es manual (tiradas de dado de golpe + mod. CON
 * por nivel + extras: no hay fórmula posible). La RD (reducción de daño)
 * es texto con la notación del juego: "5/hierro frío", "10/plata", "3/—".
 */
export interface PgValores {
  total?: number;
  rd?: string;
}

/** 1 casilla del tablero = 5 pies. */
export function casillas(pies: number): number {
  return Math.floor(pies / 5);
}

/** Conversión de la edición española: 1 casilla (5 pies) = 1,5 m. */
export function piesAMetros(pies: number): number {
  return pies * 0.3;
}

/**
 * Contenido flexible de la ficha de personaje. Se guarda como JSONB en
 * PostgreSQL, así que añadir campos aquí NO requiere migraciones ni cambios
 * en la API: solo tipado (este fichero) y formulario (front).
 * La firma [key: string] mantiene la puerta abierta a campos aún sin tipar.
 */
export interface CharacterSheetData {
  atributos?: CharacterAtributos;
  combate?: CombateValores;
  velocidad?: VelocidadValores;
  pg?: PgValores;
  jugador?: string;
  clase?: string;
  alineamiento?: Alineamiento;
  paisNatal?: string;
  dios?: string;
  raza?: string;
  tamano?: string;
  edad?: number;
  altura?: string;
  peso?: string;
  cabello?: string;
  ojos?: string;
  [key: string]: unknown;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  sheetData: CharacterSheetData;
}

/**
 * Lo que el cliente envía para crear o guardar un personaje: todo menos
 * los campos que genera el servidor (id, fechas).
 */
export type CharacterUpsert = Pick<Character, 'name' | 'level' | 'sheetData'>;
