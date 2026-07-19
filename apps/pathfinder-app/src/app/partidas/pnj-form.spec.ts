import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrearPnj } from '@pathfinder/shared';
import { PnjForm } from './pnj-form';

describe('PnjForm', () => {
  let fixture: ComponentFixture<PnjForm>;
  let component: PnjForm;
  let emitido: CrearPnj | undefined;

  beforeEach(async () => {
    emitido = undefined;
    await TestBed.configureTestingModule({ imports: [PnjForm] }).compileComponents();
    fixture = TestBed.createComponent(PnjForm);
    component = fixture.componentInstance;
    component.crear.subscribe((datos) => (emitido = datos));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sin nombre no deja crear nada', async () => {
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    );
    expect(boton.disabled).toBe(true);
  });

  /**
   * La previsualización usa las MISMAS funciones puras que el servidor. Si
   * este test dice 17, la mesa dirá 17: es lo que hace fiable el número que
   * el máster lee antes de crear.
   */
  it('previsualiza la CA del goblin del Bestiario: 10+3+1+2+1 = 17', async () => {
    component['tamano'].set('pequeno');
    component['destreza'].set(15);
    component['bonifArmadura'].set(3);
    component['bonifEscudo'].set(1);
    await fixture.whenStable();

    expect(component['caPrevia']()).toBe(17);
    expect(component['iniciativaPrevia']()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('CA 17');
  });

  it('un Grande se previsualiza ocupando 2×2', async () => {
    component['tamano'].set('grande');
    await fixture.whenStable();

    expect(component['casillasPrevias']()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('2×2');
  });

  it('avisa de los nombres que va a sembrar cuando hay varios', async () => {
    component['nombre'].set('Goblin');
    component['cantidad'].set(4);
    await fixture.whenStable();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Goblin 1');
    expect(texto).toContain('Goblin 4');
  });

  it('emite el bloque completo, con la actitud y el ocultamiento', async () => {
    component['nombre'].set('  Goblin  ');
    component['cantidad'].set(3);
    component['actitud'].set('enemigo');
    component['oculto'].set(true);
    component['pgTotal'].set(6);
    await fixture.whenStable();

    fixture.nativeElement
      .querySelector('button[type="submit"]')
      .click();

    expect(emitido).toEqual(
      expect.objectContaining({
        nombre: 'Goblin', // recortado
        cantidad: 3,
        actitud: 'enemigo',
        oculto: true,
        pgTotal: 6,
      }),
    );
  });
});
