import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ALINEAMIENTOS,
  Alineamiento,
  Character,
  CharacterSheetData,
  CharacterUpsert,
} from '@pathfinder/shared';

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

  protected readonly form = {
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
    return sheet;
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
  }
}
