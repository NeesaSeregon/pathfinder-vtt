import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonajeEnPartidaResumen } from '@pathfinder/shared';
import { MesaSeleccion } from './mesa-seleccion';

function asiento(
  extra: Partial<PersonajeEnPartidaResumen> = {},
): PersonajeEnPartidaResumen {
  return {
    id: 'pep1',
    characterId: 'c1',
    nombre: 'Nirvel Sombraluna',
    tipo: 'pj',
    nivel: 3,
    ca: 17,
    caBase: 17,
    casillas: 1,
    condiciones: [],
    iniciativa: null,
    iniciativaMod: 2,
    pgActuales: 12,
    pgTotal: 24,
    estadoVital: 'herido',
    esMio: true,
    posX: 3,
    posY: 4,
    ...extra,
  } as PersonajeEnPartidaResumen;
}

describe('MesaSeleccion', () => {
  let fixture: ComponentFixture<MesaSeleccion>;
  let component: MesaSeleccion;

  async function montar(
    pep = asiento(),
    puedeEditar = true,
    esMaster = false,
  ): Promise<void> {
    fixture = TestBed.createComponent(MesaSeleccion);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pep', pep);
    fixture.componentRef.setInput('puedeEditar', puedeEditar);
    fixture.componentRef.setInput('esMaster', esMaster);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MesaSeleccion],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar();
    expect(component).toBeTruthy();
  });

  it('encabeza con nombre, iniciales y las cifras de la ficha', async () => {
    await montar();
    const texto = fixture.nativeElement.textContent;

    expect(texto).toContain('Nirvel Sombraluna');
    expect(fixture.nativeElement.querySelector('.ficha').textContent).toContain('NS');
    expect(texto).toContain('nivel 3');
    expect(texto).toContain('CA 17');
  });

  /**
   * Seleccionar es CONSULTAR: cualquiera abre el panel de cualquiera. Lo que
   * cambia sin permiso es que no hay con qué tocar nada.
   */
  it('sin permiso avisa y no deja tocar los PG ni sacar de la mesa', async () => {
    await montar(asiento({ esMio: false }), false);

    expect(fixture.nativeElement.textContent).toContain('solo consulta');
    expect(fixture.nativeElement.querySelector('.pg__valor').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.pg__acciones')).toBeNull();
    expect(fixture.nativeElement.querySelector('.chips__anadir')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Sacar de la mesa');
  });

  it('el daño y la cura suben con el signo, no con el total ya restado', async () => {
    await montar();
    const emitido: (1 | -1)[] = [];
    component.ajustarPg.subscribe((s) => emitido.push(s));

    const botones = fixture.nativeElement.querySelectorAll('.pg__acciones button');
    botones[0].click(); // Daño
    botones[1].click(); // Curar

    expect(emitido).toEqual([-1, 1]);
  });

  /** El PNJ de un jugador llega SIN pgActuales: ve el tramo, no las cifras. */
  it('sin PG exactos muestra el estado vital y lo explica', async () => {
    await montar(asiento({ pgActuales: undefined, esMio: false }), false);

    expect(fixture.nativeElement.querySelector('.pg__valor')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Herido');
    expect(fixture.nativeElement.textContent).toContain('los PG exactos son del máster');
  });

  it('la condición sale con su chip y su descripción de consulta', async () => {
    await montar(asiento({ condiciones: ['cegado'] }));
    const texto = fixture.nativeElement.textContent;

    expect(texto).toContain('Cegado');
    expect(fixture.nativeElement.querySelector('.condicion')).toBeTruthy();
  });

  it('la lista de añadir no repite las condiciones ya puestas', async () => {
    await montar(asiento({ condiciones: ['cegado'] }));
    const opciones: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('.chips__anadir option'),
    ).map((o) => (o as HTMLOptionElement).value);

    expect(opciones).not.toContain('cegado');
    expect(opciones.length).toBeGreaterThan(1);
  });

  /** Revelar una emboscada es del máster, aunque el PNJ sea "suyo". */
  it('solo el máster puede revelar un PNJ', async () => {
    await montar(asiento({ tipo: 'pnj', oculto: true }), true, false);
    expect(fixture.nativeElement.textContent).not.toContain('Revelar');

    await montar(asiento({ tipo: 'pnj', oculto: true }), true, true);
    expect(fixture.nativeElement.textContent).toContain('Revelar');
  });

  it('el aspa quita la selección', async () => {
    await montar();
    let cerrado = 0;
    component.cerrar.subscribe(() => cerrado++);

    fixture.nativeElement.querySelector('.insp__cerrar').click();
    expect(cerrado).toBe(1);
  });
});
