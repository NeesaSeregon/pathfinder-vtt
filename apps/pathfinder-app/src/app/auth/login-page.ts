import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthApi } from './auth-api';
import { SesionStore } from './sesion-store';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, FormsModule],
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

  protected entrar(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api
      .login({ email: this.email().trim(), password: this.password() })
      .subscribe({
        next: (respuesta) => {
          this.sesion.establecer(respuesta.username);
          this.router.navigate(['/personajes']);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(`No se pudo iniciar sesión: ${mensajeDeError(err)}`);
        },
      });
  }
}
