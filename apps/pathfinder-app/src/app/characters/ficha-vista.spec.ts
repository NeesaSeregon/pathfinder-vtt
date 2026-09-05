import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Character, CharacterSheetData } from '@pathfinder/shared';
import { FichaVista } from './ficha-vista';

function ficha(sheetData: CharacterSheetData = {}, level = 5): Character {
  return {
    id: 'c1',
    name: 'Kaelen Vhorr',
    level,
    tipo: 'pj',
    sheetData,
  };
}

/**
 * Estos tests entran por el DOM y no por los métodos: son todos protected,
 * y lo que hay que defender no es la firma de una función sino que el dato
 * derivado LLEGUE a la pantalla y esté donde se espera.
 *
 * Hasta ahora esto solo lo cubría un e2e de doscientas líneas que creaba
 * una ficha entera por la interfaz: allí un fallo de derivación tardaba un
 * minuto en salir y no decía cuál de los veinte valores había fallado.
 */
describe('FichaVista', () => {
  let fixture: ComponentFixture<FichaVista>;

  async function montar(character: Character): Promise<void> {
    fixture = TestBed.createComponent(FichaVista);
    fixture.componentRef.setInput('character', character);
    await fixture.whenStable();
  }

  /** El texto de una pieza de la franja vital, por su rótulo. */
  function pieza(rotulo: string): string {
    const piezas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.tile'),
    );
    const encontrada = piezas.find((p) =>
      p.querySelector('.tile__rotulo')?.textContent?.includes(rotulo),
    );
    if (!encontrada) {
      throw new Error(`No hay pieza vital "${rotulo}"`);
    }
    return encontrada.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  /** El texto de una pieza de atributo, por su clave corta ("Fue"). */
  function atributo(clave: string): string {
    const piezas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.atr'),
    );
    const encontrada = piezas.find(
      (p) => p.querySelector('.atr__nombre')?.textContent?.trim() === clave,
    );
    if (!encontrada) {
      throw new Error(`No hay atributo "${clave}"`);
    }
    return encontrada.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function texto(): string {
    return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FichaVista],
    }).compileComponents();
  });

  it('should create', async () => {
    await montar(ficha());
    expect(fixture.componentInstance).toBeTruthy();
  });

  // -- La franja vital ------------------------------------------------------
  // Es la invariante de la maqueta: SIEMPRE las cuatro piezas y siempre en
  // el mismo orden, aunque la ficha esté vacía. Si esto se rompe, mirar dos
  // fichas seguidas deja de poder hacerse sin releer.

  it('pinta las cuatro piezas vitales incluso con la ficha vacía', async () => {
    await montar(ficha());
    const rotulos: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('.tile__rotulo'),
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');
    expect(rotulos).toEqual([
      'Clase de armadura',
      'Puntos de golpe',
      'Iniciativa',
      'Velocidad',
    ]);
  });

  it('marca como hueco el dato que falta, en vez de quitar la pieza', async () => {
    await montar(ficha());
    expect(fixture.nativeElement.querySelectorAll('.tile--hueco').length).toBe(4);
    expect(pieza('Clase de armadura')).toContain('—');
    expect(pieza('Clase de armadura')).toContain('sin anotar');
    expect(pieza('Iniciativa')).toContain('sin Destreza anotada');
  });

  it('deriva CA, toque y desprevenido en su pieza', async () => {
    // 10 + 6 armadura + 2 escudo + (-1) de Destreza 9 = 17
    await montar(
      ficha({
        combate: { bonifArmadura: 6, bonifEscudo: 2 },
        atributos: { destreza: { puntuacion: 9 } },
      }),
    );
    const ca = pieza('Clase de armadura');
    expect(ca).toContain('17');
    expect(ca).toContain('toque 9');
    // Un modificador NEGATIVO de Destreza no se pierde al estar
    // desprevenido: caDesprevenido usa Math.min(mod, 0).
    expect(ca).toContain('desprevenido 17');
    expect(
      fixture.nativeElement
        .querySelectorAll('.tile')[0]
        .classList.contains('tile--hueco'),
    ).toBe(false);
  });

  it('deriva la iniciativa y dice de dónde sale', async () => {
    await montar(
      ficha({
        atributos: { destreza: { puntuacion: 14 } },
        combate: { modVarioIniciativa: 4 },
      }),
    );
    expect(pieza('Iniciativa')).toContain('+6');
    expect(pieza('Iniciativa')).toContain('Destreza +2');
  });

  /**
   * La ficha guarda el TOTAL de PG y la RD; los puntos ACTUALES son estado
   * de sesión (PersonajeEnPartida) y se llevan en el panel de Selección.
   * Esta pieza no puede inventarse una barra ni un tramo vital.
   */
  it('la pieza de PG enseña el total y la RD, sin barra ni tramo vital', async () => {
    await montar(ficha({ pg: { total: 45, rd: '5/hierro frío' } }));
    expect(pieza('Puntos de golpe')).toContain('45');
    expect(pieza('Puntos de golpe')).toContain('RD 5/hierro frío');
    expect(fixture.nativeElement.querySelector('.pgbar')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.vital')).toBeFalsy();
  });

  it('la velocidad enseña la de con armadura y manda la base a los otros modos', async () => {
    await montar(ficha({ velocidad: { base: 30, conArmadura: 20, nadar: 15 } }));
    const velocidad = pieza('Velocidad');
    expect(velocidad).toContain('20 pies');
    expect(velocidad).toContain('4 casillas');
    expect(velocidad).toContain('con armadura');
    expect(texto()).toContain('Base 30 pies (6 cas. / 9 m)');
    expect(texto()).toContain('Nadar 15 pies');
  });

  // -- Atributos ------------------------------------------------------------

  it('el atributo enseña el modificador grande y la puntuación debajo', async () => {
    await montar(ficha({ atributos: { fuerza: { puntuacion: 18 } } }));
    const fuerza = fixture.nativeElement.querySelector('.atr');
    expect(fuerza.querySelector('.atr__mod').textContent.trim()).toBe('+4');
    expect(fuerza.querySelector('.atr__punt').textContent.trim()).toBe('18');
  });

  it('desglosa el bonificador racial cuando lo hay', async () => {
    // Elfo: +2 Destreza. 9 base + 2 = 11 → +0
    await montar(ficha({ raza: 'Elfo', atributos: { destreza: { puntuacion: 9 } } }));
    const destreza = atributo('Des');
    expect(destreza).toContain('+0');
    expect(destreza).toContain('11');
    expect(destreza).toContain('9 base · +2 racial');
  });

  /**
   * El ajuste temporal manda sobre el desglose racial —es lo urgente— y se
   * ve SIN leer: la pieza se marca con .atr--temp. El title conserva las
   * dos cosas para quien quiera el detalle.
   */
  it('un ajuste temporal marca la pieza y tapa el desglose racial', async () => {
    await montar(
      ficha({
        raza: 'Elfo',
        atributos: { constitucion: { puntuacion: 14, ajusteTemporal: -4 } },
      }),
    );
    const pieza = fixture.nativeElement.querySelector('.atr--temp');
    expect(pieza).toBeTruthy();
    // Elfo lleva -2 a Constitución: 14 - 2 - 4 = 8 → -1
    expect(pieza.querySelector('.atr__mod').textContent.trim()).toBe('-1');
    expect(pieza.querySelector('.atr__punt').textContent.trim()).toBe('8');
    expect(pieza.textContent).toContain('temp -4 (12)');
    expect(pieza.querySelector('.atr__desglose')).toBeFalsy();
    expect(pieza.getAttribute('title')).toContain('14 base · -2 racial');
  });

  // -- Bloques --------------------------------------------------------------

  it('las salvaciones son tres cifras, cada una en su pieza', async () => {
    await montar(
      ficha({
        atributos: { destreza: { puntuacion: 14 }, constitucion: { puntuacion: 16 } },
        salvaciones: { fortaleza: { base: 4 }, reflejos: { base: 2 } },
      }),
    );
    const salvas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.salva'),
    );
    expect(salvas.length).toBe(3);
    expect(salvas[0].textContent).toContain('Fortaleza');
    expect(salvas[0].textContent).toContain('+7');
    expect(salvas[1].textContent).toContain('+4');
  });

  it('el arma reparte sus datos en columnas comparables', async () => {
    await montar(
      ficha({
        armas: [
          {
            nombre: 'Espada larga',
            bonifAtaque: '+9/+4',
            dano: '1d8+4',
            critico: '19-20/x2',
            tipo: 'cortante',
            alcance: '',
          },
        ],
      }),
    );
    const fila = fixture.nativeElement.querySelectorAll('.arma')[1];
    expect(fila.querySelector('.arma__nombre').textContent).toContain(
      'Espada larga',
    );
    expect(fila.querySelector('.arma__extra').textContent).toContain('cortante');
    const valores: string[] = Array.from(fila.querySelectorAll('.arma__v')).map(
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );
    expect(valores).toEqual(['+9/+4', '1d8+4', '19-20/x2']);
  });

  it('la caja de modificadores va como pie de SU bloque', async () => {
    await montar(
      ficha({
        salvaciones: { fortaleza: { base: 4 }, notas: 'Anillo de protección +1' },
        ofensivo: { ataqueBase: 3, notas: 'Soltura: +1 al daño' },
      }),
    );
    const notas: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('.nota'),
    ).map((el) => (el as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(notas).toContain('Modificadores: Anillo de protección +1');
    expect(notas).toContain('Modificadores: Soltura: +1 al daño');
  });

  it('la habilidad enseña su especialidad y su bonificador derivado', async () => {
    // 1 rango + 4 de Inteligencia 18, sin ser de clase = +5
    await montar(
      ficha({
        atributos: { inteligencia: { puntuacion: 18 } },
        habilidades: { artesania1: { rangos: 1, especialidad: 'Herrería' } },
      }),
    );
    const par = fixture.nativeElement.querySelector('.habilidades .par');
    expect(par.querySelector('.par__et').textContent.trim()).toBe(
      'Artesanía (Herrería)',
    );
    expect(par.querySelector('.par__v').textContent.trim()).toBe('+5');
  });

  it('el conjuro reparte nivel, conocidos, por día, adicionales y CD', async () => {
    // CD nivel 1 con Inteligencia 18 → 10 + 1 + 4 = 15
    await montar(
      ficha({
        atributos: { inteligencia: { puntuacion: 18 } },
        conjuros: {
          atributoLanzamiento: 'inteligencia',
          niveles: { '1': { conocidos: 2, porDia: 2 } },
        },
      }),
    );
    const fila = fixture.nativeElement.querySelectorAll('.conjuro')[1];
    expect(fila.querySelector('.conjuro__nivel').textContent.trim()).toBe(
      'Nivel 1',
    );
    const valores: string[] = Array.from(fila.querySelectorAll('.conjuro__d')).map(
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );
    // conocidos, por día, adicionales (+1 por Int 18), CD
    expect(valores).toEqual(['2', '2', '+1', '15']);
  });

  // -- Identidad y visibilidad ----------------------------------------------

  it('la identidad va en la línea de cabecera, no en la rejilla de datos', async () => {
    await montar(
      ficha({
        clase: 'Paladín',
        raza: 'Humano',
        alineamiento: 'legal bueno',
        tamano: 'mediano',
        jugador: 'Luis',
      }),
    );
    expect(
      fixture.nativeElement
        .querySelector('.ficha-vista__cabecera')
        .textContent.trim(),
    ).toBe('Paladín 5 · Humano · legal bueno · Mediano · Jugador: Luis');
  });

  it('sin clase, la cabecera dice el nivel a secas', async () => {
    await montar(ficha({}, 3));
    expect(
      fixture.nativeElement
        .querySelector('.ficha-vista__cabecera')
        .textContent.trim(),
    ).toBe('Nivel 3');
  });

  /**
   * El reparto de visibilidad es real —descripcion viaja a toda la mesa
   * dentro del resumen del asiento, historia no— y esta es la única
   * pantalla donde se dice.
   */
  it('dice quién ve el aspecto y quién el trasfondo', async () => {
    await montar(
      ficha({ descripcion: 'Alto y ancho.', historia: 'Sirvió en la guardia.' }),
    );
    const etiquetas: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('.visib'),
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');
    expect(etiquetas).toEqual(['lo ve toda la mesa', 'solo su dueño y el máster']);
  });

  it('explica que la ficha está por rellenar, sin quitar la franja vital', async () => {
    await montar(ficha());
    expect(texto()).toContain('todavía no tiene atributos');
    expect(fixture.nativeElement.querySelectorAll('.tile').length).toBe(4);
  });

  it('con datos, no dice que esté por rellenar', async () => {
    await montar(ficha({ atributos: { fuerza: { puntuacion: 12 } } }));
    expect(texto()).not.toContain('todavía no tiene atributos');
  });
});
