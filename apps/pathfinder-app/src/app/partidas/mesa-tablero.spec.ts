import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonajeEnPartidaResumen } from '@pathfinder/shared';
import { MesaTablero, Movimiento } from './mesa-tablero';

function asiento(
  extra: Partial<PersonajeEnPartidaResumen> = {},
): PersonajeEnPartidaResumen {
  return {
    id: 'pep1',
    characterId: 'c1',
    nombre: 'Valeros',
    tipo: 'pj',
    nivel: 3,
    ca: 17,
    caBase: 17,
    casillas: 1,
    condiciones: [],
    iniciativa: null,
    iniciativaMod: 2,
    pgActuales: 20,
    pgTotal: 24,
    estadoVital: 'ileso',
    esMio: true,
    posX: 2,
    posY: 3,
    ...extra,
  } as PersonajeEnPartidaResumen;
}

describe('MesaTablero', () => {
  let fixture: ComponentFixture<MesaTablero>;
  let component: MesaTablero;
  let movimientos: Movimiento[];
  let elegidos: string[];

  async function montar(
    personajes: PersonajeEnPartidaResumen[],
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(MesaTablero);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personajes', personajes);
    for (const [k, v] of Object.entries(extra)) {
      fixture.componentRef.setInput(k, v);
    }
    movimientos = [];
    elegidos = [];
    component.mover.subscribe((m) => movimientos.push(m));
    component.seleccionar.subscribe((p) => elegidos.push(p.id));
    await fixture.whenStable();
  }

  const celda = (x: number, y: number): HTMLButtonElement =>
    fixture.nativeElement.querySelector(
      `.tablero__celda[data-x="${x}"][data-y="${y}"]`,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MesaTablero],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar([asiento()]);
    expect(component).toBeTruthy();
  });

  it('el token se pinta en su casilla, con sus iniciales', async () => {
    await montar([asiento()]);
    expect(celda(2, 3).querySelector('.tablero__token')?.textContent?.trim()).toBe('V');
    expect(celda(0, 0).querySelector('.tablero__token')).toBeNull();
  });

  /**
   * Un Grande ocupa 2×2: el token se pinta SOLO en su casilla origen, pero
   * las otras tres cuentan como ocupadas y no admiten a nadie encima.
   */
  it('la huella de un Grande ocupa cuatro casillas aunque el token sea uno', async () => {
    const ogro = asiento({ id: 'ogro', nombre: 'Ogro', casillas: 2, posX: 5, posY: 5 });
    await montar([ogro]);

    expect(celda(5, 5).querySelector('.tablero__token')).not.toBeNull();
    expect(celda(6, 6).querySelector('.tablero__token')).toBeNull();
    expect(component['ocupanteDe'](6, 6)?.id).toBe('ogro');
  });

  it('pulsar un token lo selecciona en vez de moverlo', async () => {
    await montar([asiento()]);
    celda(2, 3).click();

    expect(elegidos).toEqual(['pep1']);
    expect(movimientos).toEqual([]);
  });

  it('con alguien seleccionado, pulsar una casilla vacía lo lleva allí', async () => {
    await montar([asiento()], { seleccionadoId: 'pep1' });
    celda(7, 8).click();

    expect(movimientos).toEqual([{ pepId: 'pep1', x: 7, y: 8 }]);
  });

  /** Mover es del dueño y del máster; mirar, de cualquiera. */
  it('un jugador no mueve el token de otro', async () => {
    await montar([asiento({ esMio: false })], { seleccionadoId: 'pep1' });
    celda(7, 8).click();

    expect(movimientos).toEqual([]);
    expect(component['hayDestino']()).toBe(false);
  });

  it('el máster mueve a cualquiera', async () => {
    await montar([asiento({ esMio: false })], {
      seleccionadoId: 'pep1',
      esMaster: true,
    });
    celda(7, 8).click();

    expect(movimientos).toEqual([{ pepId: 'pep1', x: 7, y: 8 }]);
  });

  /** Con la regla en la mano no se mueve a nadie sin querer. */
  it('midiendo, pulsar una casilla no coloca a nadie', async () => {
    await montar([asiento()], { seleccionadoId: 'pep1' });
    component['usarHerramienta']('medir');
    await fixture.whenStable();

    celda(7, 8).click();
    expect(movimientos).toEqual([]);
  });

  it('cambiar de herramienta borra lo medido', async () => {
    await montar([asiento()]);
    component['medicion'].set({ x1: 0, y1: 0, x2: 3, y2: 4 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.regla')).not.toBeNull();

    component['usarHerramienta']('seleccionar');
    await fixture.whenStable();
    expect(component['medicion']()).toBeNull();
    expect(fixture.nativeElement.querySelector('.regla')).toBeNull();
  });

  /** La regla 5-10-5 de PF1e: la segunda diagonal cuesta 10 pies. */
  it('la etiqueta de la regla dice casillas y pies', async () => {
    await montar([asiento()]);
    component['medicion'].set({ x1: 0, y1: 0, x2: 2, y2: 2 });
    await fixture.whenStable();

    const etiqueta = fixture.nativeElement.querySelector('.regla__etiqueta');
    expect(etiqueta.textContent).toContain('casillas');
    expect(etiqueta.textContent).toContain('pies');
  });

  // La barra flotaba sobre la esquina con fondo opaco y dejaba las columnas
  // 0-1 intocables (lo cazó el e2e el 2026-08-25). Va EN FILA y encima del
  // marco: fuera de él, no sobre él. Si alguien la devuelve a flotar, esto
  // avisa antes que el e2e.
  it('la barra de herramientas va fuera del marco, no encima', async () => {
    await montar([asiento()]);
    const raiz: HTMLElement = fixture.nativeElement;
    const utiles = raiz.querySelector('.utiles');
    const marco = raiz.querySelector('.tablero-marco');
    expect(utiles).not.toBeNull();
    expect(marco).not.toBeNull();
    // Ni dentro del marco ni dentro del tablero: es hermana, no hija
    expect(utiles?.closest('.tablero-marco')).toBeNull();
    expect(raiz.querySelector('.tablero .utiles')).toBeNull();
    // Y va ANTES, para ocupar su propia fila en vez de taparlo
    const orden = utiles?.compareDocumentPosition(marco as Node) ?? 0;
    expect(orden & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('quien no está colocado espera en el banquillo', async () => {
    await montar([
      asiento({ id: 'a', nombre: 'Amiri', posX: null, posY: null }),
      asiento({ id: 'b', nombre: 'Valeros' }),
    ]);

    const piezas = fixture.nativeElement.querySelectorAll('.banquillo__pieza');
    expect(piezas.length).toBe(1);
    expect(piezas[0].textContent).toContain('Amiri');

    piezas[0].click();
    expect(elegidos).toEqual(['a']);
  });

  it('sin nadie en el banquillo la bandeja no ocupa sitio', async () => {
    await montar([asiento()]);
    expect(fixture.nativeElement.querySelector('.banquillo')).toBeNull();
  });

  it('soltar un token arrastrado lo mueve a esa casilla', async () => {
    await montar([asiento()]);
    component['arrastrando'].set('pep1');

    const evento = new Event('drop') as DragEvent;
    component['soltarEn'](evento, 9, 9);

    expect(movimientos).toEqual([{ pepId: 'pep1', x: 9, y: 9 }]);
    expect(component['arrastrando']()).toBeNull();
  });
});
