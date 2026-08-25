import { Terreno, ZonaTablero } from '@pathfinder/shared';

/**
 * Cómo se PINTA una zona. Funciones puras, sin Angular, como mesa-visual:
 * son decisiones de dibujo y se prueban solas.
 */

/**
 * Una zona estrecha no lleva rótulo. El nombre sigue estando en el title y
 * en la lista de zonas, que es donde se busca.
 *
 * El corte es por ANCHO y solo por ancho: es la dimensión que gasta el
 * texto. El alto nunca fue el límite — la chapa del rótulo mide bastante
 * menos que una casilla, así que un pasillo de una sola fila sí lo lleva.
 *
 * Tres y no dos: con dos casillas (~86px) la chapa recorta hasta dejar
 * "P…", que informa menos que no poner nada. Con tres cabe una palabra.
 */
export const ZONA_ANCHO_MINIMO_ROTULO = 3;

export function llevaRotulo(zona: ZonaTablero): boolean {
  return (
    zona.nombre.trim().length > 0 &&
    zona.ancho >= ZONA_ANCHO_MINIMO_ROTULO
  );
}

/**
 * La zona se coloca en la MISMA rejilla CSS que las casillas, con
 * grid-column/grid-row. Así no hay que convertir casillas a píxeles ni
 * acertar con el hueco de 2px entre casillas: encaja sola, y sigue
 * encajando si un día cambia el tamaño del tablero.
 */
export function areaEnRejilla(zona: {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}): string {
  // grid-area: fila / columna / fin-fila / fin-columna (base 1, fin exclusivo)
  return `${zona.y + 1} / ${zona.x + 1} / ${zona.y + zona.alto + 1} / ${
    zona.x + zona.ancho + 1
  }`;
}

/**
 * La clase del terreno, que trae el color y la trama. "ninguno" no devuelve
 * clase: no hay regla que aplicar, y una clase sin regla en la plantilla es
 * justo lo que luego nadie sabe si sirve para algo.
 */
export function claseTerreno(terreno: Terreno): string {
  return terreno === 'ninguno' ? '' : `zona--${terreno}`;
}

/** Lo que se lee al posar el ratón: el nombre y, si lo hay, el terreno. */
export function tituloZona(
  zona: ZonaTablero,
  etiquetas: Record<Terreno, string>,
): string {
  const nombre = zona.nombre.trim() || 'Zona sin nombre';
  return zona.terreno === 'ninguno'
    ? nombre
    : `${nombre} · ${etiquetas[zona.terreno]}`;
}
