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
  ArmaValores,
  ATRIBUTO_ABREV,
  ATRIBUTO_LABELS,
  AtributoLanzamiento,
  ATRIBUTOS,
  ATRIBUTOS_LANZAMIENTO,
  bmc,
  bonificadorHabilidad,
  bonificadorRacial,
  puntuacionFinal,
  RAZAS_CON_ELECCION,
  capacidadDeCarga,
  CapacidadDeCarga,
  cargaActual,
  cdConjuro,
  ConjurosValores,
  conjurosAdicionales,
  DineroValores,
  dmc,
  DoteValores,
  EquipoItem,
  ExperienciaValores,
  experienciaFaltante,
  HABILIDADES,
  HabilidadValores,
  OfensivoValores,
  Character,
  CharacterAtributos,
  CharacterSheetData,
  CharacterUpsert,
  caDesprevenido,
  caDeToque,
  casillas,
  Clase,
  CLASES,
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
  NivelDeConjuros,
  normalizarDotes,
  ObjetoCaValores,
  pesoMonedas,
  pesoTotal,
  PgValores,
  piesAMetros,
  puntuacionEfectiva,
  Raza,
  RAZAS,
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
  totalEnOro,
  totalObjetosCa,
  VelocidadValores,
} from '@pathfinder/shared';

const CAMPOS_DINERO = ['pc', 'pp', 'po', 'ppr'] as const;

export const NIVELES_CONJURO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

interface NivelConjurosForm {
  conocidos: WritableSignal<number | null>;
  porDia: WritableSignal<number | null>;
  anotados: WritableSignal<string>;
}

function crearConjurosForm(): NivelConjurosForm[] {
  return NIVELES_CONJURO.map(() => ({
    conocidos: signal<number | null>(null),
    porDia: signal<number | null>(null),
    anotados: signal(''),
  }));
}

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

const CAMPOS_ARMA = [
  'nombre',
  'bonifAtaque',
  'critico',
  'tipo',
  'alcance',
  'municion',
  'dano',
] as const;

type ArmaForm = Record<(typeof CAMPOS_ARMA)[number], WritableSignal<string>>;

function crearArmaForm(inicial?: ArmaValores): ArmaForm {
  const form = {} as ArmaForm;
  for (const campo of CAMPOS_ARMA) {
    form[campo] = signal(inicial?.[campo] ?? '');
  }
  return form;
}

interface ObjetoCaForm {
  nombre: WritableSignal<string>;
  bonif: WritableSignal<number | null>;
  tipo: WritableSignal<string>;
  penalizador: WritableSignal<number | null>;
  falloConjuro: WritableSignal<string>;
  peso: WritableSignal<number | null>;
  propiedades: WritableSignal<string>;
}

function crearObjetoCaForm(inicial?: ObjetoCaValores): ObjetoCaForm {
  return {
    nombre: signal(inicial?.nombre ?? ''),
    bonif: signal<number | null>(inicial?.bonif ?? null),
    tipo: signal(inicial?.tipo ?? ''),
    penalizador: signal<number | null>(inicial?.penalizador ?? null),
    falloConjuro: signal(inicial?.falloConjuro ?? ''),
    peso: signal<number | null>(inicial?.peso ?? null),
    propiedades: signal(inicial?.propiedades ?? ''),
  };
}

interface EquipoForm {
  nombre: WritableSignal<string>;
  peso: WritableSignal<number | null>;
}

function crearEquipoForm(inicial?: EquipoItem): EquipoForm {
  return {
    nombre: signal(inicial?.nombre ?? ''),
    peso: signal<number | null>(inicial?.peso ?? null),
  };
}

interface DoteForm {
  nombre: WritableSignal<string>;
  descripcion: WritableSignal<string>;
}

function crearDoteForm(inicial?: DoteValores): DoteForm {
  return {
    nombre: signal(inicial?.nombre ?? ''),
    descripcion: signal(inicial?.descripcion ?? ''),
  };
}

type HabilidadesForm = Record<
  string,
  {
    esClase: WritableSignal<boolean>;
    especialidad: WritableSignal<string>;
    rangos: WritableSignal<number | null>;
    modVario: WritableSignal<number | null>;
  }
>;

function crearHabilidadesForm(): HabilidadesForm {
  const form: HabilidadesForm = {};
  for (const habilidad of HABILIDADES) {
    form[habilidad.id] = {
      esClase: signal(false),
      especialidad: signal(''),
      rangos: signal<number | null>(null),
      modVario: signal<number | null>(null),
    };
  }
  return form;
}

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

  // ¿El usuario ha tocado algún control desde que se abrió/cargó? El padre
  // lo consulta para avisar antes de cerrar y no perder lo escrito.
  private readonly _sucio = signal(false);
  readonly sucio = this._sucio.asReadonly();

  /** Lo dispara cualquier input/change del formulario (por propagación). */
  protected marcarSucio(): void {
    this._sucio.set(true);
  }

  protected readonly alineamientos = ALINEAMIENTOS;
  protected readonly clases = CLASES;
  protected readonly razas = RAZAS;

  /** Humano, Semielfo y Semiorco eligen a qué atributo va su +2. */
  protected readonly razaConEleccion = computed(() => {
    const raza = this.form.raza();
    return raza !== '' && RAZAS_CON_ELECCION.includes(raza);
  });
  protected readonly atributos = ATRIBUTOS;
  protected readonly atributoLabels = ATRIBUTO_LABELS;
  protected readonly modificador = formatearModificador;
  protected readonly salvaciones = SALVACIONES;
  protected readonly salvacionLabels = SALVACION_LABELS;
  protected readonly tamanos = TAMANOS;
  protected readonly tamanoLabels = TAMANO_LABELS;
  protected readonly habilidadesDef = HABILIDADES;
  protected readonly atributoAbrev = ATRIBUTO_ABREV;

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
    habilidades: crearHabilidadesForm(),
    habilidadesNotas: signal(''),
    idiomas: signal(''),
    // Listas dinámicas: una señal que contiene grupos de señales por fila
    armas: signal<ArmaForm[]>([]),
    objetosCa: signal<ObjetoCaForm[]>([]),
    equipo: signal<EquipoForm[]>([]),
    dotes: signal<DoteForm[]>([]),
    aptitudesEspeciales: signal(''),
    dinero: {
      pc: signal<number | null>(null),
      pp: signal<number | null>(null),
      po: signal<number | null>(null),
      ppr: signal<number | null>(null),
    },
    experienciaActual: signal<number | null>(null),
    experienciaSiguienteNivel: signal<number | null>(null),
    atributoLanzamiento: signal<AtributoLanzamiento | ''>(''),
    conjurosNiveles: crearConjurosForm(),
    conjurosCondicionales: signal(''),
    dominiosEscuela: signal(''),
    velocidad: crearVelocidadForm(),
    pgTotal: signal<number | null>(null),
    pgRd: signal(''),
    name: signal(''),
    level: signal(1),
    jugador: signal(''),
    clase: signal<Clase | ''>(''),
    alineamiento: signal<Alineamiento | ''>(''),
    paisNatal: signal(''),
    dios: signal(''),
    raza: signal<Raza | ''>(''),
    atributoRacial: signal<(typeof ATRIBUTOS)[number] | ''>(''),
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

  protected agregarArma(): void {
    this.form.armas.update((armas) => [...armas, crearArmaForm()]);
  }

  protected quitarArma(indice: number): void {
    this.form.armas.update((armas) => armas.filter((_, i) => i !== indice));
  }

  protected agregarObjetoCa(): void {
    this.form.objetosCa.update((objetos) => [...objetos, crearObjetoCaForm()]);
  }

  protected quitarObjetoCa(indice: number): void {
    this.form.objetosCa.update((objetos) =>
      objetos.filter((_, i) => i !== indice),
    );
  }

  protected agregarEquipo(): void {
    this.form.equipo.update((equipo) => [...equipo, crearEquipoForm()]);
  }

  protected quitarEquipo(indice: number): void {
    this.form.equipo.update((equipo) => equipo.filter((_, i) => i !== indice));
  }

  protected agregarDote(): void {
    this.form.dotes.update((dotes) => [...dotes, crearDoteForm()]);
  }

  protected quitarDote(indice: number): void {
    this.form.dotes.update((dotes) => dotes.filter((_, i) => i !== indice));
  }

  /** Totales derivados de las tablas de objetos CA y equipo, en vivo. */
  protected readonly totalesObjetosCa = computed(() =>
    totalObjetosCa(this.buildSheetData()),
  );
  protected readonly pesoTotalActual = computed(() =>
    pesoTotal(this.buildSheetData()),
  );
  protected readonly capacidad = computed<CapacidadDeCarga | null>(() =>
    capacidadDeCarga(this.buildSheetData()),
  );
  protected readonly carga = computed(() => cargaActual(this.buildSheetData()));
  protected readonly oroTotal = computed(() =>
    totalEnOro(this.buildSheetData()),
  );
  protected readonly pesoDeMonedas = computed(() =>
    pesoMonedas(this.buildSheetData()),
  );
  protected readonly pxFaltantes = computed(() =>
    experienciaFaltante(this.buildSheetData()),
  );

  protected readonly nivelesConjuro = NIVELES_CONJURO;
  protected readonly atributosLanzamiento = ATRIBUTOS_LANZAMIENTO;

  /** CD y adicionales por nivel de conjuro, en vivo; — sin lanzador. */
  protected cdDeNivel(nivel: number): string {
    const cd = cdConjuro(this.buildSheetData(), nivel);
    return cd === null ? '—' : `${cd}`;
  }

  protected adicionalesDeNivel(nivel: number): string {
    const adicionales = conjurosAdicionales(this.buildSheetData(), nivel);
    return adicionales === null ? '—' : `${adicionales}`;
  }

  /** Sumando de una casilla manual, con signo; vacía cuenta como +0. */
  protected sumando(valor: number | null): string {
    return conSigno(valor ?? 0);
  }

  /** Bonif. total de una habilidad, en vivo, con la fórmula compartida. */
  protected totalHabilidad(id: string): string {
    return conSigno(bonificadorHabilidad(this.buildSheetData(), id));
  }

  /** Mod. del atributo asociado a una habilidad, en vivo. */
  protected modAtributoHabilidad(atributo: (typeof ATRIBUTOS)[number]): string {
    return conSigno(modificadorDeAtributo(this.buildSheetData(), atributo));
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

  /** Bonificador racial de un atributo, o — si la raza no lo toca. */
  protected racialDe(atributo: (typeof ATRIBUTOS)[number]): string {
    const racial = bonificadorRacial(this.buildSheetData(), atributo);
    return racial === 0 ? '—' : conSigno(racial);
  }

  /** Modificador de (base + racial), sin ajustes temporales. */
  protected modConRacial(atributo: (typeof ATRIBUTOS)[number]): string {
    const sheet = this.buildSheetData();
    const puntuacion = sheet.atributos?.[atributo]?.puntuacion;
    const racial = bonificadorRacial(sheet, atributo);
    if (puntuacion === undefined && racial === 0) {
      return '—';
    }
    return formatearModificador((puntuacion ?? 10) + racial);
  }

  /**
   * Modif. temporal de un atributo: el modificador de la puntuación final
   * (base + racial + ajuste). Sin ajuste no hay efecto activo: se muestra —.
   */
  protected modTemporal(atributo: (typeof ATRIBUTOS)[number]): string {
    const ajuste = this.form.atributos[atributo].ajusteTemporal();
    if (ajuste === null) {
      return '—';
    }
    return formatearModificador(puntuacionFinal(this.buildSheetData(), atributo));
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
      clase: this.form.clase() || undefined,
      alineamiento: this.form.alineamiento() || undefined,
      paisNatal: texto(this.form.paisNatal()),
      dios: texto(this.form.dios()),
      raza: this.form.raza() || undefined,
      // La elección de +2 solo tiene sentido en las razas flexibles
      atributoRacial:
        this.razaConEleccion() && this.form.atributoRacial()
          ? (this.form.atributoRacial() as (typeof ATRIBUTOS)[number])
          : undefined,
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

    const habilidades = this.buildHabilidades();
    if (Object.keys(habilidades).length > 0) {
      sheet.habilidades = habilidades;
    } else {
      delete sheet.habilidades;
    }
    const habilidadesNotas = this.form.habilidadesNotas().trim();
    if (habilidadesNotas) {
      sheet.habilidadesNotas = habilidadesNotas;
    } else {
      delete sheet.habilidadesNotas;
    }
    const idiomas = this.form.idiomas().trim();
    if (idiomas) {
      sheet.idiomas = idiomas;
    } else {
      delete sheet.idiomas;
    }

    const armas = this.buildArmas();
    if (armas.length > 0) {
      sheet.armas = armas;
    } else {
      delete sheet.armas;
    }

    const objetosCa = this.buildObjetosCa();
    if (objetosCa.length > 0) {
      sheet.objetosCa = objetosCa;
    } else {
      delete sheet.objetosCa;
    }

    const equipo = this.buildEquipo();
    if (equipo.length > 0) {
      sheet.equipo = equipo;
    } else {
      delete sheet.equipo;
    }

    const dotes = this.buildDotes();
    if (dotes.length > 0) {
      sheet.dotes = dotes;
    } else {
      delete sheet.dotes;
    }
    const aptitudes = this.form.aptitudesEspeciales().trim();
    if (aptitudes) {
      sheet.aptitudesEspeciales = aptitudes;
    } else {
      delete sheet.aptitudesEspeciales;
    }

    const dinero: DineroValores = {};
    for (const moneda of CAMPOS_DINERO) {
      const valor = this.form.dinero[moneda]();
      if (valor !== null) {
        dinero[moneda] = valor;
      }
    }
    if (Object.keys(dinero).length > 0) {
      sheet.dinero = dinero;
    } else {
      delete sheet.dinero;
    }

    const experiencia: ExperienciaValores = {};
    if (this.form.experienciaActual() !== null) {
      experiencia.actual = this.form.experienciaActual() as number;
    }
    if (this.form.experienciaSiguienteNivel() !== null) {
      experiencia.siguienteNivel =
        this.form.experienciaSiguienteNivel() as number;
    }
    if (Object.keys(experiencia).length > 0) {
      sheet.experiencia = experiencia;
    } else {
      delete sheet.experiencia;
    }

    const conjuros = this.buildConjuros();
    if (Object.keys(conjuros).length > 0) {
      sheet.conjuros = conjuros;
    } else {
      delete sheet.conjuros;
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

  private buildArmas(): ArmaValores[] {
    return this.form.armas()
      .map((fila) => {
        const arma: ArmaValores = {};
        for (const campo of CAMPOS_ARMA) {
          const valor = fila[campo]().trim();
          if (valor) {
            arma[campo] = valor;
          }
        }
        return arma;
      })
      // Las filas añadidas pero dejadas en blanco no se guardan
      .filter((arma) => Object.keys(arma).length > 0);
  }

  private buildConjuros(): ConjurosValores {
    const conjuros: ConjurosValores = {};
    const atributoLanzamiento = this.form.atributoLanzamiento();
    if (atributoLanzamiento) {
      conjuros.atributoLanzamiento = atributoLanzamiento;
    }
    const niveles: Record<string, NivelDeConjuros> = {};
    for (const nivel of NIVELES_CONJURO) {
      const fila = this.form.conjurosNiveles[nivel];
      const valores: NivelDeConjuros = {};
      if (fila.conocidos() !== null) {
        valores.conocidos = fila.conocidos() as number;
      }
      if (fila.porDia() !== null) {
        valores.porDia = fila.porDia() as number;
      }
      const anotados = fila.anotados().trim();
      if (anotados) {
        valores.anotados = anotados;
      }
      if (Object.keys(valores).length > 0) {
        niveles[`${nivel}`] = valores;
      }
    }
    if (Object.keys(niveles).length > 0) {
      conjuros.niveles = niveles;
    }
    const condicionales = this.form.conjurosCondicionales().trim();
    if (condicionales) {
      conjuros.condicionales = condicionales;
    }
    const dominiosEscuela = this.form.dominiosEscuela().trim();
    if (dominiosEscuela) {
      conjuros.dominiosEscuela = dominiosEscuela;
    }
    return conjuros;
  }

  private buildObjetosCa(): ObjetoCaValores[] {
    return this.form.objetosCa()
      .map((fila) => {
        const objeto: ObjetoCaValores = {};
        const nombre = fila.nombre().trim();
        if (nombre) objeto.nombre = nombre;
        if (fila.bonif() !== null) objeto.bonif = fila.bonif() as number;
        const tipo = fila.tipo().trim();
        if (tipo) objeto.tipo = tipo;
        if (fila.penalizador() !== null) {
          objeto.penalizador = fila.penalizador() as number;
        }
        const falloConjuro = fila.falloConjuro().trim();
        if (falloConjuro) objeto.falloConjuro = falloConjuro;
        if (fila.peso() !== null) objeto.peso = fila.peso() as number;
        const propiedades = fila.propiedades().trim();
        if (propiedades) objeto.propiedades = propiedades;
        return objeto;
      })
      .filter((objeto) => Object.keys(objeto).length > 0);
  }

  private buildEquipo(): EquipoItem[] {
    return this.form.equipo()
      .map((fila) => {
        const item: EquipoItem = {};
        const nombre = fila.nombre().trim();
        if (nombre) item.nombre = nombre;
        if (fila.peso() !== null) item.peso = fila.peso() as number;
        return item;
      })
      .filter((item) => Object.keys(item).length > 0);
  }

  private buildDotes(): DoteValores[] {
    return this.form.dotes()
      .map((fila) => {
        const dote: DoteValores = {};
        const nombre = fila.nombre().trim();
        if (nombre) dote.nombre = nombre;
        const descripcion = fila.descripcion().trim();
        if (descripcion) dote.descripcion = descripcion;
        return dote;
      })
      .filter((dote) => Object.keys(dote).length > 0);
  }

  private buildHabilidades(): Record<string, HabilidadValores> {
    const habilidades: Record<string, HabilidadValores> = {};
    for (const def of HABILIDADES) {
      const fila = this.form.habilidades[def.id];
      const valores: HabilidadValores = {};
      if (fila.esClase()) {
        valores.esClase = true;
      }
      if (fila.rangos() !== null) {
        valores.rangos = fila.rangos() as number;
      }
      if (fila.modVario() !== null) {
        valores.modVario = fila.modVario() as number;
      }
      const especialidad = fila.especialidad().trim();
      if (especialidad) {
        valores.especialidad = especialidad;
      }
      if (Object.keys(valores).length > 0) {
        habilidades[def.id] = valores;
      }
    }
    return habilidades;
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
    // Cargar datos por código NO cuenta como edición del usuario.
    this._sucio.set(false);
    const sheet = character?.sheetData ?? {};
    this.form.name.set(character?.name ?? '');
    this.form.level.set(character?.level ?? 1);
    this.form.jugador.set(sheet.jugador ?? '');
    this.form.clase.set(sheet.clase ?? '');
    this.form.alineamiento.set(sheet.alineamiento ?? '');
    this.form.paisNatal.set(sheet.paisNatal ?? '');
    this.form.dios.set(sheet.dios ?? '');
    this.form.raza.set(sheet.raza ?? '');
    this.form.atributoRacial.set(sheet.atributoRacial ?? '');
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
    for (const def of HABILIDADES) {
      const valores = sheet.habilidades?.[def.id];
      this.form.habilidades[def.id].esClase.set(valores?.esClase ?? false);
      this.form.habilidades[def.id].especialidad.set(
        valores?.especialidad ?? '',
      );
      this.form.habilidades[def.id].rangos.set(valores?.rangos ?? null);
      this.form.habilidades[def.id].modVario.set(valores?.modVario ?? null);
    }
    this.form.habilidadesNotas.set(sheet.habilidadesNotas ?? '');
    this.form.idiomas.set(sheet.idiomas ?? '');
    this.form.armas.set((sheet.armas ?? []).map((arma) => crearArmaForm(arma)));
    this.form.objetosCa.set(
      (sheet.objetosCa ?? []).map((objeto) => crearObjetoCaForm(objeto)),
    );
    this.form.equipo.set(
      (sheet.equipo ?? []).map((item) => crearEquipoForm(item)),
    );
    // normalizarDotes admite el string antiguo del textarea (una por línea)
    this.form.dotes.set(
      normalizarDotes(sheet.dotes).map((dote) => crearDoteForm(dote)),
    );
    this.form.aptitudesEspeciales.set(sheet.aptitudesEspeciales ?? '');
    for (const moneda of CAMPOS_DINERO) {
      this.form.dinero[moneda].set(sheet.dinero?.[moneda] ?? null);
    }
    this.form.experienciaActual.set(sheet.experiencia?.actual ?? null);
    this.form.experienciaSiguienteNivel.set(
      sheet.experiencia?.siguienteNivel ?? null,
    );
    this.form.atributoLanzamiento.set(
      sheet.conjuros?.atributoLanzamiento ?? '',
    );
    for (const nivel of NIVELES_CONJURO) {
      const valores = sheet.conjuros?.niveles?.[`${nivel}`];
      this.form.conjurosNiveles[nivel].conocidos.set(valores?.conocidos ?? null);
      this.form.conjurosNiveles[nivel].porDia.set(valores?.porDia ?? null);
      this.form.conjurosNiveles[nivel].anotados.set(valores?.anotados ?? '');
    }
    this.form.conjurosCondicionales.set(sheet.conjuros?.condicionales ?? '');
    this.form.dominiosEscuela.set(sheet.conjuros?.dominiosEscuela ?? '');
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
