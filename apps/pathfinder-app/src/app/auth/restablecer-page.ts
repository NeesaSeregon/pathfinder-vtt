import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PASSWORD_MIN_LONGITUD } from '@pathfinder/shared';
import { AuthApi } from './auth-api';
import { mensajeDeError } from '../characters/mensaje-de-error';

/**
 * Paso 2: el usuario llega desde el enlace del correo con ?token=… y elige
 * una contraseña nueva.
 *
 * NO se comprueba el token al entrar (no hay endpoint para "¿este token
 * vale?"): se canjea directamente al enviar el formulario. Un endpoint de
 * validación solo serviría para probar tokens sin coste y no le ahorraría
 * nada al usuario legítimo, que va a escribir la contraseña de todos modos.
 *
 * Al terminar se manda a /entrar SIN sesión iniciada, como pide OWASP: que
 * estrene la contraseña una vez confirma que se ha quedado con ella.
 */
@Component({
  selector: 'app-restablecer-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './restablecer-page.html',
  styleUrl: './login-page.scss',
})
export class RestablecerPage {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly minimo = PASSWORD_MIN_LONGITUD;

  /** El token del enlace. Sin él la página no tiene nada que hacer. */
  protected readonly token = signal(
    this.ruta.snapshot.queryParamMap.get('token') ?? '',
  );

  protected readonly password = signal('');
  protected readonly password2 = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly cargando = signal(false);

  protected readonly coinciden = computed(
    () => this.password() === this.password2(),
  );

  protected readonly bastanteLarga = computed(
    () => this.password().length >= this.minimo,
  );

  protected guardar(): void {
    if (!this.coinciden()) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    this.error.set(null);
    this.cargando.set(true);
    this.api
      .restablecerPassword({
        token: this.token(),
        passwordNueva: this.password(),
      })
      .subscribe({
        next: () => {
          // A /entrar, y con el motivo a la vista: si aterrizara en el
          // formulario a secas, no sabría si el cambio ha llegado a
          // hacerse.
          this.router.navigate(['/entrar'], {
            queryParams: { restablecida: 1 },
          });
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(mensajeDeError(err));
        },
      });
  }
}
