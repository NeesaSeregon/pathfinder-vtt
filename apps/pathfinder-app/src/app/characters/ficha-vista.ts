import { Component, input } from '@angular/core';
import {
  ATRIBUTO_LABELS,
  ATRIBUTOS,
  bmc,
  bonificadorHabilidad,
  cargaActual,
  cdConjuro,
  conjurosAdicionales,
  dmc,
  experienciaFaltante,
  HABILIDADES,
  normalizarDotes,
  pesoTotal,
  totalEnOro,
  caDesprevenido,
  caDeToque,
  casillas,
  Character,
  CharacterSheetData,
  claseDeArmadura,
  conSigno,
  bonificadorRacial,
  formatearModificador,
  iniciativa,
  modificadorDeAtributo,
  piesAMetros,
  puntuacionFinal,
  SALVACION_LABELS,
  SALVACIONES,
  TAMANO_LABELS,
  tiradaDeSalvacion,
} from '@pathfinder/shared';

/**
 * Campos que van en la REJILLA de datos. Clase, raza, alineamiento, tamaño
 * y jugador no están aquí: son identidad y se leen en la línea de cabecera,
 * junto al nombre, que es donde se buscan.
 */
const ETIQUETAS_DATOS: [keyof CharacterSheetData & string, string][] = [
  ['paisNatal', 'País natal'],
  ['dios', 'Dios'],
  ['edad', 'Edad'],
  ['idiomas', 'Idiomas'],
  ['altura', 'Altura'],
  ['peso', 'Peso'],
  ['cabello', 'Cabello'],
  ['ojos', 'Ojos'],
];

/** Una pieza de la franja vital: cifra grande, pie y si es un hueco. */
export interface PiezaVital {
  rotulo: string;
  valor: string;
  unidad: string;
  pie: string;
  /** Sin dato. La pieza NO desaparece: se pone una raya y se dice por qué. */
  hueco: boolean;
}

/** Etiqueta + valor con guía de puntos. Ofensiva, habilidades y equipo. */
export interface Par {
  etiqueta: string;
  valor: string;
}

export interface AtributoPieza {
  /** "Fue", "Des"… lo que cabe en la pieza. */
  clave: string;
  /** "Fuerza". Va en el title, con el desglose entero. */
  titulo: string;
  modificador: string;
  puntuacion: string;
  /** "14 base · +2 racial". Vacío si no hay nada que desglosar. */
  desglose: string;
  /** "temp −4 (14)". Vacío si no hay ajuste temporal. */
  temporal: string;
}

export interface ArmaFila {
  nombre: string;
  /** "cortante · alcance 80 pies · 20 virotes" */
  extra: string;
  ataque: string;
  dano: string;
  critico: string;
}

export interface ConjuroFila {
  nivel: string;
  conocidos: string;
  porDia: string;
  adicionales: string;
  cd: string;
  anotados: string;
}

/**
 * Vista de SOLO LECTURA de una ficha de personaje. Se reutiliza en la
 * lista de personajes (modal "Ver ficha") y en la mesa (el máster consulta
 * las hojas de sus jugadores). Todos los valores derivados se calculan con
 * las funciones puras de @pathfinder/shared: aquí no se persiste nada.
 *
 * La maqueta la manda la JERARQUÍA, no el orden de la ficha de papel:
 * arriba las cuatro cifras que se miran en mitad de un turno (CA, PG,
 * iniciativa, velocidad), después los atributos, y el trasfondo al final.
 * Cada bloque se pinta solo si tiene datos; la franja vital, siempre.
 */
@Component({
  selector: 'app-ficha-vista',
  imports: [],
  templateUrl: './ficha-vista.html',
  styleUrl: './ficha-vista.scss',
})
export class FichaVista {
  readonly character = input.required<Character>();

  /** "Paladín 5 · Humano · legal bueno · Mediano · Jugador: Luis" */
  protected cabecera(character: Character): string[] {
    const sheet = character.sheetData;
    const partes: string[] = [
      sheet.clase ? `${sheet.clase} ${character.level}` : `Nivel ${character.level}`,
    ];
    if (sheet.raza) {
      partes.push(sheet.raza);
    }
    if (sheet.alineamiento) {
      partes.push(sheet.alineamiento);
    }
    if (sheet.tamano) {
      partes.push(TAMANO_LABELS[sheet.tamano] ?? sheet.tamano);
    }
    if (sheet.jugador) {
      partes.push(`Jugador: ${sheet.jugador}`);
    }
    return partes;
  }

  /** La experiencia deja de ser un párrafo: cifras y una barra. */
  protected experiencia(
    character: Character,
  ): { texto: string; faltan: string; fraccion: number | null } | null {
    const experiencia = character.sheetData.experiencia;
    if (!experiencia) {
      return null;
    }
    const actual = experiencia.actual ?? 0;
    const siguiente = experiencia.siguienteNivel;
    if (siguiente === undefined) {
      return { texto: `PX ${actual}`, faltan: '', fraccion: null };
    }
    const faltan = experienciaFaltante(character.sheetData);
    return {
      texto: `PX ${actual} / ${siguiente}`,
      faltan: faltan === null ? '' : `faltan ${faltan}`,
      // Tope al 100%: un personaje puede pasarse del umbral sin subir aún.
      fraccion: siguiente > 0 ? Math.min(actual / siguiente, 1) : null,
    };
  }

  /**
   * Las CUATRO piezas de la franja vital, SIEMPRE las cuatro y siempre en
   * el mismo orden: lo que permite leer una ficha de un vistazo es que el
   * dato esté donde se espera, no que esté.
   *
   * OJO con los PG: la ficha guarda el TOTAL y la RD, no los puntos
   * actuales. Los actuales son estado de sesión (PersonajeEnPartida) y se
   * llevan en el panel de Selección, con su barra y su tramo vital.
   */
  protected vitales(character: Character): PiezaVital[] {
    const sheet = character.sheetData;
    const hayCombate = this.tieneCombate(character);
    const pg = sheet.pg;
    const velocidad = sheet.velocidad;
    const conArmadura = velocidad?.conArmadura;
    const pies = conArmadura ?? velocidad?.base;

    const pieVelocidad =
      pies === undefined
        ? 'sin anotar'
        : [
            `${casillas(pies)} casillas`,
            `${piesAMetros(pies)} m`,
            conArmadura !== undefined ? 'con armadura' : '',
          ]
            .filter(Boolean)
            .join(' · ');

    return [
      {
        rotulo: 'Clase de armadura',
        valor: hayCombate ? `${claseDeArmadura(sheet)}` : '—',
        unidad: '',
        pie: hayCombate
          ? `toque ${caDeToque(sheet)} · desprevenido ${caDesprevenido(sheet)}`
          : 'sin anotar',
        hueco: !hayCombate,
      },
      {
        rotulo: 'Puntos de golpe',
        valor: pg?.total !== undefined ? `${pg.total}` : '—',
        unidad: '',
        pie: pg?.rd ? `RD ${pg.rd}` : pg?.total !== undefined ? 'total' : 'sin anotar',
        hueco: pg?.total === undefined,
      },
      {
        rotulo: 'Iniciativa',
        valor: hayCombate ? conSigno(iniciativa(sheet)) : '—',
        unidad: '',
        pie: hayCombate
          ? `Destreza ${conSigno(modificadorDeAtributo(sheet, 'destreza'))}`
          : 'sin Destreza anotada',
        hueco: !hayCombate,
      },
      {
        rotulo: 'Velocidad',
        valor: pies === undefined ? '—' : `${pies}`,
        unidad: pies === undefined ? '' : 'pies',
        pie: pieVelocidad,
        hueco: pies === undefined,
      },
    ];
  }

  /**
   * Los modos de movimiento que no caben en la pieza (volar, nadar, trepar,
   * excavar, los temporales) y la velocidad base cuando la pieza muestra la
   * de con armadura.
   */
  protected velocidadExtra(character: Character): string[] {
    const velocidad = character.sheetData.velocidad;
    if (!velocidad) {
      return [];
    }
    const pies = (n: number) =>
      `${n} pies (${casillas(n)} cas. / ${piesAMetros(n)} m)`;

    const partes: string[] = [];
    if (velocidad.conArmadura !== undefined && velocidad.base !== undefined) {
      partes.push(`Base ${pies(velocidad.base)}`);
    }
    if (velocidad.volar !== undefined) {
      const grado = velocidad.maniobrabilidad
        ? `, ${velocidad.maniobrabilidad}`
        : '';
      partes.push(`Volar ${pies(velocidad.volar)}${grado}`);
    }
    if (velocidad.nadar !== undefined) {
      partes.push(`Nadar ${pies(velocidad.nadar)}`);
    }
    if (velocidad.trepar !== undefined) {
      partes.push(`Trepar ${pies(velocidad.trepar)}`);
    }
    if (velocidad.excavar !== undefined) {
      partes.push(`Excavar ${pies(velocidad.excavar)}`);
    }
    if (velocidad.modTemporales) {
      partes.push(`Temporales: ${velocidad.modTemporales}`);
    }
    return partes;
  }

  /** Solo mostramos el resumen de combate si hay algún dato que lo alimente. */
  protected tieneCombate(character: Character): boolean {
    return Boolean(
      character.sheetData.combate || character.sheetData.atributos?.destreza,
    );
  }

  /**
   * Atributos que el personaje tiene rellenos. Lo GRANDE es el modificador,
   * que es lo que se tira; la puntuación y su desglose van debajo. El
   * ajuste temporal manda sobre el desglose racial —es lo urgente— y el
   * title lleva las dos cosas para quien quiera el detalle.
   */
  protected atributos(character: Character): AtributoPieza[] {
    const sheet = character.sheetData;
    const atributos = sheet.atributos;
    if (!atributos && !sheet.raza) {
      return [];
    }
    return ATRIBUTOS.filter(
      (atributo) =>
        atributos?.[atributo] || bonificadorRacial(sheet, atributo) !== 0,
    ).map((atributo) => {
      const label = ATRIBUTO_LABELS[atributo];
      const valor = atributos?.[atributo];
      const base = valor?.puntuacion;
      const ajuste = valor?.ajusteTemporal;
      const racial = bonificadorRacial(sheet, atributo);
      const final = puntuacionFinal(sheet, atributo);
      const sinTemporal = (base ?? 10) + racial;

      const desglose =
        racial !== 0 && base !== undefined
          ? `${base} base · ${conSigno(racial)} racial`
          : '';
      const temporal =
        ajuste !== undefined ? `temp ${conSigno(ajuste)} (${sinTemporal})` : '';

      return {
        // Las tres primeras letras de la etiqueta: Fue, Des, Con, Int,
        // Sab, Car. La etiqueta entera va en el title.
        clave: label.slice(0, 3),
        titulo: [label, desglose, temporal].filter(Boolean).join(' · '),
        modificador:
          base === undefined && racial === 0 && ajuste === undefined
            ? '—'
            : formatearModificador(final ?? 10),
        puntuacion: final !== undefined ? `${final}` : '—',
        desglose,
        temporal,
      };
    });
  }

  /** Las tres salvaciones con su total derivado. */
  protected salvaciones(character: Character): Par[] {
    if (!character.sheetData.salvaciones) {
      return [];
    }
    return SALVACIONES.map((salvacion) => ({
      etiqueta: SALVACION_LABELS[salvacion],
      valor: conSigno(tiradaDeSalvacion(character.sheetData, salvacion)),
    }));
  }

  /** Ataque base, RC, BMC y DMC como pares, no como una frase con puntos. */
  protected ofensivo(character: Character): Par[] {
    const ofensivo = character.sheetData.ofensivo;
    if (!ofensivo) {
      return [];
    }
    const pares: Par[] = [];
    if (ofensivo.ataqueBase !== undefined) {
      pares.push({
        etiqueta: 'Ataque base',
        valor: conSigno(ofensivo.ataqueBase),
      });
    }
    pares.push({ etiqueta: 'BMC', valor: conSigno(bmc(character.sheetData)) });
    pares.push({ etiqueta: 'DMC', valor: `${dmc(character.sheetData)}` });
    if (ofensivo.resistenciaConjuros !== undefined) {
      pares.push({
        etiqueta: 'Resistencia a conjuros',
        valor: `${ofensivo.resistenciaConjuros}`,
      });
    }
    return pares;
  }

  /** Una fila por arma, con sus columnas separadas para poder compararlas. */
  protected armas(character: Character): ArmaFila[] {
    return (character.sheetData.armas ?? []).map((arma) => ({
      nombre: arma.nombre ?? 'Arma sin nombre',
      extra: [
        arma.tipo,
        arma.alcance && `alcance ${arma.alcance}`,
        arma.municion && `munición ${arma.municion}`,
      ]
        .filter(Boolean)
        .join(' · '),
      ataque: arma.bonifAtaque || '—',
      dano: arma.dano || '—',
      critico: arma.critico || '—',
    }));
  }

  /** Habilidades con datos, con su bonificador total derivado. */
  protected habilidades(character: Character): Par[] {
    const habilidades = character.sheetData.habilidades;
    if (!habilidades) {
      return [];
    }
    return HABILIDADES.filter((def) => habilidades[def.id]).map((def) => {
      const especialidad = habilidades[def.id]?.especialidad;
      return {
        etiqueta: especialidad ? `${def.label} (${especialidad})` : def.label,
        valor: conSigno(bonificadorHabilidad(character.sheetData, def.id)),
      };
    });
  }

  /** Nombres de las dotes; admite fichas antiguas que las guardan como texto. */
  protected dotes(character: Character): string[] {
    return normalizarDotes(character.sheetData.dotes)
      .map((dote) => dote.nombre)
      .filter((nombre): nombre is string => Boolean(nombre));
  }

  /** Una fila por nivel de conjuros, con la CD y los adicionales derivados. */
  protected conjuros(character: Character): ConjuroFila[] {
    const conjuros = character.sheetData.conjuros;
    if (!conjuros?.niveles) {
      return [];
    }
    return Object.entries(conjuros.niveles).map(([nivel, valores]) => {
      const n = Number(nivel);
      const cd = cdConjuro(character.sheetData, n);
      const adicionales = conjurosAdicionales(character.sheetData, n) ?? 0;
      return {
        nivel: `Nivel ${nivel}`,
        conocidos: valores.conocidos !== undefined ? `${valores.conocidos}` : '—',
        porDia: valores.porDia !== undefined ? `${valores.porDia}` : '—',
        adicionales: adicionales > 0 ? `+${adicionales}` : '—',
        cd: cd === null ? '—' : `${cd}`,
        anotados: valores.anotados ?? '',
      };
    });
  }

  /** Objetos que dan CA, peso total y carga: pares, no una frase. */
  protected equipo(character: Character): Par[] {
    const sheet = character.sheetData;
    const objetos = sheet.objetosCa ?? [];
    const cantidad = sheet.equipo?.length ?? 0;
    if (cantidad === 0 && objetos.length === 0) {
      return [];
    }
    const pares: Par[] = objetos.map((objeto) => ({
      etiqueta: objeto.nombre ?? 'Objeto',
      valor: objeto.bonif !== undefined ? `CA ${conSigno(objeto.bonif)}` : '—',
    }));
    pares.push({ etiqueta: 'Peso total', valor: `${pesoTotal(sheet)}` });
    const carga = cargaActual(sheet);
    if (carga) {
      pares.push({ etiqueta: 'Carga', valor: carga });
    }
    return pares;
  }

  /** Cuántos objetos de equipo hay, para el resumen del bloque. */
  protected cuantosObjetos(character: Character): number {
    return character.sheetData.equipo?.length ?? 0;
  }

  /** Las monedas que tenga anotadas, una por par. */
  protected dinero(character: Character): Par[] {
    const dinero = character.sheetData.dinero;
    if (!dinero) {
      return [];
    }
    return (
      [
        ['Platino', dinero.ppr],
        ['Oro', dinero.po],
        ['Plata', dinero.pp],
        ['Cobre', dinero.pc],
      ] as [string, number | undefined][]
    )
      .filter(([, valor]) => valor !== undefined)
      .map(([etiqueta, valor]) => ({ etiqueta, valor: `${valor}` }));
  }

  /** "42,63 po" para el resumen del bloque de dinero. */
  protected dineroTotal(character: Character): string {
    return `${totalEnOro(character.sheetData)} po`;
  }

  /** Campos de la rejilla de datos que el personaje tiene rellenos. */
  protected datos(character: Character): Par[] {
    return ETIQUETAS_DATOS.filter(([key]) => {
      const value = character.sheetData[key];
      return value !== undefined && value !== null && value !== '';
    }).map(([key, etiqueta]) => ({
      etiqueta,
      valor: `${character.sheetData[key]}`,
    }));
  }

  /**
   * ¿Hay algo más que la franja vital y la identidad? La franja se pinta
   * siempre, así que sin esto una ficha recién creada saldría con cuatro
   * rayas y ninguna explicación.
   */
  protected fichaVacia(character: Character): boolean {
    const sheet = character.sheetData;
    return (
      this.atributos(character).length === 0 &&
      this.salvaciones(character).length === 0 &&
      this.ofensivo(character).length === 0 &&
      this.armas(character).length === 0 &&
      this.habilidades(character).length === 0 &&
      this.dotes(character).length === 0 &&
      this.conjuros(character).length === 0 &&
      this.equipo(character).length === 0 &&
      this.dinero(character).length === 0 &&
      this.datos(character).length === 0 &&
      !sheet.aptitudesEspeciales &&
      !sheet.descripcion &&
      !sheet.historia
    );
  }
}
