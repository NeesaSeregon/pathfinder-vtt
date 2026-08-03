import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthApi } from './auth-api';
import { mensajeDeError } from '../characters/mensaje-de-error';

/**
 * Paso 1 de la recuperación: pedir el correo.
 *
 * La API responde 204 exista o no la cuenta, así que esta pantalla NO
 * puede decir "te hemos enviado un correo" con certeza: dice "si hay una
 * cuenta con ese correo…". Suena más tibio a propósito — la alternativa
 * sería convertir el formulario en un comprobador de qué correos están
 * registrados aquí.
 */
@Component({
  selector: 'app-recuperar-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './recuperar-page.html',
  styleUrl: './login-page.scss',
})
export class RecuperarPage {
  private readonly api = inject(AuthApi);

  protected readonly email = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);
  protected readonly enviado = signal(false);

  protected pedir(): void {
    this.error.set(null);
    this.cargando.set(true);
    this.api.olvidePassword({ email: this.email().trim() }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.enviado.set(true);
      },
      error: (err) => {
        this.cargando.set(false);
        // El único error que llega aquí de verdad es el 429 del freno (o
        // que la API esté caída): el "no existe esa cuenta" nunca viaja.
        this.error.set(mensajeDeError(err));
      },
    });
  }
}
