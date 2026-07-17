import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartidaResumen } from '@pathfinder/shared';
import { PartidasApi } from './partidas-api';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-crear-partida-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './crear-partida-page.html',
  styleUrl: './crear-partida-page.scss',
})
export class CrearPartidaPage {
  private readonly api = inject(PartidasApi);

  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly creada = signal<PartidaResumen | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  protected crear(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api
      .crear({
        nombre: this.nombre().trim(),
        descripcion: this.descripcion().trim() || undefined,
      })
      .subscribe({
        next: (partida) => {
          this.creada.set(partida);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(`No se pudo crear la partida: ${mensajeDeError(err)}`);
        },
      });
  }
}
