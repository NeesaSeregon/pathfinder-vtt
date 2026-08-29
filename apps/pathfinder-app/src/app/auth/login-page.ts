import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthApi } from './auth-api';
import { SesionStore } from './sesion-store';
import { VerContrasena } from './ver-contrasena';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, FormsModule, VerContrasena],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly api = inject(AuthApi);
  private readonly sesion = inject(SesionStore);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  /**
   * Venimos de restablecer la contraseña (/restablecer manda aquí con
   * ?restablecida=1). Sin este acuse, quien acaba de cambiarla aterriza en
   * un formulario de login idéntico al de antes y no sabe si funcionó.
   */
  protected readonly recienRestablecida =
    inject(ActivatedRoute).snapshot.queryParamMap.get('restablecida') === '1';

  protected entrar(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api
      .login({ email: this.email().trim(), password: this.password() })
      .subscribe({
        next: (respuesta) => {
          this.sesion.establecer(respuesta.username);
          // Al escritorio, no a los personajes: se inicia sesión para
          // jugar. Es además donde vuelve TODO lo demás de la app (salir,
          // cerrar una mesa, borrar la cuenta, una URL que no existe).
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(`No se pudo iniciar sesión: ${mensajeDeError(err)}`);
        },
      });
  }
}
