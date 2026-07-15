import {
  formatearModificador,
  modificadorDeCaracteristica,
} from './character';

describe('modificadorDeCaracteristica', () => {
  // Casos de la tabla oficial de Pathfinder: cada it() es un hecho
  // de las reglas que el código debe cumplir siempre.
  it('devuelve 0 para la puntuación media (10 y 11)', () => {
    expect(modificadorDeCaracteristica(10)).toBe(0);
    expect(modificadorDeCaracteristica(11)).toBe(0);
  });

  it('devuelve modificadores positivos por cada 2 puntos sobre 10', () => {
    expect(modificadorDeCaracteristica(12)).toBe(1);
    expect(modificadorDeCaracteristica(14)).toBe(2);
    expect(modificadorDeCaracteristica(18)).toBe(4);
    expect(modificadorDeCaracteristica(20)).toBe(5);
  });

  it('devuelve modificadores negativos por debajo de 10', () => {
    expect(modificadorDeCaracteristica(9)).toBe(-1);
    expect(modificadorDeCaracteristica(8)).toBe(-1);
    expect(modificadorDeCaracteristica(7)).toBe(-2);
  });

  it('redondea hacia abajo también con negativos (el caso traicionero)', () => {
    // (1 - 10) / 2 = -4.5 → el modificador correcto es -5, no -4.
    // Math.trunc o un redondeo ingenuo fallarían aquí.
    expect(modificadorDeCaracteristica(1)).toBe(-5);
    expect(modificadorDeCaracteristica(3)).toBe(-4);
  });
});

describe('formatearModificador', () => {
  it('antepone + a los modificadores positivos y al cero', () => {
    expect(formatearModificador(18)).toBe('+4');
    expect(formatearModificador(10)).toBe('+0');
  });

  it('muestra los negativos con su signo', () => {
    expect(formatearModificador(9)).toBe('-1');
  });

  it('muestra un guión cuando no hay puntuación', () => {
    expect(formatearModificador(null)).toBe('—');
    expect(formatearModificador(undefined)).toBe('—');
  });
});
