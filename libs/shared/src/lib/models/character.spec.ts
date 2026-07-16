import {
  ALINEAMIENTOS,
  bmc,
  bonificadorHabilidad,
  bonificadorRacial,
  puntuacionFinal,
  CLASES,
  RAZAS,
  caDeToque,
  caDesprevenido,
  capacidadDeCarga,
  cargaActual,
  cdConjuro,
  conjurosAdicionales,
  dmc,
  experienciaFaltante,
  HABILIDADES,
  pesoMonedas,
  pesoTotal,
  totalEnOro,
  totalObjetosCa,
  casillas,
  claseDeArmadura,
  formatearModificador,
  iniciativa,
  MODIFICADOR_MANIOBRABILIDAD,
  modificadorDeCaracteristica,
  modificadorTamano,
  modificadorTamanoManiobras,
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
    // 10 + 5 + 2 + (+2 de Des 14) + (+1 pequeño) + 3 + 1 + 1 = 25
    expect(
      claseDeArmadura({
        tamano: 'pequeno',
        atributos: { destreza: { puntuacion: 14 } },
        combate: {
          bonifArmadura: 5,
          bonifEscudo: 2,
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
        tamano: 'pequeno',
        combate: { modDesvio: 2, modEsquiva: 1, modVarioCa: 1 },
      }),
    ).toBe(15);
  });
});

describe('modificadorTamano', () => {
  it('mediano es 0; los pequeños suman a CA, los grandes restan', () => {
    expect(modificadorTamano({ tamano: 'mediano' })).toBe(0);
    expect(modificadorTamano({ tamano: 'pequeno' })).toBe(1);
    expect(modificadorTamano({ tamano: 'fino' })).toBe(8);
    expect(modificadorTamano({ tamano: 'grande' })).toBe(-1);
    expect(modificadorTamano({ tamano: 'colosal' })).toBe(-8);
  });

  it('sin tamaño (o con un valor antiguo no reconocido) cuenta como 0', () => {
    expect(modificadorTamano({})).toBe(0);
    expect(
      modificadorTamano({ tamano: 'Mediano' as never }),
    ).toBe(0);
  });

  it('el de maniobras es el inverso exacto', () => {
    expect(modificadorTamanoManiobras({ tamano: 'grande' })).toBe(1);
    expect(modificadorTamanoManiobras({ tamano: 'pequeno' })).toBe(-1);
    expect(modificadorTamanoManiobras({ tamano: 'mediano' })).toBe(0);
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

describe('bmc', () => {
  it('es 0 para una ficha sin datos', () => {
    expect(bmc({})).toBe(0);
  });

  it('suma BAB, mod. de Fuerza y mod. de tamaño', () => {
    // 3 (BAB) + 4 (FUE 18) + 1 (tamaño Grande) = +8
    expect(
      bmc({
        tamano: 'grande',
        atributos: { fuerza: { puntuacion: 18 } },
        ofensivo: { ataqueBase: 3 },
      }),
    ).toBe(8);
  });

  it('el tamaño pequeño RESTA (inverso al de la CA)', () => {
    expect(bmc({ tamano: 'pequeno', ofensivo: { ataqueBase: 3 } })).toBe(2);
  });
});

describe('dmc', () => {
  it('es 10 para una ficha sin datos (como la CA)', () => {
    expect(dmc({})).toBe(10);
  });

  it('suma 10 + BAB + Fuerza + Destreza + tamaño', () => {
    // 10 + 3 + 4 (FUE 18) + 2 (DES 14) + 1 (Grande) = 20
    expect(
      dmc({
        tamano: 'grande',
        atributos: {
          fuerza: { puntuacion: 18 },
          destreza: { puntuacion: 14 },
        },
        ofensivo: { ataqueBase: 3 },
      }),
    ).toBe(20);
  });

  it('incluye desvío y esquiva de la CA (regla completa)', () => {
    expect(
      dmc({
        ofensivo: { ataqueBase: 3 },
        combate: { modDesvio: 2, modEsquiva: 1 },
      }),
    ).toBe(16);
  });
});

describe('bonificadorHabilidad', () => {
  it('sin datos, es solo el modificador del atributo asociado', () => {
    // Acrobacias depende de Destreza
    expect(
      bonificadorHabilidad(
        { atributos: { destreza: { puntuacion: 14 } } },
        'acrobacias',
      ),
    ).toBe(2);
  });

  it('suma rangos y modificador vario', () => {
    expect(
      bonificadorHabilidad(
        {
          atributos: { destreza: { puntuacion: 14 } },
          habilidades: { acrobacias: { rangos: 3, modVario: 1 } },
        },
        'acrobacias',
      ),
    ).toBe(6);
  });

  it('habilidad de clase con rangos: +3; sin rangos: nada', () => {
    const conRangos = {
      habilidades: { sigilo: { esClase: true, rangos: 1 } },
    };
    const sinRangos = { habilidades: { sigilo: { esClase: true } } };
    expect(bonificadorHabilidad(conRangos, 'sigilo')).toBe(4); // 1 + 3
    expect(bonificadorHabilidad(sinRangos, 'sigilo')).toBe(0);
  });

  it('Volar incluye el modificador de maniobrabilidad', () => {
    expect(
      bonificadorHabilidad(
        {
          habilidades: { volar: { rangos: 2 } },
          velocidad: { volar: 60, maniobrabilidad: 'buena' },
        },
        'volar',
      ),
    ).toBe(6); // 2 rangos + 4 de maniobrabilidad buena
  });

  it('la lista de la ficha tiene sus 39 huecos', () => {
    expect(HABILIDADES).toHaveLength(39);
    // y los huecos repetidos existen (Artesanía x3, Interpretar x2...)
    expect(HABILIDADES.filter((h) => h.label === 'Artesanía')).toHaveLength(3);
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

describe('capacidadDeCarga', () => {
  it('FUE 10: la fila clásica de la tabla (33/66/100)', () => {
    const capacidad = capacidadDeCarga({
      atributos: { fuerza: { puntuacion: 10 } },
    });
    expect(capacidad).toEqual({
      ligera: 33,
      media: 66,
      pesada: 100,
      levantarCabeza: 100,
      levantarSuelo: 200,
      empujarArrastrar: 500,
    });
  });

  it('FUE 18: 100/200/300', () => {
    const capacidad = capacidadDeCarga({
      atributos: { fuerza: { puntuacion: 18 } },
    });
    expect(capacidad?.pesada).toBe(300);
  });

  it('más allá de FUE 29 se usa la fila de (FUE-10) por 4', () => {
    // FUE 32 → fila de 22 (173/346/520) x4
    const capacidad = capacidadDeCarga({
      atributos: { fuerza: { puntuacion: 32 } },
    });
    expect(capacidad?.pesada).toBe(2080);
  });

  it('el tamaño multiplica: un grande carga el doble', () => {
    const capacidad = capacidadDeCarga({
      tamano: 'grande',
      atributos: { fuerza: { puntuacion: 10 } },
    });
    expect(capacidad?.pesada).toBe(200);
  });

  it('la fuerza de toro también carga más (ajuste temporal)', () => {
    // FUE 14 + 4 → efectiva 18 → pesada 300
    const capacidad = capacidadDeCarga({
      atributos: { fuerza: { puntuacion: 14, ajusteTemporal: 4 } },
    });
    expect(capacidad?.pesada).toBe(300);
  });

  it('sin Fuerza anotada no hay límites que mostrar', () => {
    expect(capacidadDeCarga({})).toBeNull();
  });
});

describe('pesoTotal y cargaActual', () => {
  const sheet = {
    atributos: { fuerza: { puntuacion: 10 } }, // 33/66/100
    equipo: [{ nombre: 'Mochila', peso: 2 }, { nombre: 'Cuerda', peso: 10 }],
    objetosCa: [{ nombre: 'Cota de mallas', bonif: 6, peso: 40 }],
  };

  it('suma el equipo y los objetos CA', () => {
    expect(pesoTotal(sheet)).toBe(52);
  });

  it('clasifica la carga comparando con los límites', () => {
    expect(cargaActual(sheet)).toBe('media'); // 52 > 33 y <= 66
    expect(cargaActual({ atributos: { fuerza: { puntuacion: 10 } } })).toBe(
      'ligera',
    );
    expect(
      cargaActual({
        atributos: { fuerza: { puntuacion: 1 } }, // 3/6/10
        equipo: [{ nombre: 'Yunque', peso: 50 }],
      }),
    ).toBe('sobrecargado');
  });

  it('totalObjetosCa suma bonif, penalizador y peso', () => {
    expect(
      totalObjetosCa({
        objetosCa: [
          { bonif: 6, penalizador: -5, peso: 40 },
          { bonif: 2, penalizador: -1, peso: 15 },
        ],
      }),
    ).toEqual({ bonif: 8, penalizador: -6, peso: 55 });
  });
});

describe('bonificadorRacial y puntuacionFinal', () => {
  it('el elfo suma +2 DES, +2 INT y resta -2 CON', () => {
    const elfo = { raza: 'Elfo' as const };
    expect(bonificadorRacial(elfo, 'destreza')).toBe(2);
    expect(bonificadorRacial(elfo, 'inteligencia')).toBe(2);
    expect(bonificadorRacial(elfo, 'constitucion')).toBe(-2);
    expect(bonificadorRacial(elfo, 'fuerza')).toBe(0);
  });

  it('las razas flexibles aplican +2 solo al atributo elegido', () => {
    const humano = { raza: 'Humano' as const, atributoRacial: 'carisma' as const };
    expect(bonificadorRacial(humano, 'carisma')).toBe(2);
    expect(bonificadorRacial(humano, 'fuerza')).toBe(0);
    // Sin elección hecha, nada
    expect(bonificadorRacial({ raza: 'Semiorco' }, 'fuerza')).toBe(0);
  });

  it('la puntuación final encadena base + racial + ajuste temporal', () => {
    expect(
      puntuacionFinal(
        {
          raza: 'Elfo',
          atributos: { destreza: { puntuacion: 12, ajusteTemporal: 4 } },
        },
        'destreza',
      ),
    ).toBe(18); // 12 + 2 racial + 4
  });

  it('la raza se propaga a toda la ficha: la CA del elfo sube sola', () => {
    const base = { atributos: { destreza: { puntuacion: 14 } } };
    expect(claseDeArmadura(base)).toBe(12); // Des 14 → +2
    expect(claseDeArmadura({ ...base, raza: 'Elfo' })).toBe(13); // 16 → +3
  });
});

describe('listas oficiales del Core', () => {
  it('9 alineamientos, 11 clases, 7 razas', () => {
    expect(ALINEAMIENTOS).toHaveLength(9);
    expect(CLASES).toHaveLength(11);
    expect(RAZAS).toHaveLength(7);
  });

  it('la parrilla de alineamientos incluye el neutral puro', () => {
    expect(ALINEAMIENTOS).toContain('neutral');
    expect(ALINEAMIENTOS).toContain('caótico bueno');
    expect(ALINEAMIENTOS).toContain('neutral malo');
  });
});

describe('conjuros', () => {
  const mago = {
    atributos: { inteligencia: { puntuacion: 18 } }, // +4
    conjuros: { atributoLanzamiento: 'inteligencia' as const },
  };

  it('CD = 10 + nivel del conjuro + mod. de lanzamiento', () => {
    expect(cdConjuro(mago, 0)).toBe(14);
    expect(cdConjuro(mago, 1)).toBe(15);
    expect(cdConjuro(mago, 9)).toBe(23);
    // Sin atributo de lanzamiento elegido, no hay CD que derivar
    expect(cdConjuro({}, 1)).toBeNull();
  });

  it('conjuros adicionales: la tabla del Core como fórmula', () => {
    // INT 18 (+4): +1 adicional en niveles 1 a 4, ninguno en 5+
    expect(conjurosAdicionales(mago, 1)).toBe(1);
    expect(conjurosAdicionales(mago, 4)).toBe(1);
    expect(conjurosAdicionales(mago, 5)).toBe(0);
  });

  it('con un atributo altísimo, más adicionales en los niveles bajos', () => {
    const archimago = {
      atributos: { inteligencia: { puntuacion: 20 } }, // +5
      conjuros: { atributoLanzamiento: 'inteligencia' as const },
    };
    expect(conjurosAdicionales(archimago, 1)).toBe(2);
  });

  it('el nivel 0 nunca da adicionales (el — de la ficha)', () => {
    expect(conjurosAdicionales(mago, 0)).toBeNull();
  });
});

describe('dinero y experiencia', () => {
  it('totalEnOro aplica el cambio de cada moneda', () => {
    // 50 pc = 0,5 po; 30 pp = 3 po; 12 po; 2 ppr = 20 po → 35,5 po
    expect(
      totalEnOro({ dinero: { pc: 50, pp: 30, po: 12, ppr: 2 } }),
    ).toBe(35.5);
    expect(totalEnOro({})).toBe(0);
  });

  it('pesoMonedas: 50 monedas pesan 1 libra', () => {
    expect(pesoMonedas({ dinero: { pc: 100, po: 50 } })).toBe(3);
  });

  it('experienciaFaltante resta actual del umbral', () => {
    expect(
      experienciaFaltante({
        experiencia: { actual: 3400, siguienteNivel: 5000 },
      }),
    ).toBe(1600);
    // Pasado el umbral no debe dar negativo
    expect(
      experienciaFaltante({
        experiencia: { actual: 5200, siguienteNivel: 5000 },
      }),
    ).toBe(0);
    expect(experienciaFaltante({ experiencia: { actual: 3400 } })).toBeNull();
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
