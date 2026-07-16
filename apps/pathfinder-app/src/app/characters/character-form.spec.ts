import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Character, CharacterUpsert } from '@pathfinder/shared';
import { CharacterForm } from './character-form';

/**
 * Los miembros del componente son protected (solo la plantilla los usa),
 * así que los tests acceden a través de este tipo espejo.
 */
type CharacterFormInterno = {
  form: {
    name: { set(v: string): void };
    level: { set(v: number): void };
    clase: { set(v: string): void };
    raza: { set(v: string): void };
    atributos: Record<
      string,
      {
        puntuacion: { set(v: number | null): void };
        ajusteTemporal: { set(v: number | null): void };
      }
    >;
    combate: Record<string, { set(v: number | null): void }>;
    velocidad: Record<string, { set(v: number | string | null): void }>;
    pgTotal: { set(v: number | null): void };
    pgRd: { set(v: string): void };
    salvaciones: Record<
      string,
      Record<string, { set(v: number | null): void }>
    >;
    ataqueBase: { set(v: number | null): void };
    tamano: { set(v: string): void };
    habilidades: Record<
      string,
      {
        esClase: { set(v: boolean): void };
        especialidad: { set(v: string): void };
        rangos: { set(v: number | null): void };
        modVario: { set(v: number | null): void };
      }
    >;
    armas(): Record<string, { set(v: string): void }>[];
    equipo(): {
      nombre: { set(v: string): void };
      peso: { set(v: number | null): void };
    }[];
    dinero: Record<string, { set(v: number | null): void }>;
    experienciaActual: { set(v: number | null): void };
    experienciaSiguienteNivel: { set(v: number | null): void };
    atributoLanzamiento: { set(v: string): void };
    conjurosNiveles: {
      conocidos: { set(v: number | null): void };
      porDia: { set(v: number | null): void };
      anotados: { set(v: string): void };
    }[];
  };
  cdDeNivel(nivel: number): string;
  adicionalesDeNivel(nivel: number): string;
  agregarArma(): void;
  quitarArma(indice: number): void;
  agregarEquipo(): void;
  oroTotal(): number;
  pxFaltantes(): number | null;
  pesoTotalActual(): number;
  carga(): string | null;
  capacidad(): { pesada: number } | null;
  totalHabilidad(id: string): string;
  totalSalvacion(salvacion: string): string;
  bmcTotal(): string;
  dmcTotal(): number;
  caTotal(): number;
  iniciativaTotal(): string;
  enCasillasYMetros(pies: number | null): string;
  modTemporal(atributo: string): string;
  submit(): void;
};

function personaje(sheetData: Character['sheetData']): Character {
  return { id: '1', name: 'Ezren', level: 5, sheetData };
}

describe('CharacterForm', () => {
  let fixture: ComponentFixture<CharacterForm>;
  let component: CharacterForm;
  let interno: CharacterFormInterno;
  let emitido: CharacterUpsert | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterForm],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterForm);
    component = fixture.componentInstance;
    interno = component as unknown as CharacterFormInterno;
    emitido = undefined;
    component.save.subscribe((payload) => (emitido = payload));
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no emite nada si el nombre está vacío', () => {
    interno.form.name.set('   ');
    interno.submit();
    expect(emitido).toBeUndefined();
  });

  it('emite el personaje construido a partir del formulario', () => {
    interno.form.name.set('Valeros');
    interno.form.level.set(3);
    interno.form.clase.set('Guerrero');
    interno.submit();

    expect(emitido).toEqual({
      name: 'Valeros',
      level: 3,
      sheetData: { clase: 'Guerrero' },
    });
  });

  it('precarga los campos cuando recibe un personaje en initial', async () => {
    fixture.componentRef.setInput(
      'initial',
      personaje({ clase: 'Mago', atributos: { fuerza: { puntuacion: 12 } } }),
    );
    await fixture.whenStable();

    interno.submit();
    expect(emitido?.name).toBe('Ezren');
    expect(emitido?.sheetData.clase).toBe('Mago');
    expect(emitido?.sheetData.atributos).toEqual({
      fuerza: { puntuacion: 12 },
    });
  });

  it('conserva campos de la ficha que este formulario no gestiona', async () => {
    // "notas" no tiene input en el formulario: editar NO debe perderlo.
    fixture.componentRef.setInput(
      'initial',
      personaje({ clase: 'Pícaro', notas: 'le debe dinero al gremio' }),
    );
    await fixture.whenStable();

    interno.form.raza.set('Elfo');
    interno.submit();

    expect(emitido?.sheetData['notas']).toBe('le debe dinero al gremio');
    expect(emitido?.sheetData.raza).toBe('Elfo');
    expect(emitido?.sheetData.clase).toBe('Pícaro');
  });

  it('elimina de la ficha los campos que el usuario vació', async () => {
    fixture.componentRef.setInput('initial', personaje({ clase: 'Bardo' }));
    await fixture.whenStable();

    interno.form.clase.set('');
    interno.submit();

    expect(emitido?.sheetData).not.toHaveProperty('clase');
  });

  it('guarda solo los atributos rellenos, sin modificadores derivados', () => {
    interno.form.name.set('Valeros');
    interno.form.atributos['fuerza'].puntuacion.set(18);
    interno.form.atributos['fuerza'].ajusteTemporal.set(4);
    interno.form.atributos['destreza'].puntuacion.set(9);
    interno.submit();

    expect(emitido?.sheetData.atributos).toEqual({
      fuerza: { puntuacion: 18, ajusteTemporal: 4 },
      destreza: { puntuacion: 9 },
    });
    // constitución y compañía no se rellenaron: no deben aparecer
    expect(emitido?.sheetData.atributos).not.toHaveProperty('constitucion');
  });

  it('guarda las salvaciones rellenas y calcula el total en vivo', () => {
    interno.form.name.set('Valeros');
    interno.form.atributos['constitucion'].puntuacion.set(14);
    interno.form.salvaciones['fortaleza']['base'].set(4);
    interno.form.salvaciones['fortaleza']['modMagico'].set(1);

    // 4 (base) + 2 (CON 14) + 1 (mágico) = +7
    expect(interno.totalSalvacion('fortaleza')).toBe('+7');

    interno.submit();
    expect(emitido?.sheetData.salvaciones).toEqual({
      fortaleza: { base: 4, modMagico: 1 },
    });
  });

  it('BMC y DMC se derivan en vivo de BAB, atributos y tamaño', () => {
    interno.form.atributos['fuerza'].puntuacion.set(18); // +4
    interno.form.atributos['destreza'].puntuacion.set(14); // +2
    interno.form.ataqueBase.set(3);
    interno.form.tamano.set('grande'); // maniobras: +1 (CA: -1)

    expect(interno.bmcTotal()).toBe('+8'); // 3 + 4 + 1
    expect(interno.dmcTotal()).toBe(20); // 10 + 3 + 4 + 2 + 1

    interno.form.name.set('Valeros');
    interno.submit();
    expect(emitido?.sheetData.ofensivo).toEqual({ ataqueBase: 3 });
    expect(emitido?.sheetData.tamano).toBe('grande');
  });

  it('guarda las armas rellenas y descarta las filas en blanco', () => {
    interno.form.name.set('Valeros');
    interno.agregarArma();
    interno.agregarArma(); // esta se queda vacía
    interno.form.armas()[0]['nombre'].set('Espada larga');
    interno.form.armas()[0]['bonifAtaque'].set('+9/+4');
    interno.form.armas()[0]['dano'].set('1d8+4');
    interno.submit();

    expect(emitido?.sheetData.armas).toEqual([
      { nombre: 'Espada larga', bonifAtaque: '+9/+4', dano: '1d8+4' },
    ]);
  });

  it('quitarArma elimina la fila indicada', () => {
    interno.agregarArma();
    interno.agregarArma();
    interno.form.armas()[0]['nombre'].set('Espada');
    interno.form.armas()[1]['nombre'].set('Arco');
    interno.quitarArma(0);

    interno.form.name.set('Valeros');
    interno.submit();
    expect(emitido?.sheetData.armas).toEqual([{ nombre: 'Arco' }]);
  });

  it('deriva peso total, límites y categoría de carga en vivo', () => {
    interno.form.atributos['fuerza'].puntuacion.set(10); // 33/66/100
    interno.agregarEquipo();
    interno.form.equipo()[0].nombre.set('Yunque');
    interno.form.equipo()[0].peso.set(50);

    expect(interno.pesoTotalActual()).toBe(50);
    expect(interno.capacidad()?.pesada).toBe(100);
    expect(interno.carga()).toBe('media'); // 50 > 33 y <= 66

    interno.form.name.set('Valeros');
    interno.submit();
    expect(emitido?.sheetData.equipo).toEqual([
      { nombre: 'Yunque', peso: 50 },
    ]);
  });

  it('deriva el oro total y los PX que faltan', () => {
    interno.form.dinero['po'].set(12);
    interno.form.dinero['pp'].set(30);
    interno.form.experienciaActual.set(3400);
    interno.form.experienciaSiguienteNivel.set(5000);

    expect(interno.oroTotal()).toBe(15);
    expect(interno.pxFaltantes()).toBe(1600);

    interno.form.name.set('Valeros');
    interno.submit();
    expect(emitido?.sheetData.dinero).toEqual({ po: 12, pp: 30 });
    expect(emitido?.sheetData.experiencia).toEqual({
      actual: 3400,
      siguienteNivel: 5000,
    });
  });

  it('deriva CD y adicionales de conjuro del atributo de lanzamiento', () => {
    interno.form.atributos['inteligencia'].puntuacion.set(18); // +4
    interno.form.atributoLanzamiento.set('inteligencia');
    interno.form.conjurosNiveles[1].porDia.set(2);

    expect(interno.cdDeNivel(1)).toBe('15'); // 10 + 1 + 4
    expect(interno.adicionalesDeNivel(1)).toBe('1');
    expect(interno.adicionalesDeNivel(0)).toBe('—');

    interno.form.name.set('Ezren');
    interno.submit();
    expect(emitido?.sheetData.conjuros).toEqual({
      atributoLanzamiento: 'inteligencia',
      niveles: { '1': { porDia: 2 } },
    });
  });

  it('guarda solo las habilidades con datos y deriva el total', () => {
    interno.form.name.set('Valeros');
    interno.form.atributos['destreza'].puntuacion.set(14); // +2
    interno.form.habilidades['acrobacias'].esClase.set(true);
    interno.form.habilidades['acrobacias'].rangos.set(3);
    interno.form.habilidades['artesania1'].especialidad.set('Herrería');
    interno.form.habilidades['artesania1'].rangos.set(1);

    // 3 rangos + 2 Des + 3 de clase = +8
    expect(interno.totalHabilidad('acrobacias')).toBe('+8');

    interno.submit();
    expect(emitido?.sheetData.habilidades).toEqual({
      acrobacias: { esClase: true, rangos: 3 },
      artesania1: { rangos: 1, especialidad: 'Herrería' },
    });
    // el resto de la lista no aparece: solo se persiste lo relleno
    expect(emitido?.sheetData.habilidades).not.toHaveProperty('sigilo');
  });

  it('el modif. temporal deriva de puntuación + ajuste', () => {
    interno.form.atributos['fuerza'].puntuacion.set(18);
    // Sin efecto activo, la columna va vacía
    expect(interno.modTemporal('fuerza')).toBe('—');

    // Fuerza de toro (+4): efectiva 22 → +6
    interno.form.atributos['fuerza'].ajusteTemporal.set(4);
    expect(interno.modTemporal('fuerza')).toBe('+6');
  });

  it('guarda solo las casillas de combate rellenas, sin totales', () => {
    interno.form.name.set('Valeros');
    interno.form.combate['bonifArmadura'].set(5);
    interno.form.combate['bonifEscudo'].set(2);
    interno.submit();

    expect(emitido?.sheetData.combate).toEqual({
      bonifArmadura: 5,
      bonifEscudo: 2,
    });
    // El total de CA no se persiste: es derivado
    expect(emitido?.sheetData.combate).not.toHaveProperty('ca');
  });

  it('recalcula CA e iniciativa en vivo al cambiar Destreza', () => {
    interno.form.combate['bonifArmadura'].set(5);
    interno.form.combate['modVarioIniciativa'].set(2);
    // Sin Destreza: CA = 10 + 5, iniciativa = +2
    expect(interno.caTotal()).toBe(15);
    expect(interno.iniciativaTotal()).toBe('+2');

    interno.form.atributos['destreza'].puntuacion.set(9);
    expect(interno.caTotal()).toBe(14);
    expect(interno.iniciativaTotal()).toBe('+1');
  });

  it('guarda solo las velocidades rellenas y deriva casillas y metros', () => {
    interno.form.name.set('Valeros');
    interno.form.velocidad['base'].set(30);
    interno.form.velocidad['volar'].set(60);
    interno.form.velocidad['maniobrabilidad'].set('buena');
    interno.submit();

    expect(emitido?.sheetData.velocidad).toEqual({
      base: 30,
      volar: 60,
      maniobrabilidad: 'buena',
    });
    // Casillas y metros son derivados, no persistidos
    expect(interno.enCasillasYMetros(30)).toBe('6 cas. / 9 m');
    expect(interno.enCasillasYMetros(null)).toBe('—');
  });

  it('guarda los puntos de golpe y la RD solo si están rellenos', () => {
    interno.form.name.set('Valeros');
    interno.form.pgTotal.set(45);
    interno.form.pgRd.set('5/hierro frío');
    interno.submit();

    expect(emitido?.sheetData.pg).toEqual({
      total: 45,
      rd: '5/hierro frío',
    });
  });

  it('no incluye el bloque pg si sus casillas están vacías', () => {
    interno.form.name.set('Valeros');
    interno.submit();
    expect(emitido?.sheetData).not.toHaveProperty('pg');
  });

  it('pinta el modificador calculado en la plantilla', async () => {
    interno.form.atributos['fuerza'].puntuacion.set(18);
    await fixture.whenStable();

    const outputs: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('output'),
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );
    expect(outputs).toContain('+4');
  });
});
