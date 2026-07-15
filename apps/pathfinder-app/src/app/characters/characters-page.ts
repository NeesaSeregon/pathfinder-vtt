import { Component, inject, signal, viewChild } from '@angular/core';
import {
  ATRIBUTO_LABELS,
  ATRIBUTOS,
  bmc,
  dmc,
  caDesprevenido,
  caDeToque,
  casillas,
  Character,
  CharacterSheetData,
  CharacterUpsert,
  claseDeArmadura,
  conSigno,
  formatearModificador,
  iniciativa,
  piesAMetros,
  puntuacionEfectiva,
  SALVACION_LABELS,
  SALVACIONES,
  TAMANO_LABELS,
  tiradaDeSalvacion,
} from '@pathfinder/shared';
import { CharactersApi } from './characters-api';
import { CharacterForm } from './character-form';
import { mensajeDeError } from './mensaje-de-error';

// Orden y etiqueta con la que se muestra cada campo de la ficha.
const ETIQUETAS_FICHA: [keyof CharacterSheetData & string, string][] = [
  ['jugador', 'Jugador'],
  ['clase', 'Clase'],
  ['alineamiento', 'Alineamiento'],
  ['paisNatal', 'País natal'],
  ['dios', 'Dios'],
  ['raza', 'Raza'],
  ['tamano', 'Tamaño'],
  ['edad', 'Edad'],
  ['altura', 'Altura'],
  ['peso', 'Peso'],
  ['cabello', 'Cabello'],
  ['ojos', 'Ojos'],
];

@Component({
  selector: 'app-characters-page',
  imports: [CharacterForm],
  templateUrl: './characters-page.html',
  styleUrl: './characters-page.scss',
  // La tecla Escape cierra la modal esté donde esté el foco.
  host: { '(document:keydown.escape)': 'closeModal()' },
})
export class CharactersPage {
  private readonly api = inject(CharactersApi);

  private readonly createForm = viewChild.required<CharacterForm>('createForm');

  protected readonly characters = signal<Character[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Estado de la modal: personaje seleccionado y si está en modo edición.
  protected readonly selected = signal<Character | null>(null);
  protected readonly editing = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (characters) => {
        this.characters.set(characters);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(`No se pudo cargar la lista: ${mensajeDeError(err)}`);
        this.loading.set(false);
      },
    });
  }

  protected create(payload: CharacterUpsert): void {
    this.api.create(payload).subscribe({
      next: (created) => {
        this.characters.update((list) => [...list, created]);
        this.createForm().reset();
      },
      error: (err) =>
        this.error.set(`No se pudo crear el personaje: ${mensajeDeError(err)}`),
    });
  }

  protected openModal(character: Character): void {
    this.selected.set(character);
    this.editing.set(false);
  }

  protected closeModal(): void {
    this.selected.set(null);
    this.editing.set(false);
  }

  /** Cierra solo si el clic fue en el fondo oscuro, no dentro de la ventana. */
  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  protected saveEdit(payload: CharacterUpsert): void {
    const current = this.selected();
    if (!current) {
      return;
    }
    this.api.update(current.id, payload).subscribe({
      next: (updated) => {
        this.characters.update((list) =>
          list.map((c) => (c.id === updated.id ? updated : c)),
        );
        // Volvemos al modo vista, ya con los datos guardados.
        this.selected.set(updated);
        this.editing.set(false);
      },
      error: (err) =>
        this.error.set(
          `No se pudo guardar el personaje: ${mensajeDeError(err)}`,
        ),
    });
  }

  protected remove(character: Character): void {
    this.api.remove(character.id).subscribe({
      next: () =>
        this.characters.update((list) =>
          list.filter((c) => c.id !== character.id),
        ),
      error: (err) =>
        this.error.set(
          `No se pudo borrar el personaje: ${mensajeDeError(err)}`,
        ),
    });
  }

  protected readonly modificador = formatearModificador;
  protected readonly ca = claseDeArmadura;
  protected readonly caToque = caDeToque;
  protected readonly caDesprevenido = caDesprevenido;

  protected iniciativaDe(character: Character): string {
    return conSigno(iniciativa(character.sheetData));
  }

  /** Solo mostramos el resumen de combate si hay algún dato que lo alimente. */
  protected tieneCombate(character: Character): boolean {
    return Boolean(
      character.sheetData.combate || character.sheetData.atributos?.destreza,
    );
  }

  /** "Ataque base +3 · RC 13 · BMC +9 · DMC 18" si hay bloque ofensivo. */
  protected ofensivoResumen(character: Character): string {
    const ofensivo = character.sheetData.ofensivo;
    if (!ofensivo) {
      return '';
    }
    const partes: string[] = [];
    if (ofensivo.ataqueBase !== undefined) {
      partes.push(`Ataque base ${conSigno(ofensivo.ataqueBase)}`);
    }
    if (ofensivo.resistenciaConjuros !== undefined) {
      partes.push(`RC ${ofensivo.resistenciaConjuros}`);
    }
    partes.push(`BMC ${conSigno(bmc(character.sheetData))}`);
    partes.push(`DMC ${dmc(character.sheetData)}`);
    return partes.join(' · ');
  }

  /** "Fortaleza +9 · Reflejos -1 · Voluntad +1" si hay datos de salvación. */
  protected salvacionesResumen(character: Character): string {
    if (!character.sheetData.salvaciones) {
      return '';
    }
    return SALVACIONES.map(
      (salvacion) =>
        `${SALVACION_LABELS[salvacion]} ${conSigno(
          tiradaDeSalvacion(character.sheetData, salvacion),
        )}`,
    ).join(' · ');
  }

  /** "PG 45 · RD 5/hierro frío", o solo la parte que exista. */
  protected pgResumen(character: Character): string {
    const pg = character.sheetData.pg;
    if (!pg) {
      return '';
    }
    const partes: string[] = [];
    if (pg.total !== undefined) {
      partes.push(`PG ${pg.total}`);
    }
    if (pg.rd) {
      partes.push(`RD ${pg.rd}`);
    }
    return partes.join(' · ');
  }

  /** Resumen de velocidades para la modal: solo los modos rellenos. */
  protected velocidadResumen(character: Character): string[] {
    const velocidad = character.sheetData.velocidad;
    if (!velocidad) {
      return [];
    }
    const pies = (n: number) =>
      `${n} pies (${casillas(n)} cas. / ${piesAMetros(n)} m)`;

    const partes: string[] = [];
    if (velocidad.base !== undefined) {
      partes.push(`Base ${pies(velocidad.base)}`);
    }
    if (velocidad.conArmadura !== undefined) {
      partes.push(`Con armadura ${pies(velocidad.conArmadura)}`);
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

  /** Filas de atributos que el personaje tiene rellenas, para la modal. */
  protected atributosDe(character: Character): {
    label: string;
    puntuacion: number | null;
    ajusteTemporal: string;
    modTemporal: string;
  }[] {
    const atributos = character.sheetData.atributos;
    if (!atributos) {
      return [];
    }
    return ATRIBUTOS.filter((atributo) => atributos[atributo]).map(
      (atributo) => {
        const valor = atributos[atributo];
        const ajuste = valor?.ajusteTemporal;
        return {
          label: ATRIBUTO_LABELS[atributo],
          puntuacion: valor?.puntuacion ?? null,
          ajusteTemporal: ajuste !== undefined ? conSigno(ajuste) : '—',
          modTemporal:
            ajuste !== undefined
              ? formatearModificador(puntuacionEfectiva(valor))
              : '—',
        };
      },
    );
  }

  /** Campos de la ficha que el personaje tiene rellenos, con su etiqueta. */
  protected sheetEntries(
    character: Character,
  ): { label: string; value: unknown }[] {
    return ETIQUETAS_FICHA.filter(([key]) => {
      const value = character.sheetData[key];
      return value !== undefined && value !== null && value !== '';
    }).map(([key, label]) => {
      const value = character.sheetData[key];
      // El tamaño se guarda como clave interna; se muestra con su etiqueta
      if (key === 'tamano' && typeof value === 'string') {
        return { label, value: TAMANO_LABELS[value as never] ?? value };
      }
      return { label, value };
    });
  }
}
