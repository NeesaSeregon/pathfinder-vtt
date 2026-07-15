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
  modVarioCa?: number;
  modVarioIniciativa?: number;
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
 * Contenido flexible de la ficha de personaje. Se guarda como JSONB en
 * PostgreSQL, así que añadir campos aquí NO requiere migraciones ni cambios
 * en la API: solo tipado (este fichero) y formulario (front).
 * La firma [key: string] mantiene la puerta abierta a campos aún sin tipar.
 */
export interface CharacterSheetData {
  atributos?: CharacterAtributos;
  combate?: CombateValores;
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
