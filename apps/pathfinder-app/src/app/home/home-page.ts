import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SesionStore } from '../auth/sesion-store';
import { AuthApi } from '../auth/auth-api';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  // Público: la plantilla decide qué tarjeta de cuenta pinta
  protected readonly sesion = inject(SesionStore);

  protected salir(): void {
    // El logout lo hace el servidor: borra la cookie httpOnly. Si falla,
    // limpiamos igual el estado local para no dejar una sesión fantasma.
    this.api.logout().subscribe({
      complete: () => this.limpiar(),
      error: () => this.limpiar(),
    });
  }

  private limpiar(): void {
    this.sesion.limpiar();
    this.router.navigate(['/']);
  }
}
