import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TiradaResultado } from '@pathfinder/shared';
import { MesaRegistro } from './mesa-registro';

function tirada(id: string, extra: Partial<TiradaResultado> = {}): TiradaResultado {
  return {
    id,
    autor: 'Nirvel',
    notacion: '1d20+5',
    dados: [12],
    total: 17,
    ...extra,
  } as TiradaResultado;
}

describe('MesaRegistro', () => {
  let fixture: ComponentFixture<MesaRegistro>;
  let component: MesaRegistro;
  let pedidas: string[];

  beforeEach(async () => {
    pedidas = [];
    await TestBed.configureTestingModule({
      imports: [MesaRegistro],
    }).compileComponents();
    fixture = TestBed.createComponent(MesaRegistro);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tiradas', []);
    fixture.componentRef.setInput('puedeTirar', true);
    component.tirar.subscribe((n) => pedidas.push(n));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sin tiradas lo dice en vez de dejar el hueco en blanco', () => {
    expect(fixture.nativeElement.textContent).toContain('Aún no se ha tirado nada');
  });

  it('pinta autor, notación y total de cada tirada', async () => {
    fixture.componentRef.setInput('tiradas', [
      tirada('t1', { etiqueta: 'Percepción' }),
    ]);
    await fixture.whenStable();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Nirvel');
    expect(texto).toContain('Percepción');
    expect(texto).toContain('1d20+5');
    expect(texto).toContain('17');
  });

  it('los dados rápidos piden 1dN', () => {
    fixture.nativeElement.querySelectorAll('.dado')[5].click();
    expect(pedidas).toEqual(['1d20']);
  });

  /** Pulsar Tirar con la caja en blanco no es una tirada de nada. */
  it('no pide nada con la tirada libre vacía', () => {
    fixture.nativeElement.querySelector('.lanzador__libre button').click();
    expect(pedidas).toEqual([]);
  });

  it('la tirada libre se envía y deja la caja limpia', async () => {
    const caja: HTMLInputElement = fixture.nativeElement.querySelector(
      '.lanzador__libre input',
    );
    caja.value = '2d6+3';
    fixture.nativeElement.querySelector('.lanzador__libre button').click();

    expect(pedidas).toEqual(['2d6+3']);
    expect(caja.value).toBe('');
  });

  /** Un mirón puede leer el registro, pero no tirar: no tiene con qué. */
  it('quien no está en la mesa no tiene lanzador', async () => {
    fixture.componentRef.setInput('puedeTirar', false);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.lanzador__libre')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Únete a la mesa');
  });

  it('el rótulo explica el hueco cuando no hay nada seleccionado', async () => {
    expect(fixture.nativeElement.textContent).toContain('nada seleccionado');

    fixture.componentRef.setInput('haySeleccion', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).not.toContain('nada seleccionado');
  });
});
