import { describe, expect, it } from 'vitest';
import { TERRENO_LABELS, ZonaTablero } from '@pathfinder/shared';
import {
  areaEnRejilla,
  claseTerreno,
  llevaRotulo,
  tituloZona,
} from './mesa-zonas';

function zona(extra: Partial<ZonaTablero> = {}): ZonaTablero {
  return {
    id: 'z1',
    nombre: 'Sala del trono',
    terreno: 'ninguno',
    visible: true,
    x: 2,
    y: 3,
    ancho: 6,
    alto: 5,
    ...extra,
  };
}

describe('llevaRotulo', () => {
  it('una sala normal lo lleva', () => {
    expect(llevaRotulo(zona())).toBe(true);
  });

  it('un pasillo de 1 casilla de ancho NO lo lleva', () => {
    expect(llevaRotulo(zona({ ancho: 1, alto: 8 }))).toBe(false);
    expect(llevaRotulo(zona({ ancho: 2, alto: 8 }))).toBe(false);
  });

  it('tampoco una franja de una sola fila', () => {
    expect(llevaRotulo(zona({ ancho: 10, alto: 1 }))).toBe(false);
  });

  it('sin nombre no hay rótulo por grande que sea', () => {
    expect(llevaRotulo(zona({ nombre: '   ', ancho: 10, alto: 10 }))).toBe(
      false,
    );
  });
});

describe('areaEnRejilla', () => {
  // La rejilla CSS empieza en 1 y el final es exclusivo: la casilla (0,0)
  // de una zona de 1×1 ocupa la línea 1 a la 2.
  it('traduce la esquina de origen a líneas base 1', () => {
    expect(areaEnRejilla(zona({ x: 0, y: 0, ancho: 1, alto: 1 }))).toBe(
      '1 / 1 / 2 / 2',
    );
  });

  it('el fin es exclusivo, no la última casilla', () => {
    expect(areaEnRejilla(zona({ x: 2, y: 3, ancho: 6, alto: 5 }))).toBe(
      '4 / 3 / 9 / 9',
    );
  });
});

describe('tituloZona', () => {
  it('sin terreno marcado, solo el nombre', () => {
    expect(tituloZona(zona(), TERRENO_LABELS)).toBe('Sala del trono');
  });

  it('con terreno, lo dice con palabras (el color no va solo)', () => {
    expect(tituloZona(zona({ terreno: 'dificil' }), TERRENO_LABELS)).toBe(
      'Sala del trono · Terreno difícil',
    );
  });

  it('una zona sin nombre sigue teniendo algo que decir', () => {
    expect(tituloZona(zona({ nombre: '' }), TERRENO_LABELS)).toBe(
      'Zona sin nombre',
    );
  });
});

describe('claseTerreno', () => {
  it('un terreno marcado trae su clase', () => {
    expect(claseTerreno('agua')).toBe('zona--agua');
  });

  // Una clase sin regla detrás es basura en la plantilla: "sin marcar" ya
  // se ve con el aspecto base de la zona.
  it('sin marcar no ensucia el DOM con una clase vacía', () => {
    expect(claseTerreno('ninguno')).toBe('');
  });
});
