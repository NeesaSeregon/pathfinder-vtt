import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ALINEAMIENTOS,
  Alineamiento,
  ATRIBUTO_LABELS,
  ATRIBUTOS,
  Character,
  CharacterAtributos,
  CharacterSheetData,
  CharacterUpsert,
  claseDeArmadura,
  CombateValores,
  conSigno,
  formatearModificador,
  iniciativa,
  modificadorDeAtributo,
} from '@pathfinder/shared';

const CAMPOS_COMBATE = [
  'bonifArmadura',
  'bonifEscudo',
  'modTamano',
  'armaduraNatural',
  'modDesvio',
  'modVarioCa',
  'modVarioIniciativa',
] as const;

type CombateForm = Record<
  (typeof CAMPOS_COMBATE)[number],
  WritableSignal<number | null>
>;

function crearCombateForm(): CombateForm {
  const form = {} as CombateForm;
  for (const campo of CAMPOS_COMBATE) {
    form[campo] = signal<number | null>(null);
  }
  return form;
}

type AtributosForm = Record<
  (typeof ATRIBUTOS)[number],
  {
    puntuacion: WritableSignal<number | null>;
    ajusteTemporal: WritableSignal<number | null>;
  }
>;

function crearAtributosForm(): AtributosForm {
  const form = {} as AtributosForm;
  for (const atributo of ATRIBUTOS) {
    form[atributo] = {
      puntuacion: signal<number | null>(null),
      ajusteTemporal: signal<number | null>(null),
    };
  }
  return form;
}

/**
 * Formulario de personaje reutilizable: sin `initial` es un alta vacía;
 * con `initial` precarga los datos para edición. En ambos casos emite
 * el evento (save) con el personaje listo para enviar a la API.
 */
@Component({
  selector: 'app-character-form',
  imports: [FormsModule],
  templateUrl: './character-form.html',
  styleUrl: './character-form.scss',
})
export class CharacterForm {
  readonly initial = input<Character | null>(null);
  readonly submitLabel = input('Crear');
  readonly save = output<CharacterUpsert>();

  protected readonly alineamientos = ALINEAMIENTOS;
  protected readonly atributos = ATRIBUTOS;
  protected readonly atributoLabels = ATRIBUTO_LABELS;
  protected readonly modificador = formatearModificador;

  protected readonly form = {
    atributos: crearAtributosForm(),
    combate: crearCombateForm(),
    name: signal(''),
    level: signal(1),
    jugador: signal(''),
    clase: signal(''),
    alineamiento: signal<Alineamiento | ''>(''),
    paisNatal: signal(''),
    dios: signal(''),
    raza: signal(''),
    tamano: signal(''),
    edad: signal<number | null>(null),
    altura: signal(''),
    peso: signal(''),
    cabello: signal(''),
    ojos: signal(''),
  };

  /**
   * Totales derivados EN VIVO: buildSheetData() lee señales, así que estos
   * computed se recalculan solos al teclear en cualquier casilla implicada
   * (Destreza incluida). La fórmula es la misma de la lib compartida.
   */
  protected readonly caTotal = computed(() =>
    claseDeArmadura(this.buildSheetData()),
  );
  protected readonly iniciativaTotal = computed(() =>
    conSigno(iniciativa(this.buildSheetData())),
  );
  protected readonly modDestreza = computed(() =>
    conSigno(modificadorDeAtributo(this.buildSheetData(), 'destreza')),
  );

  constructor() {
    // Cada vez que cambia `initial` (abrir la edición de otro personaje,
    // o ninguno), el formulario se rellena o se vacía.
    effect(() => this.applyInitial(this.initial()));
  }

  reset(): void {
    this.applyInitial(this.initial());
  }

  protected submit(): void {
    const name = this.form.name().trim();
    if (!name) {
      return;
    }
    this.save.emit({
      name,
      level: this.form.level(),
      sheetData: this.buildSheetData(),
    });
  }

  /**
   * Parte de una COPIA de la ficha original (si la hay) y aplica los campos
   * del formulario encima: los campos que el formulario no conoce se
   * conservan, y los que el usuario vació se eliminan. Así un PATCH nunca
   * pierde datos que esta pantalla no gestiona.
   */
  private buildSheetData(): CharacterSheetData {
    const sheet: CharacterSheetData = { ...(this.initial()?.sheetData ?? {}) };

    const texto = (valor: string): string | undefined =>
      valor.trim() || undefined;

    const campos: Record<string, string | number | undefined> = {
      jugador: texto(this.form.jugador()),
      clase: texto(this.form.clase()),
      alineamiento: this.form.alineamiento() || undefined,
      paisNatal: texto(this.form.paisNatal()),
      dios: texto(this.form.dios()),
      raza: texto(this.form.raza()),
      tamano: texto(this.form.tamano()),
      edad: this.form.edad() ?? undefined,
      altura: texto(this.form.altura()),
      peso: texto(this.form.peso()),
      cabello: texto(this.form.cabello()),
      ojos: texto(this.form.ojos()),
    };

    for (const [key, value] of Object.entries(campos)) {
      if (value === undefined) {
        delete sheet[key];
      } else {
        sheet[key] = value;
      }
    }

    const atributos = this.buildAtributos();
    if (Object.keys(atributos).length > 0) {
      sheet.atributos = atributos;
    } else {
      delete sheet.atributos;
    }

    const combate = this.buildCombate();
    if (Object.keys(combate).length > 0) {
      sheet.combate = combate;
    } else {
      delete sheet.combate;
    }
    return sheet;
  }

  private buildCombate(): CombateValores {
    const combate: CombateValores = {};
    for (const campo of CAMPOS_COMBATE) {
      const valor = this.form.combate[campo]();
      if (valor !== null) {
        combate[campo] = valor;
      }
    }
    return combate;
  }

  private buildAtributos(): CharacterAtributos {
    const atributos: CharacterAtributos = {};
    for (const atributo of ATRIBUTOS) {
      const puntuacion = this.form.atributos[atributo].puntuacion();
      const ajusteTemporal = this.form.atributos[atributo].ajusteTemporal();
      if (puntuacion !== null || ajusteTemporal !== null) {
        atributos[atributo] = {
          ...(puntuacion !== null ? { puntuacion } : {}),
          ...(ajusteTemporal !== null ? { ajusteTemporal } : {}),
        };
      }
    }
    return atributos;
  }

  private applyInitial(character: Character | null): void {
    const sheet = character?.sheetData ?? {};
    this.form.name.set(character?.name ?? '');
    this.form.level.set(character?.level ?? 1);
    this.form.jugador.set(sheet.jugador ?? '');
    this.form.clase.set(sheet.clase ?? '');
    this.form.alineamiento.set(sheet.alineamiento ?? '');
    this.form.paisNatal.set(sheet.paisNatal ?? '');
    this.form.dios.set(sheet.dios ?? '');
    this.form.raza.set(sheet.raza ?? '');
    this.form.tamano.set(sheet.tamano ?? '');
    this.form.edad.set(sheet.edad ?? null);
    this.form.altura.set(sheet.altura ?? '');
    this.form.peso.set(sheet.peso ?? '');
    this.form.cabello.set(sheet.cabello ?? '');
    this.form.ojos.set(sheet.ojos ?? '');
    for (const atributo of ATRIBUTOS) {
      const valor = sheet.atributos?.[atributo];
      this.form.atributos[atributo].puntuacion.set(valor?.puntuacion ?? null);
      this.form.atributos[atributo].ajusteTemporal.set(
        valor?.ajusteTemporal ?? null,
      );
    }
    for (const campo of CAMPOS_COMBATE) {
      this.form.combate[campo].set(sheet.combate?.[campo] ?? null);
    }
  }
}
