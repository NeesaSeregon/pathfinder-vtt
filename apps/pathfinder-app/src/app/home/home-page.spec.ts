import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HomePage } from './home-page';
import { SesionStore } from '../auth/sesion-store';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let sesion: SesionStore;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    sesion = TestBed.inject(SesionStore);
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sin sesión, la tarjeta de cuenta invita a entrar o registrarse', () => {
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Iniciar sesión');
    expect(texto).toContain('Crear cuenta');
    expect(texto).not.toContain('Cerrar sesión');
  });

  it('con sesión, la tarjeta muestra la cuenta, sus datos y el logout', async () => {
    sesion.establecer('neesa');
    await fixture.whenStable();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('neesa');
    expect(texto).toContain('Mis datos');
    expect(texto).toContain('Cerrar sesión');
    expect(texto).toContain('Borrar mi cuenta');
    // Ya no ofrece entrar: eso era lo que se quedaba fijo antes
    expect(texto).not.toContain('Iniciar sesión');
  });

  it('cerrar sesión llama al servidor y limpia el estado local', async () => {
    sesion.establecer('neesa');
    await fixture.whenStable();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.home__tarjeta-botones button',
    );
    boton.click();

    const peticion = httpMock.expectOne('/api/auth/logout');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(null);
    await fixture.whenStable();

    expect(sesion.conectado()).toBe(false);
  });
});
