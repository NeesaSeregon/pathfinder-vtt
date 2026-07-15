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
 *
 * ajusteTemporal es una SUMA/RESTA a la puntuación mientras dura un efecto
 * (fuerza de toro: +4; veneno: -4). El "modif. temporal" de la ficha se
 * deriva de (puntuacion + ajusteTemporal), nunca se guarda.
 */
export interface AtributoValor {
  puntuacion?: number;
  ajusteTemporal?: number;
}

/**
 * Puntuación con el ajuste temporal aplicado. Si no hay ningún dato,
 * undefined; si solo hay ajuste, se aplica sobre la media (10).
 */
export function puntuacionEfectiva(
  valor: AtributoValor | undefined,
): number | undefined {
  if (
    !valor ||
    (valor.puntuacion === undefined && valor.ajusteTemporal === undefined)
  ) {
    return undefined;
  }
  return (valor.puntuacion ?? 10) + (valor.ajusteTemporal ?? 0);
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
 * Categorías de tamaño de PF1e. De la categoría se DERIVAN los dos
 * modificadores de tamaño: el de CA/ataques y el de maniobras (inverso).
 */
export const TAMANOS = [
  'fino',
  'diminuto',
  'menudo',
  'pequeno',
  'mediano',
  'grande',
  'enorme',
  'gargantuesco',
  'colosal',
] as const;

export type Tamano = (typeof TAMANOS)[number];

export const TAMANO_LABELS: Record<Tamano, string> = {
  fino: 'Fino',
  diminuto: 'Diminuto',
  menudo: 'Menudo',
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
  enorme: 'Enorme',
  gargantuesco: 'Gargantuesco',
  colosal: 'Colosal',
};

/** Modificador de tamaño a CA y ataques: pequeño esquiva (+), grande es blanco fácil (-). */
export const MODIFICADOR_TAMANO: Record<Tamano, number> = {
  fino: 8,
  diminuto: 4,
  menudo: 2,
  pequeno: 1,
  mediano: 0,
  grande: -1,
  enorme: -2,
  gargantuesco: -4,
  colosal: -8,
};

export function modificadorTamano(sheet: CharacterSheetData): number {
  const tamano = sheet.tamano;
  return tamano && tamano in MODIFICADOR_TAMANO
    ? MODIFICADOR_TAMANO[tamano]
    : 0;
}

/** Para maniobras (BMC/DMC) el tamaño se INVIERTE: el grande empuja mejor. */
export function modificadorTamanoManiobras(sheet: CharacterSheetData): number {
  // 0 - x en lugar de -x: negar 0 produce -0, que no es idéntico a +0.
  return 0 - modificadorTamano(sheet);
}

/**
 * Casillas de combate que se rellenan a mano en la ficha. Los totales
 * (CA, iniciativa) NO se guardan: se derivan con las funciones de abajo.
 * El modificador de tamaño ya no es casilla: se deriva de sheet.tamano.
 */
export interface CombateValores {
  bonifArmadura?: number;
  bonifEscudo?: number;
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
 * Modificador efectivo de un atributo: el de la puntuación CON el ajuste
 * temporal sumado. Sin datos cuenta como 0.
 */
export function modificadorDeAtributo(
  sheet: CharacterSheetData,
  atributo: Atributo,
): number {
  const efectiva = puntuacionEfectiva(sheet.atributos?.[atributo]);
  return efectiva === undefined ? 0 : modificadorDeCaracteristica(efectiva);
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
    modificadorTamano(sheet) +
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
    modificadorTamano(sheet) +
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
    modificadorTamano(sheet) +
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
 * Bloque ofensivo. El BMC y la DMC no se guardan: se derivan con bmc() y
 * dmc(), usando el modificador de tamaño de maniobras (inverso al de CA)
 * derivado de sheet.tamano.
 */
export interface OfensivoValores {
  ataqueBase?: number;
  resistenciaConjuros?: number;
  notas?: string;
}

/** BMC (bonif. de maniobra de combate) = BAB + mod. Fuerza + mod. tamaño. */
export function bmc(sheet: CharacterSheetData): number {
  const ofensivo = sheet.ofensivo ?? {};
  return (
    (ofensivo.ataqueBase ?? 0) +
    modificadorDeAtributo(sheet, 'fuerza') +
    modificadorTamanoManiobras(sheet)
  );
}

/**
 * DMC (defensa de maniobra de combate) = 10 + BAB + mod. Fuerza +
 * mod. Destreza + mod. tamaño, MÁS los bonificadores de desvío y esquiva
 * de la CA (regla completa que la ficha de papel omite).
 */
export function dmc(sheet: CharacterSheetData): number {
  const ofensivo = sheet.ofensivo ?? {};
  const combate = sheet.combate ?? {};
  return (
    10 +
    (ofensivo.ataqueBase ?? 0) +
    modificadorDeAtributo(sheet, 'fuerza') +
    modificadorDeAtributo(sheet, 'destreza') +
    modificadorTamanoManiobras(sheet) +
    (combate.modDesvio ?? 0) +
    (combate.modEsquiva ?? 0)
  );
}

export const SALVACIONES = ['fortaleza', 'reflejos', 'voluntad'] as const;

export type Salvacion = (typeof SALVACIONES)[number];

/** Atributo del que se alimenta cada tirada de salvación. */
export const SALVACION_ATRIBUTO: Record<Salvacion, Atributo> = {
  fortaleza: 'constitucion',
  reflejos: 'destreza',
  voluntad: 'sabiduria',
};

export const SALVACION_LABELS: Record<Salvacion, string> = {
  fortaleza: 'Fortaleza',
  reflejos: 'Reflejos',
  voluntad: 'Voluntad',
};

/**
 * Casillas manuales de una salvación. El mod. de característica y el total
 * NO se guardan: se derivan con tiradaDeSalvacion().
 */
export interface SalvacionValores {
  base?: number;
  modMagico?: number;
  modVario?: number;
  modTemporal?: number;
}

export interface SalvacionesValores {
  fortaleza?: SalvacionValores;
  reflejos?: SalvacionValores;
  voluntad?: SalvacionValores;
  /** Caja "Modificadores": origen de cada bonificador, texto libre. */
  notas?: string;
}

/**
 * Total = base + mod. del atributo asociado + mágico + vario + temporal.
 * Usa modificadorDeAtributo, así que los ajustes temporales del atributo
 * (veneno a la CON...) se reflejan solos en la salvación.
 */
export function tiradaDeSalvacion(
  sheet: CharacterSheetData,
  salvacion: Salvacion,
): number {
  const valores = sheet.salvaciones?.[salvacion] ?? {};
  return (
    (valores.base ?? 0) +
    modificadorDeAtributo(sheet, SALVACION_ATRIBUTO[salvacion]) +
    (valores.modMagico ?? 0) +
    (valores.modVario ?? 0) +
    (valores.modTemporal ?? 0)
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
  salvaciones?: SalvacionesValores;
  ofensivo?: OfensivoValores;
  jugador?: string;
  clase?: string;
  alineamiento?: Alineamiento;
  paisNatal?: string;
  dios?: string;
  raza?: string;
  tamano?: Tamano;
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
