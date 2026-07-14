import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Character } from '@pathfinder/shared';
import { CharactersApi } from './characters-api';

@Component({
  selector: 'app-characters-page',
  imports: [FormsModule],
  templateUrl: './characters-page.html',
  styleUrl: './characters-page.scss',
})
export class CharactersPage {
  private readonly api = inject(CharactersApi);

  protected readonly characters = signal<Character[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Campos del formulario de alta
  protected readonly name = signal('');
  protected readonly level = signal(1);

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

  protected create(): void {
    const name = this.name().trim();
    if (!name) {
      return;
    }
    this.api.create({ name, level: this.level() }).subscribe({
      next: (created) => {
        this.characters.update((list) => [...list, created]);
        this.name.set('');
        this.level.set(1);
      },
      error: () => this.error.set('No se pudo crear el personaje.'),
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
}
