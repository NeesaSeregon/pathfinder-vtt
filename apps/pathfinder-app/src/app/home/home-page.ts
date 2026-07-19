import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ESTADO_PARTIDA_LABELS, MiPartidaResumen } from '@pathfinder/shared';
import { SesionStore } from '../auth/sesion-store';
import { AuthApi } from '../auth/auth-api';
import { PartidasApi } from '../partidas/partidas-api';
import { UnirsePanel } from '../partidas/unirse-panel';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, UnirsePanel],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly api = inject(PartidasApi);
  private readonly auth = inject(AuthApi);
  private readonly router = inject(Router);
  // Público: la plantilla elige entre la portada y el escritorio
  protected readonly sesion = inject(SesionStore);

  protected readonly estadoLabels = ESTADO_PARTIDA_LABELS;
  protected readonly misMesas = signal<MiPartidaResumen[]>([]);
  /** Hasta que responde /mias no sabemos si enseñar mesas o el "aún nada" */
  protected readonly cargandoMesas = signal(true);

  constructor() {
    // La portada no necesita datos: las mesas se piden SOLO cuando hay
    // sesión. Va en un effect y no en el constructor porque al arrancar
    // la app aún no se sabe quién eres (/auth/me responde más tarde).
    effect(() => {
      if (this.sesion.conectado()) {
        this.cargarMesas();
      }
    });
  }

  /** También lo llama el panel de unirse: al sentarte, tienes mesa nueva. */
  protected cargarMesas(): void {
    this.api.mias().subscribe({
      next: (mesas) => {
        this.misMesas.set(mesas);
        this.cargandoMesas.set(false);
      },
      // Sin sesión responde 401 y el interceptor ya se encarga; aquí solo
      // hay que dejar de decir "cargando".
      error: () => this.cargandoMesas.set(false),
    });
  }

  protected salir(): void {
    // El logout lo hace el servidor: borra la cookie httpOnly. Si falla,
    // limpiamos igual el estado local para no dejar una sesión fantasma.
    this.auth.logout().subscribe({
      complete: () => this.limpiarSesion(),
      error: () => this.limpiarSesion(),
    });
  }

  private limpiarSesion(): void {
    this.sesion.limpiar();
    this.router.navigate(['/']);
  }

  /** "diriges · 4 personajes" o "juegas con Valeros": tu papel en la mesa. */
  protected miPapel(mesa: MiPartidaResumen): string {
    if (mesa.soyMaster) {
      const n = mesa.numPersonajes;
      return `diriges · ${n} ${n === 1 ? 'personaje' : 'personajes'}`;
    }
    return `juegas con ${mesa.misPersonajes.join(', ')}`;
  }
}
