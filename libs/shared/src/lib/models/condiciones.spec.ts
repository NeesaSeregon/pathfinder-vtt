import { describe, expect, it } from 'vitest';
import {
  caConCondiciones,
  CONDICIONES,
  CONDICION_IDS,
  CONDICION_POR_ID,
  efectoDeCondiciones,
} from './condiciones';

describe('catálogo de condiciones', () => {
  it('no tiene ids duplicados', () => {
    const ids = CONDICIONES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada condición tiene nombre y descripción no vacíos', () => {
    for (const condicion of CONDICIONES) {
      expect(condicion.nombre.length).toBeGreaterThan(0);
      expect(condicion.descripcion.length).toBeGreaterThan(0);
    }
  });

  it('los ids son slugs ascii (estables para la BD)', () => {
    for (const id of CONDICION_IDS) {
      expect(id).toMatch(/^[a-z-]+$/);
    }
  });

  it('el índice por id encuentra el efecto correcto', () => {
    // Aturdido = Stunned: penaliza la CA (el ejemplo del máster)
    expect(CONDICION_POR_ID['aturdido'].nombre).toBe('Aturdido');
    expect(CONDICION_POR_ID['aturdido'].descripcion).toContain('CA');
    // Atontado = Dazed: NO penaliza la CA
    expect(CONDICION_POR_ID['atontado'].descripcion).toContain('no sufre');
  });
});

describe('efectoDeCondiciones', () => {
  it('sin condiciones no aplica nada', () => {
    expect(efectoDeCondiciones([])).toEqual({
      ca: 0,
      pierdeDestrezaCA: false,
      ataque: 0,
      salvaciones: 0,
    });
  });

  it('aturdido: −2 CA y pierde la Destreza a la CA', () => {
    const efecto = efectoDeCondiciones(['aturdido']);
    expect(efecto.ca).toBe(-2);
    expect(efecto.pierdeDestrezaCA).toBe(true);
  });

  it('acumula modificadores de varias condiciones', () => {
    // sacudido (−2 ataque/salv) + enredado (−2 ataque)
    const efecto = efectoDeCondiciones(['sacudido', 'enredado']);
    expect(efecto.ataque).toBe(-4);
    expect(efecto.salvaciones).toBe(-2);
  });

  it('ignora ids sin modificador mecánico (solo descriptivos)', () => {
    // "atontado" no altera números
    expect(efectoDeCondiciones(['atontado'])).toEqual({
      ca: 0,
      pierdeDestrezaCA: false,
      ataque: 0,
      salvaciones: 0,
    });
  });
});

describe('caConCondiciones', () => {
  // Guerrero: armadura +6, Destreza 14 (+2) → CA base 18
  const sheet = {
    combate: { bonifArmadura: 6 },
    atributos: { destreza: { puntuacion: 14 } },
  };

  it('sin condiciones devuelve la CA normal', () => {
    expect(caConCondiciones(sheet, [])).toBe(18);
  });

  it('aturdido quita la Destreza (+2) y aplica −2 → 14', () => {
    // 10 + 6 (armadura) + 0 (sin Des) − 2 = 14
    expect(caConCondiciones(sheet, ['aturdido'])).toBe(14);
  });

  it('desprevenido solo quita la Destreza positiva → 16', () => {
    expect(caConCondiciones(sheet, ['desprevenido'])).toBe(16);
  });
});
