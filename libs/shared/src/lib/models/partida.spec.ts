import { describe, expect, it } from 'vitest';
import { ordenarIniciativa } from './partida';

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
