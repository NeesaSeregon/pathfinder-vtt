import { Component, inject, signal, viewChild } from '@angular/core';
import { Character, CharacterUpsert } from '@pathfinder/shared';
import { CharactersApi } from './characters-api';
import { CharacterForm } from './character-form';
import { FichaVista } from './ficha-vista';
import { mensajeDeError } from './mensaje-de-error';

@Component({
  selector: 'app-characters-page',
  imports: [CharacterForm, FichaVista],
  templateUrl: './characters-page.html',
  styleUrl: './characters-page.scss',
  // La tecla Escape intenta cerrar (avisa si hay cambios sin guardar).
  host: { '(document:keydown.escape)': 'intentarCerrar()' },
})
export class CharactersPage {
  private readonly api = inject(CharactersApi);

  // Referencia al formulario abierto (alta o edición), para saber si el
  // usuario ha escrito algo y avisar antes de cerrar sin querer.
  protected readonly formulario = viewChild(CharacterForm);

  protected readonly characters = signal<Character[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Estado de la modal: personaje seleccionado y si está en modo edición.
  protected readonly selected = signal<Character | null>(null);
  protected readonly editing = signal(false);
  // Modal de alta: el formulario se crea al abrir, así siempre nace vacío.
  protected readonly creating = signal(false);

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
        this.creating.set(false);
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
    this.creating.set(false);
  }

  /** Clic en el fondo oscuro: intenta cerrar (con aviso si hay cambios). */
  protected onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.intentarCerrar();
    }
  }

  /**
   * Cierre "blando": si hay un formulario abierto con cambios sin guardar,
   * pide confirmación antes de descartarlos. En modo vista (sin formulario)
   * o sin cambios, cierra directamente.
   */
  protected intentarCerrar(): void {
    const form = this.formulario();
    if (
      form?.sucio() &&
      !window.confirm('Tienes cambios sin guardar. ¿Descartar y cerrar?')
    ) {
      return;
    }
    this.closeModal();
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
}
