import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Character, PartidaResumen } from '@pathfinder/shared';
import { UnirsePanel } from './unirse-panel';

const PARTIDAS: PartidaResumen[] = [
  {
    id: 'partida-1',
    nombre: 'La corona carmesí',
    descripcion: '',
    estado: 'preparacion',
    master: 'neesa',
    numPersonajes: 0,
  },
];

const PERSONAJES: Character[] = [
  { id: 'char-1', name: 'Valeros', level: 3, sheetData: {} } as Character,
];

describe('UnirsePanel', () => {
  let component: UnirsePanel;
  let fixture: ComponentFixture<UnirsePanel>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnirsePanel],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnirsePanel);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    // Al crearse SOLO pide tus personajes: las mesas ajenas ya no se listan
    httpMock.expectNone('/api/partidas');
    httpMock.expectOne('/api/characters').flush(PERSONAJES);
    await fixture.whenStable();

    // Para los tests que necesitan resultados, se busca a mano
    component['busqueda'].set('ABC234');
    component['buscar']();
    httpMock
      .expectOne((r) => r.url === '/api/partidas')
      .flush(PARTIDAS);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lista las partidas encontradas y ofrece tus personajes', () => {
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('La corona carmesí');
    expect(texto).toContain('Valeros');
  });

  it('sin personaje elegido no se puede pulsar Unirse', () => {
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.partida__resultados button',
    );
    expect(boton.disabled).toBe(true);
  });

  it('unirse avisa al padre para que refresque lo suyo', async () => {
    let avisos = 0;
    component.unido.subscribe(() => (avisos += 1));
    component['personajeElegido'].set('char-1');
    await fixture.whenStable();

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.partida__resultados button',
    );
    boton.click();

    const peticion = httpMock.expectOne('/api/partidas/partida-1/personajes');
    expect(peticion.request.method).toBe('POST');
    // El código tecleado para buscar viaja también al unirse: es la llave,
    // y no tiene sentido pedírselo al usuario dos veces.
    expect(peticion.request.body).toEqual({
      characterId: 'char-1',
      codigo: 'ABC234',
    });
    peticion.flush({ id: 'pep-1', nombre: 'Valeros' });
    // Tras unirse vuelve a buscar para actualizar el nº de personajes
    // (con el mismo texto, así que la URL lleva ?buscar=)
    httpMock.expectOne((r) => r.url === '/api/partidas').flush(PARTIDAS);
    await fixture.whenStable();

    expect(avisos).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('se ha unido');
  });
});
