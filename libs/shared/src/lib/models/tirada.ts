/**
 * Tiradas de dados de la mesa. La lógica vive aquí (libs/shared) como
 * función pura: el SERVIDOR es quien tira (fuente única de azar y de
 * verdad), pero front y back comparten los tipos y las reglas de parseo.
 */

/** Lo que el cliente envía para pedir una tirada. */
export interface TirarDados {
  /** Notación estándar de rol: "1d20+5", "2d6", "d100", "3d8-2". */
  notacion: string;
  /** Etiqueta opcional para dar contexto ("Ataque", "Reflejos de Neesa"). */
  etiqueta?: string;
}

/** El resultado "pelado" de resolver una notación. */
export interface Tirada {
  /** Notación normalizada ("1d20+5"). */
  notacion: string;
  /** Resultado de cada dado individual, en orden. */
  dados: number[];
  /** Modificador plano sumado al final (puede ser negativo o 0). */
  modificador: number;
  /** Suma de los dados + el modificador. */
  total: number;
}

/** El resultado que viaja a la sala, con quién tiró y cuándo. */
export interface TiradaResultado extends Tirada {
  id: string;
  autor: string;
  etiqueta?: string;
  timestamp: number;
}

// Topes de seguridad: sin ellos "9999999d9999999" tumbaría el servidor.
export const LIMITE_CANTIDAD_DADOS = 100;
export const LIMITE_CARAS_DADO = 1000;

// cantidad (opcional, por defecto 1) · "d" · caras · modificador opcional.
const NOTACION_TIRADA = /^(\d*)d(\d+)([+-]\d+)?$/;

/**
 * Resuelve una notación de dados. El `rng` es inyectable para poder
 * testear resultados deterministas; por defecto usa Math.random.
 * Lanza Error con un mensaje claro si la notación no es válida.
 */
export function lanzarDados(
  notacion: string,
  rng: () => number = Math.random,
): Tirada {
  // Tolerante con espacios y mayúsculas: "2D6 + 3" → "2d6+3".
  const limpia = notacion.toLowerCase().replace(/\s+/g, '');
  const partes = NOTACION_TIRADA.exec(limpia);
  if (!partes) {
    throw new Error(`Notación de tirada no válida: "${notacion}" (ej. 1d20+5)`);
  }

  const cantidad = partes[1] === '' ? 1 : parseInt(partes[1], 10);
  const caras = parseInt(partes[2], 10);
  const modificador = partes[3] ? parseInt(partes[3], 10) : 0;

  if (cantidad < 1 || cantidad > LIMITE_CANTIDAD_DADOS) {
    throw new Error(`Número de dados fuera de rango (1-${LIMITE_CANTIDAD_DADOS})`);
  }
  if (caras < 1 || caras > LIMITE_CARAS_DADO) {
    throw new Error(`Caras del dado fuera de rango (1-${LIMITE_CARAS_DADO})`);
  }

  const dados: number[] = [];
  for (let i = 0; i < cantidad; i++) {
    dados.push(Math.floor(rng() * caras) + 1);
  }
  const total = dados.reduce((suma, dado) => suma + dado, 0) + modificador;

  const signo =
    modificador > 0 ? `+${modificador}` : modificador < 0 ? `${modificador}` : '';
  return { notacion: `${cantidad}d${caras}${signo}`, dados, modificador, total };
}
