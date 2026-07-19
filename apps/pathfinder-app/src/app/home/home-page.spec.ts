import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { MiPartidaResumen } from '@pathfinder/shared';
import { HomePage } from './home-page';
import { SesionStore } from '../auth/sesion-store';

const MIS_MESAS: MiPartidaResumen[] = [
  {
    id: 'partida-1',
    nombre: 'La corona carmesí',
    descripcion: '',
    estado: 'activa',
    master: 'neesa',
    numPersonajes: 4,
    codigo: 'ABC234',
    soyMaster: true,
    misPersonajes: [],
  },
  {
    id: 'partida-2',
    nombre: 'Kingmaker',
    descripcion: '',
    estado: 'preparacion',
    master: 'otro',
    numPersonajes: 2,
    soyMaster: false,
    misPersonajes: ['Valeros'],
  },
];

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let sesion: SesionStore;
  let httpMock: HttpTestingController;

  /** El escritorio solo se pinta con sesión; sus peticiones van detrás. */
  async function entrarComo(username: string): Promise<void> {
    sesion.establecer(username);
    await fixture.whenStable();
    httpMock.expectOne('/api/partidas/mias').flush(MIS_MESAS);
    // El panel de unirse solo pide tus personajes: ya NO lista partidas
    // al crearse (el buscador dejó de ser un catálogo de mesas ajenas).
    httpMock.expectNone('/api/partidas');
    httpMock.expectOne('/api/characters').flush([]);
    await fixture.whenStable();
  }

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

  it('sin sesión enseña la portada y NO molesta a la API', () => {
    // Un visitante anónimo no debe provocar ni una petición (ni el 401
    // correspondiente): las mesas solo se piden habiendo sesión.
    httpMock.expectNone('/api/partidas/mias');

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Iniciar sesión');
    expect(texto).toContain('Crear cuenta');
    expect(texto).not.toContain('Tus mesas');
  });

  it('con sesión enseña tus mesas y tu papel en cada una', async () => {
    await entrarComo('neesa');

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Hola, neesa');
    expect(texto).toContain('Tus mesas');
    // La que diriges: cuenta personajes y enseña el código de invitación
    expect(texto).toContain('La corona carmesí');
    expect(texto).toContain('diriges · 4 personajes');
    expect(texto).toContain('ABC234');
    // En la que juegas: dice con quién te sientas
    expect(texto).toContain('juegas con Valeros');
    // Y ya no queda rastro de la portada
    expect(texto).not.toContain('Iniciar sesión');
  });

  it('si no tienes mesas, lo dice en vez de dejar el hueco vacío', async () => {
    sesion.establecer('neesa');
    await fixture.whenStable();
    httpMock.expectOne('/api/partidas/mias').flush([]);
    httpMock.expectNone('/api/partidas');
    httpMock.expectOne('/api/characters').flush([]);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Todavía no te sientas en ninguna mesa',
    );
  });

  it('unirse a una mesa desde el panel recarga la lista de la izquierda', async () => {
    await entrarComo('neesa');

    // El panel emite (unido) tras sentarse: la home vuelve a pedir /mias
    const panel = fixture.nativeElement.querySelector('app-unirse-panel');
    expect(panel).toBeTruthy();

    component['cargarMesas']();
    httpMock.expectOne('/api/partidas/mias').flush(MIS_MESAS);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Kingmaker');
  });

  it('cerrar sesión llama al servidor y limpia el estado local', async () => {
    await entrarComo('neesa');

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.escritorio__accesos button',
    );
    boton.click();

    const peticion = httpMock.expectOne('/api/auth/logout');
    expect(peticion.request.method).toBe('POST');
    peticion.flush(null);
    await fixture.whenStable();

    expect(sesion.conectado()).toBe(false);
  });
});
