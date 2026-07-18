import { describe, expect, it } from 'vitest';
import { CONDICIONES, CONDICION_IDS, CONDICION_POR_ID } from './condiciones';

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
