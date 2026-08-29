import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthApi } from './auth-api';
import { SesionStore } from './sesion-store';
import { VerContrasena } from './ver-contrasena';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-registro-page',
  imports: [RouterLink, FormsModule, VerContrasena],
  templateUrl: './registro-page.html',
})
export class RegistroPage {
  private readonly api = inject(AuthApi);
  private readonly sesion = inject(SesionStore);
  private readonly router = inject(Router);

  protected readonly usuario = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly password2 = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  protected readonly contrasenasCoinciden = computed(
    () => this.password() === this.password2(),
  );

  protected crearCuenta(): void {
    if (!this.contrasenasCoinciden()) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.error.set(null);
    this.cargando.set(true);
    this.api
      .register({
        username: this.usuario().trim(),
        email: this.email().trim(),
        password: this.password(),
      })
      .subscribe({
        next: (respuesta) => {
          // Registrarse ya te deja dentro: no obligamos a hacer login aparte
          this.sesion.establecer(respuesta.username);
          // Al mismo sitio que el login. Una cuenta recién hecha no tiene
          // mesas NI personajes, y el escritorio explica mejor el primer
          // paso que una lista vacía: el panel de unirse dice "todavía no
          // tienes ninguno" y enlaza a crearlo.
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(`No se pudo crear la cuenta: ${mensajeDeError(err)}`);
        },
      });
  }
}
