import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ZonaTablero } from '@pathfinder/shared';
import { ZonasModal } from './zonas-modal';

function zona(extra: Partial<ZonaTablero> = {}): ZonaTablero {
  return {
    id: 'z1',
    nombre: 'Sala del trono',
    terreno: 'ninguno',
    visible: true,
    x: 2,
    y: 3,
    ancho: 6,
    alto: 5,
    ...extra,
  };
}

describe('ZonasModal', () => {
  let fixture: ComponentFixture<ZonasModal>;
  let component: ZonasModal;
  let guardadas: ZonaTablero[][];

  async function montar(zonas: ZonaTablero[]): Promise<void> {
    fixture = TestBed.createComponent(ZonasModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('zonas', zonas);
    guardadas = [];
    component.guardar.subscribe((z) => guardadas.push(z));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('lista las zonas con sus medidas', async () => {
    await montar([zona()]);

    const fila = fixture.nativeElement.querySelector('.zonas__fila');
    expect(fila.textContent).toContain('6 × 5 casillas');
    expect(fila.querySelector('input[type="text"]').value).toBe(
      'Sala del trono',
    );
  });

  // Lo de fuera no se toca hasta que se guarda: si el máster se arrepiente,
  // cerrar la modal debe dejar el tablero como estaba.
  it('edita sobre una copia y no toca la entrada', async () => {
    const original = zona();
    await montar([original]);

    component['cambiarNombre']('z1', 'Pasillo norte');

    expect(original.nombre).toBe('Sala del trono');
    expect(component['borrador']()[0].nombre).toBe('Pasillo norte');
  });

  it('sin cambios no deja guardar; con ellos, sí', async () => {
    await montar([zona()]);
    expect(component['hayCambios']()).toBe(false);

    component['cambiarTerreno']('z1', 'dificil');
    expect(component['hayCambios']()).toBe(true);
  });

  it('guarda la lista entera, con el nombre limpio de espacios', async () => {
    await montar([zona()]);
    component['cambiarNombre']('z1', '  Cripta  ');

    component['aceptar']();

    expect(guardadas).toHaveLength(1);
    expect(guardadas[0][0].nombre).toBe('Cripta');
  });

  it('borrar una zona la quita de lo que se va a guardar', async () => {
    await montar([zona(), zona({ id: 'z2', nombre: 'Pozo' })]);

    component['borrar']('z1');
    component['aceptar']();

    expect(guardadas[0].map((z) => z.id)).toEqual(['z2']);
  });

  // Que el jugador no la vea es cosa del SERVIDOR (no se la manda). Aquí
  // solo se marca la intención.
  it('se puede esconder una zona de los jugadores', async () => {
    await montar([zona()]);

    component['alternarVisible']('z1', false);
    component['aceptar']();

    expect(guardadas[0][0].visible).toBe(false);
  });

  it('el nombre no puede pasarse de largo', async () => {
    await montar([zona()]);

    component['cambiarNombre']('z1', 'x'.repeat(80));

    expect(component['borrador']()[0].nombre).toHaveLength(40);
  });
});
