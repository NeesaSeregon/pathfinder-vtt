import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { PartidaDetalle } from '@pathfinder/shared';
import { PartidaDetallePage } from './partida-detalle-page';
import { EscuchasDeMesa, PartidaSocket } from './partida-socket';
import { AvisoMesaStore } from './aviso-mesa-store';

const DETALLE: PartidaDetalle = {
  id: 'partida-1',
  nombre: 'La corona carmesí',
  descripcion: '',
  estado: 'preparacion',
  master: 'neesa',
  numPersonajes: 1,
  soyParticipante: true,
  esMaster: true,
  codigo: 'ABC234',
  enCombate: false,
  ronda: 0,
  turnoPepId: null,
  zonas: [],
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
      tipo: 'pj',
      oculto: false,
    },
  ],
};

describe('PartidaDetallePage', () => {
  let component: PartidaDetallePage;
  let fixture: ComponentFixture<PartidaDetallePage>;
  let httpMock: HttpTestingController;
  let navegado: ReturnType<typeof vi.spyOn>;
  let aviso: AvisoMesaStore;
  // Socket falso: capturamos las escuchas para simular eventos a mano
  let escuchas: EscuchasDeMesa | null = null;
  const socketFalso = {
    conectar: (_id: string, e: EscuchasDeMesa) => (escuchas = e),
    desconectar: () => undefined,
    // La barra de la mesa lo pinta ("En vivo"): en los tests, siempre viva
    conectado: () => true,
  };

  beforeEach(async () => {
    escuchas = null;
    await TestBed.configureTestingModule({
      imports: [PartidaDetallePage],
      providers: [
        provideRouter([]),
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
    aviso = TestBed.inject(AvisoMesaStore);
    // Nadie navega de verdad en un test: solo miramos a dónde se iría
    navegado = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    // La página pide el detalle nada más crearse
    httpMock.expectOne('/api/partidas/partida-1').flush(DETALLE);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  // El servidor le recorta a un jugador los PG exactos de un PNJ y le manda
  // solo el tramo. La lista lo pinta, y el panel de Selección tampoco deja
  // teclear un número que no se tiene.
  it('un PNJ sin PG exactos: tramo en la lista y sin campo en el panel', async () => {
    const conOgro: PartidaDetalle = {
      ...DETALLE,
      esMaster: false,
      codigo: undefined,
      personajes: [
        ...DETALLE.personajes,
        {
          id: 'pep-ogro',
          characterId: 'char-ogro',
          nombre: 'Ogro veterano',
          nivel: 5,
          ca: 17,
          caBase: 17,
          modAtaque: 0,
          modSalvaciones: 0,
          // Ni pgActuales ni pgTotal: es justo lo que recorta el servidor
          estadoVital: 'malherido',
          condiciones: [],
          posX: null,
          posY: null,
          casillas: 2,
          iniciativa: null,
          iniciativaMod: 1,
          esMio: false,
          tipo: 'pnj',
          actitud: 'enemigo',
          oculto: false,
        },
      ],
    };
    component['cargar']();
    httpMock.expectOne('/api/partidas/partida-1').flush(conOgro);
    await fixture.whenStable();

    const filas = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('.fila'));
    const filaDe = (nombre: string) =>
      filas().find((f) => f.textContent?.includes(nombre));

    // En la lista, el tramo en lugar de las cifras
    expect(filaDe('Ogro veterano')?.textContent).toContain('Malherido');
    expect(filaDe('Valeros')?.textContent).toContain('31/31');

    // Seleccionarlo (que es CONSULTAR) abre el panel, y ahí no hay campo
    filaDe('Ogro veterano')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.insp').textContent).toContain(
      'los PG exactos son del máster',
    );
    expect(fixture.nativeElement.querySelector('.pg__valor')).toBeNull();

    // El PJ, que sí trae números, conserva su campo (deshabilitado: no es mío)
    filaDe('Valeros')?.click();
    fixture.detectChanges();
    const campo: HTMLInputElement =
      fixture.nativeElement.querySelector('.pg__valor');
    expect(campo).not.toBeNull();
    expect(campo.disabled).toBe(true);
  });

  // Se vio en pantalla: un PNJ creado sin PG totales (el formulario los deja
  // en 0) dejaba la fila MUDA — ni barra, ni cifras, ni tramo — y parecía
  // rota. Y al máster le salía "tú" en cada goblin suyo.
  it('sin PG totales la fila dice el número, y "tú" solo en tu PJ', async () => {
    const mesa: PartidaDetalle = {
      ...DETALLE,
      personajes: [
        { ...DETALLE.personajes[0], esMio: true, pgActuales: 7, pgTotal: 10 },
        {
          ...DETALLE.personajes[0],
          id: 'pep-ketne',
          characterId: 'char-ketne',
          nombre: 'ketne 3',
          tipo: 'pnj',
          actitud: 'enemigo',
          // Creado sin PG totales: el caso que se veía vacío
          pgActuales: 6,
          pgTotal: undefined,
          estadoVital: null,
          esMio: true,
        },
      ],
    };
    component['cargar']();
    httpMock.expectOne('/api/partidas/partida-1').flush(mesa);
    await fixture.whenStable();

    const filas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.fila'),
    );
    const ketne = filas.find((f) => f.textContent?.includes('ketne 3'));
    expect(ketne?.textContent).toContain('6 PG');
    // El PNJ es SUYO, pero "tú" es para tu personaje, no para tus monstruos
    expect(ketne?.textContent).not.toContain('tú');

    const valeros = filas.find((f) => f.textContent?.includes('Valeros'));
    expect(valeros?.textContent).toContain('7/10');
    expect(valeros?.textContent).toContain('tú');
  });

  // La otra queja de la pantalla: el jugador no se veía por ninguna parte.
  it('tu personaje tiene tarjeta fija arriba, con sus PG', async () => {
    const mesa: PartidaDetalle = {
      ...DETALLE,
      esMaster: false,
      codigo: undefined,
      personajes: [
        { ...DETALLE.personajes[0], esMio: true, pgActuales: 7, pgTotal: 10 },
      ],
    };
    component['cargar']();
    httpMock.expectOne('/api/partidas/partida-1').flush(mesa);
    await fixture.whenStable();

    const tarjeta: HTMLElement = fixture.nativeElement.querySelector('.mio');
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.textContent).toContain('Valeros');
    expect(tarjeta.textContent).toContain('/ 10');
    // Y se puede curar o hacer daño desde ahí mismo
    expect(tarjeta.textContent).toContain('Daño');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra la mesa: personaje en el banquillo con su CA derivada', () => {
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('La corona carmesí');
    expect(texto).toContain('ABC234'); // soy el máster: veo el código
    expect(texto).toContain('Valeros'); // en el banquillo (sin posición)

    // La CA ya no va en la fila de la lista, que es compacta a propósito:
    // vive en el panel de Selección, con el resto de lo suyo.
    const fila: HTMLElement = fixture.nativeElement.querySelector('.fila');
    fila.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.insp').textContent).toContain(
      'CA 17',
    );
  });

  it('mover: seleccionar del banquillo + clic en casilla → PATCH de posición', async () => {
    // El máster puede mover cualquier token
    const token: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.banquillo__pieza',
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
      fixture.nativeElement.querySelector('.banquillo'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.tablero .tablero__token'),
    ).toBeTruthy();
  });

  /**
   * El defecto que se veía en producción: al máster le desaparecía el token
   * y a los demás se les actualizaba la mesa, pero el jugador al que habían
   * sacado seguía viendo la sala. Llegaba mesa-cambiada, la recarga daba un
   * 404 (la mesa es privada) y ahí se quedaba, con un error que no podía
   * resolver.
   */
  it('si te sacan el personaje, vuelves al escritorio y se te dice por qué', async () => {
    escuchas?.onMesaCambiada();
    httpMock
      .expectOne('/api/partidas/partida-1')
      .flush({ message: 'Partida no encontrada' }, {
        status: 404,
        statusText: 'Not Found',
      });
    await fixture.whenStable();

    expect(navegado).toHaveBeenCalledWith(['/']);
    expect(aviso.consumir()).toContain('Ya no tienes ningún personaje');
  });

  it('si el máster cierra la mesa, fuera con su propio aviso', async () => {
    escuchas?.onMesaEliminada();
    await fixture.whenStable();

    expect(navegado).toHaveBeenCalledWith(['/']);
    expect(aviso.consumir()).toContain('ha cerrado');
  });

  it('cerrar la mesa: pide confirmación, hace DELETE y te lleva al escritorio', async () => {
    const confirmar = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    // Lo irreversible ya no está suelto en la cabecera: hay que abrir el
    // menú del máster, que además se cierra solo tras cada opción.
    const abrirMenu = () => {
      const menu: HTMLButtonElement =
        fixture.nativeElement.querySelector('.menu > button');
      menu.click();
      fixture.detectChanges();
      return fixture.nativeElement.querySelector(
        '.menu__opcion--peligro',
      ) as HTMLButtonElement;
    };

    // Si dices que no, no se toca nada
    abrirMenu().click();
    httpMock.expectNone('/api/partidas/partida-1');
    fixture.detectChanges();

    abrirMenu().click();
    const peticion = httpMock.expectOne('/api/partidas/partida-1');
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(navegado).toHaveBeenCalledWith(['/']);
    expect(aviso.consumir()).toContain('La corona carmesí');
  });

  it('un evento del socket actualiza la mesa sin petición HTTP', async () => {
    // Simula que OTRO usuario le bajó los PG a Valeros
    escuchas?.onEstadoPersonaje({
      pepId: 'pep-1',
      cambios: { pgActuales: 12 },
    });
    await fixture.whenStable();

    // La fila de la lista se entera sola: 12 de 31
    const fila: HTMLElement = fixture.nativeElement.querySelector('.fila');
    expect(fila.textContent).toContain('12/31');
    // Sin ninguna petición HTTP de por medio: fue push puro
    httpMock.expectNone('/api/partidas/partida-1');
  });
});
