import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { PartidaDetalle } from '@pathfinder/shared';
import { PartidaDetallePage } from './partida-detalle-page';
import { EscuchasDeMesa, PartidaSocket } from './partida-socket';

const DETALLE: PartidaDetalle = {
  id: 'partida-1',
  nombre: 'La corona carmesí',
  descripcion: '',
  estado: 'preparacion',
  master: 'neesa',
  numPersonajes: 1,
  esMaster: true,
  codigo: 'ABC234',
  enCombate: false,
  ronda: 0,
  turnoPepId: null,
  tieneMapa: false,
  personajes: [
    {
      id: 'pep-1',
      characterId: 'char-1',
      nombre: 'Valeros',
      nivel: 3,
      ca: 17,
      caBase: 17,
      modAtaque: 0,
      modSalvaciones: 0,
      pgTotal: 31,
      pgActuales: 31,
      danoNoLetal: 0,
      condiciones: [],
      posX: null,
      posY: null,
      casillas: 1,
      iniciativa: null,
      iniciativaMod: 2,
      esMio: false,
    },
  ],
};

describe('PartidaDetallePage', () => {
  let component: PartidaDetallePage;
  let fixture: ComponentFixture<PartidaDetallePage>;
  let httpMock: HttpTestingController;
  // Socket falso: capturamos las escuchas para simular eventos a mano
  let escuchas: EscuchasDeMesa | null = null;
  const socketFalso = {
    conectar: (_id: string, e: EscuchasDeMesa) => (escuchas = e),
    desconectar: () => undefined,
  };

  beforeEach(async () => {
    escuchas = null;
    await TestBed.configureTestingModule({
      imports: [PartidaDetallePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PartidaSocket, useValue: socketFalso },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new Map([['id', 'partida-1']]) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartidaDetallePage);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    // La página pide el detalle nada más crearse
    httpMock.expectOne('/api/partidas/partida-1').flush(DETALLE);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra la mesa: personaje en el banquillo con su CA derivada', () => {
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('La corona carmesí');
    expect(texto).toContain('ABC234'); // soy el máster: veo el código
    expect(texto).toContain('Valeros'); // en el banquillo (sin posición)
    expect(texto).toContain('CA 17');
  });

  it('mover: seleccionar del banquillo + clic en casilla → PATCH de posición', async () => {
    // El máster puede mover cualquier token
    const token: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.tablero__banquillo .tablero__token',
    );
    token.click();
    await fixture.whenStable();

    const primeraCelda: HTMLButtonElement =
      fixture.nativeElement.querySelector('.tablero__celda');
    primeraCelda.click();

    const peticion = httpMock.expectOne(
      '/api/partidas/partida-1/personajes/pep-1',
    );
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ posX: 0, posY: 0 });
    peticion.flush({ ...DETALLE.personajes[0], posX: 0, posY: 0 });
    await fixture.whenStable();

    // El token ya no está en el banquillo: está en el tablero
    expect(
      fixture.nativeElement.querySelector('.mesa__banquillo'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.tablero .tablero__token'),
    ).toBeTruthy();
  });

  it('un evento del socket actualiza la mesa sin petición HTTP', async () => {
    // Simula que OTRO usuario le bajó los PG a Valeros
    escuchas?.onEstadoPersonaje({
      pepId: 'pep-1',
      cambios: { pgActuales: 12 },
    });
    await fixture.whenStable();

    const pgInput: HTMLInputElement =
      fixture.nativeElement.querySelector('.mesa__pg input');
    expect(pgInput.value).toBe('12');
    // Sin ninguna petición HTTP de por medio: fue push puro
    httpMock.expectNone('/api/partidas/partida-1');
  });
});
