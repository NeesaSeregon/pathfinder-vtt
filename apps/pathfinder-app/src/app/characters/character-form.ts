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
  bmc,
  dmc,
  OfensivoValores,
  Character,
  CharacterAtributos,
  CharacterSheetData,
  CharacterUpsert,
  caDesprevenido,
  caDeToque,
  casillas,
  claseDeArmadura,
  CombateValores,
  conSigno,
  formatearModificador,
  iniciativa,
  Maniobrabilidad,
  MANIOBRABILIDADES,
  modificadorDeAtributo,
  modificadorTamano,
  modificadorTamanoManiobras,
  PgValores,
  piesAMetros,
  puntuacionEfectiva,
  Tamano,
  TAMANO_LABELS,
  TAMANOS,
  Salvacion,
  SALVACION_ATRIBUTO,
  SALVACION_LABELS,
  SALVACIONES,
  SalvacionesValores,
  SalvacionValores,
  tiradaDeSalvacion,
  VelocidadValores,
} from '@pathfinder/shared';

const CAMPOS_SALVACION = ['base', 'modMagico', 'modVario', 'modTemporal'] as const;

type SalvacionesForm = Record<
  Salvacion,
  Record<(typeof CAMPOS_SALVACION)[number], WritableSignal<number | null>>
>;

function crearSalvacionesForm(): SalvacionesForm {
  const form = {} as SalvacionesForm;
  for (const salvacion of SALVACIONES) {
    form[salvacion] = {
      base: signal<number | null>(null),
      modMagico: signal<number | null>(null),
      modVario: signal<number | null>(null),
      modTemporal: signal<number | null>(null),
    };
  }
  return form;
}

const CAMPOS_VELOCIDAD_PIES = [
  'base',
  'conArmadura',
  'volar',
  'nadar',
  'trepar',
  'excavar',
] as const;

type VelocidadForm = Record<
  (typeof CAMPOS_VELOCIDAD_PIES)[number],
  WritableSignal<number | null>
> & {
  maniobrabilidad: WritableSignal<Maniobrabilidad | ''>;
  modTemporales: WritableSignal<string>;
};

function crearVelocidadForm(): VelocidadForm {
  const form = {
    maniobrabilidad: signal<Maniobrabilidad | ''>(''),
    modTemporales: signal(''),
  } as VelocidadForm;
  for (const campo of CAMPOS_VELOCIDAD_PIES) {
    form[campo] = signal<number | null>(null);
  }
  return form;
}

const CAMPOS_COMBATE = [
  'bonifArmadura',
  'bonifEscudo',
  'armaduraNatural',
  'modDesvio',
  'modEsquiva',
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
  protected readonly salvaciones = SALVACIONES;
  protected readonly salvacionLabels = SALVACION_LABELS;
  protected readonly tamanos = TAMANOS;
  protected readonly tamanoLabels = TAMANO_LABELS;

  protected readonly maniobrabilidades = MANIOBRABILIDADES;

  protected readonly form = {
    atributos: crearAtributosForm(),
    combate: crearCombateForm(),
    combateNotas: signal(''),
    salvaciones: crearSalvacionesForm(),
    salvacionesNotas: signal(''),
    ataqueBase: signal<number | null>(null),
    resistenciaConjuros: signal<number | null>(null),
    ofensivoNotas: signal(''),
    velocidad: crearVelocidadForm(),
    pgTotal: signal<number | null>(null),
    pgRd: signal(''),
    name: signal(''),
    level: signal(1),
    jugador: signal(''),
    clase: signal(''),
    alineamiento: signal<Alineamiento | ''>(''),
    paisNatal: signal(''),
    dios: signal(''),
    raza: signal(''),
    tamano: signal<Tamano | ''>(''),
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
  protected readonly caToque = computed(() =>
    caDeToque(this.buildSheetData()),
  );
  protected readonly caDesprevenidoTotal = computed(() =>
    caDesprevenido(this.buildSheetData()),
  );
  protected readonly iniciativaTotal = computed(() =>
    conSigno(iniciativa(this.buildSheetData())),
  );
  protected readonly modDestreza = computed(() =>
    conSigno(modificadorDeAtributo(this.buildSheetData(), 'destreza')),
  );
  protected readonly modFuerza = computed(() =>
    conSigno(modificadorDeAtributo(this.buildSheetData(), 'fuerza')),
  );
  protected readonly modTamanoCa = computed(() =>
    conSigno(modificadorTamano(this.buildSheetData())),
  );
  protected readonly modTamanoManiobrasTexto = computed(() =>
    conSigno(modificadorTamanoManiobras(this.buildSheetData())),
  );
  protected readonly bmcTotal = computed(() =>
    conSigno(bmc(this.buildSheetData())),
  );
  protected readonly dmcTotal = computed(() => dmc(this.buildSheetData()));

  constructor() {
    // Cada vez que cambia `initial` (abrir la edición de otro personaje,
    // o ninguno), el formulario se rellena o se vacía.
    effect(() => this.applyInitial(this.initial()));
  }

  /** Sumando de una casilla manual, con signo; vacía cuenta como +0. */
  protected sumando(valor: number | null): string {
    return conSigno(valor ?? 0);
  }

  /** Total de una salvación, en vivo, con la fórmula compartida. */
  protected totalSalvacion(salvacion: Salvacion): string {
    return conSigno(tiradaDeSalvacion(this.buildSheetData(), salvacion));
  }

  /** Modif. del atributo asociado a una salvación (CON/DES/SAB), en vivo. */
  protected modAtributoSalvacion(salvacion: Salvacion): string {
    return conSigno(
      modificadorDeAtributo(this.buildSheetData(), SALVACION_ATRIBUTO[salvacion]),
    );
  }

  /** Abreviatura del atributo asociado: (Constitución), (Destreza)... */
  protected atributoDeSalvacion(salvacion: Salvacion): string {
    return ATRIBUTO_LABELS[SALVACION_ATRIBUTO[salvacion]];
  }

  /**
   * Modif. temporal de un atributo: el modificador de (puntuación + ajuste).
   * Sin ajuste no hay efecto activo, así que se muestra —.
   */
  protected modTemporal(atributo: (typeof ATRIBUTOS)[number]): string {
    const ajuste = this.form.atributos[atributo].ajusteTemporal();
    if (ajuste === null) {
      return '—';
    }
    const efectiva = puntuacionEfectiva({
      puntuacion: this.form.atributos[atributo].puntuacion() ?? undefined,
      ajusteTemporal: ajuste,
    });
    return formatearModificador(efectiva);
  }

  /** "6 cas. / 9 m" a partir de pies, o — si la casilla está vacía. */
  protected enCasillasYMetros(pies: number | null): string {
    if (pies === null) {
      return '—';
    }
    return `${casillas(pies)} cas. / ${piesAMetros(pies)} m`;
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
      tamano: this.form.tamano() || undefined,
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

    const velocidad = this.buildVelocidad();
    if (Object.keys(velocidad).length > 0) {
      sheet.velocidad = velocidad;
    } else {
      delete sheet.velocidad;
    }

    const salvaciones = this.buildSalvaciones();
    if (Object.keys(salvaciones).length > 0) {
      sheet.salvaciones = salvaciones;
    } else {
      delete sheet.salvaciones;
    }

    const ofensivo: OfensivoValores = {};
    if (this.form.ataqueBase() !== null) {
      ofensivo.ataqueBase = this.form.ataqueBase() as number;
    }
    if (this.form.resistenciaConjuros() !== null) {
      ofensivo.resistenciaConjuros = this.form.resistenciaConjuros() as number;
    }
    const ofensivoNotas = this.form.ofensivoNotas().trim();
    if (ofensivoNotas) {
      ofensivo.notas = ofensivoNotas;
    }
    if (Object.keys(ofensivo).length > 0) {
      sheet.ofensivo = ofensivo;
    } else {
      delete sheet.ofensivo;
    }

    const pg: PgValores = {};
    const pgTotal = this.form.pgTotal();
    if (pgTotal !== null) {
      pg.total = pgTotal;
    }
    const pgRd = this.form.pgRd().trim();
    if (pgRd) {
      pg.rd = pgRd;
    }
    if (Object.keys(pg).length > 0) {
      sheet.pg = pg;
    } else {
      delete sheet.pg;
    }
    return sheet;
  }

  private buildSalvaciones(): SalvacionesValores {
    const salvaciones: SalvacionesValores = {};
    for (const salvacion of SALVACIONES) {
      const valores: SalvacionValores = {};
      for (const campo of CAMPOS_SALVACION) {
        const valor = this.form.salvaciones[salvacion][campo]();
        if (valor !== null) {
          valores[campo] = valor;
        }
      }
      if (Object.keys(valores).length > 0) {
        salvaciones[salvacion] = valores;
      }
    }
    const notas = this.form.salvacionesNotas().trim();
    if (notas) {
      salvaciones.notas = notas;
    }
    return salvaciones;
  }

  private buildVelocidad(): VelocidadValores {
    const velocidad: VelocidadValores = {};
    for (const campo of CAMPOS_VELOCIDAD_PIES) {
      const valor = this.form.velocidad[campo]();
      if (valor !== null) {
        velocidad[campo] = valor;
      }
    }
    const maniobrabilidad = this.form.velocidad.maniobrabilidad();
    if (maniobrabilidad) {
      velocidad.maniobrabilidad = maniobrabilidad;
    }
    const modTemporales = this.form.velocidad.modTemporales().trim();
    if (modTemporales) {
      velocidad.modTemporales = modTemporales;
    }
    return velocidad;
  }

  private buildCombate(): CombateValores {
    const combate: CombateValores = {};
    for (const campo of CAMPOS_COMBATE) {
      const valor = this.form.combate[campo]();
      if (valor !== null) {
        combate[campo] = valor;
      }
    }
    const notas = this.form.combateNotas().trim();
    if (notas) {
      combate.notas = notas;
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
    this.form.combateNotas.set(sheet.combate?.notas ?? '');
    for (const salvacion of SALVACIONES) {
      for (const campo of CAMPOS_SALVACION) {
        this.form.salvaciones[salvacion][campo].set(
          sheet.salvaciones?.[salvacion]?.[campo] ?? null,
        );
      }
    }
    this.form.salvacionesNotas.set(sheet.salvaciones?.notas ?? '');
    this.form.ataqueBase.set(sheet.ofensivo?.ataqueBase ?? null);
    this.form.resistenciaConjuros.set(
      sheet.ofensivo?.resistenciaConjuros ?? null,
    );
    this.form.ofensivoNotas.set(sheet.ofensivo?.notas ?? '');
    for (const campo of CAMPOS_VELOCIDAD_PIES) {
      this.form.velocidad[campo].set(sheet.velocidad?.[campo] ?? null);
    }
    this.form.velocidad.maniobrabilidad.set(
      sheet.velocidad?.maniobrabilidad ?? '',
    );
    this.form.velocidad.modTemporales.set(sheet.velocidad?.modTemporales ?? '');
    this.form.pgTotal.set(sheet.pg?.total ?? null);
    this.form.pgRd.set(sheet.pg?.rd ?? '');
  }
}
