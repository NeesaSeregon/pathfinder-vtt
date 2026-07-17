import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Character,
  ESTADO_PARTIDA_LABELS,
  PartidaResumen,
} from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { CharactersApi } from '../characters/characters-api';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-buscar-partida-page',
  imports: [FormsModule],
  templateUrl: './buscar-partida-page.html',
  styleUrl: './buscar-partida-page.scss',
})
export class BuscarPartidaPage {
  private readonly api = inject(PartidasApi);
  private readonly charactersApi = inject(CharactersApi);

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
        this.mensaje.set(
          `${pep.nombre} se ha unido a «${partida.nombre}»`,
        );
        this.buscar(); // refresca el nº de personajes
      },
      error: (err) =>
        this.error.set(`No se pudo unir: ${mensajeDeError(err)}`),
    });
  }
}
