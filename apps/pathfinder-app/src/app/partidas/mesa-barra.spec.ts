import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PartidaDetalle } from '@pathfinder/shared';
import { MesaBarra } from './mesa-barra';

function mesa(extra: Partial<PartidaDetalle> = {}): PartidaDetalle {
  return {
    id: 'p1',
    nombre: 'La Cripta',
    master: 'Luis',
    esMaster: true,
    codigo: 'ABC123',
    tieneMapa: false,
    enCombate: false,
    ronda: 0,
    turnoPepId: null,
    personajes: [],
    ...extra,
  } as PartidaDetalle;
}

describe('MesaBarra', () => {
  let fixture: ComponentFixture<MesaBarra>;
  let component: MesaBarra;

  async function montar(partida = mesa(), conectado = true): Promise<void> {
    fixture = TestBed.createComponent(MesaBarra);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('partida', partida);
    fixture.componentRef.setInput('conectado', conectado);
    await fixture.whenStable();
  }

  function abrirMenu(): void {
    fixture.nativeElement.querySelector('.menu > .boton').click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MesaBarra],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar();
    expect(component).toBeTruthy();
  });

  /** El botón de recargar aparece solo cuando hace falta: socket caído. */
  it('canta la conexión y solo ofrece recargar si está rota', async () => {
    await montar();
    expect(fixture.nativeElement.textContent).toContain('En vivo');
    expect(fixture.nativeElement.querySelector('.vivo--roto')).toBeNull();

    await montar(mesa(), false);
    let recargas = 0;
    component.recargar.subscribe(() => recargas++);
    fixture.nativeElement.querySelector('.vivo--roto').click();
    expect(recargas).toBe(1);
  });

  /** El código de invitación es solo del máster: no se enseña en la barra. */
  it('un jugador no ve código, ni Añadir PNJ, ni menú de máster', async () => {
    await montar(mesa({ esMaster: false, codigo: undefined }));

    expect(fixture.nativeElement.querySelector('.codigo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.menu')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Añadir PNJ');
    expect(fixture.nativeElement.textContent).toContain('La Cripta');
  });

  /** Es LA acción de uso continuo del máster: se queda fuera del menú. */
  it('Añadir PNJ está en la barra, no dentro del menú', async () => {
    await montar();
    let abiertos = 0;
    component.anadirPnj.subscribe(() => abiertos++);

    fixture.nativeElement.querySelector('.boton-primario').click();
    expect(abiertos).toBe(1);
    expect(component['menuAbierto']()).toBe(false);
  });

  it('sin mapa no ofrece quitarlo', async () => {
    await montar();
    abrirMenu();
    expect(fixture.nativeElement.textContent).toContain('Subir mapa de fondo');
    expect(fixture.nativeElement.textContent).not.toContain('Quitar el mapa');

    await montar(mesa({ tieneMapa: true }));
    abrirMenu();
    expect(fixture.nativeElement.textContent).toContain('Cambiar mapa de fondo');
    expect(fixture.nativeElement.textContent).toContain('Quitar el mapa');
  });

  it('cada opción del menú lo cierra al usarla', async () => {
    await montar();
    let regenerados = 0;
    component.regenerarCodigo.subscribe(() => regenerados++);
    abrirMenu();

    const opciones = fixture.nativeElement.querySelectorAll('button.menu__opcion');
    opciones[opciones.length - 2].click(); // cambiar el código

    expect(regenerados).toBe(1);
    expect(component['menuAbierto']()).toBe(false);
  });

  /** Cerrando la mesa no se puede volver a pedir: llegaría dos veces. */
  it('mientras se cierra la mesa, la opción está desactivada', async () => {
    await montar();
    fixture.componentRef.setInput('eliminando', true);
    await fixture.whenStable();
    abrirMenu();

    const peligro: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.menu__opcion--peligro',
    );
    expect(peligro.disabled).toBe(true);
  });
});
