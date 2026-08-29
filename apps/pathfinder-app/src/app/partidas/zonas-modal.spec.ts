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

  async function montar(
    zonas: ZonaTablero[],
    recienCreada: string | null = null,
  ): Promise<void> {
    fixture = TestBed.createComponent(ZonasModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('zonas', zonas);
    fixture.componentRef.setInput('recienCreada', recienCreada);
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

  describe('la zona recién dibujada', () => {
    // Dibujar y nombrar quedaron encadenados: la página abre esta lista
    // nada más soltar el rectángulo, y la fila nueva tiene que ser
    // reconocible sin buscarla.
    it('viene marcada, y con palabras además del borde', async () => {
      await montar([zona(), zona({ id: 'z2', nombre: '' })], 'z2');

      const filas = fixture.nativeElement.querySelectorAll('.zonas__fila');
      expect(filas[0].classList).not.toContain('zonas__fila--nueva');
      expect(filas[1].classList).toContain('zonas__fila--nueva');
      expect(filas[1].textContent).toContain('recién dibujada');
    });

    it('se lleva el foco para poder escribir el nombre sin más clics', async () => {
      await montar([zona(), zona({ id: 'z2', nombre: '' })], 'z2');

      const nombres =
        fixture.nativeElement.querySelectorAll('input[type="text"]');
      expect(document.activeElement).toBe(nombres[1]);
    });

    // Abrir la lista desde el menú del máster no destaca ninguna.
    it('sin zona nueva no se marca ni se enfoca nada', async () => {
      await montar([zona()]);

      expect(
        fixture.nativeElement.querySelector('.zonas__fila--nueva'),
      ).toBeNull();
      expect(document.activeElement).not.toBe(
        fixture.nativeElement.querySelector('input[type="text"]'),
      );
    });
  });

  // La muestra de color decía el terreno pero no CUÁL de las tres salas era.
  // El tablero no tiene coordenadas a la vista, así que la única respuesta
  // honesta es enseñar el mapa.
  it('cada fila lleva el tablero en miniatura con su zona marcada', async () => {
    await montar([zona(), zona({ id: 'z2', x: 10, y: 20, ancho: 3, alto: 2 })]);

    const mapas = fixture.nativeElement.querySelectorAll('.zonas__mapa');
    expect(mapas).toHaveLength(2);

    // Cada mapa pinta TODAS las zonas (contexto), con la suya destacada.
    const piezas = mapas[1].querySelectorAll('.zonas__pieza');
    expect(piezas).toHaveLength(2);
    expect(piezas[0].classList).toContain('zonas__pieza--otra');
    expect(piezas[1].classList).toContain('zonas__pieza--esta');
  });

  // Se coloca con el MISMO areaEnRejilla() que el tablero de verdad: si la
  // miniatura mintiera sobre dónde está la sala, sería peor que no estar.
  it('la miniatura coloca la zona donde el tablero la pinta', async () => {
    await montar([zona({ x: 10, y: 20, ancho: 3, alto: 2 })]);

    const pieza = fixture.nativeElement.querySelector('.zonas__pieza');
    // areaEnRejilla: fila / columna / fin-fila / fin-columna, base 1
    expect(pieza.style.gridArea).toBe('21 / 11 / 23 / 14');
  });
});
