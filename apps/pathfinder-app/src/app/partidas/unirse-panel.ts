import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Character,
  ESTADO_PARTIDA_LABELS,
  PartidaResumen,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { CharactersApi } from '../characters/characters-api';
import { mensajeDeError } from '../characters/mensaje-de-error';

/**
 * Buscar una mesa y sentarse en ella con uno de tus personajes. Vive en su
 * propio componente porque lo usan DOS sitios: el escritorio de la home y
 * la página /partidas/buscar. Antes estaba escrito a mano en la página.
 */
@Component({
  selector: 'app-unirse-panel',
  imports: [FormsModule, RouterLink],
  templateUrl: './unirse-panel.html',
  styleUrl: './unirse-panel.scss',
})
export class UnirsePanel {
  private readonly api = inject(PartidasApi);
  private readonly charactersApi = inject(CharactersApi);

  /** Avisa al padre para que refresque lo suyo (la home, sus mesas). */
  readonly unido = output<void>();

  protected readonly estadoLabels = ESTADO_PARTIDA_LABELS;

  protected readonly busqueda = signal('');
  protected readonly resultados = signal<PartidaResumen[]>([]);
  protected readonly misPersonajes = signal<Character[]>([]);
  protected readonly personajeElegido = signal('');
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // Al entrar: las últimas partidas y tus personajes para el selector
    this.buscar();
    this.charactersApi.list().subscribe({
      next: (personajes) => this.misPersonajes.set(personajes),
      error: () => undefined,
    });
  }

  protected buscar(): void {
    this.error.set(null);
    this.api.buscar(this.busqueda()).subscribe({
      next: (partidas) => this.resultados.set(partidas),
      error: (err) =>
        this.error.set(`No se pudo buscar: ${mensajeDeError(err)}`),
    });
  }

  protected unirse(partida: PartidaResumen): void {
    this.mensaje.set(null);
    this.error.set(null);
    this.api.unir(partida.id, this.personajeElegido()).subscribe({
      next: (pep) => {
        this.mensaje.set(`${pep.nombre} se ha unido a «${partida.nombre}»`);
        this.buscar(); // refresca el nº de personajes
        this.unido.emit();
      },
      error: (err) =>
        this.error.set(`No se pudo unir: ${mensajeDeError(err)}`),
    });
  }
}
