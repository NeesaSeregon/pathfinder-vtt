import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CuentaDetalle } from '@pathfinder/shared';
import { CuentaPage } from './cuenta-page';
import { SesionStore } from '../auth/sesion-store';

const CUENTA: CuentaDetalle = {
  username: 'neesa',
  email: 'neesa@example.com',
  creadaEl: '2026-02-14T10:00:00.000Z',
  numPersonajes: 3,
  numPartidasComoMaster: 1,
  numPartidasComoJugador: 2,
};

describe('CuentaPage', () => {
  let component: CuentaPage;
  let fixture: ComponentFixture<CuentaPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuentaPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CuentaPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    // La página pide sus datos nada más crearse
    httpMock.expectOne('/api/cuenta').flush(CUENTA);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra los datos de la cuenta y sus cifras', () => {
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('neesa');
    expect(texto).toContain('neesa@example.com');
    expect(texto).toContain('3');
  });

  it('el borrado está plegado: primero hay que pedirlo', () => {
    expect(
      fixture.nativeElement.querySelector('.cuenta__confirmar'),
    ).toBeNull();
  });

  it('cambiar contraseña: envía actual y nueva, y confirma al volver', async () => {
    component['cambiandoPassword'].set(true);
    component['passwordActual'].set('la-de-ahora');
    component['passwordNueva'].set('la-nueva-larga');
    component['passwordRepetida'].set('la-nueva-larga');
    await fixture.whenStable();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.cuenta__confirmar button[type="submit"]',
    );
    submit.click();

    const peticion = httpMock.expectOne('/api/cuenta/password');
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({
      passwordActual: 'la-de-ahora',
      passwordNueva: 'la-nueva-larga',
    });
    peticion.flush(null);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Contraseña cambiada',
    );
    // Los campos no se quedan con la contraseña escrita
    expect(component['passwordActual']()).toBe('');
  });

  it('cambiar contraseña: si las nuevas no coinciden, ni sale del navegador', async () => {
    component['cambiandoPassword'].set(true);
    component['passwordActual'].set('la-de-ahora');
    component['passwordNueva'].set('la-nueva-larga');
    component['passwordRepetida'].set('me-he-equivocado');
    await fixture.whenStable();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.cuenta__confirmar button[type="submit"]',
    );
    submit.click();
    await fixture.whenStable();

    // Sin petición: lo detecta el front antes de molestar al servidor
    httpMock.expectNone('/api/cuenta/password');
    expect(fixture.nativeElement.textContent).toContain('no coinciden');
  });

  it('confirmar con la contraseña envía el DELETE y cierra la sesión', async () => {
    const sesion = TestBed.inject(SesionStore);
    sesion.establecer('neesa');

    component['confirmando'].set(true);
    component['password'].set('secreta-123');
    await fixture.whenStable();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.cuenta__confirmar button[type="submit"]',
    );
    submit.click();

    const peticion = httpMock.expectOne('/api/cuenta');
    expect(peticion.request.method).toBe('DELETE');
    expect(peticion.request.body).toEqual({ password: 'secreta-123' });
    peticion.flush(null);
    await fixture.whenStable();

    expect(sesion.conectado()).toBe(false);
  });

  it('si la contraseña falla, lo dice y NO cierra la sesión', async () => {
    const sesion = TestBed.inject(SesionStore);
    sesion.establecer('neesa');

    component['confirmando'].set(true);
    component['password'].set('la-que-no-es');
    await fixture.whenStable();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.cuenta__confirmar button[type="submit"]',
    );
    submit.click();

    // 403: el interceptor solo expulsa con 401 (sesión caducada), así que
    // este error llega hasta la página y se puede enseñar
    httpMock.expectOne('/api/cuenta').flush(
      { message: 'La contraseña no es correcta' },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña no es correcta',
    );
    expect(sesion.conectado()).toBe(true);
  });
});
