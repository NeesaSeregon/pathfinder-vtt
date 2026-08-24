import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Character, SembrarPnj } from '@pathfinder/shared';
import { PnjModal } from './pnj-modal';

/** Plantilla mínima del bestiario: la modal solo pinta nombre y nivel. */
function plantilla(id: string, name: string): Character {
  return { id, name, level: 1 } as Character;
}

describe('PnjModal', () => {
  let fixture: ComponentFixture<PnjModal>;
  let component: PnjModal;
  let sembrado: SembrarPnj | undefined;

  beforeEach(async () => {
    sembrado = undefined;
    await TestBed.configureTestingModule({
      imports: [PnjModal],
    }).compileComponents();
    fixture = TestBed.createComponent(PnjModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('bestiario', []);
    component.sembrar.subscribe((datos) => (sembrado = datos));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * El bestiario llega DESPUÉS de abrirse la modal (es una petición aparte),
   * así que la pestaña tiene que recolocarse cuando aterriza la lista. Sin
   * esto, el máster con monstruos guardados abriría siempre en el formulario.
   */
  it('abre en el formulario sin bestiario y salta a la lista cuando llega', async () => {
    expect(component['modo']()).toBe('nuevo');

    fixture.componentRef.setInput('bestiario', [plantilla('1', 'Goblin')]);
    await fixture.whenStable();

    expect(component['modo']()).toBe('bestiario');
    expect(fixture.nativeElement.textContent).toContain('Goblin');
  });

  it('el clic del usuario en una pestaña manda sobre lo que ya se eligió solo', async () => {
    fixture.componentRef.setInput('bestiario', [plantilla('1', 'Goblin')]);
    await fixture.whenStable();

    component['modo'].set('nuevo');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('app-pnj-form')).toBeTruthy();
  });

  it('siembra la plantilla con las opciones de arriba, no con las de la ficha', async () => {
    fixture.componentRef.setInput('bestiario', [plantilla('g1', 'Goblin')]);
    await fixture.whenStable();

    component['cantidad'].set(4);
    component['actitud'].set('aliado');
    component['oculto'].set(true);
    await fixture.whenStable();

    fixture.nativeElement
      .querySelector('.siembra__lista button')
      .click();

    expect(sembrado).toEqual({
      plantillaId: 'g1',
      cantidad: 4,
      actitud: 'aliado',
      oculto: true,
    });
  });

  it('con el bestiario vacío invita a crear uno en la otra pestaña', () => {
    expect(fixture.nativeElement.textContent).toContain('Del bestiario (0)');
  });

  it('cierra al pulsar el fondo, no al pulsar dentro del diálogo', async () => {
    let cerrado = 0;
    component.cerrar.subscribe(() => cerrado++);

    fixture.nativeElement.querySelector('.modal').click();
    expect(cerrado).toBe(0);

    fixture.nativeElement.querySelector('.overlay').click();
    expect(cerrado).toBe(1);
  });
});
