import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SesionStore } from './auth/sesion-store';
import { AuthApi } from './auth/auth-api';
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
