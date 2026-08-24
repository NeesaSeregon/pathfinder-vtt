import { describe, expect, it } from 'vitest';
import { estadoVitalDe, ordenarIniciativa } from './partida';

describe('ordenarIniciativa', () => {
  it('ordena por iniciativa descendente', () => {
    const orden = ordenarIniciativa([
      { nombre: 'A', iniciativa: 12, iniciativaMod: 2 },
      { nombre: 'B', iniciativa: 20, iniciativaMod: 0 },
      { nombre: 'C', iniciativa: 15, iniciativaMod: 5 },
    ]);
    expect(orden.map((c) => c.nombre)).toEqual(['B', 'C', 'A']);
  });

  it('en empate gana el mayor modificador de iniciativa (regla PF1e)', () => {
    const orden = ordenarIniciativa([
      { nombre: 'Lento', iniciativa: 18, iniciativaMod: 1 },
      { nombre: 'Rápido', iniciativa: 18, iniciativaMod: 6 },
    ]);
    expect(orden.map((c) => c.nombre)).toEqual(['Rápido', 'Lento']);
  });

  it('quien no ha tirado (null) va al final', () => {
    const orden = ordenarIniciativa([
      { nombre: 'SinTirar', iniciativa: null, iniciativaMod: 9 },
      { nombre: 'Tiro bajo', iniciativa: 3, iniciativaMod: 0 },
    ]);
    expect(orden.map((c) => c.nombre)).toEqual(['Tiro bajo', 'SinTirar']);
  });

  it('no muta el array original', () => {
    const original = [
      { iniciativa: 5, iniciativaMod: 0 },
      { iniciativa: 10, iniciativaMod: 0 },
    ];
    ordenarIniciativa(original);
    expect(original[0].iniciativa).toBe(5);
  });
});

describe('estadoVitalDe', () => {
  it('a tope es ileso', () => {
    expect(estadoVitalDe(31, 31)).toBe('ileso');
  });

  it('por encima del total sigue siendo ileso (PG temporales)', () => {
    expect(estadoVitalDe(35, 31)).toBe('ileso');
  });

  it('entre el cuarto y el total es herido', () => {
    expect(estadoVitalDe(24, 31)).toBe('herido');
  });

  it('en el cuarto justo ya es malherido', () => {
    expect(estadoVitalDe(8, 32)).toBe('malherido');
  });

  it('por debajo del cuarto es malherido', () => {
    expect(estadoVitalDe(6, 29)).toBe('malherido');
  });

  it('a 0 o menos es caido', () => {
    expect(estadoVitalDe(0, 29)).toBe('caido');
    expect(estadoVitalDe(-4, 29)).toBe('caido');
  });

  // Un PNJ improvisado puede no tener pgTotal: en pie no se puede decir
  // cuanto le queda, pero a 0 se sabe igual que esta caido.
  it('sin total, en pie, no se pronuncia', () => {
    expect(estadoVitalDe(12, undefined)).toBeNull();
    expect(estadoVitalDe(12, 0)).toBeNull();
  });

  it('sin total, a 0, sigue siendo caido', () => {
    expect(estadoVitalDe(0, undefined)).toBe('caido');
  });

  it('sin PG actuales no se pronuncia', () => {
    expect(estadoVitalDe(null, 31)).toBeNull();
    expect(estadoVitalDe(undefined, 31)).toBeNull();
  });
});
