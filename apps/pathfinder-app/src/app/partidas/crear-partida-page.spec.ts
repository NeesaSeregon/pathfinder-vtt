import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CrearPartidaPage } from './crear-partida-page';

describe('CrearPartidaPage', () => {
  let component: CrearPartidaPage;
  let fixture: ComponentFixture<CrearPartidaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearPartidaPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearPartidaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('al crear, muestra el código de invitación que devuelve la API', async () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const nombre: HTMLInputElement =
      fixture.nativeElement.querySelector('input[name="nombre"]');
    nombre.value = 'La corona carmesí';
    nombre.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    fixture.nativeElement.querySelector('form').requestSubmit();
    httpMock.expectOne('/api/partidas').flush({
      id: 'p1',
      nombre: 'La corona carmesí',
      descripcion: '',
      estado: 'preparacion',
      master: 'neesa',
      numPersonajes: 0,
      codigo: 'ABC234',
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('ABC234');
  });
});
