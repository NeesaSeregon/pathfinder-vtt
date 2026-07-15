import {
  claseDeArmadura,
  formatearModificador,
  iniciativa,
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

describe('claseDeArmadura', () => {
  it('es 10 para una ficha sin datos (sin armadura, Destreza media)', () => {
    expect(claseDeArmadura({})).toBe(10);
  });

  it('suma todos los bonificadores y el modificador de Destreza', () => {
    // 10 + 5 + 2 + (+2 de Des 14) + 1 + 3 + 1 + 1 = 25
    expect(
      claseDeArmadura({
        atributos: { destreza: { puntuacion: 14 } },
        combate: {
          bonifArmadura: 5,
          bonifEscudo: 2,
          modTamano: 1,
          armaduraNatural: 3,
          modDesvio: 1,
          modVarioCa: 1,
        },
      }),
    ).toBe(25);
  });

  it('los modificadores negativos de Destreza bajan la CA', () => {
    expect(
      claseDeArmadura({ atributos: { destreza: { puntuacion: 7 } } }),
    ).toBe(8);
  });

  it('el ajuste temporal de Destreza reemplaza a la puntuación', () => {
    // Des 14 pero ajustada temporalmente a 8 → mod -1 → CA 9
    expect(
      claseDeArmadura({
        atributos: { destreza: { puntuacion: 14, ajusteTemporal: 8 } },
      }),
    ).toBe(9);
  });
});

describe('iniciativa', () => {
  it('es 0 para una ficha sin datos', () => {
    expect(iniciativa({})).toBe(0);
  });

  it('suma el modificador de Destreza y el modificador vario', () => {
    expect(
      iniciativa({
        atributos: { destreza: { puntuacion: 9 } },
        combate: { modVarioIniciativa: 2 },
      }),
    ).toBe(1);
  });

  it('ignora los modificadores varios de la CA', () => {
    expect(iniciativa({ combate: { modVarioCa: 4 } })).toBe(0);
  });
});
