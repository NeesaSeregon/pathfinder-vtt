import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonajeEnPartidaResumen } from '@pathfinder/shared';
import { MesaPersonas } from './mesa-personas';

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
    esMio: false,
    posX: null,
    posY: null,
    ...extra,
  } as PersonajeEnPartidaResumen;
}

describe('MesaPersonas', () => {
  let fixture: ComponentFixture<MesaPersonas>;
  let component: MesaPersonas;

  async function montar(
    personajes: PersonajeEnPartidaResumen[],
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    fixture = TestBed.createComponent(MesaPersonas);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('personajes', personajes);
    for (const [k, v] of Object.entries(extra)) {
      fixture.componentRef.setInput(k, v);
    }
    await fixture.whenStable();
  }

  const nombresDeFila = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.fila')).map((f) =>
      (f as HTMLElement).querySelector('.fila__nombre')?.textContent?.trim() ?? '',
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MesaPersonas],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar([asiento()]);
    expect(component).toBeTruthy();
  });

  /**
   * La regla de oro: la lista NO se reordena sola bajo el dedo. Fuera de
   * combate son dos grupos estables, cada uno por orden de llegada, y NUNCA
   * alfabético.
   */
  it('fuera de combate agrupa Jugadores y luego PNJ, por orden de llegada', async () => {
    await montar([
      asiento({ id: 'a', nombre: 'Zoltan' }),
      asiento({ id: 'b', nombre: 'Goblin', tipo: 'pnj', actitud: 'enemigo' }),
      asiento({ id: 'c', nombre: 'Amiri' }),
    ]);

    expect(component['grupos']().map((g) => g.titulo)).toEqual([
      'Jugadores',
      'PNJ',
    ]);
    expect(nombresDeFila()).toEqual(['Zoltan', 'Amiri', 'Goblin']);
  });

  /** Los ocultos NO se agrupan aparte: siguen en su sitio, marcados. */
  it('un PNJ oculto se queda en su grupo, con su marca', async () => {
    await montar([
      asiento({ id: 'a', nombre: 'Goblin', tipo: 'pnj', oculto: true }),
      asiento({ id: 'b', nombre: 'Ogro', tipo: 'pnj' }),
    ]);

    expect(nombresDeFila()[0]).toContain('Goblin');
    expect(fixture.nativeElement.querySelector('.marca--oculto')).toBeTruthy();
  });

  it('en combate manda la iniciativa, y los que no han tirado van aparte', async () => {
    await montar(
      [
        asiento({ id: 'a', nombre: 'Valeros', iniciativa: 12 }),
        asiento({ id: 'b', nombre: 'Amiri', iniciativa: null }),
        asiento({ id: 'c', nombre: 'Goblin', tipo: 'pnj', iniciativa: 19 }),
      ],
      { enCombate: true, ronda: 2 },
    );

    expect(nombresDeFila()).toEqual(['Goblin', 'Valeros', 'Amiri']);
    expect(component['grupos']()[1].titulo).toBe('Sin iniciativa');
    expect(fixture.nativeElement.textContent).toContain('Ronda 2');
  });

  /** Al máster esMio le sale true en todos sus PNJ: una tarjeta por goblin no. */
  it('la tarjeta de arriba es solo para TUS PJ, no para tus PNJ', async () => {
    await montar([
      asiento({ id: 'a', nombre: 'Valeros', esMio: true }),
      asiento({ id: 'b', nombre: 'Goblin', tipo: 'pnj', esMio: true }),
    ]);

    const tarjetas = fixture.nativeElement.querySelectorAll('.mio');
    expect(tarjetas.length).toBe(1);
    expect(tarjetas[0].textContent).toContain('Valeros');
  });

  it('el combate solo lo maneja el máster', async () => {
    await montar([asiento()], { esMaster: false });
    expect(fixture.nativeElement.querySelector('.combate__acciones')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sin combate activo');

    await montar([asiento()], { esMaster: true });
    let iniciados = 0;
    component.iniciarCombate.subscribe(() => iniciados++);
    fixture.nativeElement.querySelector('.combate__siguiente').click();
    expect(iniciados).toBe(1);
  });

  it('pulsar una fila la selecciona', async () => {
    await montar([asiento({ id: 'a', nombre: 'Valeros' })]);
    const elegidos: string[] = [];
    component.seleccionar.subscribe((p) => elegidos.push(p.id));

    fixture.nativeElement.querySelector('.fila').click();
    expect(elegidos).toEqual(['a']);
  });

  it('sin nadie sentado lo dice en vez de dejar la lista muda', async () => {
    await montar([]);
    expect(fixture.nativeElement.textContent).toContain('Nadie se ha unido todavía');
  });
});
