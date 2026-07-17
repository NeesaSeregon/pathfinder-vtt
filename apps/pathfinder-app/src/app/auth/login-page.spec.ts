import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LoginPage } from './login-page';
import { SesionStore } from './sesion-store';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let httpMock: HttpTestingController;
  let sesion: SesionStore;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        // El login navega a /personajes al entrar: el router de test
        // necesita conocer esa ruta (vacía nos basta).
        provideRouter([{ path: 'personajes', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionStore);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('un login correcto guarda la sesión', async () => {
    const email: HTMLInputElement =
      fixture.nativeElement.querySelector('input[name="email"]');
    const password: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[name="password"]',
    );
    email.value = 'luis@mesa.es';
    email.dispatchEvent(new Event('input'));
    password.value = 'contraseña-larga';
    password.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('form').requestSubmit();
    // La cookie la pone el servidor; el cuerpo solo trae el username
    httpMock.expectOne('/api/auth/login').flush({ username: 'luis' });
    await fixture.whenStable();

    expect(sesion.username()).toBe('luis');
    expect(sesion.conectado()).toBe(true);
  });
});
