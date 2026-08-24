import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SesionStore } from './auth/sesion-store';
import { AuthApi } from './auth/auth-api';

/**
 * ¿Estamos DENTRO de una mesa (/partidas/:id)? Ojo con /partidas/crear, que
 * encaja en la misma forma y sí quiere navbar: es un formulario normal.
 */
function esRutaDeMesa(url: string): boolean {
  const [ruta] = url.split(/[?#]/);
  const trozos = ruta.split('/').filter(Boolean);
  return trozos.length === 2 && trozos[0] === 'partidas' && trozos[1] !== 'crear';
}
@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'pathfinder-app';
  protected readonly sesion = inject(SesionStore);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);

  /**
   * Dentro de una mesa la navbar general estorba: la mesa trae su propia
   * barra, que ya lleva el nombre, el estado de conexión y la salida
   * ("← Mesas"). Decidido el 2026-08-24 al rediseñar la mesa; son ~3rem de
   * alto que se lleva el tablero, que es lo que de verdad se mira.
   */
  protected readonly enLaMesa = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => esRutaDeMesa(this.router.url)),
      startWith(esRutaDeMesa(this.router.url)),
    ),
    { initialValue: false },
  );

  constructor() {
    // Al cargar la app, pregunta quién soy para pintar la navbar
    // (la cookie httpOnly no se puede leer desde JS: hay que preguntar).
    this.api.me().subscribe({
      next: (respuesta) => this.sesion.establecer(respuesta.username),
      error: () => this.sesion.limpiar(),
    });
  }

  protected salir(): void {
    // El logout es del servidor: borra la cookie que el JS no puede tocar
    this.api.logout().subscribe({
      complete: () => {
        this.sesion.limpiar();
        this.router.navigate(['/']);
      },
      error: () => {
        this.sesion.limpiar();
        this.router.navigate(['/']);
      },
    });
  }
}
