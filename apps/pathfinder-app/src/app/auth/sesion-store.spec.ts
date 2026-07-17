import { TestBed } from '@angular/core/testing';
import { SesionStore } from './sesion-store';

describe('SesionStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('arranca sin sesión y sin inicializar (aún no preguntó a /me)', () => {
    const store = TestBed.inject(SesionStore);
    expect(store.conectado()).toBe(false);
    expect(store.inicializada()).toBe(false);
  });

  it('establecer guarda el username y marca la sesión como inicializada', () => {
    const store = TestBed.inject(SesionStore);
    store.establecer('luis');
    expect(store.username()).toBe('luis');
    expect(store.conectado()).toBe(true);
    expect(store.inicializada()).toBe(true);
  });

  it('limpiar borra el username pero recuerda que ya se preguntó', () => {
    const store = TestBed.inject(SesionStore);
    store.establecer('luis');
    store.limpiar();
    expect(store.conectado()).toBe(false);
    expect(store.inicializada()).toBe(true);
  });
});
