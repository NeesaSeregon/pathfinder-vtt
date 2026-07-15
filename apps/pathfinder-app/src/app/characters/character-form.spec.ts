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
  };
  caTotal(): number;
  iniciativaTotal(): string;
  enCasillasYMetros(pies: number | null): string;
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
      personaje({ clase: 'Maga', atributos: { fuerza: { puntuacion: 12 } } }),
    );
    await fixture.whenStable();

    interno.submit();
    expect(emitido?.name).toBe('Ezren');
    expect(emitido?.sheetData.clase).toBe('Maga');
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
    interno.form.atributos['fuerza'].ajusteTemporal.set(20);
    interno.form.atributos['destreza'].puntuacion.set(9);
    interno.submit();

    expect(emitido?.sheetData.atributos).toEqual({
      fuerza: { puntuacion: 18, ajusteTemporal: 20 },
      destreza: { puntuacion: 9 },
    });
    // constitución y compañía no se rellenaron: no deben aparecer
    expect(emitido?.sheetData.atributos).not.toHaveProperty('constitucion');
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
