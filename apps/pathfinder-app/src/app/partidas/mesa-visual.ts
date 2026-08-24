import {
  CONDICION_POR_ID,
  CONDICIONES,
  PersonajeEnPartidaResumen,
} from '@pathfinder/shared';

/**
 * Cómo se PINTA un asiento de la mesa. Son funciones puras y sin estado, y
 * viven aquí porque las tres zonas dibujan a la misma gente: el token del
 * tablero, la fila de la lista y la cabecera del panel de selección tienen
 * que salir con el mismo color y las mismas iniciales o no se reconocen
 * entre sí.
 */

/** Dos letras para el token: iniciales de las dos primeras palabras. */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .map((palabra) => palabra[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Color del token. Los PNJ van por ACTITUD (rojo enemigo, verde aliado,
 * gris neutral) para leer el tablero de un vistazo; los PJ mantienen su
 * color estable por nombre, que es lo que distingue a los jugadores.
 */
export function colorToken(pep: PersonajeEnPartidaResumen): string {
  if (pep.tipo === 'pnj' && pep.actitud) {
    return `var(--actitud-${pep.actitud})`;
  }
  let suma = 0;
  for (let i = 0; i < pep.nombre.length; i++) {
    suma += pep.nombre.charCodeAt(i);
  }
  return `var(--token-${suma % 6})`;
}

/** Lado del token para cubrir su huella, contando los huecos de la rejilla. */
export function ladoToken(pep: PersonajeEnPartidaResumen): string {
  return `calc(${pep.casillas * 100}% + ${(pep.casillas - 1) * 2 - 4}px)`;
}

/** Fracción de PG que queda (0..1), para la barra. Null si no se sabe. */
export function fraccionPg(pep: PersonajeEnPartidaResumen): number | null {
  if (pep.pgActuales === null || pep.pgActuales === undefined || !pep.pgTotal) {
    return null;
  }
  return Math.max(0, Math.min(1, pep.pgActuales / pep.pgTotal));
}

/** A 0 PG se marca, pero NO sale de la iniciativa: sigue en su sitio. */
export function esCaido(pep: PersonajeEnPartidaResumen): boolean {
  return pep.estadoVital === 'caido';
}

export function nombreCondicion(id: string): string {
  return CONDICION_POR_ID[id]?.nombre ?? id;
}

export function descripcionCondicion(id: string): string {
  return CONDICION_POR_ID[id]?.descripcion ?? '';
}

/** Condiciones del catálogo que este personaje aún NO tiene activas. */
export function condicionesDisponibles(pep: PersonajeEnPartidaResumen) {
  return CONDICIONES.filter((c) => !pep.condiciones.includes(c.id));
}
