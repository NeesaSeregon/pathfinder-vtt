import { Component, inject, signal, viewChild } from '@angular/core';
import {
  Character,
  CharacterSheetData,
  CharacterUpsert,
} from '@pathfinder/shared';
import { CharactersApi } from './characters-api';
import { CharacterForm } from './character-form';

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
      error: () => {
        this.error.set('No se pudo cargar la lista. ¿Está la API arrancada?');
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
      error: () => this.error.set('No se pudo crear el personaje.'),
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
      error: () => this.error.set('No se pudo guardar el personaje.'),
    });
  }

  protected remove(character: Character): void {
    this.api.remove(character.id).subscribe({
      next: () =>
        this.characters.update((list) =>
          list.filter((c) => c.id !== character.id),
        ),
      error: () => this.error.set('No se pudo borrar el personaje.'),
    });
  }

  /** Campos de la ficha que el personaje tiene rellenos, con su etiqueta. */
  protected sheetEntries(
    character: Character,
  ): { label: string; value: unknown }[] {
    return ETIQUETAS_FICHA.filter(([key]) => {
      const value = character.sheetData[key];
      return value !== undefined && value !== null && value !== '';
    }).map(([key, label]) => ({ label, value: character.sheetData[key] }));
  }
}
