import { describe, expect, it } from 'vitest';
import { lanzarDados } from './tirada';

describe('lanzarDados', () => {
  it('sin cantidad explícita tira un solo dado ("d6" = "1d6")', () => {
    const tirada = lanzarDados('d6', () => 0);
    expect(tirada.dados).toHaveLength(1);
    expect(tirada.notacion).toBe('1d6');
  });

  it('rng=0 da el mínimo de cada dado (un 1 por dado)', () => {
    const tirada = lanzarDados('3d8', () => 0);
    expect(tirada.dados).toEqual([1, 1, 1]);
    expect(tirada.total).toBe(3);
  });

  it('rng≈1 da el máximo de cada dado (las caras)', () => {
    const tirada = lanzarDados('2d20', () => 0.999);
    expect(tirada.dados).toEqual([20, 20]);
    expect(tirada.total).toBe(40);
  });

  it('suma el modificador positivo al total y lo normaliza en la notación', () => {
    const tirada = lanzarDados('2d1+3', () => 0);
    // 2d1 siempre es 1+1=2, +3 → 5
    expect(tirada.total).toBe(5);
    expect(tirada.modificador).toBe(3);
    expect(tirada.notacion).toBe('2d1+3');
  });

  it('acepta modificador negativo', () => {
    const tirada = lanzarDados('2d1-1', () => 0);
    expect(tirada.total).toBe(1); // 1+1-1
    expect(tirada.notacion).toBe('2d1-1');
  });

  it('tolera espacios y mayúsculas', () => {
    const tirada = lanzarDados('  1D20 + 5 ', () => 0.999);
    expect(tirada.total).toBe(25); // 20 + 5
    expect(tirada.notacion).toBe('1d20+5');
  });

  it('rechaza notaciones inválidas', () => {
    expect(() => lanzarDados('hola')).toThrow();
    expect(() => lanzarDados('20')).toThrow();
    expect(() => lanzarDados('d')).toThrow();
    expect(() => lanzarDados('0d6')).toThrow();
  });

  it('rechaza cantidades o caras fuera de los topes de seguridad', () => {
    expect(() => lanzarDados('101d6')).toThrow();
    expect(() => lanzarDados('1d1001')).toThrow();
  });
});
