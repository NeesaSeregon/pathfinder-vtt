import {
  caDeToque,
  caDesprevenido,
  casillas,
  claseDeArmadura,
  formatearModificador,
  iniciativa,
  MODIFICADOR_MANIOBRABILIDAD,
  modificadorDeCaracteristica,
  piesAMetros,
  puntuacionEfectiva,
  tiradaDeSalvacion,
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

  it('el ajuste temporal de Destreza se SUMA a la puntuación', () => {
    // Des 14 con ajuste -6 (p. ej. veneno) → efectiva 8 → mod -1 → CA 9
    expect(
      claseDeArmadura({
        atributos: { destreza: { puntuacion: 14, ajusteTemporal: -6 } },
      }),
    ).toBe(9);
  });
});

describe('puntuacionEfectiva', () => {
  it('suma el ajuste temporal a la puntuación (fuerza de toro: +4)', () => {
    expect(puntuacionEfectiva({ puntuacion: 14, ajusteTemporal: 4 })).toBe(18);
  });

  it('los ajustes negativos restan (veneno, fatiga)', () => {
    expect(puntuacionEfectiva({ puntuacion: 14, ajusteTemporal: -6 })).toBe(8);
  });

  it('sin ajuste, la efectiva es la puntuación tal cual', () => {
    expect(puntuacionEfectiva({ puntuacion: 14 })).toBe(14);
  });

  it('solo con ajuste, se aplica sobre la media (10)', () => {
    expect(puntuacionEfectiva({ ajusteTemporal: 4 })).toBe(14);
  });

  it('sin ningún dato devuelve undefined', () => {
    expect(puntuacionEfectiva(undefined)).toBeUndefined();
    expect(puntuacionEfectiva({})).toBeUndefined();
  });
});

describe('caDeToque', () => {
  it('ignora armadura, escudo y armadura natural', () => {
    // CA total sería 22; el toque solo conserva Des (+2)
    expect(
      caDeToque({
        atributos: { destreza: { puntuacion: 14 } },
        combate: { bonifArmadura: 5, bonifEscudo: 2, armaduraNatural: 3 },
      }),
    ).toBe(12);
  });

  it('conserva desvío, esquiva, tamaño y varios', () => {
    expect(
      caDeToque({
        combate: { modDesvio: 2, modEsquiva: 1, modTamano: 1, modVarioCa: 1 },
      }),
    ).toBe(15);
  });
});

describe('caDesprevenido', () => {
  it('pierde el mod. de Destreza positivo y la esquiva', () => {
    // Total: 10+5+2+1 = 18 → desprevenido: 10+5 = 15
    expect(
      caDesprevenido({
        atributos: { destreza: { puntuacion: 14 } },
        combate: { bonifArmadura: 5, modEsquiva: 1 },
      }),
    ).toBe(15);
  });

  it('conserva el mod. de Destreza NEGATIVO (no te vuelve más ágil)', () => {
    // Des 7 (-2): desprevenido = 10 + 5 - 2 = 13
    expect(
      caDesprevenido({
        atributos: { destreza: { puntuacion: 7 } },
        combate: { bonifArmadura: 5 },
      }),
    ).toBe(13);
  });

  it('conserva armadura, escudo y armadura natural', () => {
    expect(
      caDesprevenido({
        combate: { bonifArmadura: 5, bonifEscudo: 2, armaduraNatural: 3 },
      }),
    ).toBe(20);
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

describe('tiradaDeSalvacion', () => {
  it('es 0 para una ficha sin datos', () => {
    expect(tiradaDeSalvacion({}, 'fortaleza')).toBe(0);
  });

  it('cada salvación usa el modificador de SU atributo', () => {
    const sheet = {
      atributos: {
        constitucion: { puntuacion: 14 }, // +2
        destreza: { puntuacion: 8 }, // -1
        sabiduria: { puntuacion: 12 }, // +1
      },
    };
    expect(tiradaDeSalvacion(sheet, 'fortaleza')).toBe(2);
    expect(tiradaDeSalvacion(sheet, 'reflejos')).toBe(-1);
    expect(tiradaDeSalvacion(sheet, 'voluntad')).toBe(1);
  });

  it('suma base, mágico, vario y temporal', () => {
    // 4 (base) + 2 (CON 14) + 1 (capa) + 1 (dote) + 1 (bendecir) = 9
    expect(
      tiradaDeSalvacion(
        {
          atributos: { constitucion: { puntuacion: 14 } },
          salvaciones: {
            fortaleza: { base: 4, modMagico: 1, modVario: 1, modTemporal: 1 },
          },
        },
        'fortaleza',
      ),
    ).toBe(9);
  });

  it('el ajuste temporal del atributo se propaga a la salvación', () => {
    // CON 14 envenenada con -6 → efectiva 8 → mod -1 → Fort: 4 - 1 = 3
    expect(
      tiradaDeSalvacion(
        {
          atributos: { constitucion: { puntuacion: 14, ajusteTemporal: -6 } },
          salvaciones: { fortaleza: { base: 4 } },
        },
        'fortaleza',
      ),
    ).toBe(3);
  });
});

describe('velocidad', () => {
  it('convierte pies a casillas (1 casilla = 5 pies)', () => {
    expect(casillas(30)).toBe(6); // humano
    expect(casillas(20)).toBe(4); // enano
    expect(casillas(15)).toBe(3); // con armadura pesada sobre base 20
  });

  it('convierte pies a metros (1 casilla = 1,5 m, edición española)', () => {
    expect(piesAMetros(30)).toBe(9);
    expect(piesAMetros(20)).toBe(6);
  });

  it('la maniobrabilidad da su modificador a la habilidad Volar', () => {
    expect(MODIFICADOR_MANIOBRABILIDAD.torpe).toBe(-8);
    expect(MODIFICADOR_MANIOBRABILIDAD.normal).toBe(0);
    expect(MODIFICADOR_MANIOBRABILIDAD.perfecta).toBe(8);
  });
});
