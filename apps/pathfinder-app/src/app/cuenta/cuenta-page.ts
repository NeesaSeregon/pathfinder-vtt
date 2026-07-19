import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CuentaDetalle } from '@pathfinder/shared';
import { CuentaApi } from './cuenta-api';
import { AuthApi } from '../auth/auth-api';
import { SesionStore } from '../auth/sesion-store';
import { mensajeDeError } from '../characters/mensaje-de-error';

@Component({
  selector: 'app-cuenta-page',
  imports: [FormsModule],
  templateUrl: './cuenta-page.html',
  styleUrl: './cuenta-page.scss',
})
export class CuentaPage {
  private readonly api = inject(CuentaApi);
  private readonly auth = inject(AuthApi);
  private readonly sesion = inject(SesionStore);
  private readonly router = inject(Router);

  protected readonly cuenta = signal<CuentaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Cambio de contraseña (plegado hasta que se pide). */
  protected readonly cambiandoPassword = signal(false);
  protected readonly passwordActual = signal('');
  protected readonly passwordNueva = signal('');
  protected readonly passwordRepetida = signal('');
  protected readonly errorPassword = signal<string | null>(null);
  protected readonly passwordCambiada = signal(false);
  protected readonly guardandoPassword = signal(false);

  /** La zona peligrosa está plegada: no se borra una cuenta de un clic. */
  protected readonly confirmando = signal(false);
  protected readonly password = signal('');
  protected readonly errorBorrado = signal<string | null>(null);
  protected readonly borrando = signal(false);

  /** "3 personajes y 2 partidas": lo que se pierde, dicho en voz alta. */
  protected readonly loQueSePierde = computed(() => {
    const c = this.cuenta();
    if (!c) {
      return '';
    }
    const partes: string[] = [];
    if (c.numPersonajes > 0) {
      partes.push(
        c.numPersonajes === 1 ? '1 personaje' : `${c.numPersonajes} personajes`,
      );
    }
    if (c.numPartidasComoMaster > 0) {
      partes.push(
        c.numPartidasComoMaster === 1
          ? '1 partida que diriges'
          : `${c.numPartidasComoMaster} partidas que diriges`,
      );
    }
    return partes.join(' y ');
  });

  constructor() {
    this.api.detalle().subscribe({
      next: (detalle) => this.cuenta.set(detalle),
      error: (err) =>
        this.error.set(`No se pudieron cargar tus datos: ${mensajeDeError(err)}`),
    });
  }

  protected fecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  protected cambiarPassword(): void {
    this.errorPassword.set(null);
    this.passwordCambiada.set(false);

    // La comprobación de que coinciden es solo del front: al servidor le
    // llega una única contraseña nueva, la repetición no viaja.
    if (this.passwordNueva() !== this.passwordRepetida()) {
      this.errorPassword.set('Las dos contraseñas nuevas no coinciden');
      return;
    }

    this.guardandoPassword.set(true);
    this.api
      .cambiarPassword({
        passwordActual: this.passwordActual(),
        passwordNueva: this.passwordNueva(),
      })
      .subscribe({
        next: () => {
          this.guardandoPassword.set(false);
          this.passwordCambiada.set(true);
          this.cambiandoPassword.set(false);
          this.limpiarCamposPassword();
        },
        error: (err) => {
          this.guardandoPassword.set(false);
          this.errorPassword.set(mensajeDeError(err));
        },
      });
  }

  protected cancelarCambioPassword(): void {
    this.cambiandoPassword.set(false);
    this.errorPassword.set(null);
    this.limpiarCamposPassword();
  }

  private limpiarCamposPassword(): void {
    this.passwordActual.set('');
    this.passwordNueva.set('');
    this.passwordRepetida.set('');
  }

  protected salir(): void {
    this.auth.logout().subscribe({
      // Pase lo que pase en el servidor, aquí ya no hay sesión
      complete: () => this.irseALaCalle(),
      error: () => this.irseALaCalle(),
    });
  }

  protected borrar(): void {
    this.errorBorrado.set(null);
    this.borrando.set(true);
    this.api.borrar({ password: this.password() }).subscribe({
      next: () => this.irseALaCalle(),
      error: (err) => {
        this.borrando.set(false);
        this.errorBorrado.set(mensajeDeError(err));
      },
    });
  }

  private irseALaCalle(): void {
    this.sesion.limpiar();
    this.router.navigate(['/']);
  }
}
